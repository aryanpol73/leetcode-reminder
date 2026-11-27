import { addDays, dayKey } from './dates';
import type { AppState, ProblemRef } from './types';

export interface PracticeAlarm {
  headline: string;
  message: string;
  streak?: number;
  problem?: Pick<ProblemRef, 'slug' | 'frontendId' | 'title' | 'difficulty'>;
  note?: string;
  planId?: string;
}

const messages = {
  starting: [
    ['Day one starts here.', 'Open one problem and give it five minutes. An Easy counts.'],
    ['One problem is enough.', 'Try the first example and see what you notice.'],
    ['Give yourself a first win.', 'Pick an Easy and run your first test case.'],
    ['Start with the example.', 'Open a problem and work through the sample by hand.'],
    ['Make today day one.', 'Open LeetCode and take one honest shot at a problem.'],
  ],
  returning: [
    ['Make today your comeback.', 'Open one problem. Five minutes is enough to get moving.'],
    ['Find your rhythm again.', 'Pick a familiar topic and get one solve on the board.'],
    ['Give today a fresh start.', 'Open LeetCode and try one problem you can finish.'],
    ['A small solve still counts.', 'Take five minutes and work through the first example.'],
    ['Get one solve on the board.', 'Start with an Easy or revisit a problem you nearly solved.'],
  ],
  regular: [
    ['One solve keeps it alive.', 'Open a problem and give it five focused minutes.'],
    ['Keep your rhythm going.', 'Open a problem and work through the first example.'],
    ['Build on your last solve.', 'Try one problem while the habit is fresh.'],
    ['One problem before you call it a day.', 'Start with a test case and see where it takes you.'],
    ['Another day, another Accepted.', 'Open LeetCode and make time for one good attempt.'],
  ],
} as const;

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (Math.imul(result, 31) + char.charCodeAt(0)) >>> 0;
  return result;
}

export function practiceAlarm(
  state: Pick<AppState, 'profile' | 'username'>,
  at: Date,
  slot: string,
  problem?: ProblemRef & { id?: string; note?: string },
  now = new Date(),
): PracticeAlarm {
  const profile = state.profile;
  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));
  const thisWeek = dayKey(addDays(now, -6));
  const accepted = new Set(profile?.recent.map((r) => dayKey(new Date(r.timestamp * 1000))));
  const activity = new Set([
    ...accepted,
    ...Object.keys(profile?.calendar ?? {}).filter((key) => (profile?.calendar[key] ?? 0) > 0),
  ]);
  const activeThisWeek = [...activity].filter((key) => key >= thisWeek && key <= today).length;
  const streak = profile && (accepted.has(today) || accepted.has(yesterday)) ? profile.streak : 0;
  const hasHistory = !!profile && (profile.solved.all > 0 || accepted.size > 0 || profile.totalActiveDays > 0);
  const style = !hasHistory ? 'starting' : streak >= 3 || activeThisWeek >= 4 ? 'regular' : 'returning';
  const bank = messages[style];
  const day = Math.floor(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) / 86_400_000);
  const index = ((day + hash(`${profile?.username ?? state.username ?? 'leetping'}:${slot}`)) % bank.length + bank.length) % bank.length;
  const [headline, message] = bank[index];
  return {
    headline,
    message,
    streak: dayKey(at) === today && streak > 0 && !accepted.has(today) ? streak : undefined,
    problem: problem && {
      slug: problem.slug,
      frontendId: problem.frontendId,
      title: problem.title,
      difficulty: problem.difficulty,
    },
    note: problem?.note,
    planId: problem?.id,
  };
}
