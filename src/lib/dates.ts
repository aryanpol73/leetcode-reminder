const pad = (n: number) => String(n).padStart(2, '0');

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local calendar day as YYYY-MM-DD */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function diffDays(key: string, from: Date = new Date()): number {
  const a = parseDayKey(key).getTime();
  const b = parseDayKey(dayKey(from)).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function friendlyDay(key: string): string {
  const n = diffDays(key);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const d = parseDayKey(key);
  const label = `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  return n < 0 ? `${label} (overdue)` : label;
}

export function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: h, minute: m };
}

export const toHHmm = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
