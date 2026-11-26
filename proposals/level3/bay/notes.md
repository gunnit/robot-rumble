# Mission 3 proposal frame: AREA 1 SHARK BAY (key: bay)

Owner: this painter. Files: scene.js (the --extra fixture), notes.md, bay.png (final, 1440x810).
Scratch renders: H/shots/l3-bay/ (H = the harness folder in the scratchpad).

## Progress log
- [start] Folder created. Reading engine-api.md, harness README, Mission 2 sources. No earlier attempt existed.

## Decisions
(none yet)

## Render command
(to be filled in)

### Composition plan (round 0)
- Camera fixed at world x 600 (CAM); hero on the jet-ski at world 750 (screen 150), water line y 224 (WL).
- Sun upper-left (84,64); volcano far on the right horizon (peak ~x372 y57), plume drifting right.
- Layers back to front: sky + sun + clouds, FAR strip (volcano, far coast, sea stacks), plume, BAY strip
  (open bay water), LAGOON strip (turquoise), SPIT strip (black-sand spit, palms, fishing hut, nets, canoe).
- Playfield: pier (one-way platform, deck y 192) on the right with the turtle cage (POW kind 'turtle').
- Enemies: ENEMY_TYPES.shark with mode 'leap' (big arc, jaw open, rasterized rotated with implicit shapes so
  1px outlines stay crisp) and mode 'fin' (dorsal fin + underwater shadow; 'warn' adds ripple rings + '!').
- Ride: RIDES.jetski (red, nose gun on a ball mount aimed ~45 deg at the shark, rooster tail, V wake).
- Frame: --frames 150 (MISSION START band gone at 130, area banner still full alpha until 170).

## Round 1 (r1.png) - first full frame renders, no errors
Works: HUD (JET-SKI panel, armour pips, torpedoes), banner, sun, sky, hut, palms, pier + cage, volcano shape.
Weak: leaping shark too small, tail lobe vertical (bend + rotation), mouth muddled; fins show the tail lobe as a
second fin; jet-ski reads as a dinghy (bulb hood, box seat) and its gun is a cannon; tracer stream barely visible;
turtle unreadable in the cage; volcano gullies look like tent stripes; palms at x320/343 cover the volcano foot;
lagoon foreground empty; spit beach thin.

## Round 2-4 (r2..r4.png)
- Shark rebuilt bigger (84 px, SHK shapes), bend 0.0034, angle 0.36 rad, jaw 0.62 rad; 5-tone back shading,
  dark maroon mouth with a glowing throat so the white teeth pop; darker steel lower jaw; bigger dorsal beacon.
  Moved up to world (848,106) so it reads against the cloud/sky, splash at world 904, water arc trail.
- Fins: tail lobe removed above the water (material 11 cut); fin cut at v=-13; '!' at scale 2; stronger rings.
- Jet-ski redesigned: hull + white boot stripe + bolt decal + riveted bow plate, saddle, console pod with
  windscreen, sloping hood with vents and lamp, compact nose gun at 0.88 rad (fires every 3 frames at 6.5 px/f).
- Turtle: olive-brown shell, grey-green skin, head redrawn over the bars.
- Lagoon: caustics, coral domes/staghorn/fan/sea grass, yellow fish; foreground lava rock with a crab, buoy.
TODO next: lagoon surface still flat; black sand looks like TV static; jet-ski needs more spray/wake drama;
volcano gullies still stripy; fin B wake faint; maybe distant robot drones near the volcano (story hint).

## Round 5-7 (r5..r7.png) - bay.png saved from r7 as a safe candidate
- Lagoon: wind patches + arched wavelets with shaded backs; black sand: wind ripples, glints, pebbles, shells,
  driftwood; splash: foam rings + crown of spikes; thick rooster-tail jet; bow spray fan; fin V-wakes.
- Beacon glow cleaned (cross-shaped halo); volcano stripes softened; two far drones circle the volcano (story).

## Round 8-9 (r8, r9.png) - FINAL
- Sea stacks redrawn as weathered pillars with scrub on top (they read as castle towers before); tiny fish are
  real fish shapes now; a faint shadow on the water under the leaping shark.
- bay.png = r9 (pixel-identical re-render, harness diff same:true), 1440x810, errors [] warnings [].

## Render command (exact)
H=/private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness
node $H/harness.mjs render --html /Users/macbookair/game/proposals/level3/base.html --level 3 --x 750 --frames 150 --hero 0 --scale 3 --extra /Users/macbookair/game/proposals/level3/bay/scene.js --out /Users/macbookair/game/proposals/level3/bay/bay.png

## Decisions (why)
- Sun upper-left, volcano right: balances the frame; the volcano's left flank catches warm light, the shadow side
  is cool lilac; heavy haze keeps it far away. A mast with a red light and two tiny drones hint at the robot base.
- Shark rasterized per pixel from shapes at any angle (not a rotated bitmap) so outlines and shading stay crisp.
- The leaping shark sits against the cloud/sky (not the busy spit) and points down-left at the hero; the nose gun
  tracers (every 3 frames) stop on its belly with real engine sparks; shark has 400 hp so it survives the burst.
- Fins: only the dorsal fin above the cut, the rest as a dark shape under the water (a readable "lurking" cue).
- Frame 150: the MISSION START band is gone (130), the AREA 1 banner is still at full alpha (until ~170).
- Score 0046850 carried over from Missions 1-2 (the engine keeps score between missions).
- Round 10 (r10.png): warm sun rim on the leaping shark's top/left edges (back, fins) to sit it in the golden
  morning. bay.png re-rendered from this version with the command above (diff vs r10: same). Previous version
  kept in the scratchpad as scene-r9.js.

## Still weak (honest)
- Jet-ski + Ines are small next to the 84 px shark; the rider is upright (no lean), speed comes from spray/wake.
- The spit is a thin band and the lagoon, though textured, is calmer than Mission 2's dense ground art.
- The leap trail is mostly vertical (reads as water pouring off rather than a long arc).
- The turtle is small and half hidden by the bars (head, eye and shell read; flippers barely).
- Volcano gullies are a little regular; the plume is one painted shape (no live puffs).
- World lit from the upper-left sun while the engine's hero sprite is lit from the front-right.
- Staged frame only: sharks hold their poses, the leaping one has 400 hp, nothing is playable.

## Art director pass (Nov 3)
- Leap trail: a quadratic arc (splash -> bows right -> curls over into the tail) instead of a near-vertical column,
  so the leap reads as a high arc.
- Sea turtle palette: green shell with yellow-lit scutes and paler skin (the olive-brown shell merged with the pier).
- bay.png re-rendered with the command above (no errors, no warnings).
