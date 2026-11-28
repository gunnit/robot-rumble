# Mission 8: DINOSAUR VALLEY (design, as built)

Date: 2026-11-27, brought in line with the build on 2026-11-28. Built on branch `dino-mission-8`, stacked on
`mission-audit-story` (PR 1). Build notes, the test players and the reference numbers: `tools/m8/notes.md`.
The header comment of each `src/level8*.js` file is the exact reference for what that file does.

## Intent

The story of PR 1 ends on a teaser: Mega Oggle's escape pod landed in a hidden valley and "the Oggles are waking up
the dinosaurs". Mission 8 pays that off and closes THE OGGLE CASE FILE. The request was one line: build the dinosaur
mission and make it amazingly good. It is for two children aged 8 to 10 (the heroes, Ines and Mathias).

The pattern of Missions 2 to 4 holds: the Oggles build ROBOT copies of animals and lock up the real ones. So the robot
dinosaurs are the enemies and the real dinosaurs are friends to rescue, and one of them is a friend to ride.

## Goals

- A finale that is clearly the best mission so far: more enemy variety, three mechanics no other mission has
  (a friend to ride who fights, a chase, a boss with a second target), two giants.
- Fair for 8 to 10 year olds: every attack has a tell of 30 frames or more and one clear escape, hearts drop often,
  nothing can soft-lock, and a mistake costs one heart, never the run.
- A story payoff: Mega Oggle is caught, every robot is switched off, the Case File gets its eighth and last clue.
- The same look as the rest of the game: 480x270 pixel art painted by code, original characters only.
- Missions 1 to 7 behave exactly as before (same seed, same bot run).

## Non-goals

- No engine rewrite. One hook was added (`ENEMY_TYPES[type].shield`, see `docs/engine-api.md`); everything else uses
  the hooks that were there (`load`, `update`, `drawHUD`, rides, props, POW kinds, the intro).
- No new art pipeline and no generated images: the scenery and the cast are painted by code, like Missions 1 to 5.
- No gating: Mission 8 is selectable from the start like every other mission.

## Anti-goals

- Hurting a real dinosaur. TOPS never "dies": tired, she trots ahead and waits; at the hatchery's gate she stays behind
  and comes back to cheer at the end.
- Instant deaths, blind jumps, or a chase that punishes a slow reader.

## The rules the whole mission keeps

- **No hit without its tell.** A robot's eye turns yellow and a red `!` shows before every attack. A compy or a
  raptor hurts only in its hop or pounce; a robot that runs in at the screen's edge cannot hurt by running into the hero.
- **A ring on the ground marks where something lands** (eggs, spit, spikes, a tail slam, a pounce, falling rocks).
  Rings are painted last, on top of everything, so nothing ever hides one.
- **Every escape works a quarter of a second late.** For each attack the escape the game teaches is tested in the
  real game, begun 15 frames after its warning shows (`tools/m8/paths-test.mjs dodge`).
- **Giants glint, they do not flash.** A robot flashes white when hit; a giant under steady fire would be white all
  the time and its warnings could not be read, so it only glints (a short white tint, three times a second at most).
- **A giant's arena holds the giant and nothing else.** When WARNING shows, every small robot that is not part of
  that lock clears off (walking ones run off the screen, flying ones climb away).
- **Hearts.** A robot beaten while the hero is on his last heart leaves a heart, at most one every 20 seconds.
  CLUBTAIL throws one at every wall crash, the OGGLE REX at two thirds and at one third of its health.

## The mission

Six areas, 7860 px, about three and a half minutes, from dawn at the crash site to night on the launch pad.
It opens with a scene of 4.6 seconds (Enter skips it): a baby dinosaur runs to the hero with a little robot after it,
the hero ducks and shoots the robot while its eye is yellow. That is the one new thing the mission asks of a player
(a standing shot flies over the little robots), shown before it is needed; the first real pack brings the tip
DUCK TO SHOOT THE LITTLE ONES! once more.

