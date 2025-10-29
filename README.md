# Run the Numbers Simulator

A lightweight web-based simulator for the Run the Numbers casino game. Place number bets, watch the shoe reveal cards, and track payouts and long-term house edge in real time. A neon marquee just below the sticky header proudly displays “RUN THE NUMBERS,” setting the retro-futuristic tone before you scroll into the felt.

## Getting Started

1. Open `index.html` in any modern browser.
2. The compact header stays pinned to the top of the screen with your bankroll readout, a small reset button, and the hamburger menu. Watch the bankroll total flash green or red (and count up or down) after each hand to see the exact impact of the round.
3. Use the pinned chip rack bar along the bottom edge: the round chip buttons stay centered while the action cluster (**Rebet & Deal** or **Deal Hand**) hugs the right. Wide screens keep everything on a single line; smaller viewports automatically wrap so the chip selector remains on the top row and the buttons glide to the row beneath.
4. Click the Ace or any numbered spot (2–10) on the playmat to stack chips and place bets. Squares will wrap to a second row on smaller screens so nothing overlaps. Need to wipe the felt? Tap **Clear Bets** in the Bets header on the right side of the layout.
5. Press **Deal Hand** to play out a shoe until the first face card (J/Q/K) or the Joker appears.
6. Hits on your chosen Ace/number wager pay according to the four-step ladder (3×, 4×, 15×, 50×). Each chip remains in place and is forfeited when the hand stops.
7. After the hand resolves, choose **Table Ready** (bottom row, left) to clear the felt for fresh wagers or **Rebet & Deal** (bottom row, right cluster) to automatically restack and fire the previous layout. If your bankroll runs dry, use **Reset Account** near the bankroll display to refill to 1,000 units, wipe stats, and clear the history log.

Game stats now occupy the first section of the scrollable page (just below the sticky header) so the felt can stretch wider, a compact paytable appears above the betting grid, and the slide-out menu (hamburger icon in the header) holds the rules plus the recent hand log so the table can stretch across the screen. Cards dealt during a hand shrink slightly and wrap onto a second row when needed so long streaks remain easy to read on mobile.

The active bet summary lives just under the felt, keeping the bottom chip rack slim while still making it easy to review what’s on the layout before you deal. Beneath that, a neon-styled bankroll history chart plots your balance at the end of each hand so you can track momentum over time.

The simulator always uses a freshly shuffled 53-card deck for each hand with only J/Q/K and the Joker stopping play, matching the updated rules provided.
