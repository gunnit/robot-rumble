# Mission 5 proposal frame: AREA 3 SPACE WALK (key: space)

STATUS: DONE. `space.png` (1440x810) = round 9, rendered twice with the command below: identical file (same md5),
`errors: []`, `warnings: []`. Scratch renders r1..r9 and the working log are in `tools/m5/space/`.

## Render command (exact)
    cd /Users/macbookair/game
    node tools/harness/harness.mjs render --level 5 --x 4088 --frames 90 --hero 0 --god --scale 3 \
      --extra proposals/level5/kit.js --extra proposals/level5/space/scene.js --out proposals/level5/space/space.png

`--frames 90` matters: the scene's blinks are authored round frame 90 (`F0`), so every warning lamp, both `!` marks
and the meteor ring are "on" in the picture. Camera x 3900, hero x 4088.

## What the frame shows
Outside, on top of the mothership, in open space. Ines flies the stolen **MINI UFO** in the middle of the frame.
- **The Earth** fills the lower left: a real globe (Europe, the Mediterranean, North Africa, a storm spiral off
  Scotland), the evening line with city lights on the right, a thin blue rim of air. A small pink ping blinks on
  **Vigo**: home, where the cows were taken from. A small Moon above it. Near-black violet space, stars in three
  sizes, a faint violet nebula band, two shooting stars.
- **The hull is the ground**: a metal deck with a bright top edge, hazard plates, a magenta guide strip, portholes
  (an oggle peeks out of one), a plaque in alien glyphs, a round service hatch, pipes. On the deck behind the play
  lane: a lattice tower with a red beacon, a hatch dome, a vent puffing gas, a big dish aimed at the Earth, two
  solar panels, lamp posts with cyan lamps.
- **The rest of the ship, far away** (dark blue-violet): the hull's long back, the STAR GARDEN's glass dome (pink:
  where we came from), a tower with lit windows, and the big **engine fin** with the robots' eye emblem and a beacon.
- **The MINI UFO**: silver-white saucer, red stripe round the rim, a yellow star sticker on the bowl, a red toy tail
  fin, a clear glass bubble with Ines inside (drawn with `drawHero`, hand on a stick with a red knob). Its nose
  blaster fires **yellow** laser bolts; its **cyan** grab beam holds a roly eye lifted off the deck.
- **Robots** (the kit's, posed): eye saucer A bursts under the laser (star flash, the dome blown up, the wings
  apart, the eye pod dropping with a black X, "200"); saucer B is in its warning (lamp white, eye yellow, red `!`);
  saucer C cruises; three more are tiny in the distance. An oggle on the deck wears a glass bubble helmet and is
  clipped to the hull by an orange safety line. A roly eye rolls on the deck at the left.
- **A meteor** comes in from the upper right; a blinking red and yellow ring, a dotted line and a big red `!` mark
  where it will land.
- **The rescue**: a cow in a glass pod on the right, `MOO!`.
- HUD: INES, 3 hearts, X3; the ride panel `MINI UFO`, 5 armour pips (4 lit), the cyan beam-charge bar; score 0098400.
  The banner `AREA 3: SPACE WALK` is held.

## How the area would play (x 3300 - 5000)
- **Start on foot**: out of the garden's airlock onto the hull. Jumps are floaty (low gravity). Oggles in bubble
  helmets walk the deck on safety lines. After one screen: the MINI UFO parked on a hazard pad (`PROP_TYPES.miniufo`).
- **The MINI UFO** (`RIDES.miniufo`): arrows fly it in eight directions above the deck. X fires the nose blaster
  (yellow bolts, forward). Hold C over a small robot, a crate or a small meteor: the cyan beam lifts it; let go and
  it is thrown forward in an arc and bursts on what it hits (a roly eye is the best ammunition). The beam drains its
  charge bar in about 3 s and refills when off. Five armour pips; at zero the UFO pops, Ines drops out unhurt for 2 s
  and fights on foot until the next parked UFO. Down + Z gets out.
