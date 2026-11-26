# Mission 3 proposal: FINAL AREA: THE CRATER (boss MEGA WHALE SHARK)

Owner: boss painter. Files: scene.js (the --extra fixture), notes.md (this), boss.png (final, scale 3).
Scratch renders: H/shots/l3-boss/ (H = the harness folder in the session scratchpad).

## Progress log
- Started: read harness README + engine self-test fixture. Next: engine-api.md, Mission 2 art code, reference renders.
- Round 1 (r1.png): pipeline works (mission 3 pushed, arena lock pre-activated in load(), boss spawned there, hero moved to
  screen x 78 in update(), keys.KeyX held so the H.M.G. fires). Render: --x 5921.6 --frames 40 (camera locks at 5720).
  Problems seen: ledge clipped (ground Pix started at y 190 -> hero floating), mouth too round (reads as a giant eye),
  lake Worley stretched into a zebra pattern, lamps square like train windows, gills look like claw scratches, lava
  streams like ropes, wall veins like lightning, boss bar 100% (make() must set e.max).
  Decisions: 3/4 head so the WIDE mouth faces the hero; robot touches = intake turbine in the throat, armour panels
  (pale seams = the stripes) each with a lamp (= the spots), gill louvres venting steam, lava sheet on the back.
- Round 2 (r2.png): new head = flat broad top + D-shaped wide-open mouth (upper lip arc, lower jaw hanging), comb teeth,
  pale jaw, amber eye behind the near mouth corner, turbine+grille throat, SLUUURP! comic text (like M2's ROAR!).
  Mouth now reads as a mouth, shark is recognisable. Still weak: dithered shading on the armour looks noisy (M2 uses
  clean flat bands), gills read as torn holes, square lamps (quilted mattress), lava streams thin neon lines, steam =
  grey balls, head/body seam step at x~300, lake cracks too uniform/net-like, wall seeps look like dashes, rock tiny.
- Round 3 (r3.png): flat-band shading on the boss (no dithering, like M2), louvred gills, head shading only in front of
  spine u 43 (seam hidden in the first gill), backlit 5-blade intake fan (pixel canvas, rotates), round glowing lamps,
  hex column ledge (walkable top now y 177 so the H.M.G. line at y 158 flies into the mouth), boss box starts inside
  the mouth (sparks land in the throat). Next: jaw is a flat pale slab (needs bands, plate seams, stronger lava light),
  lava tongues too thin, lake = bright giraffe net (needs crack hierarchy, darker crust), rock invisible, add foreground.
- Round 4 (r4.png): jaw plate seams + stronger lava underlight, lake crack hierarchy (dark crust, few bright cracks),
  foreground boulders (drawFront), lava gobs flung off the back. Zoom: mouth is the best part (comb teeth, ribbed
  cavity, spiral fan). Weak: rock reads as a clock face, lava tongues look like stiff pillars, far lake band still
  speckled, raft low contrast, background thinner in detail than M2 -> add robot-base props (catwalk, crane, bunker).
- Round 5 (r5.png): lava tongues trail back (x drifts with depth) and are blobby with crust specks, short ones drip;
  robot base props painted into the backdrop (catwalk + 2 blinking red lamps + pipe on the left wall, crane arm +
  hook + beacon on the right wall); crack glows; angular lava rock; raft with a wake. Weak: bunker strip reads as a
  floating tray (replace with a blast door at the shore), lava pulled into the mouth is a dotted line (make a ribbon),
  far lake band still speckled.
- Rounds 6-8 (r6-r8.png): lava waterspout (a tongue of lava sucked up off the lake over the lower lip, breaking into
  drops toward the throat); blast door with hazard lintel + slit windows set into a dark arch in the far wall; eyes
  are amber camera lenses with the pupil turned toward the hero (goofy); heat cracks on the ledge columns; first lava
  tongue moved behind the gill steam; SLUUURP! moved right above the mouth; far pectoral fin under the jaw.
  r8 copied to boss.png as a safe intermediate.

## Render command (final)
node H/harness.mjs render --html /Users/macbookair/game/proposals/level3/base.html --level 3 --x 5921.6 --frames 40 \
  --hero 1 --scale 3 --extra /Users/macbookair/game/proposals/level3/boss/scene.js \
  --out /Users/macbookair/game/proposals/level3/boss/boss.png
(H = /private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness)
- Rounds 9-10: armour glints (4-point twinkles on the head top, fin and back), golden lava underlight (WARM #dc6e2a),
  brighter rock (lit facets + a rim lit by the mouth glow). FINAL = r10, rendered straight to boss.png; a second
  render diffed pixel-identical (deterministic). 1440x810, errors [] warnings [].

## FINAL STATE (done)
boss.png = the command above. scene.js is self-contained (only registers ENEMY_TYPES.megawhaleshark and pushes
LEVELS[2] "MISSION 3 / VOLCANO ISLAND" with the four area names; the boss lock is pre-activated in load()).

## How the MEGA WHALE SHARK would play (design notes)
- Entrance: bubbles and a glowing fin wake circle the lava lake, WARNING, then it breaches with lava sheeting off its back.
- VACUUM (this frame): tell = mouth gapes, throat glows white and the intake fan spins up (rising whine), gills vent
  steam, ~1 s. Then ~2.5 s of suction: air streaks, embers, a lava waterspout, loose rocks and the floating rafts are
  dragged toward the mouth and the hero is pulled ~0.6 px/frame (walk/jump away, stay on the ledge). Touching the
  mouth = hit. Reward: the open throat is the weak spot (double damage; a grenade sucked in = big hit + "BURP!").
- ROCK SPIT: mouth shuts, cheeks bulge, glow leaks through the lips, then "PTOO!" 3 lava rocks in arcs; landing spots
  blink first (red ring + "!", like Mission 1's markers); rocks are shootable.
- DIVE: sinks, only the dorsal fin cuts the lava with a glowing wake; a ring of bubbles + growing glow marks where it
  breaches next (under the rafts) -> get back on the ledge.
- Phase 2 (<50%): plates pop off, a glowing core shows on its flank, stronger/longer vacuum, gill steam jets you duck.
- Defeat: a swallowed rock jams the fan (sparks, coughing smoke), lamps go out one by one, plates and bolts burst
  off, it sinks with a huge burp of bolts.

## Weak / not done
- Walls are flat-shaded column blocks with few props: less fine texture than Mission 2's backgrounds.
- Foreground lake crack network is a bit uniform (net-like); far band still slightly busy.
- Pale lava-lit jaw is a big plain wedge that competes a little with the mouth.
- Steam = soft discs (cotton-ball), mouth cavity/glows use anti-aliased canvas paths (slightly soft vs pure pixels).
- Rear body lamp grid is regular (robot panels) and reads a little like windows.
- The shark is ONE static painted pose; a playable boss needs a part rig (head/jaw/body/fins) like the bear.
- Engine aims are fwd/up/down only, so Mathias fires level into the mouth, not diagonally "up at it".

## Art director pass (Nov 3)
- The pale near pectoral fin pointing down-forward into the lava plus the far fin under the chin read as two LEGS.
  Far fin removed (FAR_PEC = () => false). Near fin redrawn as a dark spotted sickle sweeping DOWN AND BACK from
  behind the gills: armour bands, a pale leading edge, a rounded root shaded into the flank, a seam with rivets,
  lamps (spots) on it, no lava wash on its top side, a lava-lit band only where it dips in. Its splash and the heat
  in the lake moved to x 377 (PEC_CUT); the splash rim line skips the fin; the lava tongues pass behind it.
- Tried calming the dotted middle band of the lake: no visible gain, reverted (lake unchanged).
- boss.png re-rendered with the command above, still --frames 40 (no errors, no warnings).
