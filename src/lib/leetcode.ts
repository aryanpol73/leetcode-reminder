/**
 * LeetCode data layer.
 *
 * Primary source: LeetCode's public GraphQL endpoint (https://leetcode.com/graphql).
 * Query shapes follow alfa-leetcode-api (https://github.com/alfaarghya/alfa-leetcode-api, MIT).
 *
 * Fallback: an alfa-leetcode-api compatible REST server (the public one at
 * https://alfa-leetcode-api.onrender.com is heavily rate limited, so you can self-host it with
 * `docker run -p 3000:3000 alfaarghya/alfa-leetcode-api:2.0.4` and point Settings at it).
 * The fallback is used when the direct GraphQL call fails, e.g. on web where LeetCode blocks CORS.
 */
import type { Contest, ContestInfo, DailyChallenge, Difficulty, Profile, ProblemRef, SkillStat } from './types';

// In the browser (PWA) LeetCode blocks cross-origin calls, so go through our /api/leetcode proxy.
const IS_BROWSER = typeof document !== 'undefined';
const ENDPOINT = IS_BROWSER ? '/api/leetcode' : 'https://leetcode.com/graphql';
export const DEFAULT_FALLBACK = 'https://alfa-leetcode-api.onrender.com';

let fallbackBase = DEFAULT_FALLBACK;
export function setFallbackApi(url: string) {
  fallbackBase = (url || DEFAULT_FALLBACK).replace(/\/+$/, '');
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode responded ${res.status}`);
  const json = await res.json();
  if (json.errors?.length && !json.data) throw new Error(json.errors[0].message ?? 'LeetCode query failed');
  return json.data as T;
}

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${fallbackBase}${path}`);
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 120) || `Fallback API responded ${res.status}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 120));
  }
}

/** Try GraphQL first, then the REST fallback. */
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (e) {
    try {
      return await fallback();
    } catch {
      throw e;
    }
  }
}

export const problemUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;
export const profileUrl = (username: string) => `https://leetcode.com/u/${username}/`;
export const contestUrl = (slug: string) => `https://leetcode.com/contest/${slug}/`;
export const iconUrl = (icon: string) => (icon.startsWith('http') ? icon : `https://leetcode.com${icon}`);

const countOf = (list: { difficulty: string; count: number }[] | undefined, d: string) =>
  list?.find((x) => x.difficulty === d)?.count ?? 0;

/** submissionCalendar is a JSON string of {unixSecondsAtUtcMidnight: count} */
export function parseCalendar(raw: unknown): Record<string, number> {
  let obj: Record<string, number> = {};
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : ((raw as Record<string, number>) ?? {});
  } catch {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [ts, n] of Object.entries(obj)) {
    const day = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
    out[day] = (out[day] ?? 0) + Number(n);
  }
  return out;
}

// ---------------------------------------------------------------- profile

const PROFILE_QUERY = `query userBundle($u: String!, $limit: Int!) {
  matchedUser(username: $u) {
    username
    profile { ranking userAvatar realName }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    userCalendar { streak totalActiveDays submissionCalendar }
    badges { displayName icon }
    languageProblemCount { languageName problemsSolved }
    tagProblemCounts {
      advanced { tagName tagSlug problemsSolved }
      intermediate { tagName tagSlug problemsSolved }
      fundamental { tagName tagSlug problemsSolved }
    }
  }
  allQuestionsCount { difficulty count }
  recentAcSubmissionList(username: $u, limit: $limit) { id title titleSlug timestamp }
  userContestRanking(username: $u) { attendedContestsCount rating globalRanking topPercentage badge { name } }
}`;

