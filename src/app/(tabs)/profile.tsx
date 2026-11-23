import { useState } from 'react';
import { Alert, Image, Linking, Text, TextInput, View } from 'react-native';
import { Bar, Button, Card, Heatmap, Screen, SectionLabel, s } from '../../components/ui';
import { DEFAULT_FALLBACK, profileUrl } from '../../lib/leetcode';
import { useStore } from '../../state/store';
import { colors, diffColor } from '../../theme';

export default function ProfileScreen() {
  const { state, connect, disconnect, syncing, sync, syncError, setSetting } = useStore();
  const [name, setName] = useState(state.username ?? '');
  const [api, setApi] = useState(state.fallbackApi);
  const p = state.profile;

  const onConnect = async () => {
    if (!name.trim()) return;
    try {
      await connect(name.trim());
    } catch (e: any) {
      Alert.alert('Could not connect', e?.message ?? 'Check the username and your internet connection.');
    }
  };

  if (!state.username || !p) {
    return (
      <Screen title="Connect" subtitle="Link your LeetCode account">
        <Card>
          <Text style={s.body}>Enter your LeetCode username. LeetPing reads only your public profile, so no password is needed.</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="leetcode username"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={onConnect}
            returnKeyType="go"
            style={s.input}
          />
          <Button label="Connect" onPress={onConnect} loading={syncing} disabled={!name.trim()} />
          {syncError ? <Text style={{ color: colors.danger }}>{syncError}</Text> : null}
        </Card>
        <Card>
          <Text style={[s.body, { fontWeight: '700' }]}>What you get</Text>
          <Text style={s.meta}>• Streak, solved counts, contest rating and badges{'\n'}• Planned problems tick themselves off when LeetCode accepts your solution{'\n'}• The streak-saver alarm stays quiet on days you’ve already solved one{'\n'}• Auto-plan suggestions based on your weakest topics</Text>
        </Card>
      </Screen>
    );
  }

  const topSkills = [...p.skills].sort((a, b) => b.solved - a.solved).slice(0, 8);
  const maxSkill = topSkills[0]?.solved ?? 1;

  return (
    <Screen title={p.realName || p.username} subtitle={`@${p.username}`} refreshing={syncing} onRefresh={sync}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {p.avatar ? <Image source={{ uri: p.avatar }} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cardHi }} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{p.solved.all} solved</Text>
          <Text style={s.meta}>
            {p.ranking ? `Rank #${p.ranking.toLocaleString()} · ` : ''}
            {p.streak}🔥 streak · {p.totalActiveDays} active days
          </Text>
        </View>
      </Card>

      <Card>
        <Bar label="Easy" value={p.solved.easy} total={p.totals.easy} color={diffColor.Easy} />
        <Bar label="Medium" value={p.solved.medium} total={p.totals.medium} color={diffColor.Medium} />
        <Bar label="Hard" value={p.solved.hard} total={p.totals.hard} color={diffColor.Hard} />
      </Card>

      <SectionLabel>Submission activity</SectionLabel>
      <Card>
        <Heatmap calendar={p.calendar} />
      </Card>

      {p.contest ? (
        <>
          <SectionLabel>Contest</SectionLabel>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Mini value={String(p.contest.rating)} label="rating" />
            <Mini value={`#${p.contest.globalRanking.toLocaleString()}`} label="global" />
            <Mini value={String(p.contest.attended)} label="attended" />
            {p.contest.topPercentage ? <Mini value={`${p.contest.topPercentage}%`} label="top" /> : null}
          </Card>
        </>
      ) : null}

      {topSkills.length ? (
        <>
          <SectionLabel>Strongest topics</SectionLabel>
          <Card>
            {topSkills.map((t) => (
              <Bar key={t.slug} label={t.tag} value={t.solved} total={maxSkill} color={colors.accent} />
            ))}
          </Card>
        </>
      ) : null}

      {p.languages.length ? (
        <>
          <SectionLabel>Languages</SectionLabel>
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {p.languages.slice(0, 8).map((l) => (
              <Text key={l.name} style={[s.chip, s.chipText]}>
                {l.name} · {l.solved}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

      {p.badges.length ? (
        <>
          <SectionLabel>Badges · {p.badges.length}</SectionLabel>
          <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {p.badges.slice(0, 12).map((b) => (
              <View key={b.name} style={{ width: 72, alignItems: 'center', gap: 4 }}>
                <Image source={{ uri: b.icon }} style={{ width: 48, height: 48 }} />
                <Text style={[s.meta, { textAlign: 'center', fontSize: 10 }]} numberOfLines={2}>
                  {b.name}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Button kind="ghost" label="Open profile on LeetCode" onPress={() => Linking.openURL(profileUrl(p.username))} />

      <SectionLabel>Data source</SectionLabel>
      <Card>
        <Text style={s.meta}>
          LeetPing talks to LeetCode’s GraphQL API directly. If that fails it falls back to this alfa-leetcode-api server. The public one is rate limited, so you can self-host it with Docker and paste its URL here.
        </Text>
        <TextInput
          value={api}
          onChangeText={setApi}
          onEndEditing={() => setSetting('fallbackApi', api.trim() || DEFAULT_FALLBACK)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={s.input}
        />
      </Card>

      <Button
        kind="danger"
        label="Disconnect account"
        onPress={() =>
          Alert.alert('Disconnect?', 'Your plan and alarms stay on this phone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disconnect', style: 'destructive', onPress: disconnect },
          ])
        }
      />
    </Screen>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={s.meta}>{label}</Text>
    </View>
  );
}
