import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initAudio, playSong, sfx, SYLLABLES, LYRIC_LINES, VERSE2_START } from './audio.js';
import { buildCake } from './cake.js';
import { buildPresents, Debris } from './presents.js';
import { Bits, Sparks, Smoke, radialTex, PALETTE, pick } from './fx.js';
import { GIFTS } from './gifts.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
const look = new THREE.Vector3();
const hemi = new THREE.HemisphereLight('#ffe8d0', '#5a3a6a', 0.7); scene.add(hemi);
const key = new THREE.DirectionalLight('#fff1dc', 1.6); key.position.set(-3, 8, 5); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); key.shadow.radius = 6; scene.add(key);
const rim = new THREE.DirectionalLight('#9ad0ff', 1.2); rim.position.set(4, 4, -5); scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.35 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const loader = new THREE.TextureLoader();
const bgs = Object.fromEntries(['party', 'room', 'finale'].map(n => { const t = loader.load(`art/${n}.jpg`, fitBg); t.colorSpace = THREE.SRGBColorSpace; return [n, t]; }));
function fitBg() {
  Object.values(bgs).forEach(t => {
    if (!t.image) return; const ia = t.image.width / t.image.height, a = innerWidth / innerHeight;
    if (a < ia) { t.repeat.set(a / ia, 1); t.offset.set((1 - a / ia) / 2, 0); } else { t.repeat.set(1, ia / a); t.offset.set(0, (1 - ia / a) / 2); }
  });
}

const fxScene = new THREE.Scene(), fxCam = new THREE.PerspectiveCamera(50, 1, 0.1, 100); fxCam.position.z = 10;
fxScene.add(new THREE.HemisphereLight('#ffffff', '#886699', 2.2)); const fxl = new THREE.DirectionalLight('#ffffff', 2.5); fxl.position.set(2, 3, 5); fxScene.add(fxl);
const confetti = new Bits(fxScene, new THREE.PlaneGeometry(0.2, 0.11), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.35, metalness: 0.4 }), 900);
const streamers = new Bits(fxScene, new THREE.PlaneGeometry(0.06, 0.5), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.3, metalness: 0.5 }), 120);
const glitter = new Sparks(fxScene, 1500, 0.32);
const fireworks = new Sparks(fxScene, 2500, 0.45);
const crumbs = new Bits(scene, new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshStandardMaterial({ roughness: 0.7 }), 400);
const sparks3d = new Sparks(scene, 600, 0.25);
const smoke = new Smoke(scene);
const debris = new Debris(scene);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

let viewW = 1, viewH = 1;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = fxCam.aspect = w / h; fxCam.updateProjectionMatrix();
  viewH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(25)); viewW = viewH * fxCam.aspect;
  fitFov(); fitBg();
}
let fit = { halfW: 2.4, halfH: 2.4, dist: 7 };
function fitFov() {
  const v1 = 2 * Math.atan(fit.halfH / fit.dist), v2 = 2 * Math.atan(fit.halfW / fit.dist / camera.aspect);
  camera.fov = THREE.MathUtils.radToDeg(Math.max(v1, v2)); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const tweens = new Set(), frames = new Set();
const ease = {
  lin: k => k, out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, in: k => k * k * k,
  back: k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  elastic: k => k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  bounce: k => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; },
};
const tween = (dur, fn, e = ease.inOut) => new Promise(res => tweens.add({ t: 0, dur, fn, e, res }));
const wait = s => tween(s, () => {});
const lerp = THREE.MathUtils.lerp;
function camTo(pos, target, dur, e = ease.inOut) {
  const p0 = camera.position.clone(), l0 = look.clone();
  return tween(dur, k => { camera.position.lerpVectors(p0, pos, k); look.lerpVectors(l0, target, k); }, e);
}
let shake = 0;

const clock = new THREE.Clock(); let time = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  for (const tw of [...tweens]) { tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.e(k), k); if (k >= 1) { tweens.delete(tw); tw.res(); } }
  frames.forEach(f => f(dt));
  camera.lookAt(look);
  if (shake > 0.001) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake *= Math.pow(0.002, dt); }
  if (cake) cake.update(dt, time, camera);
  confetti.update(dt); streamers.update(dt); crumbs.update(dt); glitter.update(dt, time); fireworks.update(dt, time); sparks3d.update(dt, time); smoke.update(dt); debris.update(dt);
  composer.render();
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(fxScene, fxCam); renderer.autoClear = true;
});

