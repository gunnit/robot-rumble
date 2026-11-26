# Mission 3 world (KEY = world) - notes

Owner of: src/level3_world.js. Scratch: tools/m3/work-world/

## Progress log
- [start] Reading spec, proposal, engine-api, level3.js, level2_world.js.
- [plan] Layers: drawBehind = back-lagoon shallows band (Area 1, baked "back" chunks), sea stacks (parallax 0.45),
  decor sprites per zone (hut, nets, canoe, buoys; jungle trunks, lianas, heliconias, giant leaves, ferns,
  hibiscus, cliff + waterfall at the pond; back basalt column clusters + far lava + lava falls at each river,
  boulders, steam vents; crater gantry, pipes, crane, lamps). drawGround = baked ground chunks (256 px) + live
  water surface/caustics/fish/foam + scrolling lava texture per river (periodic in y) + lake (static + breathing
  crack overlay) + bubbles + glow. drawPlat = baked per plat (pier, log, rock, column, catwalk), lily live (bob).
  drawFront = translucent water over waders (lagoon/pond), lava front lip, fx, low foreground plants/rocks
  (parallax 1.3, y > 250, skipped over liquids). Light from the upper left (level's sun is on the left).
- Liquids read from LV.water / LV.lava at worldLoad (copies); lagoon faces slant inward toward the viewer, the
  sandbar is a coral-sand trapezoid, the pond face is an ellipse (a pool), rivers flow toward the viewer.
- Private rng for fx (no rand()/Math.random in my file at all).
- [r1-r4] File written in sections (helpers, ground bake, liquids, plats, props, decor, front, fx). Rounds:
  r1 lily pads were circles, lava crust a "chocolate" net, black sand too glittery, no river backs;
  r2 fixed lilies, sand glints, rafts per cell, hex ledge + steel road in the crater, decor added (hut, nets,
  canoe, buoys, posts + gull, sign, trunks, giant leaves, bushes, ferns, cliff + waterfall, stumps, boulders,
  vents, back basalt per river, crane, pipes, riser, booth, lamps, DANGER sign);
  r3 lake calmer, ledge less "fence", branching glowing cracks, smaller rocky stacks, red tropical soil strata;
  r4 effects (wade ripples/splashes for robots, steam, embers, leaves, ash) + foreground layer.
- Sky builder (level3_sky.js) already paints a spit with huts/canoes, far stacks, jungle trunks/lianas/waterfalls
  and crater catwalk/crane/blast door: my world-space pieces are the NEAR layer. Crane arm mirrored to point back
  over the base so it never clashes with the sky's arena machinery.
- PERF: bake was 2.1 s + 1.5 s CPU (nz-heavy). Fixed: cached reef line, allocation-free periodic worley, one
  168x72 river tile shared by the rivers (both-way periodic), single-octave pond noise -> chunks ~1.4 s, lava
  0.15 s CPU on this loaded machine (M2's first devStart costs 3.95 s CPU here, M3 2.5 s). Live layer: replaced
  1 px rect loops (surfaces, lips, far lava, falls, caustics) by baked periodic strips/tiles scrolled with
  drawImage: world hooks <= ~1-3 ms/frame (cmp3.mjs).
- Tools: work-world/rend.sh (harness renders, 2 at a time), multi.mjs (many frames in one boot), crop.mjs,
  prof.mjs, cmp2.mjs (M2 vs M3 frame cost), cmp3.mjs (per-hook cost).
- sim --level 3 --seed 1 (r4 state): errors [], completed false (no boss AI yet, bot stuck in lava), hits [4,7,104,0].
- [r5-r7] Stacks redrawn as jagged volcanic outcrops; crater rubble + bolts; warm front rocks in the crater; glow at
  each column's foot; slanted foamy shoreline at x < 60 (boat comes from the sea); zone seams (sand/jungle,
  jungle/basalt, basalt/crater) cross-faded instead of dithered; sand ripple crests, fewer glints.
- Sweep (every 150 px, frames 60 + 200): work-world/sweep/ + sweep-sheet1..4.png. Hero on a column per river:
  r6/x4081, x4685, x5109 (multi.mjs --post). Pond r5/x3260, arena r5/x5921.6, intro r6/xS-f40/96/150.
- Placement pass: buoy off shark spawn 1880 (now 1822), banana plant off frog 2560, leaf clumps off the toucan cage,
  pipe run broken round the flamingo cage (5306-5456 + 5512-5700), riser 5452.
- Tests (r7 state): L3 seed 1 errors [] completed false hits [3,3,103,0] (bot stuck in river 1: integration);
  L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
- [final] Sea stacks only drawn while over the bay (one showed up behind the parrot cage in the jungle); pipe ends
  flanged; @@END@@ marker removed. Leak check (leak.mjs): only global L3; 0 Math.random calls at load.
- FINAL tests: L3 seed 1 errors [] completed false hits [3,3,103,0] x 4158 (bot stuck at river 1: integration);
  L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
  Bake (CPU, this loaded machine): buildChunks ~1.9 s, lava 0.16 s, file load (sprites) ~0.66 s; first devStart M3
  3.15 s vs M2 4.06 s; second devStart 16 ms (cached per LV.terrain). Wall times 11-20 s under 6-agent load.
- sheet.png = 10 frames (intro, beach, lagoon, sandbar, jungle, pond, river 1 + 2 with the hero on a column, crater,
  arena). STATUS: done; open items listed in the builder JSON knownIssues.
