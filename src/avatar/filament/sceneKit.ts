import { useEffect, useId } from 'react';
import type { Entity, FilamentAsset, Float3, MaterialInstance, RenderableManager, TransformManager } from 'react-native-filament';
import { useFilamentContext } from 'react-native-filament';
import type { ISharedValue } from 'react-native-worklets-core';
import { setLocal } from './transforms';

/**
 * Bits both Filament scenes share: per-scene state that lives on the render thread, and the
 * sparkle burst. Everything marked 'worklet' runs inside the render callback.
 */

/**
 * The running runtime's global object. Worklets must use this name: the worklet compiler leaves
 * `global` alone, but captures `globalThis` from the JS thread like any other variable.
 */
declare const global: Record<string, unknown>;

/**
 * State kept in the render thread's own JS runtime, created on first use. Plain objects there are
 * much cheaper to mutate every frame than shared values, which cross threads on every access.
 */
export function renderState<T>(id: string, make: () => T): T {
  'worklet';
  const g = global as Record<string, T | undefined>;
  let s = g[id];
  if (s === undefined) {
    s = make();
    g[id] = s;
  }
  return s;
}

/** A per-mount key for `renderState`, dropped from the render thread on unmount. */
export function useRenderStateId(prefix: string) {
  const { workletContext } = useFilamentContext();
  const id = `${prefix}${useId()}`;
  useEffect(
    () => () => {
      workletContext.runAsync(() => {
        'worklet';
        delete global[id];
      });
    },
    [id, workletContext],
  );
  return id;
}

/**
 * Hands a value to the render thread. Shared values are meant to be written from callbacks, but
 * React's lint reads a direct `.value =` there as mutating render state, so writes go through here.
 */
export function post<T>(sv: ISharedValue<T>, value: T) {
  sv.value = value;
}

/** Counts a one-off event (a tap, a swap) for the render loop to notice. */
export function bump(sv: ISharedValue<number>) {
  sv.value += 1;
}

/** Points a directional light the way three's does: from `position` towards the origin. */
export const dirFrom = (p: Float3): Float3 => {
  const l = Math.hypot(p[0], p[1], p[2]);
  return [-p[0] / l, -p[1] / l, -p[2] / l];
};

export const firstMaterial = (rm: RenderableManager, e: Entity): MaterialInstance => {
  'worklet';
  return rm.getMaterialInstanceAt(e, 0);
};

export type Burst = {
  parts: Entity[];
  mats: MaterialInstance[];
  pos: number[];
  vel: number[];
  col: Float3[];
  age: number;
  size: number;
};

/** A one-shot spray of sparkles that arcs out and falls, reusable as often as you like. */
export function createBurst(rm: RenderableManager, asset: FilamentAsset, count: number, size: number): Burst {
  'worklet';
  const parts: Entity[] = [];
  const mats: MaterialInstance[] = [];
  for (let i = 0; i < count; i++) {
    const e = asset.getFirstEntityByName(`b${i}`);
    if (!e) break;
    parts.push(e);
    mats.push(rm.getMaterialInstanceAt(e, 0));
  }
  return { parts, mats, pos: new Array(parts.length * 3).fill(0), vel: new Array(parts.length * 3).fill(0), col: parts.map(() => [1, 1, 1] as Float3), age: Infinity, size };
}

export function fireBurst(b: Burst, from: Float3, palette: Float3[], power: number) {
  'worklet';
  for (let i = 0; i < b.parts.length; i++) {
    let dx = Math.random() * 2 - 1;
    let dy = Math.random() * 1.4 - 0.3;
    let dz = Math.random() * 2 - 1;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    const speed = (1.4 + Math.random() * 1.6) * power;
    b.pos[i * 3] = from[0];
    b.pos[i * 3 + 1] = from[1];
    b.pos[i * 3 + 2] = from[2];
    b.vel[i * 3] = dx * speed;
    b.vel[i * 3 + 1] = dy * speed + 0.6;
    b.vel[i * 3 + 2] = dz * speed;
    // Colour follows the particle's material, in case the model shares one instance between cards.
    b.col[i] = palette[(i % 4) % palette.length];
  }
  b.age = 0;
}

export function updateBurst(tm: TransformManager, b: Burst, dt: number) {
  'worklet';
  if (b.age === Infinity) return;
  if (b.age >= 1) {
    for (const e of b.parts) setLocal(tm, e, [0, 0, 0], [0, 0, 0], 0, 0, 0, null);
    b.age = Infinity;
    return;
  }
  b.age += dt * 1.1;
  const drag = Math.pow(0.25, dt);
  const opacity = Math.max(0, 1 - b.age);
  const s = b.size * (1 - b.age * 0.5);
  for (let i = 0; i < b.parts.length; i++) {
    b.vel[i * 3 + 1] -= 2.2 * dt;
    for (let k = 0; k < 3; k++) {
      b.vel[i * 3 + k] *= drag;
      b.pos[i * 3 + k] += b.vel[i * 3 + k] * dt;
    }
    setLocal(tm, b.parts[i], [b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]], [s, s, 1], 0, 0, 0, null);
    const c = b.col[i];
    b.mats[i].setFloat4Parameter('baseColorFactor', [c[0], c[1], c[2], opacity]);
  }
}

/** Hides every card of a particle model until the scene places it. */
export function hideAll(tm: TransformManager, parts: Entity[]) {
  'worklet';
  for (const e of parts) setLocal(tm, e, [0, 0, 0], [0, 0, 0], 0, 0, 0, null);
}
