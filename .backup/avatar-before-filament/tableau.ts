import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { AnimalModel, Mood } from './animalModel';
import { createBurst } from './effects3d';
import { setupRenderer, warmUp } from './gl';
import type { Look } from './skins';
import { makeGlowTexture, makeRuneTexture, makeSparkleTexture } from './textures';

/**
 * The game table: every player's animal standing in a column, one per leaderboard row, reacting
 * to the round and climbing past each other as the standings change.
 * One GL context for the whole table, mounted once per match so phase changes never reload it.
 */

/** How long the standings wait after the scores land before reshuffling, and how long a swap takes. */
export const SWAP_DELAY_MS = 550;
export const SWAP_MS = 750;

/** Animal size relative to a row, and where its feet sit within the row (0 top, 1 bottom). */
const ANIMAL_SCALE = 0.62;
const FEET = 0.9;

/** Where the rows sit on the canvas, in layout px, so each animal stands in its own row. */
export type TableLayout = { top: number; rowH: number; pitch: number; height: number };

export type TableSeat = { id: string; look: Look; color: string };

export type Tableau = {
  setMoods(moods: Record<string, Mood>, spotlight: string | null): void;
  /** Each seat's place in the standings (0 = top row); a change slides the animal to its new row. */
  setRanks(ranks: Record<string, number>): void;
  setLayout(layout: TableLayout): void;
  /** A sparkle pop over one seat, e.g. when they lock in a call. */
  sparkle(id: string): void;
  setStill(still: boolean): void;
  dispose(): void;
};

type Slot = {
  id: string;
  animal: AnimalModel;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  base: THREE.Group;
  color: THREE.Color;
  lift: number;
  /** The row it's sliding between, and when (in timer seconds) the slide starts. */
  from: number;
  to: number;
  moveAt: number;
};

