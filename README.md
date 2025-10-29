# First-Face Casino Simulator

A lightweight web-based simulator for the First Face casino game. Place number bets, watch the shoe reveal cards, and track payouts and long-term house edge in real time.

## Getting Started

1. Open `index.html` in any modern browser.
2. The header remains pinned to the top of the screen with your bankroll, reset control, and the hamburger menu. Watch the bankroll total flash green or red (and count up or down) after each hand to see the exact impact of the round.
3. Use the pinned chip rack bar along the bottom edge to pick a denomination (center chips), clear wagers (left button), or fire **Rebet & Deal** / **Deal Hand** controls on the right.
4. Click the Ace or any numbered spot (2–10) on the playmat to stack chips and place bets. Squares will wrap to a second row on smaller screens so nothing overlaps.
5. Press **Deal Hand** to play out a shoe until the first face card (J/Q/K) or the Joker appears.
6. Hits on your chosen Ace/number wager pay according to the four-step ladder (3×, 4×, 15×, 50×). Each chip remains in place and is forfeited when the hand stops.
7. After the hand resolves, choose **Table Ready** to clear the felt for fresh wagers or **Rebet & Deal** to automatically restack and fire the previous layout. If your bankroll runs dry, use **Reset Account** near the bankroll display to refill to 1,000 units, wipe stats, and clear the history log.

Game stats now sit across the top header for maximum width in the betting area, a compact paytable appears above the felt, and the slide-out menu (hamburger icon in the header) holds the rules plus the recent hand log so the table can stretch across the screen. Cards dealt during a hand shrink slightly and wrap onto a second row when needed so long streaks remain easy to read on mobile.

The active bet summary lives just under the felt, keeping the bottom chip rack slim while still making it easy to review what’s on the layout before you deal.

The simulator always uses a freshly shuffled 53-card deck for each hand with only J/Q/K and the Joker stopping play, matching the updated rules provided.
