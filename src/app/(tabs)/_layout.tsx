import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground, GlassFill } from '../../components/glass';
import { colors, fonts } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon = (name: string) =>
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return (
      <View
        style={[
          { width: 50, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
          focused && { backgroundColor: 'rgba(255,255,255,0.14)', boxShadow: '0 0 18px -1px rgba(124,58,237,0.95)' },
        ]}
      >
        <Ionicons name={(focused ? name : `${name}-outline`) as IconName} size={20} color={typeof color === 'string' ? color : '#fff'} />
      </View>
    );
  };

const BAR_RADIUS = 32;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuroraBackground />
      <Tabs
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
          tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10, marginTop: 2 },
          tabBarItemStyle: { paddingVertical: 6 },
          tabBarStyle: {
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 10,
            height: 66,
            borderRadius: BAR_RADIUS,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            backgroundColor: 'transparent',
            elevation: 0,
            paddingTop: 0,
            paddingBottom: 0,
            boxShadow: '0 12px 30px -10px rgba(0,0,0,0.65)',
          },
          tabBarBackground: () => <GlassFill radius={BAR_RADIUS} intensity={40} />,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('flash') }} />
        <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('calendar') }} />
        <Tabs.Screen name="alarms" options={{ title: 'Alarms', tabBarIcon: icon('alarm') }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
      </Tabs>
    </View>
  );
}
