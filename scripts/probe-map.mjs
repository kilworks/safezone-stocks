// One read of the public map snapshot (Miami format: frames are JSON strings {t, d}); prints shapes, never positions.
import { chromium } from 'playwright';
process.loadEnvFile('.env');
const b = await chromium.launch(), ctx = await b.newContext();
const r = await ctx.request.get(`https://event-public.${process.env.SITE_HOST}/event/map-snapshot`);
const F = Object.fromEntries((await r.json()).frames.map((f) => JSON.parse(f)).map((o) => [o.t, o.d]));
const st = F.status || [];
console.log('status n', st.length, 'alive', st.filter((x) => x.alive).length, 'status values', [...new Set(st.map((x) => x.status))].join(','), 'effects', [...new Set(st.flatMap((x) => x.effects.map((e) => typeof e === 'string' ? e : JSON.stringify(e))))].slice(0, 8).join(' | '));
console.log('slot keys', Object.keys(F.slots?.[0] || {}).join(','));
const c = F.contestants?.contestants || [];
console.log('contestants', c.length, 'keys', Object.keys(c[0] || {}).join(','), 'eliminated', c.filter((x) => x.eliminated_at).length);
console.log('roster?', Object.keys(F.contestants || {}).join(','));
const g = (F.game_items || []).filter((x) => x.kind === 'gravestone');
console.log('graves', g.length, g[0] ? JSON.stringify(Object.keys(g[0])) + ' grave:' + JSON.stringify(g[0].grave ? Object.keys(g[0].grave) : null) : '');
await b.close();
