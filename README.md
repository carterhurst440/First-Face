# Run the Numbers Simulator

Run the Numbers is a web-based simulator for the updated First Face ruleset. Stack chips on Ace or numbers 2–10, watch cards land on a neon felt, and track how each hand affects your bankroll over time.

## Getting Started

1. Open `index.html` in any modern browser.
2. The compact header stays pinned to the top of the screen with your bankroll readout, a slim reset button, and the hamburger menu. After each hand the bankroll flashes green or red and counts up or down so you can see the precise result.
3. Use the **Select Your Paytable** panel above the felt to choose one of three payout ladders. Paytable 1 (3×/4×/15×/50×) is active by default, while Paytable 2 (2×/6×/36×/100×) and Paytable 3 (1×/10×/40×/200×) are a radio tap away. The active ladder readout updates instantly and locks during each hand.
4. Click the Ace or any numbered square (2–10) on the felt to stack chips. Squares wrap to a second row on small screens so nothing overlaps. The **Clear Bets** button now lives in the Number Bets header, keeping the pinned footer slim.
5. Use the pinned chip rack along the bottom edge to pick a chip denomination. Round chip buttons stay centered while the action cluster (**Rebet & Deal** or **Deal Hand**) hugs the right edge. Wide screens keep everything on one line; smaller viewports wrap automatically so the chip selector stays on top and the buttons slide underneath without crowding.
6. Flip the **Advanced Mode** toggle beneath the dealing area to reveal two wager families under the cards. **Bust Card** bets cover suits (♥/♣/♠/♦) for 3:1, individual face ranks (Jack/Queen/King) for 2:1, or the Joker for 11:1—each pays *to* 1, so a win returns your stake plus the listed profit and can be placed at any time. **Card Count** bets must be locked in before dealing and now include the bust card itself when totaling the draw; they pay 3:1 up to 10:1 when the exact number of cards dealt matches your pick (with 8+ covering any longer run). When Advanced Mode is active, a Pause/Play control appears during the deal so you can freeze the action, stack more bust bets, and resume play without missing a draw.
7. Press **Deal Hand** to reveal cards until the first stopper—any Jack, Queen, King, or the Joker. Hits on your wagers use the four-step ladder from the paytable you selected before the hand. Each chip remains in place and is forfeited when the hand stops.
8. After the hand resolves, choose **Table Ready** (bottom row, left) to clear the felt for fresh wagers or **Rebet & Deal** (bottom row, right cluster) to automatically restack and deal the previous layout. If your bankroll runs dry, use **Reset Account** near the bankroll display to refill to 1,000 units, wipe stats, and clear the history log.

## Layout Overview

* A neon marquee reading **RUN THE NUMBERS** anchors the top of the scrollable page beneath the sticky header, setting the retro-futuristic tone.
* Game stats live in the first section of the page so the felt can stretch wider. A dedicated paytable selector anchors the top of the felt, with the active ladder readout glowing beside the radio-style options.
* The Advanced Mode toggle and pause control sit below the dealing lane so the Number Bets header stays focused on chips and clearing the felt while the expanded wager grids appear only when needed.
* Cards dealt during a hand scale down slightly and wrap onto a second row when needed, keeping long streaks readable on mobile.
* The active bets summary sits directly beneath the felt and spans the full width of the page, keeping the bottom chip rack slim.
* A neon-styled bankroll history chart plots the bankroll at the end of every hand with labeled axes. The canvas continually rescales to fit new data while trimming x-axis labels whenever space gets tight, so you can review long sessions without horizontal scrolling.

The simulator always uses a freshly shuffled 53-card deck for each hand with only J/Q/K and the Joker stopping play, matching the latest rule changes.
