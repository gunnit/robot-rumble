# Mission 5 proposal: FINAL AREA: THE BRIDGE (boss MEGA OGGLE)

Owner: bridge painter. Files: `scene.js` (the --extra fixture, needs `../kit.js` first), `bridge.png` (final, scale 3,
1440x810), `notes.md` (this). Scratch renders r1-r12 + crops + the working log: `tools/m5/bridge/`.

## Render command (final, deterministic: a second render diffs pixel-identical; errors [] warnings [])
    cd /Users/macbookair/game
    node tools/harness/harness.mjs render --level 5 --x 6200 --frames 40 --hero 1 --god --scale 3 \
      --extra proposals/level5/kit.js --extra proposals/level5/bridge/scene.js \
      --out proposals/level5/bridge/bridge.png
(--x 6200 puts the camera on the boss lock, 5920. Any x from 6122 up gives the same frame.)

## What the frame shows
The bridge of the mothership, mid-fight. HUD: MATHIAS, H.M.G. 118, score 0204650, boss bar MEGA OGGLE 87%.
- **MEGA OGGLE** (right, 188 px wide with its skirt, 168 px tall with its crown): a heavy bell of green armour plates
  (seams with lit lips, rivets, a hatch, louvres, dings from the fight) standing in a saucer skirt (steel rim with
  chasing amber lamps, three thrusters with green flames over a hazard-striped pad). ONE enormous eye: a thick steel
  bezel with bolts, a 48 px white lens, a red iris inside a steel camera-shutter ring, armoured lids above and below
  (slats) and a heavy brow plate tilted down toward the hero (grumpy). A grille mouth with the corners turned down and a
  furnace glowing behind the bars, set in a raised muzzle plate. A crown of three springy antennae with amber lamps.
  The captain's kit: a tiny white cap with a navy band, gold badge and black visor, gold epaulettes on its steel ball
  shoulders, three medals on its chest. A red comic anger mark throbs on its temple.
- **EYE BEAM**: the iris is white-hot and fires a thick green-and-white beam down to the deck (pulses run along it,
  motes drift off it), a white splash and sparks where it hits, a glowing track on the deck where it has swept, the
  comic word **ZAAAP!** stepping up along the beam.
- **Mathias** at the top of his jump over the beam (speed lines under his boots), firing the H.M.G. level into the
  eye: four tracers and a star of sparks on the lens (the weak spot).
- **TRACTOR DROP**: the left cable arm arcs over the top of the screen; its claw holds a cow pod in a green tractor
  cone. A dotted red line drops from it to a blinking red ring + red ! on the deck: that is where it will land.
  The right claw is raised and snapping.
- **The bridge**: a panoramic window with chamfered panes and bevelled struts (cyan lamps), the Earth (blue marble,
  cloud swirls, sand-coloured land so no green, city lights on the night side, a pale atmosphere rim), the Moon, two
  tiny eye saucers hauling cows up from the Earth. Under the sill: dark consoles with glyph screens (two show the
  green eye mark), a wall display counting stolen cows, a cyan holographic globe with magenta target marks, a locked
  hazard door on the left, the captain's throne (gold trim, eye mark) on its podium on the right, a glyph plaque on the
  ceiling beam. Magenta guide strips low, a cyan strip high. Foreground: the backs of the near stations, and two of
  the crew cowering behind them with only their eyes showing.
- Green check: the only green things are the boss, its beam / tractor / thruster light, the two tiny saucers, the two
  crew oggles and three small eye marks. Everything else is blue-violet, magenta, cyan, amber.

## How MEGA OGGLE would fight (for 8-10 year olds: every attack warns first and has an obvious escape)
The rule the whole fight teaches: **the open eye is the weak spot** (shots spark on the lens, the bar drops); shots on
the armour go "clank" and do nothing. Its eye always follows the hero (it is looking at you: goofy, not scary).
- **Entrance**: the captain's throne turns round, empty; the cap rises from behind it, then the whole MEGA OGGLE lifts
  off its pad. WARNING band, boss music.
