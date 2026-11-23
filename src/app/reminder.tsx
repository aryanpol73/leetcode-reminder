import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, SectionLabel, TimePicker, s } from '../components/ui';
import { DAY_SHORT } from '../lib/dates';
import type { ReminderKind } from '../lib/types';
import { useStore } from '../state/store';
import { colors } from '../theme';

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

export default function ReminderEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, upsertReminder, removeReminder } = useStore();
  const existing = state.reminders.find((r) => r.id === id);
  const [label, setLabel] = useState(existing?.label ?? 'LeetCode time');
  const [hour, setHour] = useState(existing?.hour ?? 19);
  const [minute, setMinute] = useState(existing?.minute ?? 0);
  const [days, setDays] = useState<number[]>(existing?.days ?? ALL);
  const [kind, setKind] = useState<ReminderKind>(existing?.kind ?? 'nudge');

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

  const save = () => {
    if (!days.length) return Alert.alert('Pick at least one day');
    upsertReminder({ id: existing?.id, label: label.trim() || 'LeetCode time', hour, minute, days, kind, enabled: existing?.enabled ?? true });
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Edit alarm' : 'New alarm' }} />
      <Card>
        <TimePicker
          hour={hour}
          minute={minute}
          onChange={(h, m) => {
            setHour(h);
            setMinute(m);
          }}
        />
      </Card>

      <SectionLabel>Repeat</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Every day" active={same(days, ALL)} onPress={() => setDays(ALL)} />
        <Chip label="Weekdays" active={same(days, WEEKDAYS)} onPress={() => setDays(WEEKDAYS)} />
        <Chip label="Weekends" active={same(days, [0, 6])} onPress={() => setDays([0, 6])} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {ALL.map((d) => (
          <Chip key={d} label={DAY_SHORT[d].slice(0, 2)} active={days.includes(d)} onPress={() => toggleDay(d)} />
        ))}
      </View>

      <SectionLabel>Type</SectionLabel>
      <Card>
        <Chip label="⏰ Nudge: always rings" active={kind === 'nudge'} onPress={() => setKind('nudge')} />
        <Chip label="🔥 Streak saver: quiet if you already solved today" active={kind === 'streak'} onPress={() => setKind('streak')} />
        <Text style={s.meta}>Streak saver needs your LeetCode account connected. LeetPing checks your accepted submissions when you open the app and about every 30 minutes in the background.</Text>
      </Card>

      <SectionLabel>Label</SectionLabel>
      <TextInput value={label} onChangeText={setLabel} placeholder="Label" placeholderTextColor={colors.faint} style={s.input} />

      <Button label="Save alarm" onPress={save} />
      {existing ? (
        <Button
          kind="danger"
          label="Delete alarm"
          onPress={() => {
            removeReminder(existing.id);
            router.back();
          }}
        />
      ) : null}
    </ScrollView>
  );
}
