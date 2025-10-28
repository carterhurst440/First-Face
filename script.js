const STEP_PAYS = [4, 6, 14, 100];
const NUMBER_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const DENOMINATIONS = [1, 5, 10, 25, 100];
const SUITS = [
  { symbol: "♠", color: "black" },
  { symbol: "♥", color: "red" },
  { symbol: "♦", color: "red" },
  { symbol: "♣", color: "black" }
];

const bankrollEl = document.getElementById("bankroll");
const betsBody = document.getElementById("bets-body");
const dealButton = document.getElementById("deal-button");
const nextHandButton = document.getElementById("next-hand");
const clearBetsButton = document.getElementById("clear-bets");
const drawsContainer = document.getElementById("draws");
const statusEl = document.getElementById("status");
const chipSelectorEl = document.getElementById("chip-selector");
const chipButtons = Array.from(document.querySelectorAll(".chip-choice"));
const betSpotButtons = Array.from(document.querySelectorAll(".bet-spot"));
const betSpots = new Map(
  betSpotButtons.map((button) => [
    Number(button.dataset.rank),
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

let bankroll = 1000;
let bets = [];
let dealing = false;
let selectedChip = DENOMINATIONS[0];
let stats = {
  hands: 0,
  wagered: 0,
  paid: 0
};

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

  ["J", "Q", "K", "A"].forEach((face) => {
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
  bankrollEl.textContent = bankroll.toString();
}

function updateBetSpotTotals() {
  const totals = new Map(bets.map((bet) => [bet.rank, bet.units]));
  betSpots.forEach(({ totalEl, button }, rank) => {
    const total = totals.get(rank) ?? 0;
    totalEl.textContent = formatCurrency(total);
    button.classList.toggle("has-bet", total > 0);
    const ariaLabel =
      total > 0
        ? `Bet on number ${rank}. Total wager ${formatCurrency(total)} units.`
        : `Bet on number ${rank}. No chips placed.`;
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
  chipSelectorEl.classList.toggle("selector-disabled", !enabled);
  chipButtons.forEach((button) => {
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
  });
  betSpotButtons.forEach((button) => {
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
  });
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
    statusEl.textContent = `Selected ${formatCurrency(value)}-unit chip. Click a number to bet.`;
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
  dealButton.disabled = false;
  clearBetsButton.disabled = dealing;
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
  } else {
    bet = { rank, units, hits: 0, paid: 0 };
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

function resetTable() {
  drawsContainer.innerHTML = "";
  statusEl.textContent = "Select a chip and place your bets.";
  dealing = false;
  dealButton.hidden = false;
  dealButton.disabled = bets.length === 0;
  nextHandButton.hidden = true;
  setBettingEnabled(true);
}

function renderDraw(card) {
  const cardEl = makeCardElement(card);
  drawsContainer.appendChild(cardEl);
  drawsContainer.scrollTo({ left: drawsContainer.scrollWidth, behavior: "smooth" });
}

function endHand(stopperCard) {
  const totalWagerThisHand = bets.reduce((sum, bet) => sum + bet.units, 0);
  const totalPaidThisHand = bets.reduce((sum, bet) => sum + bet.paid, 0);

  stats.hands += 1;
  stats.wagered += totalWagerThisHand;
  stats.paid += totalPaidThisHand;
  updateStatsUI();

  statusEl.textContent = `Hand stopped on ${stopperCard.label}${
    stopperCard.label !== "Joker" ? " of " + stopperCard.suit : ""
  }. Wagers lost.`;

  addHistoryEntry({
    stopper: stopperCard,
    betSummaries: bets.map((bet) =>
      bet.hits > 0
        ? `${bet.units}u on ${bet.rank}: <span class="hit">${bet.hits} hits / ${formatCurrency(
            bet.paid
          )}</span>`
        : `${bet.units}u on ${bet.rank}: 0 hits`
    )
  });

  nextHandButton.hidden = false;
  dealButton.hidden = true;
  dealing = false;
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
    statusEl.textContent = `${rank} hits ${hitsRecorded} bet${
      hitsRecorded > 1 ? "s" : ""
    } for ${formatCurrency(totalHitPayout)} units.`;
  } else {
    statusEl.textContent = `${rank} keeps the action going.`;
  }
  return false;
}

async function dealHand() {
  if (bets.length === 0 || dealing) return;
  dealing = true;
  setBettingEnabled(false);
  dealButton.disabled = true;
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
  statusEl.textContent = `Placed ${formatCurrency(selectedChip)} unit${
    selectedChip !== 1 ? "s" : ""
  } on ${rank}. Total on ${rank}: ${totalForRank} unit${bet.units !== 1 ? "s" : ""}.`;
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
    const rank = Number(button.dataset.rank);
    if (!Number.isFinite(rank)) return;
    placeBet(rank);
  });
});

clearBetsButton.addEventListener("click", () => {
  if (dealing || bets.length === 0) return;
  const totalUnits = bets.reduce((sum, bet) => sum + bet.units, 0);
  restoreUnits(totalUnits);
  resetBets();
  statusEl.textContent = "Bets cleared.";
});

dealButton.addEventListener("click", () => {
  if (bets.length === 0 || dealing) return;
  dealHand();
});

nextHandButton.addEventListener("click", () => {
  resetBets();
  resetTable();
});

setSelectedChip(selectedChip, false);
renderBets();
resetTable();
updateStatsUI();