const ui = { big: $('big'), sub: $('sub'), btn: $('btn'), hint: $('hint'), lyrics: $('lyrics') };
function big(html, huge = false) { ui.big.className = 'toon' + (huge ? ' huge' : ''); ui.big.innerHTML = html ? `<span class="pop">${html}</span>` : ''; }
function sub(t) { ui.sub.textContent = t || ''; }
function button(label) {
  return new Promise(res => {
    ui.btn.textContent = label; ui.btn.classList.remove('hidden');
    ui.btn.onclick = () => { ui.btn.classList.add('hidden'); ui.btn.onclick = null; sfx.pop(1.3); res(); };
  });
}
function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function bubble(text, world) {
  const v = world.clone().project(camera), el = document.createElement('div');
  el.className = 'bubble'; el.textContent = text; el.style.left = `${(v.x * .5 + .5) * 100}%`; el.style.top = `${(-v.y * .5 + .5) * 100}%`;
  el.style.setProperty('--r', `${(Math.random() - .5) * 30}deg`); $('bubbles').appendChild(el); setTimeout(() => el.remove(), 950);
}
function iris(open, dur = 0.9) {
  const el = $('iris'), R = Math.hypot(innerWidth, innerHeight) / 2 + 20;
  return tween(dur, k => { const r = open ? k * R : (1 - k) * R; el.style.background = `radial-gradient(circle at 50% 50%, transparent ${r}px, #12061f ${r + 1.5}px)`; }, open ? ease.in : ease.inOut);
}

function confettiBurst(n = 400, cannons = true) {
  for (let i = 0; i < n; i++) {
    const c = pick(PALETTE), side = i % 2 ? 1 : -1;
    if (cannons && i < n * 0.6) {
      const p = new THREE.Vector3(side * viewW / 2, -viewH / 2, (Math.random() - .5) * 2);
      const v = new THREE.Vector3(-side * (2 + Math.random() * 5), 9 + Math.random() * 7, (Math.random() - .5) * 3);
      (i % 9 ? confetti : streamers).spawn(p, v, c, { life: 3 + Math.random() * 1.5, grav: -5, drag: 1.4, sway: 1.5, scale: 0.8 + Math.random() * 0.6 });
    } else {
      const p = new THREE.Vector3((Math.random() - .5) * viewW, viewH / 2 + Math.random() * 3, (Math.random() - .5) * 3);
      confetti.spawn(p, new THREE.Vector3((Math.random() - .5) * 1, -1 - Math.random() * 2, 0), c, { life: 5, grav: -2, drag: 1.5, sway: 2, scale: 0.8 + Math.random() * 0.5 });
    }
  }
}
function glitterBurst(n = 300, center = new THREE.Vector3()) {
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 9);
    glitter.spawn(center, v, pick(['#ffd60a', '#ffffff', '#ff70a6', '#80ffdb', '#ffe680']), { life: 2 + Math.random() * 2, grav: -1.5, drag: 1.8, twinkle: 15 + Math.random() * 15 });
  }
}
function firework() {
  const c = new THREE.Vector3((Math.random() - .5) * viewW * 0.8, viewH * (0.05 + Math.random() * 0.35), -2 - Math.random() * 3);
  const col = pick(['#ffd60a', '#ff006e', '#3a86ff', '#06d6a0', '#ff70a6', '#ffffff', '#fb5607']);
  sfx.firework();
  setTimeout(() => { for (let i = 0; i < 140; i++) fireworks.spawn(c, new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 1.5), col, { life: 1.6 + Math.random() * 0.6, grav: -2.2, drag: 1.2, twinkle: 25 }); }, 500);
}

let cake = null;

