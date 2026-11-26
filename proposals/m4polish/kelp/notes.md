# Mission 4 polish, AREA 2: KELP FOREST (key `kelp`, world x 1700-3400)

## Render
    H=/Users/macbookair/game/tools/harness
    P=/Users/macbookair/game/proposals/m4polish/kelp
    node $H/harness.mjs render --level 4 --x 2001.6 --frames 220 --god --scale 3 --extra $P/scene.js --out $P/kelp.png
    node $H/harness.mjs render --level 4 --x 1951.6 --frames 220 --god --scale 3 --extra $P/scene.js --out $P/kelp-dock.png
    node $H/harness.mjs render --level 4 --x 2001.6 --frames 220 --god --scale 3 --out $P/before.png
`--x` is the camera + 201.6 (devStart puts the camera at x - 201.6), so the frames sit at camera 1800 and 1750.
`--frames 220` puts the cage's HELP! on its visible blink. errors/warnings: `[]`. Same command = same picture.

## What the frames show
- `kelp.png` (camera 1800): Ines pilots the yellow mini-sub through the kelp; her bubbles have just burst a robot
  octopus (bubble rings, a bolt, a hazard plate, 150 points); a robot ray dives at her; the sea horse in the cage at
  2190 calls HELP!; AREA 2: KELP FOREST banner held. Free sea horses curl on the kelp, garibaldi patrol the arch,
  a shoal of minnows, a hermit crab, urchins and starfish on the sand.
- `kelp-dock.png` (camera 1750): Ines swims beside the parked mini-sub (ENTER: PILOT, the engine's own hint), bubbles
  a robot octopus that is winding up (!); a robot jelly drifts above; the cage further on.
- Look: green-gold light filtering down. Water column from pale gold under the surface to deep teal at the seabed;
  the floating kelp canopy at the surface (behind the HUD); stepped sunbeams falling from the gaps in the canopy;
  far kelp on a hazy ridge (p .12), far rock outcrops and arches (p .3), mid kelp (p .45), near boulders (p .7);
  the play layer's kelp clumps (thin wavy stipes, long blades streaming up and downstream, a gold gas bladder at each
  blade, glowing tips), a slate rock arch and boulders (lit from the upper left, algae tops, pink coralline crust,
  tube and ball sponges, anemones, starfish), the sandy floor (ripples, cobbles, shells, root-claw holdfasts, urchins,
  caustic light), low dark eelgrass and stones at the very bottom, dark near stalks framing the screen edges.

## How scene.js is organised (one block, nothing global; wraps LEVELS[3]'s hooks)
- Helpers: mulberry32 noise table (`nz`, `vn`, `fbm`), Int32 pixel buffers (`buf put get rect ell line stamp outline
  haze bake alphaCanvas`), `waterAt(y)` (the water colour per screen row; `haze` mixes art toward it by depth).
- Reusable art (painters into a buffer, any layer): `blade()` (one frond), `bladder()`, `stalk()` (a whole kelp stipe
  with fronds; palettes `KP` play layer, `KF` dark near stalks), `rock()` (outcrop / boulder / arch from a mask: distance
  field lighting, algae, crust, cracks, sponges, anemones, starfish; palette override for other areas), pixel-map
  sprites `SEAHORSE_ROWS` (3 colourways, fin flutter), `CRAB_ROWS` (hermit crab, 2 walk frames), `GARI_ROWS` (garibaldi),
  `MINNOW_ROWS`, `ringSprite` (bubble rings).
- Baked layers, all built once on first draw in `build()`: `waterCanvas`, `surfaceTile` (period-96 shimmer),
  `farLayer`, `midRockLayer`, `midLayer`, `canopyLayer` (+ its gaps), `raysLayer` (alpha beams under those gaps),
  `nearLayer`, `clumpSprite` per `CLUMPS` entry, `rockSprite` per `ROCKS` entry, `floorFrames` (the whole floor
  1700-3400, six copies with the caustic net baked in, dithered away over 32 px at both ends), `frontLayer`,
  `nearStalk` per `NEAR`. Placement data: `CLUMPS`, `ROCKS`, `HORSES`, `NEAR`, the fish/crab lists in the draw code.
- Sway: kelp is baked straight; `swayDraw`/`blitStrip` blit it in runs of rows that share one horizontal offset
  (`swayOff`: grows with height, a slow surge plus a smaller wave travelling up the stalk, phase by x), so each
  stalk costs a handful of drawImage calls and stays crisp. Sea horses ride the same offset at their height.
- Live bits (G.t only): surface shimmer, ray pulse, canopy drift, sea horses (bob, fins), garibaldi, minnow shoals,
  hermit crabs, marine snow, bubbles off the bladders, caustic frame (every 10 frames).
- Hooks: `wt(cx)` = weight by camera centre (crossfade 120 px at 1700 and 3400). drawBG: previous art when w < 1, mine
  (via one offscreen canvas only while crossfading). drawBehind/drawGround: the previous art clipped to outside
  [1700+32, 3400-32] (only when that part is on screen), mine inside. drawFront: same in screen space; my near stalks
  fade out toward the middle so they only ever frame the edges. drawOverlay: previous when w < 1, mine scaled by w,
  plus the engine's controls hint when only mine is drawn.
- Staging (`STAGES`): picked by the camera `load(cp)` gets (1800 or 1750), pinned every update: hero/ride, enemy
  poses, bullets (drawn exactly like level4_player.js), particles, score, banner. Elsewhere nothing is touched.

## Cost
Node's CPU canvas (harness, `tools/m4polish/kelp/perf.js`): my five hooks together 2-4 ms per frame at camera 1800
(about 0.8 BG, 1.8 behind, 0.02 ground, 0.8 front, 0.2 overlay; the machine was busy, numbers vary); the engine's
current Mission 4 art at the same camera costs 28-60 ms there. In a browser it is a few dozen drawImage calls plus
~60 small fillRect/drawImage for the live bits. Baking takes well under a second on first draw.
Bot sims with the scene loaded (`sim --level 4 --seed 1 --frames 9000`, `--x 1750 --seed 2`): errors `[]`.

## Still weak (honest)
- The robots, the cage, the sub and the diver are the engine's current Mission 4 drawings (grey robots, vector-ish
  sub light cone, anti-aliased bubble rings); they are another painter's job and look below the scenery now.
- Kelp is busy: four depths of vertical stalks; the play-layer clumps all reach the surface and look alike (1-3 stipes).
- Sunbeams are soft and mostly hidden behind kelp; there is no single strong hero beam.
- The sand is one tone family; its caustics read as light worms rather than a sharp net; the floor is lighter than
  the dark soil bands of Missions 2 and 3.
- Free sea horses are small (12x21 px) and two sit low on the left at the same height in kelp.png.
- Hand-over: the previous area's play layer is cut by a straight clip at 1732 / 3368 (the floor is dithered, objects are
  not); with two painters crossfading the same border by alpha, the engine's art shows through ~25% at the midpoint.
- The near stalks fade in and out as they scroll (a deliberate trade for a clear swim space); it may read as odd motion.
- Only cameras 1700-2300 were art-directed closely; 2300-3400 reuses the same generators (second arch at 2862,
  cage 3100) and was only checked at cameras 2398 and 2748.
