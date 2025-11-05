import { supabase } from "./supabaseClient.js";

function stripSupabaseRedirectHash() {
  if (typeof window === "undefined") {
    return;
  }

  const rawHash = window.location.hash || "";
  const search = window.location.search || "";
  const hashContainsTokens = rawHash.startsWith("#access_token=");
  const searchContainsTokens = search.includes("access_token=");

  if (hashContainsTokens || searchContainsTokens) {
    const cleanedHash = hashContainsTokens ? "" : rawHash;
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${cleanedHash}`
    );
  }
}

async function bootstrapAuth() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();
    if (error) {
      console.error(error);
      return false;
    }
    if (session?.user) {
      currentUser = session.user;
      waitForProfile(currentUser, {
        interval: 1000,
        maxAttempts: 10,
        notify: false
      }).then((profile) => {
        if (profile) {
          currentProfile = profile;
        }
      });
      return true;
    }
  } catch (error) {
    console.error(error);
  }

  return false;
}

const PAYTABLES = [
  {
    id: "paytable-1",
    name: "Paytable 1",
    steps: [3, 4, 15, 50]
  },
  {
    id: "paytable-2",
    name: "Paytable 2",
    steps: [2, 6, 36, 100]
  },
  {
    id: "paytable-3",
    name: "Paytable 3",
    steps: [1, 10, 40, 200]
  }
];
const NUMBER_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const DENOMINATIONS = [5, 10, 25, 100];
const INITIAL_BANKROLL = 1000;
const DEAL_DELAY = 420;
const DEAL_DELAY_STEP = 40;
const SUITS = [
  { symbol: "♠", color: "black", name: "Spades" },
  { symbol: "♥", color: "red", name: "Hearts" },
  { symbol: "♦", color: "red", name: "Diamonds" },
  { symbol: "♣", color: "black", name: "Clubs" }
];
const RANK_LABELS = {
  A: "Ace"
};

function describeRank(rank) {
  return RANK_LABELS[rank] ?? String(rank);
}

function showToast(message, tone = "info") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3200);
}

function setViewVisibility(view, visible) {
  if (!view) return;
  if (visible) {
    view.classList.add("active");
    view.removeAttribute("hidden");
  } else {
    view.classList.remove("active");
    view.setAttribute("hidden", "");
  }
}

function hideAllRoutes() {
  Object.values(routeViews).forEach((view) => setViewVisibility(view, false));
}

function showAuthView(mode = "login") {
  hideAllRoutes();
  if (appShell) {
    appShell.setAttribute("data-hidden", "true");
  }
  if (authView) {
    setViewVisibility(authView, mode === "login");
  }
  if (signupView) {
    setViewVisibility(signupView, mode === "signup");
  }
  if (mode === "login") {
    if (authErrorEl) {
      authErrorEl.hidden = true;
      authErrorEl.textContent = "";
    }
    if (authSubmitButton) {
      authSubmitButton.disabled = false;
    }
  } else if (mode === "signup") {
    if (signupErrorEl) {
      signupErrorEl.hidden = true;
      signupErrorEl.textContent = "";
    }
    if (signupSubmitButton) {
      signupSubmitButton.disabled = false;
    }
  }
}

function updateHash(route, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const hash = `#/${route}`;
  suppressHash = true;
  if (replace && typeof history !== "undefined" && history.replaceState) {
    history.replaceState(null, "", hash);
  } else {
    window.location.hash = hash;
  }
  setTimeout(() => {
    suppressHash = false;
  }, 0);
}

async function setRoute(route, { replaceHash = false } = {}) {
  let nextRoute = route ?? "home";
  const isAuthRoute = AUTH_ROUTES.has(nextRoute);

  if (!routeViews[nextRoute] && !isAuthRoute) {
    nextRoute = "home";
  }

  if (!currentUser) {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (!currentUser) {
    const authMode = nextRoute === "signup" ? "signup" : "auth";
    showAuthView(authMode === "signup" ? "signup" : "login");
    currentRoute = authMode;
    updateHash(authMode, { replace: true });
    return;
  }

  hideAllRoutes();
  if (authView) {
    setViewVisibility(authView, false);
  }
  if (signupView) {
    setViewVisibility(signupView, false);
  }

  let resolvedRoute = isAuthRoute ? "home" : nextRoute;
  if (!routeViews[resolvedRoute]) {
    resolvedRoute = "home";
  }

  const shouldShowAppShell = TABLE_ROUTES.has(resolvedRoute);
  if (appShell) {
    if (shouldShowAppShell) {
      appShell.removeAttribute("data-hidden");
    } else {
      appShell.setAttribute("data-hidden", "true");
    }
  }

  const targetView = routeViews[resolvedRoute];
  if (targetView) {
    setViewVisibility(targetView, true);
  }

  currentRoute = resolvedRoute;

  if (isAuthRoute) {
    updateHash(resolvedRoute, { replace: true });
  } else if (!replaceHash) {
    updateHash(resolvedRoute);
  }

  if (resolvedRoute === "home") {
    await loadDashboard();
  } else if (resolvedRoute === "prizes") {
    await loadPrizeShop();
  }
}

function getRouteFromHash() {
  if (typeof window === "undefined") return "home";
  const hash = window.location.hash || "";
  const match = hash.match(/#\/([\w-]+)/);
  return match ? match[1] : "home";
}

function handleHashChange() {
  if (suppressHash) return;
  const route = getRouteFromHash();
  setRoute(route, { replaceHash: true });
}

async function refreshCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error(error);
    currentUser = null;
    await setRoute("auth", { replaceHash: true });
    return null;
  }
  currentUser = data?.user ?? null;
  if (!currentUser) {
    await setRoute("auth", { replaceHash: true });
  }
  return currentUser;
}

async function waitForProfile(user, { interval = 1000, maxAttempts = 5, notify = false } = {}) {
  if (!user) return null;
  let notified = false;
  for (let attempt = 0; maxAttempts === Infinity || attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error(error);
      showToast("Unable to load profile", "error");
      return null;
    }

    if (data) {
      currentProfile = data;
      return data;
    }

    if (!notified) {
      notified = true;
      if (notify) {
        showToast("Setting up your account...", "info");
      }
      console.log("Waiting for profile creation by server trigger...");
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return null;
}

async function handleAuthFormSubmit(event) {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : authForm;
  if (!form) return;

  const formData = new FormData(form);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    if (authErrorEl) {
      authErrorEl.hidden = false;
      authErrorEl.textContent = "Please enter your email and password.";
    }
    return;
  }

  if (authSubmitButton) {
    authSubmitButton.disabled = true;
  }
  if (authErrorEl) {
    authErrorEl.hidden = true;
    authErrorEl.textContent = "";
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const normalizedMessage = String(error.message || "").toLowerCase();

      if (normalizedMessage.includes("email not confirmed")) {
        const message = "Email not confirmed. Please check your inbox, then sign in again.";
        showToast(message, "info");
        if (authErrorEl) {
          authErrorEl.hidden = false;
          authErrorEl.textContent = message;
        }
        return;
      }

      if (
        error?.status === 400 ||
        normalizedMessage.includes("invalid login credentials") ||
        normalizedMessage.includes("invalid login")
      ) {
        const message = "Invalid email or password. Please try again.";
        showToast(message, "error");
        if (authErrorEl) {
          authErrorEl.hidden = false;
          authErrorEl.textContent = message;
        }
        return;
      }

      throw error;
    }

    if (data?.user) {
      currentUser = data.user;
    } else {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        currentUser = user;
      }
    }

    if (!currentUser) {
      const message = "Signed in, but unable to load your session. Please try again.";
      showToast(message, "error");
      if (authErrorEl) {
        authErrorEl.hidden = false;
        authErrorEl.textContent = message;
      }
      return;
    }

    showToast("Signed in", "success");
    await setRoute("home");
  } catch (error) {
    console.error(error);
    const message = error?.message || "Authentication failed";
    showToast(message, "error");
    if (authErrorEl) {
      authErrorEl.hidden = false;
      authErrorEl.textContent = message;
    }
  } finally {
    if (authSubmitButton) {
      authSubmitButton.disabled = false;
    }
  }
}

