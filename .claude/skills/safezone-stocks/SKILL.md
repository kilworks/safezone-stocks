---
name: safezone-stocks
description: "Run the SafeZone (Ice Poseidon event, Miami edition from 2026-11-13) stock trading bot of kil's account StormRock and its dashboard stream on cx247vods: health in one call, the session (Brave login window), the aggressive settings, the Dagu job, the Oracle stream, what blocks profit and what never to redo. Use whenever kil mentions SafeZone, Safe Zone, the stock bot, Cx Bucks, trading, PnL, the dashboard or livestream on cx247vods, the login window, or says the bot does not buy or the stream shows no data."
---

# safezone-stocks

Repo `C:/Users/kil/Downloads/02 - Projects/safezone-stocks` (private). Run every command from there. Read this file,
then act: no rediscovery (kil, 13/11: "arrete de decouvrir a chaque prompt"). Deeper docs, only when needed:
`prompts/JOB.md` (how the job runs), `prompts/REWORK.md` (Miami unknowns U1-U7 and strategy order), `README.md`.
**Keep this file current**: any change to the job, settings, machines or rules is written here in the same session,
then copied to `claude-skills/projects/safezone-stocks/SKILL.md` (Finish).

## Health in one call (read only)

```sh
cd "/c/Users/kil/Downloads/02 - Projects/safezone-stocks" && date -u +%T && node -e "
const L=require('fs').readFileSync('trades.jsonl','utf8').trim().split('\n').map(JSON.parse);
const last=(re)=>L.filter(x=>re.test(x.ev)).at(-1);
for (const k of ['start','no_session','auth_lost','session_ok','scan','watchdog','err']) { const x=last(new RegExp('^'+k+'\$')); if (x) console.log(k.padEnd(11), x.t.slice(5,19), k==='start'?'dry='+x.dry:'', x.msg||x.fn||''); }
const o=L.filter(x=>/^stock-market\/(buy|sell)\$/.test(x.ev));
console.log('orders', o.length, 'ok', o.filter(x=>x.status===200).length, 'refused', o.filter(x=>x.status!==200).map(x=>x.status).join(',')||0);
const b=o.filter(x=>x.res?.balance_after_cents!=null).at(-1); if (b) console.log('balance', (b.res.balance_after_cents/100).toFixed(2), 'Cx at', b.t.slice(11,19));
for (const x of o.slice(-5)) console.log(' ', x.t.slice(11,19), x.ev.slice(13), x.name, x.why, x.status);
const me=require('./live.json').me||{}; console.log('realized', ((me.realized_pnl_cents||0)/100).toFixed(2), 'open', ((me.unrealized_pnl_cents||0)/100).toFixed(2), 'held', ((me.portfolio_value_cents||0)/100).toFixed(2));
const eq=require('fs').readFileSync('data/equity.jsonl','utf8').trim().split('\n').at(-1); console.log('equity', eq);
console.log('blocked', L.filter(x=>x.ev==='blocked').length);"
```
- `start dry=false` and orders `ok` = trading. `no_session` after the last `start` = waiting for kil's login.
- `scan` older than a minute or a `watchdog` line = the engine is stuck; Dagu restarts it within 5 min.
- Stream fed: `ssh oracle 'ls -la --time-style=+%T ~/szdash/dash.txt'` (under a minute old).

## Facts (measured 13/11, do not re-measure)

- Market open since at least 13/11 19:42 UTC, about 189 stocks, public API readable without login
  (`api.iceposeidon.com/public/stock-market/stocks`). Starting balance 300.00 Cx (`START_CASH=30000` in `.env`).
