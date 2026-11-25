import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PAPERS = [
  { bg: '#e63946', fg: '#ffffff', pat: 'dots', ribbon: '#ffd166' },
  { bg: '#118ab2', fg: '#ffd166', pat: 'stars', ribbon: '#ef476f' },
  { bg: '#7b2cbf', fg: '#ff70a6', pat: 'stripes', ribbon: '#80ffdb' },
  { bg: '#d4a017', fg: '#fff1a8', pat: 'diamond', ribbon: '#b5179e', metal: true },
  { bg: '#06d6a0', fg: '#ffffff', pat: 'chevron', ribbon: '#ff006e' },
  { bg: '#1d3557', fg: '#f1c40f', pat: 'confetti', ribbon: '#e63946' },
  { bg: '#ff8800', fg: '#ffd23f', pat: 'plaid', ribbon: '#3a86ff' },
  { bg: '#ff4fa3', fg: '#ffffff', pat: 'rings', ribbon: '#ffd60a' },
];

function star(g, x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
function paperTex(P) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = P.bg; g.fillRect(0, 0, S, S); g.fillStyle = g.strokeStyle = P.fg;
  const grid = (step, fn) => { for (let y = -1; y <= S / step; y++) for (let x = -1; x <= S / step; x++) fn(x * step + (y % 2 ? step / 2 : 0) + step / 2, y * step + step / 2); };
  switch (P.pat) {
    case 'dots': grid(64, (x, y) => { g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); }); break;
    case 'stars': grid(64, (x, y) => star(g, x, y, 17)); break;
    case 'stripes': g.lineWidth = 22; for (let i = -S; i < 2 * S; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); } break;
    case 'diamond': g.globalAlpha = 0.5; g.lineWidth = 4; for (let i = -S; i < 2 * S; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.moveTo(i, S); g.lineTo(i + S, 0); g.stroke(); } break;
    case 'chevron': g.lineWidth = 14; for (let y = 0; y <= S; y += 64) { g.beginPath(); for (let x = 0; x <= S; x += 32) g.lineTo(x, y + ((x / 32) % 2 ? 22 : 0)); g.stroke(); } break;
    case 'confetti': { const cols = ['#f1c40f', '#ff006e', '#06d6a0', '#ffffff', '#3a86ff']; let s = 7; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 70; i++) { g.save(); g.translate(r() * S, r() * S); g.rotate(r() * 6); g.fillStyle = cols[i % 5]; g.fillRect(-7, -3, 14, 6); g.restore(); } break; }
    case 'plaid': g.globalAlpha = 0.45; for (let i = 0; i < S; i += 64) { g.fillRect(i + 8, 0, 22, S); g.fillRect(0, i + 8, S, 22); } g.globalAlpha = 0.8; g.fillStyle = '#c1121f'; for (let i = 0; i < S; i += 64) { g.fillRect(i + 40, 0, 4, S); g.fillRect(0, i + 40, S, 4); } break;
    case 'rings': g.lineWidth = 5; grid(64, (x, y) => { [8, 18].forEach(r => { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }); }); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

const DEFS = [
  { x: -1.3, z: -1.7, w: 0.8, h: 1.4, d: 0.8 },
  { x: 0.05, z: -1.9, w: 1.15, h: 1.05, d: 1.1 },
  { x: 1.35, z: -1.6, r: 0.45, h: 0.9 },
  { x: -0.8, z: -0.25, w: 1.25, h: 0.42, d: 0.9 },
  { x: 0.85, z: -0.2, w: 0.75, h: 0.75, d: 0.75 },
  { x: -1.25, z: 1.15, w: 0.55, h: 0.5, d: 0.55 },
  { x: 0.0, z: 1.25, w: 0.95, h: 0.62, d: 0.7 },
  { x: 1.25, z: 1.1, w: 0.5, h: 1.05, d: 0.5 },
];

function bow(mat, s) {
  const g = new THREE.Group();
  const loopG = new THREE.TorusGeometry(0.17, 0.05, 10, 28);
  [0, Math.PI / 2].forEach(ry => [-1, 1].forEach(side => {
    const l = new THREE.Mesh(loopG, mat); l.scale.set(1, 0.85, 0.45);
    const p = new THREE.Group(); p.rotation.y = ry; l.position.set(side * 0.17, 0.12, 0); l.rotation.z = side * 0.55; p.add(l); g.add(p);
  }));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), mat); knot.position.y = 0.06; knot.scale.y = 0.8; g.add(knot);
  [-1, 1].forEach(side => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.36), mat); t.position.set(side * 0.08, 0.01, 0.14); t.rotation.y = side * 0.5; g.add(t); });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(s); return g;
}

