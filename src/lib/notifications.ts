import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { buildQueue } from './schedule';
import type { AppState } from './types';
import { requestWebPermission, scheduleWeb, testWebAlarm, webPermission } from './webAlarms';

const isWeb = Platform.OS === 'web';

export { solvedToday } from './schedule';

export const CHANNEL_ID = 'leetping-alarms';
export const CATEGORY_ID = 'leetping_reminder';
export const ACTION_SOLVE = 'solve_now';
export const ACTION_SNOOZE = 'snooze_10';

/** Native notification APIs (iOS/Android). On web the PWA path in webAlarms.ts is used. */
export const isSupported = Platform.OS !== 'web';

export function configureForeground() {
  if (!isSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Channel + action buttons. Must run before asking for permission on Android 13+. */
export async function setupChannelsAndActions() {
  if (!isSupported) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'LeetCode alarms',
      description: 'Loud reminders to solve your planned LeetCode problems',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 800, 400, 800, 400, 800],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#FFA116',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_SOLVE, buttonTitle: 'Solve now', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 10 min', options: { opensAppToForeground: false } },
  ]);
}

export interface PermissionInfo {
  notifications: boolean;
  exactAlarms: boolean;
}

export async function getPermissionInfo(): Promise<PermissionInfo> {
  if (isWeb) return { notifications: webPermission(), exactAlarms: true };
  const n = await Notifications.getPermissionsAsync();
  const granted =
    n.granted || n.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  let exact = true;
  if (Platform.OS === 'android') {
    exact = (await Notifications.getExactAlarmPermissionsAsync()).granted;
  }
  return { notifications: granted, exactAlarms: exact };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isWeb) return requestWebPermission();
  await setupChannelsAndActions();
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return res.granted;
}

export async function requestExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

let rescheduling: Promise<number> | null = null;

/** Cancels everything we queued and queues the fresh plan. Returns how many alarms are queued. */
export function rescheduleAll(state: AppState): Promise<number> {
  if (isWeb) {
    const now = new Date();
    const recent = buildQueue(state, new Date(now.getTime() - 30 * 60_000)).filter((a) => a.at <= now);
    return Promise.resolve(scheduleWeb(buildQueue(state, now), recent));
  }
  const run = async () => {
    const perms = await getPermissionInfo();
    if (!perms.notifications) return 0;
    await setupChannelsAndActions();
    await Notifications.cancelAllScheduledNotificationsAsync();
    const queue = buildQueue(state);
    const delivery = state.alarmMode && perms.exactAlarms ? 'alarmClock' : 'bestEffort';
    for (const item of queue) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: item.data,
          sound: 'default',
          categoryIdentifier: CATEGORY_ID,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.at,
          channelId: CHANNEL_ID,
          delivery,
        },
      });
    }
    return queue.length;
  };
  // Serialise calls so two quick edits can't interleave cancel/schedule.
  rescheduling = (rescheduling ?? Promise.resolve(0)).catch(() => 0).then(run);
  return rescheduling;
}

export async function snooze(content: Notifications.NotificationContent, minutes = 10) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title ?? 'LeetCode time',
      body: content.body ?? undefined,
      data: content.data,
      sound: 'default',
      categoryIdentifier: CATEGORY_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      channelId: CHANNEL_ID,
    },
  });
}

export async function sendTestAlarm(seconds = 5) {
  if (isWeb) return testWebAlarm(seconds);
  await setupChannelsAndActions();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ LeetPing test alarm',
      body: 'This is what your reminders look like. Tap “Solve now” to jump into LeetCode.',
      sound: 'default',
      categoryIdentifier: CATEGORY_ID,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { slug: null },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: CHANNEL_ID,
    },
  });
}
