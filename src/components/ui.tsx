import React from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatTime } from '../lib/dates';
import { problemUrl } from '../lib/leetcode';
import type { Difficulty, ProblemRef } from '../lib/types';
import { colors, diffColor, radius } from '../theme';

export function Screen({
  title,
  subtitle,
  children,
  right,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
            <Text style={s.title}>{title}</Text>
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const bg = kind === 'primary' ? colors.accent : kind === 'danger' ? '#3A1820' : colors.cardHi;
  const fg = kind === 'primary' ? colors.accentInk : kind === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }, small && { fontSize: 13 }]}>{label}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      <Text style={[s.chipText, active && { color: colors.accentInk }]}>{label}</Text>
    </Pressable>
  );
}

export function DifficultyBadge({ d }: { d: Difficulty }) {
  return <Text style={[s.badge, { color: diffColor[d], backgroundColor: diffColor[d] + '22' }]}>{d}</Text>;
}

export function ProblemRow({
  p,
  right,
  onPress,
  done,
  meta,
}: {
  p: ProblemRef;
  right?: React.ReactNode;
  onPress?: () => void;
  done?: boolean;
  meta?: string;
}) {
  return (
    <Pressable onPress={onPress ?? (() => Linking.openURL(problemUrl(p.slug)))} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[s.rowTitle, done && { textDecorationLine: 'line-through', color: colors.muted }]} numberOfLines={2}>
          {p.frontendId}. {p.title} {p.paidOnly ? '🔒' : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <DifficultyBadge d={p.difficulty} />
          {meta ? <Text style={s.meta}>{meta}</Text> : null}
          {p.tags?.slice(0, 2).map((t) => (
            <Text key={t} style={s.meta}>
              #{t}
            </Text>
          ))}
        </View>
      </View>
      {right}
    </Pressable>
  );
}

export function Stepper({ value, onChange, min, max, step = 1, format }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; format?: (n: number) => string }) {
  const wrap = (n: number) => (n > max ? min : n < min ? max - ((max - min) % step) : n);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Pressable style={s.stepBtn} onPress={() => onChange(wrap(value - step))}>
        <Text style={s.stepTxt}>−</Text>
      </Pressable>
      <Text style={s.stepVal}>{format ? format(value) : String(value).padStart(2, '0')}</Text>
      <Pressable style={s.stepBtn} onPress={() => onChange(wrap(value + step))}>
        <Text style={s.stepTxt}>+</Text>
      </Pressable>
    </View>
  );
}

export function TimePicker({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.bigTime}>{formatTime(hour, minute)}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={s.meta}>Hour</Text>
          <Stepper value={hour} min={0} max={23} onChange={(h) => onChange(h, minute)} />
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={s.meta}>Minute</Text>
          <Stepper value={minute} min={0} max={55} step={5} onChange={(m) => onChange(hour, m)} />
        </View>
      </View>
    </View>
  );
}

export function Check({ done, onPress }: { done?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!done }}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: done ? colors.good : colors.faint,
        backgroundColor: done ? colors.good : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text> : null}
    </Pressable>
  );
}

export function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[s.body, { color, fontWeight: '700' }]}>{label}</Text>
        <Text style={s.meta}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
          {total ? ` / ${total}` : ''}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.cardHi, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

/** GitHub-style submission heatmap for the last `weeks` weeks (UTC days, like LeetCode). */
export function Heatmap({ calendar, weeks = 18 }: { calendar: Record<string, number>; weeks?: number }) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const endDow = new Date(todayUtc).getUTCDay();
  const start = todayUtc - ((weeks - 1) * 7 + endDow) * 86_400_000;
  const cols: { key: string; n: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const t = start + (w * 7 + d) * 86_400_000;
      const key = new Date(t).toISOString().slice(0, 10);
      col.push({ key, n: calendar[key] ?? 0, future: t > todayUtc });
    }
    cols.push(col);
  }
  const shade = (n: number) =>
    n === 0 ? colors.cardHi : n < 2 ? '#0E4429' : n < 4 ? '#006D32' : n < 7 ? '#26A641' : '#39D353';
  const active = Object.entries(calendar).filter(([k, n]) => n > 0 && Date.parse(k) >= start).length;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 3, justifyContent: 'center' }}>
        {cols.map((col, i) => (
          <View key={i} style={{ gap: 3 }}>
            {col.map((c) => (
              <View
                key={c.key}
                style={{ width: 13, height: 13, borderRadius: 3, backgroundColor: c.future ? 'transparent' : shade(c.n) }}
              />
            ))}
          </View>
        ))}
      </View>
      <Text style={[s.meta, { textAlign: 'center' }]}>
        {active} active days in the last {weeks} weeks
      </Text>
    </View>
  );
}

export const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 2 },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 15 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 15 },
  input: { backgroundColor: colors.cardHi, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.cardHi, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: colors.text, fontSize: 20, fontWeight: '700' },
  stepVal: { color: colors.text, fontSize: 20, fontWeight: '700', width: 38, textAlign: 'center', fontVariant: ['tabular-nums'] },
  bigTime: { color: colors.accent, fontSize: 40, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.border },
});
