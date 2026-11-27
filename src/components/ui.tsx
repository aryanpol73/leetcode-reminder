import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatTime } from '../lib/dates';
import { problemUrl } from '../lib/leetcode';
import type { Difficulty, ProblemRef } from '../lib/types';
import { colors, diffColor, fonts, gradients } from '../theme';
import { Glass, haptic, usePressScale } from './glass';

/** Space kept clear at the bottom of tab screens for the floating tab bar. */
export const TAB_BAR_CLEARANCE = 120;

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
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_CLEARANCE, gap: 14 }}
        showsVerticalScrollIndicator={false}
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
  return <Glass style={[s.card, style]}>{children}</Glass>;
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
  const fg = kind === 'primary' ? colors.accentInk : kind === 'danger' ? colors.danger : colors.text;
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);
  const content = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <Text style={[s.btnText, { color: fg }, small && { fontSize: 13 }]}>{label}</Text>
  );
  const pad = small ? { paddingVertical: 8, paddingHorizontal: 12 } : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {kind === 'primary' ? (
          <LinearGradient
            colors={gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.btn, pad, { boxShadow: '0 8px 22px -10px rgba(255,122,80,0.85)' }]}
          >
            {content}
          </LinearGradient>
        ) : kind === 'danger' ? (
          <View style={[s.btn, pad, { backgroundColor: 'rgba(255,94,98,0.14)', borderWidth: 1, borderColor: 'rgba(255,94,98,0.35)' }]}>{content}</View>
        ) : (
          <Glass radius={14} style={[s.btn, pad]}>
            {content}
          </Glass>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={[s.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent, boxShadow: '0 0 16px -4px rgba(255,176,32,0.7)' }]}
    >
      <Text style={[s.chipText, active && { color: colors.accentInk }]}>{label}</Text>
    </Pressable>
  );
}

export function DifficultyBadge({ d }: { d: Difficulty }) {
  return (
    <Text style={[s.badge, { color: diffColor[d], backgroundColor: diffColor[d] + '26', borderColor: diffColor[d] + '60' }]}>{d}</Text>
  );
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
  const scale = useState(() => new Animated.Value(1))[0];
  const pop = () => {
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 18, bounciness: 14 }).start();
  };
  return (
    <Pressable
      onPress={() => {
        if (done) haptic.tap();
        else haptic.success();
        pop();
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!done }}
      accessibilityLabel={done ? 'Mark as not solved' : 'Mark as solved'}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {done ? (
          <LinearGradient
            colors={gradients.good}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.check, { borderWidth: 0, boxShadow: '0 0 14px -2px rgba(44,214,123,0.7)' }]}
          >
            <Ionicons name="checkmark" size={17} color="#04130B" />
          </LinearGradient>
        ) : (
          <View style={s.check} />
        )}
      </Animated.View>
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
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.bold, letterSpacing: -0.9 },
  subtitle: { color: colors.muted, fontSize: 13, marginBottom: 2 },
  section: { color: 'rgba(245,243,255,0.55)', fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 6, marginLeft: 2 },
  card: { padding: 16, gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.bold, fontSize: 14.5 },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.38)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 15 },
  input: { backgroundColor: colors.cardHi, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.cardHi, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: colors.text, fontSize: 20, fontWeight: '700' },
  stepVal: { color: colors.text, fontSize: 20, fontWeight: '700', width: 38, textAlign: 'center', fontVariant: ['tabular-nums'] },
  bigTime: { color: colors.accent, fontSize: 44, fontFamily: fonts.light, letterSpacing: -2, textAlign: 'center', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
});
