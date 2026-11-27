import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { PracticeAlarm } from './alarmMessages';

export interface ScheduledScreenAlarm extends PracticeAlarm {
  id: string;
  at: number;
}

interface ScreenAlarmModule {
  permissions(): { fullScreen: boolean; overlay: boolean };
  openSettings(permission: 'fullScreen' | 'overlay'): void;
  setSchedule(schedule: string, visualOn: boolean, showOverApps: boolean, exact: boolean): Promise<number>;
  addAlarm(alarm: string): Promise<void>;
  getAlarm(id: string): string | null;
  finish(id: string, snooze: boolean): Promise<void>;
  releaseWindow(id: string): void;
}

export const screenAlarm = Platform.OS === 'android'
  ? requireOptionalNativeModule<ScreenAlarmModule>('LeetPingScreenAlarm')
  : null;

export async function addScreenAlarm(alarm: PracticeAlarm, at: number, id: string) {
  await screenAlarm?.addAlarm(JSON.stringify({ ...alarm, at, id }));
}
