export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface ProblemRef {
  slug: string;
  frontendId: string;
  title: string;
  difficulty: Difficulty;
  paidOnly?: boolean;
  tags?: string[];
  acRate?: number;
}

export interface PlanItem extends ProblemRef {
  id: string;
  /** Local calendar day the problem is planned for, YYYY-MM-DD */
  date: string;
  /** Optional per-problem alarm, "HH:mm" local time */
  time?: string;
  note?: string;
  status: 'todo' | 'done';
  doneAt?: number;
  addedAt: number;
}

export type ReminderKind = 'nudge' | 'streak';

export interface Reminder {
  id: string;
  label: string;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  enabled: boolean;
  /** streak = "streak saver": skipped for today once you've solved something */
  kind: ReminderKind;
}

export interface RecentAc {
  id: string;
  title: string;
  slug: string;
  timestamp: number; // seconds
}

export interface SkillStat {
  tag: string;
  slug: string;
  solved: number;
  level: 'fundamental' | 'intermediate' | 'advanced';
}

export interface ContestInfo {
  rating: number;
  globalRanking: number;
  attended: number;
  topPercentage?: number;
  badge?: string;
}

export interface Profile {
  username: string;
  realName?: string;
  avatar?: string;
  ranking?: number;
  solved: { all: number; easy: number; medium: number; hard: number };
  totals: { all: number; easy: number; medium: number; hard: number };
  streak: number;
  totalActiveDays: number;
  recent: RecentAc[];
  /** UTC day (YYYY-MM-DD) -> submissions that day, for the heatmap */
  calendar: Record<string, number>;
  badges: { name: string; icon: string }[];
  languages: { name: string; solved: number }[];
  skills: SkillStat[];
  contest?: ContestInfo;
  fetchedAt: number;
}

export interface DailyChallenge {
  date: string;
  problem: ProblemRef;
}

export interface Contest {
  title: string;
  slug: string;
  startTime: number; // seconds
  duration: number; // seconds
}

export interface AppState {
  username?: string;
  profile?: Profile;
  daily?: DailyChallenge;
  contests: Contest[];
  plan: PlanItem[];
  reminders: Reminder[];
  /** Use Android exact "alarm clock" delivery when permitted */
  alarmMode: boolean;
  /** Alarm 30 minutes before each upcoming LeetCode contest */
  contestAlarms: boolean;
  /** REST fallback (alfa-leetcode-api compatible) used when LeetCode GraphQL is unreachable */
  fallbackApi: string;
  lastSync?: number;
}