async function cakeScene() {
  scene.background = bgs.party;
  cake = buildCake(); scene.add(cake.group);
  fit = { halfW: 2.3, halfH: 2.0, dist: 6.8 }; fitFov();
  camera.position.set(0, 7, 14); look.set(0, 2, 0);
  cake.group.position.y = 9;
  iris(true, 1.2);
  sfx.whoosh(1.2);
  camTo(new THREE.Vector3(0, 3.3, 6.6), new THREE.Vector3(0, 2.05, 0), 2.6);
  await wait(0.5);
  await tween(0.8, k => (cake.group.position.y = 9 * (1 - k)), ease.in);
  sfx.thud(); shake = 0.25;
  for (let i = 0; i < 80; i++) sparks3d.spawn(new THREE.Vector3((Math.random() - .5) * 3.5, 0.2, (Math.random() - .5) * 3.5), new THREE.Vector3((Math.random() - .5) * 4, 2 + Math.random() * 3, (Math.random() - .5) * 4), pick(['#ffd60a', '#ffffff', '#ff70a6']), { life: 1.2, grav: -4, twinkle: 20 });
  await tween(0.7, k => { const s = Math.sin(k * Math.PI * 3) * (1 - k) * 0.28; cake.group.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6); }, ease.lin);
  await wait(0.4);
  const order = [...cake.flames].sort(() => Math.random() - .5);
  for (const f of order) { f.target = 1; sfx.fwip(); await wait(0.13); }
  await wait(0.5);
  ui.lyrics.innerHTML = '';
  const orbit = { on: true };
  const orb = dt => { if (!orbit.on) return; const a = Math.sin(time * 0.35) * 0.35; camera.position.x = Math.sin(a) * 6.6; camera.position.z = Math.cos(a) * 6.6; };
  frames.add(orb);
  await playSong(i => {
    if (i === VERSE2_START) floatMonkey();
    const line = LYRIC_LINES.findIndex(([a, b]) => i >= a && i < b), [a, b] = LYRIC_LINES[line];
    const words = []; for (let j = a; j < b; j++) { const w = words[words.length - 1]; if (SYLLABLES[j] === '~') { w.end = j; continue; } if (w && w.open) { w.text += SYLLABLES[j]; w.end = j; w.open = SYLLABLES[j].endsWith('-'); } else words.push({ text: SYLLABLES[j], start: j, end: j, open: SYLLABLES[j].endsWith('-') }); }
    words.forEach(w => (w.text = w.text.replace(/-/g, '')));
    if (i === a) ui.lyrics.innerHTML = words.map(w => `<span>${w.text}</span>`).join(' ');
    [...ui.lyrics.children].forEach((el, j) => { const w = words[j], c = w.end < i ? 'done' : w.start <= i ? 'on' : ''; if (el.className !== c) el.className = c; });
    cake.group.scale.y = 1.04; tween(0.25, k => (cake.group.scale.y = 1.04 - 0.04 * k), ease.out);
    if (i === 17) { sfx.sparkle(1); for (let k = 0; k < 60; k++) sparks3d.spawn(new THREE.Vector3(0, 2.4, 0), new THREE.Vector3().randomDirection().multiplyScalar(3), pick(['#ffd60a', '#ff70a6']), { life: 1.2, grav: -2, twinkle: 20 }); }
  }, { monkey: true });
  ui.lyrics.innerHTML = '';
  frames.delete(orb);
  await camTo(new THREE.Vector3(0, 3.1, 5.8), new THREE.Vector3(0, 2.0, 0), 1.2);
  big('Make a wish,<br>Hunter!'); sub('Close your eyes and make a good one ✨'); sfx.sparkle(1.5);
  await button('I made my wish! 🙏');
  big(''); sub('');
  const pushes = [[5.6, 2.05], [5.1, 2.12], [4.6, 2.2]];
  for (let n = 3; n >= 1; n--) {
    big(String(n), true); sfx.boop(n === 1 ? 79 : 72); shake = 0.08;
    const [z, y] = pushes[3 - n]; camTo(new THREE.Vector3(0, y + 0.6, z), new THREE.Vector3(0, y - 0.1, 0), 0.5, ease.back);
    await wait(0.9);
  }
  big('<span style="font-size:min(110px,24vw)">BLOW!</span>', true); sfx.horn();
  await blowPhase();
  big('');
  await wait(0.6);
  camTo(new THREE.Vector3(0, 3.3, 6.6), new THREE.Vector3(0, 2.05, 0), 1.2);
  big('WISH<br>GRANTED!'); sfx.tada(); confettiBurst(350); glitterBurst(200, new THREE.Vector3(0, 0, 0));
  await wait(2.6); big('');
  await eatCake();
  await iris(false, 1.0);
  scene.remove(cake.group); cake = null;
}