- Miami fee 1 % per side (JOB.md). Welfare 300 Cx every 24 h, claimed by the engine (booked as a deposit).
- First real order 13/11 20:54:16 UTC (ChickenAndy, top #1). 5/5 orders accepted in the first minute.
- October (Austin) state is archived in `oct-austin/` (gitignored). The tapes `data/tape-*.jsonl` stay in `data/`.

## Session (the only step the bot cannot do alone)

- Kick's login refuses Playwright's bundled Chromium (kil 13/11: "je peux pas utiliser chrome for dev sur kick").
  So `.env` `BROWSER_BIN` = `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` and the session
  lives in `profile-brave/` (gitignored), read headless by the same Brave binary.
- No `token` cookie: the engine runs dry (stream still fed), opens a **plain Brave window** on
  `https://iceposeidon.com/safezone/stock-market` with `profile-brave`, shows a Windows popup and a Telegram message.
  kil logs in (Login with Kick, StormRock, waits for the balance) and closes the window; the engine restarts in
  trading mode (`login_window_closed`, then `start dry=false`).
- Give kil the link AND say it must open in that bot window. Reopen it for him:
  `"/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe" --user-data-dir="C:\Users\kil\Downloads\02 - Projects\safezone-stocks\profile-brave" --new-window https://iceposeidon.com/safezone/stock-market`
- When kil says "connecte": close the bot window yourself. `CloseMainWindow` is not enough (Brave stays in the
  background): stop every `brave.exe` whose command line holds `profile-brave`, by PID. Never touch kil's own Brave.
- Never: cookie export through the clipboard (`Get-Clipboard` fails in the `!` bash prompt, kil has no
  EditThisCookie), Claude in Chrome / brave-devtools / chrome-devtools for this login, reading cookies of kil's
  own browser profile, anti-bot camouflage (the stream itself says "automated").

## Settings (params.json, hot-reloaded within 30 s, `params_reload` in the log)

Aggressive, kil 13/11 ("je veux vraiment un modele aggressif"): `maxImpact` 0.03 (order up to 3 % of the pool
reserve), `spike` 1.3, `spikeRebuy` 1.2, `topN` 20, `topExit` 40, `topForce` true, `topKeep` 1.
Why, replay of 600 Cx on 188,415 trades (`spike.mjs` grid): before 18,325 Cx; chosen 23,794 Cx with every day
better (4,875 / 3,107 / 2,494 / 851). Bigger is worse: maxImpact 0.05 22,398, 0.1 11,160 (own impact). N 40 gives
26,292 but a weaker first day. Almost all of that tape is October: re-run the grid on Miami tape after 24 h.
Change a setting = edit `params.json` (write then rename), never restart the engine for it.

What these settings mean for the money (Fable review 13/11, read before changing anything):
- A `top` position leaves only on spike, hourly rank (`topReb` 1 h) or death. The HP exit is blind while the HP
  feed is empty (open point below): a death shows after the -20 % drop.
- `topForce` true bypasses the kill switch (`trialOn('top')`): a losing basket never stops by itself.
- In dry mode (no session) `trade()` only logs: no spike sell, no death exit until kil logs in again.
- **1 h gate** (first one 13/11 21:54 UTC, then daily): last `data/equity.jsonl` `value` >= 30000 cents and no
  `blocked` line = keep. Value under 28500 (-5 %) = tell kil the number and propose `topForce` false + `topKeep` 0.3
  (his call: he asked for aggressive).

## Limits that are not negotiable

- Never more than 2 orders in 2 s (3rd order in 1.6 s = 429 per account; about 6 req/s = IP blocked). kil asked
  "2 per second" on 13/11: refused with that number. The engine's queue (2.5 req/s) is the only API path.
- Profit is reported only from `trades.jsonl` (realized round trips) and `me.realized_pnl_cents`, never from replay.

## What runs where

| Where | What |
|---|---|
| PC Dagu `safezone-engine` (every 5 min) | `scripts/ensure-engine.ps1`: starts `node engine.mjs` if no real engine, stops a `--dry` one first |
| PC `engine.mjs` | its own supervisor; trades, guards deaths and HP, welfare, pushes stream texts (`STREAM_SSH=oracle`) and chat lines (`CHAT_SSH=oracle`) |
| Oracle `~/szdash` | `run.sh` ffmpeg draws the texts and pushes to cx247vods (`url`, 600, cx key of `~/v2/cx247vods/channel.env`); `say.py` posts orders in cx chat |
| Box Simular | cx's VOD pusher, asleep (wallet empty, 13/11). If it is topped up, its pusher takes the cx key back: stop its cx units first (skill cx247vods) |

kil 13/11: the dashboard stays on Oracle ("on stream deja sur cx247vods, c'est ok, reste dessus"). The engine has a
`STREAM_SSH=wsl` mode (ffmpeg in WSL on the PC), unused. Oracle steal measured 66-71 % with the stream on (13/11
21:10): say it to kil with the number if nanatty247 drops, never move the stream without his word.

DAG file: `C:/Users/kil/Downloads/02 - Projects/instabox-farm/dagu/safezone-engine.yaml` (checked 13/11). Stop the
whole job: `prompts/JOB.md` section Stop (DAG off first, then engine by PID, supervisor first).
While no session, Dagu replaces the dry engine every 5 min and a new login window opens each time: kil has about
5 min per window.

## Stream and chat texts (kil 13/11)

- Never "play money" or "automated" on the stream, in its title or in chat (`check.mjs` fails on it). Kick title:
  "SafeZone stock bot | live trading dashboard | Miami" (set with vodloop `kickapi.set_title`, CHAN_ROOT cx247vods, on Oracle).
- Header clock `ck.txt`: Miami time, US then European format, pushed by the engine every 2 s.
- Every scan without an order posts a "decision: hold" line in cx chat with the reason (mandatory, kil). The
  usual reason once the basket is bought: the next order would be under the 10 Cx minimum (cash spent).
- Changing `stream/run.sh` = upload as `run.sh.new`, `sh -n`, backup, kill `sh run.sh` then its ffmpeg by PID, `mv`,
  `setsid nohup sh run.sh`. The Kick session survives a cut of a few seconds (13/11 21:10, same `created_at`).

## Known open points

- REWORK.md section 2 forbids automatic claims; the engine claims the 300 Cx welfare daily (JOB.md, kil's order of
  13/11 for an automated job). REWORK.md is not amended yet: ask kil once, then amend it.
- `retune` writes `params.json` in place (no rename): a reload at that instant could read a half file.

- ALIVE tile at 0: roster 186 read, HP feed empty (`health` 0). Miami's health frame differs; not fixed yet.
- `END_AT=2026-11-21T00:00:00Z` is a guess: set the announced end when known.
- U1 (what the viewer leaderboard ranks) is still unknown: REWORK.md section 4.

## Finish (every session that touched the bot)

1. `node check.mjs` = `check ok`. Commit by file name, push.
2. Update this file, then copy it to `C:/Users/kil/Downloads/02 - Projects/claude-skills/projects/safezone-stocks/SKILL.md` and commit that repo.
3. Memory `safezone-stocks` only for a new fact that is not here.
