# Rework prompt: the SafeZone 2 (Miami) stock engine

Give this file whole to the session that reworks `engine.mjs`. It states the goal, what is known and how well, the
unknowns that decide the strategy, the order of work and what counts as done. Written 2026-11-13, the day the Miami
edition is announced to start.

## 1. Why a rework

October (Austin) was a 7-day run for play money: the goal was PnL, unattended. Miami changes the goal. kil reports
that the new rules give a viewer prize of $5,000 (reported wording of the organizer: the top 3 viewers who "spend
their Cx Bucks the best"). The objective is no longer "more Cx" but "finish in the top 3 of the viewer leaderboard".
Nobody on our side knows how that leaderboard is computed. The whole plan below is ordered to close that gap before
the engine risks a single Cx on it.

## 2. Binding rules (not negotiable, inherited from October)

- One account, kil's. kil logs in himself (`node engine.mjs --login`); no cookie or token pasted in chat or stored
  outside the Playwright profile. The October session expired on 2026-11-06.
- Every API call goes through the engine's queue (2.5 req/s, back-off on 403, retry on 429). Never a script that
  loops on the API outside that queue. One order per scan. Never more than 2 orders in 2 s.
- Map feed: the health and roster frame only. Positions are never decoded, stored or derived.
- The engine automates stock orders and nothing else. No chat posting for rewards, no claim clicking, no gambling, no
  attack purchases by script, unless kil writes the authorization in this file.
- Every October number is a hypothesis for Miami until re-measured on Miami tape. Tag every fact in `FACTS.md`:
  MEASURED (Miami tape), OCT (October measurement), STATED (wiki or site text, quoted), GUESS.
- No contestant or streamer names in code, docs, commits or screenshots. No em or en dash. `git add` by file name.
- `node check.mjs` prints `check ok` after every change; each new check has a control case that must fail.
- Nothing is "working" without the `trades.jsonl` lines that show it.

## 3. What we know, and how well

Sources: the public wiki read on 2026-11-13, the site JS bundle captured on 2026-11-11 (`safezone-research`
corpus), the October tape (`data/tape-2026-10-*.jsonl`, 7 days) and the October README.

STATED (wiki, 2026-11-13)
- $50,000 contestant prize, any Kick streamer can join, week-long event in Miami.
- The wiki says nothing about the stock market, Cx Bucks income, a viewer leaderboard or a viewer prize. The $5,000
  figure is not on the wiki; it comes from kil and from paraphrased organizer posts (safezone-research U-0000).
- New since October: "A viewer who kills the crown holder receives a Cx-Bucks bonus worth a share of the attack's
  purchase price." So viewer spending can pay back in Cx.

STATED (site JS, zod enum of Cx Bucks ledger reasons, 2026-11-11)
`initial_grant, stock_buy_debit, stock_sell_credit, stock_settlement, stock_account_open, chat_reward,
kicks_reward, trivia_reward, event_prediction_bet, event_prediction_payout, event_prediction_refund,
event_crown_reward, event_viewer_payback, cx_bucks_store_purchase, cx_bucks_store_refund, gambling_win,
gambling_loss, website_claim, admin_grant, admin_debit, admin_set, reversal`. Ledger rows carry `balance_after`,
`stock_market_trade_id`, `stock_market_settlement_id`. Pages behind login: `/safezone/stock-market`,
`/safezone/leaderboards`, `/safezone/shop`, `/safezone/gambling/{mines,plinko,slots}`.

OCT (measured in Austin, to re-measure)
- One stock per contestant, opens at 10.00 Cx, constant-product pool with about 10,000 Cx of reserve R: a buy of c
  moves the price by about 2c/R. Fee 1.5% per side, so a round trip costs 3% plus twice the impact.
- A death knocks the stock about 20% down, applied by the server 30 s to 2 min after the death. The health feed shows
  the death first: that lag is the one edge a human trader cannot match.
- An eliminated stock settles 4 h after elimination (`settles_at` in the stocks route) and vanishes from the public
  API. The settlement amount was never observed (`data/settled.jsonl` has prices before settlement only).
- Revives exist since 18/10: the roster clears `eliminated_at`, the stock trades again, the contestant can die again.
- Rate limits: about 6 req/s gets the IP blocked (403 Blocked); a 3rd order within 2 s gets 429 per account.
- Behaviour: the market drifts down (-1.4% to -5% per 30 min held) because fees drain it and the money in dead stocks
  disappears (it does not flow to survivors). Pumps of 10x in seconds, back in 30 s. Chasing a pump loses even 2 s
  after it (-4% to -17%). Copying the most profitable wallets loses 10% (they are the pumpers). Momentum pays only in
  the opening rush (breadth over 0.6). Adding to winners loses.
- What paid: the top basket (highest-priced live contestants, entered on their calm price, +404 on 866 in one
  evening, both halves positive), crash rebound (-25% between two scans with no pump in the 3 min before, held 10 to
  20 min), survivors after a death in the endgame (+4.6% median 30 min after each of 44 deaths; stocks alive 24 h
  earlier +16% on average). HP rule: sell under 85% HP, buy from 90% (1,129 samples, 15 min horizon).
- Account: about 607 Cx at the start, 865 after 5 h, deposits counted apart (`state.deposits`), engine ended
  2026-10-24 20:20 UTC. The scheduled task `SafezoneStocks` is now Disabled.

## 4. The unknowns that decide the strategy (close them in this order)

U1 What the viewer leaderboard ranks. Three candidates, each with a different engine:
   A. net worth (cash + marked portfolio): the October engine with a rank-aware layer;
   B. points earned by spending Cx on viewer actions (attacks, heals, store): the market is only the money printer,
      the score is made by what is bought and when, and the engine's job is cash on time, not PnL;
   C. realized trading profit or a market-only ranking: the October engine, with settlement handling.
   Until U1 is STATED from the leaderboard page, no mode other than GROW (section 6) is allowed.
U2 Scoring horizon: continuous, daily, or a snapshot at a cutoff time. A cutoff changes the last 24 h entirely.
U3 Settlement value of an eliminated stock (zero, last price, pre-death price, pool share) and what happens to the
   winner's stock at the end. Decides whether holding through a death is a loss or a free option.
U4 Passive income: starting grant, `kicks_reward` per minute watched, `chat_reward`, trivia, predictions. It is the
   baseline every viewer gets; the market is where ranks separate. Measure it from our own ledger.
U5 Pool reserve and fee in Miami. Recompute R from the first 200 public trades (dp/p against c) and the fee from a
   quote. The October 1.5% and 10,000 Cx are GUESS until then.
U6 Contestant count and death rate (Austin: 186 at the start, 67 on day 2, 19 on day 3, 11 on day 4). Sets how
   often the death edges fire and how thin the market gets.
U7 Whether our rank and the 3rd place score are readable (the `me` route or the leaderboard). Without it, there is
   no rank-aware mode, only GROW plus an endgame plan.

## 5. Order of work

Phase 0, day 0, kil, 20 minutes, before any order.
Logged in, kil opens `/safezone/leaderboards`, `/safezone/stock-market` and `/safezone/shop` and reports in chat:
the exact label of what the viewer leaderboard ranks, any prize text, the starting balance, the fee shown on a
quote, whether a portfolio value appears next to the cash, whether the leaderboard shows his own rank. The session
writes the answers into `FACTS.md` as STATED with the page and time. No screenshot with other users' names enters
the repository.

Phase 1, recorder before trader, day 0 to day 1.
Start the engine with trading off (`--dry`) from the first minute, so the tape exists before any decision: public
trades, stocks list with `settles_at`, roster, deaths, revives, HP, and new: `data/ledger.jsonl` from the Cx Bucks
transactions route of our own account (reason, amount, `balance_after`, settlement id). The ledger is how settlement
values (U3) and passive income (U4) become MEASURED instead of guessed. Then measure and write to `FACTS.md`:
R and fee (U5), death drop size and lag between health feed and price (the S4 edge), first three settlement
amounts against last price and pre-death price (U3), Cx per hour of passive income (U4), contestant count (U6).
The October tapes stay in `data/` as regression input for `backtest.mjs`.

Phase 2, the objective.
Write `score()` as exactly what the leaderboard ranks (U1). Three modes, chosen from rank distance and time left:
- GROW (default, and the only mode until U1 and U7 are known): positive-expectancy strategies, sized by the pool
  reserve, kill switches, self-tuning on the last 24 h, as in October.
- DEFEND (in the top 3 with a margin): cut variance. Cash or the most liquid positions, tighter HP exit, no new
  position within 2 h of the cutoff if U2 is a snapshot.
- SWING (outside the top 3, gap not closable at the measured GROW rate before the end): concentrate on the best
  measured edge (S4, S3, S6), accept drawdown, log the decision with the gap and the rate that justified it.
The mode switch is a pure function of (score, 3rd place score, time left, measured GROW rate per hour) with a test.

Phase 3, strategies to re-test on Miami tape with the existing `backtest.mjs`. Same discipline as October: a setting
is adopted only with 8+ trades, profit in both halves of the window and a clear margin; a losing strategy with no
winning setting is switched off. Order of value, highest first:
- S4 death front-run: sell the instant the health feed or roster shows a death, before the server's drop. Measure
  the lag again on the first 10 deaths; report deaths seen versus sells landed before the drop as the metric.
- S1 top basket with calm-price entry (October's best earner; expect it to work in the evening rushes only).
- S3 survivors after a death (endgame), S2 crash rebound.
- S5 settlement arbitrage: only after U3 is MEASURED on 3+ settlements. If settlement pays more than the post-death
  price, dead stocks are the cheapest asset in the game; if it pays zero, never hold a stock through its death.
- S6 endgame, last 24 h: hold the likely survivors; if the score is cash at a cutoff, exit before the crowd does
  (the pool is thin, the last seller gets nothing); if the score is marked value at a cutoff, hold.
If U1 is A and U2 is a snapshot, model this consequence of the constant-product pool in the backtest: a last buy of
c in a stock we hold for V raises our marked value by about V times 2c/R; with V near R the marked gain is about
twice the Cx spent. Report the number to kil and let kil decide whether to use it. It is ordinary in-game trading
(the market is full of pumps), but it is kil's call about the spirit of the prize, not the engine's.
If U1 is B, stop here and write a new plan: the engine's output becomes "cash available at the times viewer actions
score best", and the spending itself stays manual unless kil authorizes it in section 2.

Phase 4, run.
kil re-enables the scheduled task, `END_AT` set to the announced end, trading on. Telegram daily report: score, rank
if readable, PnL per strategy, S4 metric, deposits apart from gains, API 403 and 429 counts.

## 6. What counts as done

- `FACTS.md` lists U1 to U7, each with a status (MEASURED, STATED, OCT, GUESS, open), its source and the number.
- `node check.mjs` prints `check ok`, with new checks for the ledger parser, `score()`, the mode switch, the S4 lag
  measure and the settlement arbitrage gate, each seen failing once on a control case.
- On 24 h of Miami tape, every strategy left on is positive in both halves after fees and own impact; the numbers
  are in the README with the window and the trade count.
- A 1 h dry run on Miami whose log shows scans, map reads, ledger rows, no 403 and no 429 storm.
- The README's "What was measured" section is rewritten with Miami numbers; October numbers are kept under an
  "October (Austin)" heading, not mixed in.

## 7. Files

`engine.mjs` (505 lines: queue, map reader, guard, scan, record, retune), `backtest.mjs` (replay and tuners),
`check.mjs`, `params.json` (hot-reloaded), `state.json`, `trades.jsonl` (event log), `data/` (tapes, deaths,
revives, hp, settled), `import-cookies.mjs`, `status.mjs`, `dashboard.mjs` and `dashboard.html`, `stream/`.
