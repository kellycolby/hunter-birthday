let ctx, master, reverb, noiseBuf;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function setSession(type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {} }

export function initAudio() {
  setSession('playback');
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  reverb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  reverb.buffer = ir; reverb.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
  ctx.resume();
}

const now = () => ctx.currentTime + 0.02;
function out(node, wet = 0.25) {
  node.connect(master);
  if (wet) { const g = ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(reverb); }
}
function env(t, a, peak, dur) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); return g;
}
function osc(type, f, t, dur, dest) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
function noise(t, dur, { type = 'bandpass', f = 1000, f2, q = 1, vol = 0.3, a = 0.005, wet = 0.15 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = env(t, a, vol, dur); s.connect(fl); fl.connect(g); out(g, wet); s.start(t); s.stop(t + dur + 0.05); return g;
}

function bell(m, t, dur = 1.4, vol = 0.22) {
  const g = env(t, 0.004, vol, dur);
  [[1, 1], [2, 0.3], [3.01, 0.1], [4.2, 0.05]].forEach(([h, a]) => { const og = ctx.createGain(); og.gain.value = a; og.connect(g); osc('sine', mtof(m) * h, t, dur, og); });
  out(g, 0.4);
}
function pad(ms, t, dur, vol = 0.05) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.12);
  g.gain.setValueAtTime(vol, t + Math.max(0.15, dur - 0.15)); g.gain.linearRampToValueAtTime(0, t + dur);
  ms.forEach(m => [-6, 6].forEach(d => { const o = osc('sawtooth', mtof(m), t, dur, f); o.detune.value = d; }));
  f.connect(g); out(g, 0.5);
}
function brass(ms, t, dur, vol = 0.07) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2600, t + 0.08); f.frequency.linearRampToValueAtTime(1500, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol * 0.8, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
  ms.forEach(m => [-8, 8].forEach(d => { const o = osc('sawtooth', mtof(m), t, dur, f); o.detune.value = d; }));
  f.connect(g); out(g, 0.35);
}
function bass(m, t, dur, vol = 0.28) { const g = env(t, 0.01, vol, dur); osc('triangle', mtof(m), t, dur, g); out(g, 0.05); }

const V1 = [
  [62, .75, 'Hap-'], [62, .25, 'py'], [64, 1, 'birth-'], [62, 1, 'day'], [67, 1, 'to'], [66, 2, 'you'],
  [62, .75, 'Hap-'], [62, .25, 'py'], [64, 1, 'birth-'], [62, 1, 'day'], [69, 1, 'to'], [67, 2, 'you'],
  [62, .75, 'Hap-'], [62, .25, 'py'], [74, 1, 'birth-'], [71, 1, 'day'], [67, 1, 'dear'], [66, 1, 'Hun-'], [64, 2.5, 'ter'],
  [72, .75, 'Hap-'], [72, .25, 'py'], [71, 1, 'birth-'], [67, 1, 'day'], [69, 1.25, 'to'], [67, 3, 'you!']];
const V2 = [
  [62, .75, 'Hap-'], [62, .25, 'py'], [64, 1, 'birth-'], [62, 1, 'day'], [67, 1, 'to'], [66, 2, 'you,'],
  [62, 1, 'you'], [64, 1, 'live'], [62, 1, 'in'], [69, 1, 'a'], [67, 2, 'zoo,'],
  [62, .75, 'you'], [62, .25, 'look'], [74, 1, 'like'], [71, 1, 'a'], [67, 1, 'mon-'], [66, 1, '~'], [64, 2, 'key,'],
  [72, .75, 'and'], [72, .25, 'you'], [71, 1, 'act'], [67, 1, 'like'], [69, 1.25, 'one'], [67, 3, 'too!']];
const MEL = [...V1.slice(0, -1), [67, 2, 'you!'], ...V2];
export const LYRIC_LINES = [[0, 6], [6, 12], [12, 19], [19, 25], [25, 31], [31, 36], [36, 43], [43, 49]];
export const SYLLABLES = MEL.map(n => n[2]);
export const VERSE2_START = 25;
const G = [[55, 59, 62], 43], D7 = [[54, 57, 60], 38], G7 = [[53, 59, 62], 43], C = [[52, 55, 60], 36];
const CH1 = { 2: G, 5: D7, 8: D7, 11: G, 14: G7, 16: C, 18: D7, 21: G, 23: D7, 24: G };
const CH2 = { 27: G, 30: D7, 32: D7, 35: G, 38: G7, 40: C, 42: D7, 45: G, 47: D7, 48: G };

export function playSong(onNote, { big = false, beat = 0.5, monkey = false } = {}) {
  const notes = monkey ? MEL : V1, CH = monkey ? { ...CH1, ...CH2 } : CH1;
  const t0 = now() + 0.15; let t = t0;
  const starts = [];
  notes.forEach(([m, b], i) => { starts.push(t); t += b * beat; });
  const end = t;
  notes.forEach(([m, b], i) => {
    const ts = starts[i], dur = b * beat;
    bell(m + 12, ts, Math.max(0.9, dur * 1.6), big ? 0.2 : 0.24);
    if (big) { brass([m], ts, dur * 0.95, 0.05); bell(m + 24, ts, 0.8, 0.06); }
    const ch = CH[i];
    if (ch) {
      const nextI = Object.keys(CH).map(Number).find(k => k > i);
      const chEnd = nextI !== undefined ? starts[nextI] : end;
      pad(ch[0], ts, chEnd - ts + 0.1, big ? 0.05 : 0.035);
      for (let bt = ts; bt < chEnd - 0.01; bt += beat) bass(ch[1] + (bt === ts ? 0 : 12 * ((Math.round((bt - ts) / beat)) % 2)), bt, beat * 0.9);
    }
    setTimeout(() => onNote && onNote(i), (ts - ctx.currentTime) * 1000);
  });
  if (big) sparkle(end - 0.2, 2);
  return new Promise(r => setTimeout(r, (end - ctx.currentTime) * 1000 + 300));
}

