// Shared helpers for the push backend (Vercel serverless functions).
//
// Env vars:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: contact)
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  (free Upstash Redis database)
//   CRON_SECRET  (protects /api/dispatch)
import * as webpushNs from 'web-push';
const webpush = webpushNs.default ?? webpushNs;

export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let vapidSet = false;
export function push() {
  if (!vapidSet) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://github.com/aryanpol73/leetcode-reminder', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    vapidSet = true;
  }
  return webpush;
}

/** Runs Redis commands through Upstash's REST pipeline. Returns an array of results. */
export async function redis(commands) {
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
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
