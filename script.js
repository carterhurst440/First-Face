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
let advancedCollapseTimeout = null;
let activePaytable = PAYTABLES[0];

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

  ctx.fillStyle = "rgba(6, 8, 26, 0.92)";
  ctx.fillRect(0, 0, width, height);

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, "rgba(255, 99, 224, 0.18)");
  backgroundGradient.addColorStop(1, "rgba(31, 241, 255, 0.16)");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(139, 109, 255, 0.22)";
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
    fillGradient.addColorStop(0, "rgba(255, 99, 224, 0.26)");
    fillGradient.addColorStop(1, "rgba(31, 241, 255, 0)");
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
    ctx.fillStyle = "#1ff1ff";
    ctx.shadowColor = "rgba(31, 241, 255, 0.6)";
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
    ctx.strokeStyle = "#8b6dff";
    ctx.lineWidth = 2.8;
    ctx.shadowColor = "rgba(139, 109, 255, 0.45)";
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (points.length > 0) {
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.fillStyle = "#ff63e0";
    ctx.strokeStyle = "rgba(248, 249, 255, 0.85)";
    ctx.lineWidth = 2.2;
    ctx.arc(lastPoint.x, lastPoint.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(31, 241, 255, 0.35)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(padding.left, baseY);
  ctx.lineTo(width - padding.right, baseY);
  ctx.stroke();

  ctx.font = "600 12px 'Play', 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(248, 249, 255, 0.85)";
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

  if (advancedCollapseTimeout !== null) {
    window.clearTimeout(advancedCollapseTimeout);
    advancedCollapseTimeout = null;
  }

  if (advancedBetsSection) {
    if (enabled) {
      const openSection = () => {
        if (advancedBetsSection) {
          advancedBetsSection.classList.add("is-open");
        }
      };
      advancedBetsSection.hidden = false;
      advancedBetsSection.setAttribute("aria-hidden", "false");
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(openSection);
      } else {
        openSection();
      }
    } else {
      advancedBetsSection.classList.remove("is-open");
      advancedBetsSection.setAttribute("aria-hidden", "true");
      advancedCollapseTimeout = window.setTimeout(() => {
        if (!advancedMode && advancedBetsSection) {
          advancedBetsSection.hidden = true;
        }
        advancedCollapseTimeout = null;
      }, 320);
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
  message = "Select a chip and place your bet on the regions above.",
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
    if (!bettingOpen) {
      radio.checked = activePaytable.id === radio.value;
      return;
    }
    setActivePaytable(radio.value, { announce: true });
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
  resetTable("Account reset. Select a chip and place your bet on the regions above.", {
    clearDraws: true
  });
  resetBankrollHistory();
  closeUtilityPanel();
});

function openUtilityPanel() {
  if (!utilityPanel || !menuToggle || !panelScrim) return;
  utilityPanel.classList.add("is-open");
  utilityPanel.setAttribute("aria-hidden", "false");
  menuToggle.setAttribute("aria-expanded", "true");
  panelScrim.hidden = false;
}

function closeUtilityPanel() {
  if (!utilityPanel || !menuToggle || !panelScrim) return;
  utilityPanel.classList.remove("is-open");
  utilityPanel.setAttribute("aria-hidden", "true");
  menuToggle.setAttribute("aria-expanded", "false");
  panelScrim.hidden = true;
}

if (menuToggle && utilityPanel && utilityClose && panelScrim) {
  menuToggle.addEventListener("click", () => {
    const isOpen = utilityPanel.classList.contains("is-open");
    if (isOpen) {
      closeUtilityPanel();
    } else {
      openUtilityPanel();
    }
  });

  utilityClose.addEventListener("click", () => {
    closeUtilityPanel();
  });

  panelScrim.addEventListener("click", () => {
    closeUtilityPanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && utilityPanel.classList.contains("is-open")) {
      closeUtilityPanel();
      menuToggle.focus();
    }
  });
}

setActivePaytable(activePaytable.id, { announce: false });
updatePaytableAvailability();
setSelectedChip(selectedChip, false);
renderBets();
updateBankroll();
resetTable();
updateStatsUI();
resetBankrollHistory();
window.addEventListener("resize", drawBankrollChart);