async function handleSignUpFormSubmit(event) {
  event.preventDefault();
  event.stopPropagation();

  const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : signupForm;
  if (!form || !signupSubmitButton) {
    return;
  }

  const formData = new FormData(form);
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    const message = "Please complete all fields.";
    if (signupErrorEl) {
      signupErrorEl.hidden = false;
      signupErrorEl.textContent = message;
    }
    return;
  }

  if (password !== confirmPassword) {
    const message = "Passwords do not match.";
    if (signupErrorEl) {
      signupErrorEl.hidden = false;
      signupErrorEl.textContent = message;
    }
    return;
  }

  signupSubmitButton.disabled = true;
  if (signupErrorEl) {
    signupErrorEl.hidden = true;
    signupErrorEl.textContent = "";
  }

  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    });

    if (error) {
      throw error;
    }

    showToast("Account created. Check your email to confirm, then sign in.", "info");
    if (signupForm) {
      signupForm.reset();
    }
    if (authEmailInput) {
      authEmailInput.value = email;
    }
    await setRoute("auth", { replaceHash: true });
  } catch (error) {
    console.error(error);
    const message = error?.message || "Unable to create account";
    showToast(message, "error");
    if (signupErrorEl) {
      signupErrorEl.hidden = false;
      signupErrorEl.textContent = message;
    }
  } finally {
    signupSubmitButton.disabled = false;
  }
}

async function loadDashboard(force = false) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    await setRoute("auth", { replaceHash: true });
    return;
  }
  currentUser = user;
  if (dashboardLoaded && !force) {
    if (dashboardEmailEl) {
      dashboardEmailEl.textContent = currentUser.email || "";
    }
    if (dashboardCreditsEl && currentProfile) {
      dashboardCreditsEl.textContent = currentProfile.credits ?? 0;
    }
    return;
  }
  dashboardLoaded = true;
  if (dashboardEmailEl) {
    dashboardEmailEl.textContent = currentUser.email || "";
  }
  let resolvedProfile = currentProfile;
  if (!resolvedProfile || force) {
    resolvedProfile = await waitForProfile(currentUser, {
      interval: 1000,
      maxAttempts: 5,
      notify: false
    });
  }

  if (resolvedProfile) {
    currentProfile = resolvedProfile;
    if (dashboardProfileRetryTimer) {
      clearTimeout(dashboardProfileRetryTimer);
      dashboardProfileRetryTimer = null;
    }
    if (dashboardCreditsEl) {
      dashboardCreditsEl.textContent = resolvedProfile.credits ?? 0;
    }
  } else if (dashboardCreditsEl) {
    dashboardCreditsEl.textContent = "Setting up your account...";
    if (!dashboardProfileRetryTimer) {
      dashboardProfileRetryTimer = setTimeout(() => {
        dashboardProfileRetryTimer = null;
        loadDashboard(true);
      }, 1000);
    }
  }
  const { data: runs, error: runsError } = await supabase
    .from("game_runs")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (runsError) {
    console.error(runsError);
    showToast("Unable to load game runs", "error");
  } else if (dashboardRunsEl) {
    dashboardRunsEl.innerHTML = "";
    if (runs.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No game runs recorded yet.";
      dashboardRunsEl.appendChild(empty);
    } else {
      runs.forEach((run) => {
        const item = document.createElement("li");
        const date = run.created_at ? new Date(run.created_at).toLocaleString() : "";
        item.innerHTML = `<span class="run-score">Score: ${run.score}</span><span class="run-date">${date}</span>`;
        dashboardRunsEl.appendChild(item);
      });
    }
  }
}

function renderPrize(prize) {
  const item = document.createElement("li");
  item.className = "prize-item";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `Buy for ${prize.cost} credits`;
  button.className = "link-button";
  button.addEventListener("click", () => handlePurchase(prize, button));
  item.innerHTML = `<h3>${prize.name}</h3><p>${prize.description || ""}</p>`;
  item.appendChild(button);
  return item;
}

async function loadPrizeShop(force = false) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    await setRoute("auth", { replaceHash: true });
    return;
  }
  currentUser = user;
  if (prizesLoaded && !force) return;
  prizesLoaded = true;
  if (!prizeListEl) return;
  prizeListEl.innerHTML = "";
  const loadingItem = document.createElement("li");
  loadingItem.textContent = "Loading prizes...";
  prizeListEl.appendChild(loadingItem);
  const { data: prizes, error } = await supabase
    .from("prizes")
    .select("*")
    .eq("active", true)
    .order("cost", { ascending: true });
  if (error) {
    console.error(error);
    prizeListEl.innerHTML = "";
    const errorItem = document.createElement("li");
    errorItem.textContent = "Unable to load prizes.";
    prizeListEl.appendChild(errorItem);
    showToast("Unable to load prizes", "error");
    return;
  }
  prizeListEl.innerHTML = "";
  if (!prizes || prizes.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No active prizes right now.";
    prizeListEl.appendChild(empty);
    return;
  }
  prizes.forEach((prize) => {
    prizeListEl.appendChild(renderPrize(prize));
  });
}

async function handlePurchase(prize, button) {
  if (!currentUser) {
    showToast("Please sign in first", "error");
    return;
  }
  if (button) {
    button.disabled = true;
  }
  try {
    const { error } = await supabase.rpc("purchase_prize", { _prize_id: prize.id });
    if (error) {
      throw error;
    }
    showToast(`Purchased ${prize.name}!`, "success");
    prizesLoaded = false;
    dashboardLoaded = false;
    await loadDashboard(true);
    await loadPrizeShop(true);
  } catch (error) {
    console.error(error);
    showToast(error?.message || "Unable to purchase prize", "error");
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

async function handleSignOut() {
  await supabase.auth.signOut();

  currentUser = null;
  currentProfile = null;
  dashboardLoaded = false;
  prizesLoaded = false;

  if (dashboardProfileRetryTimer) {
    clearTimeout(dashboardProfileRetryTimer);
    dashboardProfileRetryTimer = null;
  }

  if (dashboardRunsEl) {
    dashboardRunsEl.innerHTML = "";
  }

  if (dashboardCreditsEl) {
    dashboardCreditsEl.textContent = "0";
  }

  showAuthView("login");

  if (appShell) {
    appShell.setAttribute("data-hidden", "true");
  }

  await setRoute("auth", { replaceHash: true });

  if (authEmailInput) {
    authEmailInput.focus();
  }

  showToast("Signed out", "info");
}

export async function logGameRun(score, metadata = {}) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not logged in");
  }
  await supabase.from("game_runs").insert({
    user_id: user.id,
    score,
    metadata
  });
}

function applyTheme(theme) {
  const next = THEME_CLASS_MAP[theme] ? theme : "blue";
  if (!document.body) {
    currentTheme = next;
    return;
  }
  if (currentTheme === next && document.body.classList.contains(THEME_CLASS_MAP[next])) {
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => drawBankrollChart());
    } else {
      drawBankrollChart();
    }
    return;
  }
  ALL_THEME_CLASSES.forEach((className) => {
    document.body.classList.remove(className);
  });
  document.body.classList.add(THEME_CLASS_MAP[next]);
  currentTheme = next;
  if (themeSelect && themeSelect.value !== next) {
    themeSelect.value = next;
  }
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => drawBankrollChart());
  } else {
    drawBankrollChart();
  }
}

function initTheme() {
  let saved = "blue";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEME_CLASS_MAP[stored]) {
      saved = stored;
    }
  } catch (error) {
    saved = "blue";
  }
  applyTheme(saved);
  if (themeSelect) {
    themeSelect.value = saved;
    themeSelect.addEventListener("change", (event) => {
      const selected = event.target.value;
      applyTheme(selected);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, selected);
      } catch (error) {
        /* ignore storage issues */
      }
    });
  }
}

