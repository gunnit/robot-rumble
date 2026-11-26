# reef: Mission 4 AREA 1 CORAL GARDEN + the new opening scene (THE DIVE)

## Render commands
    H=/Users/macbookair/game/tools/harness; D=/Users/macbookair/game/proposals/m4polish/reef
    node $H/harness.mjs render --level 4 --x 531.6 --frames 215 --god --scale 3 --extra $D/scene.js --out $D/reef.png
    node $H/harness.mjs render --level 4 --frames 90 --god --scale 3 --extra $D/scene.js --out $D/reef-intro.png
    node $H/harness.mjs render --level 4 --x 531.6 --frames 215 --god --scale 3 --out $D/before.png
    node $H/harness.mjs render --level 4 --frames 90 --god --scale 3 --out $D/before-intro.png
    # with the cast painter's robots and diver (both files compose):
    node $H/harness.mjs render --level 4 --x 531.6 --frames 215 --god --scale 3 --extra $D/../cast/scene.js --extra $D/scene.js --out $D/reef-cast.png
All print `errors: []`, `warnings: []`. `--x 531.6` builds the mission at camera 330 (the mock camera that turns
staging on); `--frames 215` puts the cage's blinking HELP! on. Without `--x` the new intro plays; frame 90 is the
back-roll splash.

