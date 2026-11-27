// GET /api/dispatch?key=CRON_SECRET  (or header Authorization: Bearer CRON_SECRET)
// Sends every alarm that is due. Call it every minute from a scheduler
// (cron-job.org, GitHub Actions, Vercel Cron on Pro). See README → "Push alarms".
import { json, push, pushConfigured, redis } from './_lib.mjs';

const LATE_LIMIT_MS = 60 * 60_000; // drop alarms more than an hour late instead of ringing at random times

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const given = req.query?.key || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secret || given !== secret) return json(res, 401, { error: 'Unauthorized' });
  if (!pushConfigured()) return json(res, 503, { error: 'Push is not configured' });

  const now = Date.now();
  const [due] = await redis([['ZRANGEBYSCORE', 'lp:due', '0', String(now), 'LIMIT', '0', '500']]);
  if (!due?.length) return json(res, 200, { sent: 0 });

  // Claim them first so overlapping runs don't double-send.
  const [removed] = await redis([['ZREM', 'lp:due', ...due]]);
  if (!removed) return json(res, 200, { sent: 0 });

  const alarms = due.map((m) => JSON.parse(m));
  const ids = [...new Set(alarms.map((a) => a.id))];
  const subs = await redis(ids.map((id) => ['GET', `lp:sub:${id}`]));
  const subById = Object.fromEntries(ids.map((id, i) => [id, subs[i] ? JSON.parse(subs[i]) : null]));

  let sent = 0;
  const dead = new Set();
  await Promise.all(
    alarms.map(async (a, i) => {
      const sub = subById[a.id];
      if (!sub || now - a.at > LATE_LIMIT_MS) return;
      try {
        await push().sendNotification(sub, JSON.stringify({ title: a.title, body: a.body, url: a.url, tag: a.tag }), {
          TTL: 3600,
          urgency: 'high',
        });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) dead.add(a.id);
      }
      await redis([['SREM', `lp:user:${a.id}`, due[i]]]).catch(() => {});
    }),
  );
  if (dead.size) await redis([...dead].map((id) => ['DEL', `lp:sub:${id}`])).catch(() => {});
  return json(res, 200, { sent, expired: dead.size });
}
