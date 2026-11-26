# Mission 1 repaint mock: AREA 2 ENEMY CAMP (key: camp)

STATUS: DONE (13 rounds). Files here: `scene.js` (the `--extra` fixture), `camp.png` (1440x810), `before.png`
(same camera, no fixture), `notes.md`. Scratch (round renders r1..r13, crops, comparison sheets `cmp7.png` and
`cmp-final.png`, edge checks, `crop.mjs`, `perf.js`, working notes): `/Users/macbookair/game/tools/polish/camp/`.

## Final render command (exact)

    node /Users/macbookair/game/tools/harness/harness.mjs render --level 1 --x 2200 --frames 150 --god --scale 3 --extra /Users/macbookair/game/proposals/polish/camp/scene.js --out /Users/macbookair/game/proposals/polish/camp/camp.png

before.png: the same command without `--extra ...scene.js`, `--out .../before.png`.
Output: errors [], warnings []. Rendered twice and diffed: pixel-identical. `--x 2200` puts the camera at x 1998
(screen x = world x - 1998). A full bot playthrough with the fixture loaded (`sim --level 1 --seed 1 --extra scene.js`)
gives exactly the same result as without it and no errors: nothing in gameplay is touched.

## What the frame shows
- Sky: hazy-hot blue fading to a cream horizon, a high sun with rays (top right), cumulus clouds with shaded
  undersides, a vulture wheeling, three white egrets crossing the hills.
- Far: blue-violet mountains with sunlit facets; on a shoulder far ahead the ROBOT BASE where the mission ends
  (walls, towers, a dome, two smoking stacks, lit windows): a glimpse of where the journey is going.
- Jungle: two layers of jungle-covered hills (crowns in sun and shade, orange flowering trees, palms) and the dark
  wall of big trees at the edge of the clearing (pale trunks, vines, palms standing above).
- The camp yard (middle distance, no outlines): the cut edge with stumps and felled trunks, lines of small tents and
  fuel tanks, watchtowers with red lamps, a big dark mess tent, the robot flag flapping, stacked crates, the radar
  bunker with its turning dish, a supply truck crossing with a dust plume, a searchlight pole, the cookhouse smoking.
- The fence (parallax 0.6): chain-link mesh, steel posts with arms, coiled barbed wire on top, yellow warning
  plates, a bank of dry earth with dry grass, stumps and a stack of logs.
- Play layer (outlined): plank scaffolds on braced, lashed timber legs; the watchtower (ladder, boarded rail, tin
  roof with a hazard fascia, searchlight, blinking lamp); canvas tent with guy ropes and the army's stencil; oil
  drums behind the left scaffold; the jeep (exhaust stack puffing); a coconut palm; red barrels as the engine draws
  them; packed-earth ground with dry grass, tread marks, drying cracks, layered soil, stones, a buried bolt.
- Foreground: dark barbed wire on trestles, sandbags, crates passing in front.
- The moment: Ines leaps off the left scaffold firing the heavy machine gun at the guard on the watchtower, who
  fires back (red laser bolt); a drone closes in with its bomb ready; a soldier runs up on the ground, another aims
  from the far scaffold (second bolt); the prisoner tied to his post below shouts HELP!. All engine objects.

## How scene.js is organised
One block, nothing global. `OLD` keeps the original hooks; each new hook uses them outside world x 1620-3060.
- PART 1 helpers: seeded noise (`nz`, `fbm`), colours as ints, pixel buffers (`buf put rect disc oval line poly
  outline stamp remap haze bake mk blit`), `pdisc` for hard-edged live discs.
