import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { problemUrl } from '../lib/leetcode';
import {
  ACTION_SNOOZE,
  configureForeground,
  isSupported,
  setupChannelsAndActions,
  snooze,
} from '../lib/notifications';
import { StoreProvider } from '../state/store';
import { colors } from '../theme';

configureForeground();

function useNotificationTaps() {
  useEffect(() => {
    if (!isSupported) return;
    setupChannelsAndActions().catch(() => {});

    const handle = (response: Notifications.NotificationResponse) => {
      const content = response.notification.request.content;
      if (response.actionIdentifier === ACTION_SNOOZE) {
        snooze(content).catch(() => {});
        Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
        return;
      }
      const data = (content.data ?? {}) as { slug?: string | null; url?: string };
      if (data.url) Linking.openURL(data.url);
      else if (data.slug) Linking.openURL(problemUrl(data.slug));
      else router.navigate('/');
    };

    const last = Notifications.getLastNotificationResponse();
    if (last) {
      handle(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useNotificationTaps();
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-problem" options={{ presentation: 'modal', headerShown: true, title: 'Add to plan' }} />
          <Stack.Screen name="reminder" options={{ presentation: 'modal', headerShown: true, title: 'Alarm' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