const bankrollEl = document.getElementById("bankroll");
const bankrollDeltaEl = document.getElementById("bankroll-delta");
const betsBody = document.getElementById("bets-body");
const dealButton = document.getElementById("deal-button");
const rebetButton = document.getElementById("rebet-button");
const clearBetsButtons = Array.from(
  document.querySelectorAll('[data-action="clear-bets"]')
);
const drawsContainer = document.getElementById("draws");
const statusEl = document.getElementById("status");
const chipSelectorEl = document.getElementById("chip-selector");
const chipButtons = Array.from(document.querySelectorAll(".chip-choice"));
const betSpotButtons = Array.from(document.querySelectorAll(".bet-spot"));
const betDefinitions = new Map();
const betSpots = new Map();
betSpotButtons.forEach((button) => {
  const key = button.dataset.betKey || button.dataset.rank;
  if (!key) return;
  const type = button.dataset.betType || "number";
  const label = button.dataset.betLabel || button.querySelector(".bet-label")?.textContent?.trim() || key;
  const lockDuringHand = button.dataset.lock === "hand";
  const payout = Number(button.dataset.payout) || 0;
  const metadata = {};

  if (type === "number") {
    metadata.rank = button.dataset.rank;
  } else if (type === "bust-suit") {
    metadata.suit = button.dataset.suit;
  } else if (type === "bust-rank") {
    metadata.face = button.dataset.face;
  } else if (type === "bust-joker") {
    metadata.face = "Joker";
  } else if (type === "count") {
    const min = button.dataset.countMin ? Number(button.dataset.countMin) : 0;
    const maxValue = button.dataset.countMax === "Infinity" ? Infinity : Number(button.dataset.countMax);
    metadata.countMin = min;
    metadata.countMax = Number.isFinite(maxValue) ? maxValue : Infinity;
  }

  let announce;
  if (type === "number") {
    const rankLabel = metadata.rank ? describeRank(metadata.rank) : label;
    announce = `Bet on ${rankLabel}`;
  } else if (type === "count") {
    announce = `${label} card count`;
  } else if (type === "bust-suit") {
    announce = `Bust suit ${metadata.suit}`;
  } else if (type === "bust-rank") {
    announce = `Bust ${metadata.face}`;
  } else if (type === "bust-joker") {
    announce = "Bust Joker";
  } else {
    announce = label;
  }

  betDefinitions.set(key, {
    key,
    type,
    label,
    lockDuringHand,
    payout,
    metadata,
    announce
  });

  betSpots.set(key, {
    button,
    totalEl: button.querySelector(".bet-total"),
    stackEl: button.querySelector(".chip-stack")
  });
});
const handsPlayedEl = document.getElementById("hands-played");
const totalWageredEl = document.getElementById("total-wagered");
const totalPaidEl = document.getElementById("total-paid");
const holdEl = document.getElementById("hold");
const houseEdgeEl = document.getElementById("house-edge");
const historyList = document.getElementById("history-list");
const cardTemplate = document.getElementById("card-template");
const resetAccountButton = document.getElementById("reset-account");
const menuToggle = document.getElementById("menu-toggle");
const utilityPanel = document.getElementById("utility-panel");
const utilityClose = document.getElementById("utility-close");
const themeSelect = document.getElementById("theme-select");
const graphToggle = document.getElementById("graph-toggle");
const chartPanel = document.getElementById("chart-panel");
const chartClose = document.getElementById("chart-close");
const panelScrim = document.getElementById("panel-scrim");
const bankrollChartCanvas = document.getElementById("bankroll-chart");
const bankrollChartWrapper = document.getElementById("bankroll-chart-wrapper");
const bankrollChartCtx =
  bankrollChartCanvas instanceof HTMLCanvasElement
    ? bankrollChartCanvas.getContext("2d")
    : null;
const advancedToggleInput = document.getElementById("advanced-toggle");
const advancedToggleWrapper = advancedToggleInput
  ? advancedToggleInput.closest(".advanced-toggle")
  : null;
const advancedBetsSection = document.getElementById("advanced-bets");
const pausePlayButton = document.getElementById("pause-play");
const paytableRadios = Array.from(document.querySelectorAll('input[name="paytable"]'));
const changePaytableButton = document.getElementById("change-paytable");
const paytableModal = document.getElementById("paytable-modal");
const paytableForm = document.getElementById("paytable-form");
const paytableApplyButton = document.getElementById("paytable-apply");
const paytableCancelButton = document.getElementById("paytable-cancel");
const paytableCloseButton = document.getElementById("paytable-close");
const activePaytableNameEl = document.getElementById("active-paytable-name");
const activePaytableStepsEl = document.getElementById("active-paytable-steps");
const toastContainer = document.getElementById("toast-container");
const authView = document.getElementById("auth-view");
const authForm = document.getElementById("auth-form");
const authEmailInput = document.getElementById("auth-email");
const authErrorEl = document.getElementById("auth-error");
const authSubmitButton = document.getElementById("auth-submit");
const signupView = document.getElementById("signup-view");
const signupForm = document.getElementById("signup-form");
const signupErrorEl = document.getElementById("signup-error");
const signupSubmitButton = document.getElementById("signup-submit");
const signupFirstInput = document.getElementById("signup-first");
const showSignUpButton = document.getElementById("show-signup");
const showLoginButton = document.getElementById("show-login");
const appShell = document.getElementById("app-shell");
const homeView = document.getElementById("home-view");
const playView = document.getElementById("play-view");
const storeView = document.getElementById("store-view");
const dashboardView = document.getElementById("dashboard-view");
const prizeView = document.getElementById("prize-view");
const routeViews = {
  home: homeView,
  play: playView,
  store: storeView,
  dashboard: dashboardView,
  prizes: prizeView
};
const AUTH_ROUTES = new Set(["auth", "signup"]);
const TABLE_ROUTES = new Set(["home", "play", "store"]);
const routeButtons = Array.from(document.querySelectorAll("[data-route-target]"));
const signOutButtons = Array.from(document.querySelectorAll('[data-action="sign-out"]'));
const dashboardEmailEl = document.getElementById("dashboard-email");
const dashboardCreditsEl = document.getElementById("dashboard-credits");
const dashboardRunsEl = document.getElementById("dashboard-runs");
const prizeListEl = document.getElementById("prize-list");

const THEME_CLASS_MAP = {
  blue: "theme-blue",
  pink: "theme-pink",
  orange: "theme-orange"
};
const ALL_THEME_CLASSES = [
  ...Object.values(THEME_CLASS_MAP),
  "theme-retro",
  "theme-cotton-candy",
  "theme-pastel"
];
const THEME_STORAGE_KEY = "run-the-numbers-theme";

let bankroll = INITIAL_BANKROLL;
let bets = [];
let dealing = false;
let selectedChip = DENOMINATIONS[0];
let bettingOpen = true;
let stats = {
  hands: 0,
  wagered: 0,
  paid: 0
};
let lastBetLayout = [];
let currentOpeningLayout = [];
let bankrollAnimating = false;
let bankrollAnimationFrame = null;
let bankrollDeltaTimeout = null;
let bankrollHistory = [];
let advancedMode = false;
let handPaused = false;
let pauseResolvers = [];
let currentHandContext = null;
let activePaytable = PAYTABLES[0];
let pendingPaytableId = activePaytable.id;
let openDrawerPanel = null;
let openDrawerToggle = null;
let currentTheme = "blue";
let currentUser = null;
let currentRoute = "home";
let dashboardLoaded = false;
let prizesLoaded = false;
let currentProfile = null;
let suppressHash = false;
let dashboardProfileRetryTimer = null;

const MAX_HISTORY_POINTS = 500;

function getPaytableById(id) {
  return PAYTABLES.find((table) => table.id === id) ?? PAYTABLES[0];
}

function formatPaytableSummary(table) {
  return table.steps.map((step) => `${step}×`).join(", ");
}