export function buildPresents() {
  const group = new THREE.Group();
  const presents = DEFS.map((D, i) => {
    const P = PAPERS[i], round = !!D.r, W = round ? D.r * 2 : D.w, Dp = round ? D.r * 2 : D.d, H = D.h;
    const tex = paperTex(P); tex.repeat.set(Math.max(W, Dp) * 1.6, H * 1.6);
    const paper = new THREE.MeshPhysicalMaterial({ map: tex, roughness: P.metal ? 0.25 : 0.45, metalness: P.metal ? 0.75 : 0, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide });
    const rib = new THREE.MeshPhysicalMaterial({ color: P.ribbon, roughness: 0.25, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
    const root = new THREE.Group(); root.position.set(D.x, 0, D.z); root.rotation.y = (Math.random() - 0.5) * 0.5;
    const pivot = new THREE.Group(); root.add(pivot);
    const bodyH = H * 0.8, lidH = H * 0.22, rw = Math.min(W, Dp) * 0.16;
    const body = new THREE.Mesh(round ? new THREE.CylinderGeometry(D.r, D.r, bodyH, 40) : new RoundedBoxGeometry(W, bodyH, Dp, 3, 0.03), paper);
    body.position.y = bodyH / 2; pivot.add(body);
    const bands = [new THREE.Mesh(new THREE.BoxGeometry(W + 0.014, bodyH + 0.01, rw), rib), new THREE.Mesh(new THREE.BoxGeometry(rw, bodyH + 0.01, Dp + 0.014), rib)];
    bands.forEach(b => { b.position.y = bodyH / 2; pivot.add(b); });
    const lid = new THREE.Group(); lid.position.y = bodyH; pivot.add(lid);
    const lidM = new THREE.Mesh(round ? new THREE.CylinderGeometry(D.r * 1.05, D.r * 1.05, lidH, 40) : new RoundedBoxGeometry(W * 1.05, lidH, Dp * 1.05, 3, 0.03), paper);
    lidM.position.y = lidH / 2 - 0.02; lid.add(lidM);
    [new THREE.BoxGeometry(W * 1.05 + 0.014, lidH + 0.01, rw), new THREE.BoxGeometry(rw, lidH + 0.01, Dp * 1.05 + 0.014)].forEach(g => { const b = new THREE.Mesh(g, rib); b.position.y = lidH / 2 - 0.02; lid.add(b); });
    const bw = bow(rib, Math.min(W, Dp) * 0.85 + 0.2); bw.position.y = lidH - 0.02; lid.add(bw);
    root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.userData.present = i; } });
    group.add(root);
    return { i, root, pivot, body, bands, lid, bow: bw, paper, rib, W, H, Dp, round, opened: false, wiggleAt: 1 + Math.random() * 3, wig: 0 };
  });
  return { group, presents };
}

function crumpled(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 5, 5), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { p.setZ(i, (Math.random() - 0.5) * Math.min(w, h) * 0.25); p.setX(i, p.getX(i) * (0.85 + Math.random() * 0.25)); p.setY(i, p.getY(i) * (0.85 + Math.random() * 0.25)); }
  g.computeVertexNormals(); return g;
}

