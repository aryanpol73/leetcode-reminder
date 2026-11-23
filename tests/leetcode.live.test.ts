/**
 * Live checks against LeetCode's public GraphQL API. Run with: npm run test:live
 * Uses a well-known public profile; set LEETPING_TEST_USER to try your own.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchDaily, fetchProfile, fetchUpcomingContests, listProblems, parseCalendar, resolveProblems } from '../src/lib/leetcode';

const USER = process.env.LEETPING_TEST_USER ?? 'lee215';

test('profile: stats, streak, recent ACs, skills, languages, contest', async () => {
  const p = await fetchProfile(USER);
  assert.equal(p.username.toLowerCase(), USER.toLowerCase());
  assert.ok(p.solved.all > 0 && p.totals.all > p.solved.all);
  assert.equal(p.solved.all, p.solved.easy + p.solved.medium + p.solved.hard);
  assert.ok(p.recent.length > 0 && p.recent[0].slug && p.recent[0].timestamp > 1e9);
  assert.ok(Object.keys(p.calendar).length > 0);
  assert.ok(p.skills.length > 0 && p.languages.length > 0);
  console.log(`  ${p.username}: ${p.solved.all} solved, streak ${p.streak}, contest ${p.contest?.rating ?? '-'}, ${p.badges.length} badges`);
});

test('profile: unknown user gives a clear error', async () => {
  await assert.rejects(fetchProfile('this-user-should-not-exist-zz9x7q'), /No LeetCode user/);
});

test('daily challenge', async () => {
  const d = await fetchDaily();
  assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d.problem.slug && d.problem.title);
  console.log(`  daily ${d.date}: #${d.problem.frontendId} ${d.problem.title}`);
});

test('resolve by number, slug, and URL', async () => {
  assert.equal((await resolveProblems('42'))[0].slug, 'trapping-rain-water');
  assert.equal((await resolveProblems('two-sum'))[0].frontendId, '1');
  assert.equal((await resolveProblems('https://leetcode.com/problems/lru-cache/description/'))[0].title, 'LRU Cache');
});

test('list problems filtered by topic and difficulty', async () => {
  const r = await listProblems({ tags: ['dynamic-programming'], difficulty: 'Medium', limit: 5 });
  assert.ok(r.total > 100);
  assert.equal(r.problems.length, 5);
  assert.ok(r.problems.every((p) => p.difficulty === 'Medium' && p.tags?.includes('Dynamic Programming')));
});

test('upcoming contests', async () => {
  const c = await fetchUpcomingContests();
  assert.ok(c.length >= 1 && c[0].slug.includes('contest'));
});

test('parseCalendar maps UTC timestamps to days', () => {
  assert.deepEqual(parseCalendar('{"1767398400": 3, "1767484800": 2}'), { '2026-01-03': 3, '2026-01-04': 2 });
  assert.deepEqual(parseCalendar('not json'), {});
});