## Files
- `scene.js`: the fixture (one block, nothing global except LEVELS[3]'s hooks/intro and `L4.REEF`).
- `reef.png`: Area 1, camera 330 (world 330-810). `reef-cast.png`: the same with `cast/scene.js` loaded.
- `reef-intro.png`: the new opening at frame 90. `before.png` / `before-intro.png`: today's game, same commands.

## What the frames show
- reef.png: sky cutaway above the waterline (y 40) with the far islands and Volcano Island smoking on the horizon
  (between the HUD panels); a rippling surface (wave crests, a bright mirror line, caustic net under it); light
  shafts; three hazy reef walls (tall far pinnacles, mid coral heads with arches, a near ridge with muted corals);
  a sea turtle, a distant eagle ray, a silvery bait ribbon and a shoal of yellow tangs in the background; the reef bed:
  reef heads (rock base, big lacy sea fans, staghorn, labyrinth brain corals, tables, tube sponges), two anemones with
  clownfish pairs, a giant clam, chromis over the corals, starfish and shells on pale sand with dancing caustics,
  contact shadows, a low dark rubble band at the very bottom. Staged: Ines firing bubbles at the robot octopus
  (two bubbles in flight, a burst on the robot), the robot jellyfish above, the caged fish shouting HELP!, the
  AREA 1: CORAL GARDEN banner, a mid-game score.
- reef-intro.png: letterbox bars, caption CORAL KINGDOM. Split view (waterline at y 100): the heroes' white dive boat
  (striped canopy, cabin, tanks, the red-and-white diver-down flag) moored by a rope to the old diving bell on the
  reef below; the other hero waves from the boat; the hero has back-rolled off the stern: fins up out of a big white
  splash. The caged fish calls HELP! under water, the reef and the bell below. The sea's depth colours stay anchored
  at the play waterline, so the split view shows a deep turquoise sea under a bright sky.

## The new intro (IT table in scene.js, ~3.6 s, Enter skips)
0-66 sit on the stern with mask on, buddy waves (gull call at 30) -> 66-90 back-roll (rotated crisp frames) -> 82
splash (crown of jets, droplets, foam ring, bubble cloud, sound) -> 90-122 under water the hero rights himself ->
122-178 swims down to the start (100, 155) while the waterline rises 100 -> 40 (the camera "follows the dive"; the
boat rises with the surface and stays moored at the top of the play view) -> 176 hand-over (the normal frame shows,
HUD under the bars) -> 182 MISSION 4 START! (said) -> 192 area banner -> 198-218 bars out. The buddy is always the
other hero (Ines dives -> Mathias waves, and the other way round; checked with --hero 1).
While the waterline is below 40 intro.draw paints the whole picture itself (bg with the shifted waterline, the
world, the cage, the boat, the hero, the splash), and the level's hooks skip their now hidden work (`SPLIT`).

## How scene.js is organised (the reusable art)
1. Helpers: easing, a hash-table noise (`nz`, `vn`, `fbm`), a private seeded stream, colour packing, `Pix` (pixel
   buffer: rect/ell/disc/line/poly/fill/sprite, `shade` light-from-upper-left, `outline`, `stamp`, `topAt`,
   `hazeRows`, `canvas`), `obj(w, h)` object buffers with the origin at the middle of the base row.
2. Places and palettes: `WL` 40, `BELL_X` 240 (unchanged), `BOAT_X` 150, `gAt` (= groundAt from L.terrain, so the art
   never needs LV), WATER (16 dithered depth steps), SKYC, coral palettes.
3. Painters (all reusable, deterministic): `brain`, `stag`, `fan`, `table`, `tubes`, `rock`, `grass`, `star`, `clam`,
   `bell`, `fishPix`, `clownPix`, `turtlePix`, `rayPix`, `anemonePix`, `boatPix`, `diverPix` + `rotFrames`, `crown`.
4. Layers: `bakeWater`, `bakeSky`, `bakeSurf` (8 frames, tiles every 128 px), `bakeShafts`, `wall` (generic reef wall:
   silhouettes -> shading from top edges -> haze into the water), `nearBack`, `cluster` + `bakeReef` (world strip,
   reef heads at `CLUSTERS`, clams at `CLAMS`, the bell), `bakeGround` (sand, drift round the bell, shadows, shells,
   starfish, weed; returns the top line), `bakeSandCaustics`, `bakeFront`.
   `STEPS` = the bake steps in order (the real build can spread them over the loading bar); `build()` runs them once.
5. `REEF = { x0, x1, steps, bakeMs, build, bg(g, cx, wl), behind, ground, front, overlay(cx, wl), boat, surfBand,
   gAt, WL }` (also `L4.REEF`). `bg` draws into any context `g` (crossfade scratch canvas) with any waterline `wl`
   (the intro). Live bits: shoals, turtle, ray, anemones (4 sway frames) + clownfish, chromis, bell bubbles,
   rising bubbles, motes, waterline glints, caustics on the sand, the boat's flag; the control hint (G.time < 440).
6. Glue: wraps LEVELS[3].drawBG/Behind/Ground/Front/Overlay; inside camera centre < 1590 only this art, 1590-1810 a
   crossfade (bg through a scratch canvas, world layers with alpha), beyond only the previous hooks (old art or the
   kelp painter's). Works in both load orders with kelp/scene.js (checked).
7. `makeIntro()` -> `L.intro` (replaces today's plain descent).
8. Mock staging: only when `load(cp)` gets cp 330; pins the camera, hero, two robots, bubbles, particles, banner, score.

## Cost (harness, napi canvas; the browser will be faster)
- Bake, run once on the first draw: ~175 ms on a quiet machine (water 3, sky 8, surf 51, shaft 7, far 17, mid 12,
  near 13, reef 20, ground 15, caus 8, front 7, sprites 3, boat + diver frames 9 ms). On a busy machine 2-4x that.
  Note: a local `const Math = globalThis.Math` in the block matters in the harness (vm global lookups were 10x+ slower).
- Per frame inside Area 1: ~0.4 ms for all five hooks (blits + ~120 small live rects/sprites). Intro frames ~1.9 ms.
- Timing fixture: `tools/m4polish/reef/timing.js` (load after scene.js with `sim --level 4 --extra ... --extra ...`).

## Still weak (honest)
- Under-water mid-water (y 60-180) is mostly open gradient + shafts by design (swim space); it is calmer than the
  dense mid-grounds of Missions 2 and 3.
- The reef heads repeat one recipe (rock + fans/staghorn behind + brain + table/tubes); along the whole area they
  start to look alike. A second and third recipe (a big table-coral stack, a staghorn thicket, a sea-fan grove) would help.
- The caustic net under the surface is subtle (bright on bright); the sand caustics read better.
- The yellow tang shoal is a static spiral (it drifts and wiggles but never turns or reshapes); the far "bait ribbon"
  is only dashes.
- The sitting/rolling diver of the intro is my own sprite in today's diver colours (grey-blue tank, yellow fins);
  the cast painter's new diver has a yellow tank and orange fins, so they must be matched in the build. During the
  roll the rotated sprite is small and partly hidden by the splash; the clearest beats are frames 74-82 and 90.
- The bell (x 240) is only seen in the intro and the first screen; the mock camera (330) does not reach it.
- The boat stays moored at the top of the first screen in play; it sits under the HUD weapon panel (translucent).
- Shafts, glows, foam and motes use alpha blending (soft, as Mission 2 does for light and mist).
- The robots in reef.png are today's grey ones (the cast painter owns them; see reef-cast.png).