export class Debris {
  constructor(parent) { this.parent = parent; this.list = []; this.piles = {}; }
  add(obj, vel, spin, pile, flat = true) {
    obj.userData.phys = { vel, spin, pile, flat, settled: false, layer: (this.piles[pile] = (this.piles[pile] || 0) + 1), yaw: Math.random() * 6 };
    this.parent.add(obj); this.list.push(obj);
  }
  explode(p) {
    const wp = new THREE.Vector3(); p.root.getWorldPosition(wp);
    const { W, H, Dp } = p, bodyH = H * 0.8;
    const faces = [[0, 1, 0, W, Dp], [1, 0, 0, Dp, bodyH], [-1, 0, 0, Dp, bodyH], [0, 0, 1, W, bodyH], [0, 0, -1, W, bodyH]];
    faces.forEach(([nx, ny, nz, fw, fh]) => {
      const n = new THREE.Vector3(nx, ny, nz).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.root.rotation.y);
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Mesh(crumpled(fw / 2, fh / 2), p.paper); m.castShadow = true;
        const c = wp.clone().add(new THREE.Vector3(0, bodyH / 2, 0)).addScaledVector(n, (ny ? bodyH : (nx ? W : Dp)) / 2);
        c.x += (Math.random() - 0.5) * fw * 0.5; c.z += (Math.random() - 0.5) * fw * 0.5; c.y += (Math.random() - 0.5) * fh * 0.4;
        m.position.copy(c); m.lookAt(c.clone().add(n));
        const v = n.clone().multiplyScalar(0.8 + Math.random() * 1.2); v.y += 3 + Math.random() * 3;
        this.add(m, v, new THREE.Vector3((Math.random() - .5) * 12, (Math.random() - .5) * 12, (Math.random() - .5) * 12), p.i);
      }
    });
    for (let k = 0; k < 4; k++) {
      const pts = []; for (let j = 0; j < 30; j++) { const a = j * 0.6; pts.push(new THREE.Vector3(Math.cos(a) * 0.07, j * 0.018, Math.sin(a) * 0.07)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.018, 5), p.rib); m.scale.set(1, 1, 0.5); m.castShadow = true;
      m.position.copy(wp).add(new THREE.Vector3(0, bodyH, 0));
      this.add(m, new THREE.Vector3((Math.random() - .5) * 1.5, 4 + Math.random() * 2, (Math.random() - .5) * 4), new THREE.Vector3((Math.random() - .5) * 10, (Math.random() - .5) * 10, 0), p.i, false);
    }
    const lidPos = new THREE.Vector3(); p.lid.getWorldPosition(lidPos);
    const lid = p.lid; lid.position.copy(lidPos); lid.rotation.y = p.root.rotation.y; lid.scale.multiplyScalar(1);
    lid.remove(p.bow);
    this.add(lid, new THREE.Vector3((Math.random() - .5) * 1.2, 7, 0.4 + Math.random() * 0.4), new THREE.Vector3(6 + Math.random() * 4, 0, 3), p.i, 'lid');
    const bw = p.bow; bw.position.copy(lidPos).add(new THREE.Vector3(0, 0.3, 0)); bw.scale.multiplyScalar(1);
    this.add(bw, new THREE.Vector3((Math.random() - .5) * 1.2, 9, 0.5), new THREE.Vector3(3, 14, 5), p.i, 'up');
    p.root.visible = false;
  }
  update(dt) {
    const up = new THREE.Vector3(0, 1, 0);
    this.list.forEach(o => {
      const ph = o.userData.phys; if (ph.settled) return;
      ph.vel.y -= 13 * dt; ph.vel.multiplyScalar(1 - 0.6 * dt);
      o.position.addScaledVector(ph.vel, dt);
      o.rotation.x += ph.spin.x * dt; o.rotation.y += ph.spin.y * dt; o.rotation.z += ph.spin.z * dt;
      const floor = (ph.flat === 'lid' ? 0.02 : ph.flat === 'up' ? 0.05 : 0.015) + ph.layer * 0.006;
      if (o.position.y <= floor) {
        o.position.y = floor;
        if (Math.abs(ph.vel.y) > 1.5) { ph.vel.y = Math.abs(ph.vel.y) * 0.3; ph.vel.x *= 0.5; ph.vel.z *= 0.5; ph.spin.multiplyScalar(0.4); }
        else {
          ph.vel.set(0, 0, 0); ph.spin.set(0, 0, 0);
          const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(ph.flat === true ? -Math.PI / 2 + (Math.random() - .5) * 0.5 : (ph.flat === 'lid' ? (Math.random() < 0.5 ? 0.25 : Math.PI - 0.2) : 0.2), ph.yaw, (Math.random() - .5) * 0.4, 'YXZ'));
          if (!ph.flat) target.setFromAxisAngle(up, ph.yaw).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
          ph.target = target; ph.settled = true;
        }
      }
    });
    this.list.forEach(o => { const ph = o.userData.phys; if (ph.target) o.quaternion.slerp(ph.target, Math.min(1, dt * 8)); });
  }
}
