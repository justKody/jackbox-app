import { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, View, ViewProps, ViewStyle } from 'react-native';
import { useReduceMotion } from '../motion';
import { AnimalSwatch } from './AnimalSwatch';
import type { Look } from './skins';
import type { Stage } from './stage';
import { StageCanvas } from './StageCanvas';

/**
 * Your animal on its pedestal. Drag sideways to spin it, tap to make it hop and wave.
 * Rendered by Filament on iOS and Android and three.js on web; falls back to a flat portrait
 * if neither can run.
 */
export function CharacterStage({ look, label, style, onTouch, onPoke }: { look: Look; label: string; style?: ViewStyle; onTouch?: () => void; onPoke?: () => void }) {
  const stage = useRef<Stage | null>(null);
  const reduce = useReduceMotion();
  const [box, setBox] = useState(0);

  useEffect(() => stage.current?.setLook(look), [look]);
  useEffect(() => stage.current?.setStill(reduce), [reduce]);

  // Plain responder handlers: we only need the horizontal drag, its speed and whether it was a tap.
  const touch = useRef({ x0: 0, y0: 0, x: 0, t: 0, vx: 0, moved: false });
  const handlers: ViewProps = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      const { pageX, pageY } = e.nativeEvent;
      touch.current = { x0: pageX, y0: pageY, x: pageX, t: e.nativeEvent.timestamp, vx: 0, moved: false };
      stage.current?.grab();
      onTouch?.();
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const c = touch.current;
      const { pageX, pageY, timestamp } = e.nativeEvent;
      const dt = Math.max(1, timestamp - c.t);
      // Smoothed px/ms, so a flick spins on after you let go.
      c.vx = c.vx * 0.6 + ((pageX - c.x) / dt) * 0.4;
      c.x = pageX;
      c.t = timestamp;
      if (Math.abs(pageX - c.x0) > 8 || Math.abs(pageY - c.y0) > 8) c.moved = true;
      stage.current?.drag(pageX - c.x0);
    },
    onResponderRelease: () => {
      const c = touch.current;
      stage.current?.release(c.moved ? c.vx : 0);
      if (!c.moved) {
        stage.current?.poke();
        onPoke?.();
      }
    },
    onResponderTerminate: () => stage.current?.release(0),
  };

  return (
    <StageCanvas
      style={style}
      {...handlers}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`3D preview of ${label}. Drag to spin, tap to poke.`}
      onLayout={(e) => setBox(Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height))}
      look={look}
      still={reduce}
      onScene={(s) => (stage.current = s)}
      fallback={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{box > 0 && <AnimalSwatch look={look} size={box * 0.75} />}</View>}
    />
  );
}
