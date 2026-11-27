/**
 * Pure alarm planner: turns reminders + plan + contests into a list of concrete alarm times.
 * No Expo imports, so it can be unit-tested in Node (see tests/schedule.test.ts).
 */
import { addDays, dayKey, parseTime } from './dates';
import { practiceAlarm, type PracticeAlarm } from './alarmMessages';
import type { AppState, PlanItem } from './types';

/** How far ahead one-off alarms are queued (re-planned every sync / app open / background run). */
export const HORIZON_DAYS = 14;
/** iOS keeps at most 64 pending local notifications; stay under it. */
export const MAX_QUEUED = 60;
export const CONTEST_LEAD_MIN = 30;

export interface PlannedAlarm {
  at: Date;
  title: string;
  body: string;
  data: Record<string, string | null>;
  practice?: PracticeAlarm;
}

export function solvedToday(state: Pick<AppState, 'profile'>, now = new Date()): boolean {
  const today = dayKey(now);
  return !!state.profile?.recent.some((r) => dayKey(new Date(r.timestamp * 1000)) === today);
}

/** Marks planned problems done when LeetCode shows an accepted submission made after they were planned. */
export function autoComplete(plan: PlanItem[], recent: { slug: string; timestamp: number }[]): PlanItem[] {
  return plan.map((p) => {
    if (p.status === 'done') return p;
    const hit = recent.find((r) => r.slug === p.slug && r.timestamp * 1000 >= p.addedAt - 60_000);
    return hit ? { ...p, status: 'done' as const, doneAt: hit.timestamp * 1000 } : p;
  });
}

function planSummary(items: PlanItem[]): string | null {
  const todo = items.filter((p) => p.status === 'todo');
  if (!todo.length) return null;
  const names = todo.slice(0, 2).map((p) => `#${p.frontendId} ${p.title}`);
  const more = todo.length > 2 ? ` +${todo.length - 2} more` : '';
  return `On your plan: ${names.join(', ')}${more}`;
}

export function buildQueue(state: AppState, now = new Date()): PlannedAlarm[] {
  const queue: PlannedAlarm[] = [];
  const doneToday = solvedToday(state, now);

  for (let d = 0; d < HORIZON_DAYS; d++) {
    const day = addDays(now, d);
    const key = dayKey(day);
    const planned = state.plan.filter((p) => p.date === key);
    const overdue = d === 0 ? state.plan.filter((p) => p.status === 'todo' && p.date < key) : [];
    const dayItems = [...overdue, ...planned];
    const summary = planSummary(dayItems);
    const firstTodo = dayItems.find((p) => p.status === 'todo');

    for (const r of state.reminders) {
      if (!r.enabled || !r.days.includes(day.getDay())) continue;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), r.hour, r.minute, 0);
      if (at <= now) continue;
      if (r.kind === 'streak' && d === 0 && doneToday) continue;

      const practice = practiceAlarm(state, at, r.id, firstTodo, now);
      const body = summary ?? `${practice.headline} ${practice.message}`;
      const title =
        r.kind === 'streak'
          ? `🔥 Save your streak${state.profile?.streak ? ` (${state.profile.streak} days)` : ''}`
          : `⏰ ${r.label || 'LeetCode time'}`;
      queue.push({
        at, title, body,
        data: { slug: firstTodo?.slug ?? null, reminderId: r.id, ...(firstTodo ? {} : { url: 'https://leetcode.com/problemset/' }) },
        practice,
      });
    }

    for (const p of planned) {
      if (p.status !== 'todo' || !p.time) continue;
      const { hour, minute } = parseTime(p.time);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0);
      if (at <= now) continue;
      queue.push({
        at,
        title: `⏰ Time to solve #${p.frontendId}`,
        body: `${p.title} · ${p.difficulty}${p.note ? ` · ${p.note}` : ''}`,
        data: { slug: p.slug, planId: p.id },
        practice: practiceAlarm(state, at, p.id, p, now),
      });
    }
  }

  if (state.contestAlarms) {
    const horizon = addDays(now, HORIZON_DAYS).getTime();
    for (const c of state.contests ?? []) {
      const start = c.startTime * 1000;
      const at = new Date(start - CONTEST_LEAD_MIN * 60_000);
      if (at <= now || start > horizon) continue;
      const startLabel = new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      queue.push({
        at,
        title: `🏆 ${c.title} starts in ${CONTEST_LEAD_MIN} min`,
        body: `Starts at ${startLabel} · ${Math.round(c.duration / 60)} min. Warm up with an easy one!`,
        data: { url: `https://leetcode.com/contest/${c.slug}/` },
      });
    }
  }

  return queue.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_QUEUED);
}
