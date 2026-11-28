# Mission 8 (DINOSAUR VALLEY): build notes

STATUS: [2026-11-28] BUILT and verified on branch `dino-mission-8`, stacked on `mission-audit-story` (PR 1). A draft PR
is open against that branch; nothing is on `main` (so nothing is live). Waits for the owner's review and play test.
To resume: read "Open points" at the end; everything above it is done and measured on the code as committed.

Request (owner, 2026-11-27): "build the dinosaur mission making it amazingly good". Taken as the go-ahead to build,
so there was no screenshot proposal first, unlike earlier missions (PR 1's story had already announced the dinosaurs);
the owner was told so at the start. The design doc records what was chosen and what was rejected.
What it is and every rule it keeps: `docs/superpowers/specs/2026-11-27-mission8-dinosaur-valley-design.md`.
Pictures of the built mission, 14 frames with captions: `proposals/level8/built-sheet.png`.
Engine hooks and globals: `docs/engine-api.md`, section "Mission 8". Each `src/level8*.js` starts with a header
comment that is the exact reference for that file.

## Running it

```sh
cd <repo>; export RR_GAME=$PWD                 # the harness reads the game from RR_GAME (default: the Mac's folder)
node tools/harness/harness.mjs sim --level 8 --seed 1                      # the bot plays Mission 8 (src/)
node tools/harness/harness.mjs sim --level 8 --seed 1 --html index.html    # the same on the built file
node tools/harness/harness.mjs sim --level 8 --seed 1 --extra tools/m8/trace.js 2> trace.txt   # who hit it, where
```

`--extra` takes one file; repeat it for more (`--extra a.js --extra b.js`). `hitsBySection` has 6 entries (the
fourth is the chase on TOPS: hits there cost her pips, not hearts). Seed and hero: the hero does not change a run.

## Three test players (none of them ever dodges)

The harness's bot presses jump every 42 frames and a jump lasts about 40, so it is in the air nearly all the time:
most of its shots fly over anything that walks, and what hits it depends on where its hops happen to fall. One
player is therefore not enough to judge a change. All three never dodge, never stop and never get off a ride.

| Player | Extras after `--extra tools/m8/trace.js --extra tools/m8/jitter.js` | What it is |
|---|---|---|
| hopper | (none) | the harness's bot as it is |
| steady | `--extra tools/m8/steady.js` | the same without the hop: stands and shoots |
| runner | `--extra tools/m8/runner.js` | holds Right and Fire between the locks, plays like steady inside them |

`jitter.js` starts the bot 0 to 41 frames late, drawn from the seed. Without it the first 35 seconds are the same on
every seed (nothing random reaches the bot that early), and one coincidence there reads as "every run".
Judge a change on jittered ensembles (hopper 36 seeds, steady 24, runner 24: 84 runs, about 3 minutes on 4 cores),
never on one seed.

## Reference numbers (the code as committed)

Plain bot, no extras, `src/` and built file identical, both heroes identical, `errors: []`, `warnings: []`:

| Seed | Time | Hits by area | Lives lost | Continues | Freed | Score | Frames |
|---|---|---|---|---|---|---|---|
| 1 | 206.4 s | 0 0 2 1 4 4 (11) | 2 | 0 | 8 | 27550 | 12661 |
| 2 | 205.8 s | 0 0 1 0 3 6 (10) | 2 | 0 | 7 | 27050 | 12621 |
| 3 | 193.8 s | 0 0 3 2 2 5 (12) | 1 | 0 | 6 | 25950 | 11905 |

Jittered ensembles (all 84 runs won, no error, no warning):

| Player | Hits (range) | By area | Time | Lives lost | A continue in | Freed |
|---|---|---|---|---|---|---|
| hopper, 36 seeds | 10.7 (6-15) | 0.4 0.4 2.7 0.4 2.1 4.5 | 199 s (184-224) | 1.6 | 4 of 36 | 7.4 |
| steady, 24 seeds | 9.0 (8-10) | 0.0 1.0 2.8 0.0 0.0 5.2 | 200 s (192-209) | 1.8 | 0 of 24 | 8.0 |
| runner, 24 seeds | 10.8 (8-13) | 0.0 1.8 2.8 0.0 0.9 5.3 | 177 s (166-184) | 1.6 | 0 of 24 | 8.0 |

Camera locks, median seconds (hopper / steady / runner): first lock 10.2 / 10.2 / 15.0, lagoon 10.9 / 14.8 / 12.9,
CLUBTAIL 23.3 / 19.3 / 15.4, hatchery 11.3 / 7.3 / 7.5, OGGLE REX 42.4 (38-54) / 40.3 / 40.6.
The hopper frees 7.4 of the 8 hatchlings because it hops over a cage now and then (as it does in Mission 1).

The same players on other missions, for scale (same tools, jittered):

| Mission | Player | Hits | Time | Lives lost | A continue in |
|---|---|---|---|---|---|
| 2 VIGO HILLS (the bar: 10-14 hits, 150-170 s) | hopper, 24 | 12.2 (9-19) | 164 s | 1.3 | 1 of 24 |
| 2 | steady, 12 | 13.4 (10-23) | 167 s | 1.8 | 1 of 12 |
| 6 CLOCKFANG CAVERN | hopper, 24 | 12.4 (6-19) | 185 s | 3.0 | 12 of 24 |
| 7 LAST LIGHTHOUSE (its pilot rings the bell) | hopper, 24 | 1.8 (1-2) | 151 s | 0.0 | 0 of 24 |
| 8 DINOSAUR VALLEY | hopper, 36 | 10.7 (6-15) | 199 s | 1.6 | 4 of 36 |

Reading: Mission 8 is inside the hit band of the bar, about 35 seconds longer than Mission 2 (six areas, two giants),
and a never-dodging player needs a continue about one run in nine (Mission 2: one in 24; Mission 6: one in two).
The steady player on Mission 6 is no measure (it wins 5 of 12: that bot is not made for Mission 6).

## What the bots never do: `paths-test.mjs`

```sh
RR_GAME=$PWD node tools/m8/paths-test.mjs                             # src/, all scenes: ALL OK (278 checks)
RR_GAME=$PWD RR_HTML=$PWD/index.html node tools/m8/paths-test.mjs     # the built file: the same 278 lines
RR_GAME=$PWD node tools/m8/paths-test.mjs dodge giants                # only the scenes named
```

A full run takes about 10 minutes on one core (dodge and giants are the long scenes); name scenes while working.
It plays in the real game, with the strict stand-in for the browser's sound (`audio-check.js`).

| Scene | Checks | What it plays |
|---|---|---|
| tops | 21 | every key of the ride, getting off and on, four hits tire her, she runs ahead and waits |
| chase | 18 | the bite: its tell, running on escapes it on foot and on TOPS, a hero who never moves is bitten again and again |
| foot | 21 | the chase on foot, with TOPS about and without her: Right alone gets through the three walls and the gate, no way back over the chasm, walking back into the Rex |
| raptor | 11 | the ring from the first frame of the crouch, where it lands, who it hurts |
| intro | 41 | the opening scene to its end, and skipped at seven different moments |
| continue | 66 | game over and continue at each of the eight checkpoints (the two of CLUBTAIL's arena among them): area, music, TOPS, the chase, and play goes on |
| rex | 12 | a hero between its feet is blown back (SHOO!); after a continue it comes back with the health it had, 75 % at most |
| dodge | 40 | every attack: it hits a hero who does nothing, no sooner than its tell; the escape the game teaches works when begun 15 frames late |
| giants | 45 | the arena rule for both giants, the Rex's call, robots alive at its fall, the fall and the master switch, the last-life rule, where the switch lands |
| draw | 3 | pictures no run shows: the hero select behind Mission 8, a nest at every stage of damage |

Memory: each test game holds about 190 MB of pictures outside the JavaScript heap, and the canvas library only gives
them back when the event loop turns. The test therefore calls `await rest()` (collect, then one turn of the loop)
before each new game and stays at about 0.65 GB. Without it 80 games add up to 15 GB. Keep that line when adding a scene.

## The real browser: `browser-check.mjs`

`node tools/m8/browser-check.mjs [outdir]` (needs `python3 build.py` first, and Playwright with Chromium): ALL OK
(34 checks, about a minute and a half). On the built file as committed:

- The harness bot's keys, played back in Chromium with sound on and painted every frame (12663 pictures), end as the
  Node run did, to the frame: 206.4 s, hits 0 0 2 1 3 5, 2 lives lost, score 27550, 8 freed. (This run takes
  painting's random numbers from a generator of its own on both sides, so it is not the plain seed 1 above.)
- No error and no warning from the page. Web Audio took exactly the 2227 effect tones and 383 effect noises the
  Node run asked for, none refused. All five tunes started.
- Ten pictures of the same frames, Node against Chromium: at most 1 of 129600 pixels differs.
- An update takes 0.09 ms and a picture 0.9 ms on average (a frame has 16.7 ms).
- By hand with real key presses from the title screen into the mission, in real time: 60.0 updates a second, no
  picture late in ten seconds of play, for a patient player and for a hasty one who skips the opening scene.
  Nothing was left to paint when the mission started (the scenery is painted ahead on the menus and the briefing).

## Three small tools

- `audio-check.js` (extra): a strict stand-in for the browser's AudioContext. The harness has no sound, so a wrong
  number in a sound call is never seen there, and in a browser it THROWS inside the enemy's update, where the engine
  drops that enemy (a boss would vanish in its fight). Seed 1: 4257 tones and 1240 noises, none refused, no odd
  call, and the run is byte for byte the run without the check. Its "loudest moment" is an upper bound (every peak
  at once): 1.63 of full scale on seed 1 (in the chase, x 4523), of which 1.15 are the engine's own explosions
  (`engine.js` `boom`, several robots going up together). The same measure on seed 1 of the other missions it can
  check: Mission 1 1.27, Mission 2 1.53, Mission 3 2.78, Mission 5 1.21, the engine's explosions the bulk each time.
  So Mission 8 is as loud as the game was; whether the engine should limit its explosions is a question for all of it.
- `paint-apart.js` (extra): painting takes its random numbers from its own generator and can be asked for never,
  every 15th frame (the harness), every frame (a browser) or twice a frame. Result: the same run however it is
  painted, apart from two things for show (the engine's screen shake, the sparks of CLUBTAIL's spike volley).
- `coverage.mjs`: which lines of `src/level8*.js` no test ever ran (V8 coverage of any number of runs). Before the
  dodge and giants scenes were written 98.7 % had run; what was left and is real behaviour became those scenes
  (the arena rule for each kind of robot, the last-life rule, the Rex's call with compys alive, the switch moved off
  the captain's landing spot, direct hits of eggs and spit). Not measured again since.
- `music-check.mjs`: the five tunes without ears (whole bars, ranges, clashes between tune and bass, and the game's
  own player runs each twice round). `keys-rec.js` writes a run's keys down for the browser check.

## What the tests found, and what was done

- **The raptor was not fair** (found by the dodge scene, fixed in the game). Its header promised "walk away or
  under it", and its ring only showed at take-off. Measured on an empty stage: a hero who walked on under the
  leaping raptor was hit in 4 of 10 cases with an instant reaction and in 10 of 10 when he started 15 frames after
  take-off. Now the raptor picks its spot when it crouches (where the hero stands then), the ring shows from the
  first frame of the crouch to the landing, and the pounce hurts only a hero with a foot in the ring. Latest safe
  start after the ring shows: 66 frames walking on under it and 75 walking back at its first pounce (48 and 57
  later). The hopper's hits fell from 12.6 to 10.7 a run (36 seeds): a leaping raptor was the nearest robot at 88 of
  its 455 hits before (2.4 a run, its body flying into a bot that never stands still) and at 1 of 384 now. Steady
  and runner did not change by one byte on any of their 48 runs (they shoot a raptor before it pounces).
- **Small robots in a giant's arena.** A bot always arrives with the screen cleared; a child may not. Rule: when
  WARNING shows, every small robot that is not the giant's own clears off and cannot hurt from that frame (walkers
  run to the nearer end, fliers climb away; all gone 112 frames later, before the giant's first attack).
- **The last life.** A hero who falls with his last life while his shot is in the air, and whose shot then finishes
  the OGGLE REX, gets the win: one life is given back. The same fall with the Rex still standing is a game over.
- **Giants glint instead of flashing**, the bomber leaves after three passes, rings are painted on top of
  everything, every warning lasts 30 frames or more, the bite's strip stays where it was marked, TOPS is never lost:
  each came from a measurement or a scene; the design doc has the rules.
- Two faults of the tests themselves, not of the game: a dodge case that kept watching until the giant's NEXT attack
  hit a hero who had stopped acting (each case now ends when another attack begins), and a count that was one frame
  short.

## Missions 1 to 7 and the fixtures

Saved before the build (PR 1's head) and compared after it, on `src/` and on the built `index.html`:

- Bot runs of Missions 1 to 7, seeds 1 and 2: every result identical (Mission 4 does not complete with the generic
  bot, before or after: it has its own pilot, `tools/mission4/sim.mjs`, whose two runs are identical too).
- `flow-selftest.js`: 42 checks (eight missions, Mission 8's opening scene and CLUBTAIL's two checkpoints are new).
- `api-fixes.js`: 37 checks, same lines (its two lines that count missions say 9 and 7 now).
- `engine-selftest.js`: same result; it is `--level 9` now (it registers after the eight missions).
- `tools/audit/story-test.mjs`: 38 checks for the eight-mission story (see `tools/audit/notes.md`).
- `loop-test.mjs` 49 checks, `clockfang-check.js` 21, `lighthouse-check.js` 118: same lines as before.
- `tools/mission4/test.mjs` fails at "Mission 3 advances to 4 and 4 to all clear", as it did before this branch.

One engine change: `ENEMY_TYPES[type].shield(e, d)` in `damageEnemy` (a type's own armour; CLUBTAIL uses it).

The built file was made once more after the long runs, to drop one space at the end of a line in
`level8_backdrops.js`. It differs from the file those runs played by that one space (checked with `diff`); the
reference seeds, the flow fixture, Missions 2 and 6 and the browser check were played again on it, with the same results.

## Open points

- **Nobody has listened to the music.** Five tunes were written from theory and checked by rule; every sound call
  passes the strict check and real Web Audio. Whether they sound good is for ears to say.
- **No child has played it.** Every number here is from players who never dodge. The escapes are tested one by
  one, but how hard it feels to an 8-year-old is not measured.
- Older missions' bosses still flash white on every hit (Mission 8's giants glint). Changing them is a follow-up
  that would touch Missions 1 to 7 and was left alone here.
- Small robots on the right half of a giant's arena run off to the right, toward the giant coming in (for show only:
  they cannot hurt from the first frame of the WARNING).
- The opening tip "HIT ITS EYE: DOUBLE DAMAGE!" touches the Rex's reared snout at its last word.
- Scratch (probes, ensembles, pictures) is in `tools/m8/work/`, local only.
