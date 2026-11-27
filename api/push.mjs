// GET  /api/push            -> { enabled, publicKey }
// POST /api/push            { subscription, alarms: [{ at, title, body, url, tag }] }
//                           Replaces this device's queued alarms (next 14 days).
// DELETE /api/push          { subscription } -> forget this device
import { isValidSub, json, pushConfigured, readBody, redis, subId } from './_lib.mjs';

const MAX_ALARMS = 80;
const clip = (s, n) => String(s ?? '').slice(0, n);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, { enabled: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
  }
  if (!pushConfigured()) return json(res, 503, { error: 'Push is not configured on this server' });

  let body;
  try {
    body = readBody(req);
  } catch {
    return json(res, 400, { error: 'Bad JSON' });
  }
  if (!isValidSub(body.subscription)) return json(res, 400, { error: 'Missing push subscription' });
  const id = await subId(body.subscription);

  // Remove this device's previously queued alarms.
  const [old] = await redis([['SMEMBERS', `lp:user:${id}`]]);
  const cleanup = old?.length ? [['ZREM', 'lp:due', ...old], ['DEL', `lp:user:${id}`]] : [];

  if (req.method === 'DELETE') {
    await redis([...cleanup, ['DEL', `lp:sub:${id}`]].filter((c) => c.length > 1) );
    return json(res, 200, { ok: true });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const now = Date.now();
  const alarms = (Array.isArray(body.alarms) ? body.alarms : [])
    .filter((a) => Number(a.at) > now && Number(a.at) < now + 15 * 86_400_000)
    .slice(0, MAX_ALARMS)
    .map((a) => ({
      id,
      at: Number(a.at),
      title: clip(a.title, 120),
      body: clip(a.body, 300),
      url: /^https:\/\/leetcode\.com\//.test(a.url) || String(a.url).startsWith('/') ? clip(a.url, 300) : '/',
      tag: clip(a.tag, 120),
    }));

  const members = alarms.map((a) => JSON.stringify(a));
  const cmds = [
    ...cleanup,
    ['SET', `lp:sub:${id}`, JSON.stringify(body.subscription), 'EX', String(60 * 86_400)],
  ];
  if (members.length) {
    cmds.push(['ZADD', 'lp:due', ...alarms.flatMap((a, i) => [String(a.at), members[i]])]);
    cmds.push(['SADD', `lp:user:${id}`, ...members]);
    cmds.push(['EXPIRE', `lp:user:${id}`, String(30 * 86_400)]);
  }
  await redis(cmds);
  return json(res, 200, { ok: true, queued: alarms.length });
}
