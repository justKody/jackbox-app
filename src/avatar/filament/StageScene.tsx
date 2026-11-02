import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EnvironmentalLight,
  FilamentView,
  useEntityInScene,
  useFilamentContext,
  useLightEntity,
  useModel,
  type Entity,
  type FilamentAsset,
  type Float3,
  type FrameInfo,
  type MaterialInstance,
} from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import type { StageCanvasProps } from '../canvasTypes';
import type { Mood } from '../poses';
import type { Look, Species } from '../skins';
import type { Stage } from '../stage';
import { AnimalAsset, type LoadedAnimal } from './AnimalAsset';
import { type AnimalRig, type AnimalState, createAnimalState, rigFor, setMood, stepAnimal } from './animal';
import { FilamentSurface } from './FilamentSurface';
import { PROP_MODELS, PROP_RESTS } from './rig.generated';
import { type Burst, bump, createBurst, dirFrom, fireBurst, firstMaterial, hideAll, post, renderState, updateBurst, useRenderStateId } from './sceneKit';
import { entitiesByName, linear, LUX, setLocal, setRest, spriteSize, withAlpha } from './transforms';

/**
 * The wardrobe's 3D scene on Filament: your animal on a rune pedestal, motes drifting up around it.
 * Same look and feel as the three.js `createStage` (web), but the whole loop runs on the render thread;
 * the JS side only posts gestures and look changes.
 */

const FOV = 30;
const TARGET_Y = 0.98;
const SPIN_PER_PX = 0.012;
const SWAP_MS = 760;
const MOTE_COUNT = 40;
const MOTE_HEIGHT = 2.6;
const MOTE_RADIUS = [0.65, 1.2];

const KEY_COLOR = linear('#FFF1DD');
const FILL_COLOR = linear('#A9C8FF');
const WHITE: Float3 = [1, 1, 1];

type Tint = { aura: Float3; eye: Float3; scarf: Float3 };
const tintFor = (look: Look): Tint => ({ aura: linear(look.palette.aura), eye: linear(look.palette.eye), scarf: linear(look.palette.scarf) });

/** What a loaded animal slot tells the render loop; `v` changes whenever the slot does. */
type SlotInfo = { asset: FilamentAsset; root: Entity; species: Species; tint: Tint; v: number } | null;
type Props = { pedestal: FilamentAsset; halo: FilamentAsset; motes: FilamentAsset; burst: FilamentAsset };

type Slot = { v: number; root: Entity; rig: AnimalRig; anim: AnimalState; tint: Tint };
/** A look queued into a slot; `n` makes every load a fresh mount. */
type SlotLoad = { look: Look; n: number };

type StageState = {
  aspect: number;
  slotV: number[];
  slots: (Slot | null)[];
  active: number;
  tinted: number;
  props: null | {
    runes: Entity;
    runesMat: MaterialInstance;
    shadow: Entity;
    shadowMat: MaterialInstance;
    lipMat: MaterialInstance;
    haloMat: MaterialInstance;
    motes: Entity[];
    moteMats: MaterialInstance[];
    burst: Burst;
  };
  motes: { pos: number[]; speed: number[]; seed: number[] };
  palette: Float3[];
  aura: Float3;
  yaw: number;
  yawVel: number;
  grabbed: boolean;
  grabYaw: number;
  lastTouch: number;
  hopAge: number;
  hopping: boolean;
  joyUntil: number;
  joyMood: Mood;
  seen: { grab: number; drag: number; release: number; poke: number; swap: number };
  swap: { start: number; to: number; swapped: boolean } | null;
};

export function FilamentStage({ look, still, onScene, fallback, ...viewProps }: StageCanvasProps) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <FilamentSurface ready={ready} fallback={fallback} {...viewProps}>
      <StageScene look={look} still={still} onScene={onScene} onReady={onReady} />
    </FilamentSurface>
  );
}

