# Mission 4 polish, key `deep`: FINAL AREA: GLOWING DEEP + the MEGA OCTOPUS lair

Mock frames painted by the real engine (real HUD, hero, robots, bubbles, cage), 480x270 upscaled 3x.

## Files
- `scene.js`: the harness fixture (`--extra`), the reusable art for world x 5000-6400.
- `deep.png`: frame 1, camera 5210 (world 5210-5690).
- `deep-lair.png`: frame 2, the boss camera 5920 (world 5920-6400), the arena just before the boss comes out.
- `deep-lair-boss.png`, `deep-cast.png`: the same two frames with the `boss` and `cast` painters' scene.js files loaded too,
  to check how the pieces fit (their work was still in progress when these were rendered).
- `before.png`, `before-lair.png`: the same cameras today, without this scene.

## Render commands (from /Users/macbookair/game; errors [] and warnings [] on all of them)
    H=tools/harness; P=proposals/m4polish/deep; M=proposals/m4polish
    node $H/harness.mjs render --level 4 --x 5411.6 --frames 100 --god --scale 3 --extra $P/scene.js --out $P/deep.png
    node $H/harness.mjs render --level 4 --x 6121.6 --frames 50  --god --scale 3 --extra $P/scene.js --out $P/deep-lair.png
    node $H/harness.mjs render --level 4 --x 6121.6 --frames 400 --god --scale 3 --extra $P/scene.js --extra $M/boss/scene.js --extra $M/cast/scene.js --out $P/deep-lair-boss.png
    node $H/harness.mjs render --level 4 --x 5411.6 --frames 100 --god --scale 3 --extra $P/scene.js --extra $M/boss/scene.js --extra $M/cast/scene.js --out $P/deep-cast.png
    before: the first two commands without --extra (before-lair uses --frames 400)
- `--x 5411.6` builds the mission with the camera at exactly 5210, `--x 6121.6` at exactly 5920 (the boss lock goes live
  at once and the boss spawns 60 frames later, so `--frames 50` shows the empty arena and `--frames 400` the boss in place).
- `--frames 100` lands on a frame where the cage shows HELP! (it blinks with G.t).
- Same command, same picture: deep.png rendered twice is pixel-identical.
- `node $H/harness.mjs sim --level 4 --x 4600 --god --seed 1 --frames 8000 --extra $P/scene.js` crosses the ruins
  fade-in, the whole area and the boss: completed, errors [], warnings [].

## What the frames show
**deep.png (camera 5210).** The hero swims left of centre firing bubbles; the robot jelly (upper centre) and the robot
octopus (lower centre) are the area's real spawns, pinned there; the cuttlefish cage at 5650 shouts HELP! on the right.
Behind them, back to front:
- deep navy water, darker and more violet toward the floor, with large faint glows far off (teal left, violet centre,
  magenta right) and a glowing band along the far floor, like a distant coral field;
- hazy far rock towers and mesas (a little lighter than the water, so they read as the farthest plane);
- a friendly anglerfish (round, big shiny eye, small smile) with its lure light bobbing and pulsing;
- glowing real jellyfish (a pink one, two cyan ones, a small far violet one) drifting and pulsing;
- the mid cave: a great rock arch and two cave pillars, lit on the left, a violet rim on the right, strata, cracks,
  glow-worm specks, glowing strands hanging under the arch, tufts of coral on the ledges;
- a school of lanternfish with glowing dots;
- the cave ceiling across the top: rock with stalactite overhangs and glow-worm threads, all above y 58 (the swim space
  starts at y 62), mostly behind the HUD;
- the coral garden on the floor: cyan organ-pipe tube sponges with glowing lips, a big magenta sea fan with a fine mesh and
  glowing polyps, violet brain corals, anemones, peach sea pens, cream tube worms with red plumes, boulders with corals
  on them, darker back-row corals, starfish; their light falls on the sand in coloured pools and pulses gently
  (four colour groups, each on its own phase);
- dark violet sand with ripples, layers, pebbles, scallop and spiral shells, glowing grains;
- low dark rocks along the very bottom edge; sparkling plankton, glowing motes and marine snow in the water.

**deep-lair.png (camera 5920, the boss arena).** Left half: the same glowing deep (garden, arch, jellies, ceiling).
Right half: the MEGA OCTOPUS lair dug into the end wall of the cave: an octagon bulkhead of dark riveted steel plates
(rock creeping back over its rim, barnacles), a round hatch with a yellow-black hazard ring, running lights chasing round
the steel ring, the big vault door swung open to the left, two red beacons on top, a hazard-framed emblem plate with a
cartoon robot octopus, four amber portholes with robot silhouettes passing behind them, a riser pipe climbing the rock,
a sagging cable of blinking lamps, pipes along the floor with a red valve, a gauge, a vent puffing bubbles and some
robot scrap. Through the hatch: a tunnel into the robot factory, ribs shrinking toward a red furnace glow, claw arms on a
rail, a conveyor of robot-jelly domes, and two red eyes blinking at the back (hidden as soon as the boss is out).
**deep-lair-boss.png** shows the `boss` painter's red MEGA OCTOPUS in front of it: the dark steel and navy rock make
the red boss pop; the bulkhead, beacons, emblem and portholes stay visible around it.