- **EYE BEAM** (this frame). Tell, about 1.2 s: it sinks low, the three antenna lamps light one after the other
  (bip, bip, BIP), the iris turns yellow and the shutter ring closes (the kit's warning look), a thin dotted green
  aiming line shows on the deck at its feet and a red ! over the eye. Then ZAAAP: the beam hits the deck in front of
  the pad and sweeps to the left wall in about 1.5 s. Only the strip of deck it touches hurts.
  Escape: one normal jump as it passes under you (it moves at walking pace), or stand on one of the two console
  platforms (the real arena gets two low one-way platforms, about y 190; the beam passes underneath).
  Reward: while it fires, the eye is wide open: every shot counts double. Jump and shoot = this picture.
- **TRACTOR DROP**. Tell: the left claw reaches up through a ceiling hatch and comes back with a pod in a green cone;
  a red ring + ! follows the hero along the deck for 1 s, then stops and blinks faster for 0.7 s before the claw lets
  go. Escape: walk out of the ring. A steel crate bursts (small splash, shootable in the air). A cow pod cracks
  open instead: the cow is free ("MOO! THANK YOU!", +500) and leaves a heart or ammo, so dodging feeds the rescue count.
  It also targets the console platforms, so you cannot camp on them.
- **EYELIDS SHUT**. After about 12 hits on the eye (or every 10 s) both armoured lids slam shut (CLANK!). Shots
  bounce off with a "PING" and grey sparks, so the kids see at once that shooting is useless now. While shut it uses
  its claws: CLAW SWEEP (tell: the right claw draws back and snaps twice, clack-clack, then rakes along the deck:
  jump it) or it rolls two roly eyes out from under its skirt. After 2.5 s the upper lid lifts a crack and the eye
  peeks (the tell that it is about to open): get ready to shoot.
- **Below half health** (bar turns red): the cap is blown off and it catches it with a claw, steam puffs from the
  louvres, the anger mark stays on, the antenna lamps go red. One lid is jammed half open (it can no longer shut
  completely: more chances, but everything is a little faster): the beam sweeps there AND back (jump twice), it drops
  two pods in a row, and a new SAUCER DASH: the skirt lamps all flash, it backs up to the right wall, then slides
  across the deck (escape: up on a console platform; it bonks the wall and sits dizzy with the eye wide open, 2 s).
- **Defeat** (funny, no explosion of the cows' jailer needed): the iris goes spiral and wobbles, the three lamps
  droop, it spins like a top and the claws let go; every pod on the bridge pops open and the freed cows stampede
  across the deck from right to left, bowling it flat onto its pad; the captain's cap lands on the last cow's head.
  The two crew oggles in the foreground wave little white flags. The hologram shows the Earth with the target marks
  switching off one by one.

## How the scene.js works
- One block; global only: `ENEMY_TYPES.megaoggle` and the `LEVELS.push` (MISSION 5 / ALIEN MOTHERSHIP, end 6400, the
  four sections, boss lock at camera x 5920). `load(cp)` pre-activates the boss lock and spawns the boss in it;
  `update()` pins Mathias in the air (pose, weapon, HUD values, score), four H.M.G. tracers and two shell cases, and
  clears the banner / MISSION START band / WARNING; the boss's own `update()` holds 435 / 500 hp (87 %).
- Design coordinates = screen coordinates with the camera on the lock. Static art is painted once into RGBA pixel
  buffers (`Pix`: inside-test shapes, flat tone bands, 1 px outlines) and baked into canvases in `build()`:
  space (stars, Earth, Moon, tiny saucers), wall (window frame, sill, consoles, podium, door), deck, foreground,
  the boss's body, its two arms with claws, the iris (cold and white-hot), the two lids + brow.
- Live per frame (G.t and hsh only): iris position, lids, lamps, thrusters, beam, splash, tractor cone, pod
  (`M5.pod`), ring + `M5.bang`, ZAAAP!, lens sparks, hologram, console lamps, star twinkles, soft glows (`M5.glow`).
- Layers: `drawBG` space (parallax 0.03) -> `drawBehind` the bridge wall (world) -> `drawGround` the deck ->
  the boss (enemy draw: thrusters, arms, body, eye, pod, beam, ZAAAP!) -> hero, shots -> `drawFront` lens sparks,
  crew, foreground.
- The kit did not block anything. Two things to know: `M5.oggle`'s default look uses the hero's world position, so in
  a screen-space hook (`drawFront`) pass `look` yourself; `M5.bang(x, y, t)` blinks, pass `t = 0` to hold it lit.

## Still weak (honest)
- The body is basically a big ball in ONE static painted pose: a simple silhouette, flat tone bands. A playable boss
  needs a part rig (skirt, body, lids, brow, iris, two arm chains, claws) and a few more faces (blink, hurt, dizzy).
- The beam covers the left third of the eye, so the lens reads as a "D"; the direction of the sweep is only told by
  the glowing track on the deck.
- The captain's podium is mostly hidden behind the boss (only the throne at the right edge and the hazard pad show).
- Background consoles are few and dark, the wall under the window is plain panels; the ceiling is under the HUD.
- Thrusters are small: there are only 7 px between the skirt and the deck.
- The frame has no console platforms yet (the fight notes ask for two); Mathias's jump is at the engine's maximum
  height (53 px), and the engine only aims forward / up / down, so he fires level into the eye.
- The two crew oggles in the foreground could be read as enemies; the tiny saucers by the Earth are very small.
- Glows (beam, splash, thrusters, lamps) are soft radial sprites, softer than the pixel work around them.
- The Earth is large and fairly bright for a background (it does not touch the play lane).
- The cluster ring + ! + ZAAAP! + track near the deck at x 160-270 is busy.
