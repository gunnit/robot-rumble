#!/usr/bin/env python3
"""Writes src/level4_sounds.js: Mission 4's sampled sound effects (tools/m4polish/sfx/cut/*.mp3, made with
Higgsfield Seed Audio and cut by cut.sh) as base64 MP3 inside the script, plus the small player.
Usage: python3 tools/m4polish/sfx/embed.py"""
import base64, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
names = sorted(f[:-4] for f in os.listdir(os.path.join(HERE, 'cut')) if f.endswith('.mp3'))
data = ',\n'.join("  %s: '%s'" % (n, base64.b64encode(open(os.path.join(HERE, 'cut', n + '.mp3'), 'rb').read()).decode()) for n in names)
code = r"""'use strict';
// ============================================================
// Mission 4 sound effects: sampled sounds (generated with Higgsfield Seed Audio, trimmed, loudness-matched and
// compressed by tools/m4polish/sfx/cut.sh) embedded as base64 MP3, so index.html stays one offline file. Rebuild this
// file with `python3 tools/m4polish/sfx/embed.py`; do not edit the DATA lines by hand.
//   L4SND.play(name, { vol, rate, fb }) plays a sound on the effects bus. Until the sounds are decoded (they start
//     decoding with the first sound after a key press, and in idle time on the menus) or if a browser can't decode
//     them, fb() runs instead: the synth sound the game used before. No audio (harness, muted): nothing happens.
//   L4SND.tick() each Mission 4 frame: keeps the underwater ambience under the music (Music.on mutes it too); any other
//     music track stops it.
// Nothing here draws or uses Math.random: seeded runs are unchanged.
// ============================================================
var L4SND = L4SND || {};
{
const DATA = {
""" + data + r"""
};
// per-sound loudness on the effects bus (the samples are all normalised to the same loudness)
const GAIN = { splash: 0.9, bubble: 0.45, torpedo: 0.7, boom: 0.85, robopop: 0.6, rescue: 0.7, dolphin: 0.75, zap: 0.55,
  puff: 0.6, eel: 0.6, ink: 0.55, hatch: 0.7, bossroar: 1.0, whoosh: 0.7, bossdefeat: 1.0, crab: 0.55, ambience: 0.9 };
// the same sound no more often than this (s): rapid fire would otherwise stack dozens of copies
const GAP = { bubble: 0.07, robopop: 0.05, ink: 0.08, zap: 0.1, whoosh: 0.12 };
const buf = {}, last = {};
let started = false, live = 0;
function warm() {
  if (started || !Snd.ac || typeof atob !== 'function') return;
  started = true;
  for (const k in DATA) {
    try {
      const bin = atob(DATA[k]), a = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      const p = Snd.ac.decodeAudioData(a.buffer, b => { buf[k] = b; }, () => {});   // callback form: older Safari too
      if (p && p.catch) p.catch(() => {});
    } catch (err) { /* this sound keeps its synth fallback */ }
  }
}
L4SND.warm = warm;
L4SND.ready = k => !!buf[k];
L4SND.play = function (k, o = {}) {
  const ac = Snd.ac;
  if (!ac) return null;
  warm();
  const b = buf[k];
  if (!b || live > 14) { if (o.fb) o.fb(); return null; }
  const now = ac.currentTime;
  if (GAP[k] && last[k] != null && now - last[k] < GAP[k]) return null;
  last[k] = now;
  try {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = b; if (o.rate) s.playbackRate.value = o.rate;
    g.gain.value = (GAIN[k] || 0.7) * (o.vol == null ? 1 : o.vol);
    s.connect(g); g.connect(o.bus || Snd.sfxBus);
    live++; s.onended = () => { live--; };
    s.start(now + (o.delay || 0));
    return s;
  } catch (err) { if (o.fb) o.fb(); return null; }
};
// ---- underwater ambience under Mission 4's music ----
let amb = null, ambGain = null;
L4SND.ambOn = () => !!amb;   // dev: is the ambience loop running
function ambStop() { if (amb) { try { amb.stop(); } catch (err) {} amb = null; ambGain = null; } }
L4SND.tick = function () {
  const ac = Snd.ac;
  if (!ac) return;
  warm();
  const wet = Music.track && (Music.track === TRACKS.coral || Music.track === TRACKS.octoboss);
  if (!wet) { ambStop(); return; }
  if (!amb && buf.ambience) {
    try {
      amb = ac.createBufferSource(); ambGain = ac.createGain();
      amb.buffer = buf.ambience; amb.loop = true;
      amb.loopStart = 0.03; amb.loopEnd = buf.ambience.duration - 0.03;     // skip the MP3 padding at both ends
      ambGain.gain.value = 0;
      amb.connect(ambGain); ambGain.connect(Snd.musBus); amb.start();
    } catch (err) { amb = null; }
  }
  if (ambGain) {
    const want = Music.on && G.state === 'play' ? GAIN.ambience : 0;
    ambGain.gain.value += (want - ambGain.gain.value) * 0.05;               // fades in and out
  }
};
// any other track (title, another mission, the win jingle) stops the ambience at once
{
  const play = Music.play, stop = Music.stop;
  Music.play = function (name) { const r = play.call(this, name); if (name !== 'coral' && name !== 'octoboss') ambStop(); return r; };
  Music.stop = function () { const r = stop.call(this); ambStop(); return r; };
}
}
"""
open(os.path.join(ROOT, 'src', 'level4_sounds.js'), 'w').write(code)
print('wrote src/level4_sounds.js', len(code), 'bytes,', len(names), 'sounds:', ' '.join(names))
