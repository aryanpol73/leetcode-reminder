import type { ProblemFilters } from './leetcode';
import type { AppState, ProblemRef } from './types';

type SolveState = Pick<AppState, 'username' | 'profile' | 'solvedQuestions'>;

const accountKey = (username: string | undefined) => username ? `leetcode:${username.trim().toLowerCase()}` : 'local';

export function rememberSolved(state: SolveState, slugs: Iterable<string | undefined> = []): AppState['solvedQuestions'] {
  const key = accountKey(state.username);
  const recent = state.profile?.username.toLowerCase() === state.username?.toLowerCase()
    ? state.profile?.recent.map((submission) => submission.slug) ?? []
    : [];
  const previous = state.solvedQuestions?.[key] ?? [];
  const known = [...new Set([...previous, ...recent, ...slugs].filter((slug): slug is string => !!slug))];
  return known.length === previous.length ? state.solvedQuestions : { ...state.solvedQuestions, [key]: known };
}

export function knownSolved(state: SolveState): Set<string> {
  return new Set(rememberSolved(state)?.[accountKey(state.username)] ?? []);
}

type PlanningState = SolveState & Pick<AppState, 'plan'>;

export function pickAutoPlanProblems(problems: ProblemRef[], state: PlanningState, count: number): ProblemRef[] {
  if (count <= 0) return [];
  const excluded = knownSolved(state);
  for (const item of state.plan) excluded.add(item.slug);

  const picks: ProblemRef[] = [];
  for (const problem of [...problems].sort((a, b) => (b.acRate ?? 0) - (a.acRate ?? 0))) {
    if (problem.paidOnly || !problem.slug || excluded.has(problem.slug)) continue;
    picks.push(problem);
    if (picks.length >= count) break;
    excluded.add(problem.slug);
  }
  return picks;
}

type ListProblems = (filters: ProblemFilters) => Promise<{ total: number; problems: ProblemRef[] }>;

export async function findAutoPlanProblems(
  list: ListProblems,
  filters: Pick<ProblemFilters, 'tags' | 'difficulty'>,
  count: number,
  currentState: () => PlanningState,
): Promise<ProblemRef[]> {
  const candidates: ProblemRef[] = [];
  const seen = new Set<string>();
  let skip = 0;
  for (let page = 0; page < 20; page++) {
    const result = await list({ ...filters, limit: 100, skip });
    const fresh = result.problems.filter((problem) => {
      if (seen.has(problem.slug)) return false;
      seen.add(problem.slug);
      return true;
    });
    candidates.push(...fresh);
    skip += result.problems.length;
    if (!fresh.length || skip >= result.total || pickAutoPlanProblems(candidates, currentState(), count).length >= count) break;
  }
  return candidates;
}
