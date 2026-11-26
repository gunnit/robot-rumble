# MISSION 3 proposal: AREA 3 LAVA RIVERS (key: lava)

Mock screenshot painted by the real engine from the snapshot build `proposals/level3/base.html`.
Files I own: `scene.js` (the --extra fixture), `notes.md` (this), `lava.png` (final 1440x810).
Scratch renders: `$H/shots/l3-lava/` (H = harness folder in the session scratchpad). In the scratch folder,
`head.js` + `body.js` are the two halves that make up `scene.js` (`cat head.js body.js > scene.js`). `scene.js` is the
real file; edit it directly if the scratch folder is gone.

## Render command (final, DONE)

```sh
H=/private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness
node $H/harness.mjs render --html /Users/macbookair/game/proposals/level3/base.html --level 3 --x 3501.6 --frames 60 --hero 0 --scale 3 --extra /Users/macbookair/game/proposals/level3/lava/scene.js --out /Users/macbookair/game/proposals/level3/lava/lava.png
```

`--frames 60` matters: the shots (frames 40 and 59), the banner and the poses are timed for it (FRAMES/SHOTS in
scene.js). The render is deterministic: re-running gives a pixel-identical PNG (checked with `harness.mjs diff`), no
errors, no warnings.

## What the frame shows (camera x 3300, hero x 3501.6)

Left to right (screen x): basalt column cluster A (0-66) | gap with the lava fall pouring from a notch in the
back cliff and fin 1 cutting the lava in front of its splash, moving right toward Ines | cluster B (146-238) with
INES on its tallest column (cap y 182), shotgun firing right (second shot, 1 frame old; gun smoke of the first shot
hangs in front, its red shell is falling) | gap with the LEAPING LAVA SHARK (head up-left toward Ines, jaws open on a
glowing furnace throat, red-hot plates, lava dripping off, a lava streamer from its tail down to the crown splash) |
cluster C (324-404) with the lava-bomb landing marker on its top (blinking ring + big '!' + dotted drop line) |
fin 2 moving left with its wake | cluster D at the right edge. Foreground: two dark column stubs at the bottom corners.
Behind: dusk sky (indigo to wine to orange, early stars, flat cloud banks lit gold underneath), palm silhouettes on a
ridge and on the cliff top, the volcano close behind (crater x 300, y 86) erupting (3 lava jets + spray + welling
dome, glow, big ash plume bending right behind the score panel, far bombs), grey-brown ridged slopes lit pink by the
last light on the left, dark old flows, three fresh lava rivers that disappear into the green jungle of its lower
third with smoke, small palms on the jungle edge; a two-tier basalt cliff (fanned entablature over a colonnade) hazy
with heat, glowing orange at its foot. The lava bomb falls from the sky above cluster C (molten cracked rock, fire and
smoke trail, glow). HUD: INES 2 hearts X3, SHOTGUN 22, grenades X7, SCORE 0087350, banner AREA 3: LAVA RIVERS.

## Design decisions

- Layers (parallax): sky 0, volcano + plume 0.06, mid ridge 0.25, cliff wall + lava fall 0.55, playfield 1,
  foreground stubs 1.25. All static layers are pixel buffers baked once; only the fountain, lava fall, wakes, drips,
  bubbles, embers and ash are drawn live (hsh() + G.t, never Math.random).
- Value plan: the near columns are the darkest, outlined things (lit caps = where you can stand); the back cliff is
  hazier/lighter purple and glows orange at its foot so the column silhouettes read against it.
- Hex basalt: 3 faces (lit left, front, dark right), a hexagonal cap seen a little from above with a lit front rim,
  cross joints following the cap outline, chipped corners, lava glowing through the low joints, warm bounce light
  from the river below.
- River: molten orange/yellow with rafts of dark crust whose cracks glow; calm enough that the wakes read on it.
- Robots follow M1/M2: chunky silhouette, 1px OUT outline, 3-tone gunmetal, white belly, rivets/panel seams, one red
  eye lamp in a dark visor, metal teeth; lava-shark accent = a row of red-hot armour plates and a furnace throat.
- The bomb sits in open sky (not on the volcano) so its glow reads, and is tied to its marker by a dotted line.

## How these would play (for the real level)

- LAVA SHARK: swims as a fin with a bright V wake, circling the gaps between columns. Tell before a leap: it slows,
  its wake turns white-hot and a ring of bubbles swells where it will burst out (about 1 s), its eye lamp blinks.
  Then it leaps in an arc over the gap toward the hero's column, jaws open (the throat glows first), dripping lava
  that leaves small burning puddles for a moment on the column caps it passes over. Shoot it in the air (it takes
  several shotgun blasts) or jump over the arc; it splashes back in and comes round again. Destroyed: bursts into
  bolts, hot plates and a fin that sink with a hiss.
