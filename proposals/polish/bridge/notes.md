# Mission 1 repaint mock: AREA 3 THE BIG BRIDGE (key: bridge)

STATUS: DONE (10 rounds + final). Files here: `scene.js` (the `--extra` fixture), `bridge.png` (1440x810),
`before.png` (same camera, original art), `notes.md`. Scratch renders, crops and comparison sheets:
`tools/polish/bridge/` (r1..r10, `cmp-final.png` = bridge | Mission 2 | Mission 3, `before-after.png`, `w-*.png` = other cameras).

## Final render command (exact)

    node /Users/macbookair/game/tools/harness/harness.mjs render --level 1 --x 3400 --frames 150 --god --scale 3 --extra /Users/macbookair/game/proposals/polish/bridge/scene.js --out /Users/macbookair/game/proposals/polish/bridge/bridge.png

Output: `errors: []`, `warnings: []`. Rendered twice and diffed: identical (`{"same":true,"pixels":0}`).
`before.png`: the same command without `--extra` (out `before.png`).
Checked too: `--x` 2700..4600 (no errors, the bridge draws over its whole length and both ends crossfade), and a bot
playthrough with the fixture loaded gives the same result as without it (`sim --level 1 --seed 1`: hits [0,0,5,9],
score 14150, no errors), so nothing but the drawing changes.

## What the frame shows (camera x 3198, screen = world x 3198..3678)
- Golden sunset over a river gorge: dithered sky bands bowing round a low sun (right, half behind the far range),
  soft rays, belly-lit clouds, thin stratus streaks, the first stars top left, a flock of seven birds heading home.
- Two purple mountain ranges with haze at their feet, pale mesas at the far bend of the river.
- Left: the gorge wall with strata, ledges with bushes, jungle and palms on top, hanging vines and a two-tier
  waterfall (live streaks, spray on the shelf, foam and mist at its foot). Right edge: a rock tower with trees.
- The river: gold only at the far bend and in the sun's glitter path (right of the second pylon), dusky mauve behind
  the action so yellow bullets, red lasers and grey robots stand out, deep blue in the bridge's shadow; rocks with foam.
- The bridge: stone pylons with lanterns and a little robot-army banner (screen x 118 and 374), riveted rust-red
  trussed arches (two chords, gusset plates, lattice) with hangers, a lantern under each crown, the far rope railing,
  the plank deck with nails on a riveted girder stencilled RR-0731, joist ends, stone piers with knee braces standing
  in the water, the near railing (dark posts, sagging ropes) along the bottom edge.
- The two `crates` platforms as strapped cargo stacks: olive army crates (hazard end, RR-7), pine crates with
  arrows, dark crates with steel bands. Same footprint, top edge at `pl.y`.
