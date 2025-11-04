# Run the Numbers Simulator

Run the Numbers is a web-based simulator for the updated First Face ruleset. Stack chips on Ace or numbers 2–10, watch cards land on a neon felt, and track how each hand affects your bankroll over time.

## Getting Started

1. Open `index.html` in any modern browser.
2. Sign in with the email/password form to create or reuse a Supabase account. The first attempt tries to log you in; if the credentials are new the app creates the user, asks you to confirm the Supabase email, and waits for you to come back and sign in again. Once you authenticate successfully the hash router sends you straight into the shell, and any screens that rely on the `profiles` row show “Setting up your account…” until the Supabase trigger finishes provisioning it.
3. Once authenticated you land on the new home screen—a neon “RUN THE NUMBERS” marquee with pulsing **Play Game** and **View Store** buttons. Pick **Play Game** to slide into the simulator, or tap **View Store** for the coming-soon prize shop teaser with a back arrow to return home. The hamburger menu continues to expose the Supabase-backed dashboard, prize shop, and sign-out options at any time.
4. The compact header stays pinned to the top of every in-app page with your bankroll readout, reset button, theme selector, chart toggle, and a home icon for one-tap navigation back to the marquee. Flip the theme dropdown to instantly restyle the table with **Blue**, **Pink**, or **Orange** palettes. After each hand the bankroll flashes green or red, counts up or down to the new total, and any panel drawers can be opened or closed without leaving the table.
5. The left panel shows the active paytable above the dealing lane. Tap **Change Paytable** to open a modal with three ladders: Paytable 1 (3×/4×/15×/50×) is active by default, Paytable 2 offers 2×/6×/36×/100×, and Paytable 3 pays 1×/10×/40×/200×. Pick one and apply it before dealing; the selection locks automatically once a hand begins.
6. Cards are dealt directly beneath the active paytable on a single felt panel. Each draw glides into place and longer hands wrap neatly across two rows so streaks stay readable on phones.
7. The right panel is a scrollable betting board. Click the Ace or any numbered square (2–10) to stack chips; spots tighten into multiple rows on narrow screens so nothing overlaps. The footer keeps the centered chip selector above compact **Clear**, **Rebet**, and **Deal Hand** buttons so mobile view only uses two rows of controls.
8. Flip the **Advanced Mode** toggle at the bottom of the betting panel to reveal the additional wager families. **Bust Card** bets cover suits (♥/♣/♠/♦) for 3:1, individual face ranks (Jack/Queen/King) for 2:1, or the Joker for 11:1—each pays *to* 1 so a win returns your stake plus the listed profit and can be stacked at any time. **Card Count** bets must be locked in before dealing, include the bust card itself, and pay 3:1 up to 10:1 when the total number of cards dealt matches your pick (with 8+ covering any longer run). When Advanced Mode is active, a Pause/Play control appears during the deal so you can freeze the action, place bust bets, and resume without missing a draw.
9. Press **Deal Hand** to reveal cards until the first stopper—any Jack, Queen, King, or the Joker. Hits on your wagers use the four-step ladder from the paytable you selected before the hand. Each chip remains in place and is forfeited when the hand stops.
10. After the hand resolves, the table clears automatically—number bets are collected, and advanced bust and card-count wagers disappear whether they won or lost. Tap **Rebet** to restack the layout you used at the start of the previous hand (the paytable stays put), then adjust chips before pressing **Deal Hand**. If your bankroll runs dry, use **Reset Account** near the bankroll display to refill to 1,000 units, wipe stats, and clear the history log. The header graph icon opens a drawer that combines the bankroll chart with cumulative session stats whenever you want a deeper view. The menu also links to the dashboard, prize shop, and sign-out control.

## Layout Overview

* The main view is split into two responsive panels: the left felt for the active paytable and dealing lane, and the right column for wagering. Each panel holds half of the available play space and scrolls independently—side by side on desktops and stacked top-to-bottom on mobile so both stay visible at once.
* Game stats live inside the bankroll drawer that opens from the header icon, keeping the table surface clear while still offering quick access to hands played, wagered, paid, hold, and house edge.
* The Advanced Mode toggle and pause control sit at the bottom of the betting panel so number bets stay visible while the expanded wager grids slide into view only when needed.
* Cards dealt during a hand scale down slightly and wrap onto a second row when needed, keeping long streaks readable on mobile.
* The active bets summary now lives inside the betting panel and spans its full width, sitting just above the bankroll history chart.
* A neon-styled bankroll history chart pops out from the header graph icon, sitting above the live stats. The canvas continually rescales to fit new data, trimming x-axis labels whenever space gets tight so you can review long sessions without horizontal scrolling.

The simulator always uses a freshly shuffled 53-card deck for each hand with only J/Q/K and the Joker stopping play, matching the latest rule changes.

## Supabase connectivity

The simulator talks directly to your Supabase project from the browser using the anon key and row-level security.

* `supabaseClient.js` loads the browser-friendly `@supabase/supabase-js` build from the CDN and instantiates a client with the project URL and anon key that ship in the repo. Swap those values for your own project before deploying.
* Authentication uses email + password. The app first calls `supabase.auth.signInWithPassword`; if that fails it falls back to `supabase.auth.signUp`. After account creation you confirm the Supabase email, then sign in again—the login handler detects unconfirmed emails, displays guidance, and only redirects to the shell once the credentials succeed. Background profile polling continues until the trigger-created row arrives.
* Routing is handled client-side with hash fragments. The dashboard and prize shop check `supabase.auth.getUser()` before loading. If the user is missing, the login view is shown.
* The dashboard queries the current profile and the 10 most recent `game_runs` for the signed-in user. The prize shop lists active prizes sorted by cost and lets players redeem them by calling the `purchase_prize` RPC. Errors such as “Not enough credits” surface as inline toasts.
* Every completed hand calls the exported `logGameRun(score, metadata?)` helper. It looks up the current user, inserts a row into `game_runs`, and bubbles an error toast if the player is not logged in.
* Use the combined bankroll/analytics drawer or the new header navigation to move between the play table, dashboard, and prize shop. The sign-out option clears cached state and returns you to the login form.