| Area | x | What is new there |
|---|---|---|
| 1 CRASH SITE | 0 | The smoking escape pod. A pack of COMPYS, the first RAPTOR, and in the camera lock the first robot in the sky |
| 2 LONG-NECK LAGOON | 1450 | Wading through two pools, a SPITTER on the island, a SWOOPER over the water, an ambush; a lock with everything so far |
| 3 BONE CANYON | 2900 | Ledges, two tar pits (sticky), then the mini-boss CLUBTAIL, who guards the cage of TOPS the triceratops |
| 4 REX RUN! | 4300 | Ride TOPS (horns, CHARGE through boulder walls) while the OGGLE REX hunts from the left, to the log bridge |
| 5 ROBO HATCHERY | 5700 | The Oggles' base: troopers from Mission 5, robot NESTS that hatch compys, a lock that ends when the nests are scrap |
| 6 OGGLE REX | 7100 | The final boss on the launch pad, piloted by Mega Oggle from the glass eye in its head |

### Robot dinosaurs (`src/level8_enemies.js`)

- `compy`: hp 1, 13 px tall. Runs at the hero in packs, crouches 30 frames, hops. Crouch to shoot it, or let the knife do it.
- `raptor`: hp 3. Runs up and crouches 36 frames (54 the first time). From the first frame of the crouch a ring marks
  its spot, where the hero stands at that moment; then it pounces on the ring, and only there does the pounce hurt.
  Step out of the ring, back or on under the raptor as it flies. Some wait in a bush (two red blinks give them away).
- `ptero`, bomber: hp 2. Flies over with one egg, a ring shows where it lands 30 frames or more before the drop, the
  egg can be shot. Shoot straight up as it passes. After its third pass over the screen it flies home, egg or no egg.
- `ptero`, swooper: hp 2. Hovers low, shows its dotted path for 48 frames (bold dots with a dark rim, readable on
  water, sand and leaves), dives and skims the ground at chest height. Ducking does not help: jump over it or shoot
  it. Then it sits out of breath for 90 frames.
- `spitter`: hp 4. Keeps its distance, opens its frill for 40 frames, lobs one glowing blob at a ringed spot. Step aside.
- `robonest`: hp 8, solid. Hatches a compy every 210 frames (two alive at most) until it is destroyed.
- `boulderwall`: hp 8, solid, too tall to jump: shoot it, bomb it, or ram it with TOPS.
- `oggle`: Mission 5's trooper, unchanged, in the hatchery.

### CLUBTAIL (mini-boss, robot ankylosaur, hp 56, about 20 seconds)

Three attacks, always in the same order: TAIL SLAM (a ground wave both ways: jump), SPIKES (three come down on ringed
spots: stand between them), ROLL-OUT (she rolls across the arena: jump over her). She hits the wall and lies DIZZY for
150 frames, when every hit counts double. Her armour lets only 10 hit points through per attack, so no gun ends the
fight before her first roll and the dizzy spell is where the fight is won. Her body is solid and harmless; only the
rolling ball and what she throws hurt. The cage is the right wall of her arena for her and for the hero.
Beating her opens the cage. The fight is a checkpoint of its own.

### TOPS (the ride, `src/level8_gear.js`)

A real young triceratops. Walk into her to get on. X: HORNS (4 damage up to 60 px ahead). Up + X: the hero shoots
straight up from the saddle. C: CHARGE (45 frames, 8 damage to every robot in the way, boulder walls fall at once,
nothing can hurt her meanwhile; then she needs 2.5 seconds). Z: hop. Down + Z: get off. Small robots under her feet are
trampled. Four hits tire her out: she throws the hero off unhurt, runs 240 px ahead and waits with two pips back.
TOPS is never lost: a hero who gets off and walks on is followed (she trots after him before the screen leaves her
behind, and waits ahead). She will not pass the hatchery's gate.

### The chase (`src/level8_chase.js`)

From x 4560 the OGGLE REX's head is at the left edge of the screen. It cannot be hurt and is not an enemy (so nothing
aims at it). While the hero makes headway it only follows; when the screen stands still it creeps up and BITES after a
tell of 40 frames with a marked strip on the ground. The strip stays where it was marked, so whoever runs on leaves it
and the bite misses (11 frames of running are enough on foot, 8 on TOPS). A bite costs a heart (or one of TOPS's
pips), throws the hero ahead and smashes a boulder wall in the way, so nobody is ever stuck. Its steps shake rocks loose onto ringed spots
where the hero stood a second before. The chase ends on the log bridge: it cracks under the Rex, and the crash bursts
the lock of the hatchery's gate.

### OGGLE REX (final boss, hp 300, about 40 seconds)

