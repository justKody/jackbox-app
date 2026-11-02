import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { AnimalModel } from './animalModel';
import { createBurst, createMotes } from './effects3d';
import { setupRenderer, warmUp } from './gl';
import { Look, lookFor } from './skins';
import { makeGlowTexture, makeRuneTexture, makeSparkleTexture } from './textures';

/**
 * The wardrobe's 3D scene: your animal on a rune pedestal, motes drifting up around it.
 * Owns the render loop; the React side only feeds it gestures and look changes.
 */
export type Stage = {
  setLook(look: Look): void;
  setStill(still: boolean): void;
  grab(): void;
  /** Horizontal drag since the grab, in px. */
  drag(dx: number): void;
  /** Let go with this horizontal velocity (px/ms). */
  release(vx: number): void;
  poke(): void;
  dispose(): void;
};

const SPIN_PER_PX = 0.012;
const SWAP_MS = 760;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createStage(gl: ExpoWebGLRenderingContext, initial: Look, still: boolean, onReady: () => void): Stage {
  const renderer = setupRenderer(gl);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 0.98, 0);

  const glowTex = makeGlowTexture(64, 2);
  const sparkleTex = makeSparkleTexture(64);
  const runeTex = makeRuneTexture(256);

  // Warm key, a rim tinted by the skin, a cool fill.
  const hemi = new THREE.HemisphereLight('#E4DCFF', '#2A1F40', 1.0);
  const key = new THREE.DirectionalLight('#FFF1DD', 2.3);
  key.position.set(2.5, 4, 3.5);
  const rim = new THREE.DirectionalLight('#8C6CFF', 3.0);
  rim.position.set(-3, 2.5, -3);
  const rim2 = new THREE.DirectionalLight('#8C6CFF', 1.4);
  rim2.position.set(3.2, 1.2, -2.2);
  const fill = new THREE.DirectionalLight('#A9C8FF', 0.4);
  fill.position.set(-2.5, 0.6, 2);
  scene.add(hemi, key, rim, rim2, fill);

  // Pedestal: a dark stone dais with a slowly turning rune circle and a soft shadow.
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.14, 0.16, 64), new THREE.MeshStandardMaterial({ color: '#231C3E', roughness: 0.85 }));
  stone.position.y = -0.08;
  const lipMat = new THREE.MeshStandardMaterial({ color: '#40356E', roughness: 0.4, emissive: '#8C6CFF', emissiveIntensity: 0.35 });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.02, 8, 80), lipMat);
  lip.rotation.x = Math.PI / 2;
  const runeMat = new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75, toneMapped: false });
  const runes = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), runeMat);
  runes.rotation.x = -Math.PI / 2;
  runes.position.y = 0.004;
  const shadowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: '#000000', transparent: true, depthWrite: false, opacity: 0.6 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(4, 4, 1);
  halo.position.set(0, 1.0, -1.2);
  scene.add(halo, stone, lip, runes, shadow);

  const holder = new THREE.Group();
  scene.add(holder);
  let animal = new AnimalModel(initial);
  holder.add(animal.root);

  const motes = createMotes(glowTex, 40, [0.65, 1.2], 2.6);
  const burst = createBurst(sparkleTex);
  scene.add(motes.points, burst.points);
  let palette: THREE.Color[] = [];

  let worn = initial;
  /** Recolour the stage around the animal: rim light, runes, halo and motes. */
  const tintStage = (look: Look) => {
    worn = look;
    const p = look.palette;
    rim.color.set(p.aura);
    rim2.color.set(p.eye);
    runeMat.color.set(p.aura);
    haloMat.color.set(p.aura);
    lipMat.emissive.set(p.aura);
    palette = [p.aura, p.eye, p.scarf, '#FFFFFF'].map((c) => new THREE.Color(c));
    motes.tint(palette.slice(0, 3));
  };
  tintStage(initial);

  // --- Interaction & animation state ---
  let isStill = still;
  let yaw = 0;
  let yawVel = 0;
  let grabbed = false;
  let grabYaw = 0;
  let lastTouch = -10;
  let hopAge = Infinity;
  let joyUntil = 0;
  let joyMood: 'cheer' | 'happy' | 'wave' = 'happy';
  // A swap only starts once the incoming animal is fully built, compiled and uploaded,
  // so the moment it replaces the old one mid-spin costs nothing and the twirl never hitches.
  let swap: { next: AnimalModel; look: Look; start: number; swapped: boolean; old?: AnimalModel } | null = null;
  let preparing: Look | null = null;
  let queued: Look | null = null;

  const timer = new THREE.Timer();
  let frame = 0;
  let disposed = false;
  let running = false;

  const fit = () => {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // Keep the whole pedestal in frame on narrow screens.
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(5.6, 2.6 / (2 * halfTan * aspect));
    camera.position.set(0, target.y + dist * 0.12, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  fit();
  let size = [gl.drawingBufferWidth, gl.drawingBufferHeight];

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

    // Spin: free-wheel with friction, then drift home to face you after a pause.
    if (!grabbed) {
      yaw += yawVel * dt;
      yawVel *= Math.pow(0.04, dt);
      if (t - lastTouch > 2.2 && Math.abs(yawVel) < 0.6) {
        const home = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2 + (isStill ? 0 : Math.sin(t * 0.45) * 0.3);
        yaw += (home - yaw) * (1 - Math.pow(0.12, dt));
      }
    }

    // Look swap: a twirl, shrink and little lift, with the new animal swapped in at the
    // midpoint. Progress follows the clock, not frame count, so a slow frame can't stall it.
    let swapSpin = 0;
    let swapScale = 1;
    let swapLift = 0;
    if (swap) {
      const k = Math.min(1, (t - swap.start) / (SWAP_MS / 1000));
      swapSpin = easeInOut(k) * Math.PI * 2;
      swapScale = 1 - Math.sin(Math.PI * k) * 0.22;
      swapLift = Math.sin(Math.PI * k) * 0.12;
      if (!swap.swapped && k >= 0.5) {
        swap.swapped = true;
        swap.old = animal;
        holder.remove(animal.root);
        animal = swap.next;
        holder.add(animal.root);
        tintStage(swap.look);
        burst.fire(new THREE.Vector3(0, 0.9, 0), palette);
      }
      if (k >= 1) {
        // A full turn lands exactly where it started, so dropping the spin here is seamless.
        swapSpin = 0;
        const old = swap.old;
        swap = null;
        // Free the old animal after this frame is drawn, not in the middle of the spin.
        setTimeout(() => old?.dispose(), 0);
        if (queued) {
          const next = queued;
          queued = null;
          if (next.key !== worn.key) prepare(next);
        }
      }
    }

    // Hop on poke: up, then a squashy landing.
    let hop = 0;
    let squash = 1;
    if (hopAge < 1) {
      hopAge += dt * 2;
      const k = Math.min(1, hopAge);
      hop = Math.sin(Math.PI * Math.min(1, k * 1.25)) * 0.3;
      squash = k > 0.75 ? 1 - Math.sin(Math.PI * ((k - 0.75) / 0.25)) * 0.08 : 1 + hop * 0.12;
    }

    animal.setMood(t < joyUntil ? joyMood : 'idle', t);
    animal.setLookAt(grabbed || Math.abs(yawVel) > 1 ? { x: THREE.MathUtils.clamp(-yawVel * 0.25, -1, 1), y: 0 } : null);
    animal.update(t, dt, isStill);

    holder.position.y = hop + swapLift;
    holder.rotation.y = yaw + swapSpin;
    holder.scale.set(swapScale / Math.sqrt(squash), swapScale * squash, swapScale / Math.sqrt(squash));
    shadow.scale.setScalar(1 - hop * 0.6);
    shadowMat.opacity = 0.6 - hop * 0.8;
    runes.rotation.z = isStill ? 0 : t * 0.12;
    runeMat.opacity = 0.6 + Math.sin(t * 1.7) * 0.12 + (t < joyUntil ? 0.2 : 0);

    if (!isStill) motes.update(t, dt);
    burst.update(dt);

    renderer.render(scene, camera);
    gl.endFrameEXP();
  };

  /** Build the incoming animal off-stage, compile its shaders and upload its textures, then twirl. */
  const prepare = (look: Look) => {
    preparing = look;
    // Build on the next frame, so it doesn't share a frame with the React update from the tap.
    requestAnimationFrame(() => build(look));
  };
  const build = (look: Look) => {
    if (disposed) return;
    const next = new AnimalModel(look);
    renderer
      .compileAsync(next.root, camera, scene)
      .catch(() => renderer.compile(next.root, camera, scene))
      .then(() => {
        next.textureList.forEach((tex) => renderer.initTexture(tex));
        preparing = null;
        if (disposed) {
          next.dispose();
          return;
        }
        // Someone picked again while this one was being built: skip straight to the newest.
        if (queued) {
          const latest = queued;
          queued = null;
          if (latest.key !== look.key) {
            next.dispose();
            if (latest.key !== worn.key) prepare(latest);
            return;
          }
        }
        swap = { next, look, start: timer.getElapsed(), swapped: false };
        joyMood = 'cheer';
        joyUntil = timer.getElapsed() + 1.4;
      });
  };

  // Compile shaders first, then show the first frame. Stand-ins in a plain and a glowing skin
  // ride along, so every shader variant a skin can need is ready before the first tap.
  const standIns = [lookFor(initial.species, 'natural'), lookFor(initial.species, 'starweaver')].map((l) => new AnimalModel(l));
  standIns.forEach((m) => scene.add(m.root));
  warmUp(renderer, scene, camera).then(() => {
    // Kept alive off-stage: three deletes a shader once no material uses it.
    standIns.forEach((m) => scene.remove(m.root));
    if (disposed) return;
    running = true;
    render();
    onReady();
  });

  return {
    setLook(look) {
      const target = queued ?? preparing ?? swap?.look ?? worn;
      if (look.key === target.key) return;
      if (!running) {
        // Nothing on screen yet: just swap the model in place.
        holder.remove(animal.root);
        animal.dispose();
        animal = new AnimalModel(look);
        holder.add(animal.root);
        tintStage(look);
        return;
      }
      // Never restart a twirl halfway: queue the newest pick and play it next.
      if (preparing || swap) queued = look;
      else prepare(look);
    },
    setStill(s) {
      isStill = s;
    },
    grab() {
      grabbed = true;
      grabYaw = yaw;
      yawVel = 0;
      lastTouch = timer.getElapsed();
    },
    drag(dx) {
      yaw = grabYaw + dx * SPIN_PER_PX;
      lastTouch = timer.getElapsed();
    },
    release(vx) {
      grabbed = false;
      yawVel = THREE.MathUtils.clamp(vx * 1000 * SPIN_PER_PX, -14, 14);
      lastTouch = timer.getElapsed();
    },
    poke() {
      hopAge = 0;
      joyMood = Math.random() < 0.5 ? 'wave' : 'happy';
      joyUntil = timer.getElapsed() + 1.3;
      burst.fire(new THREE.Vector3(0, 1.3, 0.3), palette, 0.6);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      animal.dispose();
      standIns.forEach((m) => m.dispose());
      swap?.next.dispose();
      swap?.old?.dispose();
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