function blowPhase() {
  return new Promise(res => {
    let energy = 0, sim = 0, done = false;
    ui.btn.textContent = 'Tap to blow 💨'; ui.btn.classList.remove('hidden');
    ui.btn.onclick = () => { ui.btn.classList.add('hidden'); ui.btn.onclick = null; sim = 1.4; sfx.whoosh(0.8); };
    const f = dt => {
      if (sim <= 0) return;
      sim -= dt; energy += 1.3 * dt * 0.9;
      cake.flames.forEach((fl, i) => {
        if (fl.out) return;
        fl.lean = lerp(fl.lean, 1.8 * (i % 2 ? 1 : -0.8) + Math.sin(time * 20 + i) * 0.5, Math.min(1, dt * 12));
        fl.target = 0.4;
        if (energy > fl.thresh) { fl.out = true; fl.target = 0; sfx.puff(); const p = new THREE.Vector3(); fl.mesh.getWorldPosition(p); smoke.puff(p, 9); }
      });
      if (!done && cake.flames.every(fl => fl.out)) { done = true; frames.delete(f); setTimeout(res, 900); }
    };
    frames.add(f);
  });
}

function floatMonkey() {
  const m = $('monkey'); m.classList.remove('hidden', 'go'); void m.offsetWidth; m.classList.add('go');
  sfx.boing(1.2); setTimeout(() => m.classList.add('hidden'), 14500);
}

async function eatCake() {
  const words = ['CHOMP!', 'NOM!', 'MUNCH!', 'GULP!', 'NOM NOM!', 'CRUNCH!', 'YUM!'];
  const seq = [...cake.wedges[1], ...cake.wedges[0]];
  let delay = 0.4, first = true;
  for (const w of seq) {
    const u = w.userData, wp = new THREE.Vector3(Math.sin(u.a) * u.r * 0.7, w.position.y + u.h * 0.7, Math.cos(u.a) * u.r * 0.7);
    sfx.chomp(); shake = 0.12; bubble(pick(words), wp);
    if (first) {
      first = false; const n = cake.nums;
      const v = new THREE.Vector3(2.5, 7, 1.5); sfx.boing(1.4);
      const fl = dt => { v.y -= 14 * dt; n.position.addScaledVector(v, dt); n.rotation.z -= 9 * dt; n.rotation.x += 4 * dt; if (n.position.y < -10) frames.delete(fl); };
      frames.add(fl);
    }
    for (let i = 0; i < 26; i++) crumbs.spawn(wp, new THREE.Vector3(Math.sin(u.a) * (1 + Math.random() * 3) + (Math.random() - .5) * 2, 2 + Math.random() * 3, Math.cos(u.a) * (1 + Math.random() * 3) + (Math.random() - .5) * 2),
      pick(['#ffd98e', '#ffd98e', u.frost, '#fff4f0', '#e0245e', pick(PALETTE)]), { life: 1.8, grav: -12, drag: 0.3, floor: 0.08, scale: 0.6 + Math.random() * 0.9 });
    tween(0.18, k => { const s = 1 - k; w.scale.set(s * (1 + 0.3 * Math.sin(k * Math.PI)), s, s * (1 + 0.3 * Math.sin(k * Math.PI))); }, ease.in).then(() => (w.visible = false));
    tween(0.35, k => { const s = Math.sin(k * Math.PI * 2) * (1 - k) * 0.08; cake.group.scale.set(1 + s, 1 - s, 1 + s); cake.group.rotation.z = s * 0.4; }, ease.lin);
    await wait(delay); delay = Math.max(0.17, delay * 0.88);
  }
  await wait(0.5);
  sfx.boing(0.8);
  await tween(0.7, k => { cake.plate.rotation.y = k * 12; const s = 1 - ease.back(k) * 0; cake.group.scale.setScalar(1 - ease.in(k)); }, ease.lin);
  sfx.pop(); flash(); for (let i = 0; i < 120; i++) sparks3d.spawn(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 4), pick(['#ffd60a', '#ffffff', '#ff70a6', '#80ffdb']), { life: 1.5, grav: -2, twinkle: 20 });
  await wait(0.5);
  sfx.burp(); bubble('BURP!', new THREE.Vector3(0, 1.6, 0));
  await wait(1.4);
}

