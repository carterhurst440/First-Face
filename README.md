# Run the Numbers Simulator

Run the Numbers is a web-based simulator for the updated First Face ruleset. Stack chips on Ace or numbers 2–10, watch cards land on a neon felt, and track how each hand affects your bankroll over time.

## Getting Started

1. Open `index.html` in any modern browser.
2. The compact header stays pinned to the top of the screen with your bankroll readout, a slim reset button, and the hamburger menu. After each hand the bankroll flashes green or red and counts up or down so you can see the precise result.
3. Use the pinned chip rack along the bottom edge. Round chip buttons sit in the center while the action cluster (**Rebet & Deal** or **Deal Hand**) hugs the right edge. Wide screens keep everything on a single row; smaller viewports wrap automatically so the chip selector stays on top and the buttons slide underneath without overlapping.
4. Click the Ace or any numbered square (2–10) on the felt to stack chips. Squares wrap to a second row on small screens so nothing overlaps. To wipe the board, use **Clear Bets** in the Bets header on the top-right of the layout.
5. Press **Deal Hand** to reveal cards until the first stopper—any Jack, Queen, King, or the Joker. Hits on your wagers use the four-step ladder (3×, 4×, 15×, 50×). Each chip remains in place and is forfeited when the hand stops.
6. After the hand resolves, choose **Table Ready** (bottom row, left) to clear the felt for fresh wagers or **Rebet & Deal** (bottom row, right cluster) to automatically restack and deal the previous layout. If your bankroll runs dry, use **Reset Account** near the bankroll display to refill to 1,000 units, wipe stats, and clear the history log.

## Layout Overview

* A neon marquee reading **RUN THE NUMBERS** anchors the top of the scrollable page beneath the sticky header, setting the retro-futuristic tone.
* Game stats live in the first section of the page so the felt can stretch wider. The compact paytable sits just above the betting grid.
* Cards dealt during a hand scale down slightly and wrap onto a second row when needed, keeping long streaks readable on mobile.
* The active bets summary sits directly beneath the felt and spans the full width of the page, keeping the bottom chip rack slim.
* A neon-styled bankroll history chart plots the bankroll at the end of every hand with labeled axes. The canvas expands horizontally with a scrollbar whenever a long session extends beyond the initial width.

The simulator always uses a freshly shuffled 53-card deck for each hand with only J/Q/K and the Joker stopping play, matching the latest rule changes.
