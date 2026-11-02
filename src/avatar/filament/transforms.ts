import type { Entity, FilamentAsset, Float3, Float4, TransformManager } from 'react-native-filament';
import type { Rest } from './rig.generated';

const X: Float3 = [1, 0, 0];
const Y: Float3 = [0, 1, 0];
const Z: Float3 = [0, 0, 1];

/**
 * Sets an entity's local transform to T · R(rest) · Rx · Ry · Rz · S, matching three.js's
 * default XYZ Euler order so poses port over unchanged. `rest` is [angle, axis] or null.
 */
export function setLocal(tm: TransformManager, entity: Entity, p: number[], s: number[], ex: number, ey: number, ez: number, rest: number[] | null) {
  'worklet';
  // Filament's Mat4 helpers pre-multiply, so the product is built from the right.
  let m = tm.createIdentityMatrix().scaling([s[0], s[1], s[2]]);
  if (ez !== 0) m = m.rotate(ez, Z);
  if (ey !== 0) m = m.rotate(ey, Y);
  if (ex !== 0) m = m.rotate(ex, X);
  if (rest) m = m.rotate(rest[0], [rest[1], rest[2], rest[3]]);
  tm.setTransform(entity, m.translate([p[0], p[1], p[2]]));
}

/** A prop part at its rest pose, optionally scaled, spun about its own z and nudged. */
export function setRest(tm: TransformManager, entity: Entity, rest: Rest, scale = 1, spinZ = 0) {
  'worklet';
  setLocal(tm, entity, rest.p, [rest.s[0] * scale, rest.s[1] * scale, rest.s[2] * scale], 0, 0, spinZ, rest.r);
}

/** Every named node the app moves, looked up once per loaded asset. */
export function entitiesByName(asset: FilamentAsset, names: string[]) {
  'worklet';
  const out: Record<string, Entity> = {};
  for (const name of names) {
    const e = asset.getFirstEntityByName(name);
    if (e) out[name] = e;
  }
  return out;
}

/** '#RRGGBB' in sRGB to the linear values Filament's materials and lights take. */
export function linear(hex: string): Float3 {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as Float3;
}

export function withAlpha(c: Float3, a: number): Float4 {
  'worklet';
  return [c[0], c[1], c[2], a];
}

/**
 * three.js light intensities are relative to an exposure of 1; Filament's are physical (lux) under
 * its default camera exposure (f/16, 1/125 s, ISO 100), which maps 1.0 to roughly 38,000 lux.
 */
export const LUX = 38_000;

/** three's point sprites are sized in pixels per unit depth; this is the matching world size. */
export function spriteSize(size: number, fovDeg: number) {
  'worklet';
  return size * Math.tan(((fovDeg / 2) * Math.PI) / 180);
}
