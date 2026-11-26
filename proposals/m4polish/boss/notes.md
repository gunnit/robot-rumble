# MEGA OCTOPUS proposal (painter key `boss`)

Mission 4's final boss, redrawn as a big hand-painted robot octopus at the MEGA WHALE SHARK / MEGA BEAR level.
Only `ENEMY_TYPES.megaoctopus.draw` and `EB_TYPES.oceanArm.draw` (the tentacle strike) are replaced; the boss's
update, box (86x87 around e.x, e.y), timings and attacks are untouched. Nothing in `src/` was edited.

## Files
- `scene.js`: the fixture (one block, nothing global except the two draw hooks and the L.load / L.update wrappers).
- `boss.png`: the tentacle tell, 75% health. The front arm has risen to the row and lies along it, glowing; the row
  is lit (warm band, hazard-striped edges, arrows running toward the hero); TENTACLE! over the boss; the diver has
  ducked under the row with DOWN! under her and is firing bubbles back.
- `boss-low.png`: 20% health, mid-attack. The strike sweeps along the seabed row (jointed arm, cups underneath, a
  snapping claw with a hot lens, speed streaks, bubble wake) while the ink sac swells for the next attack (INK!).
  Damage: cracked dome with a leak, torn panel with sparking wires, hazard-tape X patch, one arm snapped to a sparking
  stub, smoky exhaust, a drooping far eyelid, red stuttering crown lamps, a nervous twitch.
- `boss-ko.png` (extra): beaten 50 frames ago: spiral eyes, worried brows, limp arms, nuts, bolts, a spring and armour
  scales popping off, bubbles, BLUB BLUB!, and a little white flag out of the dome.
