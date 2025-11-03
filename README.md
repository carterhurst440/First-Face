# Run the Numbers Simulator

Run the Numbers is a web-based simulator for the updated First Face ruleset. Stack chips on Ace or numbers 2–10, watch cards land on a neon felt, and track how each hand affects your bankroll over time.

## Getting Started

1. Open `index.html` in any modern browser.
2. The compact header stays pinned to the top of the screen with your bankroll readout, a combined chart icon, a slim reset button, and the hamburger menu. After each hand the bankroll flashes green or red, counts up or down to the new total, and any panel drawers can be opened or closed without leaving the table.
3. The left panel shows the active paytable above the dealing lane. Tap **Change Paytable** to open a modal with three ladders: Paytable 1 (3×/4×/15×/50×) is active by default, Paytable 2 offers 2×/6×/36×/100×, and Paytable 3 pays 1×/10×/40×/200×. Pick one and apply it before dealing; the selection locks automatically once a hand begins.
4. Cards are dealt directly beneath the active paytable on a single felt panel. Each draw glides into place and longer hands wrap neatly across two rows so streaks stay readable on phones.
5. The right panel is a scrollable betting board. Click the Ace or any numbered square (2–10) to stack chips; spots tighten into multiple rows on narrow screens so nothing overlaps. The footer keeps the centered chip selector above compact **Clear**, **Rebet**, and **Deal Hand** buttons so mobile view only uses two rows of controls.
6. Flip the **Advanced Mode** toggle at the bottom of the betting panel to reveal the additional wager families. **Bust Card** bets cover suits (♥/♣/♠/♦) for 3:1, individual face ranks (Jack/Queen/King) for 2:1, or the Joker for 11:1—each pays *to* 1 so a win returns your stake plus the listed profit and can be stacked at any time. **Card Count** bets must be locked in before dealing, include the bust card itself, and pay 3:1 up to 10:1 when the total number of cards dealt matches your pick (with 8+ covering any longer run). When Advanced Mode is active, a Pause/Play control appears during the deal so you can freeze the action, place bust bets, and resume without missing a draw.
7. Press **Deal Hand** to reveal cards until the first stopper—any Jack, Queen, King, or the Joker. Hits on your wagers use the four-step ladder from the paytable you selected before the hand. Each chip remains in place and is forfeited when the hand stops.
8. After the hand resolves, the table clears automatically—number bets are collected, and advanced bust and card-count wagers disappear whether they won or lost. Tap **Rebet** to restack the layout you used at the start of the previous hand (the paytable stays put), then adjust chips before pressing **Deal Hand**. If your bankroll runs dry, use **Reset Account** near the bankroll display to refill to 1,000 units, wipe stats, and clear the history log. The header graph icon opens a drawer that combines the bankroll chart with cumulative session stats whenever you want a deeper view.

## Layout Overview

* The main view is split into two responsive panels: the left felt for the active paytable and dealing lane, and the right column for wagering. Each panel holds half of the available play space and scrolls independently—side by side on desktops and stacked top-to-bottom on mobile so both stay visible at once.
* Game stats live inside the bankroll drawer that opens from the header icon, keeping the table surface clear while still offering quick access to hands played, wagered, paid, hold, and house edge.
* The Advanced Mode toggle and pause control sit at the bottom of the betting panel so number bets stay visible while the expanded wager grids slide into view only when needed.
* Cards dealt during a hand scale down slightly and wrap onto a second row when needed, keeping long streaks readable on mobile.
* The active bets summary now lives inside the betting panel and spans its full width, sitting just above the bankroll history chart.
* A neon-styled bankroll history chart pops out from the header graph icon, sitting above the live stats. The canvas continually rescales to fit new data, trimming x-axis labels whenever space gets tight so you can review long sessions without horizontal scrolling.

The simulator always uses a freshly shuffled 53-card deck for each hand with only J/Q/K and the Joker stopping play, matching the latest rule changes.