function updateActivePaytableUI({ announce = false } = {}) {
  paytableRadios.forEach((radio) => {
    radio.checked = radio.value === activePaytable.id;
    radio.setAttribute("aria-checked", String(radio.checked));
    const option = radio.closest(".paytable-option");
    if (option) {
      option.classList.toggle("selected", radio.checked);
    }
  });

  if (activePaytableNameEl) {
    activePaytableNameEl.textContent = activePaytable.name;
  }
  if (activePaytableStepsEl) {
    activePaytableStepsEl.textContent = formatPaytableSummary(activePaytable);
  }

  if (announce && statusEl && !dealing) {
    statusEl.textContent = `${activePaytable.name} selected. Ladder pays ${formatPaytableSummary(
      activePaytable
    )}.`;
  }
}

function setActivePaytable(id, { announce = false } = {}) {
  const next = getPaytableById(id);
  if (next.id === activePaytable.id) {
    updateActivePaytableUI({ announce });
    return;
  }
  activePaytable = next;
  pendingPaytableId = activePaytable.id;
  updateActivePaytableUI({ announce });
}

function updatePaytableAvailability() {
  const disabled = !bettingOpen;
  paytableRadios.forEach((radio) => {
    radio.disabled = disabled;
    radio.setAttribute("aria-disabled", String(disabled));
    const option = radio.closest(".paytable-option");
    if (option) {
      option.classList.toggle("option-disabled", disabled);
    }
  });

  if (changePaytableButton) {
    changePaytableButton.disabled = disabled;
    if (disabled) {
      changePaytableButton.setAttribute("aria-disabled", "true");
    } else {
      changePaytableButton.removeAttribute("aria-disabled");
    }
  }
}

function currentStepPays() {
  return activePaytable.steps;
}

