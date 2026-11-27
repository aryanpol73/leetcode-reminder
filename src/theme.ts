import type { Difficulty } from './lib/types';

// Palette matches the logo: indigo night → violet, with an amber→coral bell.
export const colors = {
  bg: '#0F0C1D',
  card: '#1A1530',
  cardHi: '#262040',
  border: '#332B55',
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

export const diffColor: Record<Difficulty, string> = {
  Easy: '#00C2A8',
  Medium: '#FFB020',
  Hard: '#FF4D7A',
};

export const radius = 18;
