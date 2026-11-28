// Harness extra (sim, render): a strict stand-in for the browser's AudioContext.
//
// Why: the harness has no sound (no window.AudioContext, so Snd.ac stays null and Snd.tone / Snd.noise return at
// once). A wrong number in a sound call (a missing argument, a NaN pitch, a negative time) is therefore never seen
// there, and in a browser the same call THROWS inside the enemy's update, where the engine drops that enemy
// (engine.js updateEnemies: "a broken enemy is dropped"): a boss would vanish in the middle of its fight.
// This fake checks every value the way Web Audio does and throws the same kind of error, so the harness lists the
// call under "errors" with its file and line. At the end of a run it prints, to stderr, how many sounds were played,
// the largest number at once and an upper bound for the loudest moment (1.0 = full scale at the speakers).
// The sound's own random numbers (its noise buffer, and where in it a noise starts) come from a generator of their
// own here, so a run with this check is, number for number, the run without it.
//
//   node tools/harness/harness.mjs sim --level 8 --seed 1 --extra tools/m8/audio-check.js
//   (any mission that only uses Snd.tone / Snd.noise / Music: 1, 2, 3, 5 and 8; add other --extra files after it)
//
// What it knows of Web Audio (the rules a browser enforces):
//   AudioParam.setValueAtTime(v, t)                 v finite (TypeError), t finite and >= 0 (RangeError)
//   AudioParam.exponentialRampToValueAtTime(v, t)   the same, and v must not be 0 (RangeError)
//   AudioParam.linearRampToValueAtTime(v, t)        the same as setValueAtTime
//   Oscillator / BufferSource .start(t) .stop(t)    t finite and >= 0; stop() before start() and a second start()
//                                                   are InvalidStateErrors; a buffer offset must be >= 0
// and what a browser lets pass but is surely a slip (printed as AUDIO odd ..., once each): a sound of no length,
// a pitch outside 20 Hz to 20 kHz, a volume above 1 or below 0, an oscillator type that does not exist.
{
  const RATE = 48000;
  let now = 0;                                              // the context's clock: 1/60 s per update of the game
  const odd = new Set(), stat = { tone: 0, noise: 0, musTone: 0, musNoise: 0, voices: 0, peak: 0, peakAt: '', peakOf: '' };
  let who = '';                                             // the line of the game that asked for the sound being made
  const seen = {};                                          // how often each line asked (AUDIO from ...: what a run covered)
  const live = [];                                          // sounds still ringing: { t0, t1, vol, bus }
  const note = s => { if (!odd.has(s)) { odd.add(s); console.log('AUDIO odd  ' + s); } };
  const num = (v, what) => {
    const n = Number(v);
    if (v === undefined || v === null || !isFinite(n)) throw new TypeError(what + ': the value is not a finite number (' + String(v) + ')');
    return n;
  };
  const time = (t, what) => { const n = num(t, what); if (n < 0) throw new RangeError(what + ': the time ' + n + ' is negative'); return n; };
  const param = (name, v0) => ({
    value: v0, name, first: null, last: null, t0: null, t1: null,
    setValueAtTime(v, t) { v = num(v, name + '.setValueAtTime'); t = time(t, name + '.setValueAtTime'); if (this.first == null) { this.first = v; this.t0 = t; } this.last = v; return this; },
    linearRampToValueAtTime(v, t) { v = num(v, name + '.linearRampToValueAtTime'); t = time(t, name + '.linearRampToValueAtTime'); this.last = v; this.t1 = t; return this; },
    exponentialRampToValueAtTime(v, t) {
      v = num(v, name + '.exponentialRampToValueAtTime'); t = time(t, name + '.exponentialRampToValueAtTime');
      if (v === 0) throw new RangeError(name + '.exponentialRampToValueAtTime: the target value must not be 0');
      this.last = v; this.t1 = t; return this;
    },
    setTargetAtTime(v, t, c) { num(v, name + '.setTargetAtTime'); time(t, name + '.setTargetAtTime'); num(c, name + '.setTargetAtTime'); return this; },
    cancelScheduledValues(t) { time(t, name + '.cancelScheduledValues'); return this; }
  });
  const node = extra => Object.assign({ to: null, connect(n) { if (!n) throw new TypeError('connect: no node to connect to'); this.to = n; return n; }, disconnect() {} }, extra);
  const TYPES = new Set(['sine', 'square', 'sawtooth', 'triangle']), FILTERS = new Set(['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass']);
  // how loud the chain from this node to the speakers makes a sound of gain 1 (the gains of the buses it runs through)
  const busGain = n => { let k = 1; for (let i = 0; n && i < 8; i++, n = n.to) if (n.gain && n.fixed) k *= n.gain.value; return k; };
  // a sound starts: check it, count it, and add up what is ringing at that moment (every envelope at its start value
  // times what is left of it: gain falls exponentially from vol to 0.0001 over the sound's length)
  function started(src, when, what) {
    const g = src.chain.find(n => n.gain && !n.fixed), vol = g ? g.gain.first ?? g.gain.value : 1;
    const t1 = g && g.gain.t1 != null ? g.gain.t1 : when, dur = t1 - when;
    if (dur <= 0) note(what + ' of no length (' + dur.toFixed(3) + ' s)');
    if (vol > 1 || vol < 0) note(what + ' with volume ' + vol);
    const k = busGain(g ? g.to : src.to);
    for (let i = live.length - 1; i >= 0; i--) if (live[i].t1 <= when) live.splice(i, 1);
    live.push({ t0: when, t1, vol: vol * k, who });
    seen[who] = (seen[who] || 0) + 1;
    if (who === 'music') stat[what === 'a tone' ? 'musTone' : 'musNoise']++;
    const level = s => s.vol * Math.pow(0.0001 / Math.max(s.vol, 0.0001), (when - s.t0) / Math.max(s.t1 - s.t0, 1e-6));
    let sum = 0, n = 0;
    for (const s of live) if (s.t0 <= when + 1e-9) { n++; sum += level(s); }
    if (n > stat.voices) stat.voices = n;
    if (sum > stat.peak) {
      stat.peak = sum; stat.peakAt = (typeof G !== 'undefined' && G.p ? 'x ' + Math.round(G.p.x) + ', ' : '') + n + ' sounds';
      const by = {};
      for (const s of live) if (s.t0 <= when + 1e-9) by[s.who] = (by[s.who] || 0) + level(s);
      stat.peakOf = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ');
    }
  }
  class FakeAudioContext {
    constructor() { this.sampleRate = RATE; this.state = 'running'; this.destination = node({ dest: true }); }
    get currentTime() { return now; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    // a gain that is only ever set with .value is a bus ("fixed"); one that is scheduled is a sound's own envelope
    createGain() {
      const n = node({ gain: param('gain', 1), fixed: true }), set = n.gain.setValueAtTime;
      n.gain.setValueAtTime = function (v, t) { n.fixed = false; return set.call(this, v, t); };
      return n;
    }
    createBiquadFilter() {
      let type = 'lowpass';
      return node({ frequency: param('filter.frequency', 350), Q: param('filter.Q', 1), gain: undefined,
        get type() { return type; }, set type(v) { if (FILTERS.has(v)) type = v; else note('filter type "' + v + '" does not exist (the browser keeps "' + type + '")'); } });
    }
    createBuffer(ch, len, rate) {
      num(ch, 'createBuffer'); num(len, 'createBuffer'); num(rate, 'createBuffer');
      if (!(len > 0) || !(ch > 0) || rate < 3000 || rate > 768000) throw new RangeError('createBuffer(' + ch + ', ' + len + ', ' + rate + '): out of range');
      const data = Array.from({ length: ch }, () => new Float32Array(len));
      return { length: len, sampleRate: rate, duration: len / rate, numberOfChannels: ch, getChannelData: i => data[i] };
    }
    createOscillator() {
      let type = 'sine', on = false;
      const o = node({ frequency: param('frequency', 440), detune: param('detune', 0), chain: [],
        get type() { return type; }, set type(v) { if (TYPES.has(v)) type = v; else note('oscillator type "' + v + '" does not exist (the browser keeps "' + type + '")'); },
        connect(n) { if (!n) throw new TypeError('connect: no node to connect to'); o.to = n; o.chain = []; for (let m = n, i = 0; m && i < 8; i++, m = m.to) o.chain.push(m); return n; },
        start(t = 0) {
          t = time(t, 'oscillator.start');
          if (on) throw new Error('InvalidStateError: oscillator.start: cannot call start more than once');
          on = true; stat.tone++;
          const f = o.frequency;
          for (const v of [f.first, f.last]) if (v != null && (v < 20 || v > 20000)) note('a tone at ' + Math.round(v) + ' Hz');
          o.chain = []; for (let m = o.to, i = 0; m && i < 8; i++, m = m.to) o.chain.push(m);
          started(o, Math.max(t, now), 'a tone');
        },
        stop(t = 0) { time(t, 'oscillator.stop'); if (!on) throw new Error('InvalidStateError: oscillator.stop: cannot call stop without calling start first'); } });
      return o;
    }
    createBufferSource() {
      let on = false;
      const s = node({ buffer: null, playbackRate: param('playbackRate', 1), loop: false, chain: [],
        start(t = 0, off = 0, dur) {
          t = time(t, 'bufferSource.start'); off = num(off, 'bufferSource.start');
          if (off < 0) throw new RangeError('bufferSource.start: the offset ' + off + ' is negative');
          if (dur !== undefined && num(dur, 'bufferSource.start') < 0) throw new RangeError('bufferSource.start: the duration is negative');
          if (on) throw new Error('InvalidStateError: bufferSource.start: cannot call start more than once');
          on = true; stat.noise++;
          if (!s.buffer) note('a noise with no buffer');
          s.chain = []; for (let m = s.to, i = 0; m && i < 8; i++, m = m.to) s.chain.push(m);
          const f = s.chain.find(n => n.frequency);
          if (f) for (const v of [f.frequency.first, f.frequency.last]) if (v != null && (v < 20 || v > 20000)) note('a noise filtered at ' + Math.round(v) + ' Hz');
          started(s, Math.max(t, now), 'a noise');
        },
        stop(t = 0) { time(t, 'bufferSource.stop'); if (!on) throw new Error('InvalidStateError: bufferSource.stop: cannot call stop without calling start first'); } });
      return s;
    }
  }
  window.AudioContext = FakeAudioContext;
  // the sound's own random numbers: not the game's (see the head of this file)
  {
    let b = 99991;
    const own = () => { b = (Math.imul(b, 1103515245) + 12345) >>> 0; return b / 4294967296; };
    for (const k of ['init', 'noise']) {
      const f = Snd[k];
      Snd[k] = function (...a) { const r = Math.random; Math.random = own; try { return f.apply(this, a); } finally { Math.random = r; } };
    }
  }
  Snd.init();
  if (!Snd.ac) console.error('audio-check: Snd.init() did not take the fake AudioContext');
  // name the line of the game that asks for each sound (the first frame of the stack outside audio.js and this file)
  for (const k of ['tone', 'noise']) {
    const f = Snd[k];
    Snd[k] = function (...a) {
      const bus = k === 'tone' ? a[6] : a[4];
      if (bus && bus === Snd.musBus) who = 'music';
      else {
        who = '?';
        for (const line of String(new Error().stack).split('\n').slice(2)) {
          const m = /([\w.-]+\.(?:js|html)):(\d+)/.exec(line);
          if (m && m[1] !== 'audio.js' && m[1] !== 'audio-check.js') { who = m[1] + ':' + m[2]; break; }
        }
      }
      try { return f.apply(this, a); } finally { who = ''; }
    };
  }
  // the bus gains are set with .value in Snd.init (never scheduled): they stay "fixed" and scale what runs through them
  const upd = update;
  let frames = 0, told = false;
  update = function () {
    now += 1 / 60; frames++;
    const r = upd();
    if (!told && (G.state === 'win' || G.state === 'allclear')) {
      told = true;
      console.log('AUDIO done ' + stat.tone + ' tones, ' + stat.noise + ' noises in ' + (frames / 60).toFixed(0) + ' s (effects ' + (stat.tone - stat.musTone) + ' and ' + (stat.noise - stat.musNoise) + ', the rest is the music); most at once ' + stat.voices +
        '; loudest moment at most ' + stat.peak.toFixed(2) + ' of full scale (' + stat.peakAt + ': ' + stat.peakOf + '); odd calls ' + odd.size);
      console.log('AUDIO from ' + Object.keys(seen).sort().map(k => k + ' x' + seen[k]).join(' '));
    }
    return r;
  };
  window.AUDIOCHECK = { stat, odd, seen, now: () => now };
}
