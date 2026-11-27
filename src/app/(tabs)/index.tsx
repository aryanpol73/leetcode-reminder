import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Glass, GlassButton, GradientButton, GradientNumber, ProgressRing } from '../../components/glass';
import { Button, Card, Check, DifficultyBadge, ProblemRow, Screen, SectionLabel, s } from '../../components/ui';
import { dayKey, greeting } from '../../lib/dates';
import { contestUrl, problemUrl } from '../../lib/leetcode';
import { solvedToday } from '../../lib/notifications';
import type { PlanItem } from '../../lib/types';
import { useStore } from '../../state/store';
import { colors, fonts } from '../../theme';

/** Streak saver window: after this hour with nothing solved, the streak is "at risk". */
const RISK_HOUR = 20;

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function Today() {
  const { state, syncing, syncError, sync, addToPlan, toggleDone, queued } = useStore();
  const now = useNow();
  const today = dayKey(now);
  const todo = state.plan
    .filter((p) => p.status === 'todo' && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));
  const doneToday = state.plan.filter((p) => p.status === 'done' && p.doneAt && dayKey(new Date(p.doneAt)) === today);
  const total = doneToday.length + todo.length;
  const daily = state.daily?.problem;
  const dailyPlanned = daily && state.plan.some((p) => p.slug === daily.slug && p.date === today);
  const solved = solvedToday(state);
  const name = state.profile?.realName?.split(' ')[0] || state.username;
  const nextContest = state.contests.find((c) => c.startTime * 1000 > now.getTime());
  const next = todo[0];
  const rest = todo.slice(1);
  const atRisk = !!state.username && !solved && now.getHours() >= RISK_HOUR;
  const weekday = now.toLocaleDateString([], { weekday: 'long' });

  return (
    <Screen
      subtitle={`${weekday} · ${greeting(now)}${name ? `, ${name}` : ''}`}
      title="Today"
      right={
        <Glass radius={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={solved ? 'checkmark-done' : 'notifications'} size={20} color={solved ? colors.good : colors.accent} />
        </Glass>
      }
      refreshing={syncing}
      onRefresh={sync}
    >
      {/* Streak hero */}
      <Glass style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 6 }}>
          {state.profile ? (
            <GradientNumber value={String(state.profile.streak)} size={62} risk={atRisk} />
          ) : (
            <Text style={{ fontFamily: fonts.heavy, fontSize: 52, color: colors.faint }}>—</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="flame" size={14} color={atRisk ? '#FF3D6E' : '#FF8A3D'} />
            <Text style={{ color: 'rgba(245,243,255,0.8)', fontSize: 12.5 }}>
              {atRisk ? `day streak · ${hoursLeft(now)} left to keep it` : 'day streak'}
            </Text>
          </View>
        </View>
        <ProgressRing progress={total ? doneToday.length / total : 0} size={82} stroke={6}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.text }}>
            {doneToday.length}/{total}
          </Text>
          <Text style={{ fontSize: 9.5, color: colors.muted, marginTop: 1 }}>solved</Text>
        </ProgressRing>
      </Glass>

      {!state.username ? (
        <Card>
          <Text style={s.body}>
            Connect your LeetCode username so LeetPing can track your streak and tick off planned problems the moment you solve them.
          </Text>
          <Button label="Connect LeetCode" onPress={() => router.navigate('/profile')} />
        </Card>
      ) : solved ? (
        <Glass style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', borderColor: 'rgba(44,214,123,0.45)' }}>
          <Ionicons name="shield-checkmark" size={20} color={colors.good} />
          <Text style={[s.body, { flex: 1, fontSize: 14 }]}>Solved today. The streak saver stays quiet tonight.</Text>
        </Glass>
      ) : null}
      {syncError ? (
        <Text style={{ color: colors.danger }}>
          <Ionicons name="warning" size={13} color={colors.danger} /> {syncError}
        </Text>
      ) : null}

      {/* Up next */}
      {next ? (
        <>
          <SectionLabel>{upNextLabel(next, today, now)}</SectionLabel>
          <Glass style={{ padding: 16, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <DifficultyBadge d={next.difficulty} />
              <Text style={s.meta}>
                #{next.frontendId}
                {next.time ? ` · alarm ${next.time}` : ''}
                {next.date < today ? ' · overdue' : ''}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.text, letterSpacing: -0.5 }} numberOfLines={2}>
              {next.title}
            </Text>
            {next.tags?.length ? <Text style={s.meta}>{next.tags.slice(0, 3).join(' · ')}</Text> : null}
            {next.note ? <Text style={[s.meta, { fontStyle: 'italic' }]}>{next.note}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <GradientButton label="Solve now" icon="play" onPress={() => Linking.openURL(problemUrl(next.slug))} style={{ flex: 1 }} />
              <GlassButton label="Done" icon="checkmark" onPress={() => toggleDone(next.id)} />
            </View>
          </Glass>
        </>
      ) : null}

      {/* Plan */}
      <SectionLabel>Your plan for today</SectionLabel>
      <Card style={{ paddingVertical: 6, gap: 0 }}>
        {total === 0 ? (
          <Text style={[s.meta, { paddingVertical: 10 }]}>Nothing planned. Add a problem so your alarms tell you exactly what to solve.</Text>
        ) : null}
        {total > 0 && rest.length === 0 && doneToday.length === 0 ? (
          <Text style={[s.meta, { paddingVertical: 10 }]}>Only the problem above is left for today.</Text>
        ) : null}
        {rest.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <View style={s.divider} /> : null}
            <ProblemRow
              p={p}
              meta={p.date < today ? 'overdue' : p.time ? `alarm ${p.time}` : undefined}
              right={<Check onPress={() => toggleDone(p.id)} />}
            />
          </View>
        ))}
        {doneToday.map((p, i) => (
          <View key={p.id}>
            {rest.length + i > 0 ? <View style={s.divider} /> : null}
            <ProblemRow p={p} done right={<Check done onPress={() => toggleDone(p.id)} />} />
          </View>
        ))}
        <Pressable
          onPress={() => router.push({ pathname: '/add-problem', params: { date: today } })}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="add-circle" size={18} color={colors.accent} />
          <Text style={{ fontFamily: fonts.semibold, color: colors.accent, fontSize: 13.5 }}>Add a problem</Text>
        </Pressable>
      </Card>

      {/* Daily challenge */}
      {daily ? (
        <>
          <SectionLabel>Daily challenge</SectionLabel>
          <Card>
            <ProblemRow p={daily} meta={daily.acRate ? `${daily.acRate.toFixed(0)}% acceptance` : undefined} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button kind="ghost" label="Open on LeetCode" onPress={() => Linking.openURL(problemUrl(daily.slug))} />
              </View>
              {!dailyPlanned ? <Button label="+ Plan" onPress={() => addToPlan(daily, today)} /> : null}
            </View>
          </Card>
        </>
      ) : null}

      {/* Contest */}
      {nextContest ? (
        <Pressable onPress={() => Linking.openURL(contestUrl(nextContest.slug))}>
          <Glass style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,176,32,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trophy" size={20} color="#FFC24D" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 14 }} numberOfLines={1}>
                {nextContest.title}
              </Text>
              <Text style={s.meta}>
                Starts in {countdown(nextContest.startTime, now)} · {state.contestAlarms ? 'alarm 30 min before' : 'contest alarms off'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Glass>
        </Pressable>
      ) : null}

      {/* Recently accepted */}
      {state.profile?.recent.length ? (
        <>
          <SectionLabel>Recently accepted</SectionLabel>
          <Card style={{ gap: 2 }}>
            {state.profile.recent.slice(0, 5).map((r) => (
              <Pressable key={r.id} onPress={() => Linking.openURL(problemUrl(r.slug))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
                <Ionicons name="checkmark-circle" size={15} color={colors.good} />
                <Text style={[s.body, { flex: 1, fontSize: 14 }]} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={s.meta}>{timeAgo(r.timestamp)}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <Pressable onPress={sync} disabled={syncing} style={{ alignItems: 'center', paddingVertical: 6 }}>
        <Text style={[s.meta, { textAlign: 'center' }]}>
          {syncing
            ? 'Syncing with LeetCode…'
            : `${state.lastSync ? `Synced ${new Date(state.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ` : ''}${queued} alarms queued · `}
          {!syncing ? <Text style={{ color: colors.accent, fontWeight: '600' }}>Sync now</Text> : null}
        </Text>
      </Pressable>
    </Screen>
  );
}

function upNextLabel(p: PlanItem, today: string, now: Date) {
  if (p.date < today) return 'Up next · overdue';
  if (!p.time) return 'Up next';
  const [h, m] = p.time.split(':').map(Number);
  const mins = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
  if (mins <= 0) return `Up next · alarm was ${p.time}`;
  return `Up next · alarm in ${mins >= 60 ? `${Math.floor(mins / 60)}h ` : ''}${mins % 60}m`;
}

function hoursLeft(now: Date) {
  const mins = 24 * 60 - (now.getHours() * 60 + now.getMinutes());
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function countdown(startSec: number, now: Date) {
  const mins = Math.max(0, Math.round((startSec * 1000 - now.getTime()) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(sec: number) {
  const m = Math.max(0, Math.round((Date.now() / 1000 - sec) / 60));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
