# Mission 4 polish, key `ruins`: AREA 3: SUNKEN RUINS (world x 3400-5000)

STATUS: DONE 2026-11-14 (10 render rounds + a second frame). errors [] / warnings [] on both renders; each render
was repeated and diffed pixel-identical. Scratch, round renders and timing fixtures: /Users/macbookair/game/tools/m4polish/ruins/

## Render commands (exact)

    H=/Users/macbookair/game/tools/harness; S=/Users/macbookair/game/proposals/m4polish/ruins
    node $H/harness.mjs render --level 4 --x 3861.6 --frames 230 --god --scale 3 --extra $S/scene.js --out $S/ruins.png
    node $H/harness.mjs render --level 4 --x 4201.6 --frames 230 --god --scale 3 --extra $S/scene.js --out $S/ruins-captain.png
    # before: the same commands without --extra -> before.png, before-captain.png

`--x 3861.6` puts the camera at world x 3660 (screen x + 3660 = world x); `--x 4201.6` puts it at 4000, the camera
lock of the INK CAPTAIN. `--frames 230` is chosen so the cage's blinking HELP! is on.

## Files
- `scene.js`: the --extra fixture (1 block, only registry hooks touched), the starting code for the real build.
- `ruins.png` (1440x810): main frame. `ruins-captain.png`: second frame (the mini-boss arriving).
- `before.png`, `before-captain.png`: Mission 4 today at the same cameras.

## What the frames show
**ruins.png (camera 3660)**: deeper blue water than the reef and kelp (dithered bands, brighter top-left) with slanted
light shafts. Far: a drowned city on a hill (domes, some broken; towers with cone, dome, crenel or snapped tops; stepped
pyramids; an aqueduct) hazed into the water. Behind it: a temple facade with a broken pediment and fallen drums, and
the giant crowned head of a sea king, tilted and half sunk (crown with pearls, carved beard locks, moss, coral, a
starfish on the cheek, seaweed over one ear). Mid: broken colonnades, arcades, stumps and statues with coral and sea
grass. A pod of three free dolphins and a big manta gliding in the open water; a school of little striped fish.
World layer: landmark arch at 3660 (half collapsed), the grand gate at 3990 (scallop-shell keystone, coral crown,
anemone, starfish), an old shipwreck lying tilted on the sand (planked hull, wale, gun ports, stern-castle windows,
a breach showing ribs and gold in the hold, rudder, bowsprit, snapped foremast, leaning main mast with crow's nest,
a torn sail, a tatty pirate flag, rigging) and **the dolphin cage hangs from the ship's yard arm** (engine cage and
HELP! untouched). Under the bow a treasure chest spills coins down the sand (live twinkles). Sand piles against the
hull and pillars; the seabed shows a gold/red/blue mosaic floor between sand drifts, buried stones, shells, coins,
pottery shards and amphorae. Low dark foreground (column block, rocks, kelp blades) only at the very bottom.
Action: Ines firing a 3-way bubble volley; a robot ray in its tell ("!" and ring, eyes lit yellow) about to dash at
her; a robot octopus lobbing ink; banner AREA 3: SUNKEN RUINS held; score 0231750.

**ruins-captain.png (camera 4000, the lock)**: the INK CAPTAIN (robot cuttlefish: navy steel with zebra plates, gold
rippling fin, glowing red W-pupil eye, hazard collar, striped tentacles with clubs, a propeller, a black bicorne with
gold edge, anchor badge and red plume) shouting ARRR! and firing a fan of three ink blobs (engine `oceanInk`) at Ines;
the real boss bar INK CAPTAIN 75%. Landmark: a colossal stone fist rising from the sand gripping a verdigris bronze
trident (one prong snapped), fallen column drums and a toppled capital, the grand gate's right half and the 4440 arch.

## How scene.js is organised (reusable art)
- Helpers: Int32 pixel buffers (`buf/put/rect/oval/line/poly/outline/bake/mk/blit`), private noise (`nz/vn/fbm`),
  Bayer dither `dz`, water colour `waterAt/waterD` and depth haze `hazeW` (mix toward the water behind the pixel).
