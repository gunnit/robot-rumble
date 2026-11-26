# Mission 5 proposal frame: AREA 1 THE HANGAR (key: hangar)

Mock screenshot of ALIEN MOTHERSHIP, AREA 1: THE HANGAR, rendered by the real engine (real HUD, real Ines sprite,
real pixel font, real H.M.G. shots and particle types, the shared cast from `proposals/level5/kit.js`), 480x270
upscaled 3x. Files here: `scene.js` (the --extra fixture), `hangar.png` (final, 1440x810), `notes.md` (this).
Scratch renders r1..r13 and detail crops: `tools/m5/hangar/`.

## STATUS: DONE (13 renders). Final render command (exact):

    cd /Users/macbookair/game
    node tools/harness/harness.mjs render --level 5 --x 601.6 --frames 30 --hero 0 --god --scale 3 --extra proposals/level5/kit.js --extra proposals/level5/hangar/scene.js --out proposals/level5/hangar/hangar.png

Output: `errors []`, `warnings []`. Rendered twice and diffed: pixel-identical (`{"same":true,"pixels":0}`).
`--x 601.6` puts the camera exactly at x 400 (devStart: camera = x - 201.6), so world x = screen x + 400.
Keep `--frames 30`: the picture is pinned, but the blinking bits (the red !, the aim dots, lamps) are on at frame 30.

## What the frame shows (screen coordinates)
- HUD: INES, 3 hearts, X3; H.M.G. 164, grenades X8; SCORE 0052300. Banner AREA 1: THE HANGAR held at full alpha.
- Right 56%: the BAY MOUTH (x 200-468, y 60-206) in the back wall: steel frame with rivets, the bay door slid open
  into the wall (its toothed amber-and-black edges show on both sides), cyan force-field emitters along the top, a
  hazard-striped threshold with an emitter rail at the lip. Through it: near-black violet space, a faint nebula, stars
  in three sizes (some tinted, a few twinkle), the Moon (small, far right), and the EARTH (centre 346,132, r 66):
  blue marble seen over the Atlantic with Africa (tan Sahara), Europe and Iberia (home), Arabia, cloud swirls, a sun
  glint, lit from the upper left, a dithered dusk band with pink clouds, a dark night side with a few city lights, a
  pale-blue atmosphere line and soft halo. The force field: stepped cyan glow where it meets the frame, energy
  running along the door edges, little arcs between the emitters, sparkles, two slanted sheen bands.
- In the mouth: an EYE SAUCER (kit) coming in with a COW floating up its tractor beam, the cow saying MOO!; three tiny
  far saucers on their way down to the Earth.
- Left 42%: the back wall in blue-violet steel: panels with seams and rivets, bulkhead ribs, a cyan light strip high,
  slack cables, a porthole with stars, a fuel-hose reel (orange hose, nozzle), a plaque with cyan alien glyphs, a wall
  screen showing the oggles' plan (Earth -> cow <- saucer, in ship cyan, their eye emblem in green), a vent, an amber
  chevron sign >>> (the way on).
- The CATWALK (one-way platform, y 156, x -20..196): bright top edge, grating, a truss under it, railing, hanger
  rods to the ceiling girder, a hazard-striped end, three cargo crates left on it, work lamps underneath.
  An OGGLE on it in the 'warn' pose (lamp blinking, yellow eye, red !), aiming down at Ines: a dotted green aim line.
- Under the catwalk, behind the play line: two PARKED MINI SAUCERS (steel-violet, cyan domes, eye lid shut, a Z above
  one: asleep) on amber-and-black landing pads, lit by the work lamps; a fuel valve on the wall (steam) with an orange
  hose to each. A third, empty pad sits at the bay mouth.
- Ceiling: the CRANE on its rail (trolley with hazard band and blinking amber lamp, cables, a two-finger claw)
  carrying a glyph crate.
- The deck (y 232): Ines running and firing the H.M.G. right (muzzle flash, two rounds in flight, shells, heel
  dust); an OGGLE just blown apart (the fireball, its lower half still standing on its boots, the top of the shell
  with antenna flying off, the EYE popped out on its spring, its ray gun and back tank flung away, a "100");
  an OGGLE on a cargo crate in the 'shoot' pose, its green RING on the way to Ines; an OGGLE walking in; on the right
  a COW in a glass pod with the HELP! bubble (the rescue).
- Below: the deck edge (bright 1px top, riveted lip), the deck face with panels, glyph plates, vents and the magenta
  guide strip; dark front kit in the corners (fuel drum, hose coil, warning post with a blinking lamp, a cable).

## How the scene.js works
- One block, nothing global except registry entries: `ENEMY_TYPES.hgtug` (the kit's saucer + beam with the cow in
  it) and `LEVELS.push` (temporary mission 5 'ALIEN MOTHERSHIP', end 6400, the four sections of the brief).
- Static art is painted pixel by pixel into the kit's Int32 buffers and baked once on the first draw: space + Moon,
  Earth, wall, floor, rear (saucers, hoses), deck, catwalk, crates, crane, front corners, the burst's parts.
  The Earth is an orthographic globe: rough continent outlines in (lon, lat), fbm clouds with three spiral storms,
  Lambert light with ordered dither. Gradients are 4x4 Bayer dithers, never canvas gradients.
