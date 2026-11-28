// Mission 8's music, checked without ears: node tools/m8/music-check.mjs
// For every tune: whole bars, bass and drums that fit into the tune's length, the lead's range, how busy it is, and
// every step where the lead clashes with the bass (a semitone, a major seventh or a tritone above the bar's root or
// above the bass note sounding with it). A clash is not always a mistake (the Oggle march's A sharp is meant), so the
// list is printed to be read; the exit code is 1 only for a tune that does not fit together.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TRACKS = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/level8_music.js'), 'utf8'), { TRACKS });

const BAR = { dinovalley: 16, dinochase: 16, clubtail: 8, ogglerex: 8, dinodawn: 16 };
const HALF = { dinodawn: true };                       // the harmony may change in the middle of a bar
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nn = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
let bad = 0;
for (const [name, bar] of Object.entries(BAR)) {
  const t = TRACKS[name];
  if (!t) { console.log(name + ': MISSING'); bad++; continue; }
  const probs = [];
  if (t.mel.length % bar) probs.push(`tune is ${t.mel.length} steps: not whole bars of ${bar}`);
  if (t.mel.length % t.bass.length) probs.push(`bass (${t.bass.length}) does not fit into the tune (${t.mel.length})`);
  for (const [k, p] of Object.entries(t.drums || {})) if (t.mel.length % p.length) probs.push(`${k} (${p.length}) does not fit`);
  if (t.mel.some(n => !Number.isFinite(n)) || t.bass.some(n => !Number.isFinite(n))) probs.push('a note is not a number');
  const sung = t.mel.filter(n => n), lo = Math.min(...sung), hi = Math.max(...sung);
  if (lo < 60 || hi > 88) probs.push(`lead range ${nn(lo)}..${nn(hi)} leaves C4..E6`);
  const bs = t.bass.filter(n => n);
  if (Math.min(...bs) < 36 || Math.max(...bs) > 67) probs.push(`bass range ${nn(Math.min(...bs))}..${nn(Math.max(...bs))}`);
  const secs = t.mel.length * 60 / t.bpm / 2;
  console.log(`${name}: ${t.mel.length / bar} bars of ${bar}, ${t.bpm} bpm, ${secs.toFixed(1)} s a loop, lead ${t.lead || 'square'} ${nn(lo)}..${nn(hi)}, bass ${nn(Math.min(...bs))}..${nn(Math.max(...bs))}, ${Math.round(100 * sung.length / t.mel.length)} % of steps sung`);
  const seg = HALF[name] ? bar / 2 : bar, clashes = [];
  for (let i = 0; i < t.mel.length; i++) {
    const m = t.mel[i];
    if (!m) continue;
    const rootNote = t.bass[(i - i % seg) % t.bass.length], with_ = t.bass[i % t.bass.length];
    const strong = i % (bar / 4) === 0;
    for (const [what, b] of [['root', rootNote], ['bass', with_]]) {
      if (!b) continue;
      const iv = ((m - b) % 12 + 12) % 12;
      if (iv === 1 || iv === 11 || iv === 6) clashes.push(`bar ${Math.floor(i / bar) + 1} step ${i % bar}${strong ? '*' : ''}: ${nn(m)} over ${what} ${nn(b)} (${iv === 6 ? 'tritone' : iv === 1 ? 'semitone' : 'major seventh'})`);
    }
  }
  if (clashes.length) console.log('  clashes (* = on a beat):\n    ' + [...new Set(clashes)].join('\n    '));
  for (const p of probs) { console.log('  PROBLEM: ' + p); bad++; }
}
// Then the game's own player (src/audio.js) plays every tune for two loops into a stand-in for the browser's audio that
// only counts: every scheduled note must have a finite pitch, a start time that never runs backwards and a length.
{
  const log = { n: 0, bad: 0, last: 0 };
  const node = () => ({ connect() {}, start(t) { if (!(t >= 0)) log.bad++; }, stop() {}, gain: { value: 0, setValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) log.bad++; }, exponentialRampToValueAtTime(v, t) { if (!(v > 0) || !Number.isFinite(t)) log.bad++; } },
    frequency: { setValueAtTime(v, t) { log.n++; if (!(v > 20 && v < 12000)) log.bad++; }, exponentialRampToValueAtTime(v) { if (!(v > 0)) log.bad++; } }, type: '', buffer: null });
  class AC { constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.state = 'running'; }
    createGain() { return node(); } createOscillator() { return node(); } createBufferSource() { return node(); } createBiquadFilter() { return node(); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; } }
  const box = { window: { AudioContext: AC }, warnOnce: (a, b) => { console.log('  PROBLEM: ' + a + ' ' + b); bad++; }, Math, console };
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/level8_music.js'), 'utf8'), box);
  for (const name of Object.keys(BAR)) {
    log.n = 0; log.bad = 0;
    const steps = vm.runInContext(`(() => { Snd.init(); Music.play(${JSON.stringify(name)}); const T = Music.track, sd = 60 / T.bpm / 2, end = T.mel.length * 2 * sd;
      for (let t = 0; t < end; t += 1 / 60) { Snd.ac.currentTime = t; Music.update(); } return Music.step; })()`, box);
    const want = TRACKS[name].mel.length * 2;
    if (log.bad || Math.abs(steps - want) > 8) { console.log(`  PROBLEM: ${name} played ${steps} of ${want} steps, ${log.bad} bad values`); bad++; }
    else console.log(`${name}: the game's player ran it twice round (${steps} steps, ${log.n} notes and drum hits scheduled)`);
  }
}
console.log(bad ? `${bad} problem(s)` : 'all five tunes fit together');
process.exit(bad ? 1 : 0);
