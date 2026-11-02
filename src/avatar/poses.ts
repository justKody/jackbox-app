/**
 * The animals' moods and the pose each one eases towards. Shared by the three.js model (web) and
 * the Filament rig (native), so both read the same.
 */

export type Mood = 'idle' | 'think' | 'ready' | 'cheer' | 'sad' | 'wave' | 'happy';

export type Pose = { armL: number; armR: number; wave: number; tilt: number; nod: number; bounce: number; hz: number; droop: number; squint: number; sink: number; mouth: number };

export const POSE_KEYS: (keyof Pose)[] = ['armL', 'armR', 'wave', 'tilt', 'nod', 'bounce', 'hz', 'droop', 'squint', 'sink', 'mouth'];

export const POSES: Record<Mood, Pose> = {
  idle: { armL: 0.14, armR: 0.14, wave: 0, tilt: 0, nod: 0, bounce: 0.014, hz: 1.6, droop: 0, squint: 0, sink: 0, mouth: 0 },
  think: { armL: 0.1, armR: 1.35, wave: 0, tilt: 0.22, nod: -0.12, bounce: 0.008, hz: 1.1, droop: 0.15, squint: 0.15, sink: 0, mouth: 0 },
  ready: { armL: 0.18, armR: 0.75, wave: 0, tilt: -0.06, nod: 0.06, bounce: 0.022, hz: 2.2, droop: 0, squint: 0.35, sink: 0, mouth: 0.4 },
  happy: { armL: 0.6, armR: 0.6, wave: 0, tilt: 0.05, nod: -0.05, bounce: 0.05, hz: 2.2, droop: 0, squint: 0.8, sink: 0, mouth: 0.8 },
  cheer: { armL: 2.55, armR: 2.55, wave: 0, tilt: 0, nod: -0.12, bounce: 0.17, hz: 2.6, droop: 0, squint: 1, sink: 0, mouth: 1 },
  sad: { armL: -0.04, armR: -0.04, wave: 0, tilt: -0.1, nod: 0.34, bounce: 0.004, hz: 0.8, droop: 1, squint: 0, sink: 0.035, mouth: -0.6 },
  wave: { armL: 0.14, armR: 2.3, wave: 1, tilt: 0.12, nod: -0.04, bounce: 0.02, hz: 2, droop: 0, squint: 0.55, sink: 0, mouth: 0.6 },
};
