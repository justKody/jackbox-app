/**
 * Bakes the code-built avatars into assets the native (Filament) renderer can load:
 * one .glb per species, the props around them, every skin's textures as PNGs, and
 * `src/avatar/filament/rig.generated.ts` with each joint's rest pose and the asset requires.
 *
 *   npm run avatar:assets
 *
 * Re-run after changing animalModel.ts, textures.ts or the skins.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { AnimalModel } from '../../src/avatar/animalModel.ts';
import { ANIMALS, lookFor, SKINS } from '../../src/avatar/skins.ts';
import { makeGlowTexture, makeLookTextures, makeRuneTexture, makeSparkleTexture } from '../../src/avatar/textures.ts';

const APP = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(APP, 'assets/avatar');
const SKIN_OUT = join(OUT, 'skins');
const RIG_FILE = join(APP, 'src/avatar/filament/rig.generated.ts');

// ─── PNG ─────────────────────────────────────────────────────────────────────

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function png(rgba: Uint8Array, w: number, h: number) {
  const chunk = (type: string, data: Uint8Array) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    Buffer.from(data).copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header.set([8, 6, 0, 0, 0], 8);
  // Filter byte 0 (none) on every scanline.
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())]);
}

const texturePng = (t: THREE.DataTexture) => png(t.image.data as Uint8Array, t.image.width, t.image.height);

// ─── glTF ────────────────────────────────────────────────────────────────────

type Rest = { p: number[]; r: number[] | null; s: number[]; e: number[] };

const round = (v: number) => Math.round(v * 1e5) / 1e5 || 0;

/** Minimal glTF 2.0 binary writer for what the avatars use: nodes, merged meshes, PBR/unlit materials, PNG textures. */
class Glb {
  private json = {
    asset: { version: '2.0', generator: 'trivia-app avatar build' },
    extensionsUsed: [] as string[],
    scene: 0,
    scenes: [{ nodes: [] as number[] }],
    nodes: [] as object[],
    meshes: [] as object[],
    materials: [] as object[],
    textures: [] as object[],
    images: [] as object[],
    samplers: [] as object[],
    accessors: [] as object[],
    bufferViews: [] as object[],
    buffers: [] as object[],
  };
  private chunks: Buffer[] = [];
  private length = 0;
  private materialIndex = new Map<THREE.Material, number>();
  private textureIndex = new Map<THREE.Texture, number>();

