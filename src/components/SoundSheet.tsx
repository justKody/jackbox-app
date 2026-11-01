import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityActionEvent, Animated, GestureResponderEvent, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { native, useAnimatedValue } from '../motion';
import { playSfx, setEffectsVolume, setMusicVolume, setMuted, setSoundPanelOpen, useSoundPanelOpen, useSoundSettings } from '../sound';
import { alpha, colors, fonts } from '../theme';
import { SparkleShape } from './HatWizard';
import { Sheet } from './Sheet';
import { SpeakerIcon, styles } from './ui';

/** Sound panel: a master switch plus music and effects volumes. Mounted once at the app root. */
export function SoundSheet() {
  const open = useSoundPanelOpen();
  const { muted, music, effects } = useSoundSettings();
  const on = !muted;

  return (
    <Sheet
      visible={open}
      onClose={() => setSoundPanelOpen(false)}
      title="Sound"
      icon={
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.magic, 0.12), borderWidth: 1, borderColor: alpha(colors.magic, 0.3) }}>
          <SpeakerIcon muted={muted} color={muted ? colors.dim : colors.magic} size={22} />
        </View>
      }
    >
      <View style={[styles.row, { paddingVertical: 14 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.text }}>Sound</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>{on ? 'Music and effects are on' : 'Everything is silent'}</Text>
        </View>
        <Toggle on={on} label="Sound" onPress={() => setMuted(on)} />
      </View>

      <VolumeRow
        label="Music"
        icon={<NoteIcon color={colors.aura} />}
        color={colors.aura}
        value={music}
        dimmed={muted}
        onChange={setMusicVolume}
      />
      <VolumeRow
        label="Effects"
        icon={<SparkleShape size={18} color={colors.gold} />}
        color={colors.gold}
        value={effects}
        dimmed={muted}
        onChange={setEffectsVolume}
        // A sample on release, so you can hear the level you picked.
        onRelease={() => playSfx('sparkle')}
      />
    </Sheet>
  );
}

function VolumeRow({ label, icon, color, value, dimmed, onChange, onRelease }: { label: string; icon: ReactNode; color: string; value: number; dimmed: boolean; onChange: (v: number) => void; onRelease?: () => void }) {
  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: 6, paddingVertical: 14, opacity: dimmed ? 0.5 : 1 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(color, 0.14) }}>{icon}</View>
        <Text style={[styles.rowName, { fontFamily: fonts.bold }]}>{label}</Text>
        <Text style={[styles.pillText, { color: value === 0 ? colors.dim : colors.text }]}>{value === 0 ? 'Off' : `${value}%`}</Text>
      </View>
      <Slider label={`${label} volume`} value={value} color={color} onChange={onChange} onRelease={onRelease} />
    </View>
  );
}

const KNOB = 26;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Horizontal 0–100 slider: tap anywhere on the track to jump, or drag the knob. */
function Slider({ label, value, color, onChange, onRelease }: { label: string; value: number; color: string; onChange: (v: number) => void; onRelease?: () => void }) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const knobScale = useAnimatedValue(1);
  // Where the drag started, plus the last value sent, so fast moves between renders stay in step.
  const drag = useRef({ x: 0, pageX: 0, last: value });

  useEffect(() => {
    Animated.spring(knobScale, { toValue: dragging ? 1.2 : 1, useNativeDriver: native, friction: 6, tension: 180 }).start();
  }, [dragging, knobScale]);

  const commit = (next: number) => {
    const prev = drag.current.last;
    if (next === prev) return;
    if (next === 0 || next === 100) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (Math.floor(next / 10) !== Math.floor(prev / 10)) Haptics.selectionAsync();
    drag.current.last = next;
    onChange(next);
  };

  // The knob's centre travels between KNOB/2 and width - KNOB/2.
  const setFromX = (x: number) => {
    if (width > KNOB) commit(clamp(((x - KNOB / 2) / (width - KNOB)) * 100));
  };

  const end = () => {
    setDragging(false);
    onRelease?.();
  };

  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      const { locationX, pageX } = e.nativeEvent;
      drag.current = { x: locationX, pageX, last: value };
      setDragging(true);
      setFromX(locationX);
    },
    onResponderMove: (e: GestureResponderEvent) => setFromX(drag.current.x + e.nativeEvent.pageX - drag.current.pageX),
    onResponderRelease: end,
    onResponderTerminate: end,
  };

  const onA11yAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') commit(clamp(value + 10));
    if (e.nativeEvent.actionName === 'decrement') commit(clamp(value - 10));
  };

  const travel = Math.max(0, width - KNOB);
  const knobX = (travel * value) / 100;

  return (
    <View
      {...responder}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value, text: `${value} percent` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onA11yAction}
      style={{ height: 36, justifyContent: 'center', cursor: 'pointer' }}
    >
      {/* Children ignore touches so locationX is always measured against the whole track. */}
      <View style={{ position: 'absolute', left: KNOB / 2, right: KNOB / 2, height: 8, borderRadius: 4, backgroundColor: colors.track, pointerEvents: 'none' }} />
      <View style={{ position: 'absolute', left: KNOB / 2, width: knobX, height: 8, borderRadius: 4, backgroundColor: color, pointerEvents: 'none' }} />
      <Animated.View
        style={{
          position: 'absolute',
          left: knobX,
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: colors.text,
          borderWidth: 3,
          borderColor: color,
          boxShadow: `0 0 ${dragging ? 14 : 8}px ${alpha(color, dragging ? 0.7 : 0.4)}`,
          pointerEvents: 'none',
          transform: [{ scale: knobScale }],
        }}
      />
    </View>
  );
}

/** iOS-style switch, tinted with the Hat's eye glow when on. */
function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const t = useAnimatedValue(on ? 1 : 0);
  useEffect(() => {
    // Colour can't run on the native driver, so the knob slides on JS too.
    Animated.spring(t, { toValue: on ? 1 : 0, useNativeDriver: false, friction: 7, tension: 160 }).start();
  }, [on, t]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={8}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <Animated.View
        style={{
          width: 52,
          height: 30,
          borderRadius: 15,
          padding: 3,
          borderWidth: 1,
          borderColor: t.interpolate({ inputRange: [0, 1], outputRange: [colors.borderStrong, colors.magic] }),
          backgroundColor: t.interpolate({ inputRange: [0, 1], outputRange: [colors.track, colors.magicDeep] }),
        }}
      >
        <Animated.View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.text,
            transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

function NoteIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18V5l12-2v13" />
      <Circle cx={6} cy={18} r={3} />
      <Circle cx={18} cy={16} r={3} />
    </Svg>
  );
}
