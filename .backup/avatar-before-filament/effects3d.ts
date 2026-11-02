import * as THREE from 'three';

/** A one-shot spray of sparkles that arcs out and falls, reusable as often as you like. */
export function createBurst(sparkleTex: THREE.Texture, count = 40, size = 0.2) {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: sparkleTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let age = Infinity;

  return {
    points,
    fire(from: THREE.Vector3, palette: THREE.Color[], power = 1) {
      for (let i = 0; i < count; i++) {
        const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.4 - 0.3, Math.random() * 2 - 1).normalize();
        const speed = (1.4 + Math.random() * 1.6) * power;
        pos.set([from.x, from.y, from.z], i * 3);
        vel.set([dir.x * speed, dir.y * speed + 0.6, dir.z * speed], i * 3);
        const c = palette[i % palette.length];
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.attributes.color.needsUpdate = true;
      age = 0;
    },
    update(dt: number) {
      if (age >= 1) {
        mat.opacity = 0;
        return;
      }
      age += dt * 1.1;
      for (let i = 0; i < count; i++) {
        vel[i * 3 + 1] -= 2.2 * dt;
        for (let k = 0; k < 3; k++) {
          vel[i * 3 + k] *= Math.pow(0.25, dt);
          pos[i * 3 + k] += vel[i * 3 + k] * dt;
        }
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - age);
      mat.size = size * (1 - age * 0.5);
    },
  };
}

/** Glowing motes drifting upward around a point, recoloured with `tint`. */
export function createMotes(glowTex: THREE.Texture, count: number, radius: [number, number], height: number) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const seed = new Float32Array(count);
  const respawn = (i: number, y = Math.random() * height) => {
    const a = Math.random() * Math.PI * 2;
    const r = radius[0] + Math.random() * (radius[1] - radius[0]);
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    speed[i] = 0.12 + Math.random() * 0.22;
    seed[i] = Math.random() * 10;
  };
  for (let i = 0; i < count; i++) respawn(i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.07, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const points = new THREE.Points(geo, mat);

  return {
    points,
    tint(palette: THREE.Color[]) {
      for (let i = 0; i < count; i++) {
        const c = palette[i % palette.length];
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.attributes.color.needsUpdate = true;
    },
    update(t: number, dt: number) {
      for (let i = 0; i < count; i++) {
        const y = pos[i * 3 + 1] + speed[i] * dt;
        if (y > height) respawn(i, 0);
        else {
          pos[i * 3 + 1] = y;
          pos[i * 3] += Math.sin(t * 0.9 + seed[i]) * dt * 0.06;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
