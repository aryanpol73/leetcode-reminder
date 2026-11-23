import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button, Card, Check, ProblemRow, Screen, SectionLabel, s } from '../../components/ui';
import { dayKey, greeting } from '../../lib/dates';
import { contestUrl, problemUrl } from '../../lib/leetcode';
import { solvedToday } from '../../lib/notifications';
import { useStore } from '../../state/store';
import { colors } from '../../theme';

export default function Today() {
  const { state, syncing, syncError, sync, addToPlan, toggleDone, queued } = useStore();
  const today = dayKey();
  const todo = state.plan
    .filter((p) => p.status === 'todo' && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));
  const doneToday = state.plan.filter((p) => p.status === 'done' && p.doneAt && dayKey(new Date(p.doneAt)) === today);
  const daily = state.daily?.problem;
  const dailyPlanned = daily && state.plan.some((p) => p.slug === daily.slug && p.date === today);
  const solved = solvedToday(state);
  const name = state.profile?.realName?.split(' ')[0] || state.username;
  const nextContest = state.contests.find((c) => c.startTime * 1000 > Date.now());

  return (
    <Screen
      subtitle={`${greeting()}${name ? `, ${name}` : ''}`}
      title="LeetPing"
      right={<Text style={{ fontSize: 28 }}>{solved ? '✅' : '🔔'}</Text>}
      refreshing={syncing}
      onRefresh={sync}
    >
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Stat value={state.profile ? `${state.profile.streak}🔥` : '—'} label="day streak" />
        <Stat value={`${doneToday.length}/${doneToday.length + todo.length}`} label="plan today" />
        <Stat value={String(queued)} label="alarms queued" />
      </Card>

      {!state.username ? (
        <Card>
          <Text style={s.body}>
            Connect your LeetCode username so LeetPing can track your streak and tick off planned problems the moment you solve them.
          </Text>
          <Button label="Connect LeetCode" onPress={() => router.navigate('/profile')} />
        </Card>
      ) : solved ? (
        <Card style={{ borderColor: colors.good }}>
          <Text style={[s.body, { fontWeight: '700' }]}>Solved today. The streak saver alarm is off for tonight. 🎉</Text>
        </Card>
      ) : null}
      {syncError ? <Text style={{ color: colors.danger }}>⚠ {syncError}</Text> : null}

      {daily ? (
        <>
          <SectionLabel>Daily challenge</SectionLabel>
          <Card>
            <ProblemRow p={daily} meta={daily.acRate ? `${daily.acRate.toFixed(0)}% acceptance` : undefined} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label="Solve on LeetCode" onPress={() => Linking.openURL(problemUrl(daily.slug))} />
              </View>
              {!dailyPlanned ? <Button kind="ghost" label="+ Plan" onPress={() => addToPlan(daily, today)} /> : null}
            </View>
          </Card>
        </>
      ) : null}

      <SectionLabel>Your plan for today</SectionLabel>
      <Card>
        {todo.length === 0 && doneToday.length === 0 ? (
          <Text style={s.meta}>Nothing planned. Add a problem so your alarms tell you exactly what to solve.</Text>
        ) : null}
        {todo.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <View style={s.divider} /> : null}
            <ProblemRow
              p={p}
              meta={p.date < today ? '⚠ overdue' : p.time ? `⏰ ${p.time}` : undefined}
              right={<Check onPress={() => toggleDone(p.id)} />}
            />
          </View>
        ))}
        {doneToday.map((p, i) => (
          <View key={p.id}>
            {todo.length + i > 0 ? <View style={s.divider} /> : null}
            <ProblemRow p={p} done right={<Check done onPress={() => toggleDone(p.id)} />} />
          </View>
        ))}
        <Button kind="ghost" label="+ Add a problem" onPress={() => router.push({ pathname: '/add-problem', params: { date: today } })} />
      </Card>

      {nextContest ? (
        <>
          <SectionLabel>Next contest</SectionLabel>
          <Pressable onPress={() => Linking.openURL(contestUrl(nextContest.slug))}>
            <Card>
              <Text style={[s.body, { fontWeight: '700' }]}>🏆 {nextContest.title}</Text>
              <Text style={s.meta}>
                {new Date(nextContest.startTime * 1000).toLocaleString([], {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                · {countdown(nextContest.startTime)} · {state.contestAlarms ? 'alarm set 30 min before' : 'contest alarms off'}
              </Text>
            </Card>
          </Pressable>
        </>
      ) : null}

      {state.profile?.recent.length ? (
        <>
          <SectionLabel>Recently accepted</SectionLabel>
          <Card>
            {state.profile.recent.slice(0, 5).map((r) => (
              <Pressable key={r.id} onPress={() => Linking.openURL(problemUrl(r.slug))}>
                <Text style={[s.body, { paddingVertical: 4 }]} numberOfLines={1}>
                  <Text style={{ color: colors.good }}>✓ </Text>
                  {r.title} <Text style={s.meta}>· {timeAgo(r.timestamp)}</Text>
                </Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <Button kind="ghost" label={syncing ? 'Syncing…' : 'Sync with LeetCode'} onPress={sync} loading={syncing} />
      {state.lastSync ? (
        <Text style={[s.meta, { textAlign: 'center' }]}>Last synced {new Date(state.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={s.meta}>{label}</Text>
    </View>
  );
}

function timeAgo(sec: number) {
  const m = Math.max(0, Math.round((Date.now() / 1000 - sec) / 60));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function countdown(startSec: number) {
  const mins = Math.round((startSec * 1000 - Date.now()) / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `in ${h}h ${mins % 60}m`;
  return `in ${Math.round(h / 24)} days`;
}