let pres = null;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let picking = false, onPick = null;
canvas.addEventListener('pointerdown', e => {
  if (!picking || !pres) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(pres.presents.filter(p => !p.opened).map(p => p.root), true)[0];
  if (hit) onPick(pres.presents[hit.object.userData.present]);
});
window.__presentScreen = () => pres && pres.presents.filter(p => !p.opened).map(p => { const v = p.root.position.clone().setY(p.H / 2).project(camera); return [(v.x * .5 + .5) * innerWidth, (-v.y * .5 + .5) * innerHeight]; });

const HOME = { pos: new THREE.Vector3(0, 6.2, 6.6), look: new THREE.Vector3(0, 2.3, -0.3) };
async function presentScene() {
  scene.background = bgs.room;
  pres = buildPresents(); scene.add(pres.group);
  fit = { halfW: 2.0, halfH: 2.2, dist: 7.6 }; fitFov();
  camera.position.copy(HOME.pos).add(new THREE.Vector3(0, 2, 3)); look.copy(HOME.look);
  pres.presents.forEach(p => (p.root.position.y = 12));
  iris(true, 1.0); camTo(HOME.pos, HOME.look, 2.2);
  await wait(0.4);
  for (const p of pres.presents) {
    tween(0.9, k => (p.root.position.y = 12 * (1 - ease.bounce(k))), ease.lin).then(() => { });
    setTimeout(() => { sfx.boing(0.8 + Math.random() * 0.6); tween(0.5, k => { const s = Math.sin(k * Math.PI * 2) * (1 - k) * 0.25; p.pivot.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5); }, ease.lin); }, 330);
    await wait(0.17);
  }
  await wait(1.2);
  const wig = dt => pres.presents.forEach(p => {
    if (p.opened || p.busy) return;
    p.wiggleAt -= dt;
    if (p.wiggleAt < 0) { p.wig = 1; p.wiggleAt = 2 + Math.random() * 4; }
    if (p.wig > 0) { p.wig = Math.max(0, p.wig - dt * 1.6); const w = p.wig; p.pivot.rotation.z = Math.sin(w * 30) * 0.12 * w; p.pivot.position.y = Math.abs(Math.sin(w * 15)) * 0.2 * w; p.pivot.scale.set(1, 1 + Math.sin(w * 30) * 0.05 * w, 1); }
  });
  frames.add(wig);
  for (let n = 0; n < GIFTS.length; n++) {
    const left = GIFTS.length - n;
    ui.hint.innerHTML = n === 0 ? 'Pick a present! 🎁<small>Tap one to unwrap it</small>' : `Choose your next present!<small>${left} left</small>`;
    ui.hint.classList.remove('hidden');
    const p = await new Promise(res => { picking = true; onPick = res; });
    picking = false; ui.hint.classList.add('hidden');
    await unwrap(p, n);
  }
  frames.delete(wig);
}

async function unwrap(p, n) {
  p.busy = true; p.opened = true;
  p.pivot.rotation.z = 0; p.pivot.position.y = 0; p.pivot.scale.set(1, 1, 1);
  const c = p.root.position.clone(), sz = Math.max(p.W, p.H, p.Dp);
  sfx.whoosh(0.6);
  await camTo(c.clone().add(new THREE.Vector3(0, 1.4 + sz * 1.2, 2.4 + sz * 1.6)), c.clone().add(new THREE.Vector3(0, p.H * 0.5, 0)), 0.8);
  sfx.rattle(1.0);
  await tween(1.0, (k, raw) => {
    p.pivot.rotation.z = Math.sin(raw * 70) * 0.1 * raw; p.pivot.rotation.x = Math.cos(raw * 55) * 0.05 * raw;
    p.pivot.position.y = Math.abs(Math.sin(raw * 35)) * 0.1 * raw; p.pivot.scale.set(1 + 0.12 * raw, 1 - 0.22 * raw, 1 + 0.12 * raw);
  }, ease.lin);
  sfx.pop(0.8);
  await tween(0.12, k => p.pivot.scale.set(1.12 - 0.2 * k, 0.78 + 0.5 * k, 1.12 - 0.2 * k), ease.out);
  p.bands.forEach(b => (b.visible = false));
  sfx.rip(); setTimeout(() => sfx.rip(), 150); shake = 0.2;
  debris.explode(p);
  const glowPos = c.clone().add(new THREE.Vector3(0, p.H * 0.5, 0));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,220,120,.7)'], [1, 'rgba(255,200,80,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.copy(glowPos); scene.add(glow);
  tween(1.0, k => { glow.scale.setScalar(0.5 + k * 9); glow.material.opacity = 1 - k; }, ease.out).then(() => scene.remove(glow));
  for (let i = 0; i < 150; i++) sparks3d.spawn(glowPos, new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 5), pick(['#ffd60a', '#ffffff', '#ff70a6', '#80ffdb']), { life: 1.6, grav: -3, twinkle: 25 });
  await wait(0.25);
  flash(); sfx.tada(); confettiBurst(500); glitterBurst(450);
  await wait(0.7);
  await showCard(GIFTS[n], n);
  await camTo(HOME.pos, HOME.look, 1.0);
}

