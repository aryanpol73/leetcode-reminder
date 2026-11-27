import type { Difficulty } from './lib/types';

// "Aurora Glass": frosted glass cards over drifting indigo → violet → coral → amber light,
// matching the logo (indigo night with an amber→coral bell).
export const colors = {
  bg: '#0B0820',
  /** Opaque surface for native headers and modal backgrounds. */
  card: '#16112E',
  /** Translucent fill for inputs, chips, steppers and tracks sitting on glass. */
  cardHi: 'rgba(255,255,255,0.09)',
  border: 'rgba(255,255,255,0.14)',
  text: '#F5F3FF',
  muted: '#A7A1C2',
  faint: '#6B6489',
  accent: '#FFB020',
  accent2: '#FF5E62',
  violet: '#7C3AED',
  accentInk: '#1A1200',
  good: '#2CD67B',
  danger: '#FF5E62',
};

export const aurora = {
  violet: '#7C3AED',
  coral: '#FF5E62',
  amber: '#FFB020',
};

export const glass = {
  /** Top-left → bottom-right sheen layered over the blur. */
  fill: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.045)'] as const,
  border: 'rgba(255,255,255,0.16)',
  highlight: 'rgba(255,255,255,0.30)',
  blur: 30,
};

export const gradients = {
  streak: ['#FFDF92', '#FFB020', '#FF5E62'] as const,
  cta: ['#FFC24D', '#FF7A50'] as const,
  good: ['#2CD67B', '#00C2A8'] as const,
  risk: ['#FF7A50', '#FF3D6E'] as const,
};

/** Sora faces (loaded in the root layout). Use fontFamily alone, without fontWeight. */
export const fonts = {
  regular: 'Sora_400Regular',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  heavy: 'Sora_800ExtraBold',
  light: 'Sora_300Light',
};

export const diffColor: Record<Difficulty, string> = {
  Easy: '#00C2A8',
  Medium: '#FFB020',
  Hard: '#FF4D7A',
};

export const radius = 22;

/** Floating tab bar geometry, shared by the tab layout and screen bottom padding. */
export const tabBar = {
  height: 66,
  /** Gap between the bar and the bottom safe-area edge. */
  gap: 10,
  radius: 32,
};
