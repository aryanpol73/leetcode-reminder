// POST /api/snooze { subscription, title, body, url, minutes }
// Queues one alarm `minutes` from now for this device (used by the "Snooze 10 min" action).
import { isValidSub, json, pushConfigured, readBody, redis, subId } from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!pushConfigured()) return json(res, 503, { error: 'Push is not configured' });
  let b;
  try {
    b = readBody(req);
  } catch {
    return json(res, 400, { error: 'Bad JSON' });
  }
  if (!isValidSub(b.subscription)) return json(res, 400, { error: 'Missing push subscription' });
  const id = await subId(b.subscription);
  const minutes = Math.min(60, Math.max(1, Number(b.minutes) || 10));
  const at = Date.now() + minutes * 60_000;
  const url = /^https:\/\/leetcode\.com\//.test(b.url) || String(b.url).startsWith('/') ? String(b.url).slice(0, 300) : '/';
  const member = JSON.stringify({
    id,
    at,
    title: `⏰ ${String(b.title || 'LeetCode time').replace(/^⏰\s*/, '').slice(0, 110)} (snoozed)`,
    body: String(b.body || '').slice(0, 300),
    url,
    tag: `snooze-${at}`,
  });
  await redis([
    ['SET', `lp:sub:${id}`, JSON.stringify(b.subscription), 'EX', String(60 * 86_400)],
    ['ZADD', 'lp:due', String(at), member],
    ['SADD', `lp:user:${id}`, member],
  ]);
  return json(res, 200, { ok: true, at });
}
