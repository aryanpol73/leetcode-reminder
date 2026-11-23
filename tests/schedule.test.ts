import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey } from '../src/lib/dates';
import { autoComplete, buildQueue, MAX_QUEUED, solvedToday } from '../src/lib/schedule';
import type { AppState, PlanItem, Profile } from '../src/lib/types';

// Monday 2026-11-23, 10:00 local
const NOW = new Date(2026, 10, 23, 10, 0, 0);
const ALL = [0, 1, 2, 3, 4, 5, 6];

const base = (over: Partial<AppState> = {}): AppState => ({
  plan: [],
  contests: [],
  reminders: [],
  alarmMode: true,
  contestAlarms: true,
  fallbackApi: '',
  ...over,
});

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 'x',
  slug: 'two-sum',
  frontendId: '1',
  title: 'Two Sum',
  difficulty: 'Easy',
  date: dayKey(NOW),
  status: 'todo',
  addedAt: NOW.getTime() - 3600_000,
  ...over,
});

const profileWith = (recentTs: number[]): Profile => ({
  username: 'u',
  solved: { all: 0, easy: 0, medium: 0, hard: 0 },
  totals: { all: 0, easy: 0, medium: 0, hard: 0 },
  streak: 12,
  totalActiveDays: 0,
  recent: recentTs.map((t, i) => ({ id: String(i), title: 'Two Sum', slug: 'two-sum', timestamp: t })),
  calendar: {},
  badges: [],
  languages: [],
  skills: [],
  fetchedAt: 0,
});

test('daily reminder skips times already passed today and repeats for 14 days', () => {
  const q = buildQueue(base({ reminders: [{ id: 'm', label: 'Morning', hour: 9, minute: 0, days: ALL, enabled: true, kind: 'nudge' }] }), NOW);
  assert.equal(q.length, 13); // today 9:00 already passed
  assert.equal(q[0].at.getDate(), 24);
  assert.equal(q[0].at.getHours(), 9);
});

test('weekday-only reminder ignores weekends', () => {
  const q = buildQueue(base({ reminders: [{ id: 'w', label: 'W', hour: 20, minute: 0, days: [1, 2, 3, 4, 5], enabled: true, kind: 'nudge' }] }), NOW);
  assert.ok(q.every((a) => a.at.getDay() >= 1 && a.at.getDay() <= 5));
  assert.equal(q.length, 10);
});

test('disabled reminders produce nothing', () => {
  const q = buildQueue(base({ reminders: [{ id: 'd', label: 'D', hour: 20, minute: 0, days: ALL, enabled: false, kind: 'nudge' }] }), NOW);
  assert.equal(q.length, 0);
});

test('reminder body names the planned problem for that day, and overdue items roll into today', () => {
  const state = base({
    reminders: [{ id: 'e', label: 'Evening', hour: 20, minute: 0, days: ALL, enabled: true, kind: 'nudge' }],
    plan: [item({ id: 'a', date: '2026-11-22', slug: 'lru-cache', frontendId: '146', title: 'LRU Cache', difficulty: 'Medium' })],
  });
  const q = buildQueue(state, NOW);
  assert.match(q[0].body, /#146 LRU Cache/);
  assert.equal(q[0].data.slug, 'lru-cache');
  assert.doesNotMatch(q[1].body, /LRU Cache/); // tomorrow: not planned
});

test('streak saver is skipped today once something was solved today, but kept for later days', () => {
  const reminders = [{ id: 's', label: 'Streak', hour: 21, minute: 30, days: ALL, enabled: true, kind: 'streak' as const }];
  const solvedTs = Math.floor(new Date(2026, 10, 23, 8, 0).getTime() / 1000);
  const withSolve = buildQueue(base({ reminders, profile: profileWith([solvedTs]) }), NOW);
  const without = buildQueue(base({ reminders, profile: profileWith([]) }), NOW);
  assert.equal(without[0].at.getDate(), 23);
  assert.equal(withSolve[0].at.getDate(), 24);
  assert.equal(withSolve.length, without.length - 1);
  assert.match(without[0].title, /12 days/);
});

test('per-problem alarm fires at its time, only while still todo', () => {
  const q = buildQueue(base({ plan: [item({ time: '18:45', note: 'use hashmap' })] }), NOW);
  assert.equal(q.length, 1);
  assert.equal(q[0].at.getHours(), 18);
  assert.equal(q[0].at.getMinutes(), 45);
  assert.match(q[0].body, /use hashmap/);
  assert.equal(buildQueue(base({ plan: [item({ time: '18:45', status: 'done' })] }), NOW).length, 0);
});

test('contest alarm rings 30 minutes before start, and can be turned off', () => {
  const start = Math.floor(new Date(2026, 10, 29, 8, 0).getTime() / 1000);
  const contests = [{ title: 'Weekly Contest 530', slug: 'weekly-contest-530', startTime: start, duration: 5400 }];
  const q = buildQueue(base({ contests }), NOW);
  assert.equal(q.length, 1);
  assert.equal(q[0].at.getTime(), start * 1000 - 30 * 60_000);
  assert.equal(q[0].data.url, 'https://leetcode.com/contest/weekly-contest-530/');
  assert.equal(buildQueue(base({ contests, contestAlarms: false }), NOW).length, 0);
});

test('queue is sorted and capped under the iOS 64 pending-notification limit', () => {
  const reminders = Array.from({ length: 6 }, (_, i) => ({ id: String(i), label: 'R', hour: 11 + i, minute: 0, days: ALL, enabled: true, kind: 'nudge' as const }));
  const q = buildQueue(base({ reminders }), NOW);
  assert.equal(q.length, MAX_QUEUED);
  for (let i = 1; i < q.length; i++) assert.ok(q[i].at >= q[i - 1].at);
});

test('autoComplete ticks off a planned problem accepted after it was planned', () => {
  const p = item({});
  const after = Math.floor((p.addedAt + 60_000) / 1000);
  const before = Math.floor((p.addedAt - 86_400_000) / 1000);
  assert.equal(autoComplete([p], [{ slug: 'two-sum', timestamp: after }])[0].status, 'done');
  assert.equal(autoComplete([p], [{ slug: 'two-sum', timestamp: before }])[0].status, 'todo');
  assert.equal(autoComplete([p], [{ slug: 'add-two-numbers', timestamp: after }])[0].status, 'todo');
});

test('solvedToday uses the local calendar day', () => {
  const yesterday = Math.floor(new Date(2026, 10, 22, 23, 0).getTime() / 1000);
  assert.equal(solvedToday({ profile: profileWith([yesterday]) }, NOW), false);
  assert.equal(solvedToday({ profile: undefined }, NOW), false);
});
