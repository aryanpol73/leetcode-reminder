import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, BackHandler, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackground } from '../components/glass';
import { Button, Card, s } from '../components/ui';
import { practiceAlarm, type PracticeAlarm } from '../lib/alarmMessages';
import { dayKey } from '../lib/dates';
import { problemUrl } from '../lib/leetcode';
import { screenAlarm } from '../lib/screenAlarm';
import { useStore } from '../state/store';
import { colors, diffColor, fonts } from '../theme';

export default function AlarmScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state } = useStore();
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const planned = state.plan.find((item) => item.status === 'todo' && item.date <= dayKey(now));
  const raw = id && screenAlarm ? screenAlarm.getAlarm(id) : null;
  const alarm = raw ? JSON.parse(raw) as PracticeAlarm : id ? null : practiceAlarm(state, now, 'streak', planned, now);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/alarms');
  }, []);

  const respond = useCallback(async (snooze: boolean, url?: string) => {
    setBusy(true);
    try {
      if (id) await screenAlarm?.finish(id, snooze);
      if (url) await Linking.openURL(url);
      close();
    } catch {
      Alert.alert('Couldn’t complete that action', 'Try again or close the reminder.');
    } finally {
      setBusy(false);
    }
  }, [close, id]);

  useFocusEffect(useCallback(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      void respond(false);
      return true;
    });
    return () => {
      back.remove();
      if (id) screenAlarm?.releaseWindow(id);
    };
  }, [id, respond]));

  const problem = alarm?.problem;
  const url = problem ? problemUrl(problem.slug) : 'https://leetcode.com/problemset/';
  return (
    <View style={styles.screen}>
      <AuroraBackground />
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.icon}><Ionicons name="alarm-outline" size={27} color={colors.accent} /></View>
            <Text style={s.subtitle}>LeetPing · {id ? 'Practice alarm' : 'Alarm preview'}</Text>
            <Text accessibilityRole="header" style={[s.title, styles.headline]}>
              {alarm?.headline ?? 'This reminder has ended.'}
            </Text>
            {alarm ? (
              <>
                <Text style={[s.body, styles.message]}>{alarm.message}</Text>
                {alarm.streak ? (
                  <Text style={styles.streak}>One solve keeps your {alarm.streak}-day streak going.</Text>
                ) : null}
                {problem ? (
                  <Card>
                    <Text style={s.meta}>On your plan</Text>
                    <Text style={styles.problem}>#{problem.frontendId} · {problem.title}</Text>
                    <Text style={[s.meta, { color: diffColor[problem.difficulty] }]}>{problem.difficulty}</Text>
                    {alarm.note ? <Text style={s.meta}>{alarm.note}</Text> : null}
                  </Card>
                ) : null}
                <Button label={problem ? 'Solve now' : 'Pick a problem'} onPress={() => respond(false, url)} disabled={busy} />
                <Button label="Snooze 10 min" kind="ghost" onPress={() => respond(true)} disabled={busy} />
              </>
            ) : null}
            <Button label="Close" kind="ghost" onPress={() => respond(false)} disabled={busy} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 460, gap: 14 },
  icon: {
    alignItems: 'center', justifyContent: 'center', width: 52, height: 52,
    backgroundColor: colors.cardHi, borderColor: colors.border, borderWidth: 1, borderRadius: 16,
  },
  headline: { fontSize: 38, lineHeight: 47 },
  message: { color: colors.muted },
  streak: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 13 },
  problem: { color: colors.text, fontFamily: fonts.bold, fontSize: 19 },
});
