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
  upsertReminder: (r: Omit<Reminder, 'id'> & { id?: string }) => void;
  removeReminder: (id: string) => void;
  setSetting: <K extends 'alarmMode' | 'contestAlarms' | 'fallbackApi'>(k: K, v: AppState[K]) => void;
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
    const p = val(profile);
    setState((s) => ({
      ...s,
      daily: val(daily) ?? s.daily,
      contests: val(contests) ?? s.contests,
      profile: p ?? s.profile,
      plan: p ? autoComplete(s.plan, p.recent) : s.plan,
      lastSync: failed ? s.lastSync : Date.now(),
    }));
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
    const need = o.perDay * o.days;
    const { problems } = await listProblems({ tags: [o.tagSlug], difficulty: o.difficulty, limit: Math.min(100, need * 4 + 20) });
    const s = stateRef.current;
    const taken = new Set([...s.plan.map((p) => p.slug), ...(s.profile?.recent ?? []).map((r) => r.slug)]);
    // Easiest (highest acceptance) first, so the week ramps up naturally.
    const picks = problems
      .filter((p) => !p.paidOnly && !taken.has(p.slug))
      .sort((a, b) => (b.acRate ?? 0) - (a.acRate ?? 0))
      .slice(0, need);
    const now = Date.now();
    const items: PlanItem[] = picks.map((p, i) => ({
      ...p,
      id: uid(),
      date: dayKey(addDays(new Date(), Math.floor(i / o.perDay))),
      time: o.time,
      status: 'todo',
      addedAt: now,
    }));
    setState((st) => ({ ...st, plan: [...st.plan, ...items] }));
    return items.length;
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
      disconnect: () => setState((s) => ({ ...s, username: undefined, profile: undefined })),
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
      clearPlan: () => setState((s) => ({ ...s, plan: [] })),
      clearDone: () => setState((s) => ({ ...s, plan: s.plan.filter((x) => x.status !== 'done') })),
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
