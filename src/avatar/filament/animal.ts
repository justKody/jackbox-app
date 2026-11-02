import type { Entity, FilamentAsset, TransformManager } from 'react-native-filament';
import { type Mood, type Pose, POSE_KEYS, POSES } from '../poses';
import type { Species } from '../skins';
import { ANIMAL_RIGS, type Rest } from './rig.generated';
import { entitiesByName, setLocal } from './transforms';

/**
 * The animal's pose rig on Filament's render thread: the same eased moods, bounce, blinks and
 * glances as `AnimalModel.update`, written straight onto the joints of the baked .glb.
 */

export type AnimalRig = { joints: Record<string, Entity>; rests: Record<string, Rest> };

export type AnimalState = {
  pose: Pose;
  mood: Mood;
  moodAt: number;
  blinkAt: number;
  blinkAge: number;
  look: { x: number; y: number };
  lookTarget: { x: number; y: number };
  lookAt: number;
  /** Desynchronises idle loops when several animals stand side by side. */
  phase: number;
  /** Point the eyes (and a little of the head) somewhere, -1..1; null lets them wander. */
  forced: { x: number; y: number } | null;
};

export function rigFor(asset: FilamentAsset, species: Species): AnimalRig {
  'worklet';
  const rests = ANIMAL_RIGS[species];
  return { joints: entitiesByName(asset, Object.keys(rests)), rests };
}

export function createAnimalState(): AnimalState {
  'worklet';
  return {
    pose: { ...POSES.idle },
    mood: 'idle',
    moodAt: 0,
    blinkAt: 1 + Math.random() * 2,
    blinkAge: 9,
    look: { x: 0, y: 0 },
    lookTarget: { x: 0, y: 0 },
    lookAt: Math.random() * 2,
    phase: Math.random() * 10,
    forced: null,
  };
}

export function setMood(st: AnimalState, mood: Mood, now: number) {
  'worklet';
  if (mood === st.mood) return;
  st.mood = mood;
  st.moodAt = now;
}

export function stepAnimal(tm: TransformManager, rig: AnimalRig, st: AnimalState, time: number, dt: number, still: boolean) {
  'worklet';
  const target = POSES[st.mood];
  const k = 1 - Math.pow(0.004, dt);
  for (const key of POSE_KEYS) st.pose[key] += (target[key] - st.pose[key]) * k;
  const p = st.pose;
  const t = still ? 0 : time + st.phase;
  const since = time - st.moodAt;
  const { joints: j, rests: r } = rig;

  // Bounce: a soft breathe at rest, real hops when cheering.
  const wave = Math.sin(t * p.hz * Math.PI * 2);
  const hop = st.mood === 'cheer' ? Math.abs(wave) : wave * 0.5 + 0.5;
  const squash = 1 + (st.mood === 'cheer' ? (hop < 0.15 ? -0.06 : 0.02) : wave * 0.012);
  const thin = 1 / Math.sqrt(squash);
  if (j.body) setLocal(tm, j.body, [r.body.p[0], r.body.p[1] + hop * p.bounce - p.sink, r.body.p[2]], [thin, squash, thin], 0, 0, 0, null);

  // Blinks, at irregular intervals.
  if (time > st.blinkAt) {
    st.blinkAge = 0;
    st.blinkAt = time + 1.8 + Math.random() * 3.4;
  }
  st.blinkAge += dt;
  const blink = st.blinkAge < 0.2 ? Math.sin((st.blinkAge / 0.2) * Math.PI) : 0;
  const lid = Math.max(blink, p.squint * 0.6);

  // Glances: forced, mood-driven, or wandering.
  if (time > st.lookAt) {
    const centre = Math.random() < 0.4;
    st.lookTarget = centre ? { x: 0, y: 0 } : { x: Math.random() * 2 - 1, y: Math.random() * 1.2 - 0.5 };
    st.lookAt = time + 1.2 + Math.random() * 2.4;
  }
  const want = st.forced ?? (st.mood === 'think' ? { x: 0.6, y: 0.8 } : st.mood === 'sad' ? { x: 0, y: -0.9 } : st.lookTarget);
  const lk = 1 - Math.pow(0.002, dt);
  st.look.x += (want.x - st.look.x) * lk;
  st.look.y += (want.y - st.look.y) * lk;

  // A quick nod whenever the mood changes, so the switch reads.
  const nodKick = since < 0.45 ? Math.sin((since / 0.45) * Math.PI) * 0.16 : 0;
  if (j.head) setLocal(tm, j.head, r.head.p, r.head.s, p.nod + nodKick + Math.sin(t * 1.3) * 0.02, st.look.x * 0.18, p.tilt + Math.sin(t * 0.9) * 0.03, null);

  const waveArm = p.wave * Math.sin(time * 12) * 0.35;
  if (j.armL) setLocal(tm, j.armL, r.armL.p, r.armL.s, -p.armL * 0.22, 0, -(p.armL + Math.sin(t * 1.7) * 0.04), null);
  if (j.armR) setLocal(tm, j.armR, r.armR.p, r.armR.s, -p.armR * (st.mood === 'think' ? 0.75 : 0.22), 0, p.armR + waveArm + Math.sin(t * 1.7 + 1) * 0.04, null);

  for (let i = 0; i < 2; i++) {
    const ear = j[`ear${i}`];
    if (!ear) continue;
    const rest = r[`ear${i}`];
    const side = i === 0 ? -1 : 1;
    const twitch = Math.sin(t * 0.7 + side * 2) > 0.985 ? 0.2 : 0;
    setLocal(tm, ear, rest.p, rest.s, p.droop * 0.5 + Math.sin(t * 2.3 + side) * 0.03, 0, rest.e[2] - side * (p.droop * 0.7 + twitch), null);
  }
  if (j.tail) setLocal(tm, j.tail, r.tail.p, r.tail.s, -p.droop * 0.3, Math.sin(t * (st.mood === 'cheer' ? 7 : 2.1)) * (st.mood === 'sad' ? 0.05 : 0.22), 0, null);

  for (let i = 0; i < 2; i++) {
    const lidJoint = j[`blink${i}`];
    const lookJoint = j[`look${i}`];
    if (lidJoint) setLocal(tm, lidJoint, r[`blink${i}`].p, [1, 1 - lid * 0.92, 1], 0, 0, 0, r[`blink${i}`].r);
    if (lookJoint) setLocal(tm, lookJoint, [st.look.x * 0.026, st.look.y * 0.02, r[`look${i}`].p[2]], [1, 1, 1], 0, 0, 0, null);
  }

  if (j.mouth) {
    const open = Math.max(0, p.mouth);
    setLocal(tm, j.mouth, r.mouth.p, [1 + open * 0.25, p.mouth < 0 ? -0.8 : 1 + open * 1.4, 1], 0, 0, 0, r.mouth.r);
  }
}