## How scene.js is organised
One block, nothing global. It wraps LEVELS[3]'s `drawBG/drawBehind/drawGround/drawFront/drawOverlay/load/update` and
calls the previous hook outside its own range, so it composes with the other painters in any load order:
- `drawBG`: the previous BG while the camera is left of 4560; mine from 4900; between them mine is drawn into one
  offscreen canvas (made once) and cross-faded over the previous one.
- world hooks: when the camera can see x >= 4950 the previous hook is clipped to x < 5000 and mine draws from 4950 (the
  sand dithers into the previous ground over 4950-5000, a boulder and corals sit on the seam).
- `drawOverlay`: previous overlay faded out, mine faded in, over the same camera range.
- The ENEMY_TYPES are not touched. Staging (`load`/`update`) only runs when the mission is built at exactly camera
  5210 or 5920: hero pose, bubbles, robot positions, score, banner; MISSION START band and WARNING cleared.

Reusable art (all private functions in the block, ready to move into a `level4_deep.js`):
- pixel buffers `buf/put/get/rect/disc/oval/line/poly/outline/bake/sprite` (Int32, crisp, from level3_sky.js);
- additive light `lbuf/glow/bakeLight/haloCanvas/lit` (float RGB light baked once, drawn with 'lighter');
- parallax strips `stripBuf/blitStrip`, design coordinates `dsx/ssx` (design x = screen x at camera 4560);
- backdrop painters `paintWater`, `paintFarGlow` (p .04), `paintFar` (p .09), `paintMid` (p .22), `paintCeiling` (p .85),
  `paintFront` (p 1.2);
- creatures `jellyFrames(size, palette)` (4 pulse frames), `anglerSprite`, `lanternFish`, live `drawJellies`,
  `drawAnglers`, `drawLanterns` (lists `JELLIES`, `ANGLERS`);
- coral painters `tubes`, `fan`, `dome`, `anemone`, `seaPen`, `worms`, `boulder`, `starfish`, `backRow`, placed by the
  `GARDEN` table (kind, x, size, palette, count, lift onto a boulder); palettes `CYAN MAG VIO WARM` (`pal()`);
- lair `paintLair` (rock massif, `paintRiser`, bulkhead, portholes, tunnel interior, hazard ring, vault door, emblem),
  `paintPipes`, live `lairLive` (beacons, chase lights, cable lamps, porthole silhouettes, eyes, vent bubbles); the hatch
  is `HX, HY, HR` = 6322, 140, 51;
- `buildBG` / `buildWorld` bake everything on first use; `worldLight` blits the four pulsing light layers.

## Cost
- Per frame (all five hooks, after baking): about 1.1 ms in the harness at both cameras: about 20 blits plus some 150
  small fillRects (plankton, motes, lamps, bubbles). Measured with `tools/m4polish/deep/perf.js` (an extra loaded after
  scene.js).
- Baking (first draw): about 0.7-1.2 s in the harness, all layers at once. `Math`, `clamp` and `hsh` are aliased locally
  (`MA`, `clp`, `hs`): global lookups are very slow inside the harness's vm (this alone took the bake from 15 s to 3 s);
  the mid layer's noise is tabulated per x and per y.

## Still weak (honest)
- Baking takes about a second all at once on first use. The real build should spread it out (pump it behind the loading
  bar like `L1ART.pump`, or bake a layer per frame while the hero swims through the ruins).
- The arch is the only big mid-distance feature and stays in view across the whole area (parallax 0.22). The real build
  needs one or two more formations. The jellies, anglerfish and lanternfish are placed for the two proposal cameras and
  should be spread along the area.
- The way in from the Sunken Ruins is a plain alpha cross-fade for the backdrop and a clip at x 5000 for the world layers.
  It needs one shared pass with the `ruins` painter (e.g. a rock gate at 5000).
- The `boss` painter's new MEGA OCTOPUS is about 180 px, bigger than the hatch (opening 102 px), so it reads as in
  front of the lair, not coming out of the doorway. If it stays that big, widen `HR` and the bulkhead (`AP`) by about 20 px.
- The open vault door is seen almost edge-on and can read as a surfboard. The steel ring and the door use dithered
  ramps that look a bit grainy at 3x.
- Coral tips don't twinkle one by one: the pulse is per colour group (4 phases). The glows are soft additive light,
  not strict pixel art (as in Mission 3's glows).
- At 1x the lanternfish school reads as a cloud of dots. The low front rocks are very subtle.
- The cuttlefish cage is still the engine's old cage (not this key).