- Screen layers (parallax strips over the whole area, baked once): `paintWater` (static), `shaftCanvas` (alpha, p .05),
  `paintFar` (p .08: `towerF/domeF/pyramidF/aqueductF/blockF`), `paintStatues` (p .2: `headTone` the sea-king head,
  temple, `guardian`), `paintMid` (p .42: `column/arcade/seagrass`), `paintFront` (p 1.25). `LX(p, sx)` places art at
  a screen x for the mock camera; layer x = screen x + (cx - 3060) * p.
- World sprites: `archSprite(x, opt)` + `ARCHES` (the four landmarks 3660/3990/4440/4720, options: span, pillar
  width, height, keystone, half-broken, growth list), `paintWreck` (+ `shipPt` ship coordinates), `paintHand`
  (4232), `paintRubble` (4128, 4592, 3470), `paintGround` (+ `mound`: sand against things, `MOSAIC_ZONES`, `amphora`),
  `paintChest`. Decoration painters shared by all: `coralBranch/coralFan/tubeSponge/starfish/anemone`.
- Creatures: `dolphinBuf` (4 stroke frames), `rayShape` (one ray silhouette used for the free manta and the robot ray),
  `fishSprites`; live: `drawPod`, `drawRays`, `fishSchool`, `liveWeed`, `coinTwinkle`, `wreckBubbles`, marine snow.
- Robots (AREA 3 only, and only if `ENEMY_TYPES.<t>.draw` is still today's `drawCreature` version, so a cast/robot
  painter's file loaded earlier wins): `drawRobotRay` (blue steel, hazard wing tips and tail, tell = lit eyes),
  `drawRobotOcto` (purple steel dome, porthole eyes, jet nozzle, hazard band, baked ring arms), `drawCaptain` (above).
  Gameplay boxes/AI untouched.
- Hooks: each of `drawBG/drawBehind/drawGround/drawFront/drawOverlay` wraps the previous one. Screen layers
  cross-fade (`fadeK`, 300 px of camera travel centred where x 3400 / 5000 crosses mid-screen); world layers clip the
  previous art to x < 3400 / x > 5000 and skip it entirely when the whole view is AREA 3.
- Staging: `L.load` / `L.update` wrappers pin the hero, shots, enemies, ink, HUD numbers and banner only when the level
  is built at camera 3660 or 4000 exactly (STAGED 1 / 2). A normal game or other cameras are untouched (bot sims with
  and without the fixture give identical results, errors []).

## Per-frame cost
Headless (@napi-rs/canvas) timing fixture `tools/m4polish/ruins/timing.js`: all AREA 3 hooks + its robots about
0.6-1.1 ms per frame (noisy, up to ~4 ms on a cold run) at both cameras; today's Mission 4 art costs ~57 ms there in
the same harness (its drawBehind is vector drawing). Bake on first use takes a moment (big strips, one time).

## Still weak (honest)
- The sand floor is a thin, light band (the seabed line is gameplay, y 242-248); Missions 2/3 have a richer, darker
  ground. The mosaic is only a 6 px strip, readable at 3x but small.
- The sea-king head is soft and a little grumpy; at 1x its face is a few pixels and it sits behind busy colonnades.
- The middle band (far city + temple + colonnade + arches) is busy and mostly one mint-blue stone family; value
  separation comes from haze only.
- Robot ray from above is clear, but the frame-3 tell pose differs little from gliding; the ray, octopus and captain
  are 1-frame-per-state bakes (no dash/squash animation, no death pieces).
- INK CAPTAIN: the W pupil is tiny; arms read as a bunch; it is wider than its 48 px gameplay box.
- The cage HELP! is the engine's plain text under the banner (in the real game the banner fades out).
- The lower-left quarter of the captain frame is plain; the left/right corner foreground is subtle.
- Cross-fade at x 3400 / 5000 is tuned only against today's art (kelp/deep painters' versions not seen).