async function profileFromGraphQL(username: string): Promise<Profile> {
  const data = await gql<any>(PROFILE_QUERY, { u: username.trim(), limit: 20 });
  const u = data?.matchedUser;
  if (!u) throw new NotFound(username);
  const ac = u.submitStatsGlobal?.acSubmissionNum;
  const all = data.allQuestionsCount;
  const skills: SkillStat[] = [];
  for (const level of ['fundamental', 'intermediate', 'advanced'] as const) {
    for (const t of u.tagProblemCounts?.[level] ?? []) {
      skills.push({ tag: t.tagName, slug: t.tagSlug, solved: t.problemsSolved, level });
    }
  }
  const c = data.userContestRanking;
  const contest: ContestInfo | undefined = c
    ? {
        rating: Math.round(c.rating),
        globalRanking: c.globalRanking,
        attended: c.attendedContestsCount,
        topPercentage: c.topPercentage ?? undefined,
        badge: c.badge?.name ?? undefined,
      }
    : undefined;
  return {
    username: u.username,
    realName: u.profile?.realName || undefined,
    avatar: u.profile?.userAvatar || undefined,
    ranking: u.profile?.ranking ?? undefined,
    solved: { all: countOf(ac, 'All'), easy: countOf(ac, 'Easy'), medium: countOf(ac, 'Medium'), hard: countOf(ac, 'Hard') },
    totals: { all: countOf(all, 'All'), easy: countOf(all, 'Easy'), medium: countOf(all, 'Medium'), hard: countOf(all, 'Hard') },
    streak: u.userCalendar?.streak ?? 0,
    totalActiveDays: u.userCalendar?.totalActiveDays ?? 0,
    calendar: parseCalendar(u.userCalendar?.submissionCalendar),
    recent: (data.recentAcSubmissionList ?? []).map((s: any) => ({
      id: String(s.id),
      title: s.title,
      slug: s.titleSlug,
      timestamp: Number(s.timestamp),
    })),
    badges: (u.badges ?? []).map((b: any) => ({ name: b.displayName, icon: iconUrl(b.icon ?? '') })),
    languages: (u.languageProblemCount ?? [])
      .map((l: any) => ({ name: l.languageName, solved: l.problemsSolved }))
      .sort((a: any, b: any) => b.solved - a.solved),
    skills,
    contest,
    fetchedAt: Date.now(),
  };
}

/** Reduced profile from alfa-leetcode-api REST (/:user/solved, /:user/acSubmission, /:user/calendar). */
async function profileFromRest(username: string): Promise<Profile> {
  const u = encodeURIComponent(username.trim());
  const solved = await rest<any>(`/${u}/solved`);
  if (solved?.errors || solved?.solvedProblem === undefined) throw new NotFound(username);
  const [acs, cal] = await Promise.all([
    rest<any>(`/${u}/acSubmission?limit=20`).catch(() => null),
    rest<any>(`/${u}/calendar`).catch(() => null),
  ]);
  const list = acs?.submission ?? acs?.submissions ?? (Array.isArray(acs) ? acs : []);
  return {
    username: username.trim(),
    solved: {
      all: solved.solvedProblem ?? 0,
      easy: solved.easySolved ?? 0,
      medium: solved.mediumSolved ?? 0,
      hard: solved.hardSolved ?? 0,
    },
    totals: { all: 0, easy: 0, medium: 0, hard: 0 },
    streak: cal?.streak ?? 0,
    totalActiveDays: cal?.totalActiveDays ?? 0,
    calendar: parseCalendar(cal?.submissionCalendar),
    recent: list.map((s: any, i: number) => ({
      id: String(s.id ?? `${s.titleSlug}-${i}`),
      title: s.title,
      slug: s.titleSlug,
      timestamp: Number(s.timestamp),
    })),
    badges: [],
    languages: [],
    skills: [],
    fetchedAt: Date.now(),
  };
}

class NotFound extends Error {
  constructor(username: string) {
    super(`No LeetCode user named "${username}"`);
  }
}

export async function fetchProfile(username: string): Promise<Profile> {
  try {
    return await profileFromGraphQL(username);
  } catch (e) {
    if (e instanceof NotFound) throw e;
    try {
      return await profileFromRest(username);
    } catch (e2) {
      throw e2 instanceof NotFound ? e2 : e;
    }
  }
}

// ---------------------------------------------------------------- problems

const PROBLEM_FIELDS = 'questionFrontendId title titleSlug difficulty isPaidOnly acRate topicTags { name slug }';

function toRef(q: any): ProblemRef {
  return {
    slug: q.titleSlug,
    frontendId: String(q.questionFrontendId),
    title: q.title ?? q.questionTitle,
    difficulty: q.difficulty as Difficulty,
    paidOnly: !!q.isPaidOnly,
    tags: (q.topicTags ?? []).map((t: any) => t.name),
    acRate: typeof q.acRate === 'number' ? q.acRate : undefined,
  };
}

export async function fetchDaily(): Promise<DailyChallenge> {
  return withFallback(
    async () => {
      const data = await gql<any>(`{ activeDailyCodingChallengeQuestion { date question { ${PROBLEM_FIELDS} } } }`);
      const d = data.activeDailyCodingChallengeQuestion;
      return { date: d.date, problem: toRef(d.question) };
    },
    async () => {
      const d = await rest<any>('/daily');
      return {
        date: d.date,
        problem: toRef({ ...d, title: d.questionTitle ?? d.title, questionFrontendId: d.questionFrontendId ?? d.questionId }),
      };
    },
  );
}

