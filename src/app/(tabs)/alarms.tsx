import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { Button, Card, Screen, SectionLabel, s } from '../../components/ui';
import { practiceAlarm } from '../../lib/alarmMessages';
import { DAY_SHORT, dayKey, formatTime } from '../../lib/dates';
import {
  getPermissionInfo,
  isSupported,
  requestExactAlarms,
  requestNotificationPermission,
  sendTestAlarm,
  type PermissionInfo,
} from '../../lib/notifications';
import { addScreenAlarm, screenAlarm } from '../../lib/screenAlarm';
import type { Reminder } from '../../lib/types';
import { getPushStatus } from '../../lib/webAlarms';
import { useStore } from '../../state/store';
import { colors } from '../../theme';

export default function Alarms() {
  const { state, upsertReminder, setSetting, queued, reschedule } = useStore();
  const [perms, setPerms] = useState<PermissionInfo>();
  const [screenPermissions, setScreenPermissions] = useState(() => screenAlarm?.permissions());
  const pushStatus = getPushStatus();

  const refresh = useCallback(() => {
    getPermissionInfo().then(setPerms).catch(() => {});
    setScreenPermissions(screenAlarm?.permissions());
  }, []);
  useFocusEffect(useCallback(() => {
    refresh();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]));

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
    try {
      if (screenAlarm && state.screenAlarms) {
        await reschedule();
        const now = new Date();
        const problem = state.plan.find((item) => item.status === 'todo' && item.date <= dayKey(now));
        const at = now.getTime() + 5000;
        await addScreenAlarm(practiceAlarm(state, new Date(at), 'streak', problem, now), at, `test:${at}`);
      } else {
        await sendTestAlarm(5);
      }
      Alert.alert('Test alarm scheduled', 'Lock your phone or leave LeetPing. Android may delay the test if exact alarms are off.');
    } catch {
      Alert.alert('Couldn’t schedule the test alarm', 'Check your alarm permissions and try again.');
    }
  };

  return (
    <Screen title="Alarms" subtitle={`${queued} alarms queued for the next 2 weeks`}>
      {!isSupported && perms?.notifications ? (
        <Card>
          <Text style={[s.body, { fontWeight: '700' }]}>
            {pushStatus === 'on' ? '📲 Push alarms on' : '📲 Web app alarms'}
          </Text>
          <Text style={s.meta}>
            {pushStatus === 'on'
              ? 'Alarms are delivered by push, so they ring even when LeetPing is closed.'
              : 'Alarms ring while LeetPing is open or in the background. Push delivery for a closed app is not set up on this server yet.'}
            {Platform.OS === 'web' && /iPhone|iPad/.test(navigator.userAgent) && !(navigator as any).standalone
              ? '\n\nOn iPhone: tap Share → Add to Home Screen, then open LeetPing from the home screen to allow notifications.'
              : ''}
          </Text>
        </Card>
      ) : null}
      {perms && !perms.notifications ? (
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
        {screenAlarm ? (
          <>
            <View style={s.divider} />
            <Row
              title="Silent screen alarms"
              sub="Show your practice reminder on screen with sound and vibration off."
              value={!!state.screenAlarms}
              onChange={(v) => setSetting('screenAlarms', v)}
            />
            {state.screenAlarms ? (
              <>
                {!screenPermissions?.fullScreen ? (
                  <Button kind="ghost" label="Allow full-screen alarms" onPress={() => screenAlarm?.openSettings('fullScreen')} />
                ) : null}
                <Row
                  title="Show over other apps"
                  sub="Show the full reminder even when you’re using another app."
                  value={!!state.screenAlarmsOverApps}
                  onChange={(v) => setSetting('screenAlarmsOverApps', v)}
                />
                {state.screenAlarmsOverApps && !screenPermissions?.overlay ? (
                  <Button kind="ghost" label="Allow display over apps" onPress={() => screenAlarm?.openSettings('overlay')} />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </Card>
      <Button kind="ghost" label="Preview alarm screen" onPress={() => router.push('/alarm-screen')} />
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
