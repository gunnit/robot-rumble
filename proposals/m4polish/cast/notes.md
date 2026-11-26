# Mission 4 polish: `cast` (robot sea creatures + dive gear)

## Render commands

    H=/Users/macbookair/game/tools/harness; P=/Users/macbookair/game/proposals/m4polish/cast; M=/Users/macbookair/game/proposals/m4polish
    node $H/harness.mjs render --level 4 --x 1111 --frames 240 --god --scale 3 --extra $P/scene.js --out $P/cast.png
    node $H/harness.mjs render --level 4 --x 1113 --frames 240 --god --scale 3 --extra $P/scene.js --out $P/cast-tells.png
    node $H/harness.mjs render --level 4 --x 1404 --frames 240 --god --scale 3 --extra $P/scene.js --out $P/cast-action.png
    node $H/harness.mjs render --level 4 --x 4252 --hero 1 --frames 240 --god --scale 3 --extra $P/scene.js --out $P/cast-captain.png
    node $H/harness.mjs render --level 4 --x 1404 --frames 240 --god --scale 3 --out $P/before.png
    # composed with the area painters (cast last):
    node $H/harness.mjs render --level 4 --x 1404 --frames 240 --god --scale 3 --extra $M/reef/scene.js --extra $P/scene.js --out $P/cast-action-reef.png
    node $H/harness.mjs render --level 4 --x 4252 --hero 1 --frames 240 --god --scale 3 --extra $M/ruins/scene.js --extra $P/scene.js --out $P/cast-captain-ruins.png

All renders: `errors: []`, `warnings: []`.

## The frames
- `cast.png`: the whole cast at true game scale on a plain Mission 4 backdrop, each labelled in the game font with its
  name and its warning ("BLINK > INK SHOT"...). Top row: the four existing robots redesigned. Bottom row: the three NEW
  robots and both divers (Ines, Mathias) in the new dive gear.
- `cast-tells.png`: the same lineup, every robot frozen in its warning pose (what the kids must learn to read).
- `cast-action.png`: Area 1 CORAL GARDEN, a real in-game moment: Ines fires bubbles at a ROBO EEL whose eyes glow in its
  pipe (red lane through her), a ROBO JELLY lit up with ZAP! and its six zap directions, a ROBO PUFFER puffing up with
  its eight spike directions, a ROBO CRAB aiming its cannon claw up at her (dotted line), the ROBO OCTOPUS's ink on its
  way, a HELP! cage. `cast-action-reef.png` = the same moment with the reef painter's scenery.
- `cast-captain.png`: the INK CAPTAIN mini-boss fight in Area 3 (boss bar), Mathias diving, three dotted ink lines,
  a ROBO RAY mid-dash, a ROBO JELLY. `cast-captain-ruins.png` = with the ruins painter's scenery.
- `before.png`: today's game at the action spot. `before-after-row1.png`: the old four robots above the new four, in the
  same lineup (made with scratch fixtures `tools/m4polish/cast/old-save.js` + `old-restore.js` loaded around scene.js).

## What changed in the look
Old: the friendly-animal drawings tinted grey with red eyes, all alike, thin vector-ish shapes; tells = a yellow `!` and
a thin ring. New: every robot is its own colour and silhouette, built like the Mission 3 robot animals (shaded parts,
1px OUT outline, rivets, seams, hazard stripes, red lens eyes, glowing parts):

| robot | look | warning (tell) |
|---|---|---|
| ROBO OCTOPUS (red) | red riveted dome, cross steel brows over two porthole eyes, an O-mouth ink nozzle, hazard collar, periscope with a red lamp, a spinning propeller behind, 8 red arms with steel joints and brass claws | periscope lamp blinks fast, nozzle glows purple and drips, arms curl up, `!`, dotted line to where the ink flies |
| ROBO RAY (steel + hazard) | a big manta diamond seen from above, yellow/black leading edges, dark visor with two red eyes, two jet intakes (horns), hazard-banded tail, glowing cyan stinger | intakes glow orange to white-hot, stinger flares, it shivers, `!`, dotted line along the EXACT dash path (same maths as the behaviour, stops at the screen edges); dash = speed streaks + jet flame |
| ROBO JELLY (glass + gold) | glass bell with a tesla coil inside, scalloped gold margin with two red eyes and pink lamps, pink frilly oral arms, rubber cables with copper plugs, thin glowing filaments, sparks crackling | the whole bell lights up yellow-white, arcs crackle, plugs spark, `ZAP!`, six dotted rays = the six zap directions |
| INK CAPTAIN (purple) | submarine-hull cuttlefish: gold trim band with portholes, rivets, scalloped lilac fin skirt, white captain's cap with gold anchor and braid, red eye in a gold monocle, white handlebar moustache, lilac arms, two glass ink tanks with sloshing purple ink, a rear jet; about 80x60 px (old: 58x39) | tanks bubble and glow, cap pops up, ink funnel glows, `INK!`, three dotted lines (the three inks) |