function createDeck() {
  const deck = [];
  NUMBER_RANKS.forEach((rank) => {
    SUITS.forEach((suit) => {
      deck.push({
        rank,
        label: String(rank),
        suit: suit.symbol,
        color: suit.color,
        suitName: suit.name,
        stopper: false
      });
    });
  });

  ["J", "Q", "K"].forEach((face) => {
    SUITS.forEach((suit) => {
      deck.push({
        rank: face,
        label: face,
        suit: suit.symbol,
        color: suit.color === "red" ? "red" : "black",
        suitName: suit.name,
        stopper: true
      });
    });
  });

  deck.push({
    rank: "Joker",
    label: "Joker",
    suit: "★",
    color: "black",
    suitName: null,
    stopper: true
  });

  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function updateBankroll() {
  if (bankrollAnimating) {
    stopBankrollAnimation();
  }
  bankrollEl.textContent = formatCurrency(bankroll);
}

function getBetDefinition(key) {
  return betDefinitions.get(key);
}

function updateBetSpotTotals() {
  const totals = new Map(bets.map((bet) => [bet.key, bet.units]));
  betSpots.forEach(({ totalEl, button }, key) => {
    const total = totals.get(key) ?? 0;
    totalEl.textContent = formatCurrency(total);
    button.classList.toggle("has-bet", total > 0);
    const definition = getBetDefinition(key);
    const spokenLabel =
      definition?.type === "number"
        ? describeRank(definition.metadata?.rank ?? definition?.label ?? key)
        : definition?.label || key;
    const prefix = definition?.type === "number" ? `Bet on ${spokenLabel}` : `${spokenLabel} bet`;
    const ariaLabel =
      total > 0
        ? `${prefix}. Total wager ${formatCurrency(total)} units.`
        : `${prefix}. No chips placed.`;
    button.setAttribute("aria-label", ariaLabel);
  });
}

function addChipToSpot(key, value) {
  const spot = betSpots.get(key);
  if (!spot) return;
  const { stackEl } = spot;
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.dataset.value = value;
  chip.textContent = value.toString();
  chip.setAttribute("aria-hidden", "true");
  const stackIndex = stackEl.children.length;
  chip.style.setProperty("--stack-index", stackIndex);
  chip.classList.add(`denom-${value}`);
  stackEl.appendChild(chip);
  requestAnimationFrame(() => {
    chip.classList.add("chip-enter");
  });
}

function clearChipStacks() {
  betSpots.forEach(({ stackEl, totalEl, button }) => {
    stackEl.innerHTML = "";
    totalEl.textContent = formatCurrency(0);
    button.classList.remove("has-bet");
  });
}

function setClearBetsDisabled(disabled) {
  clearBetsButtons.forEach((button) => {
    button.disabled = disabled;
    if (disabled) {
      button.setAttribute("aria-disabled", "true");
    } else {
      button.removeAttribute("aria-disabled");
    }
  });
}

function refreshBetControls() {
  const chipEnabled = bettingOpen || advancedMode;
  chipSelectorEl.classList.toggle("selector-disabled", !chipEnabled);
  chipButtons.forEach((button) => {
    button.disabled = !chipEnabled;
    button.setAttribute("aria-disabled", String(!chipEnabled));
  });

  betSpotButtons.forEach((button) => {
    const key = button.dataset.betKey || button.dataset.rank;
    const definition = key ? getBetDefinition(key) : null;
    const requiresAdvanced = definition ? definition.type !== "number" : false;
    const lockedDuringHand = definition?.lockDuringHand ?? false;
    let disabled = false;

    if (requiresAdvanced && !advancedMode) {
      disabled = true;
    } else if (lockedDuringHand) {
      disabled = !bettingOpen;
    } else if (requiresAdvanced) {
      disabled = false;
    } else {
      disabled = !bettingOpen;
    }

    button.disabled = disabled;
    button.setAttribute("aria-disabled", String(disabled));
  });

  setClearBetsDisabled(!bettingOpen || bets.length === 0);
}

function setBettingEnabled(enabled) {
  bettingOpen = enabled;
  refreshBetControls();
  updatePaytableAvailability();
}

function updateRebetButtonState() {
  if (!rebetButton) return;
  const hasLayout = lastBetLayout.length > 0;
  rebetButton.hidden = !hasLayout;
  const disabled = !hasLayout || dealing;
  rebetButton.disabled = disabled;
  rebetButton.setAttribute("aria-disabled", String(disabled));
}

function updateChipSelectionUI() {
  chipButtons.forEach((button) => {
    const isSelected = Number(button.dataset.value) === selectedChip;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-checked", String(isSelected));
  });
}

function setSelectedChip(value, announce = true) {
  selectedChip = value;
  updateChipSelectionUI();
  if (announce && !dealing) {
    statusEl.textContent = `Selected ${formatCurrency(value)}-unit chip. Tap a bet spot to place chips.`;
  }
}

function renderBets() {
  betsBody.innerHTML = "";
  if (bets.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty";
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No bets placed.";
    row.appendChild(cell);
    betsBody.appendChild(row);
    dealButton.disabled = true;
    setClearBetsDisabled(true);
    updateBetSpotTotals();
    refreshBetControls();
    return;
  }

  bets.forEach((bet) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${bet.label}</td>
      <td>${bet.units}</td>
      <td>${bet.type === "number" ? bet.hits : "—"}</td>
      <td>${formatCurrency(bet.paid)}</td>
    `;
    betsBody.appendChild(row);
  });
  dealButton.disabled = dealing || !bettingOpen;
  setClearBetsDisabled(!bettingOpen);
  updateBetSpotTotals();
  refreshBetControls();
}

function resetBets() {
  bets = [];
  renderBets();
  clearChipStacks();
}

function addBet(key, units) {
  const definition = getBetDefinition(key);
  if (!definition) return null;

  let bet = bets.find((b) => b.key === key);
  if (bet) {
    bet.units += units;
    bet.chips.push(units);
  } else {
    bet = {
      key,
      type: definition.type,
      label: definition.label,
      units,
      hits: definition.type === "number" ? 0 : 0,
      paid: 0,
      chips: [units],
      metadata: { ...definition.metadata },
      rank: definition.metadata.rank ?? null
    };
    bets.push(bet);
  }
  bankroll -= units;
  updateBankroll();
  renderBets();
  addChipToSpot(key, units);
  return bet;
}

function restoreUnits(units) {
  bankroll += units;
  updateBankroll();
}

function resetBetCounters() {
  bets.forEach((bet) => {
    if (bet.type === "number") {
      bet.hits = 0;
    }
    bet.paid = 0;
  });
  renderBets();
}

function makeCardElement(card) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const rankEl = node.querySelector(".card-rank");
  const suitEl = node.querySelector(".card-suit");
  rankEl.textContent = card.label;
  suitEl.textContent = card.suit;
  node.dataset.rank = card.label;

  const colorClass = card.color === "red" ? "card-red" : "card-black";
  node.classList.add(colorClass);

  if (card.stopper) {
    node.classList.add("stopper");
  }

  return node;
}

function formatCurrency(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function waitWhilePaused() {
  if (!handPaused) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    pauseResolvers.push(resolve);
  });
}

async function waitForDealDelay() {
  let remaining = DEAL_DELAY;
  while (remaining > 0) {
    const slice = Math.min(DEAL_DELAY_STEP, remaining);
    await new Promise((resolve) => setTimeout(resolve, slice));
    remaining -= slice;
    if (handPaused) {
      await waitWhilePaused();
    }
  }
}

function drawBankrollChart() {
  if (!bankrollChartCanvas || !bankrollChartCtx) return;

  const values = bankrollHistory.length ? bankrollHistory : [bankroll];
  const padding = {
    top: 28,
    right: 48,
    bottom: 64,
    left: 84
  };
  const minCanvasWidth = 240;

  if (bankrollChartWrapper) {
    const wrapperWidth = bankrollChartWrapper.clientWidth || minCanvasWidth;
    bankrollChartCanvas.style.width = `${Math.max(
      minCanvasWidth,
      Math.round(wrapperWidth)
    )}px`;
  }

  const rect = bankrollChartCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = window.devicePixelRatio || 1;
  bankrollChartCanvas.width = rect.width * dpr;
  bankrollChartCanvas.height = rect.height * dpr;

  const ctx = bankrollChartCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bankrollChartCanvas.width, bankrollChartCanvas.height);
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const chartWidth = Math.max(1, width - padding.left - padding.right);
  const chartHeight = Math.max(1, height - padding.top - padding.bottom);
  const baseY = padding.top + chartHeight;

  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const bodyStyles = getComputedStyle(document.body);
  const rootStyles = getComputedStyle(document.documentElement);
  const cssVar = (name, fallback) => {
    const raw = bodyStyles.getPropertyValue(name) || rootStyles.getPropertyValue(name);
    return raw && raw.trim() ? raw.trim() : fallback;
  };
  const chartBackground = cssVar("--chart-background", "rgba(6, 8, 26, 0.92)");
  const chartBgStart = cssVar("--chart-background-gradient-start", "rgba(255, 99, 224, 0.18)");
  const chartBgEnd = cssVar("--chart-background-gradient-end", "rgba(31, 241, 255, 0.16)");
  const chartGridColor = cssVar("--chart-grid-color", "rgba(31, 241, 255, 0.18)");
  const chartFillColor = cssVar("--chart-fill-color", "rgba(31, 241, 255, 0.18)");
  const chartFillFade = cssVar("--chart-fill-fade", "rgba(31, 241, 255, 0)");
  const chartLineColor = cssVar("--chart-line-color", "#1ff1ff");
  const chartLineShadow = cssVar("--chart-line-shadow", "rgba(139, 109, 255, 0.45)");
  const chartMarkerColor = cssVar("--chart-marker-color", "#ff63e0");
  const chartMarkerStroke = cssVar("--chart-marker-stroke", "rgba(248, 249, 255, 0.85)");
  const chartMarkerShadow = cssVar("--chart-marker-shadow", "rgba(255, 99, 224, 0.6)");
  const chartBaseLine = cssVar("--chart-base-line", "rgba(31, 241, 255, 0.35)");
  const chartAxisColor = cssVar("--chart-axis-color", "rgba(248, 249, 255, 0.85)");

  ctx.fillStyle = chartBackground;
  ctx.fillRect(0, 0, width, height);

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, chartBgStart);
  backgroundGradient.addColorStop(1, chartBgEnd);
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = chartGridColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? padding.left + chartWidth / 2
        : padding.left + (chartWidth * index) / (values.length - 1);
    const y = padding.top + chartHeight * (1 - (value - minVal) / range);
    return { x, y };
  });

  if (points.length >= 2) {
    const fillGradient = ctx.createLinearGradient(0, padding.top, 0, baseY);
    fillGradient.addColorStop(0, chartFillColor);
    fillGradient.addColorStop(1, chartFillFade);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.lineTo(points[0].x, baseY);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();
  }

  ctx.beginPath();
  if (points.length === 1) {
    const point = points[0];
    ctx.fillStyle = chartLineColor;
    ctx.shadowColor = chartLineShadow;
    ctx.shadowBlur = 12;
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.strokeStyle = chartLineColor;
    ctx.lineWidth = 2.8;
    ctx.shadowColor = chartLineShadow;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (points.length > 0) {
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.fillStyle = chartMarkerColor;
    ctx.strokeStyle = chartMarkerStroke;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = chartMarkerShadow;
    ctx.shadowBlur = 12;
    ctx.arc(lastPoint.x, lastPoint.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = chartBaseLine;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(padding.left, baseY);
  ctx.lineTo(width - padding.right, baseY);
  ctx.stroke();

  ctx.font = "600 12px 'Play', 'Segoe UI', sans-serif";
  ctx.fillStyle = chartAxisColor;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight * i) / 4;
    const valueLabel = minVal + (range * (4 - i)) / 4;
    ctx.fillText(formatCurrency(Math.round(valueLabel)), padding.left - 12, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  if (points.length > 0) {
    const tickIndices = [];
    const minSpacing = 48;
    let lastX = -Infinity;
    points.forEach((point, index) => {
      const isEdge = index === 0 || index === points.length - 1;
      if (isEdge || point.x - lastX >= minSpacing) {
        tickIndices.push(index);
        lastX = point.x;
      }
    });

    tickIndices.forEach((index) => {
      const point = points[index];
      ctx.fillText(String(index + 1), point.x, baseY + 8);
    });
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Hands played: ${Math.max(0, values.length - 1)}`, padding.left, padding.top + 6);
}

function recordBankrollHistoryPoint() {
  bankrollHistory.push(bankroll);
  if (bankrollHistory.length > MAX_HISTORY_POINTS) {
    bankrollHistory = bankrollHistory.slice(-MAX_HISTORY_POINTS);
  }
  drawBankrollChart();
}

function resetBankrollHistory() {
  bankrollHistory = [bankroll];
  drawBankrollChart();
}

function updatePauseButton() {
  if (!pausePlayButton) return;
  const shouldShow = advancedMode && dealing;
  pausePlayButton.hidden = !shouldShow;
  if (!shouldShow) {
    pausePlayButton.setAttribute("aria-pressed", "false");
    pausePlayButton.textContent = "Pause";
    pausePlayButton.disabled = true;
    return;
  }
  pausePlayButton.disabled = false;
  pausePlayButton.textContent = handPaused ? "Resume" : "Pause";
  pausePlayButton.setAttribute("aria-pressed", String(handPaused));
}

function setHandPaused(paused) {
  if (handPaused === paused) return;
  handPaused = paused;
  if (!handPaused) {
    while (pauseResolvers.length) {
      const resolve = pauseResolvers.shift();
      if (resolve) {
        resolve();
      }
    }
  }
  updatePauseButton();
  refreshBetControls();
  if (handPaused) {
    statusEl.textContent = "Dealing paused. Place bust bets or resume play.";
  } else if (dealing) {
    statusEl.textContent = "Dealing...";
  }
}

function setAdvancedMode(enabled) {
  if (advancedMode === enabled) return;
  advancedMode = enabled;

  if (advancedBetsSection) {
    if (enabled) {
      advancedBetsSection.hidden = false;
      advancedBetsSection.classList.add("is-open");
      advancedBetsSection.setAttribute("aria-hidden", "false");
    } else {
      advancedBetsSection.classList.remove("is-open");
      advancedBetsSection.setAttribute("aria-hidden", "true");
      advancedBetsSection.hidden = true;
    }
  }

  if (advancedToggleInput) {
    advancedToggleInput.checked = enabled;
    advancedToggleInput.setAttribute("aria-checked", String(enabled));
  }

  if (advancedToggleWrapper) {
    advancedToggleWrapper.classList.toggle("is-active", enabled);
  }

  document.body.classList.toggle("advanced-enabled", enabled);
  if (!enabled) {
    setHandPaused(false);
  }
  refreshBetControls();
  updatePauseButton();
}

function stopBankrollAnimation(restoreDisplay = true) {
  if (bankrollAnimationFrame !== null) {
    cancelAnimationFrame(bankrollAnimationFrame);
    bankrollAnimationFrame = null;
  }
  if (bankrollDeltaTimeout !== null) {
    clearTimeout(bankrollDeltaTimeout);
    bankrollDeltaTimeout = null;
  }
  bankrollAnimating = false;
  if (bankrollEl) {
    bankrollEl.classList.remove(
      "bankroll-positive",
      "bankroll-negative",
      "bankroll-neutral",
      "bankroll-pulse"
    );
  }
  if (bankrollDeltaEl) {
    bankrollDeltaEl.classList.remove(
      "visible",
      "bankroll-positive",
      "bankroll-negative",
      "bankroll-neutral"
    );
    bankrollDeltaEl.textContent = "";
  }
  if (restoreDisplay && bankrollEl) {
    bankrollEl.textContent = formatCurrency(bankroll);
  }
}

function animateBankrollOutcome(delta) {
  if (!bankrollEl) return;

  stopBankrollAnimation(false);

  if (!Number.isFinite(delta)) {
    bankrollEl.textContent = formatCurrency(bankroll);
    return;
  }

  if (delta === 0) {
    bankrollAnimating = true;
    bankrollEl.classList.add("bankroll-neutral", "bankroll-pulse");
    if (bankrollDeltaEl) {
      bankrollDeltaEl.textContent = "±0";
      bankrollDeltaEl.classList.add("visible", "bankroll-neutral");
    }
    bankrollDeltaTimeout = window.setTimeout(() => {
      bankrollEl.classList.remove("bankroll-neutral", "bankroll-pulse");
      if (bankrollDeltaEl) {
        bankrollDeltaEl.classList.remove("visible", "bankroll-neutral");
        bankrollDeltaEl.textContent = "";
      }
      bankrollAnimating = false;
      bankrollDeltaTimeout = null;
    }, 1200);
    return;
  }

  const finalValue = bankroll;
  const startValue = finalValue - delta;
  const directionClass = delta > 0 ? "bankroll-positive" : "bankroll-negative";
  const deltaText = `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta))}`;

  bankrollAnimating = true;
  bankrollEl.classList.add(directionClass, "bankroll-pulse");
  bankrollEl.classList.remove(
    delta > 0 ? "bankroll-negative" : "bankroll-positive",
    "bankroll-neutral"
  );

  if (bankrollDeltaEl) {
    bankrollDeltaEl.classList.remove(
      delta > 0 ? "bankroll-negative" : "bankroll-positive",
      "bankroll-neutral"
    );
    bankrollDeltaEl.classList.add("visible", directionClass);
    bankrollDeltaEl.textContent = deltaText;
  }

  bankrollEl.textContent = formatCurrency(startValue);

  const duration = 900;
  const startTime = performance.now();

  function step(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const currentValue = Math.round(startValue + (finalValue - startValue) * eased);
    bankrollEl.textContent = formatCurrency(currentValue);
    if (progress < 1) {
      bankrollAnimationFrame = requestAnimationFrame(step);
    } else {
      bankrollEl.textContent = formatCurrency(finalValue);
      bankrollAnimationFrame = null;
      bankrollAnimating = false;
      bankrollDeltaTimeout = window.setTimeout(() => {
        bankrollEl.classList.remove(directionClass, "bankroll-pulse");
        if (bankrollDeltaEl) {
          bankrollDeltaEl.classList.remove("visible", directionClass);
          bankrollDeltaEl.textContent = "";
        }
        bankrollDeltaTimeout = null;
      }, 1400);
    }
  }

  bankrollAnimationFrame = requestAnimationFrame(step);
}

function updateStatsUI() {
  handsPlayedEl.textContent = stats.hands.toString();
  totalWageredEl.textContent = formatCurrency(stats.wagered);
  totalPaidEl.textContent = formatCurrency(stats.paid);
  const hold = stats.wagered - stats.paid;
  holdEl.textContent = formatCurrency(hold);
  const edge = stats.wagered > 0 ? (hold / stats.wagered) * 100 : 0;
  houseEdgeEl.textContent = `${edge.toFixed(2)}%`;
}

function formatStopper({ label, suit }) {
  return label === "Joker" ? "Joker" : `${label}${suit}`;
}

function snapshotLayout(source) {
  return source.map((entry) => ({
    key: entry.key,
    chips: Array.isArray(entry.chips) ? [...entry.chips] : []
  }));
}

function layoutTotalUnits(layout) {
  return layout.reduce((sum, entry) => {
    const chips = entry.chips ?? [];
    return sum + chips.reduce((inner, value) => inner + value, 0);
  }, 0);
}

function applyBetLayout(layout) {
  bets = [];
  clearChipStacks();
  renderBets();
  const needsAdvanced = layout.some(({ key }) => {
    const definition = getBetDefinition(key);
    return definition && definition.type !== "number";
  });
  if (needsAdvanced) {
    setAdvancedMode(true);
  }
  layout.forEach(({ key, chips = [] }) => {
    chips.forEach((value) => addBet(key, value));
  });
}

function summarizeBetResult(bet) {
  if (bet.type === "number") {
    const spokenRank = describeRank(bet.metadata?.rank ?? bet.rank ?? "");
    return bet.hits > 0
      ? `${bet.units}u on ${spokenRank}: <span class="hit">${bet.hits} hits / ${formatCurrency(
          bet.paid
        )}</span>`
      : `${bet.units}u on ${spokenRank}: 0 hits`;
  }

  const profit = bet.paid > 0 ? bet.paid - bet.units : 0;
  const payoutText =
    bet.paid > 0
      ? `<span class="hit">won ${formatCurrency(profit)} · stake returned</span>`
      : "no win";
  return `${bet.label}: ${payoutText}`;
}

function addHistoryEntry(result) {
  const item = document.createElement("li");
  const hitsDescription = result.betSummaries.length
    ? result.betSummaries.join(" · ")
    : "No winning hits";
  item.innerHTML = `
    <span class="stopper-card">Stopped on ${formatStopper(result.stopper)}</span> ·
    ${hitsDescription}
  `;
  historyList.prepend(item);
  while (historyList.children.length > 8) {
    historyList.removeChild(historyList.lastChild);
  }
}

function resetTable(
  message = "Select a chip and place your bets in the betting panel.",
  { clearDraws = false } = {}
) {
  if (clearDraws) {
    drawsContainer.innerHTML = "";
  }
  if (message) {
    statusEl.textContent = message;
  }
  dealing = false;
  currentHandContext = null;
  setHandPaused(false);
  setBettingEnabled(true);
  dealButton.disabled = bets.length === 0;
  updatePauseButton();
  updateRebetButtonState();
}

function renderDraw(card) {
  const cardEl = makeCardElement(card);
  const fragment = document.createDocumentFragment();
  fragment.appendChild(cardEl);
  drawsContainer.appendChild(fragment);
  requestAnimationFrame(() => {
    cardEl.classList.add("dealt-in");
  });
}

function settleAdvancedBets(stopperCard, context = {}) {
  const nonStopperCount = context.nonStopperCount ?? 0;
  const totalCards = context.totalCards ?? nonStopperCount;
  bets.forEach((bet) => {
    if (bet.type === "number") return;
    const definition = getBetDefinition(bet.key);
    if (!definition) return;

    let payout = 0;
    const { metadata } = definition;

    switch (definition.type) {
      case "bust-suit":
        if (stopperCard.label !== "Joker" && stopperCard.suitName === metadata.suit) {
          payout = definition.payout * bet.units;
        }
        break;
      case "bust-rank":
        if (stopperCard.label === metadata.face) {
          payout = definition.payout * bet.units;
        }
        break;
      case "bust-joker":
        if (stopperCard.label === "Joker") {
          payout = definition.payout * bet.units;
        }
        break;
      case "count":
        {
          const min = metadata.countMin ?? 0;
          const max = metadata.countMax ?? min;
          if (max === Infinity) {
            if (totalCards >= min) {
              payout = definition.payout * bet.units;
            }
          } else if (totalCards === max) {
            payout = definition.payout * bet.units;
          }
        }
        break;
      default:
        break;
    }

    if (payout > 0) {
      const totalReturn = payout + bet.units;
      bet.paid += totalReturn;
      bankroll += totalReturn;
      updateBankroll();
    }
  });
}

function endHand(stopperCard, context = {}) {
  setHandPaused(false);
  settleAdvancedBets(stopperCard, context);
  const totalWagerThisHand = bets.reduce((sum, bet) => sum + bet.units, 0);
  const totalPaidThisHand = bets.reduce((sum, bet) => sum + bet.paid, 0);
  const netThisHand = totalPaidThisHand - totalWagerThisHand;

  stats.hands += 1;
  stats.wagered += totalWagerThisHand;
  stats.paid += totalPaidThisHand;
  updateStatsUI();

  statusEl.textContent = `Hand stopped on ${stopperCard.label}${
    stopperCard.label !== "Joker" ? " of " + stopperCard.suit : ""
  }. Place your next bets.`;

  addHistoryEntry({
    stopper: stopperCard,
    betSummaries: bets.map((bet) => summarizeBetResult(bet))
  });

  lastBetLayout = currentOpeningLayout.length > 0 ? snapshotLayout(currentOpeningLayout) : [];
  currentOpeningLayout = [];

  dealing = false;
  animateBankrollOutcome(netThisHand);
  recordBankrollHistoryPoint();
  const metadata = {
    stopper: stopperCard.label,
    suit: stopperCard.suitName ?? null,
    totalCards: context.totalCards ?? null,
    bets: bets.map((bet) => ({
      key: bet.key,
      type: bet.type,
      units: bet.units,
      hits: bet.hits,
      paid: bet.paid
    }))
  };
  logGameRun(netThisHand, metadata).catch((error) => {
    console.error(error);
    showToast("Could not record game run", "error");
  });
  resetBets();
  setBettingEnabled(true);
  updateRebetButtonState();
  updatePauseButton();
}

function processCard(card, context) {
  if (context) {
    context.totalCards = (context.totalCards ?? 0) + 1;
  }

  renderDraw(card);

  if (card.stopper) {
    endHand(card, context);
    return true;
  }

  if (context) {
    context.nonStopperCount = (context.nonStopperCount ?? 0) + 1;
  }

  const rank = card.rank;
  let totalHitPayout = 0;
  let hitsRecorded = 0;
  const stepPays = currentStepPays();
  bets.forEach((bet) => {
    if (
      bet.type === "number" &&
      bet.metadata?.rank === rank &&
      bet.hits < stepPays.length
    ) {
      const pay = stepPays[bet.hits] * bet.units;
      bet.paid += pay;
      bet.hits += 1;
      bankroll += pay;
      updateBankroll();
      totalHitPayout += pay;
      hitsRecorded += 1;
    }
  });

  renderBets();
  if (hitsRecorded > 0) {
    const spokenRank = describeRank(rank);
    statusEl.textContent = `${spokenRank} hits ${hitsRecorded} bet${
      hitsRecorded > 1 ? "s" : ""
    } for ${formatCurrency(totalHitPayout)} units.`;
  } else {
    statusEl.textContent = `${describeRank(rank)} keeps the action going.`;
  }
  return false;
}

async function dealHand() {
  if (bets.length === 0 || dealing) return;
  currentOpeningLayout = snapshotLayout(bets);
  dealing = true;
  pauseResolvers = [];
  currentHandContext = { nonStopperCount: 0, totalCards: 0 };
  setHandPaused(false);
  setBettingEnabled(false);
  dealButton.disabled = true;
  updateRebetButtonState();
  resetBetCounters();
  drawsContainer.innerHTML = "";
  statusEl.textContent = "Dealing...";
  updatePauseButton();

  const deck = createDeck();
  shuffle(deck);

  for (const card of deck) {
    await waitWhilePaused();
    const shouldStop = processCard(card, currentHandContext);
    if (shouldStop) {
      break;
    }
    await waitForDealDelay();
  }

  currentHandContext = null;
  setHandPaused(false);
  updatePauseButton();
}

function placeBet(key) {
  const definition = getBetDefinition(key);
  if (!definition) return;

  if (!bettingOpen && definition.lockDuringHand) {
    statusEl.textContent = `${definition.label} bets are locked while a hand is in progress.`;
    return;
  }

  if (definition.type !== "number" && !advancedMode) {
    statusEl.textContent = "Enable Advanced Mode to place this wager.";
    return;
  }

  if (selectedChip > bankroll) {
    statusEl.textContent = `Insufficient bankroll for a ${formatCurrency(
      selectedChip
    )}-unit chip. Try a smaller denomination.`;
    return;
  }

  const bet = addBet(key, selectedChip);
  if (!bet) return;
  const totalForBet = formatCurrency(bet.units);
  const spokenLabel =
    definition.type === "number"
      ? describeRank(definition.metadata?.rank ?? definition.label)
      : definition.label;
  statusEl.textContent = `Placed ${formatCurrency(selectedChip)} unit${
    selectedChip !== 1 ? "s" : ""
  } on ${spokenLabel}. Total on ${definition.label}: ${totalForBet} unit${
    bet.units !== 1 ? "s" : ""
  }.`;
}

chipButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    const value = Number(button.dataset.value);
    if (!Number.isFinite(value)) return;
    setSelectedChip(value);
  });
});

betSpotButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    const key = button.dataset.betKey || button.dataset.rank;
    if (!key) return;
    placeBet(key);
  });
});

paytableRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    pendingPaytableId = radio.value;
  });
});

if (advancedToggleInput) {
  advancedToggleInput.addEventListener("change", (event) => {
    const enabled = Boolean(event.target.checked);
    setAdvancedMode(enabled);
    if (!dealing) {
      statusEl.textContent = enabled
        ? "Advanced Mode enabled. Bust and card count wagers are available below the deal area."
        : "Advanced Mode disabled. Only Ace and number bets remain on the felt.";
    }
  });
}

if (pausePlayButton) {
  pausePlayButton.addEventListener("click", () => {
    if (!dealing) return;
    setHandPaused(!handPaused);
  });
}

function handleClearBetsClick() {
  if (dealing || !bettingOpen || bets.length === 0) return;
  const totalUnits = bets.reduce((sum, bet) => sum + bet.units, 0);
  restoreUnits(totalUnits);
  resetBets();
  statusEl.textContent = "Bets cleared.";
}

clearBetsButtons.forEach((button) => {
  button.addEventListener("click", handleClearBetsClick);
});

dealButton.addEventListener("click", () => {
  if (bets.length === 0 || dealing) return;
  dealHand();
});

