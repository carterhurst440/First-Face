const STEP_PAYS = [3, 4, 15, 50];
const NUMBER_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const DENOMINATIONS = [5, 10, 25, 100];
const INITIAL_BANKROLL = 1000;
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
const historyList = document.getElementById("history-list");
const cardTemplate = document.getElementById("card-template");
const resetAccountButton = document.getElementById("reset-account");
const menuToggle = document.getElementById("menu-toggle");
const utilityPanel = document.getElementById("utility-panel");
const utilityClose = document.getElementById("utility-close");
const panelScrim = document.getElementById("panel-scrim");
const bankrollChartCanvas = document.getElementById("bankroll-chart");
const bankrollChartCtx =
  bankrollChartCanvas instanceof HTMLCanvasElement
    ? bankrollChartCanvas.getContext("2d")
    : null;

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
let bankrollHistory = [];

const MAX_HISTORY_POINTS = 60;

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

function drawBankrollChart() {
  if (!bankrollChartCanvas || !bankrollChartCtx) return;
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
  const padding = 28;
  const values = bankrollHistory.length ? bankrollHistory : [bankroll];
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  ctx.fillStyle = "rgba(5, 21, 18, 0.9)";
  ctx.fillRect(0, 0, width, height);

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
  backgroundGradient.addColorStop(0, "rgba(0, 255, 214, 0.18)");
  backgroundGradient.addColorStop(1, "rgba(0, 146, 255, 0.12)");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  ctx.strokeStyle = "rgba(0, 255, 214, 0.2)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? padding + chartWidth / 2
        : padding + (chartWidth * index) / (values.length - 1);
    const y = padding + chartHeight * (1 - (value - minVal) / range);
    return { x, y };
  });

  if (points.length >= 2) {
    const fillGradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    fillGradient.addColorStop(0, "rgba(0, 245, 255, 0.32)");
    fillGradient.addColorStop(1, "rgba(0, 245, 255, 0)");
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, height - padding);
    ctx.lineTo(points[0].x, height - padding);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();
  }

  ctx.beginPath();
  if (points.length === 1) {
    const point = points[0];
    ctx.fillStyle = "#00f5ff";
    ctx.shadowColor = "rgba(0, 255, 255, 0.6)";
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
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 2.6;
    ctx.shadowColor = "rgba(0, 255, 255, 0.5)";
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (points.length > 0) {
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.fillStyle = "#ff4dff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.arc(lastPoint.x, lastPoint.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(0, 200, 255, 0.4)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.font = "600 12px 'Play', 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(125, 255, 240, 0.9)";
  ctx.textBaseline = "bottom";
  ctx.fillText(`Hands: ${Math.max(0, values.length - 1)}`, padding, height - padding - 8);
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

function resetTable(message = "Select a chip and place your bet on the regions above.") {
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
  recordBankrollHistoryPoint();
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
  resetTable("Account reset. Select a chip and place your bet on the regions above.");
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

setSelectedChip(selectedChip, false);
renderBets();
updateBankroll();
resetTable();
updateStatsUI();
resetBankrollHistory();
window.addEventListener("resize", drawBankrollChart);
