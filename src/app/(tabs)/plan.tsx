import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Check, Chip, ProblemRow, Screen, SectionLabel, Stepper, s } from '../../components/ui';
import { confirmAction } from '../../lib/confirm';
import { addDays, dayKey, friendlyDay } from '../../lib/dates';
import { POPULAR_TAGS } from '../../lib/leetcode';
import { knownSolved } from '../../lib/planning';
import type { Difficulty, PlanItem } from '../../lib/types';
import { useStore } from '../../state/store';
import { colors } from '../../theme';

export default function Plan() {
  const { state, toggleDone, markPreviouslySolved, removePlan, removeMany, clearPlan, updatePlan, clearDone, autoPlan } = useStore();
  const [showAuto, setShowAuto] = useState(false);
  const [autoResult, setAutoResult] = useState<string>();
  const solved = knownSolved(state);
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

  const [openId, setOpenId] = useState<string>();
  const todoCount = state.plan.filter((p) => p.status === 'todo').length;
  const tomorrow = dayKey(addDays(new Date(), 1));

  const clearGroup = async (label: string, items: PlanItem[]) => {
    const ok = await confirmAction(`Clear ${label.toLowerCase()}?`, `Removes ${items.length} problem${items.length > 1 ? 's' : ''} from your plan.`, 'Clear');
    if (ok) removeMany(items.map((p) => p.id));
  };
  const deleteWholePlan = async () => {
    const ok = await confirmAction('Delete your entire plan?', `Removes all ${state.plan.length} problems (to-do and done) and their alarms. This can't be undone.`, 'Delete plan');
    if (ok) clearPlan();
  };

  return (
    <Screen title="Plan" subtitle={`${state.plan.filter((p) => p.status === 'todo').length} to solve · ${done.length} done`}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button label="+ Add problem" onPress={() => router.push('/add-problem')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="ghost" label={showAuto ? 'Close auto-plan' : '✨ Auto-plan'} onPress={() => {
            setAutoResult(undefined);
            setShowAuto((v) => !v);
          }} />
        </View>
      </View>

      {showAuto ? (
        <AutoPlanner
          onDone={(count, requested) => {
            setAutoResult(count < requested
              ? `Added ${count} of ${requested} problems. Try another topic or difficulty to fill the plan.`
              : `Added ${count} ${count === 1 ? 'problem' : 'problems'} to your plan.`);
            setShowAuto(false);
          }}
          autoPlan={autoPlan}
          weak={weakTopics(state.profile?.skills)}
        />
      ) : null}
      {autoResult ? <Text accessibilityLiveRegion="polite" style={s.meta}>{autoResult}</Text> : null}

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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>
              {label} <Text style={{ color: label === 'Overdue' ? colors.danger : colors.faint }}>· {items.length}</Text>
            </SectionLabel>
            <Pressable onPress={() => clearGroup(label, items)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
              <Text style={[s.meta, { color: colors.danger }]}>Clear day</Text>
            </Pressable>
          </View>
          <Card>
            {items.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <View style={s.divider} /> : null}
                <ProblemRow
                  p={p}
                  alreadySolved={solved.has(p.slug)}
                  meta={[p.time ? `⏰ ${p.time}` : '', p.note ?? ''].filter(Boolean).join(' · ') || undefined}
                  right={
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                      <Pressable
                        onPress={() => setOpenId(openId === p.id ? undefined : p.id)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`More actions for ${p.title}`}
                        style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                      >
                        <Text style={{ color: openId === p.id ? colors.accent : colors.muted, fontSize: 22 }}>⋯</Text>
                      </Pressable>
                      <Check onPress={() => toggleDone(p.id)} />
                    </View>
                  }
                />
                {openId === p.id ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 }}>
                    <Chip label="Mark as already solved" onPress={() => {
                      markPreviouslySolved(p.id);
                      setOpenId(undefined);
                    }} />
                    {p.date !== today ? <Chip label="Move to today" onPress={() => (updatePlan(p.id, { date: today }), setOpenId(undefined))} /> : null}
                    {p.date !== tomorrow ? <Chip label="Push to tomorrow" onPress={() => (updatePlan(p.id, { date: tomorrow }), setOpenId(undefined))} /> : null}
                    <Pressable
                      onPress={() => (removePlan(p.id), setOpenId(undefined))}
                      accessibilityRole="button"
                      style={[s.chip, { borderColor: colors.danger, backgroundColor: 'rgba(255,94,98,0.14)' }]}
                    >
                      <Text style={[s.chipText, { color: colors.danger }]}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
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
                <ProblemRow p={p} done alreadySolved={!p.doneAt && solved.has(p.slug)} meta={p.doneAt ? friendlyDay(dayKey(new Date(p.doneAt))) : undefined} right={<Check done onPress={() => toggleDone(p.id)} />} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {state.plan.length ? <Button kind="danger" label={`Delete entire plan (${todoCount} to do)`} onPress={deleteWholePlan} /> : null}
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
  onDone: (count: number, requested: number) => void;
  autoPlan: ReturnType<typeof useStore>['autoPlan'];
  weak: string[];
}) {
  const [tag, setTag] = useState(weak[0] ?? 'array');
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>('Easy');
  const [perDay, setPerDay] = useState(1);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>();

  const go = async () => {
    setBusy(true);
    setFeedback(undefined);
    try {
      const n = await autoPlan({ tagSlug: tag, difficulty, perDay, days });
      if (n) onDone(n, perDay * days);
      else setFeedback('No new problems found. Try another topic or difficulty.');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Could not reach LeetCode. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ borderColor: colors.accent }}>
      <Text style={[s.body, { fontWeight: '700' }]}>✨ Auto-plan from a topic</Text>
      <Text style={s.meta}>Picks free problems, easiest first, and skips known solves and questions already in your plan.</Text>
      <Text style={s.meta}>LeetPing remembers the solves it syncs. Use “Mark as already solved” for older questions it missed.</Text>
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
      {feedback ? <Text accessibilityLiveRegion="polite" style={s.meta}>{feedback}</Text> : null}
    </Card>
  );
}
