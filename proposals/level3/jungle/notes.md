# Mission 3 proposal frame: AREA 2 HONEY JUNGLE (key: jungle)

Mock screenshot of VOLCANO ISLAND, AREA 2: HONEY JUNGLE, rendered by the real engine from the snapshot build
(real HUD, real Mathias sprite, real pixel font, real HMG bullets and particle types, 480x270 upscaled 3x).
Files in this folder: scene.js (the --extra fixture), notes.md (this), jungle.png (final, 1440x810).
Scratch renders: H/shots/l3-jungle/ (r1..r10, crops c*, Mission 2 references m2-*, comparison cmp-m2-r5.png),
where H = /private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness

## STATUS: DONE (10 rounds). Final render command (exact):

    node /private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness/harness.mjs render --html /Users/macbookair/game/proposals/level3/base.html --level 3 --x 1201.6 --frames 150 --hero 1 --scale 3 --extra /Users/macbookair/game/proposals/level3/jungle/scene.js --out /Users/macbookair/game/proposals/level3/jungle/jungle.png

Output: errors [], warnings []. Rendered twice and diffed: pixel-identical ({"same":true,"pixels":0}).
--x 1201.6 puts the camera exactly at x 1000 (= the AREA 2 section start), so world x = screen x + 1000.

## What the frame shows (screen coordinates)
- HUD: MATHIAS, 3 hearts, X3; weapon panel H.M.G. 146 with grenades X8; SCORE 0045700. Banner AREA 2: HONEY JUNGLE
  held at full alpha by update() (MISSION START band removed in load()).
- Canopy ceiling with a gap (x ~140-370) and backlit palm fronds; through it the VOLCANO (crater rim at 262,64,
  notched crater, faint orange glow, grey-brown slopes with dark old lava flows, green lower slopes, plume drifting
  right), hazed into a humid late-morning sky; warm light shafts slanting down-right (kept off the summit).
- Back layers: misty far canopy with palms and emergent trees; a mossy basalt cliff with a ribbon waterfall (live
  streaks) that feeds a short cascade into the pond; understory with buttressed trunks, lianas, banana plants, tree
  ferns, a flame tree and a pink-flowering tree.
- Left: a big buttressed near-layer trunk with strangler-fig roots and a backlit rim; heliconia rostrata pendants and
  vines hanging from the canopy; a hibiscus bush; the mossy fallen log (a platform, shelf fungi, ferns).
- Mathias mid-jump above the log (moss-dust puff where he took off), HMG aimed up, muzzle flash, two rounds going up,
  a bee just above him bursting into bolts, plates and glass shards with a "100".
- ROBOT BEES: a diving bee coming stinger-first at him (stinger white-hot, speed lines), the charging point of the V
  (stinger glowing orange), four more in a loose V, one just leaving the hive.
- ROBOT HIVE hanging from a big branch by a steel strap: hexagon steel plates with glowing honey windows, a bee-striped
  collar, a red status lamp, a glowing round entrance with a landing lip, honey dripping off it and off the branch.
- ROBOT FROGS: one on a lily pad, throat sac ballooned, jaw dropped open, long pink sticky tongue whipping to the log
  where Mathias stood; one mid-leap over the pond with its landing shadow on a lily pad below.
- Steaming jade hot-spring pond: ochre/cream sinter rims, lily pads, water lilies, ripples, shimmer, curling steam.
- Right: the big tree (strangler-fig roots, moss, bromeliad, lianas); a mossy basalt ledge with a robot cage holding a
  scarlet macaw shouting HELP!; dark front leaves in the bottom corners; two blue morpho butterflies; pollen motes.

## How the scene.js works
- One block, nothing global except the registry entries: ENEMY_TYPES robobee / robofrog, PROP_TYPES robohive,
  POW_KINDS parrot, and LEVELS.push (mission 3 'VOLCANO ISLAND', four sections with the style-sheet names).
- Static art is painted pixel by pixel into Int32 buffers (like level2_world.js) and baked once on the first draw:
  sky, volcano + plume, far, cliff, mid, near canopy (screen layers with parallax 0..0.6), light shafts (RGBA),
  tree, hanging heliconias, giant leaves, bush, log, ledge, ground + pond, front plants.
- Robots are built from shaded parts (ellipses/capsules, front to back, light from above, dark seams where a nearer
  part covers a farther one), then OUT outline; bee sprites are cached per (tilt, abdomen angle, glow, wing frame).
- update() pins the hero (pose, weapon, HUD values), bullets, the burst particles, the "100" and the banner every
  frame; enemies hold their spawn poses in their own update(); contact 'none' so nothing hurts the hero.
- Deterministic: no Math.random/rand; textures from a private mulberry32 table, motion from G.t and hsh.

## Decisions
- Parrot (scarlet macaw) rather than a monkey: red/yellow/blue pops against the greens, and a parrot can shout HELP!.
- Bees dive stinger-first (abdomen curled forward under the body) so the glowing stinger points at the target.
- Frog palette kept bright lime; the giant leaves behind the pond use a darker, cooler green so the frogs separate.
- HMG instead of the pistol: more Metal Slug, and shows the HUD ammo bar.
- The banner overlaps the volcano summit slightly: accepted (it fades in the real game; it names the area for the kids).

## Progress log
- Round 1 (r1): first pass; washed-out top, lollipop crowns, pool-cyan pond, small blobby frog, tiny parrot.
- Round 2 (r2): narrower gap + fronds, volcano/plume readable, foliage masses, jade pond, bigger robots.
- Round 3 (r3): leaf-stroke texture, mossy cliff with ferns, frog redesigned in side view, shelf fungi, front leaves.
- Round 4 (r4): frog jaw open (dark mouth, tongue root), landing shadow, jump-dust puff, honey drips.
- Round 5 (r5): thin 1px bee antennae/legs after the outline, glassier wings, blossom accents, less haze, butterflies.
- Round 6 (r6): side-by-side with Mission 2 woods -> added the big dark left trunk for value structure.
- Rounds 7-8: Bezier strangler roots, rounder honey drips, steam wisps over the water.
- Round 9: shafts moved off the volcano, volcano less hazed.
- Round 10: elephant-ear plant moved left of the frog and recoloured cooler/darker; no flower in the waterfall foam.

## Still weak (honest)
- The sitting frog is small for its importance: mouth and sac read at 3x but are only a few pixels at 1x.
- The middle (cliff, waterfall, mist) is pale and a little flat; the waterfall is a plain ribbon.
- The volcano is small and hazy and half covered by the swarm; its plume sits behind the banner.
- Steam, glows and shafts use alpha blending (soft, not strict pixel art), as Mission 2 does for mist and light.
- All bees share one design; the frame is busy, readability relies on outlines and colour.
- Nothing is playable: no bee/frog/hive AI, no ride, no real level layout beyond this one screen.

## Art director pass (Nov 3)
- Score 45700 -> 61200 (it must climb through the level: bay 46850 < jungle < lava 87350 < boss 186350).
- Waterfall: teal edges, a darker band inside them, a pale core, white and blue streaks, a lip where it rolls over
  the cliff; the cascade into the pond matches. It read as a pale beam of light on the misty cliff before.
- jungle.png re-rendered with the command above (no errors, no warnings).