- Layers: `drawBG` space (parallax 0.02), Earth (0.03), far saucers, force field; `drawBehind` wall, floor, rear,
  light cones, crane; `drawGround` deck; `drawPlat` catwalk + crate; `drawFront` corner kit (1.3); `drawOverlay`
  strip glow, aim dots, steam.
- `update()` pins the hero (pose, weapon, HUD values), the two rounds, the ring, the burst particles, the "100", the
  banner and the pod's bubble every frame; the kit's posed stand-ins hold the robots. Contact 'none', `--god`.
- Deterministic: no Math.random / rand; textures from a private mulberry32 table, motion from `G.t` and `hsh`.

## How the real area would play (x 0-1600)
- OGGLE troopers (3 hits): walk in, stop, WARN (antenna lamp blinks white/red, the eye turns yellow, red !, the gun
  tip glows, and a dotted green aim line shows where the shot will go), then fire ONE slow green ring along that line.
  Sidestep, jump or duck. New here: the aim line, so a shot from above is as readable as a level one.
- The catwalk is a one-way platform reached over cargo crates (crate top 26 px, catwalk 50 px above it; Down+Jump
  drops through). Oggle snipers stand up there and aim down; climb up or shoot up.
- EYE SAUCERS fly in through the bay mouth carrying cows. Shoot the saucer and the cow floats down safely (bonus).
  Its own warning: eye yellow, all rim lamps on, red !, then a short beam pulse straight down that lifts and drops
  the hero. The PARKED saucers sleep on their pads (lid shut, Z); at the alarm the lid opens and the lamp blinks red
  for a second before take-off: pop them on the pad.
- The CRANE hauls crates along the ceiling rail: its lamp blinks amber and a striped shadow appears on the deck one
  second before the claw lets go. A dropped crate becomes a step (and can hold a pick-up).
- The rescue: cows in stasis pods (shoot or touch the glass: MOO! THANK YOU!, the cow drops an item and trots off).
  One alarm lock at the bay mouth with waves from both sides; the way on is the bulkhead under the >>> signs.
- Arrival idea for the intro: the hero is beamed up through the empty pad at the bay mouth, Earth behind.

## Decisions
- H.M.G. rather than the pistol (more Metal Slug, shows the ammo bar).
- The catwalk stops at the bay mouth so the Earth stays unobstructed; in the level it carries on after the mouth.
- The shooter stands on a cargo crate: its ring comes down at Ines on its own line instead of sharing the lane with
  her bullets, and the crate shows "cargo is a platform".
- The saucer and cow are over dark space, left of the Earth: the green beam reads there (on the lit Earth it washed
  out) and the marble stays whole.
- Green stays with the robots: the parked saucers are steel-violet with cyan domes, the Earth's land is tan and
  brown, the plan screen is ship cyan with only the small eye emblem in green.
- The bursting oggle is drawn as cracked egg-shell pieces with the eye on a spring: comic, never scary.
- Unlit markers on the wall base: lit magenta dashes there read as tracer rounds behind the hero.

## Kit notes (nothing blocked; worked around in the scene)
- `M5.oggle` can only aim level: "aiming down" is shown with the eye (it looks at the hero) and my dotted aim line.
- `M5.drone`'s beam is faint on bright backgrounds: I add 1px bright edges to the cone and draw the cow after it.
- `POW_KINDS.cow` shows its bubble only on some frames (`o.t`): the scene pins `o.t = 8` (HELP!).
- `M5.px.ball` wants colour strings, the other helpers take ints or strings.

## Progress log
- r1: first pass. Reads at once (Earth, hazard door edges, green robots). Weak: beam lost on the Earth, crates
  behind the burst, blobby shards, night-side lights like sparks, faint pads, unreadable front corner.
- r2: Earth moved right and whole, saucer + cow over dark space with MOO!, Moon, far saucers, bigger burst, claw
  crane lowered, field accents, thicker pad rings. (A scripted edit wiped the file's middle; rebuilt from notes.)
- r3: rear crates off the bullet lane (now on the catwalk), clear sky over Iberia, front corners redone.
- r4: the plan screen on the wall; burst as cracked shell (lower half standing); wall-base strip unlit.
- r5: shell cap with empty eye socket, parts re-placed, "100" clear of the beam.
- r6: truss under the catwalk, work lamps with flat light cones on the saucers, Z, less haze on the saucers.
- r7: fewer thin clouds on the Sahara, no city lights near the action, energy running along the field's edges.
- r8-r10: slack cables; sheen bands on the field (moved off the Earth).
- r11-r13: hanger rods end at the girder, stray bolt off the ring's lane, flung gun mirrored, tidy-up, final.

## Still weak (honest)
- The left wall is seen flat-on and stays dark; the hangar's depth comes only from the floor band and the mouth.
- The force field is subtle: at 1x it reads as a glowing frame with a glass sheen more than as an energy field.
- The burst's shell pieces are small and its standing lower half is half hidden by the fireball.
- The left of the mouth is crowded (saucer, beam, cow, MOO!, far saucers, the "100" just below).
- The Earth's land is tan/brown by the no-green rule and Iberia is about 6 px: recognisable, not obvious.
- The parked saucers are small and dim next to the play layer; the pads' amber rings are thin in this perspective.
- The catwalk covers only the left 40% of the frame.
- Soft glows, the light cones and the engine's own explosion use alpha blending (not strict pixel art).
- The floor band is painted with a fixed vanishing point: in the real game it needs per-row parallax.
- Nothing is playable: no oggle AI, no crane, no saucer take-off, no level layout beyond this screen.