- The moment (real engine objects, pinned): Ines running and firing the H.M.G. (two rounds in the air, sparks on the
  soldier's rifle, spent shells), a soldier on the deck, a soldier aiming from the big stack with his laser bolt on
  its way, a drone that has just dropped its bomb, a second drone coming in with its bomb still hanging, the red
  barrel, the tied prisoner shouting HELP!, a prop crate. HUD: H.M.G. 137, 8 grenades, score 0023650, the area banner.

## How scene.js is organised
One block, nothing global. Sections in file order:
1. Helpers (private copies of the level3_world.js approach): noise, Bayer `ramp`, Int32 pixel buffers
   (`buf/put/rect/disc/line/outline/bake/mk/blit`), strips (`stripW/stripOff/mockX/blitStrip`), `weightAt`.
2. Palettes. `SUN` is the sun's place in the frame.
3. **Reusable area scenery (the starting point of the real repaint):**
   - sky: `skyBuf`, `streak`, `sunSprite`, `raySprite`, `cloudBuf`
   - far: `ridge` + `mountains` (two ranges), `farCliffs`
   - river: `riverBuf` (tile), `rowP` (parallax per row), `glitterBuf`, `rockBuf`, live `river`, `sparkles`, `nearRocks`
   - gorge walls: `cliffTop/cliffBase/cliffStrip`, `clump`, `palm`, `fallTex` + live `waterfall`
   - bridge: `spanBuf` (arch, hangers, far railing), `pylonBuf`, `deckBuf`, `pierPx/pierBuf`, `bankBuf`, `signBuf`
   - platforms: `crate`, `stencil`, `stackBuf` (any `crates` platform whose size is a multiple of 16)
   - foreground: `fgPostBuf`, `fgRopeBuf`
   - `build()` bakes all of it once (first draw); `scene(g, cx)` paints the whole background.
4. Hooks on `LEVELS[0]`: `drawBG` (crossfades with the old art exactly where level1.js does), `drawBehind`,
   `drawGround`, `drawPlat`, `drawFront`. Each keeps the original and calls it outside the bridge (world x 3060-4340);
   the old truss, BRIDGE sign and 'bridge' ground are skipped by handing the original function a filtered
   `L.decor` / `L.grounds` for the call. The old foreground items of the neighbour areas are kept through a clip.
5. The proposal frame: `L.load` / `L.update` wrappers pin hero, enemies, shots and banner. Only when the mission is
   built at the mock camera (`--x 3400`); any other start plays normally.

Composition is laid out in the frame's own coordinates: `mockX(p)` converts "screen x at the proposal camera" to
strip x, so the waterfall, the gap in the cliffs and the sun can be moved by editing numbers (`CL_PTS`, `FALL`, `SUN`).

## Per-frame cost
- Baked once: sky, sun, rays, 6 clouds, 2 ranges, far cliffs, river tile, cliffs, span, pylon, deck tile, pier,
  banks, stacks (per platform, on first sight), foreground. No canvases per frame. The bake is slow: a render with
  the fixture takes about 1.8 s longer in the Node harness (measured, 4.7 s against 2.9 s), nearly all of it the
  per-pixel noise of the cliffs, ranges and sky. In the mock it happens on the first draw; the real repaint should
  bake at mission load (as Mission 2 does) and could use cheaper noise.
- Each frame: ~12 big blits; the river is 37 row pairs (up to 74 `drawImage`), the waterfall 28 columns (up to
  ~60 1px-wide `drawImage`), mist ~35 small alpha discs, ~60 `fillRect` sparkles. Not profiled on the kids' machine:
  if it is too much, draw the river in 4px bands and bake the waterfall into 4 frames.
- While crossfading with a neighbour (about 300 px of walking at each end) the whole scene is painted into an
  offscreen buffer and composited: roughly double cost there.
- No `Math.random` / `rand` in drawing; everything live comes from `G.t` and `hsh`.

## Still weak (honest)
- The bridge sits low over the water (the piers' feet had to be on screen): the gorge reads from the cliffs, not
  from height. "Far below" is not really there.
- The near railing posts read as deck piles in the still, cover part of the stone piers and their foam, and will
  slide at parallax 1.3 in motion like the original ones.
- Cliff shading is noise-based and a little soft and blotchy next to Mission 2/3's crisper shapes; ledges are faint.
- Soft alpha (sun glow, rays, lamp glow, mist) as in Mission 2: not strict pixel art.
- A hanger runs behind every 32 px of deck, so one sits behind the hero and one behind HELP!.
- The glitter path stays under the sun on screen: shots crossing that 30 px column are harder to see.
- Lamps are lanterns on the pylons and under the arch crowns only; no lamp posts on the deck. Birds are tiny.
- The dropped bomb (engine sprite) reads as a small dark box. Prop crate and barrel keep their old flat look.
- Both ends blend with the OLD camp/base art (their flat mountains ghost through), the old palm and sandbags stand
  next to the new pylon, and the left abutment is plain. This must be redone once all four areas are repainted.
- Only stills and a bot run were checked: the row-parallax river (tile repeats every 512 px), the waterfall and the
  rope sway have not been watched moving in a browser.
- Only the far arch is drawn (a near one would cover the players).

## Log
- r1 first pass; r2 river made dusky (gold swallowed bullets), cliffs cooler and hazed, polygonal arch, lower
  foreground posts; r3 river whole under the deck during crossfades; r4 jungle clumps lit, sun rays, bigger lamp
  glow, rosier ranges; r5 sun moved right so its glitter path is in view; r6 ledges, calmer planks, bank masonry;
  r7 flock against the bright sky, brick-staggered stacks; r8 crate kinds; r9 straps off the stencils, list swaps
  made safe next to other fixtures; r10 girder stencil. Final = r10.
