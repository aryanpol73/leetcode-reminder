import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, ProblemRow, SectionLabel, TimePicker, s } from '../components/ui';
import { addDays, DAY_SHORT, dayKey, parseDayKey, toHHmm } from '../lib/dates';
import { POPULAR_TAGS, resolveProblems } from '../lib/leetcode';
import { knownSolved } from '../lib/planning';
import type { Difficulty, ProblemRef } from '../lib/types';
import { useStore } from '../state/store';
import { colors } from '../theme';

export default function AddProblem() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { state, addToPlan } = useStore();
  const [date, setDate] = useState(params.date ?? dayKey());
  const [withAlarm, setWithAlarm] = useState(false);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string>();
  const [difficulty, setDifficulty] = useState<Difficulty>();
  const [results, setResults] = useState<ProblemRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const reqId = useRef(0);

  // Debounced search: number, title, slug or a pasted problem link, combined with topic/difficulty filters.
  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(undefined);
      try {
        const r = await resolveProblems(query, { tags: tag ? [tag] : undefined, difficulty, limit: 25 });
        if (id === reqId.current) setResults(r);
      } catch (e: any) {
        if (id === reqId.current) setError(e?.message ?? 'Could not reach LeetCode');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, tag, difficulty]);

  const days = Array.from({ length: 14 }, (_, i) => dayKey(addDays(new Date(), i)));
  const solvedSlugs = knownSolved(state);
  const plannedSlugs = new Set(state.plan.filter((p) => p.status === 'todo').map((p) => p.slug));

  const add = (p: ProblemRef) => {
    addToPlan(p, date, { time: withAlarm ? toHHmm(hour, minute) : undefined, note: note.trim() || undefined });
    setAdded((prev) => new Set(prev).add(p.slug));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <SectionLabel>When</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((k, i) => {
          const d = parseDayKey(k);
          return (
            <Chip key={k} label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DAY_SHORT[d.getDay()]} ${d.getDate()}`} active={date === k} onPress={() => setDate(k)} />
          );
        })}
      </ScrollView>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.body, { fontWeight: '600' }]}>⏰ Alarm for this problem</Text>
            <Text style={s.meta}>Rings at a set time on that day, on top of your daily reminders.</Text>
          </View>
          <Switch value={withAlarm} onValueChange={setWithAlarm} trackColor={{ true: colors.accent, false: colors.cardHi }} thumbColor="#fff" />
        </View>
        {withAlarm ? (
          <TimePicker
            hour={hour}
            minute={minute}
            onChange={(h, m) => {
              setHour(h);
              setMinute(m);
            }}
          />
        ) : null}
        <TextInput value={note} onChangeText={setNote} placeholder="Note (optional), e.g. “revise: monotonic stack”" placeholderTextColor={colors.faint} style={s.input} />
      </Card>

      <SectionLabel>Find a problem</SectionLabel>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Number, name or link, e.g. 42 or leetcode.com/problems/two-sum"
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={s.input}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => (
          <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? undefined : d)} />
        ))}
        <View style={{ width: 1, backgroundColor: colors.border }} />
        {POPULAR_TAGS.map((t) => (
          <Chip key={t.slug} label={t.name} active={tag === t.slug} onPress={() => setTag(tag === t.slug ? undefined : t.slug)} />
        ))}
      </ScrollView>

      <Card>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {!loading && !error && results.length === 0 ? <Text style={s.meta}>No problems match.</Text> : null}
        {results.map((p, i) => {
          const isAdded = added.has(p.slug);
          const inPlan = plannedSlugs.has(p.slug) && !isAdded;
          return (
            <View key={p.slug}>
              {i > 0 ? <View style={s.divider} /> : null}
              <ProblemRow
                p={p}
                alreadySolved={solvedSlugs.has(p.slug)}
                meta={[inPlan ? 'in plan' : '', p.acRate ? `${p.acRate.toFixed(0)}%` : ''].filter(Boolean).join(' · ') || undefined}
                right={
                  <Pressable
                    onPress={() => add(p)}
                    disabled={isAdded}
                    hitSlop={8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: isAdded ? colors.cardHi : colors.accent,
                    }}
                  >
                    <Text style={{ color: isAdded ? colors.good : colors.accentInk, fontWeight: '800' }}>{isAdded ? '✓ Added' : '+ Add'}</Text>
                  </Pressable>
                }
              />
            </View>
          );
        })}
      </Card>

      <Button label={added.size ? `Done · ${added.size} added` : 'Done'} onPress={() => router.back()} />
    </ScrollView>
  );
}
