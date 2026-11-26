# Mission 5 proposal frame: AREA 2: STAR GARDEN (key: garden)

Mock screenshot of ALIEN MOTHERSHIP, AREA 2: STAR GARDEN, rendered by the real engine (real HUD, real Mathias
sprite, real pixel font, real H.M.G. shots and particle types, 480x270 upscaled 3x). Cast and palette from
`proposals/level5/kit.js` (not edited). Files here: `scene.js` (the --extra fixture), `garden.png` (final, 1440x810),
`notes.md` (this). Scratch renders r1..r13, the zoom tool and the working log: `tools/m5/garden/`.

## STATUS: DONE (13 rounds). Final render command (exact)

    cd /Users/macbookair/game
    node tools/harness/harness.mjs render --level 5 --x 2401.6 --frames 60 --hero 1 --god --scale 3 \
      --extra proposals/level5/kit.js --extra proposals/level5/garden/scene.js \
      --out proposals/level5/garden/garden.png

Output: `errors []`, `warnings []`. Rendered twice and diffed: pixel-identical (`{"same":true,"pixels":0}`).
`--x 2401.6` puts the camera at exactly x 2200 (camera = x - 201.6), inside AREA 2 (1600-3300): world x = screen x + 2200.

## What the frame shows (screen coordinates)
- HUD: MATHIAS, 3 hearts, X3; H.M.G. 152 with the ammo bar, grenades X7; SCORE 0071850. Banner AREA 2: STAR GARDEN
  held at full alpha by `update()` (the MISSION START band is cleared).
- The dome: a big steel arch with bolts (ship hull panels, plaques, a pipe and a cyan light strip in the top
  corners), five curved meridian ribs, a ring beam with cyan lamps and amber node lamps, crisp glass shine strokes.
  Through the glass: deep space with a violet nebula, stars in three sizes, the MOON (grey, cratered, lit from the
  upper right, its dark limb fading into space), a small ringed planet and a shooting star.
- The garden, never green: three bubble trees (pink, teal, orange: glossy bubbles on curved boughs), a dark far
  layer of trees and mushrooms backlit by garden lamps, tall violet mushrooms on the right. On the raised planter
  behind the catwalk: fiddlehead (spiral) ferns, tulips, STAR FLOWERS, a lantern plant, small glowing mushrooms,
  gardeners' tags, sprinklers. The planter wall carries the irrigation pipe, a magenta guide strip, vents, a glyph
  plaque and a spout that pours the pink nutrient stream into the pond.
- The floor is a metal catwalk (bright top edge, magenta guide dashes) over a glowing pink pond with cyan glints and
  floating pads. Dark fiddleheads rim-lit pink by the pond frame the bottom corners.
- Two giant glowing mushrooms in steel pots with hazard stripes are the platforms: orange with cream spots (x 118,
  top y 192) and pink with cyan spots (x 246, top y 186).
- Mathias has just bounced off the orange cap (spore puff under him), H.M.G. level, muzzle flash, three tracers;
  an oggle on the pink cap bursts (fireball, shell plates, a boot, its ray gun, its antenna, its eye popping out, "100").
- Robots: the new EYE FLOWER on the left in its warning pose (bloom wide open, yellow eye, angry lid, white lamp,
  red !); a roly eye on the catwalk in its warning pose (hop, sparks, !); a second roly rolling in; an oggle aiming.
- The cows: two blond Galician cows behind a low force-field fence (pink pasture, water trough, a cow sign on the
  post), an eye saucer overhead lowering a third one in its green beam, and one cow in a glass pod on the right
  shouting HELP!.
- Live with --frames: star twinkle, lamp blink, fence shimmer, saucer hover and beam rings, pod bubbles, the
  stream, pond shimmer and bubbles, sprinkler mist, drifting spores and three glowing star seeds.

## How the scene.js works
- One block; registry entries only: `ENEMY_TYPES.eyeflower` (new robot), `ENEMY_TYPES.g_roller` / `g_oggle` (the
  kit's `M5.roller` / `M5.oggle` with a pinned animation clock, spec `t0`, so the `!` and the yellow eye show
  whatever `--frames` is), and `LEVELS.push` (MISSION 5 / ALIEN MOTHERSHIP, end 6400, the four sections).
