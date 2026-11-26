# MISSION 3 VOLCANO ISLAND - art director notes

Owner: art director. I own proposals/level3/{director,bay,jungle,lava,boss}/ plus
proposals/level3/proposal-sheet.png and proposals/level3/proposal.md. Never touch src/, index.html, docs/, tools/,
base.html, the harness or its fixtures. Max 2 renders at once.

H = /private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness
Scratch renders: H/shots/l3-director/ (m1-*, m2-* references; d-<key>-rN.png director rounds; crops c-*).
Backups of each painter's scene.js before my edits: H/shots/l3-director/orig-<key>-scene.js

## Progress log
- [start] No earlier director work. Read the 4 painter notes, looked at the 4 PNGs, rendered M1 (x1950) and
  M2 (300, 1500, 3000, 3000@170f, 4700, boss@420f) references.
- [r0] Re-rendered all four with the painters' commands: pixel-identical to their PNGs (diff same:true).
  Side by side (cmp-four-orig.png) the four read as one island: morning bay -> late-morning jungle -> dusk lava ->
  night crater, same volcano idea, same HUD/banner, alternating heroes. Problems found:
  1. BOSS: the pale near pectoral fin (pointing down-forward into the lava) + the far fin under the chin read as
     two LEGS (whale shark standing in the lava). Biggest read problem of the set.
  2. JUNGLE score 0045700 is LOWER than the bay's 0046850 (scores must climb through the level).
  3. JUNGLE: the waterfall is pale on a pale cliff: reads as a light pillar in the middle of the frame.
  4. LAVA: flat stripe clouds; BAY: leap trail mostly vertical (low priority).
- [r1] BOSS: far fin removed (FAR_PEC = () => false), near fin redrawn as a dark spotted sickle sweeping DOWN and
  BACK (armour bands, pale leading edge, seam + rivets, lamps on it, lava rim only where it dips in, no warm wash on
  its top), splash + heat moved to x 377 (PEC_CUT), the rim line skips the fin, lava tongues pass behind it.
  Result r1-boss.png: reads as a fin, the head is lifted out of the lava, no more legs.
  JUNGLE: score 45700 -> 61200.
- [r1] JUNGLE waterfall: teal edges, darker inner band, pale core, white + blue streaks, a lip at the top; the
  cascade into the pond matches. Reads as water now. LAVA clouds: rounder, taller puffs (cy - r*0.38, r*1.5 x r*1.22).
- [r2] LAVA volcano: crater RIMW 20 -> 14 (28 px wide instead of 40): same notched stratovolcano silhouette as
  the bay's (crater ~1/4 of the cone's height), the fountain dome and rivers still sit right.
  BAY: the leap trail is now a quadratic arc (splash -> bows right -> curls over into the tail): reads as a leap.
- [r3] BAY turtle: green shell with yellow-lit scutes and paler skin (was olive-brown like the pier): now reads as
  a sea turtle behind the bars.
- [r4] BOSS fin root: the fin's top edge was a straight dark line (looked like a plate stuck on the body); now the
  root is a rounded curve shaded S2 (grown out of the flank), the dark S0/S1 edge only on the trailing side.
- [r5/r6] BOSS lake: tried calming the dotted middle/far band of the lava lake (wider far cracks, then no sub-pixel
  hair cracks). No visible gain at 1x/2x (the dashes are shallow 1px crack lines in perspective), so REVERTED to
  the painter's lake (boss scene.js = the r4 state, saved as H/shots/l3-director/boss-scene-r4.js).
- [finals] All four re-rendered to their painters' paths with the painters' own commands (below); each is
  pixel-identical to the round I reviewed (harness diff same:true). No errors, no warnings.
- [sheet] director/sheet.mjs composes proposals/level3/proposal-sheet.png (2000x1438): 2x2 grid, each frame 960x540
  (nearest-neighbour 3x -> 2x, every game pixel exactly 2x2), thin dark border with a 1px steel line, a title band in
  the game's MISSION START! style (yellow rules, yellow 5x7 pixel font at x7), caption = area name (x3, yellow) + two
  lines (x2, white) in the same pixel font (glyph table copied from the game's text()).
- [director.png] = the director's pick, the AREA 1 frame (it shows the island, the volcano, a robot shark, the
  jet-ski and a rescue in one picture), rendered by the real engine; identical to bay/bay.png.

## Render commands (exact)
    H=/private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness
    B=/Users/macbookair/game/proposals/level3/base.html; P=/Users/macbookair/game/proposals/level3
    node $H/harness.mjs render --html $B --level 3 --x 750 --frames 150 --hero 0 --scale 3 --extra $P/bay/scene.js --out $P/bay/bay.png
    node $H/harness.mjs render --html $B --level 3 --x 1201.6 --frames 150 --hero 1 --scale 3 --extra $P/jungle/scene.js --out $P/jungle/jungle.png
    node $H/harness.mjs render --html $B --level 3 --x 3501.6 --frames 60 --hero 0 --scale 3 --extra $P/lava/scene.js --out $P/lava/lava.png
    node $H/harness.mjs render --html $B --level 3 --x 5921.6 --frames 40 --hero 1 --scale 3 --extra $P/boss/scene.js --out $P/boss/boss.png
    node $H/harness.mjs render --html $B --level 3 --x 750 --frames 150 --hero 0 --scale 3 --extra $P/bay/scene.js --out $P/director/director.png
    node $P/director/sheet.mjs          # -> $P/proposal-sheet.png (reads the four PNGs above)
(--frames matters: lava is timed for 60, boss for 40, bay and jungle for 150.)

Also written: proposals/level3/proposal.md (for the parent: areas, robots + warnings, boss, rescues, jet-ski, music,
open choices) and a short "Art director pass" section at the end of each painter's notes.md.

## STATUS: DONE (all deliverables written and checked with Read)

## Still weak (honest)
- All four are posed mock-ups: every robot holds its pose in update(), nothing is playable, and each scene.js only
  builds its own screen. The real level still needs AI for sharks, bees, hive, frogs, lava sharks and bombs, the
  jet-ski logic, and a part rig for the MEGA WHALE SHARK like the bear's.
- JUNGLE: the misty middle (cliff, mist) is still pale and soft. The sitting frog is small for a headline robot.
  The volcano is half hidden by the swarm and the banner.
- LAVA: lots of competing bright orange. The lava sharks' fins are a different design from the bay sharks' fins
  (curved, no beacon), so the two read as cousins more than one model.
- BOSS: the lake's middle band is a field of short crack dashes (the attempt to calm it was reverted). The crater
  walls are plain blocks with neon-like crack lines. The pale jaw is a big wedge. The steam and the mouth cavity
  are soft (alpha discs, anti-aliased paths). The blast door reads as a box.
- BAY: Ines and the jet-ski are small next to the shark, the turtle is small behind the bars, and the leap arc is a
  thin spray line.
- Light: the bay world is lit from the upper left, while the engine's hero sprite is lit from the front right.