  private view(data: Uint8Array, target?: number) {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) {
      this.chunks.push(Buffer.alloc(pad));
      this.length += pad;
    }
    this.chunks.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    this.json.bufferViews.push({ buffer: 0, byteOffset: this.length, byteLength: data.byteLength, ...(target ? { target } : {}) });
    this.length += data.byteLength;
    return this.json.bufferViews.length - 1;
  }

  private accessor(data: Float32Array | Uint16Array | Uint32Array, type: 'SCALAR' | 'VEC2' | 'VEC3', target: number) {
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type];
    const componentType = data instanceof Float32Array ? 5126 : data instanceof Uint16Array ? 5123 : 5125;
    const acc: Record<string, unknown> = { bufferView: this.view(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), target), componentType, count: data.length / size, type };
    if (type === 'VEC3' && target === 34962) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < data.length; i += 3)
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], data[i + k]);
          max[k] = Math.max(max[k], data[i + k]);
        }
      Object.assign(acc, { min, max });
    }
    this.json.accessors.push(acc);
    return this.json.accessors.length - 1;
  }

  private texture(t: THREE.Texture) {
    const known = this.textureIndex.get(t);
    if (known !== undefined) return known;
    const image = this.view(texturePng(t as THREE.DataTexture));
    this.json.images.push({ bufferView: image, mimeType: 'image/png' });
    const wrap = t.wrapS === THREE.RepeatWrapping ? 10497 : 33071;
    this.json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: wrap, wrapT: wrap });
    this.json.textures.push({ source: this.json.images.length - 1, sampler: this.json.samplers.length - 1 });
    this.textureIndex.set(t, this.json.textures.length - 1);
    return this.json.textures.length - 1;
  }

  private material(m: THREE.Material) {
    const known = this.materialIndex.get(m);
    if (known !== undefined) return known;
    const unlit = m instanceof THREE.MeshBasicMaterial;
    const std = m as THREE.MeshStandardMaterial;
    const c = std.color;
    const out: Record<string, unknown> = {
      name: m.name,
      pbrMetallicRoughness: {
        baseColorFactor: [c.r, c.g, c.b, m.opacity].map(round),
        metallicFactor: 0,
        roughnessFactor: unlit ? 1 : std.roughness,
        ...(std.map ? { baseColorTexture: { index: this.texture(std.map) } } : {}),
      },
    };
    if (!unlit) {
      const e = std.emissive.clone().multiplyScalar(std.emissiveIntensity);
      out.emissiveFactor = [e.r, e.g, e.b].map(round);
    }
    if (m.transparent) out.alphaMode = 'BLEND';
    // The mouth flips upside down (negative scale) when sad, so it can't rely on back-face culling.
    if (m.side === THREE.DoubleSide || m.name === 'dark') out.doubleSided = true;
    if (unlit) {
      out.extensions = { KHR_materials_unlit: {} };
      if (!this.json.extensionsUsed.includes('KHR_materials_unlit')) this.json.extensionsUsed.push('KHR_materials_unlit');
    }
    this.json.materials.push(out);
    this.materialIndex.set(m, this.json.materials.length - 1);
    return this.json.materials.length - 1;
  }

  /** One glTF mesh holding every given mesh, baked into joint space and merged per material. */
  mesh(parts: { mesh: THREE.Mesh; matrix: THREE.Matrix4 }[]) {
    const byMat = new Map<THREE.Material, typeof parts>();
    for (const part of parts) {
      const mat = part.mesh.material as THREE.Material;
      byMat.set(mat, [...(byMat.get(mat) ?? []), part]);
    }
    const primitives = [...byMat].map(([mat, group]) => {
      const pos: number[] = [];
      const nrm: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      const p = new THREE.Vector3();
      const n = new THREE.Vector3();
      for (const { mesh, matrix } of group) {
        const g = mesh.geometry;
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
        const flip = matrix.determinant() < 0;
        const base = pos.length / 3;
        const P = g.getAttribute('position');
        const N = g.getAttribute('normal');
        const U = g.getAttribute('uv');
        for (let i = 0; i < P.count; i++) {
          p.fromBufferAttribute(P, i).applyMatrix4(matrix);
          n.fromBufferAttribute(N, i).applyMatrix3(normalMatrix).normalize();
          pos.push(p.x, p.y, p.z);
          nrm.push(n.x, n.y, n.z);
          // DataTextures aren't flipped, so three's v already runs from the first row like glTF's.
          uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
        }
        const I = g.getIndex();
        const tri = I ? Array.from(I.array) : [...Array(P.count).keys()];
        for (let i = 0; i < tri.length; i += 3) {
          if (flip) idx.push(base + tri[i], base + tri[i + 2], base + tri[i + 1]);
          else idx.push(base + tri[i], base + tri[i + 1], base + tri[i + 2]);
        }
      }
      const indices = pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
      return {
        attributes: {
          POSITION: this.accessor(new Float32Array(pos), 'VEC3', 34962),
          NORMAL: this.accessor(new Float32Array(nrm), 'VEC3', 34962),
          TEXCOORD_0: this.accessor(new Float32Array(uv), 'VEC2', 34962),
        },
        indices: this.accessor(indices, 'SCALAR', 34963),
        material: this.material(mat),
      };
    });
    this.json.meshes.push({ primitives });
    return this.json.meshes.length - 1;
  }

  node(node: object) {
    this.json.nodes.push(node);
    return this.json.nodes.length - 1;
  }

  setRoots(roots: number[]) {
    this.json.scenes[0].nodes = roots;
  }

  toBuffer() {
    const bin = Buffer.concat([...this.chunks, Buffer.alloc((4 - (this.length % 4)) % 4)]);
    this.json.buffers = [{ byteLength: bin.length }];
    if (!this.json.extensionsUsed.length) delete (this.json as Partial<typeof this.json>).extensionsUsed;
    const text = Buffer.from(JSON.stringify(this.json));
    const json = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
    const head = Buffer.alloc(12);
    head.writeUInt32LE(0x46546c67, 0);
    head.writeUInt32LE(2, 4);
    head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
    const chunkHead = (len: number, type: number) => {
      const b = Buffer.alloc(8);
      b.writeUInt32LE(len, 0);
      b.writeUInt32LE(type, 4);
      return b;
    };
    return Buffer.concat([head, chunkHead(json.length, 0x4e4f534a), json, chunkHead(bin.length, 0x004e4942), bin]);
  }
}

