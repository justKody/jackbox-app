import * as THREE from 'three';
import { seeded } from '../motion';
import type { Look, Pattern } from './skins';

/**
 * Every texture the wardrobe uses, painted pixel by pixel into DataTextures.
 * expo-gl has no <canvas> to draw into on native, so this is the one path that works everywhere.
 * Patterns wrap at the edges so they tile seamlessly around the body.
 */

type RGB = [number, number, number];

const rgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};

/** Cheap, stable per-pixel noise in -1..1. */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

class Pixels {
  readonly data: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h * 4);
  }

  fill(c: RGB, a = 255) {
    for (let i = 0; i < this.w * this.h; i++) this.data.set([c[0], c[1], c[2], a], i * 4);
  }

  /** Alpha-blend one pixel; coordinates wrap so stamps tile. */
  blend(x: number, y: number, c: RGB, a: number) {
    if (a <= 0) return;
    const px = ((x % this.w) + this.w) % this.w;
    const py = ((y % this.h) + this.h) % this.h;
    const i = (py * this.w + px) * 4;
    const d = this.data;
    const k = Math.min(1, a);
    d[i] += (c[0] - d[i]) * k;
    d[i + 1] += (c[1] - d[i + 1]) * k;
    d[i + 2] += (c[2] - d[i + 2]) * k;
    d[i + 3] += (255 - d[i + 3]) * k;
  }

  /** Stamp a shape given as a signed coverage function over a square around (cx, cy). */
  stamp(cx: number, cy: number, r: number, c: RGB, a: number, cover: (dx: number, dy: number) => number) {
    const R = Math.ceil(r) + 1;
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const k = cover(x, y);
        if (k > 0) this.blend(Math.round(cx) + x, Math.round(cy) + y, c, a * k);
      }
  }

  disc(cx: number, cy: number, r: number, c: RGB, a = 1) {
    this.stamp(cx, cy, r, c, a, (x, y) => smooth(r + 0.6, r - 0.6, Math.hypot(x, y)));
  }

  ring(cx: number, cy: number, r: number, width: number, c: RGB, a = 1) {
    this.stamp(cx, cy, r + width, c, a, (x, y) => smooth(width / 2 + 0.6, width / 2 - 0.6, Math.abs(Math.hypot(x, y) - r)));
  }

  /** Four-point twinkle (an astroid), the same star the 2D Hat uses. */
  twinkle(cx: number, cy: number, r: number, c: RGB, a = 1) {
    this.stamp(cx, cy, r, c, a, (x, y) => {
      const d = Math.sqrt(Math.abs(x) / r) + Math.sqrt(Math.abs(y) / r);
      return smooth(1.08, 0.92, d);
    });
  }

  line(x0: number, y0: number, x1: number, y1: number, width: number, c: RGB, a = 1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, c, a);
    }
  }

  texture({ srgb = true, repeat = true } = {}) {
    const t = new THREE.DataTexture(this.data, this.w, this.h, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }
}

/** Paints `pattern` onto a buffer. Runs twice per skin: once for colour, once for the glow mask. */
function paintPattern(p: Pixels, pattern: Pattern, c: RGB, seed: number) {
  const rand = seeded(seed);
  const S = p.w;
  switch (pattern) {
    case 'stars':
      for (let i = 0; i < 22; i++) p.twinkle(rand() * S, rand() * S, 5 + rand() * 7, c, 0.95);
      for (let i = 0; i < 70; i++) p.disc(rand() * S, rand() * S, 0.6 + rand() * 1.1, c, 0.5 + rand() * 0.5);
      break;
    case 'snow':
      for (let i = 0; i < 16; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 6 + rand() * 6;
        const spin = rand() * Math.PI;
        for (let k = 0; k < 6; k++) {
          const a = spin + (k * Math.PI) / 3;
          p.line(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.4, c, 0.9);
          const bx = x + Math.cos(a) * r * 0.55;
          const by = y + Math.sin(a) * r * 0.55;
          p.line(bx, by, bx + Math.cos(a + 0.7) * r * 0.3, by + Math.sin(a + 0.7) * r * 0.3, 1, c, 0.8);
          p.line(bx, by, bx + Math.cos(a - 0.7) * r * 0.3, by + Math.sin(a - 0.7) * r * 0.3, 1, c, 0.8);
        }
      }
      for (let i = 0; i < 90; i++) p.disc(rand() * S, rand() * S, 0.7 + rand() * 1.4, c, 0.55);
      break;
    case 'stripes': {
      const period = S / 4;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const d = (x + y) % period;
          p.blend(x, y, c, smooth(0, 1.2, d) * smooth(period * 0.42, period * 0.42 - 1.2, d) * 0.85);
        }
      break;
    }
    case 'leaves':
      for (let i = 0; i < 26; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const len = 7 + rand() * 6;
        const a = rand() * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        p.stamp(x, y, len, c, 0.85, (dx, dy) => {
          const u = (dx * ca + dy * sa) / len;
          const v = (-dx * sa + dy * ca) / (len * 0.42);
          return smooth(1.05, 0.9, u * u + v * v);
        });
      }
      break;
    case 'runes':
      for (let i = 0; i < 14; i++) {
        const x = rand() * S;
        const y = rand() * S;
        const r = 5 + rand() * 4;
        p.ring(x, y, r, 1.3, c, 0.9);
        const a = rand() * Math.PI;
        p.line(x - Math.cos(a) * r * 1.5, y - Math.sin(a) * r * 1.5, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5, 1.2, c, 0.9);
        p.disc(x, y, 1.4, c);
      }
      for (let i = 0; i < 40; i++) p.disc(rand() * S, rand() * S, 0.8, c, 0.6);
      break;
    case 'diamonds': {
      const cell = S / 4;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const u = Math.abs((x % cell) - cell / 2) / (cell / 2);
          const v = Math.abs((y % cell) - cell / 2) / (cell / 2);
          p.blend(x, y, c, smooth(1.0, 0.94, u + v) * 0.7);
          // Fine argyle cross-lines.
          const l = Math.min(Math.abs(((x + y) % cell) - 0), Math.abs(((x - y + S) % cell) - 0));
          p.blend(x, y, c, smooth(1.1, 0.2, l) * 0.35);
        }
      break;
    }
    case 'none':
      break;
  }
}

