'use strict';
// =====================================================================================================================
// Mission 8: DINOSAUR VALLEY, the music (audio.js plays it: one entry per step, MIDI notes, 0 = rest, every step a
// short note). Five tunes that belong together:
//   dinovalley  the valley's own tune: a call on a clay flute (triangle) in A dorian over two heavy footsteps a bar
//   dinochase   REX RUN!: the same key at a gallop, the lead hammering one note while the top note climbs
//   clubtail    CLUBTAIL: stomp, stomp, clap in B minor; lead and bass play the riff together
//   ogglerex    the OGGLE REX: Mega Oggle's march from Mission 5 comes back (E minor, the same A sharp), faster and
//               higher; in the middle the valley's call answers it, note for note, a fourth lower
//   dinodawn    the Master Switch is thrown: the valley's call in A major, slow, on a sine
// Tunes are written as note names so that they can be read and checked: tools/m8/music-check.mjs counts the bars and
// lists every clash between tune and bass.
// =====================================================================================================================
{
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'E5 . A5 . | F#5 Bb4': one word per step, '.' a rest, '|' only for the eye (C4 = 60)
const notes = s => s.split(/\s+/).filter(w => w && w !== '|').map(w => w === '.' ? 0 : 12 * (+w.slice(-1) + 1) + SEMI[w[0]] + (w[1] === '#' ? 1 : w[1] === 'b' ? -1 : 0));
const _ = null;
// one bar (or half bar) of bass per entry: a root played in the shared pattern, or [root, a pattern of its own];
// the pattern's numbers are semitones above the root, null a rest
const bass = (roots, pat) => roots.flatMap(r => { const [root, p] = Array.isArray(r) ? r : [r, pat]; return p.map(o => o == null ? 0 : root + o); });

// ---------------------------------------------------------------------------------------------------------------------
// DINOSAUR VALLEY: 16 steps a bar at 232, 16 bars (33 s).
// A: Am Am G D | Am C G E   the call (up a fifth, then a dotted fall) and its answer (a run up), then a step lower
// B: C G D Am | F G E E     the gliding half: long notes over the lagoon, a climb to the top E and back to the call
// The kick is two footsteps a bar (thud-thud ... thud-thud), the bass walks in them.
// ---------------------------------------------------------------------------------------------------------------------
TRACKS.dinovalley = {
  bpm: 232, lead: 'triangle',
  bass: bass([45, 45, 43, 50, 45, 48, 43, 52, 48, 43, 50, 45, 41, 43, 52, 52], [0, _, _, 0, _, _, 12, _, 0, _, _, 0, 7, _, 12, _]),
  mel: notes(`
    E5 . A5 . . . G5 .   E5 . . D5 . . E5 .   |  C5 . D5 . E5 . G5 .   A5 . . . . . E5 .
    D5 . G5 . . . E5 .   D5 . . B4 . . D5 .   |  A4 . B4 . D5 . F#5 .  E5 . . . . . . .
    E5 . A5 . . . G5 .   E5 . . D5 . . E5 .   |  E5 . G5 . C6 . . .    A5 . G5 . E5 . G5 .
    B5 . . . G5 . D5 .   G5 . A5 . B5 . D6 .  |  E6 . . . D6 . B5 .    G#5 . B5 . E6 . . .
    G5 . . . E5 . G5 .   C6 . . . B5 . A5 .   |  G5 . . . D5 . G5 .    B5 . . . A5 . G5 .
    F#5 . . . D5 . F#5 . A5 . . . G5 . F#5 .  |  E5 . . E5 . . A5 .    E5 . . . . . E5 G5
    A5 . . . F5 . A5 .   C6 . . . A5 . C6 .   |  B5 . . . G5 . B5 .    D6 . . . B5 . D6 .
    E6 . . . B5 . G#5 .  E6 . D6 . B5 . G#5 . |  E5 . G#5 . B5 . D6 .  E6 . . . . . . .`),
  drums: { kick: 'x..x....x..x....', snare: '....x.......x.......x.......x.......x.......x.......x.......x.xx', hat: '..x...x...x...x.' }
};

// ---------------------------------------------------------------------------------------------------------------------
// REX RUN!: 16 steps a bar at 272, 8 bars (14 s). Am Am F G | Am G F E.
// Four bars of gallop (two short, one long: the lead hammers the root while the top note climbs), four bars of
// falling chords, and the last bar climbs the dominant back into the gallop. The kick is the Rex: every beat.
// ---------------------------------------------------------------------------------------------------------------------
TRACKS.dinochase = {
  bpm: 272,
  bass: bass([45, 45, 41, 43, 45, 43, 41, 40], [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12]),
  mel: notes(`
    A5 A5 C6 . A5 A5 D6 . A5 A5 E6 . D6 . C6 .  |  A5 A5 C6 . A5 A5 D6 . E6 . D6 . C6 . B5 .
    F5 F5 A5 . F5 F5 C6 . F5 F5 D6 . C6 . A5 .  |  G5 G5 B5 . G5 G5 D6 . G5 G5 E6 . D6 . B5 .
    E6 . . C6 . . A5 .    E6 . . C6 . . A5 .    |  D6 . . B5 . . G5 .    D6 . C6 . B5 . A5 .
    C6 . . A5 . . F5 .    C6 . . A5 . . F5 .    |  E5 E5 G#5 . E5 E5 B5 . E5 E5 D6 . E6 . E6 .`),
  drums: { kick: 'x...', snare: '....x.......x...', hat: 'x.xx' }
};

// ---------------------------------------------------------------------------------------------------------------------
// CLUBTAIL: 8 steps a bar at 152, 16 bars (25 s). Bm Bm G A | Bm Bm G F#, twice.
// Stomp, stomp, clap: the kick is his two front feet, the snare his tail. Bass and lead play the riff together; the
// second time round the lead runs in eighths, then takes the riff up an octave.
// ---------------------------------------------------------------------------------------------------------------------
const MIN1 = [0, 0, _, 0, 3, _, 5, _], MIN2 = [0, 0, _, 0, 7, _, 5, 3], MAJ = [0, 0, _, 0, 4, _, 7, _];
const CLUB = [[47, MIN1], [47, MIN2], [43, MAJ], [45, MAJ], [47, MIN1], [47, MIN2], [43, MAJ], [42, MAJ]];
TRACKS.clubtail = {
  bpm: 152,
  bass: bass(CLUB),
  mel: notes(`
    B4 . . B4 D5 . E5 .     |  B4 . . B4 F#5 . E5 D5   |  D5 . . D5 G5 . B5 .     |  E5 . . E5 A5 . C#6 .
    D6 . B5 . F#5 . B5 .    |  D6 . B5 . F#5 . E5 D5   |  G5 . B5 . D6 . B5 G5    |  F#5 . A#5 . C#6 . . .
    B4 D5 F#5 D5 B4 D5 F#5 B5 | B4 D5 F#5 D5 D6 . B5 . |  B4 D5 G5 D5 B4 D5 G5 B5 |  C#5 E5 A5 E5 C#6 . A5 .
    B5 . . B5 D6 . E6 .     |  B5 . . B5 E6 . D6 B5    |  G5 . B5 . D6 . B5 G5    |  F#5 . A#5 . C#6 . . .`),
  drums: { kick: 'xx..', snare: '..x.', hat: '...x' }
};

// ---------------------------------------------------------------------------------------------------------------------
// OGGLE REX: 8 steps a bar at 184, 32 bars (42 s).
// A  (Em Em C B | Em Em Am B)  Mega Oggle's march (level5.js: oggleboss) an octave up, over its own oom-pah bass
// B  (Em Em D A | Em G D B)    the valley's call answers: the valley tune's first eight bars in E, faster; the call
//                              rings out on top, then an octave lower, and climbs back
// A' (as A)                    the march again over a pumping bass, breaking into broken chords
// C  (C D Em Em | C D B B)     three falling chords climb to the top E, then the march's fanfare hammers the
//                              dominant back to bar 1
// ---------------------------------------------------------------------------------------------------------------------
const OOM = [0, 0, 7, _, 0, 0, 7, 12], CALL = [0, _, 7, 12, 0, _, 7, 12], PUMP = [0, 12, 0, 12, 0, 12, 0, 12];
TRACKS.ogglerex = {
  bpm: 184,
  bass: [
    ...bass([40, 40, 48, 47, 40, 40, 45, 47], OOM),
    ...bass([40, 40, 38, 45, 40, 43, 38, 47], CALL),
    ...bass([40, 40, 48, 47, 40, 40, 45, 47], PUMP),
    ...bass([48, 50, 52, 52, 48, 50, 47, 47], PUMP)
  ],
  mel: notes(`
    E5 . E5 E5 G5 . B5 .    |  A#5 . B5 . G5 . E5 .    |  C6 . C6 C6 E6 . C6 .    |  B5 . F#5 . D#5 . F#5 B5
    E5 . E5 E5 G5 . B5 .    |  A#5 . B5 . D6 . E6 .    |  C6 . A5 . E5 . A5 C6    |  B4 B4 . D#5 . F#5 B5 .
    B5 E6 . D6 B5 . A5 B5   |  G5 A5 B5 D6 E6 . . B5   |  A5 D6 . B5 A5 . F#5 A5  |  E5 F#5 A5 C#6 B5 . . .
    B4 E5 . D5 B4 . A4 B4   |  B4 D5 G5 . E5 D5 B4 D5  |  F#5 . D5 A4 D5 E5 F#5 A5 | B5 . A5 F#5 D#5 F#5 B5 .
    E5 . E5 E5 G5 . B5 .    |  A#5 . B5 . E6 . D6 B5   |  C6 . C6 C6 E6 . C6 .    |  D#6 . B5 . F#5 . D#5 .
    E5 G5 B5 G5 E5 G5 B5 G5 |  E5 G5 C6 G5 E5 G5 C6 G5 |  E5 A5 C6 A5 E5 A5 C6 A5 |  D#5 F#5 B5 F#5 D#6 . B5 .
    C6 . . G5 . . E5 .      |  D6 . . A5 . . F#5 .     |  E6 . . B5 . . G5 .      |  E6 D6 B5 G5 E5 . . .
    C5 C5 . E5 . G5 C6 .    |  D5 D5 . F#5 . A5 D6 .   |  D#5 D#5 . F#5 . B5 D#6 . |  B5 . B5 B5 B5 . B4 .`),
  drums: { kick: 'x...x...x...x.x.', snare: '..x...x...x...xx', hat: 'x.xxx.xx' }
};

// ---------------------------------------------------------------------------------------------------------------------
// MORNING IN THE VALLEY (the Master Switch is off; it goes on under LEVEL CLEAR): 16 steps a bar at 168, 16 bars (46 s).
// A A D E | A F#m D-E A | D A D E | A A D-E A: the valley's call in A major, a harp of fifths underneath, hardly a drum.
// ---------------------------------------------------------------------------------------------------------------------
const HARP = [0, _, 7, _, 12, _, 7, _];
TRACKS.dinodawn = {
  bpm: 168, lead: 'sine',
  bass: bass([45, 45, 45, 45, 50, 50, 52, 52, 45, 45, 42, 42, 50, 52, 45, 45, 50, 50, 45, 45, 50, 50, 52, 52, 45, 45, 45, 45, 50, 52, 45, 45], HARP),
  mel: notes(`
    E5 . A5 . . . F#5 .   E5 . . C#5 . . E5 .   |  C#5 . D5 . E5 . G#5 .  A5 . . . . . E5 .
    F#5 . B5 . . . A5 .   F#5 . . D5 . . F#5 .  |  E5 . F#5 . G#5 . A5 .  B5 . . . . . . .
    E5 . A5 . . . F#5 .   E5 . . C#5 . . E5 .   |  C#5 . E5 . A5 . C#6 .  B5 . . . A5 . F#5 .
    F#5 . . . A5 . D6 .   B5 . . . G#5 . E5 .   |  A5 . . . E5 . C#5 .    A4 . . . . . . .
    D6 . . . B5 . A5 .    F#5 . . . A5 . B5 .   |  C#6 . . . B5 . A5 .    E5 . . . . . E5 .
    F#5 . A5 . D6 . . .   B5 . A5 . F#5 . . .   |  B5 . . . G#5 . B5 .    E6 . . . . . . .
    E5 . A5 . . . F#5 .   E5 . . C#5 . . E5 .   |  C#5 . D5 . E5 . G#5 .  A5 . . . C#6 . E6 .
    D6 . . . A5 . F#5 .   B5 . . . G#5 . B5 .   |  A5 . . . E5 . C#5 .    A4 . . . . . . .`),
  drums: { kick: 'x...............', hat: '....x.......x...' }
};
}
