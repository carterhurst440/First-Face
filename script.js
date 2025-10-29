const STEP_PAYS = [3, 4, 15, 50];
const NUMBER_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const DENOMINATIONS = [1, 5, 10, 25, 100];
const INITIAL_BANKROLL = 1000;
const MIN_SIMULATIONS = 800;
const MAX_SIMULATIONS = 4000;
const SIMULATIONS_PER_UNIT = 20;
const SUITS = [
  { symbol: "♠", color: "black" },
  { symbol: "♥", color: "red" },
  { symbol: "♦", color: "red" },
  { symbol: "♣", color: "black" }
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
const tableReadyButton = document.getElementById("table-ready");
const rebetButton = document.getElementById("rebet-button");
const clearBetsButton = document.getElementById("clear-bets");
const drawsContainer = document.getElementById("draws");
const statusEl = document.getElementById("status");
const chipSelectorEl = document.getElementById("chip-selector");
const chipButtons = Array.from(document.querySelectorAll(".chip-choice"));
const betSpotButtons = Array.from(document.querySelectorAll(".bet-spot"));
const betSpots = new Map(
  betSpotButtons.map((button) => [
    button.dataset.rank,
    {
      button,
      totalEl: button.querySelector(".bet-total"),
      stackEl: button.querySelector(".chip-stack")
    }
  ])
);
const handsPlayedEl = document.getElementById("hands-played");
const totalWageredEl = document.getElementById("total-wagered");
const totalPaidEl = document.getElementById("total-paid");
const holdEl = document.getElementById("hold");
const houseEdgeEl = document.getElementById("house-edge");
const successRateEl = document.getElementById("success-rate");
const successRateNoteEl = document.getElementById("success-rate-note");
const betaValueEl = document.getElementById("beta-value");
const betaMeterEl = document.getElementById("beta-meter");
const betaMeterFillEl = document.getElementById("beta-meter-fill");
const betaLevelEl = document.getElementById("beta-level");
const historyList = document.getElementById("history-list");
const cardTemplate = document.getElementById("card-template");
const resetAccountButton = document.getElementById("reset-account");
const menuToggle = document.getElementById("menu-toggle");
const utilityPanel = document.getElementById("utility-panel");
const utilityClose = document.getElementById("utility-close");
const panelScrim = document.getElementById("panel-scrim");

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
let bankrollAnimating = false;
let bankrollAnimationFrame = null;
let bankrollDeltaTimeout = null;
let riskUpdateScheduled = false;

function createDeck() {
  const deck = [];
  NUMBER_RANKS.forEach((rank) => {
    SUITS.forEach((suit) => {
      deck.push({
        rank,
        label: String(rank),
        suit: suit.symbol,
        color: suit.color,
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
        stopper: true
      });
    });
  });

  deck.push({
    rank: "Joker",
    label: "Joker",
    suit: "★",
    color: "black",
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

function updateBetSpotTotals() {
  const totals = new Map(bets.map((bet) => [bet.rank, bet.units]));
  betSpots.forEach(({ totalEl, button }, rank) => {
    const total = totals.get(rank) ?? 0;
    totalEl.textContent = formatCurrency(total);
    button.classList.toggle("has-bet", total > 0);
    const spokenRank = describeRank(rank);
    const ariaLabel =
      total > 0
        ? `Bet on ${spokenRank}. Total wager ${formatCurrency(total)} units.`
        : `Bet on ${spokenRank}. No chips placed.`;
    button.setAttribute("aria-label", ariaLabel);
  });
}

function addChipToSpot(rank, value) {
  const spot = betSpots.get(rank);
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

function setBettingEnabled(enabled) {
  bettingOpen = enabled;
  chipSelectorEl.classList.toggle("selector-disabled", !enabled);
  chipButtons.forEach((button) => {
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
  });
  betSpotButtons.forEach((button) => {
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
  });
  clearBetsButton.disabled = !enabled || bets.length === 0;
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
    statusEl.textContent = `Selected ${formatCurrency(value)}-unit chip. Click Ace or a number to bet.`;
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
    clearBetsButton.disabled = true;
    updateBetSpotTotals();
    scheduleRiskUpdate();
    return;
  }

  bets.forEach((bet) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${bet.rank}</td>
      <td>${bet.units}</td>
      <td>${bet.hits}</td>
      <td>${formatCurrency(bet.paid)}</td>
    `;
    betsBody.appendChild(row);
  });
  dealButton.disabled = dealing || !bettingOpen;
  clearBetsButton.disabled = !bettingOpen;
  updateBetSpotTotals();
  scheduleRiskUpdate();
}

function resetBets() {
  bets = [];
  renderBets();
  clearChipStacks();
}

function addBet(rank, units) {
  let bet = bets.find((b) => b.rank === rank);
  if (bet) {
    bet.units += units;
    bet.chips.push(units);
  } else {
    bet = { rank, units, hits: 0, paid: 0, chips: [units] };
    bets.push(bet);
  }
  bankroll -= units;
  updateBankroll();
  renderBets();
  addChipToSpot(rank, units);
  return bet;
}

function restoreUnits(units) {
  bankroll += units;
  updateBankroll();
}

function resetBetCounters() {
  bets.forEach((bet) => {
    bet.hits = 0;
    bet.paid = 0;
  });
  renderBets();
}

function makeCardElement(card) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const rankEl = node.querySelector(".card-rank");
  const suitEl = node.querySelector(".card-suit");
  const corners = node.querySelectorAll(".corner");

  rankEl.textContent = card.label;
  suitEl.textContent = card.suit;
  node.dataset.rank = card.label;

  const colorClass = card.color === "red" ? "card-red" : "card-black";
  node.classList.add(colorClass);

  corners.forEach((corner) => {
    corner.textContent = `${card.label}\n${card.suit}`;
  });

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

function scheduleRiskUpdate() {
  if (dealing) {
    return;
  }
  if (riskUpdateScheduled) {
    return;
  }
  riskUpdateScheduled = true;
  const runUpdate = () => {
    riskUpdateScheduled = false;
    updateRiskMetrics();
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(runUpdate, { timeout: 500 });
  } else {
    window.setTimeout(runUpdate, 120);
  }
}

function simulateNetOutcome(layout) {
  if (layout.length === 0) {
    return 0;
  }
  const deck = createDeck();
  shuffle(deck);
  const state = layout.map((bet) => ({ rank: bet.rank, weight: bet.weight, hits: 0 }));
  let totalPaid = 0;
  for (const card of deck) {
    if (card.stopper) {
      break;
    }
    for (const bet of state) {
      if (bet.rank === card.rank && bet.hits < STEP_PAYS.length) {
        totalPaid += STEP_PAYS[bet.hits] * bet.weight;
        bet.hits += 1;
      }
    }
  }
  return totalPaid - 1;
}

function describeBetaLevel(beta) {
  if (beta <= 0) {
    return { label: "No bets", className: "" };
  }
  if (beta < 0.45) {
    return { label: "Low risk", className: "" };
  }
  if (beta < 0.85) {
    return { label: "Moderate", className: "beta-moderate" };
  }
  if (beta < 1.3) {
    return { label: "Elevated", className: "beta-elevated" };
  }
  return { label: "High risk", className: "beta-high" };
}

function updateRiskMetrics() {
  if (
    !successRateEl ||
    !betaValueEl ||
    !betaMeterFillEl ||
    !betaMeterEl ||
    !betaLevelEl
  ) {
    return;
  }

  const layout = bets.map((bet) => ({ rank: bet.rank, units: bet.units }));
  const totalWager = layout.reduce((sum, bet) => sum + bet.units, 0);

  if (totalWager === 0) {
    successRateEl.textContent = "—";
    if (successRateNoteEl) {
      successRateNoteEl.textContent = "Place chips to analyze risk";
    }
    betaValueEl.textContent = "—";
    betaLevelEl.textContent = "No bets placed";
    betaMeterFillEl.style.width = "0%";
    betaMeterFillEl.className = "beta-meter-fill";
    betaMeterEl.setAttribute("aria-label", "Beta gauge: no bets placed");
    return;
  }

  const normalizedLayout = layout.map((bet) => ({
    rank: bet.rank,
    weight: bet.units / totalWager
  }));

  const iterations = Math.min(
    MAX_SIMULATIONS,
    Math.max(MIN_SIMULATIONS, totalWager * SIMULATIONS_PER_UNIT)
  );
  let successCount = 0;
  let netSum = 0;
  let netSumSq = 0;

  for (let i = 0; i < iterations; i += 1) {
    const net = simulateNetOutcome(normalizedLayout);
    if (net > 0) {
      successCount += 1;
    }
    netSum += net;
    netSumSq += net * net;
  }

  const successRate = (successCount / iterations) * 100;
  const mean = netSum / iterations;
  const variance = Math.max(netSumSq / iterations - mean * mean, 0);
  const stdDev = Math.sqrt(variance);
  const beta = stdDev;
  const cappedBeta = Math.min(beta, 1.8);
  const fillPercent = Math.max(0, Math.min(100, (cappedBeta / 1.8) * 100));
  const { label: betaLabel, className } = describeBetaLevel(beta);

  successRateEl.textContent = `${successRate.toFixed(1)}%`;
  if (successRateNoteEl) {
    successRateNoteEl.textContent = "Chance current layout finishes ahead";
  }
  betaValueEl.textContent = beta.toFixed(2);
  betaLevelEl.textContent = betaLabel;
  betaMeterFillEl.style.width = `${fillPercent.toFixed(1)}%`;
  betaMeterFillEl.className = "beta-meter-fill";
  if (className) {
    betaMeterFillEl.classList.add(className);
  }
  const spokenLabel = `${betaLabel} (β ${beta.toFixed(2)})`;
  betaMeterEl.setAttribute("aria-label", `Beta gauge: ${spokenLabel}`);
}

function formatStopper({ label, suit }) {
  return label === "Joker" ? "Joker" : `${label}${suit}`;
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
  layout.forEach(({ rank, chips = [] }) => {
    chips.forEach((value) => addBet(rank, value));
  });
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

function resetTable(message = "Select a chip and place your bets.") {
  drawsContainer.innerHTML = "";
  statusEl.textContent = message;
  dealing = false;
  dealButton.hidden = false;
  tableReadyButton.hidden = true;
  tableReadyButton.disabled = true;
  const hasLayout = lastBetLayout.length > 0;
  rebetButton.hidden = !hasLayout;
  rebetButton.disabled = !hasLayout;
  setBettingEnabled(true);
  dealButton.disabled = bets.length === 0;
}

function renderDraw(card) {
  const cardEl = makeCardElement(card);
  drawsContainer.appendChild(cardEl);
  cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
}

function endHand(stopperCard) {
  const totalWagerThisHand = bets.reduce((sum, bet) => sum + bet.units, 0);
  const totalPaidThisHand = bets.reduce((sum, bet) => sum + bet.paid, 0);
  const netThisHand = totalPaidThisHand - totalWagerThisHand;

  stats.hands += 1;
  stats.wagered += totalWagerThisHand;
  stats.paid += totalPaidThisHand;
  updateStatsUI();

  statusEl.textContent = `Hand stopped on ${stopperCard.label}${
    stopperCard.label !== "Joker" ? " of " + stopperCard.suit : ""
  }. Wagers lost.`;

  addHistoryEntry({
    stopper: stopperCard,
    betSummaries: bets.map((bet) => {
      const spokenRank = describeRank(bet.rank);
      return bet.hits > 0
        ? `${bet.units}u on ${spokenRank}: <span class="hit">${bet.hits} hits / ${formatCurrency(
            bet.paid
          )}</span>`
        : `${bet.units}u on ${spokenRank}: 0 hits`;
    })
  });

  lastBetLayout = bets
    .filter((bet) => bet.units > 0)
    .map((bet) => ({ rank: bet.rank, chips: [...bet.chips] }));
  const hasLayout = lastBetLayout.length > 0;
  tableReadyButton.hidden = false;
  tableReadyButton.disabled = false;
  rebetButton.hidden = !hasLayout;
  rebetButton.disabled = !hasLayout;
  dealButton.hidden = true;
  dealButton.disabled = true;
  setBettingEnabled(false);
  dealing = false;
  animateBankrollOutcome(netThisHand);
  updateRiskMetrics();
}

function processCard(card) {
  renderDraw(card);

  if (card.stopper) {
    endHand(card);
    return true;
  }

  const rank = card.rank;
  let totalHitPayout = 0;
  let hitsRecorded = 0;
  bets.forEach((bet) => {
    if (bet.rank === rank && bet.hits < STEP_PAYS.length) {
      const pay = STEP_PAYS[bet.hits] * bet.units;
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
  dealing = true;
  setBettingEnabled(false);
  dealButton.disabled = true;
  tableReadyButton.hidden = true;
  tableReadyButton.disabled = true;
  rebetButton.hidden = true;
  resetBetCounters();
  drawsContainer.innerHTML = "";
  statusEl.textContent = "Dealing...";

  const deck = createDeck();
  shuffle(deck);

  for (const card of deck) {
    const shouldStop = processCard(card);
    if (shouldStop) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
}

function placeBet(rank) {
  if (dealing) return;
  if (selectedChip > bankroll) {
    statusEl.textContent = `Insufficient bankroll for a ${formatCurrency(
      selectedChip
    )}-unit chip. Try a smaller denomination.`;
    return;
  }

  const bet = addBet(rank, selectedChip);
  const totalForRank = formatCurrency(bet.units);
  const spokenRank = describeRank(rank);
  statusEl.textContent = `Placed ${formatCurrency(selectedChip)} unit${
    selectedChip !== 1 ? "s" : ""
  } on ${spokenRank}. Total on ${spokenRank}: ${totalForRank} unit${
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
    const rank = button.dataset.rank;
    if (!rank) return;
    placeBet(rank);
  });
});

clearBetsButton.addEventListener("click", () => {
  if (dealing || !bettingOpen || bets.length === 0) return;
  const totalUnits = bets.reduce((sum, bet) => sum + bet.units, 0);
  restoreUnits(totalUnits);
  resetBets();
  statusEl.textContent = "Bets cleared.";
});

dealButton.addEventListener("click", () => {
  if (bets.length === 0 || dealing) return;
  dealHand();
});

tableReadyButton.addEventListener("click", () => {
  bets = [];
  clearChipStacks();
  renderBets();
  resetTable();
});

rebetButton.addEventListener("click", () => {
  if (dealing || lastBetLayout.length === 0) return;
  const totalNeeded = layoutTotalUnits(lastBetLayout);
  if (totalNeeded === 0) {
    statusEl.textContent = "No prior wagers to rebet.";
    return;
  }
  if (totalNeeded > bankroll) {
    statusEl.textContent = `Not enough bankroll to rebet ${formatCurrency(
      totalNeeded
    )} units. Reset your account or place smaller bets.`;
    return;
  }
  rebetButton.disabled = true;
  applyBetLayout(lastBetLayout);
  resetTable("Rebetting previous wagers...");
  rebetButton.hidden = true;
  rebetButton.disabled = true;
  dealHand();
});

resetAccountButton.addEventListener("click", () => {
  if (dealing) return;
  bankroll = INITIAL_BANKROLL;
  updateBankroll();
  stats = { hands: 0, wagered: 0, paid: 0 };
  updateStatsUI();
  lastBetLayout = [];
  historyList.innerHTML = "";
  bets = [];
  clearChipStacks();
  renderBets();
  resetTable("Account reset. Select a chip and place your bets.");
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

setSelectedChip(selectedChip, false);
renderBets();
updateBankroll();
resetTable();
updateStatsUI();
updateRiskMetrics();