Shots: the jelly/boss energy pearl is now an outlined glowing pearl with a turning spark; the ink is a glossy purple blob
with a dark cloud and droplets trailing. Both baked, as cheap as before.

## The NEW robots (registered, simple working behaviour, ready to place)
Spawn like any enemy, e.g. `{ t: 'robopuffer', x: 700, y: 150 }`, `{ t: 'robocrab', x: 1150 }`,
`{ t: 'roboeel', x: 1300, y: <mouth height, default seabed - 34> }`.

| robot | behaviour | warning, and the way out |
|---|---|---|
| `robopuffer` ROBO PUFFER (orange), hp 5 | drifts in the right part of the screen like the old robots; every ~2.3 s puffs up | it swells into a spiky ball over 60 frames (1 s), antenna lamp blinks, `!`, eight dotted rays; then 8 steel spikes fly out slowly (1.35 px/f, shootable). Stay off the 8 lines or shoot the spikes. Contact never hurts. |
| `robocrab` ROBO CRAB (hazard yellow), hp 6 | walks sideways on the seabed keeping ~105 px from the diver; front view, eyes on stalks, small pincer + big CANNON CLAW | stops and plants its legs, eye lamps blink, the claw swings up toward the diver, the muzzle glows, `!`, dotted line + flashing ring on the spot it LOCKED (where the diver was) for 54 frames; then one slow shell (2.1 px/f, shootable) flies to that spot. Swim off the line. To shoot it, dive to the bottom. Contact never hurts. |
| `roboeel` ROBO EEL (green), hp 6 | lives in a T-pipe standing on the seabed, both ends open | when the diver is level with the pipe and within 175 px (or shoots the pipe), two red eyes light up in the hole on the diver's side and blink, the snout pokes out, a red/yellow lane with `!` marks where it will lunge (54 frames, like the Mega Octopus's TENTACLE warning); then it lunges 120 px, snaps, stays out 50 frames (now it can be shot), slides back. Hidden in the pipe it can't be hurt (clank). Only the lunge itself hurts. Leave the lane. Stationary: use as a spawn, not in lock waves (wave enemies must walk on screen). |

Checked with a copy of the Mission 4 bot (`tools/m4polish/cast/sim4.mjs`, loads extras) and a test-only spawn file
(`tools/m4polish/cast/test-spawns.js`, adds 3 of each): mission completed, no errors, every new robot warned, attacked
and was beaten. With scene.js alone the bot run is identical to the baseline (same frames, score, deaths): hitboxes and
behaviour of the existing robots are untouched. Numbers (`EXTRA=... node tools/m4polish/cast/sim4.mjs <hero> <seed> swim|sub`):
- baseline swim (Ines, seed 1): completed, 7470 frames, 124.5 s, 1 death, 7 freed, 19800; with scene.js: identical.
- baseline sub (Mathias, seed 2): completed, 5586 frames, 93.1 s, 0 deaths, 7 freed, 20300; with scene.js: identical.
- with the 9 test robots: completed, 7935 frames, 132.2 s, 1 death, 21250; 3 puffers, 3 crabs (3 aimed shots), 3 eels
  (3 warnings, 3 lunges) all beaten, errors [].
- all six painters loaded together (reef, kelp, ruins, deep, boss, cast last) at --x 1404: errors [], no clash.

## Diver (L4.drawDiver)
Same size as before (fins to gun nozzle about 56 px), now clear at a glance: wetsuit in the hero's colours with a light
stripe and a weight belt, a yellow tank with a valve and a hose to the mouthpiece, a round glass mask you can see the eye
through, the hero's real head (Ines' ponytail, Mathias' cap), long kicking fins in the hero's accent colour (Ines orange
like her hair, Mathias red like his cap), a chunky bubble blaster with a glass bubble chamber. Body baked per hero and
kick frame (8 frames).

