import * as THREE from 'three';

export function radialTex(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function starTex() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,.8)'); gr.addColorStop(0.4, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.9)';
  [[64, 2, 64, 126], [2, 64, 126, 64]].forEach(([x1, y1, x2, y2]) => { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(64, 64, x2, y2); g.lineTo(x2, y2); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke(); });
  return new THREE.CanvasTexture(c);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class Bits {
  constructor(parent, geo, mat, count = 600) {
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    this.p = Array.from({ length: count }, () => ({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Vector3(), spin: new THREE.Vector3() }));
    this.i = 0; this.count = count;
    _m.makeScale(0, 0, 0); for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, _m);
    parent.add(this.mesh);
  }
  spawn(pos, vel, color, { life = 3, scale = 1, grav = -9, drag = 0.5, sway = 0, floor = -Infinity } = {}) {
    const i = this.i; this.i = (this.i + 1) % this.count; const p = this.p[i];
    Object.assign(p, { alive: true, life: 0, max: life, scale, grav, drag, sway, floor, seed: Math.random() * 10 });
    p.pos.copy(pos); p.vel.copy(vel); p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.spin.set((Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 14);
    this.mesh.setColorAt(i, _c.set(color)); this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    let any = false;
    this.p.forEach((p, i) => {
      if (!p.alive) return; any = true;
      p.life += dt; p.vel.y += p.grav * dt; p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt); if (p.sway) p.pos.x += Math.sin(p.life * 5 + p.seed) * p.sway * dt;
      if (p.pos.y < p.floor) { p.pos.y = p.floor; p.vel.set(p.vel.x * 0.3, Math.abs(p.vel.y) * 0.2, p.vel.z * 0.3); p.spin.multiplyScalar(0.3); }
      p.rot.addScaledVector(p.spin, dt);
      const fade = Math.min(1, (p.max - p.life) / 0.6);
      if (p.life >= p.max) p.alive = false;
      const s = p.alive ? p.scale * fade : 0;
      _m.compose(p.pos, _q.setFromEuler(_e.set(p.rot.x, p.rot.y, p.rot.z)), _s.set(s, s, s)); this.mesh.setMatrixAt(i, _m);
    });
    if (any || this._was) this.mesh.instanceMatrix.needsUpdate = true; this._was = any;
  }
}

export class Sparks {
  constructor(parent, count = 1500, size = 0.25, tex = starTex()) {
    this.count = count; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3); this.col = new Float32Array(count * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.points.frustumCulled = false; this.points.renderOrder = 10;
    this.p = Array.from({ length: count }, () => ({ alive: false, vel: new THREE.Vector3(), c: new THREE.Color() }));
    parent.add(this.points);
  }
  spawn(pos, vel, color, { life = 2, grav = -1, drag = 1, twinkle = 0 } = {}) {
    const i = this.i; this.i = (this.i + 1) % this.count; const p = this.p[i];
    Object.assign(p, { alive: true, life: 0, max: life, grav, drag, twinkle, seed: Math.random() * 10 });
    p.vel.copy(vel); p.c.set(color); this.pos.set([pos.x, pos.y, pos.z], i * 3);
  }
  update(dt, time) {
    this.p.forEach((p, i) => {
      if (!p.alive) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; return; }
      p.life += dt; if (p.life > p.max) p.alive = false;
      p.vel.y += p.grav * dt; p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      this.pos[i * 3] += p.vel.x * dt; this.pos[i * 3 + 1] += p.vel.y * dt; this.pos[i * 3 + 2] += p.vel.z * dt;
      let k = Math.min(1, (p.max - p.life) / (p.max * 0.5));
      if (p.twinkle) k *= 0.35 + 0.65 * Math.abs(Math.sin(time * p.twinkle + p.seed));
      this.col[i * 3] = p.c.r * k; this.col[i * 3 + 1] = p.c.g * k; this.col[i * 3 + 2] = p.c.b * k;
    });
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class Smoke {
  constructor(parent) { this.parent = parent; this.list = []; this.mat = new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(235,235,240,.9)'], [0.5, 'rgba(200,200,210,.35)'], [1, 'rgba(200,200,210,0)']]), depthWrite: false, transparent: true }); }
  puff(pos, n = 10) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.mat.clone()); s.position.copy(pos); s.scale.setScalar(0.05);
      s.userData = { life: -i * 0.07, max: 2.4, seed: Math.random() * 10, vx: (Math.random() - .5) * 0.2 };
      this.parent.add(s); this.list.push(s);
    }
  }
  update(dt) {
    this.list = this.list.filter(s => {
      const u = s.userData; u.life += dt; if (u.life < 0) { s.visible = false; return true; } s.visible = true;
      const k = u.life / u.max;
      s.position.y += 0.55 * dt; s.position.x += (Math.sin(u.life * 3 + u.seed) * 0.15 + u.vx) * dt;
      s.scale.setScalar(0.08 + k * 0.6); s.material.opacity = 0.55 * (1 - k) * Math.min(1, u.life * 6); s.material.rotation += dt * 0.5;
      if (k >= 1) { this.parent.remove(s); s.material.dispose(); return false; } return true;
    });
  }
}

export const PALETTE = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0', '#fb5607', '#ff70a6', '#ffffff', '#80ffdb', '#ffd60a'];
export const pick = a => a[Math.floor(Math.random() * a.length)];
