# Robot Rumble test harness

Runs the real game headless: the files of `/Users/macbookair/game/src/manifest.json` are loaded in
order into one Node `vm` context with stub browser globals (`document.createElement('canvas')` and
the 480×270 `#game` canvas are `@napi-rs/canvas` canvases; no audio, no speech, in-memory
`localStorage`, `requestAnimationFrame` does nothing). The harness then calls the game's own
`update()` / `draw()`. Node 22; `@napi-rs/canvas` is installed in this folder.

```sh
H=/path/to/this/harness   # the folder holding this README (a copy lives in /Users/macbookair/game/tools/harness)
```

## sim: bot playthrough

```sh
node $H/harness.mjs sim --level 1 --hero 0 --seed 1
node $H/harness.mjs sim --level 2 --hero 1 --seed 2 --frames 30000
node $H/harness.mjs sim --sandbox soldier,drone,tank --frames 3000 --god
node $H/harness.mjs sim --level 2 --extra draft.js --extra other.js   # extra files load after the manifest
node $H/harness.mjs sim --level 2 --x 2900 --seed 1                   # play on from x 2900 (no intro)
```

Options: `--level N` (mission number, default 1), `--hero 0|1`, `--frames N` (default 30000),
`--god` (hero can't be hurt), `--sandbox a,b` (flat arena where those enemy types keep appearing),
`--seed N` (deterministic `Math.random`; without it every run differs),
`--x N` (start the mission built at world x N, like `render --x`: through `devStart`'s `x`, so the camera
is there, earlier locks are done, enemies from there on are spawned and there is no intro; without it the
mission starts from its beginning, intro included).

Prints JSON:
`{ completed, state, errors[], hitsBySection[], deaths, continues, seconds, frames, score, freed, x, level, warnings[] }`

- `errors`: thrown exceptions and `console.error`, de-duplicated, each `{ message, at: 'src/file.js:line', count }`.
  Errors the game catches itself (a broken enemy, prop or bullet is dropped and logged once with
  `errorOnce`) are listed the same way, with the file:line of the Error, but only once (`count` 1).
- `warnings`: `console.warn` lines, e.g. names skipped because their owner hasn't written them yet.
- `hitsBySection`: hits the hero took in each area (from `dbg.onHurt`), `seconds` = play time.

The bot (decides every 6 frames): faces the nearest active enemy on screen and holds fire (a dying
enemy that isn't a boss doesn't count: shots fly through it); on the
ground it crouches when its standing shot (feet − 19) passes over a short target that a crouch shot
(feet − 11) hits, e.g. a wolf just downhill; walks toward a target its level shots can't reach
(slopes, platforms, flyers; on the ground also a low one right in front of it); aims up at flying
enemies within 40px horizontally above it; otherwise walks right. It jumps every 42 frames
(holding jump 10 frames), throws a grenade every 150 frames when the target is wider than 40px,
walks into parked rides (props whose kind is a `RIDES` key) and presses Enter to continue after
game over. It never dodges. `draw()` runs every 15 frames so drawing code is exercised.
The run stops at the win screen.

In a ride the bot doesn't crouch (the ride's gun is its own): it drives up to its target (within
60px, or within 24px under a flyer, where it holds Up so a gun that can swing up does). When nothing
gets hurt for 1.5 s while it is in position (no enemy loses hp, no score), it gets out with Down +
Jump (the ↓ + Z exit of the spec and the doc's cart), fights on foot and leaves vehicles alone for
10 s. So a ride gun that misses short wolves, or can't aim up at an eagle overhead, costs time
instead of stalling the run.

## render: PNG of a real frame

```sh
node $H/harness.mjs render --level 1 --x 1950 --frames 60 --out $H/shots/l1-1950.png
node $H/harness.mjs render --level 2 --x 1200 --hero 1 --scale 3 --out $H/shots/l2.png
node $H/harness.mjs render --level 2 --frames 90 --out $H/shots/l2-intro.png   # no --x: mission start, intro included
node $H/harness.mjs render --sandbox wolf,eagle --x 300 --frames 90 --out $H/shots/wolves.png
node $H/harness.mjs render --screen title --out $H/shots/title.png
#   --screen title | missions | select | win | over | allclear | pause
```

The game starts with `devStart({ level, hero, x, god, sandbox })`: with `--x` it is built straight
at that spot (camera on `x`, earlier locks done, no intro), without it the mission starts from its
beginning, intro included. It runs `--frames` updates (default 60) with no input, draws once and
writes a nearest-neighbour upscaled PNG (`--scale`, default 3). The output folder is created.
Renders are seeded (`--seed`, default 1), so the same command gives the same picture.
Open the PNG with the Read tool.

`--screen win|over|pause|allclear` (with `--level`) look like real play: the mission is started
(hero invulnerable), its intro is ended, 200 play frames run (the MISSION START band and the area name
are gone), then the screen is forced and `--frames` more updates run. Win and allclear default to
150 frames: past their Enter wait and with the blinking prompt on. The score is still 0: for a real
win screen, drive the boss kill with `--extra`.

## Main loop

`sim` and `render` call `update()` / `draw()` themselves. `loop-test.mjs` runs main.js's real `frame()`
the browser way (a `requestAnimationFrame` queue and `performance.now`) and prints `ok` / `FAIL`
lines: errors that repeat every frame at 60, 75, 120 and 144 Hz (full speed, the picture kept, the
OOPS note shown), a one-off error inside `save()`/`clip()` (the canvas put right), broken enemies,
props and bullets (dropped, logged once), the clean loop against the original one (frame for frame),
and main.js / screens.js names that must stay private.

```sh
node $H/loop-test.mjs          # src/ in manifest order
node $H/loop-test.mjs built    # the inline scripts of index.html
```

## diff: compare two PNGs

```sh
node $H/harness.mjs diff a.png b.png      # {"same":true,"pixels":0,"box":null}
```

## --legacy / --html: single-file builds

`--legacy <file.html>` (alias `--html`) runs the inline `<script>`s of a built page instead of the
manifest: the pre-refactor game, or the built `index.html`. Pages without `devStart` (the old
build) are driven through their own globals (`startGame()`, `loadLevel()`, `G.cam.x`, `G.p.x`,
`draw()`; with `--x`, the body of `startGame()` with its build at x 0 replaced by the build at the
camera, as `devStart` does), so the same commands work for before/after comparisons:

```sh
node $H/harness.mjs sim --legacy /Users/macbookair/game/backup/index-before-level2.html --level 1 --seed 1
node $H/harness.mjs sim --html /Users/macbookair/game/index.html --level 1 --seed 1
node $H/harness.mjs render --level 1 --x 1950 --legacy /Users/macbookair/game/backup/index-before-level2.html --out $H/shots/old-1950.png
$H/compare-refactor.sh     # title, select and Mission 1 frames: new build vs pre-refactor, pixel diff
$H/compare-screens.sh      # win (prompt on), game over, pause: new build vs pre-refactor
```

With the same seed the refactored engine reproduces the old build exactly (identical sim JSON
and pixel-identical frames, the win screen included while Mission 1 is the only mission). Once
Mission 2 is loaded, Mission 1's win prompt says PRESS ENTER FOR MISSION 2! (intended difference).
Since the Mission 2 review fixes (2026-11) two more differences are intended: the title hint reads
RESCUE EVERYONE FOR POWER-UPS! (compare-refactor title, box [426,564,1013,587] at scale 3) and the
pause screen offers Q to quit to the title (compare-screens pause, box [453,450,992,473]). Everything
else, and every Mission 1 sim, must stay identical. Mission 2 now has 5 areas, so its hitsBySection
has 5 entries.

Since the polish build (2026-11-13) Mission 1 no longer matches the pre-refactor build at all, on purpose: its
scenery is repainted (`src/level1_*.js`), it opens with a parachute scene, the Mega Crab is redrawn and its enemies
were retuned with warnings. `compare-refactor.sh` / `compare-screens.sh` therefore differ everywhere on Mission 1
and on the menus (which scroll its scenery and show per-mission stars). New reference numbers, never-dodging bot:
Mission 1 seed 1 = hits [1,2,4,5], score 15050, 143.8 s, 2 lives lost, no continue (seeds 1-10: 8-14 hits, 0-2
lives, no continues, 122-147 s). Mission 2 seed 1 [0,2,0,1,7] 31950 and Mission 3 seed 1 [4,3,0,7] 31100 are
unchanged. The bot frees 5-7 of Mission 1's 7 prisoners (it jumps over one now and then; a shot or a touch frees them).

## Engine self-test

`fixtures/engine-selftest.js` is a throwaway test mission (not game content) that uses every engine
hook Mission 1 doesn't: terrain, an intro, a ride, bullet hooks, a custom projectile, a boss death
animation, POW kinds and names nobody had built yet. Failures show up as `SELFTEST FAIL` warnings; a clean
run ends with the warning `SELFTEST DONE: boarded=true woof=true loads=1`. The fixture registers
immediately after the seven campaign missions.

```sh
node $H/harness.mjs sim --level 8 --seed 1 --extra $H/fixtures/engine-selftest.js
```

The campaign flow checks cover mission and hero selection, score carryover, intro handoffs,
checkpoint continues, Mission 6's starting bow, Mission 7's lamp gun and skiff checkpoint, and the return to the title after the final win.

```sh
node $H/harness.mjs sim --level 1 --frames 1 --extra $H/fixtures/flow-selftest.js 2>&1 | grep FLOW
```

API review fixes (stand-in for unknown enemy types, onKill `'dying'`, intro key taps, whole wave
entries, bullet hooks `update/onGround/onProp/onPow`, ride push-out, unknown projectile kinds, mission
card boss, `devStart` with x, font accents, drum patterns, the single-mission win flow; round 3: intro
keys set in `start()`, hooks keep a bullet only on exactly `true`, bullets below the screen, dying
enemies and the knife / shots, the padlock shake, a mission with no title), printed as
`API ok` / `API FAIL` lines (37 checks). Its test missions are pushed after the real ones and addressed by
their own number, and the single-mission win check sets Mission 2 aside while it runs, then checks that with
Mission 2 loaded Enter on Mission 1's win screen starts Mission 2:

```sh
node $H/harness.mjs sim --level 1 --frames 1 --extra $H/fixtures/api-fixes.js 2>&1 | grep '^API'
```

Run `node $H/harness.mjs sim --level 6 --seed 1` to play Clockfang Cavern through its boss with the keyboard bot.

The Lighthouse pilot steers the skiff, turns the mirrors and releases the Storm Manta's harness. The Mission 7 report includes the number of mail pennants delivered. Run the focused fixture to check the bell, lamp gun, checkpoints, flight and ending.

```sh
node $H/harness.mjs sim --level 7 --hero 1 --seed 37
node $H/harness.mjs sim --level 7 --frames 1 --extra $H/fixtures/lighthouse-check.js
```