- Static art is painted pixel by pixel into `M5.px` buffers and baked once on the first draw: space (+ Moon, planet),
  dome (+ hull corners, far wall), far garden, mid garden, terrace, deck + pond, two mushroom sprites, two eye-flower
  sprites, burst parts, two foreground sprites. Screen layers scroll with parallax 0 / 0.05 / 0.2 / 0.35.
- `update()` pins the hero (pose, weapon, HUD values), the three tracers, the burst and spore particles, the "100",
  the banner and the pod's bubble every frame. Robots hold their spawn poses; contact 'none'.
- Deterministic: no `Math.random` / `rand`; textures from a private mulberry32 table, motion from `G.t` and `hsh`.
- `tools/m5/garden/test-shut.js` (a third --extra) adds the eye flower's other poses ('shut', 'open') for a look.

## How the area would play
- The floor is a catwalk over the pond; gaps in it are crossed on mushroom caps (one-way platforms). Orange caps are
  plain; pink caps are springy and bounce the hero higher (to pods and items on the upper planter). Falling in the
  pond is a soft fail for 8-10 year olds: sticky nectar, wade out slowly, no instant death.
- ROLY EYE (kit): rolls along the catwalk. Warning: stops, hops on the spot, sparks, yellow eye, `!`; then it
  dashes. Jump to a cap and let it pass under, or crouch and shoot.
- OGGLE (kit): walks, aims, antenna lamp blinks + `!`, then fires its slow green ring (jump or duck it).
- EYE SAUCER (kit): here they ferry cows to the paddocks. Shoot a carrier and its cow floats down safely (bonus).
  A hunting saucer warns (yellow eye, `!`) before it drops its beam on the hero: step out of the cone.
- EYE FLOWER (new, `eyeflower`): a turret on a steel stalk bolted to the deck or the planter. Shut it is an
  armoured bud (shots clank off, a little Z floats over it). Warning, about 1 s: the bloom snaps open, petals
  rattle, the eye turns yellow, the lamp blinks, `!`. Then it spits one seed in a slow arc (shootable), the eye
  turns red and stays open for a moment: that is when you shoot the eye. 4 hits.
- Rescue: cows in glass pods along the way (HELP! / MOO!, "MOO! THANK YOU!"). The area's set piece is the paddock:
  shoot the two fence posts and the force field drops, the herd stampedes left and bowls over the robots behind you.

## Decisions
- The far wall of the garden was lowered to y 172 so Mathias, the tracers and the burst sit against dark space.
- The pond is under the catwalk (foreground band), not in the play lane: it glows without costing readability.
- Fence rails sit above the cows' backs and at hoof height, so their faces stay clear.
- Teal is kept on the cyan side (hue 185+) so no plant can be mistaken for the robots' green.
- The Moon, not the Earth (the Earth belongs to AREA 3: SPACE WALK).

## Kit notes
- Nothing blocked me. `M5.px` does not export `bakeEye` / `liveEye`: the eye flower carries copies.
- The kit header lists a spec field `t0`, but the stand-ins ignore it and animate on `G.t`; hence the pinned wrappers.

## Still weak (honest)
- The band behind the play lane (y 150-205) is kept dark on purpose: the garden's mass is in the tree crowns and
  the thin planter strip, so the lower middle reads more "ship wall" than "lush garden".
- The cows are small (kit sprite size), partly behind rails and grass; the beam tints the floating one green.
- The three bubble trees share one silhouette; the orange one can read as a pile of buns.
- The eye flower is a frontal daisy with lumpy petals at 1x; its shut bud and its seed are not in this frame.
- Only five ribs and one ring beam; the hull corners sit mostly under the HUD; how the arch repeats over a
  1700 px area is not designed. The banner sits right on the ring beam.
- The pond is a textured band: no reflections of the mushrooms or robots; the sprinkler mist is barely visible.
- Glows, the explosion and the tractor beam are soft alpha, not strict pixels (as in Missions 2-4).
- Nothing is playable: no eye-flower AI, no bounce physics, no paddock set piece, no level layout beyond this screen.
