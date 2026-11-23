import type { Difficulty } from './lib/types';

export const colors = {
  bg: '#0E0E11',
  card: '#18181D',
  cardHi: '#212128',
  border: '#2A2A33',
  text: '#F4F4F6',
  muted: '#9A9AA6',
  faint: '#5E5E6A',
  accent: '#FFA116',
  accentInk: '#1A1200',
  good: '#2CBB5D',
  danger: '#FF4D6A',
};

export const diffColor: Record<Difficulty, string> = {
  Easy: '#00B8A3',
  Medium: '#FFC01E',
  Hard: '#FF375F',
};

export const radius = 16;
