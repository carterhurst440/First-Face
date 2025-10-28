# First-Face Casino Simulator

A lightweight web-based simulator for the First Face casino game. Place number bets, watch the shoe reveal cards, and track payouts and long-term house edge in real time.

## Getting Started

1. Open `index.html` in any modern browser.
2. Use the pinned chip rack along the bottom edge to pick a denomination, then click any numbered spot (2–10) on the playmat to stack chips and place bets.
3. Press **Deal Hand** to play out a shoe until the first face card (J/Q/K/A) or the Joker appears.
4. Hits on your chosen number pay according to the four-step ladder (4×, 6×, 14×, 100×). Each chip remains in place and is forfeited when the hand stops.
5. After the hand resolves, choose **Table Ready** to clear the felt for fresh wagers or **Rebet & Deal** to automatically restack and fire the previous layout. If your bankroll runs dry, use **Reset Account** near the bankroll display to refill to 1,000 units, wipe stats, and clear the history log.

Game stats now sit across the top header for maximum width in the betting area, and the controls stay accessible from the anchored chip rack regardless of scroll position.

The simulator always uses a freshly shuffled 53-card deck for each hand, matching the rules provided.