- LAVA BOMBS: the volcano rumbles, a blinking red/yellow ring with a big '!' appears on a column cap (or the lava)
  where a bomb will land, then the bomb falls along the dotted line about 1.5 s later and bursts in a small fire
  blast. Bombs are shootable (shotgun pellets break them in the air).
- Columns are one-way platforms of different heights; the river itself hurts (lose a heart, bounce back up).

## Weak points (honest)

- Static mock only: the fins, the leaping shark and the bomb are posed (update holds them); there is no AI, no
  damage logic and no level beyond this one camera spot. Swimming fins have only a fin sprite (no full swim cycle).
- The volcano slopes use dithered noise; up close the ridge texture is a bit grainy next to M2's cleaner shapes.
- The cloud banks are flat stripes with lit bottoms; fine for dusk but less shaped than M2's cumulus.
- Column caps still lean slightly toward "drum" tops at small widths; the hex reads best on the wide columns.
- The smoke wisps where the rivers enter the jungle are small grey blobs.
- The shark's eye and gills are small at 1x; the pose relies on the bend (the arc mapping gives a few jaggy pixels
  on the tail).
- The frame is busy: many bright orange elements compete (lava fall, rivers, fountain, river, shark plates, bomb).

## Progress log

- started: read harness README, engine API, M2 art code (sky Pix buffers, world bake/shade, enemies build/pl/colBody)
- rendered M2 references (x 300, 1500, 3000, 4700, boss 5921.6) into the scratch folder
- r1 (v1 scene.js): everything in place and reading (volcano, plume, sky, palms, cliff wall, lava fall, columns,
  lava river, leaping shark, 2 fins, bomb + marker, Ines firing the shotgun, banner, HUD). Weak: palms look like
  spiders, stratus clouds are flat stripes, back wall and playfield columns merge (same grey), columns don't read as
  hex basalt, fins and wakes too small, bomb lost next to the volcano, lava fall plain, volcano a bit flat/far.
- r2: volcano with ridges + alpenglow, plume as a column, hazy back wall (now separate from the playfield), bomb moved
  into open sky with a dotted drop line to the marker, bigger fins, shark scaled 1.14. Still weak: palms (spiders),
  fountain (candle flame), bomb sprite looks like a face, wall like a plank fence, column caps read as drums.
- r3: two-tier basalt cliff (fanned entablature over a colonnade) with scrub on top, columns with stronger faces and
  chipped joints, fountain as 3 jets + a welling dome + spray, bomb as cracked molten rock, fatter plume, wake ring.
- r4: palms redone as hand-shaped mirrored fronds (now read as palms), puffier clouds, river core colour varies
  instead of dark beads, glowing lava seeping through the low joints of the front columns, broken wake rings,
  foreground column stubs at the bottom corners (parallax 1.25). Next: fin hump reads like a boat hull, lava fall lip
  is a flat bar, jungle band behind the columns is flat noise.
- r5-r9: rivers on the volcano stop at the jungle edge (glow through the canopy + smoke), small palms/crowns on the
  jungle edge (none behind the hero), subtler lava-fall lip + 2 trickles, glow halos behind the leaping shark and the
  bomb, lava bubbles, fin hump without the boat-hull outline + a bright lava collar, calmer river texture (bigger,
  lighter crust rafts with glowing cracks) and bold wakes (thick V arms with dark troughs, chevrons, white-hot trail).
- r10-r12: shark eye = red lamp in a lower visor, throat glows white-hot to orange (furnace), warning sign at scale 2
  above the marker (dotted drop line stops above it), thin leaning smoke wisps; Ines now fires twice (frames 40 and 59
  of 60) so gun smoke from the first shot hangs in front of the muzzle and a red shell is falling; the leaping shark
  has hp 60 so the first volley doesn't kill it (no hit flash left at frame 60). Render must use --frames 60.
- r13 (FINAL): volcano lowered 6px (VY 86) so the fountain sits under the banner, crisp pixel discs instead of
  anti-aliased arcs for the steam and the bomb trail. Final render written to lava.png (identical to r13).

## Art director pass (Nov 3)
- Crater RIMW 20 -> 14 (28 px instead of 40): the same notched stratovolcano silhouette as Shark Bay's (crater about
  a quarter of the cone's height); the fountain dome and the rivers still sit right.
- Cloud banks: rounder, taller puffs (cy - r*0.38, r*1.5 x r*1.22) so they read as clouds, not flat stripes.
- lava.png re-rendered with the command above, still --frames 60 (no errors, no warnings).