const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function createTableau(gl: ExpoWebGLRenderingContext, seats: TableSeat[], initial: { layout: TableLayout; ranks: Record<string, number> }, still: boolean, onReady: () => void): Tableau {
  const renderer = setupRenderer(gl);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 200);

  const glowTex = makeGlowTexture(64, 2);
  const sparkleTex = makeSparkleTexture(64);
  const runeTex = makeRuneTexture(128);

  const hemi = new THREE.HemisphereLight('#E4DCFF', '#2A1F40', 1.1);
  const key = new THREE.DirectionalLight('#FFF1DD', 2.2);
  key.position.set(2, 4, 5);
  const rim = new THREE.DirectionalLight('#8C6CFF', 2.4);
  rim.position.set(-2, 3, -4);
  scene.add(hemi, key, rim);

  // The halo that glows behind the current guesser.
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: '#F4C15D', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(1.5, 1.5, 1);
  scene.add(halo);

  const slots: Slot[] = seats.map((seat) => {
    const base = new THREE.Group();
    const color = new THREE.Color(seat.color);
    const ringMat = new THREE.MeshBasicMaterial({ map: runeTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: glowTex, color: '#000000', transparent: true, depthWrite: false, opacity: 0.55 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    const animal = new AnimalModel(seat.look);
    // Turned a little towards the name beside it.
    animal.root.rotation.y = 0.35;
    base.add(ring, shadow, animal.root);
    scene.add(base);
    const row = initial.ranks[seat.id] ?? 0;
    return { id: seat.id, animal, ring, ringMat, base, color, lift: 0, from: row, to: row, moveAt: 0 };
  });

  const burst = createBurst(sparkleTex, 24, 0.16);
  scene.add(burst.points);

  let isStill = still;
  let spot: string | null = null;
  let layout = initial.layout;
  const moods: Record<string, Mood> = {};
  const timer = new THREE.Timer();
  let frame = 0;
  let disposed = false;

  const fit = () => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // One world unit per row height, so the animals stay the same size however many rows there are.
    const viewH = layout.height / layout.rowH;
    const dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0.6, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  fit();
  let size = [gl.drawingBufferWidth, gl.drawingBufferHeight];

  // Where on the z = 0 plane a row's feet line lands on screen; row can be fractional mid-slide.
  const ray = new THREE.Vector3();
  const rowFeet = (row: number, out: THREE.Vector3) => {
    const frac = (layout.top + row * layout.pitch + layout.rowH * FEET) / layout.height;
    ray.set(0, 1 - 2 * frac, 0.5).unproject(camera).sub(camera.position).normalize();
    return out.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);
  };
  const feet = new THREE.Vector3();

  const render = () => {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    timer.update();
    const dt = Math.min(0.05, timer.getDelta());
    const t = timer.getElapsed();
    if (gl.drawingBufferWidth !== size[0] || gl.drawingBufferHeight !== size[1]) {
      size = [gl.drawingBufferWidth, gl.drawingBufferHeight];
      fit();
    }

    const ease = 1 - Math.pow(0.01, dt);
    for (const s of slots) {
      const lit = s.id === spot;
      // The guesser steps forward into the light.
      s.lift += ((lit ? 1 : 0) - s.lift) * ease;

      const p = s.from === s.to ? 1 : Math.min(1, Math.max(0, (t - s.moveAt) / (SWAP_MS / 1000)));
      if (p >= 1) s.from = s.to;
      const row = s.from + (s.to - s.from) * easeInOutCubic(p);
      // Climbers hop out in front of whoever they pass; anyone slipping down ducks behind.
      const arc = Math.sin(p * Math.PI);
      const climbing = s.to < s.from;
      rowFeet(row, feet);
      s.base.position.set(feet.x, feet.y + (climbing ? arc * 0.3 : 0), s.lift * 0.35 + (climbing ? arc * 0.9 : -arc * 0.5));
      s.base.scale.setScalar(ANIMAL_SCALE * (1 + s.lift * 0.06 + (climbing ? arc * 0.12 : 0)));

      s.ringMat.opacity = 0.35 + s.lift * 0.45 + (isStill ? 0 : Math.sin(t * 2 + row) * 0.06);
      s.ring.rotation.z = isStill ? 0 : t * (lit ? 0.6 : 0.15);
      s.animal.setMood(moods[s.id] ?? 'idle', t);
      s.animal.update(t, dt, isStill);
    }
    const lit = slots.find((s) => s.id === spot);
    if (lit) halo.position.set(lit.base.position.x, lit.base.position.y + 0.45, lit.base.position.z - 0.6);
    haloMat.opacity += ((lit ? 0.42 + Math.sin(t * 2.4) * 0.06 : 0) - haloMat.opacity) * ease;

    burst.update(dt);
    renderer.render(scene, camera);
    gl.endFrameEXP();
  };

  warmUp(renderer, scene, camera).then(() => {
    if (disposed) return;
    render();
    onReady();
  });

  return {
    setMoods(next, spotlight) {
      Object.assign(moods, next);
      spot = spotlight;
    },
    setRanks(ranks) {
      const now = timer.getElapsed();
      for (const s of slots) {
        const to = ranks[s.id];
        if (to === undefined || to === s.to) continue;
        // Pick up from wherever it is, in case the standings change mid-slide.
        const p = Math.min(1, Math.max(0, (now - s.moveAt) / (SWAP_MS / 1000)));
        s.from = isStill ? to : s.from + (s.to - s.from) * easeInOutCubic(p);
        s.to = to;
        s.moveAt = now + SWAP_DELAY_MS / 1000;
      }
    },
    setLayout(next) {
      layout = next;
      fit();
    },
    sparkle(id) {
      const s = slots.find((x) => x.id === id);
      if (!s) return;
      const at = s.base.position;
      burst.fire(new THREE.Vector3(at.x, at.y + 0.8, at.z + 0.3), [s.color, new THREE.Color('#FFFFFF'), new THREE.Color('#F4C15D')], 0.55);
    },
    setStill(v) {
      isStill = v;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      slots.forEach((s) => s.animal.dispose());
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      haloMat.dispose();
      [glowTex, sparkleTex, runeTex].forEach((tex) => tex.dispose());
      renderer.dispose();
    },
  };
}
