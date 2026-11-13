// One read of stock-market/me with the engine's profile (engine must be stopped: the profile is single-user).
import { chromium } from 'playwright';
import fs from 'node:fs';
if (fs.existsSync('.env')) process.loadEnvFile('.env');
const HOST = process.env.SITE_HOST;
const ctx = await chromium.launchPersistentContext('./profile', { headless: true });
const tok = (await ctx.cookies(`https://api.${HOST}`)).find((c) => c.name === 'token');
console.log('token', tok ? `expires ${new Date(tok.expires * 1000).toISOString()}` : 'absent');
const r = await ctx.request.get(`https://api.${HOST}/public/stock-market/me`, { headers: { origin: `https://${HOST}`, referer: `https://${HOST}/` } });
const j = await r.json().catch(() => null);
console.log('status', r.status(), 'market', JSON.stringify(j?.market ?? null).slice(0, 600), 'cash', j?.cash_cents, 'keys', Object.keys(j || {}).join(','));
await ctx.close();