- **Robots and their warnings**: eye saucers come in formations of three from the right; before a dive or a ring
  shot the antenna lamp blinks white, the eye turns yellow and a red `!` shows. Oggles on the deck raise the ray
  gun, the tip glows and the `!` shows before a slow green ring. Roly eyes hop on the spot with sparks and a `!`
  before they charge. Grabbing a helmeted oggle stretches its safety line until it snaps.
- **Meteors**: a blinking ring, a dotted line and a `!` mark the spot about a second before impact. They hurt robots
  too, so luring a robot under one is a trick. Small ones can be caught with the beam and thrown.
- **Rescue and the way out**: two cow pods on the hull (shoot or touch a pod: the cow floats off in a bubble,
  "MOO! THANK YOU!", and drops a heart). One camera lock with a saucer squadron. The area ends at the bridge
  tower's airlock at x 5000: the UFO is too big for the door.

## How the scene.js works
- One block; nothing global except registry entries: `RIDES.miniufo`, `PROP_TYPES.miniufo`,
  `ENEMY_TYPES.m5ssaucer / m5soggle / m5sroly`, `EB_TYPES.m5smeteor`, `POW_KINDS.m5scow`, and `LEVELS.push`
  (MISSION 5, ALIEN MOTHERSHIP, end 6400, the four sections).
- Design coordinates are screen coordinates at camera 3900. Static art is painted once into Int32 buffers with the
  kit's `M5.px` helpers and baked: space (0.006), Earth (0.015) + a soft halo, far ship A (0.08) and B (0.2), the
  deck's back row and the deck (world), foreground (1.25). `dithS` = ordered dithering with narrow bands.
- The Earth is an orthographic globe: centre (10, 350), radius 260, the point under the camera at 8 S 20 W, north
  up. Coastlines are lon/lat polygons (Iberia, Europe, Scandinavia, Britain, Ireland, Iceland, Africa, islands;
  the Black Sea and the Caspian cut out). Lit from the left; a 20 px dithered evening line; city lights by hash.
- `load()` boards the ride and adds the posed robots; `update()` pins camera, score, banner, the two bolts, the
  burst particles, the "200" and the meteor every frame, so the same command gives the same picture.
- No `Math.random` / `rand` in the scene; motion comes from the scene clock `T` and `hsh`.

## Kit notes (nothing blocked; worked round in the scene, kit.js untouched)
- `POW_KINDS.cow` blinks its bubble on `o.t`, so it can be off at the picture frame: the scene has its own
  `m5scow` that calls `M5.pod` + `M5.bubble`.
- The kit's posed enemies animate on `G.t`: the scene's own posed types pass fixed clocks so the `!` and the
  yellow eye are on.
- The saucer has no hit or burst pose: the burst is the kit's saucer drawn four times through clip rects.
- The pod's glass is tinted green (kit): the only green in the frame that is not a robot.

## Still weak (honest)
- The right third is crowded: meteor, fin, pod, bubble, solar panels and the landing marker sit close together.
- Saucer A's burst is small. At sheet size it reads as a star flash with green bits; the X-eyed pod is found on a
  second look.
- The laser is two short bolts, and the first is half hidden by the muzzle flash.
- The Earth's land is tan and ochre (green is reserved), so Europe is brown. Clouds are streaks, not puffs. The
  globe's perspective squashes the map: Iberia is about 35 px wide.
- The bright sand and clouds of the Earth sit behind the left of the play lane: brighter than the brief's
  "background darker" rule. The roly eye there still reads, a robot in front of the white clouds would read less.
- The dome is closed clear glass. The brief said "open glass bubble": I read that as see-through. Ines sits upright
  in the idle pose with her pistol clipped away; the UFO does not tilt.
- The hull's side (the bottom fifth) is plain plating; the foreground is two dark shapes.
- The fin's base is hidden by the pod and its bubble; the engine under it does not show.
- Scenery is lit from the left (the sun); the engine's hero and the kit's robots are lit from the front and above.
- A staged frame: `RIDES.miniufo.update` only holds the pose; flying, the beam and the throw are not built.
