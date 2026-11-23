import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { Button, Card, Screen, SectionLabel, s } from '../../components/ui';
import { DAY_SHORT, formatTime } from '../../lib/dates';
import {
  getPermissionInfo,
  isSupported,
  requestExactAlarms,
  requestNotificationPermission,
  sendTestAlarm,
  type PermissionInfo,
} from '../../lib/notifications';
import type { Reminder } from '../../lib/types';
import { useStore } from '../../state/store';
import { colors } from '../../theme';

export default function Alarms() {
  const { state, upsertReminder, setSetting, queued, reschedule } = useStore();
  const [perms, setPerms] = useState<PermissionInfo>();

  const refresh = useCallback(() => {
    getPermissionInfo().then(setPerms).catch(() => {});
  }, []);
  useFocusEffect(refresh);

  const enable = async () => {
    const ok = await requestNotificationPermission();
    if (!ok) {
      Alert.alert('Notifications are blocked', 'Turn on notifications for LeetPing in system settings to get alarms.', [
        { text: 'Open settings', onPress: () => Linking.openSettings() },
        { text: 'Later', style: 'cancel' },
      ]);
    }
    refresh();
    await reschedule();
  };

  const allowExact = async () => {
    await requestExactAlarms();
    refresh();
    await reschedule();
  };

  const test = async () => {
    if (!perms?.notifications) return enable();
    await sendTestAlarm(5);
    Alert.alert('Test alarm in 5 seconds', 'Lock your phone or leave the app to see it as a real alarm.');
  };

  return (
    <Screen title="Alarms" subtitle={`${queued} alarms queued for the next 2 weeks`}>
      {!isSupported ? (
        <Card>
          <Text style={s.body}>Alarms need the iOS or Android app. Open LeetPing in Expo Go or a phone build.</Text>
        </Card>
      ) : perms && !perms.notifications ? (
        <Card style={{ borderColor: colors.accent }}>
          <Text style={[s.body, { fontWeight: '700' }]}>🔕 Notifications are off</Text>
          <Text style={s.meta}>LeetPing can’t ring until you allow notifications.</Text>
          <Button label="Allow notifications" onPress={enable} />
        </Card>
      ) : perms && Platform.OS === 'android' && state.alarmMode && !perms.exactAlarms ? (
        <Card style={{ borderColor: colors.accent }}>
          <Text style={[s.body, { fontWeight: '700' }]}>⏱ Allow exact alarms</Text>
          <Text style={s.meta}>Android may delay reminders by several minutes unless LeetPing can set exact alarms.</Text>
          <Button label="Allow exact alarms" onPress={allowExact} />
        </Card>
      ) : null}

      <SectionLabel>Daily reminders</SectionLabel>
      {state.reminders.map((r) => (
        <ReminderCard key={r.id} r={r} onToggle={(v) => upsertReminder({ ...r, enabled: v })} />
      ))}
      <Button kind="ghost" label="+ New alarm" onPress={() => router.push('/reminder')} />

      <SectionLabel>Settings</SectionLabel>
      <Card>
        <Row
          title="Contest alarms"
          sub="Rings 30 minutes before each weekly and biweekly LeetCode contest."
          value={state.contestAlarms}
          onChange={(v) => setSetting('contestAlarms', v)}
        />
        {Platform.OS === 'android' ? (
          <>
            <View style={s.divider} />
            <Row
              title="Alarm-clock mode"
              sub="Delivers at the exact minute, shows the alarm icon in the status bar, and works in Doze mode."
              value={state.alarmMode}
              onChange={(v) => setSetting('alarmMode', v)}
            />
          </>
        ) : null}
      </Card>
      <Button kind="ghost" label="🔔 Send a test alarm" onPress={test} />
      <Text style={[s.meta, { textAlign: 'center' }]}>
        Each alarm names the problem planned for that day, so you know exactly what to open.
      </Text>
    </Screen>
  );
}

function ReminderCard({ r, onToggle }: { r: Reminder; onToggle: (v: boolean) => void }) {
  const days =
    r.days.length === 7 ? 'Every day' : r.days.length === 5 && !r.days.includes(0) && !r.days.includes(6) ? 'Weekdays' : r.days.map((d) => DAY_SHORT[d]).join(' ');
  return (
    <Pressable onPress={() => router.push({ pathname: '/reminder', params: { id: r.id } })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', opacity: r.enabled ? 1 : 0.55 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatTime(r.hour, r.minute)}</Text>
          <Text style={[s.body, { fontWeight: '600' }]}>
            {r.kind === 'streak' ? '🔥 ' : '⏰ '}
            {r.label}
          </Text>
          <Text style={s.meta}>
            {days}
            {r.kind === 'streak' ? ' · skipped once you’ve solved today' : ''}
          </Text>
        </View>
        <Switch value={r.enabled} onValueChange={onToggle} trackColor={{ true: colors.accent, false: colors.cardHi }} thumbColor="#fff" />
      </Card>
    </Pressable>
  );
}

function Row({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.body, { fontWeight: '600' }]}>{title}</Text>
        <Text style={s.meta}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.cardHi }} thumbColor="#fff" />
    </View>
  );
}