export async function fetchProblem(slug: string): Promise<ProblemRef | null> {
  return withFallback(
    async () => {
      const data = await gql<any>(`query($s: String!) { question(titleSlug: $s) { ${PROBLEM_FIELDS} } }`, { s: slug });
      return data.question ? toRef(data.question) : null;
    },
    async () => {
      const q = await rest<any>(`/select?titleSlug=${encodeURIComponent(slug)}`);
      return q?.titleSlug ? toRef({ ...q, title: q.questionTitle ?? q.title }) : null;
    },
  );
}

export interface ProblemFilters {
  search?: string;
  tags?: string[]; // tag slugs
  difficulty?: Difficulty;
  limit?: number;
  skip?: number;
}

export async function listProblems(f: ProblemFilters): Promise<{ total: number; problems: ProblemRef[] }> {
  const filters: Record<string, unknown> = {};
  if (f.search) filters.searchKeywords = f.search;
  if (f.tags?.length) filters.tags = f.tags;
  if (f.difficulty) filters.difficulty = f.difficulty.toUpperCase();
  const limit = f.limit ?? 20;
  const skip = f.skip ?? 0;
  return withFallback(
    async () => {
      const data = await gql<any>(
        `query($f: QuestionListFilterInput, $limit: Int, $skip: Int) {
          questionList(categorySlug: "", limit: $limit, skip: $skip, filters: $f) {
            totalNum
            data { ${PROBLEM_FIELDS} }
          }
        }`,
        { f: filters, limit, skip },
      );
      return { total: data.questionList?.totalNum ?? 0, problems: (data.questionList?.data ?? []).map(toRef) };
    },
    async () => {
      const params = [`limit=${limit}`, `skip=${skip}`];
      if (f.tags?.length) params.push(`tags=${f.tags.join('+')}`);
      if (f.difficulty) params.push(`difficulty=${f.difficulty.toUpperCase()}`);
      const d = await rest<any>(`/problems?${params.join('&')}`);
      const qs = d.problemsetQuestionList ?? d.questions ?? [];
      return { total: d.totalQuestions ?? qs.length, problems: qs.map(toRef) };
    },
  );
}

/**
 * Accepts a problem URL, a slug, a problem number, or free text.
 * Returns the best matches (exact match first).
 */
export async function resolveProblems(input: string, extra: Omit<ProblemFilters, 'search'> = {}): Promise<ProblemRef[]> {
  const q = input.trim();
  const urlMatch = q.match(/leetcode\.(?:com|cn)\/problems\/([a-z0-9-]+)/i);
  if (urlMatch) {
    const p = await fetchProblem(urlMatch[1].toLowerCase());
    return p ? [p] : [];
  }
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(q)) {
    const p = await fetchProblem(q).catch(() => null);
    if (p) return [p];
  }
  const { problems } = await listProblems({ ...extra, search: q || undefined, limit: extra.limit ?? 20 });
  if (/^\d+$/.test(q)) problems.sort((a, b) => Number(b.frontendId === q) - Number(a.frontendId === q));
  return problems;
}

export const POPULAR_TAGS: { name: string; slug: string }[] = [
  { name: 'Array', slug: 'array' },
  { name: 'String', slug: 'string' },
  { name: 'Hash Table', slug: 'hash-table' },
  { name: 'Two Pointers', slug: 'two-pointers' },
  { name: 'Sliding Window', slug: 'sliding-window' },
  { name: 'Binary Search', slug: 'binary-search' },
  { name: 'Stack', slug: 'stack' },
  { name: 'Linked List', slug: 'linked-list' },
  { name: 'Tree', slug: 'tree' },
  { name: 'Graph', slug: 'graph' },
  { name: 'Heap', slug: 'heap-priority-queue' },
  { name: 'Greedy', slug: 'greedy' },
  { name: 'Backtracking', slug: 'backtracking' },
  { name: 'Dynamic Programming', slug: 'dynamic-programming' },
  { name: 'Bit Manipulation', slug: 'bit-manipulation' },
  { name: 'Math', slug: 'math' },
];

// ---------------------------------------------------------------- contests

export async function fetchUpcomingContests(): Promise<Contest[]> {
  const list = await withFallback(
    async () => (await gql<any>(`{ topTwoContests { title titleSlug startTime duration } }`)).topTwoContests ?? [],
    async () => (await rest<any>('/contests/upcoming')).contests ?? [],
  );
  return list
    .map((c: any) => ({ title: c.title, slug: c.titleSlug, startTime: Number(c.startTime), duration: Number(c.duration) }))
    .filter((c: Contest) => c.startTime * 1000 > Date.now() - c.duration * 1000)
    .sort((a: Contest, b: Contest) => a.startTime - b.startTime);
}
