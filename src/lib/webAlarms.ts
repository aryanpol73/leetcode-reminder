/**
 * PWA alarms, two layers:
 *  1. Web Push (server): the queue is uploaded to /api/push and the server pushes each alarm when
 *     it is due, so it rings even when LeetPing is closed. Needs the push backend configured.
 *  2. In-page timers: ring on time while the app is open or backgrounded, and catch up on alarms
 *     missed in the last 30 minutes. Same notification `tag` as the push, so you never get two.
 */
import type { PlannedAlarm } from './schedule';

const timers: ReturnType<typeof setTimeout>[] = [];
const FIRED_KEY = 'leetping:web-fired';
const CATCH_UP_MS = 30 * 60_000;
const MAX_TIMEOUT = 2_147_000_000; // setTimeout limit (~24.8 days)

export type PushStatus = 'unsupported' | 'unconfigured' | 'off' | 'on' | 'error';
let pushStatus: PushStatus = 'off';
export const getPushStatus = () => pushStatus;

const hasNotifications = () => typeof window !== 'undefined' && 'Notification' in window;

export function webPermission(): boolean {
  return hasNotifications() && Notification.permission === 'granted';
}

export async function requestWebPermission(): Promise<boolean> {
  if (!hasNotifications()) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export const alarmTag = (a: Pick<PlannedAlarm, 'at' | 'title'>) => `${a.at.getTime()}|${a.title}`.slice(0, 120);
const alarmUrl = (data: Record<string, string | null>) =>
  data.url ?? (data.slug ? `https://leetcode.com/problems/${data.slug}/` : '/');

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  } catch {
    return undefined;
  }
}

async function show(title: string, body: string, data: Record<string, string | null>, tag?: string) {
  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag,
    renotify: !!tag,
    requireInteraction: true,
    vibrate: [400, 200, 400, 200, 400],
    data: { url: alarmUrl(data) },
    actions: [
      { action: 'solve', title: 'Solve now' },
      { action: 'snooze', title: 'Snooze 10 min' },
    ],
  } as NotificationOptions;
  const reg = await registration();
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, { body, icon: options.icon });
}

function firedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function markFired(id: string) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...firedSet(), id].slice(-200)));
  } catch {}
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Subscribe this browser to Web Push and upload the alarm queue. */
async function syncPush(queue: PlannedAlarm[]) {
  const reg = await registration();
  if (!reg || !('PushManager' in window)) {
    pushStatus = 'unsupported';
    return;
  }
  try {
    const cfg = await fetch('/api/push').then((r) => (r.ok ? r.json() : null));
    if (!cfg?.enabled || !cfg.publicKey) {
      pushStatus = 'unconfigured';
      return;
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) });
    }
    const alarms = queue.map((a) => ({ at: a.at.getTime(), title: a.title, body: a.body, url: alarmUrl(a.data), tag: alarmTag(a) }));
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), alarms }),
    });
    pushStatus = res.ok ? 'on' : 'error';
  } catch {
    pushStatus = 'error';
  }
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleWeb(queue: PlannedAlarm[], recentlyDue: PlannedAlarm[] = []): number {
  timers.splice(0).forEach(clearTimeout);
  if (!webPermission()) return 0;
  const fired = firedSet();
  const now = Date.now();

  for (const a of recentlyDue) {
    const tag = alarmTag(a);
    if (now - a.at.getTime() <= CATCH_UP_MS && !fired.has(tag)) {
      markFired(tag);
      show(a.title, `${a.body} (missed at ${a.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`, a.data, tag);
    }
  }
  for (const a of queue) {
    const delay = a.at.getTime() - now;
    if (delay <= 0 || delay > MAX_TIMEOUT) continue;
    timers.push(
      setTimeout(() => {
        const tag = alarmTag(a);
        if (firedSet().has(tag)) return;
        markFired(tag);
        show(a.title, a.body, a.data, tag);
      }, delay),
    );
  }
  // Debounce uploads; edits often come in bursts.
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncPush(queue), 800);
  return queue.length;
}

export function testWebAlarm(seconds: number) {
  timers.push(
    setTimeout(
      () => show('⏰ LeetPing test alarm', 'This is what your reminders look like. Tap to open LeetPing.', { url: '/' }, `test-${Date.now()}`),
      seconds * 1000,
    ),
  );
}