/**
 * Writes `root` as a glTF hierarchy where every named object is its own node (a joint the app
 * can move) and all unnamed meshes below it are merged into that joint's mesh.
 * Returns each joint's rest transform relative to its parent joint.
 */
function exportTree(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const glb = new Glb();
  const rests: Record<string, Rest> = {};
  const isJoint = (o: THREE.Object3D) => o.name !== '';

  const visit = (joint: THREE.Object3D, parent: THREE.Object3D | null): number => {
    const local = parent ? parent.matrixWorld.clone().invert().multiply(joint.matrixWorld) : joint.matrixWorld.clone();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    local.decompose(p, q, s);

    const meshes: THREE.Mesh[] = [];
    const joints: THREE.Object3D[] = [];
    const collect = (o: THREE.Object3D) => {
      if (isJoint(o)) return joints.push(o);
      if (o instanceof THREE.Mesh) meshes.push(o);
      o.children.forEach(collect);
    };
    // A named mesh is a joint that draws itself.
    if (joint instanceof THREE.Mesh) meshes.push(joint);
    joint.children.forEach(collect);

    const inv = joint.matrixWorld.clone().invert();
    const mesh = meshes.length ? glb.mesh(meshes.map((m) => ({ mesh: m, matrix: inv.clone().multiply(m.matrixWorld) }))) : undefined;
    const children = joints.map((j) => visit(j, joint));

    const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    const axis = angle > 1e-6 ? new THREE.Vector3(q.x, q.y, q.z).normalize().multiplyScalar(Math.sign(q.w) || 1) : null;
    rests[joint.name] = {
      p: p.toArray().map(round),
      r: axis ? [round(angle), ...axis.toArray().map(round)] : null,
      s: s.toArray().map(round),
      e: [joint.rotation.x, joint.rotation.y, joint.rotation.z].map(round),
    };
    return glb.node({
      name: joint.name,
      translation: p.toArray(),
      rotation: q.toArray(),
      scale: s.toArray(),
      ...(mesh !== undefined ? { mesh } : {}),
      ...(children.length ? { children } : {}),
    });
  };
  glb.setRoots([visit(root, null)]);
  return { buffer: glb.toBuffer(), rests };
}

// ─── Props ───────────────────────────────────────────────────────────────────

const glowTex = makeGlowTexture(64, 2);
const sparkleTex = makeSparkleTexture(64);
const runeTex = makeRuneTexture(256);

const named = <T extends { name: string }>(o: T, name: string) => Object.assign(o, { name });
const unlit = (name: string, map: THREE.Texture, color = '#FFFFFF', opacity = 1) =>
  named(new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, opacity }), name);

/** The wardrobe's dais: stone, glowing lip, rune circle and contact shadow. Tinted at runtime. */
function pedestal() {
  const root = named(new THREE.Group(), 'pedestal');
  const stone = named(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.14, 0.16, 64), named(new THREE.MeshStandardMaterial({ color: '#231C3E', roughness: 0.85 }), 'stone')), 'stone');
  stone.position.y = -0.08;
  const lipMat = named(new THREE.MeshStandardMaterial({ color: '#40356E', roughness: 0.4, emissive: '#8C6CFF', emissiveIntensity: 0.35 }), 'lip');
  const lip = named(new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.02, 8, 80), lipMat), 'lip');
  lip.rotation.x = Math.PI / 2;
  const runes = named(new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), unlit('runes', runeTex, '#FFFFFF', 0.75)), 'runes');
  runes.rotation.x = -Math.PI / 2;
  runes.position.y = 0.004;
  const shadow = named(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), unlit('shadow', glowTex, '#000000', 0.6)), 'shadow');
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  root.add(stone, lip, runes, shadow);
  return root;
}

/** A player's spot at the table: a rune ring in their colour and a contact shadow. */
function seat() {
  const root = named(new THREE.Group(), 'seat');
  const ring = named(new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), unlit('ring', runeTex, '#FFFFFF', 0.5)), 'ring');
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  const shadow = named(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), unlit('shadow', glowTex, '#000000', 0.55)), 'shadow');
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(ring, shadow);
  return root;
}

