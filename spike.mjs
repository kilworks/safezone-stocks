// Replay of the spike exit on the recorded tape (data/tape-*.jsonl): node spike.mjs
// A basket of the N highest-priced live stocks, entered on a calm price. A holding at `spike` x its calm price is sold
// `delay` ms later and bought back under `rebuy` x that calm price; a death (server move of -15% or more with no trade)
// sells at the price after the move. Fee 1.5% per side, own impact on a constant-product pool whose cash reserve is
// 10,000 Cx x sqrt(price / 10) (measured on the October tape: 11.0k under 15 Cx, 15.1k, 21.6k, 31.7k at 60 to 120 Cx),
// orders capped at `cap` of that reserve. Prints the final cash, everything sold.
import { loadTape } from './backtest.mjs';
const rows = loadTape(), T0 = rows[0].t, H = 3600e3, FEE = 0.015;
const by = {}; for (const r of rows) (by[r.e] ||= []).push(r);
const at = (a, t) => { let lo = 0, hi = a.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m].t <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans < 0 ? null : a[ans].pa; };
const reserve = (p) => Math.sqrt(1e9 * p);
const buyShares = (p, cash) => { const y = reserve(p), x = y / p; return x - (x * y) / (y + cash * (1 - FEE)); };
const sellCash = (p, sh) => { const y = reserve(p), x = y / p; return (y - (x * y) / (x + sh)) * (1 - FEE); };
const calmOf = (e, t) => Math.min(at(by[e], t - 120e3) ?? Infinity, at(by[e], t - 300e3) ?? Infinity);
function run({ startH = 1, endH = 79, N = 20, cash0 = 60000, spike = 1.5, delay = 5e3, rebuy = 1.2, cap = 0.015, from = T0 }) {
  const px = {}, last = {}, dead = {}, pos = {}, wait = {}, q = []; let cash = cash0, trades = 0, spikes = 0, started = false, next = 0;
  const sell = (e, p) => { const got = sellCash(p, pos[e]); cash += got; delete pos[e]; trades++; return got; };
  const buy = (e, p, amt) => { amt = Math.min(amt, cash, reserve(p) * cap); pos[e] = (pos[e] || 0) + buyShares(p, amt); cash -= amt; trades++; };
  const deploy = (t) => {
    const slots = N - Object.keys(pos).length - Object.keys(wait).length, free = cash - Object.values(wait).reduce((s, w) => s + w.cash, 0);
    const c = Object.keys(px).filter((e) => !dead[e] && t - last[e] < 30 * 60e3 && !pos[e] && !wait[e] && px[e] <= 1.3 * calmOf(e, t)).sort((a, b) => px[b] - px[a]).slice(0, Math.max(0, slots));
    if (free >= 500) for (const e of c) buy(e, px[e], free / c.length);
  };
  for (const r of rows) {
    if (r.t < from) { px[r.e] = r.pa; last[r.e] = r.t; continue; }
    while (q.length && q[0].t <= r.t) { const o = q.shift(); if (pos[o.e]) wait[o.e] = { calm: o.calm, cash: sell(o.e, px[o.e]), t: o.t }; }
    const prev = px[r.e];
    if (prev && r.pb / prev - 1 <= -0.15) { dead[r.e] = true; delete wait[r.e]; if (pos[r.e]) sell(r.e, r.pb); }
    else if (prev && dead[r.e] && r.pb / prev - 1 >= 0.15) dead[r.e] = false; // revived
    px[r.e] = r.pa; last[r.e] = r.t;
    if (pos[r.e] && !q.some((o) => o.e === r.e)) { const calm = calmOf(r.e, r.t); if (r.pa >= spike * calm) { q.push({ t: r.t + delay, e: r.e, calm }); spikes++; } }
    const w = wait[r.e];
    if (w && !dead[r.e] && (r.pa <= rebuy * w.calm || r.t - w.t > 30 * 60e3)) { if (r.pa <= 1.5 * w.calm) buy(r.e, r.pa, w.cash); delete wait[r.e]; }
    if (!started && r.t >= T0 + startH * H) { started = true; deploy(r.t); next = r.t + 5 * 60e3; }
    if (started && r.t >= next) {
      next = r.t + 5 * 60e3;
      for (const e of Object.keys(pos)) if (r.t - last[e] > 60 * 60e3) sell(e, px[e]); // stopped trading
      if (r.t >= T0 + endH * H) break;
      deploy(r.t);
    }
  }
  for (const e of Object.keys(pos)) sell(e, px[e]);
  return `${Math.round(cash / 100)} Cx, ${trades} trades, ${spikes} spikes`;
}
const show = (label, o) => console.log(label.padEnd(34), run(o));
console.log(`tape ${new Date(T0).toISOString()} to ${new Date(rows.at(-1).t).toISOString()}, ${rows.length} trades; 600 Cx at +1 h unless said`);
for (const N of [10, 20, 40]) { show(`N ${N}, no spike exit`, { N, spike: 99 }); for (const spike of [1.3, 1.5, 2, 3]) show(`N ${N}, spike ${spike}`, { N, spike }); }
for (const delay of [1e3, 5e3, 15e3, 30e3, 60e3]) show(`N 20, spike 1.5, delay ${delay / 1e3} s`, { delay });
for (let d = 0; d < 4; d++) show(`day ${d + 1} alone, fresh 600 Cx`, { startH: d * 24 + 1, endH: Math.min(79, (d + 1) * 24), from: T0 + d * 24 * H });
for (const cash0 of [30000, 100000, 500000]) show(`${cash0 / 100} Cx`, { cash0 });