## How scene.js is organised (the reusable art)
One block, registry entries only. Sections:
1. Pixel buffers (`buf/put/oval/line/outline/bake/mk/blit`, copied from level3_enemies.js) and live helpers (`pdisc`,
   `pl`, `ringDots`, `glow` = one cached radial-gradient canvas per colour+radius).
2. **Shaded parts** painter: `E` (ellipse), `C` (capsule), `Pg` (polygon), `Bx` (box) listed front to back -> `parts()`
   (tone from the part's own height, deep seam where a nearer part covers it; `ghost` parts make no seam: things seen
   through glass). Palettes `ST4 HD4 RED4 GOLD4 YEL4 BLK4 GLS4 ...`, `lens()` (red robot eye), `rivet()`, `hazard()`.
3. Warnings (one language for every robot): `bang()` (blinking red/yellow word), `warnRing()`, `aimDots()` (marching
   dotted line).
4. One section per robot: sprite bakers (`octoSprite(ph, tell)`, `raySprite(flap)`, `jellySprite(ph, lit)`,
   `capSprite(ph, hatUp)`, `puffSprite(size, fin)`, `crabBody(leg, plant)` + `crabClaw(angle)`, `pipeHead/pipeRim/
   pipeSeg/eelHead/eelSeg`) and its `draw(e)` (blit + small live bits). These move straight into a `level4_robots.js`.
5. Shots (`EB_TYPES.oceanBolt/oceanInk.draw`, new `pufferSpike`, `crabShell`), new types, diver.
6. Bake queue: the mission load queues all ~100 sprites and `L.update` bakes one per frame (done in ~1.7 s, inside the
   dive-in intro), so no pose is baked in the middle of a fight.
7. Mock staging, only at the mock cameras (`STAGES`: --x 1111 lineup, 1113 warning lineup, 1404 Area 1 moment, 4252
   captain fight): the lineup paints its own plain backdrop and draws the cast through the real `draw` functions; the
   in-game moments only pin enemies/hero/shots (`L.load`/`L.update` wrappers), they never touch the draw hooks.
   Cameras checked against reef (330), kelp (1750, 1800), ruins (3660, 4000), deep (5210, 5920), boss (5919+).

Composes with the area painters: it wraps hooks and only takes over at its own lineup cameras. ruins/scene.js only
replaces robot drawings that are still the originals, so with cast loaded either way round the cast drawings win.

## Per-frame cost (headless canvas, `tools/m4polish/cast/perf*.mjs`)
- each robot 0.02-0.07 ms per draw once baked (old ones were path fills of similar cost); shots 0.013-0.02 ms (old
  0.008-0.013); diver 0.035 ms (old 0.18). No canvas per frame, no Math.random.
- sprite baking about 0.8 s total, spread one sprite per frame by the bake queue (worst single sprite ~15 ms: the octopus).
- the whole lineup frame (backdrop blit, 7 robots, 2 divers, HUD) 4.4 ms; for comparison the old Mission 4 frame costs
  ~80 ms headless because of its background (the area painters' job).

## Still weak (honest)
- The hitboxes of the old robots are unchanged, so the new pictures overhang them a little (octopus arms, ray wings,
  captain): a few bubbles near the edges will pass through the drawing. In the real build widen the boxes a bit.
- The old robots' shots still leave from `e.x - 12` (behaviour untouched), so the octopus and captain must face left
  (they always did) and the ink appears a few px from the nozzle; the ray and puffer turn to face the diver.
- The INK CAPTAIN is bigger but still not huge next to a ray; its arms hide under the moustache. A real build could
  give it a 1.2x redraw and a short "hat tip" intro.
- Octopus arms read as a red tangle at the bottom of the sprite in some phases; the jelly's coil reads more like a ladder
  than a coil at 1x.
- New types have simple behaviour only (no death animation beyond bubbles/sparks/debris, no sounds tuned, puffer and
  eel never placed in the level data yet). The eel is stationary: spawn only, never in a lock wave.
- Warning dots are the same red/yellow for every robot: with 4-5 robots warning at once (cast-action) the screen gets
  busy. In the real level, space them so at most two tell at the same time.
- Over the reef painter's dense foreground (cast-action-reef.png) the crab's legs hide behind coral: place crabs on open
  sand in the real level.
- The diver's mask is a live overlay of rects (cheap), the head is the hero sprite: at 1x the eye behind the glass is
  only 2 px.