rebetButton.addEventListener("click", () => {
  if (dealing || lastBetLayout.length === 0) return;
  const totalNeeded = layoutTotalUnits(lastBetLayout);
  if (totalNeeded === 0) {
    statusEl.textContent = "No prior wagers to rebet.";
    return;
  }

  const outstanding = bets.reduce((sum, bet) => sum + bet.units, 0);
  const available = bankroll + outstanding;
  if (totalNeeded > available) {
    statusEl.textContent = `Not enough bankroll to rebet ${formatCurrency(
      totalNeeded
    )} units. Reset your account or place smaller bets.`;
    return;
  }

  if (outstanding > 0) {
    restoreUnits(outstanding);
    resetBets();
  }

  rebetButton.disabled = true;
  applyBetLayout(lastBetLayout);
  statusEl.textContent = "Previous wagers restored. Adjust or add bets, then deal when ready.";
  rebetButton.disabled = false;
  updateRebetButtonState();
  dealButton.disabled = false;
});

resetAccountButton.addEventListener("click", () => {
  if (dealing) return;
  bankroll = INITIAL_BANKROLL;
  updateBankroll();
  stats = { hands: 0, wagered: 0, paid: 0 };
  updateStatsUI();
  lastBetLayout = [];
  currentOpeningLayout = [];
  historyList.innerHTML = "";
  resetBets();
  resetTable("Account reset. Select a chip and place your bets in the betting panel.", {
    clearDraws: true
  });
  resetBankrollHistory();
  closeUtilityPanel();
});

