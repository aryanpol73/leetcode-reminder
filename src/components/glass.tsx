import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import React, { useEffect, useId, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, LinearGradient as SvgLinearGradient, Text as SvgText } from 'react-native-svg';
import { aurora, colors, fonts, glass, gradients, radius as defaultRadius } from '../theme';

const nativeDriver = Platform.OS !== 'web';

// Android only blurs with a BlurTargetView wrapping the content behind, which doesn't fit
// cards scrolling over a shared background. There the glass is a translucent tinted fill,
// which looks nearly the same over the already-soft aurora.
const canBlur = Platform.OS === 'ios' || Platform.OS === 'web';

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export const haptic = {
  tap: () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  },
  success: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};

/* ---------------------------------------------------------------- Aurora */

type BlobSpec = { id: string; color: string; size: number; x: number; y: number; opacity: number; duration: number; drift: [number, number] };

const BLOBS: BlobSpec[] = [
  { id: 'lp-aurora-violet', color: aurora.violet, size: 420, x: -150, y: -140, opacity: 0.95, duration: 8000, drift: [70, 60] },
  { id: 'lp-aurora-coral', color: aurora.coral, size: 340, x: 180, y: 260, opacity: 0.6, duration: 10000, drift: [-60, 80] },
  { id: 'lp-aurora-amber', color: aurora.amber, size: 380, x: -120, y: 560, opacity: 0.38, duration: 12000, drift: [60, -70] },
];

function Blob({ spec, still, speed, gradientId }: { spec: BlobSpec; still: boolean; speed: number; gradientId: string }) {
  const t = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    if (still) return;
    const d = spec.duration / speed;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: d, easing: ease, useNativeDriver: nativeDriver }),
        Animated.timing(t, { toValue: 0, duration: d, easing: ease, useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, speed, spec.duration, t]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, spec.drift[0]] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, spec.drift[1]] });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 0.95] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: spec.x,
        top: spec.y,
        width: spec.size,
        height: spec.size,
        opacity: spec.opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      <Svg width={spec.size} height={spec.size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={spec.color} stopOpacity={0.85} />
            <Stop offset="0.4" stopColor={spec.color} stopOpacity={0.45} />
            <Stop offset="0.75" stopColor={spec.color} stopOpacity={0.12} />
            <Stop offset="1" stopColor={spec.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/** SVG ids must be unique in the web DOM, where every mounted tab scene stays in the document. */
export function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Opaque base + drifting aurora light. Render it inside each screen (not as one shared layer
 * behind transparent scenes): on web, inactive tab scenes stay mounted and stacked, so each
 * scene must paint its own opaque background. Animation pauses while the screen is unfocused.
 */
export function AuroraBackground({ speed = 1 }: { speed?: number }) {
  const reduce = useReduceMotion();
  const focused = useIsFocused();
  const uid = useSvgId('lp-aurora');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, overflow: 'hidden' }]}>
      {BLOBS.map((b) => (
        <Blob key={b.id} spec={b} still={reduce || !focused} speed={speed} gradientId={`${uid}-${b.id}`} />
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- Glass */

/** The frosted layers alone (blur + sheen + rim highlight), absolutely filling the parent. */
export function GlassFill({ radius = defaultRadius, intensity = glass.blur }: { radius?: number; intensity?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      {canBlur ? (
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28,20,58,0.55)' }]} />
      )}
      <LinearGradient colors={glass.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: radius * 0.7, right: radius * 0.7, height: 1, backgroundColor: glass.highlight }} />
    </View>
  );
}

/** A frosted glass surface. Layout styles (padding, gap, flexDirection) apply to the children. */
export function Glass({
  children,
  style,
  radius = defaultRadius,
  intensity,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor: glass.border,
          boxShadow: '0 14px 30px -14px rgba(0,0,0,0.6)',
        },
        style,
      ]}
    >
      <GlassFill radius={radius} intensity={intensity} />
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- Progress ring */

export function ProgressRing({
  progress,
  size = 80,
  stroke = 6,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduce = useReduceMotion();
  const v = useState(() => new Animated.Value(0))[0];
  const [shown, setShown] = useState(0);
  const ringId = useSvgId('lp-ring');

  useEffect(() => {
    const id = v.addListener(({ value }) => setShown(value));
    return () => v.removeListener(id);
  }, [v]);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    if (reduce) {
      v.setValue(target);
      return;
    }
    const anim = Animated.timing(v, { toValue: target, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [progress, reduce, v]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgLinearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFD27A" />
            <Stop offset="1" stopColor={aurora.coral} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        {shown > 0.001 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${ringId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - shown)}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- Gradient number */

/** Big number filled with the amber → coral streak gradient. */
export function GradientNumber({ value, size = 60, risk }: { value: string; size?: number; risk?: boolean }) {
  const width = Math.ceil(value.length * size * 0.68) + 6;
  const height = Math.ceil(size * 1.05);
  const stops = risk ? gradients.risk : gradients.streak;
  const id = useSvgId(risk ? 'lp-num-risk' : 'lp-num');
  return (
    <Svg width={width} height={height} accessibilityLabel={value}>
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {stops.map((c, i) => (
            <Stop key={c} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </SvgLinearGradient>
      </Defs>
      <SvgText x={0} y={size * 0.86} fontSize={size} fontFamily={fonts.heavy} fill={`url(#${id})`} letterSpacing={-size * 0.04}>
        {value}
      </SvgText>
    </Svg>
  );
}

/* ---------------------------------------------------------------- Buttons */

export function usePressScale(to = 0.96) {
  const scale = useState(() => new Animated.Value(1))[0];
  const spring = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: 6 }).start();
  return { scale, onPressIn: () => spring(to), onPressOut: () => spring(1) };
}

export function GradientButton({
  label,
  icon,
  onPress,
  disabled,
  height = 46,
  colors: stops = gradients.cta,
  style,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
  height?: number;
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Animated.View style={{ transform: [{ scale }], borderRadius: 15, boxShadow: '0 8px 22px -8px rgba(255,122,80,0.85)' }}>
        <LinearGradient
          colors={stops}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18 }}
        >
          {icon ? <Ionicons name={icon} size={15} color={colors.accentInk} /> : null}
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accentInk }}>{label}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export function GlassButton({
  label,
  icon,
  onPress,
  height = 46,
  style,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Glass radius={15} style={{ height, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {icon ? <Ionicons name={icon} size={15} color={colors.text} /> : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text }}>{label}</Text>
        </Glass>
      </Animated.View>
    </Pressable>
  );
}
