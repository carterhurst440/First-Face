const STEP_PAYS = [4, 6, 14, 100];
const NUMBER_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const SUITS = [
  { symbol: "♠", color: "black" },
  { symbol: "♥", color: "red" },
  { symbol: "♦", color: "red" },
  { symbol: "♣", color: "black" }
];

const bankrollEl = document.getElementById("bankroll");
const betForm = document.getElementById("bet-form");
const rankSelect = document.getElementById("rank-select");
const unitInput = document.getElementById("unit-input");
const betsBody = document.getElementById("bets-body");
const dealButton = document.getElementById("deal-button");
const nextHandButton = document.getElementById("next-hand");
const clearBetsButton = document.getElementById("clear-bets");
const drawsContainer = document.getElementById("draws");
const statusEl = document.getElementById("status");
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
}

function resetBets() {
  bets = [];
  renderBets();
}

function addBet(rank, units) {
  const existing = bets.find((b) => b.rank === rank);
  if (existing) {
    existing.units += units;
  } else {
    bets.push({ rank, units, hits: 0, paid: 0 });
  }
  bankroll -= units;
  updateBankroll();
  renderBets();
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
  statusEl.textContent = "Place your bets and deal.";
  dealing = false;
  dealButton.hidden = false;
  dealButton.disabled = bets.length === 0;
  nextHandButton.hidden = true;
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

betForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (dealing) return;

  const rank = Number(rankSelect.value);
  const units = Number(unitInput.value);
  if (Number.isNaN(units) || units <= 0) return;
  if (units > bankroll) {
    statusEl.textContent = "Insufficient bankroll for that wager.";
    return;
  }

  addBet(rank, units);
  statusEl.textContent = `Bet ${units} unit${units > 1 ? "s" : ""} on ${rank}.`;
  unitInput.value = "1";
});

clearBetsButton.addEventListener("click", () => {
  if (dealing || bets.length === 0) return;
  const totalUnits = bets.reduce((sum, bet) => sum + bet.units, 0);
  restoreUnits(totalUnits);
  resetBets();
  statusEl.textContent = "Bets cleared.";
});

dealButton.addEventListener("click", () => {
  if (bets.length === 0) return;
  dealHand();
});

nextHandButton.addEventListener("click", () => {
  resetBets();
  resetTable();
});

renderBets();
resetTable();
updateStatsUI();
