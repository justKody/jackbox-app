import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ViewProps } from 'react-native';
import { native, useAnimatedValue } from '../motion';

type Disposable = { dispose(): void };

/**
 * Hosts a three.js scene in an expo-gl view.
 * - Waits `delay` ms before creating the context, so screen entrances stay smooth.
 * - Fades the canvas in once the scene reports its first frame (shaders compiled).
 * - Shows `fallback` if the device can't give us WebGL 2.
 */
export function GLSurface<T extends Disposable>({
  create,
  onScene,
  fallback,
  delay = 560,
  style,
  children,
  ...viewProps
}: {
  create: (gl: ExpoWebGLRenderingContext, ready: () => void) => T;
  onScene: (scene: T | null) => void;
  fallback: ReactNode;
  delay?: number;
  children?: ReactNode;
} & ViewProps) {
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  const fade = useAnimatedValue(0);
  const scene = useRef<T | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(
    () => () => {
      scene.current?.dispose();
      scene.current = null;
      onScene(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const s = create(gl, () => Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: native }).start());
      scene.current = s;
      onScene(s);
    } catch (e) {
      console.warn('3D view unavailable, showing the 2D fallback.', e);
      setFailed(true);
    }
  };

  return (
    <View style={style} {...viewProps}>
      {failed ? (
        fallback
      ) : mounted ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        </Animated.View>
      ) : null}
      {children}
    </View>
  );
}