function StageScene({ look, still, onScene, onReady }: { look: Look; still: boolean; onScene: (s: Stage | null) => void; onReady: () => void }) {
  const { transformManager: tm, renderableManager: rm, lightManager, scene, view, camera } = useFilamentContext();
  const id = useRenderStateId('stage');

  // Warm key, a rim tinted by the skin, a second rim in its eye colour, a cool fill; the sky does the ambient.
  const keyLight = useLightEntity(lightManager, { type: 'directional', intensity: 2.3 * LUX, direction: dirFrom([2.5, 4, 3.5]), castShadows: false });
  const rim = useLightEntity(lightManager, { type: 'directional', intensity: 3.0 * LUX, direction: dirFrom([-3, 2.5, -3]), castShadows: false });
  const rim2 = useLightEntity(lightManager, { type: 'directional', intensity: 1.4 * LUX, direction: dirFrom([3.2, 1.2, -2.2]), castShadows: false });
  const fill = useLightEntity(lightManager, { type: 'directional', intensity: 0.4 * LUX, direction: dirFrom([-2.5, 0.6, 2]), castShadows: false });
  useEntityInScene(scene, keyLight);
  useEntityInScene(scene, rim);
  useEntityInScene(scene, rim2);
  useEntityInScene(scene, fill);

  // Props join the scene from the render loop, once they've been placed.
  const pedestal = useModel(PROP_MODELS.pedestal, { addToScene: false });
  const halo = useModel(PROP_MODELS.halo, { addToScene: false });
  const motes = useModel(PROP_MODELS.motes, { addToScene: false });
  const burst = useModel(PROP_MODELS.burst, { addToScene: false });
  const props = useSharedValue<Props | null>(null);
  const p = pedestal.state === 'loaded' ? pedestal.asset : undefined;
  const h = halo.state === 'loaded' ? halo.asset : undefined;
  const m = motes.state === 'loaded' ? motes.asset : undefined;
  const b = burst.state === 'loaded' ? burst.asset : undefined;
  useEffect(() => {
    if (p && h && m && b) post(props, { pedestal: p, halo: h, motes: m, burst: b });
  }, [p, h, m, b, props]);

  // Inputs from the JS side. Counters mark one-off events, so none is missed between frames.
  const slot0 = useSharedValue<SlotInfo>(null);
  const slot1 = useSharedValue<SlotInfo>(null);
  const grabN = useSharedValue(0);
  const dragDx = useSharedValue(0);
  const releaseN = useSharedValue(0);
  const releaseVx = useSharedValue(0);
  const pokeN = useSharedValue(0);
  const pokeWave = useSharedValue(false);
  const swapN = useSharedValue(0);
  const swapTo = useSharedValue(0);
  const stillSV = useSharedValue(still);

  // Two animal slots: the one on show, and the next look loading behind it, so a swap never waits
  // on a load. Each load gets a fresh nonce so picking a look again always reloads its slot.
  const [slots, setSlots] = useState<(SlotLoad | null)[]>([{ look, n: 0 }, null]);
  const flow = useRef({ active: 0, shown: false, busy: false, wanted: look, slots: [{ look, n: 0 }, null] as (SlotLoad | null)[], n: 0, v: 0 });

  const setSlot = useCallback((i: number, l: Look | null) => {
    const f = flow.current;
    f.slots = f.slots.map((s, k) => (k === i ? (l ? { look: l, n: ++f.n } : null) : s));
    setSlots(f.slots);
  }, []);

  const pump = useCallback(() => {
    const f = flow.current;
    const current = f.slots[f.active]?.look;
    if (!f.shown) {
      // Nothing on screen yet: just load the newest pick in place.
      if (current?.key !== f.wanted.key) setSlot(f.active, f.wanted);
      return;
    }
    // Never restart a twirl halfway: the newest pick plays once this one lands.
    if (f.busy || current?.key === f.wanted.key) return;
    f.busy = true;
    setSlot(1 - f.active, f.wanted);
  }, [setSlot]);

  const onSlot = useCallback(
    (i: number, a: LoadedAnimal | null) => {
      const f = flow.current;
      const sv = i === 0 ? slot0 : slot1;
      if (!a) {
        post(sv, null);
        return;
      }
      post(sv, { asset: a.asset, root: a.root, species: a.look.species, tint: tintFor(a.look), v: ++f.v });
      if (i === f.active) {
        if (!f.shown) {
          f.shown = true;
          onReady();
        }
        pump();
        return;
      }
      if (!f.busy || f.slots[i]?.look.key !== a.look.key) return;
      post(swapTo, i);
      bump(swapN);
      setTimeout(() => {
        const old = f.active;
        f.active = i;
        f.busy = false;
        // Stop drawing the old animal first, then unload it a few frames later.
        post(old === 0 ? slot0 : slot1, null);
        setTimeout(() => {
          if (f.active !== old) setSlot(old, null);
          pump();
        }, 120);
      }, SWAP_MS);
    },
    [onReady, pump, setSlot, slot0, slot1, swapN, swapTo],
  );
  const onSlot0 = useCallback((a: LoadedAnimal | null) => onSlot(0, a), [onSlot]);
  const onSlot1 = useCallback((a: LoadedAnimal | null) => onSlot(1, a), [onSlot]);

  useEffect(() => {
    onScene({
      setLook(l) {
        flow.current.wanted = l;
        pump();
      },
      setStill(s) {
        post(stillSV, s);
      },
      grab() {
        post(dragDx, 0);
        bump(grabN);
      },
      drag(dx) {
        post(dragDx, dx);
      },
      release(vx) {
        post(releaseVx, vx);
        bump(releaseN);
      },
      poke() {
        post(pokeWave, Math.random() < 0.5);
        bump(pokeN);
      },
      dispose() {},
    });
    return () => onScene(null);
  }, [onScene, pump, stillSV, dragDx, grabN, releaseVx, releaseN, pokeWave, pokeN]);

  const render = useCallback(
    (frame: FrameInfo) => {
      'worklet';
      const t = frame.passedSeconds;
      const dt = Math.min(0.05, frame.timeSinceLastFrame);
      const s = renderState<StageState>(id, () => {
        lightManager.setColor(keyLight, KEY_COLOR);
        lightManager.setColor(fill, FILL_COLOR);
        return {
          aspect: 0,
          slotV: [0, 0],
          slots: [null, null],
          active: 0,
          tinted: -1,
          props: null,
          motes: { pos: [], speed: [], seed: [] },
          palette: [WHITE],
          aura: WHITE,
          yaw: 0,
          yawVel: 0,
          grabbed: false,
          grabYaw: 0,
          lastTouch: -10,
          hopAge: Infinity,
          hopping: false,
          joyUntil: 0,
          joyMood: 'happy',
          seen: { grab: 0, drag: 0, release: 0, poke: 0, swap: 0 },
          swap: null,
        };
      });

      // Keep the whole pedestal in frame on narrow screens.
      const aspect = view.getAspectRatio();
      if (aspect > 0 && aspect !== s.aspect) {
        s.aspect = aspect;
        camera.setProjection(FOV, aspect, 0.1, 50);
        const halfTan = Math.tan(((FOV / 2) * Math.PI) / 180);
        const dist = Math.max(5.6, 2.6 / (2 * halfTan * aspect));
        camera.lookAt([0, TARGET_Y + dist * 0.12, dist], [0, TARGET_Y, 0], [0, 1, 0]);
      }

      // Pick up newly loaded (or unloaded) animals.
      for (let i = 0; i < 2; i++) {
        const info = (i === 0 ? slot0 : slot1).value;
        const v = info ? info.v : 0;
        if (v === s.slotV[i]) continue;
        s.slotV[i] = v;
        // Copy colours out of the shared value: they arrive as cross-thread proxies.
        const c3 = (c: Float3): Float3 => [c[0], c[1], c[2]];
        s.slots[i] = info ? { v, root: info.root, rig: rigFor(info.asset, info.species), anim: createAnimalState(), tint: { aura: c3(info.tint.aura), eye: c3(info.tint.eye), scarf: c3(info.tint.scarf) } } : null;
        if (i === s.active) s.tinted = -1;
      }

      // Place the props, then let them join the scene.
      const loadedProps = props.value;
      if (!s.props && loadedProps) {
        const ped = entitiesByName(loadedProps.pedestal, ['runes', 'shadow', 'lip']);
        const haloCard = loadedProps.halo.getFirstEntityByName('halo');
        const moteParts: Entity[] = [];
        for (let i = 0; i < MOTE_COUNT; i++) {
          const e = loadedProps.motes.getFirstEntityByName(`m${i}`);
          if (e) moteParts.push(e);
        }
        if (ped.runes && ped.shadow && ped.lip && haloCard) {
          s.props = {
            runes: ped.runes,
            runesMat: firstMaterial(rm, ped.runes),
            shadow: ped.shadow,
            shadowMat: firstMaterial(rm, ped.shadow),
            lipMat: firstMaterial(rm, ped.lip),
            haloMat: firstMaterial(rm, haloCard),
            motes: moteParts,
            moteMats: moteParts.map((e) => firstMaterial(rm, e)),
            burst: createBurst(rm, loadedProps.burst, 40, spriteSize(0.2, FOV)),
          };
          setLocal(tm, haloCard, [0, 1.0, -1.2], [4, 4, 1], 0, 0, 0, null);
          for (let i = 0; i < moteParts.length; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = MOTE_RADIUS[0] + Math.random() * (MOTE_RADIUS[1] - MOTE_RADIUS[0]);
            s.motes.pos.push(Math.cos(a) * r, Math.random() * MOTE_HEIGHT, Math.sin(a) * r);
            s.motes.speed.push(0.12 + Math.random() * 0.22);
            s.motes.seed.push(Math.random() * 10);
          }
          hideAll(tm, s.props.burst.parts);
          s.tinted = -1;
          scene.addAssetEntities(loadedProps.pedestal);
          scene.addAssetEntities(loadedProps.halo);
          scene.addAssetEntities(loadedProps.motes);
          scene.addAssetEntities(loadedProps.burst);
        }
      }
      const P = s.props;

      // Recolour the stage around the animal on show: rim lights, runes, halo, lip and motes.
      const shown = s.slots[s.active];
      if (shown && P && s.tinted !== shown.v) {
        s.tinted = shown.v;
        const { aura, eye, scarf } = shown.tint;
        s.aura = aura;
        s.palette = [aura, eye, scarf, WHITE];
        lightManager.setColor(rim, aura);
        lightManager.setColor(rim2, eye);
        P.haloMat.setFloat4Parameter('baseColorFactor', withAlpha(aura, 0.3));
        P.lipMat.setFloat3Parameter('emissiveFactor', [aura[0] * 0.35, aura[1] * 0.35, aura[2] * 0.35]);
        for (let i = 0; i < P.moteMats.length; i++) P.moteMats[i].setFloat4Parameter('baseColorFactor', withAlpha(s.palette[i % 3], 1));
      }

      // Gestures.
      if (grabN.value !== s.seen.grab) {
        s.seen.grab = grabN.value;
        s.grabbed = true;
        s.grabYaw = s.yaw;
        s.yawVel = 0;
        s.lastTouch = t;
      }
      if (s.grabbed) {
        const dx = dragDx.value;
        if (dx !== s.seen.drag) {
          s.seen.drag = dx;
          s.lastTouch = t;
        }
        s.yaw = s.grabYaw + dx * SPIN_PER_PX;
      }
      if (releaseN.value !== s.seen.release) {
        s.seen.release = releaseN.value;
        s.grabbed = false;
        s.yawVel = Math.max(-14, Math.min(14, releaseVx.value * 1000 * SPIN_PER_PX));
        s.lastTouch = t;
      }
      if (pokeN.value !== s.seen.poke) {
        s.seen.poke = pokeN.value;
        s.hopAge = 0;
        s.joyMood = pokeWave.value ? 'wave' : 'happy';
        s.joyUntil = t + 1.3;
        if (P) fireBurst(P.burst, [0, 1.3, 0.3], s.palette, 0.6);
      }
      if (swapN.value !== s.seen.swap) {
        s.seen.swap = swapN.value;
        s.swap = { start: t, to: swapTo.value, swapped: false };
        s.joyMood = 'cheer';
        s.joyUntil = t + 1.4;
      }
      const still = stillSV.value;

      // Spin: free-wheel with friction, then drift home to face you after a pause.
      if (!s.grabbed) {
        s.yaw += s.yawVel * dt;
        s.yawVel *= Math.pow(0.04, dt);
        if (t - s.lastTouch > 2.2 && Math.abs(s.yawVel) < 0.6) {
          const home = Math.round(s.yaw / (Math.PI * 2)) * Math.PI * 2 + (still ? 0 : Math.sin(t * 0.45) * 0.3);
          s.yaw += (home - s.yaw) * (1 - Math.pow(0.12, dt));
        }
      }

      // Look swap: a twirl, shrink and little lift, with the new animal swapped in at the midpoint.
      let swapSpin = 0;
      let swapScale = 1;
      let swapLift = 0;
      if (s.swap) {
        const k = Math.min(1, (t - s.swap.start) / (SWAP_MS / 1000));
        swapSpin = (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) * Math.PI * 2;
        swapScale = 1 - Math.sin(Math.PI * k) * 0.22;
        swapLift = Math.sin(Math.PI * k) * 0.12;
        if (!s.swap.swapped && k >= 0.5) {
          s.swap.swapped = true;
          s.active = s.swap.to;
          s.tinted = -1;
          const next = s.slots[s.active];
          if (P && next) fireBurst(P.burst, [0, 0.9, 0], [next.tint.aura, next.tint.eye, next.tint.scarf, WHITE], 1);
        }
        // A full turn lands exactly where it started, so dropping the spin here is seamless.
        if (k >= 1) {
          swapSpin = 0;
          s.swap = null;
        }
      }

      // Hop on poke: up, then a squashy landing.
      let hop = 0;
      let squash = 1;
      if (s.hopAge < 1) {
        s.hopAge += dt * 2;
        const k = Math.min(1, s.hopAge);
        hop = Math.sin(Math.PI * Math.min(1, k * 1.25)) * 0.3;
        squash = k > 0.75 ? 1 - Math.sin(Math.PI * ((k - 0.75) / 0.25)) * 0.08 : 1 + hop * 0.12;
      }

      tm.openLocalTransformTransaction();
      for (let i = 0; i < 2; i++) {
        const slot = s.slots[i];
        if (!slot) continue;
        if (i !== s.active) {
          setLocal(tm, slot.root, [0, 0, 0], [0, 0, 0], 0, 0, 0, null);
          continue;
        }
        setMood(slot.anim, t < s.joyUntil ? s.joyMood : 'idle', t);
        slot.anim.forced = s.grabbed || Math.abs(s.yawVel) > 1 ? { x: Math.max(-1, Math.min(1, -s.yawVel * 0.25)), y: 0 } : null;
        stepAnimal(tm, slot.rig, slot.anim, t, dt, still);
        const wide = swapScale / Math.sqrt(squash);
        setLocal(tm, slot.root, [0, hop + swapLift, 0], [wide, swapScale * squash, wide], 0, s.yaw + swapSpin, 0, null);
      }

      if (P) {
        const ped = PROP_RESTS.pedestal;
        if (s.hopAge < 1 || s.hopping) {
          s.hopping = s.hopAge < 1;
          setRest(tm, P.shadow, ped.shadow, 1 - hop * 0.6);
          P.shadowMat.setFloat4Parameter('baseColorFactor', [0, 0, 0, 0.6 - hop * 0.8]);
        }
        setRest(tm, P.runes, ped.runes, 1, still ? 0 : t * 0.12);
        P.runesMat.setFloat4Parameter('baseColorFactor', withAlpha(s.aura, 0.6 + Math.sin(t * 1.7) * 0.12 + (t < s.joyUntil ? 0.2 : 0)));

        // Motes drift up around the pedestal and respawn at the bottom.
        const m = s.motes;
        const size = spriteSize(0.07, FOV);
        for (let i = 0; i < P.motes.length; i++) {
          if (!still) {
            const y = m.pos[i * 3 + 1] + m.speed[i] * dt;
            if (y > MOTE_HEIGHT) {
              const a = Math.random() * Math.PI * 2;
              const r = MOTE_RADIUS[0] + Math.random() * (MOTE_RADIUS[1] - MOTE_RADIUS[0]);
              m.pos[i * 3] = Math.cos(a) * r;
              m.pos[i * 3 + 1] = 0;
              m.pos[i * 3 + 2] = Math.sin(a) * r;
              m.speed[i] = 0.12 + Math.random() * 0.22;
              m.seed[i] = Math.random() * 10;
            } else {
              m.pos[i * 3 + 1] = y;
              m.pos[i * 3] += Math.sin(t * 0.9 + m.seed[i]) * dt * 0.06;
            }
          }
          setLocal(tm, P.motes[i], [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]], [size, size, 1], 0, 0, 0, null);
        }
        updateBurst(tm, P.burst, dt);
      }
      tm.commitLocalTransformTransaction();
    },
    [id, tm, rm, lightManager, scene, view, camera, keyLight, rim, rim2, fill, props, slot0, slot1, grabN, dragDx, releaseN, releaseVx, pokeN, pokeWave, swapN, swapTo, stillSV],
  );

  return (
    <FilamentView style={{ flex: 1 }} renderCallback={render}>
      <EnvironmentalLight source={{ uri: 'RNF_default_env_ibl.ktx' }} intensity={1.0 * LUX} />
      {slots[0] && <AnimalAsset key={`a${slots[0].n}`} look={slots[0].look} onLoad={onSlot0} />}
      {slots[1] && <AnimalAsset key={`b${slots[1].n}`} look={slots[1].look} onLoad={onSlot1} />}
    </FilamentView>
  );
}
