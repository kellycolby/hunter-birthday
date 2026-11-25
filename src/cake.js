import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { radialTex, PALETTE, pick } from './fx.js';

const flameVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const flameFS = `
uniform float uTime,uSeed,uLean,uLife; varying vec2 vUv;
void main(){
  vec2 p=vUv*2.-1.; p.y+=0.3;
  float t=uTime*9.+uSeed*10.;
  float fl=sin(t)*.5+sin(t*1.7+1.3)*.3+sin(t*3.3+.5)*.2;
  float h=clamp(p.y+.7,0.,2.);
  p.x-=(uLean+fl*.07)*h*h*.5;
  p.y=(p.y+.7)/max(uLife,.05)-.7;
  vec2 q=p; if(q.y>0.){ q.y/=2.1; q.x*=1.+q.y*2.6; }
  float d=length(q);
  float a=smoothstep(.42,.12,d);
  vec3 col=mix(vec3(1.,.35,.05),vec3(1.,.8,.25),smoothstep(.4,.18,d));
  col=mix(col,vec3(1.,1.,.92),smoothstep(.2,.02,d));
  float base=smoothstep(-.25,-.6,p.y); col=mix(col,vec3(.35,.5,1.),base*.7);
  gl_FragColor=vec4(col*1.6,a*clamp(uLife*1.5,0.,1.));
}`;

function layerTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const bands = [['#ffd98e', 50], ['#fff4f0', 14], ['#e0245e', 8], ['#ffd98e', 48], ['#fff4f0', 14], ['#7a3e1d', 10], ['#ffd98e', 50], ['#fff4f0', 14], ['#e0245e', 8], ['#ffd98e', 40]];
  let y = 0; bands.forEach(([col, h]) => { g.fillStyle = col; g.fillRect(0, y, 64, h); y += h; });
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,90,20,${Math.random() * 0.25})`; g.fillRect(Math.random() * 64, Math.random() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function stripeTex(a, b) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.strokeStyle = b; g.lineWidth = 12;
  for (let i = -64; i < 128; i += 32) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t;
}

export function buildCake() {
  const group = new THREE.Group();
  const flames = [], wedges = [];
  const glowTex = radialTex([[0, 'rgba(255,200,90,.9)'], [0.3, 'rgba(255,140,40,.35)'], [1, 'rgba(255,120,30,0)']]);
  const layers = layerTex();
  const cutMat = new THREE.MeshStandardMaterial({ map: layers, roughness: 0.8 });
  const plateMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, clearcoat: 1 });
  const wickMat = new THREE.MeshStandardMaterial({ color: '#2b1a10' });

  const plate = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [1.75, 0], [1.98, 0.08], [2.02, 0.14], [1.95, 0.13], [1.7, 0.07], [0, 0.07]].map(p => new THREE.Vector2(...p)), 64), plateMat);
  plate.castShadow = plate.receiveShadow = true; group.add(plate);

  const mkFlame = (parent, pos, s = 1) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: flameVS, fragmentShader: flameFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSeed: { value: Math.random() }, uLean: { value: 0 }, uLife: { value: 0 } } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34 * s, 0.68 * s), mat); m.position.copy(pos); m.position.y += 0.22 * s;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    glow.scale.setScalar(1.4 * s); glow.position.copy(m.position);
    parent.add(m, glow);
    const f = { mesh: m, glow, mat, life: 0, target: 0, lean: 0, out: false, thresh: 0 };
    flames.push(f); return f;
  };

  const tiers = [
    { r: 1.5, h: 0.95, y: 0.07, frost: '#ff8fc7', drip: '#ffffff', candles: true },
    { r: 1.0, h: 0.85, y: 1.02, frost: '#ffffff', drip: '#ff4fa3', candles: false },
  ];
  const N = 8, TH = Math.PI * 2 / N;
  tiers.forEach((tr, ti) => {
    const frostMat = new THREE.MeshPhysicalMaterial({ color: tr.frost, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.5 });
    const dripMat = new THREE.MeshPhysicalMaterial({ color: tr.drip, roughness: 0.2, clearcoat: 1 });
    const tierWedges = [];
    for (let i = 0; i < N; i++) {
      const a0 = i * TH, w = new THREE.Group(); w.position.y = tr.y;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(tr.r, tr.r, tr.h, 12, 1, false, a0, TH), frostMat);
      body.position.y = tr.h / 2; body.castShadow = body.receiveShadow = true; w.add(body);
      [[a0, false], [a0 + TH, true]].forEach(([a, end]) => {
        const g = new THREE.PlaneGeometry(tr.r, tr.h); g.translate(tr.r / 2, 0, 0); if (end) g.rotateX(Math.PI); g.rotateY(a - Math.PI / 2);
        const m = new THREE.Mesh(g, cutMat); m.position.y = tr.h / 2; w.add(m);
      });
      for (let k = 0; k < 3; k++) {
        const a = a0 + (k + 0.3 + Math.random() * 0.4) * TH / 3, len = 0.12 + Math.random() * 0.35;
        const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, len, 4, 10), dripMat);
        d.position.set(Math.sin(a) * (tr.r + 0.01), tr.h - len / 2 - 0.02, Math.cos(a) * (tr.r + 0.01)); d.castShadow = true; w.add(d);
      }
      const top = new THREE.Mesh(new THREE.CylinderGeometry(tr.r + 0.04, tr.r + 0.04, 0.08, 12, 1, false, a0, TH), dripMat); top.position.y = tr.h; w.add(top);
      for (let k = 0; k < 4; k++) {
        const a = a0 + (k + 0.5) * TH / 4;
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), dripMat); bead.scale.y = 0.75;
        bead.position.set(Math.sin(a) * (tr.r - 0.02), tr.h + 0.05, Math.cos(a) * (tr.r - 0.02)); w.add(bead);
        const bb = bead.clone(); bb.material = frostMat; bb.position.y = 0.05; bb.position.multiplyScalar(1.02); bb.position.y = 0.05; w.add(bb);
      }
      const sg = new THREE.CapsuleGeometry(0.018, 0.07, 2, 6);
      const sm = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ roughness: 0.4 }), 16);
      const inner = ti === 0 ? tiers[1].r + 0.05 : 0.05;
      for (let k = 0; k < 16; k++) {
        const a = a0 + Math.random() * TH, rr = inner + Math.random() * (tr.r - 0.15 - inner);
        const o = new THREE.Object3D(); o.position.set(Math.sin(a) * rr, tr.h + 0.045, Math.cos(a) * rr); o.rotation.set(Math.PI / 2, 0, Math.random() * 6); o.updateMatrix();
        sm.setMatrixAt(k, o.matrix); sm.setColorAt(k, new THREE.Color(pick(PALETTE)));
      }
      w.add(sm);
      if (tr.candles) {
        const a = a0 + TH / 2, rr = (tr.r + tiers[1].r) / 2, col = pick(['#3a86ff', '#ffbe0b', '#06d6a0', '#8338ec', '#ff006e']);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 12), new THREE.MeshStandardMaterial({ map: stripeTex('#ffffff', col), roughness: 0.4 }));
        c.position.set(Math.sin(a) * rr, tr.h + 0.29, Math.cos(a) * rr); c.castShadow = true; w.add(c);
        const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06), wickMat); wick.position.copy(c.position); wick.position.y += 0.28; w.add(wick);
        const fp = wick.position.clone(); fp.y += 0.02; mkFlame(w, fp, 1);
        w.userData.candle = c;
      }
      w.userData = { ...w.userData, a: a0 + TH / 2, tier: ti, r: tr.r, h: tr.h, frost: tr.frost };
      group.add(w); tierWedges.push(w);
    }
    wedges.push(tierWedges);
  });

  const font = new FontLoader().parse(fontJson);
  const nums = new THREE.Group(); nums.position.y = tiers[1].y + tiers[1].h + 0.06;
  [['2', -0.3, '#3a86ff'], ['9', 0.3, '#ff006e']].forEach(([ch, x, col]) => {
    const g = new TextGeometry(ch, { font, size: 0.62, depth: 0.16, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3 });
    g.computeBoundingBox(); const bb = g.boundingBox; g.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2);
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.25, metalness: 0.3, clearcoat: 1 }));
    m.position.set(x, 0, 0.15); m.castShadow = true; nums.add(m);
    const top = bb.max.y - bb.min.y;
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07), wickMat); wick.position.set(x, top + 0.04, 0.15); nums.add(wick);
    mkFlame(nums, new THREE.Vector3(x, top + 0.08, 0.15), 1.3);
  });
  group.add(nums);

  const light = new THREE.PointLight('#ffb347', 0, 8, 1.6); light.position.set(0, 3.0, 0.6); group.add(light);
  flames.forEach(f => (f.thresh = 0.15 + Math.random() * 0.8));

  function update(dt, time, camera) {
    let lit = 0;
    flames.forEach(f => {
      f.life += (f.target - f.life) * Math.min(1, dt * (f.target > f.life ? 4 : 10));
      f.mat.uniforms.uTime.value = time; f.mat.uniforms.uLife.value = f.life; f.mat.uniforms.uLean.value = f.lean;
      f.mesh.quaternion.copy(camera.quaternion);
      f.glow.material.opacity = f.life * (0.75 + Math.sin(time * 13 + f.mat.uniforms.uSeed.value * 9) * 0.15);
      lit += f.life;
    });
    light.intensity = lit * 0.5 * (0.9 + Math.sin(time * 11) * 0.06 + Math.sin(time * 23) * 0.04);
  }
  return { group, flames, wedges, nums, plate, light, update };
}
