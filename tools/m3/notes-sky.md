# Mission 3 sky (KEY = sky) - notes

Owner of: src/level3_sky.js (L3.skyLoad/skyUpdate/drawBG/drawOverlay/weather, reads + decrements L3.eruptT).
Scratch: tools/m3/work-sky/

## Progress log
- [start] No earlier work (file was the 154-byte stub). Read spec, proposal + 4 frames + notes, engine-api,
  level2_sky.js, level3.js wiring (fallbackBG). Other M3 files are stubs at start.
- [r1] framework (int pixel buffers like the proposal painters, strips per scene with parallax, sky columns),
  SHARK BAY lifted from proposals/level3/bay (sky, sun+rays, clouds, far volcano sprite + plume + drones + mast,
  sea stacks, bay strip, lagoon strip, spit strip with palms/hut/nets/canoes ending in a jungle headland).
- [r2] HONEY JUNGLE lifted from proposals/level3/jungle (far misty canopy, cliffs + live waterfalls, understory,
  canopy ceiling strip p 0.6 over cam 1400-4000 with a forest edge that slides in over the end of the bay, gaps,
  backlit fronds, vines, heliconias; light shafts on the canopy's parallax). Removed my canopy's big trunks: the world
  draws its own giant trunks in the playfield.
- [r3] LAVA RIVERS lifted from proposals/level3/lava (dusk sky + afterglow + stars, cloud banks strip, big volcano
  sprite + plume + live fountain + eruption flash, ridge with palm silhouettes, two-tier basalt wall with 3 live lava
  falls, heat haze), THE CRATER from proposals/level3/boss (smoky night sky strip, far wall + blast door + cracks,
  side walls laid out so the boss camera 5720 shows the proposal's composition, catwalk/pipe/crane, falls, blinking
  lamps, crack glows). Overlay: sun tint, spray glints, shafts + motes, dusk/crater tints, eruption flash, particles.

## Decisions
- Transitions (T1 1950-2250, T2 3420-3860, T3 4950-5290 camera x): never two scenes' layers at once. The old scene
  renders into BUF, hazed toward the mist (source-atop, cumulative: far layers first) and faded; behind it a fog
  fill rises; through the fog the next scene's far layer looms (jungle far+cliff / the big volcano / the crater far
  wall), which is the same image the new scene then has; the new scene condenses out near layers first. Skies are
  plain gradient columns (crossfading them has no shapes, so no ghosts). The far volcano is shared by bay+jungle
  (same silhouette, only its light crossfades). The jungle canopy ceiling is a real forest edge (slides in from cx
  1500, its right end leaves the screen by cx ~3730).
- Machine load: timings normalised by a reference workload (2M Math.sin, ~20 ms idle) in t-build.js.
- [r4-r6] review rounds: sweep every 200 px at f40 and f140 (work-sky/sweep, sheets sw1.png sw2.png), transition
  sequences (r4, t12.png, t3.png), eruption fixture (t-erupt.js, erupt/), zoom crops (crop.mjs). Fixes: spit palms
  thinned, second hut -> bamboo lookout with a flag, crater: hazier far rim with base lights, lava seeps down the far
  wall, the lava lake reaching the far shore (darkened so the hero reads against it), cloud banks with sloped bases
  and wispy tails, ash lighter, embers more often, steam wisps stronger/two-puff, build hot loops hoisted.
- Tools: work-sky/multi.mjs (many frames in one process; POP:x0:x1:step measures frame-to-frame backdrop change with
  G.t frozen), sheet.mjs (contact sheets), crop.mjs, t-build.js (build timing normalised by 2M Math.sin), rc.sh.

## Test results (so far)
- run.sh sim --level 3 --seed 1: errors [] (completed false: the bot stalls at the lava rivers, an integration item).
- parity: L1 completed true, errors [], [0,0,5,9], 14150; L2 completed true, errors [], [1,4,1,10], 33000.
- POP (mean |RGB diff| per camera step, drawBG only): no spikes at any transition start/switch/end; the max values
  are steady-state jungle parallax (11.9 per 2 px). Switch points: 2094-2106 max 5.4, 3634-3646 max 0.8, 5114-5126
  max 1.6.
- eruption: L3.eruptT 30 -> counts down to 0 by itself (t-erupt.js log), flash visible at c4440 f126.
- [final] eruption flash toned down (glow x0.6, overlay flash 0.07), table noise in the heaviest build loops.
  sheet: work-sky/sheet.png (11 labelled frames). STATUS: done, handed over.

## FINAL test results
- run.sh sim --level 3 --seed 1: completed false, errors [], hits [3,3,103,0], x 4158 (bot stalls at the lava rivers:
  integration). run.sh sim --level 3 --seed 1 --x 5000 --frames 6000 (T3, crater, boss arena): errors [].
- parity: run.sh sim --level 1 --hero 0 --seed 1 -> completed true, errors [], [0,0,5,9], 14150;
  run.sh sim --level 2 --seed 1 -> completed true, errors [], [1,4,1,10], 33000.
- sweep: 30 camera positions (every 200 px, 0..5600 + 5720) x 2 frame offsets (f40, f140) = 60 renders, errors [];
  transitions: 13 frames through T1/T2/T3 (r4) + POP measurements (no spikes at start/switch/end of any transition).
- eruption: fixture sets eruptT 30 at f120: 29/0.97, 23/0.77, 17/0.57, 11/0.37, 5/0.17, then the real lava bomb at
  f150 re-arms it (30 -> 29).
- build (all four scenes, once per session, at the first Mission 3 load): ~270 ms normalised to an idle machine
  (measured 53-73 s under load avg 30-90 with 2M Math.sin = 4.2-5.4 s, idle ~20 ms). Heaviest: crater sky, lava wall,
  lava volcano, mists. No Math.random/rand anywhere in the file; particles on a private LCG; capped 36/28/18.

## Still weak (honest)
- The bay's BG hut/nets/canoe repeat motifs the world draws in the foreground (reads as a fishing village).
- Dusk cloud banks are still stylised flat banks (wisps added). Ash and spray glints are very subtle.
- Transition midpoints are ~1 s of mostly mist/smoke behind the world (no ghosting, but less detail).
- Soft effects (mist bands, glows, shafts, steam) are alpha-blended, as in Mission 2.
- Lava area: my cliff wall and the world's back columns share the purple basalt palette; separation relies on haze.
