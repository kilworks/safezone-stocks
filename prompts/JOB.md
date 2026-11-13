# Job: SafeZone Miami trading bot (Dagu, automatic)

Give this file to any session that touches the Miami trading job. Written 2026-11-13 on kil's order: "les trades
doivent etre automatises dans un job via Dagu, generer un PnL avec benefice, documente, une verbose dans le chat des
actions". Read `prompts/REWORK.md` for the strategy questions; this file is how the job runs.

## What runs

| Piece | Where | What it does |
|---|---|---|
| DAG `safezone-engine` | PC Dagu (http://127.0.0.1:8830, file `instabox-farm/dagu/safezone-engine.yaml`) | every 5 min runs `scripts/ensure-engine.ps1`: starts `node engine.mjs` when no real engine runs, stops a `--dry` one first (same `trades.jsonl` and `state.json`) |
| `engine.mjs` | PC, this folder | its own supervisor (restarts its child). Trades the `top` basket with spike exits (`params.json`), guards deaths and HP, claims the daily welfare, pushes the stream texts and the chat lines |
| Stream | Oracle `~/szdash/run.sh` (ffmpeg 1080p, 4 fps, about 10 % of a core) | draws the texts the engine pushes over ssh (`STREAM_SSH=oracle`) and sends them to cx247vods (`~/szdash/url`, 600) |
| Chat | Oracle `~/szdash/say.py` (repo `stream/say.py`) | posts each buy, sell (with its reason and net PnL) and welfare claim in the cx247vods chat, as the channel, with vodloop's kickapi and cx's token (`CHAT_SSH=oracle`) |

The scheduled task `SafezoneStocks` is disabled and stays so (enabling it needs admin): Dagu replaces it.

## Session (the one thing the job cannot do alone)

The engine trades with the `token` cookie of `api.iceposeidon.com` in its Playwright profile `profile/`. Without it
(`no_session` in `trades.jsonl`), it trades nothing, keeps the stream fed in dry public mode, opens the site in a
window on the PC and sends a Telegram message. kil logs in in that window (StormRock); within 5 s the engine logs
`session_ok`, exits, and its supervisor restarts it in trading mode. Never read, paste or store the cookie elsewhere.

## Welfare

`POST /public/cx-bucks/claim` (empty JSON) pays 300 Cx every 24 h; `GET /public/cx-bucks/rewards` gives `can_claim`
and `next_claim_at` (06:00 UTC). The engine checks every 10 min and claims as soon as it opens (`ev: welfare`). The
balance increase is booked as a deposit by `cash()`, so it never shows as trading profit.

## Times

Stream times are Miami time (`miami()` in `backtest.mjs`, America/New_York, DST by Intl), kil 13/11. Logs stay UTC.

## Profit: what is known, not promised

The `top` basket plus spike exit replayed October from 600 to 8,400-18,300 Cx (`spike.mjs`), positive each day. It
has never run live, and Miami's fee is 1 % per side (October 1.5 %). A profitable PnL is the goal, not a fact: report
it only from `trades.jsonl` (realized trips) and `me.realized_pnl_cents`, never from the replay.

## Checks

- `node check.mjs` prints `check ok` after any change.
- Engine alive: `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` with `engine.mjs` (no `--dry`), last
  `scan` line in `trades.jsonl` under a minute old.
- Trading: `stock-market/buy` lines with `"status":200`; chat: `ev: chat` lines with a message id in `out`.
- Stream: Oracle `ls -la ~/szdash/dash.txt` under a minute old, Kick `api/v2/channels/cx247vods` `is_live`.
- Dagu: `C:/Users/kil/dagu/data/dag-runs/safezone-engine/` last `status.jsonl` status 4 (success).

## Stop

Disable the DAG (rename the yaml `.off-<date>`), then stop the engine by PID (supervisor first). The
stream: kill `sh run.sh` then its ffmpeg by PID on Oracle; never overwrite `run.sh` while it runs.
