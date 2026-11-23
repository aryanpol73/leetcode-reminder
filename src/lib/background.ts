/**
 * Background sync: every ~30 minutes (OS permitting), checks LeetCode for new accepted submissions,
 * ticks off planned problems and re-plans alarms, so the streak saver goes quiet after you've solved
 * one on the LeetCode app, even if LeetPing was never opened.
 *
 * Must be imported at module scope (it is, from src/app/_layout.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { fetchDaily, fetchProfile, setFallbackApi } from './leetcode';
import { rescheduleAll } from './notifications';
import { autoComplete } from './schedule';
import type { AppState } from './types';

export const BG_TASK = 'leetping-background-sync';
export const STORAGE_KEY = 'leetping:state:v1';

export { autoComplete };

if (Platform.OS !== 'web') {
  TaskManager.defineTask(BG_TASK, async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return BackgroundTask.BackgroundTaskResult.Success;
      const state = JSON.parse(raw) as AppState;
      if (state.fallbackApi) setFallbackApi(state.fallbackApi);
      const [profile, daily] = await Promise.all([
        state.username ? fetchProfile(state.username).catch(() => undefined) : Promise.resolve(undefined),
        fetchDaily().catch(() => undefined),
      ]);
      const next: AppState = {
        ...state,
        profile: profile ?? state.profile,
        daily: daily ?? state.daily,
        plan: profile ? autoComplete(state.plan, profile.recent) : state.plan,
        lastSync: profile ? Date.now() : state.lastSync,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      await rescheduleAll(next);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSync() {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(BG_TASK))) {
      await BackgroundTask.registerTaskAsync(BG_TASK, { minimumInterval: 30 });
    }
  } catch {
    // Not available (e.g. some Expo Go builds); foreground sync still works.
  }
}