export type LookTextures = { fur: THREE.DataTexture; glow: THREE.DataTexture | null; scarf: THREE.DataTexture; iris: THREE.DataTexture };

export function makeLookTextures(look: Look): LookTextures {
  const pal = look.palette;
  const S = 256;
  const seed = [...look.key].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 2147483646 || 1;

  // Fur: base colour, soft mottling and short downward strands, then the skin's print.
  const fur = new Pixels(S, S);
  const base = rgb(pal.fur);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const strand = Math.sin(x * 2.1 + Math.sin(y * 0.35) * 2) * 0.035;
      const k = 1 + hash(x, y) * 0.04 + strand + Math.sin(x * 0.09) * Math.sin(y * 0.07) * 0.03;
      fur.data.set([Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k), 255], (y * S + x) * 4);
    }
  paintPattern(fur, look.pattern, rgb(look.patternColor), seed);

  let glow: THREE.DataTexture | null = null;
  if (look.glow > 0 && look.pattern !== 'none') {
    const mask = new Pixels(S, S);
    mask.fill([0, 0, 0]);
    paintPattern(mask, look.pattern, rgb(look.patternColor), seed);
    glow = mask.texture();
  }

  // Knitted scarf: ribbed stitches with two contrast stripes.
  const scarf = new Pixels(64, 64);
  const wool = rgb(pal.scarf);
  const deep = rgb(pal.scarfDeep);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const stripe = (y >= 18 && y < 24) || (y >= 40 && y < 46);
      const c = stripe ? deep : wool;
      const rib = 1 + Math.abs(Math.sin(x * 0.8)) * 0.12 - 0.06 + hash(x, y) * 0.03;
      scarf.data.set([...c.map((v) => Math.min(255, v * rib)), 255], (y * 64 + x) * 4);
    }

  // Iris: bright core fading to the deep edge, with faint radial fibres.
  const iris = new Pixels(64, 64);
  const core = rgb('#FFFFFF');
  const eye = rgb(pal.eye);
  const eyeDeep = rgb(pal.eyeDeep);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const dx = (x - 27) / 32;
      const dy = (y - 36) / 32;
      const d = Math.min(1, Math.hypot(dx, dy));
      const fibre = 1 + Math.sin(Math.atan2(dy, dx) * 18) * 0.06 * d;
      const c = d < 0.45 ? core.map((v, i) => v + (eye[i] - v) * (d / 0.45)) : eye.map((v, i) => v + (eyeDeep[i] - v) * ((d - 0.45) / 0.55));
      iris.data.set([...c.map((v) => Math.min(255, v * fibre)), 255], (y * 64 + x) * 4);
    }

  return { fur: fur.texture(), glow, scarf: scarf.texture(), iris: iris.texture({ repeat: false }) };
}

/** Soft white blob, alpha falling off to the edge: glows, shadows and particles. */
export function makeGlowTexture(size = 64, falloff = 2) {
  const p = new Pixels(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2));
      p.data.set([255, 255, 255, Math.pow(1 - d, falloff) * 255], (y * size + x) * 4);
    }
  return p.texture({ srgb: false, repeat: false });
}

/** A twinkle with a halo, for the wand tip and sparkle bursts. */
export function makeSparkleTexture(size = 64) {
  const p = new Pixels(size, size);
  p.fill([255, 255, 255], 0);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - c, y - c) / c);
      p.data[(y * size + x) * 4 + 3] = Math.pow(1 - d, 3) * 110;
    }
  p.twinkle(c, c, c * 0.95, [255, 255, 255], 1);
  return p.texture({ srgb: false, repeat: false });
}

/** The glowing rune circle on the pedestal, as a white mask to tint. */
export function makeRuneTexture(size = 256) {
  const p = new Pixels(size, size);
  p.fill([255, 255, 255], 0);
  const c = size / 2;
  const W: RGB = [255, 255, 255];
  p.ring(c, c, c * 0.9, 2.4, W, 0.95);
  p.ring(c, c, c * 0.84, 1.2, W, 0.6);
  p.ring(c, c, c * 0.62, 1.6, W, 0.7);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const long = i % 3 === 0;
    const r0 = c * 0.66;
    const r1 = c * (long ? 0.8 : 0.74);
    p.line(c + Math.cos(a) * r0, c + Math.sin(a) * r0, c + Math.cos(a) * r1, c + Math.sin(a) * r1, long ? 1.8 : 1.1, W, long ? 0.9 : 0.5);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    p.twinkle(c + Math.cos(a) * c * 0.87, c + Math.sin(a) * c * 0.87, 7, W, 1);
  }
  return p.texture({ srgb: false, repeat: false });
}
