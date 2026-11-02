import * as THREE from 'three';
import type { Look, Species } from './skins';
import { LookTextures, makeLookTextures } from './textures';

/**
 * A chibi animal built from code: big head, round body, stubby paws and a knitted scarf,
 * plus species features (ears, snout or beak, tail). Faces +z, feet at y = 0, ~1.9 tall with ears.
 *
 * `mood` drives a small pose rig (paws, head, ears, bounce) that eases between states,
 * so the game can say "cheer" or "sad" and the character gets there smoothly.
 */

export type Mood = 'idle' | 'think' | 'ready' | 'cheer' | 'sad' | 'wave' | 'happy';

type Pose = { armL: number; armR: number; wave: number; tilt: number; nod: number; bounce: number; hz: number; droop: number; squint: number; sink: number; mouth: number };

const POSES: Record<Mood, Pose> = {
  idle: { armL: 0.14, armR: 0.14, wave: 0, tilt: 0, nod: 0, bounce: 0.014, hz: 1.6, droop: 0, squint: 0, sink: 0, mouth: 0 },
  think: { armL: 0.1, armR: 1.35, wave: 0, tilt: 0.22, nod: -0.12, bounce: 0.008, hz: 1.1, droop: 0.15, squint: 0.15, sink: 0, mouth: 0 },
  ready: { armL: 0.18, armR: 0.75, wave: 0, tilt: -0.06, nod: 0.06, bounce: 0.022, hz: 2.2, droop: 0, squint: 0.35, sink: 0, mouth: 0.4 },
  happy: { armL: 0.6, armR: 0.6, wave: 0, tilt: 0.05, nod: -0.05, bounce: 0.05, hz: 2.2, droop: 0, squint: 0.8, sink: 0, mouth: 0.8 },
  cheer: { armL: 2.55, armR: 2.55, wave: 0, tilt: 0, nod: -0.12, bounce: 0.17, hz: 2.6, droop: 0, squint: 1, sink: 0, mouth: 1 },
  sad: { armL: -0.04, armR: -0.04, wave: 0, tilt: -0.1, nod: 0.34, bounce: 0.004, hz: 0.8, droop: 1, squint: 0, sink: 0.035, mouth: -0.6 },
  wave: { armL: 0.14, armR: 2.3, wave: 1, tilt: 0.12, nod: -0.04, bounce: 0.02, hz: 2, droop: 0, squint: 0.55, sink: 0, mouth: 0.6 },
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const NECK_Y = 0.84;
/** Head centre in head-local space, and its radii. */
const HEAD = v(0, 0.36, 0);

type Mats = {
  fur: THREE.MeshStandardMaterial;
  deep: THREE.MeshStandardMaterial;
  belly: THREE.MeshStandardMaterial;
  blush: THREE.MeshStandardMaterial;
  nose: THREE.MeshStandardMaterial;
  scarf: THREE.MeshStandardMaterial;
  iris: THREE.MeshBasicMaterial;
  dark: THREE.MeshBasicMaterial;
  white: THREE.MeshBasicMaterial;
  socket: THREE.MeshStandardMaterial;
};

type Ear = { group: THREE.Group; side: number };

export class AnimalModel {
  /** Spin, hop and scale belong to whoever owns the model; the body handles its own bounce. */
  readonly root = new THREE.Group();
  readonly species: Species;

  private body = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private tail = new THREE.Group();
  private mouth = new THREE.Group();
  private ears: Ear[] = [];
  private eyes: { blink: THREE.Group; look: THREE.Group }[] = [];
  private mats: Mats;
  private textures?: LookTextures;
  private headScale: THREE.Vector3;

  private pose: Pose = { ...POSES.idle };
  private mood: Mood = 'idle';
  private moodAt = 0;
  private blinkAt = 1 + Math.random() * 2;
  private blinkAge = 9;
  private look = { x: 0, y: 0 };
  private lookTarget = { x: 0, y: 0 };
  private lookAt = Math.random() * 2;
  /** Desynchronises idle loops when several animals stand side by side. */
  private phase = Math.random() * 10;

  constructor(look: Look) {
    this.species = look.species;
    this.headScale = look.species === 'frog' ? v(1.22, 0.84, 1.02) : look.species === 'owl' ? v(1.12, 1.0, 0.98) : v(1.08, 0.95, 0.95);
    const std = (p: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...p });
    this.mats = {
      fur: std(),
      deep: std(),
      belly: std({ roughness: 0.9 }),
      blush: std({ transparent: true, opacity: 0.55, depthWrite: false }),
      nose: std({ roughness: 0.35 }),
      scarf: std({ roughness: 0.95 }),
      iris: new THREE.MeshBasicMaterial({ toneMapped: false }),
      dark: new THREE.MeshBasicMaterial({ color: '#140C18' }),
      white: new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false }),
      socket: std({ color: '#120E1E', roughness: 0.3 }),
    };
    this.root.add(this.body);
    this.buildBody();
    this.buildHead();
    this.buildSpecies(look.species);
    this.setLook(look);
  }

  // ─── Construction ────────────────────────────────────────────────────────

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, pos?: THREE.Vector3, scale?: THREE.Vector3) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    if (scale) m.scale.copy(scale);
    parent.add(m);
    return m;
  }

  /** A point on the head's surface: `yaw` round from the front, `pitch` up from the equator. */
  private onHead(yaw: number, pitch: number, lift = 0) {
    const dir = v(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const r = 0.44 + lift;
    const pos = HEAD.clone().add(v(dir.x * r * this.headScale.x, dir.y * r * this.headScale.y, dir.z * r * this.headScale.z));
    const normal = v(dir.x / this.headScale.x, dir.y / this.headScale.y, dir.z / this.headScale.z).normalize();
    return { pos, normal };
  }

  /** A group sitting on the head surface with local +z pointing outwards. */
  private headMount(yaw: number, pitch: number, lift = 0) {
    const { pos, normal } = this.onHead(yaw, pitch, lift);
    const g = new THREE.Group();
    g.position.copy(pos);
    g.lookAt(pos.clone().add(normal));
    this.head.add(g);
    return g;
  }

  private buildBody() {
    const { fur, deep, belly, scarf } = this.mats;
    this.mesh(new THREE.SphereGeometry(0.4, 32, 24), fur, this.body, v(0, 0.46, 0), v(1, 1.08, 0.92));
    this.mesh(new THREE.SphereGeometry(0.3, 28, 20), belly, this.body, v(0, 0.42, 0.19), v(0.95, 1.05, 0.55));
    for (const side of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.13, 18, 12), deep, this.body, v(side * 0.17, 0.07, 0.1), v(1, 0.55, 1.35));

    // Paws hang from shoulder pivots so a pose can raise them.
    for (const [side, arm] of [
      [-1, this.armL],
      [1, this.armR],
    ] as const) {
      arm.position.set(side * 0.35, 0.66, 0.03);
      this.mesh(new THREE.SphereGeometry(0.12, 18, 14), fur, arm, v(side * 0.05, -0.15, 0.02), v(0.62, 1.15, 0.62));
      this.mesh(new THREE.SphereGeometry(0.07, 14, 10), deep, arm, v(side * 0.07, -0.27, 0.04));
      this.body.add(arm);
    }

    // Scarf: a knitted ring with a tail hanging down the front.
    const ring = this.mesh(new THREE.TorusGeometry(0.27, 0.075, 12, 40), scarf, this.body, v(0, 0.8, 0), v(1, 0.92, 1));
    ring.rotation.x = Math.PI / 2;
    const tail = this.mesh(new THREE.CapsuleGeometry(0.07, 0.2, 4, 10), scarf, this.body, v(0.15, 0.63, 0.27), v(1, 1, 0.45));
    tail.rotation.set(-0.25, 0, 0.28);

    this.tail.position.set(0, 0.36, -0.34);
    this.body.add(this.tail);
    this.head.position.y = NECK_Y;
    this.body.add(this.head);
  }

  private buildHead() {
    const { fur, blush, socket, iris, dark, white } = this.mats;
    const frog = this.species === 'frog';
    this.mesh(new THREE.SphereGeometry(0.44, 40, 30), fur, this.head, HEAD, this.headScale);

    // Eyes: frogs wear theirs on top, in little bumps.
    for (const side of [-1, 1]) {
      let mount: THREE.Group;
      if (frog) {
        const bump = this.onHead(side * 0.42, 0.62, -0.06);
        this.mesh(new THREE.SphereGeometry(0.15, 20, 16), fur, this.head, bump.pos);
        mount = new THREE.Group();
        mount.position.copy(bump.pos).add(v(0, 0.02, 0.1));
        mount.lookAt(mount.position.clone().add(v(side * 0.25, 0.25, 1)));
        this.head.add(mount);
      } else {
        mount = this.headMount(side * 0.37, this.species === 'owl' ? 0.1 : 0.04, -0.012);
      }
      const blink = new THREE.Group();
      const s = this.species === 'owl' ? 1.15 : 1;
      this.mesh(new THREE.SphereGeometry(0.1 * s, 24, 16), socket, blink, undefined, v(1, 1.15, 0.42));
      const look = new THREE.Group();
      look.position.z = 0.044 * s;
      this.mesh(new THREE.CircleGeometry(0.078 * s, 28), iris, look, undefined, v(1, 1.14, 1));
      this.mesh(new THREE.CircleGeometry(0.036 * s, 20), dark, look, v(0, -0.004, 0.001), v(1, 1.2, 1));
      this.mesh(new THREE.CircleGeometry(0.023 * s, 14), white, look, v(-0.028 * s, 0.036 * s, 0.002));
      this.mesh(new THREE.CircleGeometry(0.011 * s, 10), white, look, v(0.028 * s, -0.032 * s, 0.002));
      blink.add(look);
      mount.add(blink);
      this.eyes.push({ blink, look });

      // Blush
      const cheek = this.headMount(side * 0.62, -0.18, 0.004);
      this.mesh(new THREE.SphereGeometry(0.075, 16, 10), blush, cheek, undefined, v(1, 0.62, 0.25));
    }
  }

  private buildSpecies(species: Species) {
    const { fur, deep, belly, blush, nose } = this.mats;
    const ear = (yaw: number, pitch: number, side: number, build: (g: THREE.Group) => void, tilt = 0.3) => {
      const g = new THREE.Group();
      g.position.copy(this.onHead(yaw, pitch, -0.04).pos);
      g.rotation.z = -side * tilt;
      build(g);
      this.head.add(g);
      this.ears.push({ group: g, side });
    };
    const smile = (mount: THREE.Group, width = 0.05) => {
      const curve = new THREE.QuadraticBezierCurve3(v(-width, 0.01, 0), v(0, -width * 0.7, 0.01), v(width, 0.01, 0));
      this.mesh(new THREE.TubeGeometry(curve, 12, 0.011, 6, false), this.mats.dark, this.mouth);
      this.mouth.position.copy(mount.position);
      this.mouth.quaternion.copy(mount.quaternion);
      this.head.add(this.mouth);
    };
    const muzzleDots = () => {
      // Cat & bunny: two puffy cheeks under a little nose.
      const m = this.headMount(0, -0.3, -0.03);
      for (const side of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.085, 16, 12), belly, m, v(side * 0.06, 0, 0.02), v(1, 0.85, 0.7));
      const n = this.mesh(new THREE.ConeGeometry(0.032, 0.03, 3), nose, m, v(0, 0.06, 0.06));
      n.rotation.set(Math.PI / 2, 0, Math.PI);
      const mouth = this.headMount(0, -0.42, 0.04);
      smile(mouth, 0.035);
      return m;
    };

    switch (species) {
      case 'fox': {
        // White lower face, a long snout, tall pointed ears and a big brush of a tail.
        this.mesh(new THREE.SphereGeometry(0.3, 24, 16), belly, this.head, v(0, 0.2, 0.17), v(1.15, 0.62, 0.75));
        const snout = this.headMount(0, -0.22, -0.06);
        this.mesh(new THREE.SphereGeometry(0.17, 20, 14), belly, snout, v(0, 0, 0.08), v(0.9, 0.62, 1.15));
        this.mesh(new THREE.SphereGeometry(0.048, 14, 10), nose, snout, v(0, 0.035, 0.26), v(1.2, 0.85, 1));
        smile(this.headMount(0, -0.36, 0.05), 0.04);
        for (const side of [-1, 1])
          ear(side * 0.5, 0.92, side, (g) => {
            this.mesh(new THREE.ConeGeometry(0.16, 0.42, 20), fur, g, v(0, 0.17, 0), v(1, 1, 0.55));
            this.mesh(new THREE.ConeGeometry(0.1, 0.28, 16), blush, g, v(0, 0.13, 0.05), v(1, 1, 0.4));
            this.mesh(new THREE.ConeGeometry(0.055, 0.11, 12), deep, g, v(0, 0.35, 0), v(1, 1, 0.6));
          });
        const brush = this.mesh(new THREE.SphereGeometry(0.24, 22, 16), fur, this.tail, v(0, 0.2, -0.16), v(0.72, 0.72, 1.55));
        brush.rotation.x = -0.75;
        this.mesh(new THREE.SphereGeometry(0.14, 16, 12), belly, this.tail, v(0, 0.44, -0.38));
        break;
      }
      case 'cat': {
        muzzleDots();
        // Whiskers
        for (const side of [-1, 1])
          for (const k of [-1, 0, 1]) {
            const w = this.mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), this.mats.white, this.head, this.onHead(side * 0.32, -0.3 + k * 0.05, 0.02).pos.add(v(side * 0.06, 0, 0)));
            w.rotation.z = Math.PI / 2 + side * k * 0.18;
          }
        for (const side of [-1, 1])
          ear(side * 0.58, 0.88, side, (g) => {
            this.mesh(new THREE.ConeGeometry(0.15, 0.3, 4), fur, g, v(0, 0.12, 0), v(1, 1, 0.6)).rotation.y = Math.PI / 4;
            this.mesh(new THREE.ConeGeometry(0.09, 0.2, 4), blush, g, v(0, 0.1, 0.05), v(1, 1, 0.4)).rotation.y = Math.PI / 4;
          }, 0.38);
        const curve = new THREE.CatmullRomCurve3([v(0, 0, 0), v(0, 0.05, -0.2), v(0.08, 0.35, -0.32), v(0.02, 0.62, -0.26), v(-0.1, 0.7, -0.18)]);
        this.mesh(new THREE.TubeGeometry(curve, 24, 0.05, 10, false), fur, this.tail);
        this.mesh(new THREE.SphereGeometry(0.055, 12, 10), deep, this.tail, curve.getPoint(1));
        break;
      }
      case 'bunny': {
        muzzleDots();
        const teeth = this.headMount(0, -0.44, 0.0);
        this.mesh(new THREE.BoxGeometry(0.05, 0.045, 0.015), this.mats.white, teeth, v(0, -0.02, 0.02));
        for (const side of [-1, 1])
          ear(side * 0.24, 1.1, side, (g) => {
            this.mesh(new THREE.SphereGeometry(0.14, 20, 16), fur, g, v(0, 0.3, 0), v(0.62, 2.1, 0.36));
            this.mesh(new THREE.SphereGeometry(0.1, 16, 12), blush, g, v(0, 0.3, 0.035), v(0.55, 1.9, 0.2));
          }, 0.16);
        this.mesh(new THREE.SphereGeometry(0.13, 16, 12), belly, this.tail, v(0, 0, -0.02));
        break;
      }
      case 'bear': {
        const m = this.headMount(0, -0.22, -0.07);
        this.mesh(new THREE.SphereGeometry(0.17, 20, 14), belly, m, v(0, 0, 0.05), v(1.1, 0.8, 0.8));
        this.mesh(new THREE.SphereGeometry(0.06, 14, 10), nose, m, v(0, 0.05, 0.17), v(1.35, 0.85, 0.9));
        smile(this.headMount(0, -0.4, 0.06), 0.045);
        for (const side of [-1, 1])
          ear(side * 0.72, 0.82, side, (g) => {
            this.mesh(new THREE.SphereGeometry(0.13, 18, 14), fur, g, v(0, 0.04, 0), v(1, 1, 0.62));
            this.mesh(new THREE.SphereGeometry(0.075, 14, 10), blush, g, v(0, 0.04, 0.05), v(1, 1, 0.4));
          }, 0.2);
        this.mesh(new THREE.SphereGeometry(0.09, 14, 10), fur, this.tail);
        break;
      }
      case 'owl': {
        // Facial disc around the eyes, a little beak, ear tufts and a fan of tail feathers.
        for (const side of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.19, 22, 16), belly, this.headMount(side * 0.37, 0.1, -0.05), undefined, v(1, 1.05, 0.3));
        const beak = this.headMount(0, -0.12, -0.01);
        const b = this.mesh(new THREE.ConeGeometry(0.055, 0.15, 12), nose, beak, v(0, -0.02, 0.04));
        b.rotation.x = Math.PI * 0.62;
        for (const side of [-1, 1])
          ear(side * 0.55, 0.95, side, (g) => {
            this.mesh(new THREE.ConeGeometry(0.075, 0.24, 10), deep, g, v(0, 0.1, 0), v(1, 1, 0.5));
          }, 0.55);
        for (const k of [-1, 0, 1]) {
          const f = this.mesh(new THREE.SphereGeometry(0.1, 12, 10), deep, this.tail, v(k * 0.07, -0.18, -0.04), v(0.5, 1.4, 0.25));
          f.rotation.set(0.5, 0, k * 0.35);
        }
        for (const arm of [this.armL, this.armR]) arm.children[0].scale.set(0.42, 1.3, 0.8);
        break;
      }
      case 'frog': {
        // A wide grin and nothing sticking out — frogs travel light.
        const m = this.headMount(0, -0.18, 0.004);
        const grin = new THREE.TorusGeometry(0.2, 0.014, 6, 32, Math.PI * 0.62);
        const g = this.mesh(grin, this.mats.dark, this.mouth);
        g.rotation.z = Math.PI + Math.PI * 0.19;
        g.position.y = 0.17;
        this.mouth.position.copy(m.position);
        this.mouth.quaternion.copy(m.quaternion);
        this.head.add(this.mouth);
        break;
      }
    }
  }

  // ─── Skin ────────────────────────────────────────────────────────────────

  setLook(look: Look) {
    const p = look.palette;
    const old = this.textures;
    const t = (this.textures = makeLookTextures(look));
    const m = this.mats;
    m.fur.map = t.fur;
    m.fur.emissiveMap = t.glow;
    m.fur.emissive.set(t.glow ? '#FFFFFF' : '#000000');
    m.fur.emissiveIntensity = look.glow * 0.9;
    m.fur.needsUpdate = true;
    m.deep.color.set(p.furDeep);
    m.belly.color.set(p.belly);
    m.blush.color.set(p.blush);
    m.nose.color.set(p.nose);
    m.scarf.map = t.scarf;
    m.scarf.needsUpdate = true;
    m.iris.map = t.iris;
    m.iris.needsUpdate = true;
    if (old) for (const tex of [old.fur, old.glow, old.scarf, old.iris]) tex?.dispose();
  }

  /** Every texture this look uses, so a stage can upload them before showing the model. */
  get textureList(): THREE.Texture[] {
    const t = this.textures;
    return t ? [t.fur, t.glow, t.scarf, t.iris].filter((x): x is THREE.DataTexture => !!x) : [];
  }

  // ─── Animation ───────────────────────────────────────────────────────────

  setMood(mood: Mood, now: number) {
    if (mood === this.mood) return;
    this.mood = mood;
    this.moodAt = now;
  }

  /** Point the eyes (and a little of the head) somewhere, -1..1; null lets them wander. */
  private forcedLook: { x: number; y: number } | null = null;
  setLookAt(look: { x: number; y: number } | null) {
    this.forcedLook = look;
  }

  update(time: number, dt: number, still = false) {
    const target = POSES[this.mood];
    const k = 1 - Math.pow(0.004, dt);
    for (const key of Object.keys(target) as (keyof Pose)[]) this.pose[key] += (target[key] - this.pose[key]) * k;
    const p = this.pose;
    const t = still ? 0 : time + this.phase;
    const since = time - this.moodAt;

    // Bounce: a soft breathe at rest, real hops when cheering.
    const wave = Math.sin(t * p.hz * Math.PI * 2);
    const hop = this.mood === 'cheer' ? Math.abs(wave) : wave * 0.5 + 0.5;
    this.body.position.y = hop * p.bounce - p.sink;
    const squash = 1 + (this.mood === 'cheer' ? (hop < 0.15 ? -0.06 : 0.02) : wave * 0.012);
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // A quick nod whenever the mood changes, so the switch reads.
    const nodKick = since < 0.45 ? Math.sin((since / 0.45) * Math.PI) * 0.16 : 0;
    this.head.rotation.x = p.nod + nodKick + Math.sin(t * 1.3) * 0.02;
    this.head.rotation.z = p.tilt + Math.sin(t * 0.9) * 0.03;

    const waveArm = p.wave * Math.sin(time * 12) * 0.35;
    this.armL.rotation.z = -(p.armL + Math.sin(t * 1.7) * 0.04);
    this.armR.rotation.z = p.armR + waveArm + Math.sin(t * 1.7 + 1) * 0.04;
    this.armL.rotation.x = -p.armL * 0.22;
    this.armR.rotation.x = -p.armR * (this.mood === 'think' ? 0.75 : 0.22);

    for (const e of this.ears) {
      e.group.rotation.x = p.droop * 0.5 + Math.sin(t * 2.3 + e.side) * 0.03;
      e.group.rotation.y = 0;
      const twitch = Math.sin(t * 0.7 + e.side * 2) > 0.985 ? 0.2 : 0;
      e.group.userData.z ??= e.group.rotation.z;
      e.group.rotation.z = e.group.userData.z - e.side * (p.droop * 0.7 + twitch);
    }
    this.tail.rotation.y = Math.sin(t * (this.mood === 'cheer' ? 7 : 2.1)) * (this.mood === 'sad' ? 0.05 : 0.22);
    this.tail.rotation.x = -p.droop * 0.3;

    // Blinks, at irregular intervals.
    if (time > this.blinkAt) {
      this.blinkAge = 0;
      this.blinkAt = time + 1.8 + Math.random() * 3.4;
    }
    this.blinkAge += dt;
    const blink = this.blinkAge < 0.2 ? Math.sin((this.blinkAge / 0.2) * Math.PI) : 0;
    const lid = Math.max(blink, p.squint * 0.6);

    // Glances: forced, mood-driven, or wandering.
    if (time > this.lookAt) {
      const centre = Math.random() < 0.4;
      this.lookTarget = centre ? { x: 0, y: 0 } : { x: Math.random() * 2 - 1, y: Math.random() * 1.2 - 0.5 };
      this.lookAt = time + 1.2 + Math.random() * 2.4;
    }
    const want = this.forcedLook ?? (this.mood === 'think' ? { x: 0.6, y: 0.8 } : this.mood === 'sad' ? { x: 0, y: -0.9 } : this.lookTarget);
    const lk = 1 - Math.pow(0.002, dt);
    this.look.x += (want.x - this.look.x) * lk;
    this.look.y += (want.y - this.look.y) * lk;
    for (const e of this.eyes) {
      e.blink.scale.y = 1 - lid * 0.92;
      e.look.position.x = this.look.x * 0.026;
      e.look.position.y = this.look.y * 0.02;
    }
    this.head.rotation.y = this.look.x * 0.18;

    const open = Math.max(0, p.mouth);
    this.mouth.scale.set(1 + open * 0.25, p.mouth < 0 ? -0.8 : 1 + open * 1.4, 1);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    Object.values(this.mats).forEach((m) => m.dispose());
    const t = this.textures;
    if (t) for (const tex of [t.fur, t.glow, t.scarf, t.iris]) tex?.dispose();
  }
}
