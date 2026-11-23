import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Check, Chip, ProblemRow, Screen, SectionLabel, Stepper, s } from '../../components/ui';
import { addDays, dayKey, friendlyDay } from '../../lib/dates';
import { POPULAR_TAGS } from '../../lib/leetcode';
import type { Difficulty, PlanItem } from '../../lib/types';
import { useStore } from '../../state/store';
import { colors } from '../../theme';

export default function Plan() {
  const { state, toggleDone, removePlan, updatePlan, clearDone, autoPlan } = useStore();
  const [showAuto, setShowAuto] = useState(false);
  const today = dayKey();

  const groups = useMemo(() => {
    const todo = state.plan.filter((p) => p.status === 'todo');
    const map = new Map<string, PlanItem[]>();
    const overdue = todo.filter((p) => p.date < today);
    if (overdue.length) map.set('Overdue', overdue);
    for (const p of todo.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))) {
      const label = friendlyDay(p.date);
      map.set(label, [...(map.get(label) ?? []), p]);
    }
    return [...map.entries()];
  }, [state.plan, today]);
  const done = state.plan.filter((p) => p.status === 'done').sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  const itemActions = (p: PlanItem) =>
    Alert.alert(`${p.frontendId}. ${p.title}`, undefined, [
      { text: 'Move to today', onPress: () => updatePlan(p.id, { date: today }) },
      { text: 'Push to tomorrow', onPress: () => updatePlan(p.id, { date: dayKey(addDays(new Date(), 1)) }) },
      { text: 'Remove', style: 'destructive', onPress: () => removePlan(p.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <Screen title="Plan" subtitle={`${state.plan.filter((p) => p.status === 'todo').length} to solve · ${done.length} done`}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button label="+ Add problem" onPress={() => router.push('/add-problem')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="ghost" label={showAuto ? 'Close auto-plan' : '✨ Auto-plan'} onPress={() => setShowAuto((v) => !v)} />
        </View>
      </View>

      {showAuto ? <AutoPlanner onDone={() => setShowAuto(false)} autoPlan={autoPlan} weak={weakTopics(state.profile?.skills)} /> : null}

      {groups.length === 0 && !showAuto ? (
        <Card>
          <Text style={s.body}>Your plan is empty.</Text>
          <Text style={s.meta}>
            Add problems by number, name or link, or let Auto-plan fill your week from a topic. Your alarms will name the exact problem to solve.
          </Text>
        </Card>
      ) : null}

      {groups.map(([label, items]) => (
        <View key={label} style={{ gap: 8 }}>
          <SectionLabel>
            {label} <Text style={{ color: label === 'Overdue' ? colors.danger : colors.faint }}>· {items.length}</Text>
          </SectionLabel>
          <Card>
            {items.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <View style={s.divider} /> : null}
                <ProblemRow
                  p={p}
                  meta={[p.time ? `⏰ ${p.time}` : '', p.note ?? ''].filter(Boolean).join(' · ') || undefined}
                  right={
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                      <Text onPress={() => itemActions(p)} style={{ color: colors.muted, fontSize: 20, paddingHorizontal: 4 }}>
                        ⋯
                      </Text>
                      <Check onPress={() => toggleDone(p.id)} />
                    </View>
                  }
                />
              </View>
            ))}
          </Card>
        </View>
      ))}

      {done.length ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>Done · {done.length}</SectionLabel>
            <Text style={[s.meta, { color: colors.accent }]} onPress={clearDone}>
              Clear
            </Text>
          </View>
          <Card>
            {done.slice(0, 15).map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <View style={s.divider} /> : null}
                <ProblemRow p={p} done meta={p.doneAt ? friendlyDay(dayKey(new Date(p.doneAt))) : undefined} right={<Check done onPress={() => toggleDone(p.id)} />} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

function weakTopics(skills?: { tag: string; slug: string; solved: number; level: string }[]) {
  if (!skills?.length) return [];
  // Topics from the popular list you've solved the fewest problems in.
  const bySlug = new Map(skills.map((x) => [x.slug, x.solved]));
  return [...POPULAR_TAGS].sort((a, b) => (bySlug.get(a.slug) ?? 0) - (bySlug.get(b.slug) ?? 0)).slice(0, 3).map((t) => t.slug);
}

function AutoPlanner({
  onDone,
  autoPlan,
  weak,
}: {
  onDone: () => void;
  autoPlan: ReturnType<typeof useStore>['autoPlan'];
  weak: string[];
}) {
  const [tag, setTag] = useState(weak[0] ?? 'array');
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>('Easy');
  const [perDay, setPerDay] = useState(1);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      const n = await autoPlan({ tagSlug: tag, difficulty, perDay, days });
      Alert.alert(n ? `Planned ${n} problems` : 'Nothing new found', n ? 'Your alarms now name each day’s problem.' : 'Try another topic or difficulty.');
      if (n) onDone();
    } catch (e: any) {
      Alert.alert('Could not reach LeetCode', e?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ borderColor: colors.accent }}>
      <Text style={[s.body, { fontWeight: '700' }]}>✨ Auto-plan from a topic</Text>
      <Text style={s.meta}>Picks unsolved, free problems (easiest first) and spreads them over the coming days.</Text>
      {weak.length ? <Text style={s.meta}>Suggested from your weakest topics: {weak.map((w) => POPULAR_TAGS.find((t) => t.slug === w)?.name).join(', ')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {POPULAR_TAGS.map((t) => (
          <Chip key={t.slug} label={(weak.includes(t.slug) ? '★ ' : '') + t.name} active={tag === t.slug} onPress={() => setTag(t.slug)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => (
          <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? undefined : d)} />
        ))}
        <Chip label="Any" active={!difficulty} onPress={() => setDifficulty(undefined)} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={s.body}>Problems per day</Text>
        <Stepper value={perDay} min={1} max={5} onChange={setPerDay} format={String} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={[s.body, { flex: 1 }]}>For</Text>
        {[3, 5, 7, 14].map((d) => (
          <Chip key={d} label={`${d} days`} active={days === d} onPress={() => setDays(d)} />
        ))}
      </View>
      <Button label={`Plan ${perDay * days} problems`} onPress={go} loading={busy} />
    </Card>
  );
}