- `before.png`: the same command as boss.png without the fixture (today's boss: the small robot octopus at 3x).

## Render commands
    H=/Users/macbookair/game/tools/harness; B=/Users/macbookair/game/proposals/m4polish/boss
    node $H/harness.mjs render --level 4 --x 6130 --frames 240 --god --scale 3 --extra $B/scene.js --out $B/boss.png
    node $H/harness.mjs render --level 4 --x 6140 --frames 240 --god --scale 3 --extra $B/scene.js --out $B/boss-low.png
    node $H/harness.mjs render --level 4 --x 6150 --frames 240 --god --scale 3 --extra $B/scene.js --out $B/boss-ko.png
    node $H/harness.mjs render --level 4 --x 6130 --frames 240 --god --scale 3 --out $B/before.png
`errors` and `warnings` are `[]` for all. Note `--x 6000` does not reach the boss (camera 5798 and the hero doesn't
move); any `--x` from 6122 builds the mission at camera 5920 and the boss arrives 60 frames later.

Composing with the other painters: load boss AFTER deep (and cast), e.g.
    node $H/harness.mjs render --level 4 --x 6130 --frames 240 --god --scale 3 --extra $P/deep/scene.js \
      --extra $P/cast/scene.js --extra $P/boss/scene.js --out boss-in-lair.png
deep's lair staging also triggers at camera 5920 and pins the hero and the boss each frame; boss/scene.js reads its
own stage from the build x before calling the hooks it wraps, then re-pins after them, so the boss moment wins.
Checked: tools/m4polish/boss/combo-6130/6140/6150.png (the boss in deep's round-2 lair with cast's diver).

## How scene.js is organised (reusable art)
- Palette: crimson lacquered armour A0-A7, gunmetal G0-G6, hazard yellow/black, red camera lenses E0-E5, glass,
  pink brain, cream suction cups, violet ink, a violet rim light (abyss bounce) and a navy fade for the far arms.
- `Pix` painter (copied from level3_boss.js): shapes tested on pixel centres, hard 3-6 tone bands with a narrow Bayer
  dither seam, 1px OUT outline, sprite + white hit-flash copy (+ any recoloured copy).
- Painters, run once on first use by `art()`:
  `paintBody(dmg)` (mantle with panel seams and rivets, gunmetal crown with plate seams, vents and lamp sockets, two
  exhaust stacks with hazard rings, hazard collar, dark skirt, chrome eye housings, the bubble nozzle; dmg adds the
  torn panel, tape X, dents), `paintDome(cracked)` (liquid, brain, wires, glass glints, base ring, mast),
  `paintSac(0..3)` (ink sac swell levels), `paintDisc` (shaded arm rings and gunmetal collars at 15 radii, in
  front / far / hot / white variants), `paintCup`, `paintBubble`, `paintClaw(open)`, `paintBits` (defeat debris),
  `paintChevron`, `paintStrip` (the row's hazard edge), and `glowImg` (one radial-gradient sprite per colour).
- Live per frame (only blits and a few pixels): `drawArm` (8 arms; `armPts` gives each its own base angle, tip curl,
  travelling wave and swim pulse; `raise` blends the tell pose: out past the face, along the row, tip coiled;
  `drawChain` draws overlapping plates tip to root, every third a gunmetal collar; `drawCups` along the inside of the
  curl), `lens` + `lids` + `bar` (camera eyes that follow the hero, slanted steel lids for angry / squint / blink,
  brows; flash, dim and spiral modes), the brain's face, pilot light, crown lamps, exhaust bubbles, tells
  (`drawRow`, `drawDodge`, `drawWord`), damage sparks, defeat (`BITS`, bubbles, `drawFlag`), and `drawStrike`.
- `STAGE` block at the end: pins the mock moments only when the mission is built at --x 6130 (tell), 6140 (low),
  6150 (KO) or 6160 (a check frame: the bubble tell with flashing eyes and bubbles gathering in the nozzle).

## Per-frame cost
About 310 drawImage + 380 fillRect calls on the tell frame, no gradients or canvases created per frame (the glow
sprites are baked once per colour). Measured in the headless harness (node-canvas, CPU raster, a busy machine, best
of 20 batches; tools/m4polish/boss/timing.js): tell 1.5 ms, low + strike 1.9 ms, KO 1.5 ms; the eight arms are about
0.8 ms of that. A browser canvas blits faster than this.

## Notes for the real build
- The boss's hit box is unchanged (x-43..x+43, y-67..y+20). The glass dome now rises to y-100, so shots at the dome
  pass over the box; growing the box to y-90 would make the brain hittable (a good weak spot for kids).
- Bubble-fan shots still spawn at e.x-45, e.y-17; the nozzle mouth is at e.x-60, e.y-19 (move the spawn there).
  Ink shots spawn at e.x-12, e.y-14, right on the ink sac's valve, which fits.
- The strike's root follows the boss's front arm socket (the arm hides from the body while it is out). The tell picks
  arm 0 when the hero is left of the boss and arm 4 when the hero is right of it, and the band goes that way.
- `drawRow` + `drawDodge` are the new kid-readable tell: the hint shows only while the hero's box is within 26 px of
  the row, UP! or DOWN! by which side is nearer (and by room to the surface/seabed).

## Still weak (honest)
- The arms are rows of round plates; in motion they should read as tentacles, but in stills the overlapping
  rings look a little like strings of beads, especially the glowing raised arm, where the hot overlay hides the
  gunmetal collars.
- The brain's face in the dome is only a few pixels; the "cute angry brain" reads at 3x, hardly at 1x.
- The ink sac under the eyes can read as a purple nose.
- The tentacle tell band is a soft additive glow (alpha), like Mission 2's light and mist, not strict pixel art.
- At the lowest bob the arm tips reach the seabed and overlap the front corals.
- The defeat is a mock pose: the bits, bubbles and flag run on e.timer but nothing else in the death (sound, the
  sinking/rising of the body, the screen shake) was touched; the update still floats the boss up 0.14 px/frame.
- The crown is gunmetal like deep's lair hatch right behind the boss; it was darkened so the silhouette separates, but
  the two should be checked together once deep's lair is final.
- On a hit the body, dome and arms flash white but the camera lenses stay red (on purpose, so the eyes stay readable).