- PART 2 AREA SCENERY (the reusable part):
  - strips: `strip(p, top, bot, build)`, `blitStrip`, `shimmerRows` (heat shimmer: rows shifted by a slow sine).
  - sky: `skyColumn`, `sunSprite`, `raySprite`, `cloudSprite` (+ `CLOUD_DEF`, `CLOUD_AT`).
  - background painters: `farMountains` (with the far base), `hillsA`, `hillsB`, `jungleWall` (shared `crown`,
    `jungle`, `tones`, `farPalm`), `campYard` (stamps `mTent mTower mTruck mHut mCrates mTank mLamp mCook mRadar
    mPole mStump`), `fenceStrip`.
  - play layer: `platScaffold`, `platTower`, `platCrates` (cached per platform by `platArt`), `tentBuf`,
    `sandbagsBuf`, `drumsBuf`, `jeepBuf`, `radioBuf`, `flagpoleBuf` + `drawFlag`, `signBuf`, `palmBuf` +
    `drawPalmAt`, ground `groundPx` / `groundFeatures` / `shadows` / `buildChunks`, foreground `wireBuf`,
    `frontCrateBuf`, `darken`.
  - live: `drawSun`, `drawClouds`, `drawBirds`, `drawEgrets`, `baseLive`, `yardLive` (radar, flags, smoke, truck,
    lamps), `heatWisps`, `campAir` (dust motes), jeep exhaust and blinking lamps inside `campBehind` / `drawPlat`.
  - `build()` bakes everything once on first use; `campBG(g, cx)` paints the whole background.
- PART 3 hooks: `L.drawBG` (crossfades with the old sky over the same 300px as the original, through one scratch
  canvas made once), `L.drawBehind` (old decor minus the camp's, then `campBehind`), `L.drawGround` (old ground
  clipped away from the camp, then the chunks), `L.drawPlat`, `L.drawFront` (old foreground clipped to its own areas).
- PART 4 MOCK STAGING (throwaway): `L.load` / `L.update`; active only when the level was built at camera 1998
  (`render --x 2200`), so the same file can be played through normally to look at the scenery.
For the real repaint: move the landmark layout out of `campYard` (it is tuned for this camera through `SX(p, sx)`),
call `build()` at mission load, and drop PART 4.

## Per-frame cost
- Measured in the harness (tools/polish/camp/perf.js, 300 x drawPlay at this camera): 1.8 ms per frame with the
  fixture against 2.6 ms for the original Mission 1 drawing (which strokes paths and builds gradients every frame).
- Per frame: about 12 big drawImage calls (sky, sun and rays, 7 clouds, 6 strips), about 30 one-row blits for the
  heat shimmer, 2-3 ground chunks, a sprite per decor item and platform, 30 column blits per world flag, a few
  hundred 1-8px fillRects for the live bits. No canvases, gradients or paths are made per frame; the crossfade at
  the area's ends draws the background twice (old + new through the scratch canvas).
- The first draw bakes everything: about 0.8 s in the harness (one hitch). Do it at mission load in the real thing.
- Memory: six strips (the widest 1558x68), seven 256x54 ground chunks, small sprites: about 2 MB of pixels.

## Decisions to check
- The far ROBOT BASE on the mountains is new scenery (not in today's Mission 1). It ties AREA 2 to the FINAL AREA.
- The tower's ladder and the knotted ropes on the scaffolds are decoration: nothing can be climbed.
- Decor drums are blue, olive and yellow so that only the engine's explosive barrels are red.
- HMG in the hero's hands (from the prisoner at x 700): livelier than the pistol and shows the ammo bar.
- The camp warms slightly toward the bridge (`dayOf`): the sun sinks 20px and the low sky turns peach, to hand
  over to AREA 3's golden light.

## Still weak (honest)
- The yard furniture is small and pale next to Mission 2's houses, and the fence hides its lower half; outside this
  camera it is procedural and repeats (fuel tanks, tent rows).
- In this frame the jeep is half hidden behind the tower legs and the barrels (that is where the level puts it).
- The engine's breakable crate and red barrels keep their flat original look beside the repainted crate stack.
- HELP! is the Mission 1 plain white text (no bubble as in Missions 2 and 3); it needed a dark tent behind it.
- Tread marks on the 5px walking surface barely read as tyre tracks; the surface is a little speckled.
- Heat shimmer is a 1px row wobble: you see it moving, hardly in a still. Smoke, dust, sun glow and rays use alpha
  (soft, not strict pixel art), as Mission 2 does.
- Foreground props are sparse dark silhouettes; Mission 2 and 3 have richer, coloured foreground plants.
- The ends of the area are plain crossfades to the old scenery and a jittered seam in the ground at x 1620 / 3060;
  they have to be redone together with the neighbouring areas' painters.
- The palm, tents and sandbags are my versions; the AREA 1 painter's palms may not match yet.
- One tent sprite in three small variants, one scaffold recipe: more variety would help over 1400px.
