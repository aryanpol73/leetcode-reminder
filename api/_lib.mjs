// Shared helpers for the push backend (Vercel serverless functions).
//
// Only a Redis database is required. Connect Upstash Redis from Vercel → Storage (it injects
// KV_REST_API_URL / KV_REST_API_TOKEN), or set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
//
// Optional env vars:
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  otherwise generated once and stored in Redis
//   VAPID_SUBJECT                         contact URL/mailto for push services
//   CRON_SECRET                           if set, /api/dispatch requires it
import * as webpushNs from 'web-push';
const webpush = webpushNs.default ?? webpushNs;

const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function pushConfigured() {
  return !!(REDIS_URL() && REDIS_TOKEN());
}

/** Runs Redis commands through Upstash's REST pipeline. Returns an array of results. */
export async function redis(commands) {
  const res = await fetch(`${REDIS_URL()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

let vapid;
/** VAPID keys from env, or generated on first use and persisted in Redis (SET NX keeps them stable). */
export async function vapidKeys() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const fresh = webpush.generateVAPIDKeys();
    const [, stored] = await redis([['SET', 'lp:vapid', JSON.stringify(fresh), 'NX'], ['GET', 'lp:vapid']]);
    vapid = JSON.parse(stored);
  }
  return vapid;
}

export async function push() {
  const k = await vapidKeys();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://github.com/aryanpol73/leetcode-reminder', k.publicKey, k.privateKey);
  return webpush;
}

/** Stable id for a push subscription (its endpoint is unique per browser install). */
export async function subId(subscription) {
  const data = new TextEncoder().encode(subscription.endpoint);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash).toString('hex').slice(0, 32);
}

export function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(JSON.stringify(body));
}

export function readBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body ?? {};
}

export const isValidSub = (s) => s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.keys?.p256dh && s.keys?.auth;
