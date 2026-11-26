STATUS: DONE (7 rounds). base.png, before.png and scene.js are final; errors [] warnings []; two renders pixel-identical.

# Mission 1 repaint mock: FINAL AREA: ROBOT BASE and the MEGA CRAB (key: base)

Files here: scene.js (the --extra fixture), base.png (1440x810), before.png (same camera and frame, no fixture), notes.md.
Scratch (rounds r1-r7, crops, Mission 2/3 references, timeline probe): /Users/macbookair/game/tools/polish/base/

## Final render command (exact)

    node /Users/macbookair/game/tools/harness/harness.mjs render --level 1 --x 4840 --frames 657 --god --scale 3 --extra /Users/macbookair/game/proposals/polish/base/scene.js --out /Users/macbookair/game/proposals/polish/base/base.png

before.png: the same command without `--extra ...scene.js`, `--out .../before.png`.
`--x 4840` builds the mission with the camera on the boss lock (cam = clamp(x - 201.6, 0, 4620) = 4620), so screen x = world x - 4620.
Other frames worth a look with the same command: `--frames 45` (door half open: shutter, BAY 01, sparks, WARNING),
`--frames 395` (the crab's claw open, orbs flying), and the approach: `--x 4480 --frames 230`, `--x 4640 --frames 230`.

## What the frame shows
- Real engine: HUD (INES, H.M.G. 136, score), MEGA CRAB bar at 71%, the crab out of its hangar, three target markers on
  the deck (one red with "!"), three missiles coming down (sky, wall, just above the first marker), the hero mid-jump
  firing the heavy machine gun (muzzle flash, tracers, casings, sparks on the claw).
- Sky: indigo to violet to a last orange and gold band, cloud banks lit from below, stars, a crescent moon.
- Skyline: far cooling towers with pink plumes, chimneys and pylons in haze; the factory (saw-tooth halls, a big stack,
  silos, a water tower, a control block with lit windows, searchlight towers with sweeping beams, a crane); a guyed
  radio mast with red lights; a patrol blimp.
- The wall: riveted plates under three floodlights, ribs with red warning lamps, cable tray, steel and copper pipes with
  a hand wheel, gauge and steam nozzles, a fan vent, a console with two live screens, a warning monitor showing a crab,
  a pressure tank, a chain hoist, a NO HUMANS sign over a workbench (toolbox, oil can, spare soldier head), stencilled
  bay numbers, chase lights along a conduit; on top a catwalk with hazard lip, railing, a turning radar, loudspeakers.
- The door: gatehouse with a lit DANGER sign, turning amber beacons, flag; hazard lintel and jambs; the shutter rolled
  up (its steel bottom bar shows); piston rods extended; behind it the hangar: ribs, red lamps, rails, a furnace glow
  that spills red light over the frame and the deck.
- The floor: chequer plate, hazard lip, and under it girders, a long pipe, grates with a furnace glow, machines with
  gauges and status lights, sagging cables. Foreground: hazard bollards with lamps (also barriers and oil drums).

## How scene.js is organised
One block, nothing global. Sections in order:
1. Helpers (copied in spirit from level3_world.js): noise table, colours, Int32 pixel buffers (`buf/put/rect/disc/poly/
   outline/tint/rimLight/stamp/bake/mk/blit`), `strip()` for parallax backdrops, glow and alpha canvases.
2. Palettes and `LIVE` (positions of everything that moves, collected while painting).
3. **Reusable area scenery (static painters, baked once in `build()`):**
   - backdrop strips: `paintSky` (p 0.02), `paintFar` (0.08), `paintMid` (0.22), `paintNear` (0.5); stamps `plume`,
     `coolTower`, `farStack`, `pylon`, `hall`, `block`, `stack`, `lattice`, `searchTower`, `silos`, `waterTower`, `crane`
   - world sprites: `paintWall` (with `steel/plateTone/lightLv` for plates under the floodlights, `sbox`, `hazard`,
     `hpipe`, `handWheel`), `paintInterior`, `paintShutter`, `paintGate`, `paintPipes`, `paintDeck`,
     `paintFrontProps`, `paintFans`, `paintBlimp`
4. **Reusable live drawing:** `paintBG(g, cx)` (screen space), `drawGate`, `drawPipes`, `drawWall` (shutter from
   `G.door`, pistons, sparks, beacons, sign, fans, screens, lamps, steam, hoist, radar, flag), `drawDeck`, `drawFrontBase`.
5. Hooks: `L.drawBG / drawBehind / drawGround / drawFront` wrap the originals. Outside the area they call the
   original. Inside, the original still draws everything that is not the base (the decor list and the grounds list are
   swapped for copies without gate/pipes/wall and without 'metal' during the call); the backdrop crossfades with the
   bridge's sky over the original's own range (camera 3990-4290) through one scratch canvas.
6. Staging (bottom of the file, NOT part of the repaint): only when the mission is built on the boss lock. Gives the
   H.M.G. and a score, puts the hero at screen x 96, makes him jump and fire while airborne (level shots pass under the
   crab's hitbox), step right out of the first target and jump at marker t 66; pins `crab.hitT = 0`, `G.shake = 0` and
   the crab's idle target (screen x 348) so the still is clean. Crab, missiles, markers, door and HUD are the engine's.

Geometry untouched: ground line 232, no platforms in this area, gate 4400, pipes 4440-4580, wall from 4600, door
4980-5120 (140 x 112) driven by `G.door` exactly as before. `drawPlat` is not replaced.

## Per-frame cost
- Backdrop: 4 strip blits, about 60 small fills (stars, lights, smoke puffs), 3 rotated beam sprites, a few glows.
  While the camera is in 3990-4290 the old and the new backdrop are both painted (crossfade).
- World: one 556x184 wall blit, one 782x38 deck blit, the shutter, about 150 small rects, about 10 additive glows.
- No canvases are created after `build()` (first frame that shows the base; the sky strip is the slowest part).
  Live text uses three fixed colours only (the glyph cache is per colour).
- The original `drawWall` calls `rand()` while the door opens; the repaint does not, so the boss's random stream shifts:
  a seeded bot run ends with the same score and hits but a different frame count (8639 vs 8461). No errors.

## Rounds
r1 first full pass - r2 hand wheels (rings read as target markers), puffy plumes, chequer plate, cooler hangar - r3 crab
pinned so the door stays in view - r4 frame 657, sign and workbench, chase lights, steel shutter bar, hangar spill,
blimp - r5 stack smoke, stencils, bot runs - r6 cooling towers with a waist, monitor, catwalk shadow - r7 pressure tank
instead of a second fan, chain hoist.

## Still weak (honest)
- In the fight the skyline is a 50 px band between the HUD and the wall; the boss bar and panels hide most of the
  stack smoke and the searchlight beams. Far things (cooling towers, pylons) only show their tops.
- The wall is a flat front view on an even 80 px grid; its lower half is kept plain and dark for readability and can
  look empty when nothing is fighting in front of it. Plate wear is noise, not designed.
- Hazard stripes everywhere (wall top, lintel, jambs, shutter, floor lip, bollards): on theme, but repetitive.
- Glows, beams, steam and smoke use alpha blending (soft), as Missions 2 and 3 do for light. Lamps do not light the
  characters.
- The hangar is one still painting with a pulsing glow; the shutter with BAY 01 and the sparks are on screen for about
  1.5 s of real play and not in this frame. The claw is closed in this frame (see `--frames 395`).
- The approach (4340-4600) is sanity-checked, not polished: the yard's tanks and containers hide behind fence and
  pipes, the bridge meets the deck abruptly, the crossfade is a plain blend.
- Small animations are 2-4 frames (fan, flag, radar); foreground props are few.
- before.png has no staging, so hero and crab stand differently there; the pins above mean the fight frame is real
  engine output but not an untouched playthrough moment.
