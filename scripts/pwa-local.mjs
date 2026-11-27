/**
 * Run the built PWA locally with working push alarms, no accounts needed.
 *
 *   npm run pwa:local      (builds dist/ first, then serves http://localhost:4173)
 *
 * - Serves dist/ with SPA fallback
 * - Runs the Vercel functions in api/*.mjs
 * - Fakes Upstash Redis in memory and generates throwaway VAPID keys
 * - Calls /api/dispatch every 20 seconds, like the production cron
 * Localhost counts as a secure origin, so service workers and Web Push work here.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import * as webpushNs from 'web-push';
const webpush = webpushNs.default ?? webpushNs;

const PORT = Number(process.env.PORT || 4173);
const ROOT = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// ---- in-memory Upstash (only the commands the API uses)
const kv = new Map(); // string keys
const sets = new Map(); // key -> Set
const zsets = new Map(); // key -> Map(member -> score)
function run([cmd, ...a]) {
  switch (cmd.toUpperCase()) {
    case 'GET': return kv.get(a[0]) ?? null;
    case 'SET': kv.set(a[0], a[1]); return 'OK';
    case 'DEL': return a.reduce((n, k) => n + (kv.delete(k) | sets.delete(k) | zsets.delete(k)), 0);
    case 'EXPIRE': return 1;
    case 'SADD': { const s = sets.get(a[0]) ?? new Set(); a.slice(1).forEach((m) => s.add(m)); sets.set(a[0], s); return a.length - 1; }
    case 'SREM': { const s = sets.get(a[0]); let n = 0; a.slice(1).forEach((m) => (n += s?.delete(m) ? 1 : 0)); return n; }
    case 'SMEMBERS': return [...(sets.get(a[0]) ?? [])];
    case 'ZADD': { const z = zsets.get(a[0]) ?? new Map(); for (let i = 1; i < a.length; i += 2) z.set(a[i + 1], Number(a[i])); zsets.set(a[0], z); return (a.length - 1) / 2; }
    case 'ZREM': { const z = zsets.get(a[0]); let n = 0; a.slice(1).forEach((m) => (n += z?.delete(m) ? 1 : 0)); return n; }
    case 'ZRANGEBYSCORE': { const z = zsets.get(a[0]) ?? new Map(); const lo = Number(a[1]), hi = Number(a[2]); return [...z].filter(([, s]) => s >= lo && s <= hi).sort((x, y) => x[1] - y[1]).map(([m]) => m); }
    default: throw new Error(`mock redis: ${cmd} not supported`);
  }
}

const keys = webpush.generateVAPIDKeys();
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: 'https://github.com/aryanpol73/leetcode-reminder',
  UPSTASH_REDIS_REST_URL: `http://localhost:${PORT}/__redis`,
  UPSTASH_REDIS_REST_TOKEN: 'local',
  CRON_SECRET: 'local-secret',
});

const handlers = {};
for (const name of ['leetcode', 'push', 'dispatch', 'snooze']) {
  handlers[name] = (await import(`../api/${name}.mjs`)).default;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

function vercelRes(res) {
  res.status = (c) => ((res.statusCode = c), res);
  res.send = (b) => res.end(b);
  res.json = (o) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(o)));
  return res;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();

  if (url.pathname === '/__redis/pipeline') {
    try {
      const out = JSON.parse(raw).map((c) => ({ result: run(c) }));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(out));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify([{ error: String(e.message) }]));
    }
  }

  const api = url.pathname.match(/^\/api\/(\w+)$/);
  if (api && handlers[api[1]]) {
    req.query = Object.fromEntries(url.searchParams);
    req.body = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : undefined;
    try {
      return await handlers[api[1]](req, vercelRes(res));
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      return res.end(String(e));
    }
  }

  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(normalize(ROOT))) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(ROOT, 'index.html'); // SPA fallback
  }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`LeetPing PWA running at http://localhost:${PORT}`);
  setInterval(async () => {
    const r = await fetch(`http://localhost:${PORT}/api/dispatch?key=local-secret`).then((x) => x.json()).catch(() => null);
    if (r?.sent) console.log(`[dispatch] sent ${r.sent} push alarm(s)`);
  }, 20_000);
});