function openDrawer(panel, toggle) {
  if (!panel || !panelScrim) return;
  if (panel === openDrawerPanel) return;
  closeActiveDrawer();
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "true");
  }
  panelScrim.hidden = false;
  openDrawerPanel = panel;
  openDrawerToggle = toggle || null;
  if (panel === chartPanel) {
    requestAnimationFrame(() => {
      drawBankrollChart();
    });
  }
}

function closeDrawer(panel = openDrawerPanel, toggle = openDrawerToggle) {
  if (!panel) return;
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
  }
  if (panel === openDrawerPanel) {
    openDrawerPanel = null;
    openDrawerToggle = null;
  }
  if (!openDrawerPanel && panelScrim) {
    panelScrim.hidden = true;
  }
}

function closeActiveDrawer({ returnFocus = false } = {}) {
  if (!openDrawerPanel) return;

  const panel = openDrawerPanel;
  const toggle = openDrawerToggle;
  const activeElement = document.activeElement;

  if (activeElement && panel.contains(activeElement)) {
    if (toggle) {
      toggle.focus();
    } else {
      document.body.focus?.();
    }
  }

  closeDrawer(panel, toggle);

  if (returnFocus && toggle) {
    toggle.focus();
  }
}

function closeUtilityPanel() {
  closeDrawer(utilityPanel, menuToggle);
}

function openPaytableModal() {
  if (!paytableModal || !changePaytableButton) return;
  if (!bettingOpen) return;
  pendingPaytableId = activePaytable.id;
  updateActivePaytableUI();
  paytableRadios.forEach((radio) => {
    radio.checked = radio.value === pendingPaytableId;
  });
  paytableModal.hidden = false;
  paytableModal.classList.add("is-open");
  paytableModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  const focusTarget =
    paytableForm?.querySelector('input[name="paytable"]:checked') ||
    paytableForm?.querySelector('input[name="paytable"]');
  focusTarget?.focus();
}

function closePaytableModal({ restoreFocus = false } = {}) {
  if (!paytableModal) return;
  paytableModal.classList.remove("is-open");
  paytableModal.setAttribute("aria-hidden", "true");
  paytableModal.hidden = true;
  document.body.classList.remove("modal-open");
  updateActivePaytableUI();
  if (restoreFocus && changePaytableButton) {
    changePaytableButton.focus();
  }
}

if (menuToggle && utilityPanel && utilityClose && panelScrim) {
  menuToggle.addEventListener("click", () => {
    const isOpen = utilityPanel.classList.contains("is-open");
    if (isOpen) {
      closeDrawer(utilityPanel, menuToggle);
    } else {
      openDrawer(utilityPanel, menuToggle);
    }
  });

  utilityClose.addEventListener("click", () => {
    closeDrawer(utilityPanel, menuToggle);
  });
}

if (graphToggle && chartPanel && chartClose) {
  graphToggle.addEventListener("click", () => {
    const isOpen = chartPanel.classList.contains("is-open");
    if (isOpen) {
      closeDrawer(chartPanel, graphToggle);
    } else {
      openDrawer(chartPanel, graphToggle);
    }
  });

  chartClose.addEventListener("click", () => {
    closeDrawer(chartPanel, graphToggle);
  });
}

if (authForm) {
  authForm.addEventListener("submit", handleAuthFormSubmit);
}

if (signupForm) {
  signupForm.addEventListener("submit", handleSignUpFormSubmit);
}

if (showSignUpButton) {
  showSignUpButton.addEventListener("click", async () => {
    if (signupForm) {
      signupForm.reset();
    }
    if (signupErrorEl) {
      signupErrorEl.hidden = true;
      signupErrorEl.textContent = "";
    }
    await setRoute("signup");
    signupFirstInput?.focus();
  });
}

if (showLoginButton) {
  showLoginButton.addEventListener("click", async () => {
    if (authErrorEl) {
      authErrorEl.hidden = true;
      authErrorEl.textContent = "";
    }
    await setRoute("auth");
    authEmailInput?.focus();
  });
}

routeButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const target = button.dataset.routeTarget;
    closeActiveDrawer();
    await setRoute(target);
  });
});

signOutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    closeActiveDrawer();
    await handleSignOut();
  });
});

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", handleHashChange);
}

if (panelScrim) {
  panelScrim.addEventListener("click", () => {
    closeActiveDrawer();
  });
}

if (changePaytableButton && paytableModal && paytableApplyButton && paytableCancelButton) {
  changePaytableButton.addEventListener("click", () => {
    if (changePaytableButton.disabled) return;
    openPaytableModal();
  });

  paytableApplyButton.addEventListener("click", () => {
    if (!paytableModal.hidden) {
      setActivePaytable(pendingPaytableId, { announce: true });
      closePaytableModal({ restoreFocus: true });
    }
  });

  paytableCancelButton.addEventListener("click", () => {
    pendingPaytableId = activePaytable.id;
    closePaytableModal({ restoreFocus: true });
  });

  if (paytableCloseButton) {
    paytableCloseButton.addEventListener("click", () => {
      pendingPaytableId = activePaytable.id;
      closePaytableModal({ restoreFocus: true });
    });
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (paytableModal && !paytableModal.hidden) {
      pendingPaytableId = activePaytable.id;
      closePaytableModal({ restoreFocus: true });
      event.preventDefault();
      return;
    }
    if (openDrawerPanel) {
      event.preventDefault();
      closeActiveDrawer({ returnFocus: true });
    }
  }
});

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    if (authEmailInput && currentUser.email) {
      authEmailInput.value = currentUser.email;
    }
    const route = getRouteFromHash();
    await setRoute(route, { replaceHash: true });
    waitForProfile(currentUser, {
      interval: 1000,
      maxAttempts: 10,
      notify: true
    }).then((profile) => {
      if (profile) {
        currentProfile = profile;
        if (currentRoute === "dashboard") {
          loadDashboard(true);
        }
      }
    });
  } else {
    currentProfile = null;
    dashboardLoaded = false;
    prizesLoaded = false;
    if (dashboardProfileRetryTimer) {
      clearTimeout(dashboardProfileRetryTimer);
      dashboardProfileRetryTimer = null;
    }
    if (dashboardRunsEl) {
      dashboardRunsEl.innerHTML = "";
    }
    if (dashboardCreditsEl) {
      dashboardCreditsEl.textContent = "0";
    }
    await setRoute("auth", { replaceHash: true });
  }
});

initTheme();
setActivePaytable(activePaytable.id, { announce: false });
updatePaytableAvailability();
setSelectedChip(selectedChip, false);
renderBets();
updateBankroll();
resetTable();
updateStatsUI();
resetBankrollHistory();
window.addEventListener("resize", drawBankrollChart);

async function initializeApp() {
  stripSupabaseRedirectHash();
  await bootstrapAuth();
  const initialRoute = getRouteFromHash();
  await setRoute(initialRoute, { replaceHash: true });
}

initializeApp();
