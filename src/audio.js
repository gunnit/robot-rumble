'use strict';
// ============================================================
// Sound (all generated, no files needed)
// ============================================================
const Snd = {
  ac: null, out: null, sfxBus: null, musBus: null, nbuf: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      this.out = this.ac.createGain(); this.out.gain.value = 0.6; this.out.connect(this.ac.destination);
      this.sfxBus = this.ac.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.out);
      this.musBus = this.ac.createGain(); this.musBus.gain.value = 0.3; this.musBus.connect(this.out);
      const len = this.ac.sampleRate * 2;
      this.nbuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },
  tone(type, f1, f2, dur, vol, delay = 0, bus) {
    if (!this.ac) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, delay = 0, bus) {
    if (!this.ac) return;
    const t = this.ac.currentTime + delay;
    const s = this.ac.createBufferSource(); s.buffer = this.nbuf;
    const f = this.ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.2, 40), t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  shoot() { this.tone('square', 880, 220, 0.07, 0.1); },
  hmg() { this.tone('square', 520, 140, 0.05, 0.08); this.noise(0.05, 0.1, 4000); },
  laser() { this.tone('sawtooth', 700, 300, 0.12, 0.05); },
  jump() { this.tone('square', 220, 520, 0.12, 0.06); },
  hit() { this.tone('square', 260, 120, 0.04, 0.07); },
  clank() { this.tone('square', 1300, 700, 0.03, 0.05); },
  boom(big) {
    this.noise(big ? 1.1 : 0.5, big ? 0.7 : 0.45, big ? 900 : 1400);
    this.tone('sine', big ? 90 : 140, 30, big ? 0.9 : 0.4, big ? 0.5 : 0.35);
  },
  cannon() { this.noise(0.25, 0.35, 1500); this.tone('sine', 200, 60, 0.2, 0.3); },
  throw() { this.tone('triangle', 300, 700, 0.15, 0.12); },
  hurt() { this.tone('sawtooth', 480, 90, 0.35, 0.18); },
  die() { [523, 392, 330, 262].forEach((f, i) => this.tone('square', f, f * 0.98, 0.18, 0.12, i * 0.15)); },
  pickup() { [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.08, 0.1, i * 0.06)); },
  freed() { [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.15, i * 0.09)); },
  slash() { this.noise(0.08, 0.2, 6000); },
  select() { this.tone('square', 660, 660, 0.06, 0.1); },
  win() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.18, 0.12, i * 0.14)); }
};

// Spoken lines use the browser's built-in voice
function say(text, pitch = 1, rate = 1) {
  try {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.pitch = pitch; u.rate = rate; u.volume = 1;
    speechSynthesis.speak(u);
  } catch (e) {}
}

// Chiptune music: one entry per eighth note, 0 = rest (MIDI note numbers).
// Optional per track: lead (melody oscillator, default 'square') and
// drums: { kick, snare, hat } patterns with one char per step, 'x' = hit; a drum left out is silent.
// Without drums a track gets the 4/4 beat (BEAT44).
const TRACKS = {
  main: {
    bpm: 150,
    bass: [45, 45, 57, 45, 45, 57, 45, 57, 43, 43, 55, 43, 43, 55, 43, 55, 41, 41, 53, 41, 41, 53, 41, 53, 40, 40, 52, 40, 40, 52, 44, 47],
    mel: [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 67, 0, 71, 0, 74, 0, 72, 0, 69, 0, 72, 0, 77, 76, 76, 0, 74, 0, 71, 0, 68, 0,
          69, 72, 76, 81, 79, 0, 76, 0, 74, 0, 71, 0, 67, 71, 74, 0, 72, 74, 76, 77, 76, 0, 72, 0, 71, 0, 68, 0, 64, 0, 0, 0]
  },
  boss: {
    bpm: 172,
    bass: [40, 40, 52, 40, 40, 52, 40, 50, 40, 40, 52, 40, 40, 52, 40, 50, 36, 36, 48, 36, 36, 48, 36, 48, 38, 38, 50, 38, 38, 50, 40, 43],
    mel: [64, 0, 0, 67, 0, 0, 71, 0, 70, 0, 0, 67, 0, 0, 64, 0, 60, 0, 0, 64, 0, 0, 67, 0, 66, 0, 62, 0, 66, 0, 71, 0]
  }
};
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const BEAT44 = { kick: 'x...', snare: '....x...', hat: '.x' };
const drumHit = (pat, i) => !!pat && pat[i % pat.length] === 'x';
const Music = {
  track: null, step: 0, next: 0, on: true,
  play(name) {
    this.track = TRACKS[name] || null; this.step = 0; this.next = 0;
    if (!this.track) warnOnce('music track', name);
  },
  stop() { this.track = null; },
  update() {
    const ac = Snd.ac;
    if (!ac || !this.track || !this.on) return;
    const tr = this.track, sd = 60 / tr.bpm / 2, dr = tr.drums || BEAT44;
    if (this.next < ac.currentTime) this.next = ac.currentTime + 0.03;
    while (this.next < ac.currentTime + 0.12) {
      const i = this.step, d = this.next - ac.currentTime;
      const b = tr.bass[i % tr.bass.length], m = tr.mel[i % tr.mel.length];
      if (b) Snd.tone('triangle', mf(b), mf(b), sd * 0.9, 0.5, d, Snd.musBus);
      if (m) Snd.tone(tr.lead || 'square', mf(m), mf(m), sd * 0.85, 0.11, d, Snd.musBus);
      if (drumHit(dr.kick, i)) Snd.tone('sine', 150, 45, 0.12, 0.6, d, Snd.musBus);
      if (drumHit(dr.hat, i)) Snd.noise(0.04, 0.12, 8000, d, Snd.musBus);
      if (drumHit(dr.snare, i)) Snd.noise(0.1, 0.25, 2500, d, Snd.musBus);
      this.step++;
      this.next += sd;
    }
  }
};
