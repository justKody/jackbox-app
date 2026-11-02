import { Component, ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ViewProps } from 'react-native';
import { FilamentScene } from 'react-native-filament';
import { native, useAnimatedValue } from '../../motion';

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn('3D view unavailable, showing the 2D fallback.', e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Hosts a Filament scene, the native counterpart of `GLSurface`.
 * - Waits `delay` ms before starting the engine, so screen entrances stay smooth.
 * - Fades the scene in once it says it's `ready` (models loaded and dressed).
 * - Shows `fallback` if the scene throws while setting up.
 * `children` render inside the `<FilamentScene>`, so they can use Filament's hooks.
 */
export function FilamentSurface({
  ready,
  fallback,
  delay = 560,
  style,
  children,
  ...viewProps
}: { ready: boolean; fallback: ReactNode; delay?: number; children: ReactNode } & ViewProps) {
  const [mounted, setMounted] = useState(false);
  const fade = useAnimatedValue(0);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (ready) Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  }, [ready, fade]);

  return (
    <View style={style} {...viewProps}>
      <Fallback fallback={fallback}>
        {mounted && (
          <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
            <FilamentScene>{children}</FilamentScene>
          </Animated.View>
        )}
      </Fallback>
    </View>
  );
}
