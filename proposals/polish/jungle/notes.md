# Mission 1 repaint mock: AREA 1 THE JUNGLE (key: jungle)

STATUS: DONE (12 render rounds). Final render command (exact):

    node /Users/macbookair/game/tools/harness/harness.mjs render --level 1 --x 1000 --frames 180 --god --scale 3 --extra /Users/macbookair/game/proposals/polish/jungle/scene.js --out /Users/macbookair/game/proposals/polish/jungle/jungle.png

Output: errors [], warnings []. Rendered twice and diffed: pixel-identical. before.png is the same command without
`--extra` (`--frames 180` so the prisoner's HELP! is on in the original too).
`sim --level 1 --seed 1 --extra scene.js` gives the same result as without it ([0,0,5,9], 14150, no errors): the
fixture changes drawing only, and stages the moment only when the level is built at the mock camera.

Files here: scene.js (the --extra fixture), jungle.png (1440x810), before.png, notes.md.
Scratch (rounds r1..r12, crops, comparisons with Mission 2 and 3, other cameras, timing probe):
/Users/macbookair/game/tools/polish/jungle/ (cmp-final.png = before | after | Mission 2 | Mission 3).

## What the frame shows (camera x 798, screen = world - 798)
- Morning sky in dithered bands, a low sun upper right with a bloom and soft rays, cumulus behind the hills, a far
  flock and two scarlet macaws crossing the gap, a toucan on a branch.
- Misty blue jungle hills with a far STEP PYRAMID; a pale far canopy band; a sunlit mid canopy in rows of crowns
  (hazier toward the ground, so the playfield band stays light); understory trees with forked branches, blossom,
  banana plants, and an overgrown temple gateway in the haze; two giant buttressed trunks wrapped in strangler
  figs, their dark crowns closing the top corners, orchid vines and backlit fronds hanging into the gap; warm
  light shafts slanting down-left from the gap.
- World plane: the two "rock" platforms as mossy carved temple blocks (a guardian mask, glyphs, roots, cracks; OUT
  outline, bright moss top exactly at pl.y), the broken ruin pillar (paler, soft outline: scenery, not a step),
  palms with ringed trunks, flowering bushes, emerald ferns, butterflies, a grassy lip with flowers and mushrooms
  over layered earth with stones, roots and a lost carved stone; dark foreground leaves along the bottom.
- The moment: Ines running and gunning with the H.M.G. (the first prisoner's gift; score 1350), two tracer rounds
  in the air, a robot soldier behind the crate about to fire, another on the temple block whose red laser is
  already on its way, the next prisoner shouting HELP!. Real engine objects only; banner held.

## How scene.js is organised
One block, nothing global. Helpers (noise table `nz`, Int32 pixel buffers `buf/put/rect/oval/line/bez/outline/
hazeB/bake`), plant painters (foliage, fronds, ferns, vines), then the reusable area scenery:
- `jungleBG(g, cx)`: sky, sun, clouds, strips `hills` (p 0.05), `far` (0.12), `mid` (0.25), `near` (0.42),
  `giants` (0.6) + shafts; built once by `art()`. Strips are sized for camera 0..1510. Takes any 2D context, so it
  can be crossfaded over the next area (one scratch canvas, made once).
- `jungleDecor(cx)`: statue, ruin (two variants), palms (4), bushes (3), ferns (3) for the existing `L.decor`
  entries with x < 1620; `jungleGround(cx)`: 256 px chunks of the grass ground; `junglePlat(pl)`: 'rock' -> temple
  block (single lintel or two courses with a mask, by height), 'log' -> fallen log on two stumps, cached per
  platform; `jungleFront(cx)`: foreground plants (same slots as the original) and pollen.
- Hooks: `L.drawBG/drawBehind/drawGround/drawPlat/drawFront` call these inside the jungle and the originals
  elsewhere (the original decor/ground painters are handed `L.decor` / `L.grounds` without the jungle's entries).
- Staging: `L.load` / `L.update` wrappers pin hero, two soldiers, shots, banner while `cp` is the mock camera.
Checked at other cameras (tools/polish/jungle/r11-sheet.png): x 60 (statue), 640 (log platform), 800, 1400
(second ruin and log), 1560 (crossfade), and the title screen (it scrolls Mission 1's scenery).

## Cost
Build once on first draw: backdrop ~1.5 s in the harness (five strips up to 1400x270, painted per pixel), decor
60 ms, ground 125 ms, platforms 25 ms. In the real game build at mission load (or slice it over a few frames).
Per frame: ~15 blits for the backdrop, 2-3 ground chunks, one blit per platform/decor, palms and 2 vines per giant
in a few slices each, ~40 one-pixel rects (pollen, flock): under 0.5 ms in the harness. No per-frame canvases.

## Still weak (honest)
- Shafts, sun bloom and rays are alpha-blended (soft, not strict pixel art), as in Missions 2 and 3.
- The handover to the camp is a mock: the backdrop crossfades over the ORIGINAL camp art (cameras 1210-1510, the
  old circle-trees ghost through at up to 25%), the ground cuts hard at 1620, the CAMP sign is still the old one.
- The mid canopy rows still read a little like scales up close; the far hills are faint; the pyramid is half
  hidden by a tree in this frame.
- Everything is green: accents are small (blossom, macaws, toucan). No water or big flower mass like Mission 3.
- The sun is fixed for the whole area (the original sinks slowly); scenery is lit from the right while the engine's
  characters and the crate are lit top-left; the flat engine crate and the prisoner's post look plainer than the
  painted world.
- Few variants (4 palms, 3 bushes, 3 ferns, 2 ruins); the giants are hand-placed (GIANT_X) for this frame's gap.
- The statue and the log platforms are not in the proposal frame (they are painted; see the other cameras).
- The mission-select card still draws the old jungle (it calls level1.js's private functions).