function showCard(g, n) {
  return new Promise(res => {
    const card = $('card'), img = $('gimg'), ph = $('gph');
    $('gnum').textContent = `Gift ${n + 1} of ${GIFTS.length}`;
    $('gtitle').textContent = g.title; $('gdesc').textContent = g.desc; $('gfrom').textContent = g.from;
    img.style.display = ''; ph.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; ph.style.display = 'block'; };
    img.src = g.img;
    const last = n === GIFTS.length - 1;
    $('next').textContent = last ? '✨ One more thing… ✨' : 'Choose your next present ➜';
    card.classList.remove('hidden');
    [...card.querySelectorAll('.cardInner,#gimg,#next')].forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    sfx.sparkle(1.5);
    const sparkleLoop = setInterval(() => glitterBurst(25, new THREE.Vector3((Math.random() - .5) * viewW * 0.8, (Math.random() - .5) * viewH * 0.6, 0)), 600);
    $('next').onclick = () => { clearInterval(sparkleLoop); sfx.pop(1.3); card.classList.add('hidden'); res(); };
  });
}

async function finaleScene() {
  await iris(false, 0.9);
  scene.remove(pres.group); debris.list.forEach(o => scene.remove(o));
  scene.background = bgs.finale; ground.visible = false;
  camera.position.set(0, 0, 8); look.set(0, 0, 0);
  const sign = $('finale');
  const lines = sign.querySelectorAll('.l');
  let d = 0.5; lines.forEach(l => { l.innerHTML = [...l.textContent].map(ch => `<span style="animation-delay:${(d += 0.07).toFixed(2)}s">${ch === ' ' ? '&nbsp;' : ch}</span>`).join(''); });
  const bulbs = sign.querySelector('.bulbs'); bulbs.innerHTML = '';
  const N = 28; for (let i = 0; i < N; i++) {
    const t = i / N, per = t * 4, side = Math.floor(per), f = per - side;
    const [x, y] = [[f, 0], [1, f], [1 - f, 1], [0, 1 - f]][side];
    bulbs.insertAdjacentHTML('beforeend', `<i style="left:${x * 100}%;top:${y * 100}%;animation-delay:${(i % 3) * 0.3}s"></i>`);
  }
  $('haul').innerHTML = GIFTS.map(g => `<div style="background-image:url('${g.img}')"></div>`).join('');
  [...$('haul').children].forEach((el, i) => { const im = new Image(); im.onerror = () => { el.style.backgroundImage = 'none'; el.textContent = '🎁'; }; im.src = GIFTS[i].img; });
  sign.classList.remove('hidden');
  iris(true, 1.0);
  sfx.whoosh(1);
  setTimeout(() => { sfx.thud(); sfx.tada(); confettiBurst(600); glitterBurst(400); flash(); }, 850);
  let fw = setInterval(firework, 700); firework();
  const rain = setInterval(() => confettiBurst(60, false), 900);
  await wait(2.5);
  await playSong(null, { big: true, beat: 0.46 });
  confettiBurst(600); sfx.tada();
  $('replay').onclick = () => location.reload();
  setTimeout(() => { clearInterval(fw); fw = setInterval(firework, 1600); }, 6000);
}

$('go').onclick = async () => {
  initAudio(); sfx.pop(1.3);
  $('start').remove();
  $('iris').style.background = '#12061f';
  const only = new URLSearchParams(location.search).get('scene');
  if (!only) await cakeScene();
  if (only !== 'finale') await presentScene(); else pres = buildPresents();
  await finaleScene();
};