A giant robot T-Rex. STOMP (a ground wave to jump and falling rocks on ringed spots), CHOMP (a striped strip on the
ground follows the hero, then stays: get off it; the head sticks in the ground for 96 frames with the eye at gun
height), from two thirds of its health EYE BEAM (a dotted line, then a beam at a standing hero's head: duck), and in
the last third it roars compys out of its chest hatch. Its body takes plain damage, so nobody is ever stuck; its one
eye, the cockpit, passes every hit on doubled. Hearts at two thirds and one third. After a continue it comes back
with the health it had, at most 75 %. Beaten, it falls apart, the dome pops and tiny Mega Oggle lands in the dust
with his MASTER SWITCH; TOPS and the freed babies run in to cheer.

### Rescues, weapon, music

- Eight hatchlings in Oggle cages (`POW_KINDS.hatchling`, four looks), `freedLabel: 'DINOSAURS FREED'`.
- DINO-RANG (item `D`): a bone boomerang that flies out about 110 px and comes back, hitting every robot once each way.
- Five tunes (`src/level8_music.js`): the valley, the chase, CLUBTAIL, the OGGLE REX (Mega Oggle's march from Mission 5
  comes back, answered by the valley's call) and the dawn. `node tools/m8/music-check.mjs` checks bar counts and
  clashes between tune and bass. Nobody has listened to them yet: they were written from theory and checked by rule.

## Story (`src/story.js`, pictures in `src/level8_story.js`)

- Clue 8: MASTER SWITCH. Mission 8's briefing follows the POD TRACKER of Mission 7.
- Mission 7 is no longer the last mission. Its win leads to a bridge card (the valley), then to Mission 8's briefing.
- Mission 8's win leads to the ending card (morning at the lagoon: the robots sleep where the switch caught them),
  then ALL MISSIONS COMPLETE, and with all eight clues CASE CLOSED: Mega Oggle has a new job, dinosaur babysitter.

## Approaches considered

1. **Code-painted art with a private pixel kit (chosen).** Same method as Missions 1 to 5, no binary assets, small
   diff, animations are cheap because every frame is painted from pose numbers. Costs: the most code.
2. **Embedded paintings like Missions 6 and 7.** Fast for backdrops, but about 1.5 MB per mission in `index.html`, and
   it needs an image generator; not available without spending the owner's credits. Rejected.
3. **Reuse Mission 3's jungle and Mission 5's ship art.** Cheapest, but the finale would look like a remix. Rejected.

For the chase: a real enemy the bot could shoot was rejected (the test bot would stop to fight it for ever); the Rex
of the chase is a level object, and only the boss fight has a Rex that can be hurt.

## Constraints kept

- Files `src/level8_*.js` after `level7.js` in `src/manifest.json`; globals `M8` (looks, pixel kit) and `L8` (rules).
- No `Math.random()` at load or in drawing code; `rand()` only in update code. (Two uses for show remain where a
  painter is involved: the engine's screen shake, and the sparks of CLUBTAIL's spike volley, which start where her
  painter last put her spikes. `tools/m8/paint-apart.js` shows that a run is otherwise the same however often it is
  painted.)
- The scenery (111 pictures, about 0.7 s of painting) is painted ahead a little at a time: on the mission card, during
  the briefing and the opening scene, and every fourth frame of play. No picture is first painted in the frame that
  shows it, and none of this touches the game's own numbers.
- Ground robots stay on screen once on it and never park on the hero, so camera locks always end; a bomber leaves
  after its third pass (16 seconds after it came), so no lock waits for a robot the player cannot reach.
- `index.html` is rebuilt with `python3 build.py`, never edited by hand.

## Verification

`tools/m8/notes.md` lists the commands and the reference numbers: three never-dodging test players through Mission 8
(the harness's hopping bot, one that stands, one that runs), parity of Missions 1 to 7 with the runs saved before the
build, and the fixtures (campaign flow, API, engine self-test, story, main loop, Clockfang, Lighthouse, Mission 4).
What those players never do (dodge, stop, get off, arrive at a giant with robots still about, fall at the last
moment) is played on purpose by `tools/m8/paths-test.mjs`; `tools/m8/browser-check.mjs` plays the mission in a real
browser with sound and compares it, to the frame and to the picture, with the test rig's run.
