import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { addDays, dayKey } from '../lib/dates';
import {
  DEFAULT_FALLBACK,
  fetchDaily,
  fetchProfile,
  fetchUpcomingContests,
  listProblems,
  setFallbackApi,
} from '../lib/leetcode';
import { autoComplete, registerBackgroundSync, STORAGE_KEY } from '../lib/background';
import { rescheduleAll } from '../lib/notifications';
import { findAutoPlanProblems, pickAutoPlanProblems, rememberSolved } from '../lib/planning';
import type { AppState, Difficulty, PlanItem, ProblemRef, Reminder } from '../lib/types';

const AUTO_SYNC_MS = 5 * 60 * 1000;

function friendlyError(e: unknown): string {
  const msg = (e as Error)?.message ?? '';
  if (/too many request/i.test(msg)) return 'The fallback API is rate limited. Try again later, or self-host it (Profile → Data source).';
  if (/failed to fetch|network request failed|load failed/i.test(msg)) return 'Can’t reach LeetCode right now. Pull down to retry.';
  return msg || 'Could not reach LeetCode';
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const DEFAULT_STATE: AppState = {
  plan: [],
  contests: [],
  alarmMode: true,
  contestAlarms: true,
  fallbackApi: DEFAULT_FALLBACK,
  reminders: [
    { id: 'morning', label: 'Morning grind', hour: 9, minute: 0, days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'nudge' },
    { id: 'streak', label: 'Streak saver', hour: 21, minute: 30, days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'streak' },
  ],
};

export interface AutoPlanOptions {
  tagSlug: string;
  difficulty?: Difficulty;
  perDay: number;
  days: number;
  time?: string;
}

interface Store {
  state: AppState;
  ready: boolean;
  syncing: boolean;
  syncError?: string;
  queued: number;
  sync: () => Promise<void>;
  connect: (username: string) => Promise<void>;
  disconnect: () => void;
  addToPlan: (p: ProblemRef, date: string, opts?: { time?: string; note?: string }) => void;
  autoPlan: (o: AutoPlanOptions) => Promise<number>;
  updatePlan: (id: string, patch: Partial<PlanItem>) => void;
  removePlan: (id: string) => void;
  removeMany: (ids: string[]) => void;
  clearPlan: () => void;
  clearDone: () => void;
  toggleDone: (id: string) => void;
  markPreviouslySolved: (id: string) => void;
  upsertReminder: (r: Omit<Reminder, 'id'> & { id?: string }) => void;
  removeReminder: (id: string) => void;
  setSetting: <K extends 'alarmMode' | 'contestAlarms' | 'fallbackApi' | 'screenAlarms' | 'screenAlarmsOverApps'>(k: K, v: AppState[K]) => void;
  reschedule: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string>();
  const [queued, setQueued] = useState(0);
  const stateRef = useRef(state);
  const planningRef = useRef(false);
  stateRef.current = state;

  // Load once
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
    registerBackgroundSync();
  }, []);

  useEffect(() => setFallbackApi(state.fallbackApi), [state.fallbackApi]);

  // Persist + re-plan alarms (debounced) on every change
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    const t = setTimeout(() => {
      rescheduleAll(state).then(setQueued).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [state, ready]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncError(undefined);
    const username = stateRef.current.username;
    const [daily, contests, profile] = await Promise.allSettled([
      fetchDaily(),
      fetchUpcomingContests(),
      username ? fetchProfile(username) : Promise.resolve(undefined),
    ]);
    const val = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : undefined);
    const failed = [daily, contests, profile].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) setSyncError(friendlyError(failed.reason));
    setState((s) => {
      const p = s.username === username ? val(profile) : undefined;
      return {
        ...s,
        daily: val(daily) ?? s.daily,
        contests: val(contests) ?? s.contests,
        profile: p ?? s.profile,
        solvedQuestions: rememberSolved(s, p?.recent.map((submission) => submission.slug)),
        plan: p ? autoComplete(s.plan, p.recent) : s.plan,
        lastSync: failed || s.username !== username ? s.lastSync : Date.now(),
      };
    });
    setSyncing(false);
  }, []);

  // Sync on launch and whenever the app comes back to the foreground
  useEffect(() => {
    if (!ready) return;
    const maybeSync = () => {
      const s = stateRef.current;
      const stale = Date.now() - (s.lastSync ?? 0) > AUTO_SYNC_MS || s.daily?.date !== dayKey();
      if (stale) sync();
      else rescheduleAll(s).then(setQueued).catch(() => {});
    };
    maybeSync();
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && maybeSync());
    return () => sub.remove();
  }, [ready, sync]);

  const connect = useCallback(async (username: string) => {
    setSyncing(true);
    setSyncError(undefined);
    try {
      const profile = await fetchProfile(username);
      setState((s) => ({
        ...s,
        username: profile.username,
        profile,
        solvedQuestions: rememberSolved({ username: profile.username, profile, solvedQuestions: rememberSolved(s) }),
        plan: autoComplete(s.plan, profile.recent),
        lastSync: Date.now(),
      }));
    } catch (e: any) {
      const msg = friendlyError(e);
      setSyncError(msg);
      throw new Error(msg);
    } finally {
      setSyncing(false);
    }
  }, []);

  const autoPlan = useCallback(async (o: AutoPlanOptions) => {
    if (planningRef.current) return 0;
    planningRef.current = true;
    try {
      const need = o.perDay * o.days;
      const { username, profile } = stateRef.current;
      const fresh = username && Date.now() - (profile?.fetchedAt ?? 0) > AUTO_SYNC_MS
        ? await fetchProfile(username).catch(() => undefined)
        : undefined;
      const accepted = fresh?.recent.map((submission) => submission.slug);
      const snapshot = () => {
        const current = stateRef.current;
        if (current.username !== username) throw new Error('Your LeetCode account changed. Try Auto-plan again.');
        return { ...current, solvedQuestions: rememberSolved(current, accepted) };
      };
      const problems = await findAutoPlanProblems(listProblems, { tags: [o.tagSlug], difficulty: o.difficulty }, need, snapshot);
      const now = new Date();
      const picks = pickAutoPlanProblems(problems, snapshot(), need);
      const items: PlanItem[] = picks.map((p, i) => ({
        ...p,
        id: uid(),
        date: dayKey(addDays(now, Math.floor(i / o.perDay))),
        time: o.time,
        status: 'todo',
        addedAt: now.getTime(),
      }));
      setState((s) => {
        if (s.username !== username) return s;
        const updated = { ...s, solvedQuestions: rememberSolved(s, accepted) };
        const available = new Set(pickAutoPlanProblems(items, updated, need).map((p) => p.slug));
        return { ...updated, plan: [...s.plan, ...items.filter((p) => available.has(p.slug))] };
      });
      return items.length;
    } finally {
      planningRef.current = false;
    }
  }, []);

  const value = useMemo<Store>(
    () => ({
      state,
      ready,
      syncing,
      syncError,
      queued,
      sync,
      connect,
      autoPlan,
      disconnect: () => setState((s) => ({ ...s, username: undefined, profile: undefined, solvedQuestions: rememberSolved(s) })),
      addToPlan: (p, date, opts) =>
        setState((s) => ({
          ...s,
          plan: [
            ...s.plan.filter((x) => !(x.slug === p.slug && x.status === 'todo')),
            { ...p, id: uid(), date, time: opts?.time, note: opts?.note, status: 'todo', addedAt: Date.now() },
          ],
        })),
      updatePlan: (id, patch) =>
        setState((s) => ({ ...s, plan: s.plan.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removePlan: (id) => setState((s) => ({ ...s, plan: s.plan.filter((x) => x.id !== id) })),
      removeMany: (ids) => setState((s) => ({ ...s, plan: s.plan.filter((x) => !ids.includes(x.id)) })),
      clearPlan: () => setState((s) => ({
        ...s,
        solvedQuestions: rememberSolved(s, s.plan.filter((item) => item.status === 'done').map((item) => item.slug)),
        plan: [],
      })),
      clearDone: () => setState((s) => ({
        ...s,
        solvedQuestions: rememberSolved(s, s.plan.filter((item) => item.status === 'done').map((item) => item.slug)),
        plan: s.plan.filter((item) => item.status !== 'done'),
      })),
      markPreviouslySolved: (id) => setState((s) => {
        const problem = s.plan.find((item) => item.id === id);
        if (!problem) return s;
        return {
          ...s,
          solvedQuestions: rememberSolved(s, [problem.slug]),
          plan: s.plan.map((item) => item.id === id ? { ...item, status: 'done', doneAt: undefined } : item),
        };
      }),
      toggleDone: (id) =>
        setState((s) => ({
          ...s,
          plan: s.plan.map((x) =>
            x.id === id
              ? x.status === 'done'
                ? { ...x, status: 'todo', doneAt: undefined }
                : { ...x, status: 'done', doneAt: Date.now() }
              : x,
          ),
        })),
      upsertReminder: (r) =>
        setState((s) => {
          const id = r.id ?? uid();
          const next = { ...r, id } as Reminder;
          const exists = s.reminders.some((x) => x.id === id);
          return { ...s, reminders: exists ? s.reminders.map((x) => (x.id === id ? next : x)) : [...s.reminders, next] };
        }),
      removeReminder: (id) => setState((s) => ({ ...s, reminders: s.reminders.filter((x) => x.id !== id) })),
      setSetting: (k, v) => setState((s) => ({ ...s, [k]: v })),
      reschedule: async () => setQueued(await rescheduleAll(stateRef.current)),
    }),
    [state, ready, syncing, syncError, queued, sync, connect, autoPlan],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