/** A unit glow card facing the camera, sized and tinted at runtime. */
function halo() {
  const root = named(new THREE.Group(), 'haloRoot');
  root.add(named(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit('halo', glowTex)), 'halo'));
  return root;
}

/** `count` unit particle cards named `${prefix}${i}`, cycling through `colors` materials. */
function particles(prefix: string, count: number, colors: number, tex: THREE.Texture) {
  const root = named(new THREE.Group(), `${prefix}Root`);
  const geo = new THREE.PlaneGeometry(1, 1);
  const mats = [...Array(colors)].map((_, i) => unlit(`${prefix}Color${i}`, tex));
  for (let i = 0; i < count; i++) root.add(named(new THREE.Mesh(geo, mats[i % colors]), `${prefix}${i}`));
  return root;
}

// ─── Build ───────────────────────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true });
mkdirSync(SKIN_OUT, { recursive: true });
mkdirSync(dirname(RIG_FILE), { recursive: true });

const rel = (file: string) => {
  const r = relative(dirname(RIG_FILE), file).split('\\').join('/');
  return r.startsWith('.') ? r : `./${r}`;
};
const sizes: string[] = [];
const write = (file: string, data: Buffer) => {
  writeFileSync(file, data);
  sizes.push(`${relative(APP, file)}  ${(data.length / 1024).toFixed(0)} KB`);
};

const rigs: Record<string, Record<string, Rest>> = {};
for (const animal of ANIMALS) {
  const model = new AnimalModel(lookFor(animal.id, 'natural'));
  const { buffer, rests } = exportTree(model.root);
  write(join(OUT, `${animal.id}.glb`), buffer);
  rigs[animal.id] = rests;
}

const props = { pedestal: pedestal(), seat: seat(), halo: halo(), motes: particles('m', 40, 3, glowTex), burst: particles('b', 40, 4, sparkleTex) };
const propRests: Record<string, Record<string, Rest>> = {};
for (const [name, root] of Object.entries(props)) {
  const { buffer, rests } = exportTree(root);
  write(join(OUT, `${name}.glb`), buffer);
  propRests[name] = rests;
}

// Natural colouring belongs to each animal; every other skin looks the same on all of them.
const palettes = [...ANIMALS.map((a) => ({ id: `natural-${a.id}`, look: lookFor(a.id, 'natural') })), ...SKINS.filter((s) => s.id !== 'natural').map((s) => ({ id: s.id, look: lookFor('fox', s.id) }))];
const skinLines: string[] = [];
for (const { id, look } of palettes) {
  const t = makeLookTextures({ ...look, key: id });
  for (const part of ['fur', 'scarf', 'iris'] as const) write(join(SKIN_OUT, `${part}-${id}.png`), texturePng(t[part]));
  const req = (part: string) => `require('${rel(join(SKIN_OUT, `${part}-${id}.png`))}')`;
  skinLines.push(`  '${id}': { fur: ${req('fur')}, scarf: ${req('scarf')}, iris: ${req('iris')} },`);
}

const rig = `// Generated by scripts/avatar-assets/build.ts — do not edit. Run \`npm run avatar:assets\` instead.
/* eslint-disable */
import type { Species } from '../skins';

/**
 * A joint's rest transform relative to its parent joint: position, rotation as
 * [angle, axisX, axisY, axisZ] (null when none), scale, and the Euler angles it was built with.
 */
export type Rest = { p: number[]; r: number[] | null; s: number[]; e: number[] };

export const ANIMAL_RIGS: Record<Species, Record<string, Rest>> = ${JSON.stringify(rigs)};

export const PROP_RESTS = ${JSON.stringify(propRests)} as const satisfies Record<string, Record<string, Rest>>;

export const ANIMAL_MODELS: Record<Species, number> = {
${ANIMALS.map((a) => `  ${a.id}: require('${rel(join(OUT, `${a.id}.glb`))}'),`).join('\n')}
};

export const PROP_MODELS = {
${Object.keys(props).map((name) => `  ${name}: require('${rel(join(OUT, `${name}.glb`))}') as number,`).join('\n')}
};

/** Keyed by \`natural-<species>\` or the skin id. */
export const SKIN_TEXTURES: Record<string, { fur: number; scarf: number; iris: number }> = {
${skinLines.join('\n')}
};
`;
writeFileSync(RIG_FILE, rig);
console.log(sizes.join('\n'));
console.log(`\nWrote ${relative(APP, RIG_FILE)}`);