export const sfx = {
  pop(p = 1) { const t = now(), g = env(t, 0.003, 0.4, 0.12); const o = osc('sine', 700 * p, t, 0.12, g); o.frequency.exponentialRampToValueAtTime(120, t + 0.1); out(g, 0.1); },
  boop(m = 72) { const t = now(), g = env(t, 0.005, 0.25, 0.5); osc('square', mtof(m), t, 0.5, g); const g2 = env(t, 0.005, 0.25, 0.7); osc('sine', mtof(m - 12), t, 0.7, g2); out(g2, 0.2); out(g, 0.2); bell(m + 12, t, 1, 0.15); },
  whoosh(d = 0.7) { const t = now(); noise(t, d, { f: 300, f2: 3000, q: 1.5, vol: 0.25, a: d * 0.5 }); },
  puff() { const t = now(); noise(t, 0.45, { type: 'lowpass', f: 900, f2: 200, vol: 0.35, a: 0.02 }); },
  fwip() { const t = now(); noise(t, 0.25, { f: 1500, f2: 5000, q: 2, vol: 0.18, a: 0.05 }); bell(84 + Math.floor(Math.random() * 8), t + 0.05, 0.6, 0.08); },
  chomp() {
    const t = now(), p = 0.85 + Math.random() * 0.3;
    noise(t, 0.09, { f: 1800 * p, q: 2, vol: 0.45, wet: 0.05 });
    const g = env(t, 0.003, 0.5, 0.14); const o = osc('sine', 170 * p, t, 0.14, g); o.frequency.exponentialRampToValueAtTime(50, t + 0.13); out(g, 0.05);
    for (let i = 0; i < 4; i++) noise(t + 0.06 + i * 0.03 + Math.random() * 0.02, 0.025, { f: 3500, q: 3, vol: 0.2, wet: 0 });
  },
  thud() { const t = now(), g = env(t, 0.003, 0.7, 0.35); const o = osc('sine', 120, t, 0.35, g); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); out(g, 0.15); noise(t, 0.15, { type: 'lowpass', f: 500, vol: 0.3 }); },
  rattle(d = 0.9) { const t = now(); for (let i = 0; i < d * 22; i++) noise(t + i / 22 + Math.random() * 0.02, 0.04, { f: 800 + Math.random() * 1500, q: 4, vol: 0.12 + i / (d * 22) * 0.2, wet: 0.05 }); },
  rip() {
    const t = now(), d = 0.6;
    const g = noise(t, d, { f: 1500, f2: 4500, q: 0.8, vol: 0.5, a: 0.01 });
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 0.2; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + d);
  },
  boing(p = 1) {
    const t = now(), g = env(t, 0.005, 0.25, 0.6); const o = osc('sine', 180 * p, t, 0.6, g); o.frequency.exponentialRampToValueAtTime(520 * p, t + 0.35);
    const l = ctx.createOscillator(); l.frequency.value = 18; const lg = ctx.createGain(); lg.gain.setValueAtTime(60 * p, t); lg.gain.linearRampToValueAtTime(0, t + 0.6); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.6); out(g, 0.15);
  },
  sparkle(d = 1.2) { sparkle(now(), d); },
  tada() { const t = now(); brass([60, 64, 67], t, 0.14, 0.08); brass([60, 64, 67], t + 0.16, 0.14, 0.08); brass([65, 69, 72], t + 0.32, 0.18, 0.08); brass([67, 72, 76, 79], t + 0.52, 1.4, 0.09); bass(36, t + 0.52, 1.4, 0.35); sparkle(t + 0.5, 1.5); },
  horn() {
    const t = now(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.03); g.gain.setValueAtTime(0.35, t + 0.7); g.gain.linearRampToValueAtTime(0, t + 0.9);
    const o = osc('sawtooth', 380, t, 0.9, f); o.frequency.linearRampToValueAtTime(470, t + 0.2);
    const l = ctx.createOscillator(); l.frequency.value = 9; const lg = ctx.createGain(); lg.gain.value = 14; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.9);
    f.connect(g); out(g, 0.15);
  },
  burp() {
    const t = now(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = env(t, 0.03, 0.5, 0.55); const o = osc('sawtooth', 95, t, 0.55, f); o.frequency.linearRampToValueAtTime(70, t + 0.5);
    const l = ctx.createOscillator(); l.frequency.value = 23; const lg = ctx.createGain(); lg.gain.value = 25; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.55);
    f.connect(g); out(g, 0.2);
  },
  firework() {
    const t = now(), g = env(t, 0.02, 0.08, 0.5); const o = osc('sine', 900, t, 0.5, g); o.frequency.exponentialRampToValueAtTime(2400, t + 0.45); out(g, 0.2);
    noise(t + 0.5, 0.9, { type: 'lowpass', f: 700, f2: 120, vol: 0.55, a: 0.005, wet: 0.5 });
    for (let i = 0; i < 14; i++) noise(t + 0.65 + Math.random() * 0.8, 0.02, { f: 4000, q: 2, vol: 0.12, wet: 0.3 });
  },
};
function sparkle(t, d) { for (let i = 0; i < d * 12; i++) bell(88 + [0, 2, 4, 7, 9, 12][Math.floor(Math.random() * 6)], t + Math.random() * d, 0.8, 0.05); }
