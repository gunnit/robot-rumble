# Mission 5: ALIEN MOTHERSHIP — design spec and builder contract

The parent asked: "next mission is alien robots, they are green, have one eye, the scenery is a spaceship". They
approved the proposal in `proposals/level5/` (proposal.md, proposal-sheet.png, four painted frames: hangar, garden,
space, bridge, and the cast in kit.js) with "Build it" and no changes, so every proposed choice stands: the robots
are the OGGLES, AREA 3 is part on foot and part in the MINI UFO, the UFO's beam grabs and throws robots, the rescues
are cows, the Earth's land is sand-coloured. Each scene's art code is in `proposals/level5/<key>/scene.js`. **That
look is the target**: reuse its painters and beat it where it was weak (each `notes.md` has a "still weak" list).

The audience is two kids aged 8-10 on a keyboard. Cartoon robots: no blood, nothing scary, every danger warns at
least ~0.5 s ahead and has an escape. The family's bar is Mission 2: the never-dodging test bot finishes in about
150-170 s with 10-14 hits spread over all areas. Each mission must be clearly better than the one before.
**Missions 1-4 must play and look exactly as before.**

## 1. Files and owners

| File | Owner | Contents |
|---|---|---|
| `src/level5_cast.js` | robots | global `M5` (the proposal kit: palette, pixel helpers, `glow/bang/bubble`, looks of oggle, eye saucer, roly eye, cow, pod) + the eye flower's look, cow variants, burst pieces |
| `src/level5_enemies.js` | robots | `ENEMY_TYPES.oggle`, `.roller`, `.eyeflower`; `EB_TYPES.ogring`, `.oseed`; `POW_KINDS.podcow` |
| `src/level5_saucers.js` | saucers | `ENEMY_TYPES.eyedrone`, `.bigsaucer` (mini-boss); `EB_TYPES.odbeam` and its own; hazards `L5.meteor(tx)`, `L5.craneCrate(tx)` |
| `src/level5_gear.js` | gear | `RIDES.miniufo`, `PROP_TYPES.miniufo`; `WEAPONS.raygun`, `ITEMS.Z` |
| `src/level5_boss.js` | boss | `ENEMY_TYPES.megaoggle`; its `EB_TYPES` all start with `mo` |
| `src/level5_hangar.js` | hangar | `L5ART.hangar` (area art, x 0-1600), `L5ART.card` (mission card) |
| `src/level5_intro.js` | hangar | the beam-up opening scene (sets the level's `intro`) |
| `src/level5_garden.js` | garden | `L5ART.garden` (x 1600-3300) |
| `src/level5_space.js` | space | `L5ART.space` (x 3300-5000), `L5ART.helmet(x, y, facing)` (the hero's glass bubble) |
| `src/level5_bridge.js` | bridge | `L5ART.bridge` (x 5000-6400) |
| `src/level5_scenery.js` | coordinator | joins the four areas into `L5.drawBG/drawBehind/drawGround/drawPlat/drawFront/drawOverlay/menuBG`, bakes, seams |
| `src/level5.js` | coordinator | `LEVELS[4]`: data, rules (nectar, low gravity, bouncy caps, hearts, hazard schedule, paddock stampede), music, placeholder intro |

Manifest order (already set): `... level4_intro.js, level5_cast.js, level5_enemies.js, level5_saucers.js,
level5_gear.js, level5_boss.js, level5_hangar.js, level5_garden.js, level5_space.js, level5_bridge.js,
level5_scenery.js, level5.js, level5_intro.js, screens.js, main.js`.

File layout, like every other content file: first line `'use strict';`, then `var L5 = L5 || {};` and/or
`var L5ART = L5ART || {};` if the file exports through them (`var M5` only in level5_cast.js), then ONE block
`{ ... }` holding everything. Registry entries are assigned inside the block. Shared names only through `M5`
(looks), `L5` (level logic and hooks), `L5ART` (area art) and the registries. Reference other files' names at call
time only, never at load time (a file may be a stub while you work). `const Math = globalThis.Math;` at the top of a
block speeds up the harness.

**Never call `Math.random()` / `rand()` at load time or in draw code** (`hsh(n)`, `G.t`, or a private seeded
stream): the harness seeds Math.random, and one extra call shifts Missions 1-4's seeded runs. `rand()` only in
update logic. Never create canvases per frame: bake once, blit.

## 2. Layout (world x; y is screen y; canvas 480x270; `end` 6400, camera max 5920)

`mission 'MISSION 5'`, `title 'ALIEN MOTHERSHIP'`, `freedLabel 'COWS RESCUED'`, `music 'mothership'`,
`bossMusic 'oggleboss'`, `startText 'MISSION 5 START!'`, `startSay 'Mission five, start!'`, `heroStart 120`.

Sections (each is also the checkpoint): `AREA 1: THE HANGAR` 0, `AREA 2: STAR GARDEN` 1600,
`AREA 3: SPACE WALK` 3300, `FINAL AREA: THE BRIDGE` 5000. Area modules: hangar 0-1600, garden 1600-3300,
space 3300-5000, bridge 5000-6400.

Terrain (the deck), flat 232 in the hangar and garden, 212 on the hull, 218 on the bridge:
```
(0,232) (1952,232) (1960,250) (2052,250) (2060,232) (2752,232) (2760,250) (2892,250) (2900,232)
(3052,232) (3060,250) (3132,250) (3140,232) (3240,232) (3300,212) (4980,212) (5010,218) (6400,218)
```
- **Nectar** (`LV.nectar`, level data; the garden draws it, level5.js applies the rule):
  `[{ x0: 1956, x1: 2056, y: 240 }, { x0: 2756, x1: 2896, y: 240 }, { x0: 3056, x1: 3136, y: 240 }]`: three gaps in
  the garden catwalk where the glowing pond shows. Safe: the hero wades (60 % walking speed, pink splashes, can jump
  out; the 8-px slopes at both ends are walkable). Ground robots treat nectar as a wall (`L5.nectarAt(x)`).
- **Low gravity** (level5.js): on foot with feet at x 3300-4990, gravity is halved (the jump is about twice as high
  and floaty) and the hero wears the glass bubble (`L5ART.helmet`, drawn by level5.js over the hero). `L5.lowG(x)`
  tells others.
- **Bouncy caps** (level5.js): landing on a platform with `t: 'm2'` (pink mushroom) bounces the hero up
  (`vy = -7.2`, kept at full height like Mission 3's lava bounce) with a spore puff and a boing.

Platforms `{ x, y, w, t }` (x = left edge, y = top; one-way, Down+Jump drops through):
- AREA 1: crate steps `crate` 340/206/28, 733/206/28, 1000/206/28; catwalks `cat` 380/156/216, 1040/160/180.
- AREA 2: mushroom caps `m1` (orange) 1980/196/56, 2290/192/56, 2772/196/50, 3070/194/56;
  `m2` (pink, bouncy) 2415/186/62, 2838/188/56.
- AREA 3: `solar` 3620/176/60, 4160/170/70; `tower` 4700/168/44.
- FINAL: `console` 5300/190/50, 5970/192/44, 6090/192/44.

Props: engine `crate` 250 coin, 900 heart, 1380 coin, 2100 heart, 3700 coin, 4700 heart, 5380 heart;
`miniufo` 3520 and 4520 (parked MINI UFOs, §5); `paddock` 2589 (the cow paddock's control box, below).

Rescues (`pows`, all `kind: 'podcow'`; Mission 2 owns `POW_KINDS.cow`): 844 H v0, 1460 B v1, 2655 S v2, 3180 Z v0,
3760 heart v1, 4350 R v2, 5560 H v0 (`o.v` = the cow variant; level5.js copies it onto `G.pows` in `load()`).

Spawns (y defaults to the ground; flyers give y; extra fields reach `make(e, spec)`):
- AREA 1: oggle 520; oggle 560 `{ y: 156, sniper: true }`; eyedrone 700 y 90; roller 790; oggle 747
  `{ y: 206, sniper: true }`; eyedrone 960 and 1012 `{ asleep: true }`; oggle 1130 `{ y: 160, sniper: true }`;
  eyedrone 1220 y 84 `{ carry: true }`; roller 1260; oggle 1340.
- AREA 2: roller 1760; eyeflower 1880; oggle 2110; roller 2190; eyeflower 2258; roller 2375; roller 2485;
  oggle 2520; eyedrone 2591 y 100 `{ carry: true }`; eyeflower 2720; eyedrone 2920 y 95; roller 2960; oggle 3010;
  eyeflower 3170; roller 3222.
- AREA 3 (oggles here get `helmet: true`): oggle 3640; roller 3720; eyedrone 3850 y 90, 3900 y 112, 3950 y 80;
  roller 3984; roller 4090; eyedrone 4200 y 103, 4274 y 88, 4240 y 141 `{ mode: 'beam' }`; oggle 4216;
  oggle 4600; roller 4680; eyedrone 4760 y 95, 4820 y 120 (these four come after the 4400 lock).
- FINAL: oggle 5150; roller 5230; oggle 5325 `{ y: 190, sniper: true }`; eyedrone 5400 y 100; roller 5520;
  oggle 5600; eyedrone 5700 y 90 `{ mode: 'beam' }`.

Locks (`at` = camera x):
- 1120 (the hangar's far end): oggle side 1 d 20; oggle side -1 d 90; eyedrone side 1 d 160 y 90; roller side 1
  d 260; oggle side -1 d 340; eyedrone side -1 d 420 y 100.
- 2200 (the proposal's garden screen): roller side 1 d 20; roller side -1 d 100; eyedrone side 1 d 160 y 95; oggle
  side 1 d 240; roller side 1 d 330; eyedrone side -1 d 400 y 100 `{ mode: 'beam' }`; oggle side -1 d 470.
- 4400 (`boss: true` mini-boss): bigsaucer side 1 d 60.
- 5920 (`boss: true`): megaoggle side 1 d 60. Its `make()` places it at x 6282, y 211 (the bottom of its skirt).

Level rules in level5.js (coordinator):
- **Hazards:** in AREA 1 (camera past 300) `L5.craneCrate(tx)` about every 300 frames; in AREA 3
  `L5.meteor(tx)` about every 240 frames (150 while the 4400 lock is on). `tx` = hero x + rand(-30, 80), clamped to
  the screen. Never while an intro runs or a boss is dying.
- **Paddock stampede:** `PROP_TYPES.paddock` at 2589 is a hazard-striped control box (18 x 26, hp 6) in front of the
  cows' force-field fence. Breaking it drops the field: "STAMPEDE!", three cows run along the deck at 3 px/frame for
  300 frames (first left to the screen's left edge, then back right and away, hopping the nectar gaps), every robot
  they touch takes 6 damage once (never bosses), +1000. `L5.paddock = { on, t }`.
- **Hearts** (as Missions 1 and 4): the first robot beaten in an area while the hero is on the last heart leaves a
  heart, once per area. The BIG SAUCER always leaves one.
- **Music:** `mothership`; AREA 3 switches to `spacewalk` (same tune, faster) and back, like Mission 3's
  `islandlava`.

## 3. The robots: the OGGLES (looks in level5_cast.js; see `proposals/level5/cast/cast.png`)

Green armour (`M5.PAL.G`), ONE eye (steel bezel, white lens, red iris), an antenna lamp. Green is reserved for
them and their beams. Shared tell, every attack: the lamp blinks, the eye turns yellow, a red `!` (`M5.bang`),
at least 30 frames. When beaten they burst into plates and bolts and the eye pops out on a spring.
Every type has `grab: true | false` and, when true, `cargoDraw(x, y, t, rot)` (draws it dangling / tumbling from a
plain point: the MINI UFO's beam removes a grabbed robot from `G.enemies` and carries it as cargo, see §5).

- **oggle** (trooper): hp 3, 100 points, `melee: true`, `grab: true`. Walks up to 110-150 px from the hero, stops,
  aims, warns 40 frames (lamp, yellow eye, `!`, glowing gun tip, a dotted green aim line), fires ONE slow `ogring`
  (1.9 px/frame, flies level at feet - 10: jump it), waits 150-200 frames. `sniper: true`: stays on its platform
  and fires along the dotted line down at where the hero stood (sidestep). `helmet: true`: glass bubble (look
  only). Never walks into nectar or off a platform. Wave oggles walk on screen first.
- **roller** (roly eye): hp 2, 100 points, `grab: true`, 18 px tall (standing shots pass over it: crouch, or jump
  it). Rolls toward the hero at 0.9; within 120 px it stops, warns 36 frames (hops, sparks, `!`), then dashes at
  3.2 px/frame for up to 150 px or until a wall, nectar or a platform edge; skids and sits dizzy 40 frames; repeat.
- **eyeflower** (STAR GARDEN only, never in a wave): hp 4, 200 points, `grab: false`, rooted. Shut bud for 90-140
  frames (`e.inv`, shots clank); the bloom snaps open and warns 50 frames; spits ONE `oseed` (slow arc at the
  hero, `shootable`); stays open 60 frames; shuts. Its look is in `proposals/level5/garden/scene.js`.
- **eyedrone** (eye saucer): hp 2, 150 points, `flying: true`, `grab: true`. Hovers at y 80-120 and drifts toward
  the hero. `mode: 'dive'` (default): warns 40 frames, then swoops in a U through where the hero stood (only the
  swoop hurts) and climbs back. `mode: 'beam'`: stops above the hero, warns 45 frames (a dotted column and a ring
  on the deck), then drops its green beam for 50 frames (a 20-px column hurts: walk out). `asleep: true`: parked
  on the deck with a "Z"; wakes when the hero is within 130 px (lamp blinks red 45 frames, then it takes off).
  `carry: true`: crosses the screen slowly at its y with a cow in its beam and never attacks; beaten, the cow
  floats down, lands and trots off left: "MOO!" +500 (a bonus, not a counted rescue). Wave drones fly in by
  themselves.
- **bigsaucer** (mini-boss of the 4400 lock): `boss: true`, `bossName 'BIG SAUCER'`, about hp 60, 2000 points,
  `grab: false`. A 64-px eye saucer with a ring of lamps; its eye underneath is always open. Three attacks, each
  with a tell of at least 45 frames and an escape, e.g. BEAM SWEEP (it parks at one side, arrows on the deck show
  the way, then it crosses half the screen with its beam down: run to the other half or fly over it), LAUNCH (it
  pops out eye saucers, never more than 3 alive) and a ROLLER DROP (roly eyes: ammunition for the UFO, a thrown
  robot does 8 damage). It must be beatable on foot (it comes down to shooting height between attacks) and from
  the MINI UFO. Target: 20-30 s, at most 2 hits on the never-dodging bot. Funny defeat; `e.dead = true` at the end
  of its own death animation (it is a mini-boss, never `bossDefeated`).
- **Hazards** (level5_saucers.js; level5.js schedules them): `L5.meteor(tx)` a burning rock from the upper right,
  `L5.craneCrate(tx)` a cargo crate let go by the ceiling crane. Both: a blinking ring + red `!` on the landing
  spot (and a dotted line / striped shadow) for 60-90 frames first; `shootable`; they hurt robots too; the crate
  leaves an engine `crate` prop (a step, sometimes with a coin).
- **cow** (`POW_KINDS.podcow`; never touch Mission 2's `POW_KINDS.cow`): the glass pod (`M5.pod`), MOO! / HELP! bubble, box 32 x 48. Freed: the glass pops, the
  cow hops out, does a happy jump (the salute), runs left. `thanks 'MOO! THANK YOU!'`, a moo sound in `onFree`.
  Variants `o.v`: 0 blond (rubia galega), 1 black-and-white, 2 a blond calf.

## 4. The boss: MEGA OGGLE (`bossName 'MEGA OGGLE'`, level5_boss.js)

The look is `proposals/level5/bridge/scene.js` (188 x 168 px with skirt and crown; captain's cap, medals, epaulettes,
cable arms with claws). It needs a part rig: the eye (iris follows the hero), both lids, the brow, three antenna
lamps, two arms, the skirt bob and thrusters, faces for hurt and dizzy. hp about 420 (MEGA BEAR 480, MEGA WHALE
SHARK 380), `armored`, `contact: 'none'` for the body. Arena: camera 5920, deck y 218, consoles at 5970 and 6090
(y 192), the boss at x 6282.

- **Weak spot:** only the open eye takes damage (double while the beam fires); armour hits clank (0 damage).
- **EYE BEAM (ZAAAP!):** the three antenna lamps light one, two, three, the iris turns yellow, a dotted aim line
  and `!` (about 70 frames). Then the beam sweeps the deck from the boss to the left wall at walking pace. Jump it
  once or stand on a console.
- **TRACTOR DROP:** a claw fetches a crate or a cow pod. A red ring and `!` follow the hero for 60 frames, lock for
  40, then it drops. A crate bursts (a hit if under it); a cow pod cracks open: the cow runs off and leaves a heart
  or ammo.
- **EYELIDS SHUT:** after about 12 eye hits the lids slam shut (shots ping off) and it either sweeps a claw along
  the deck (clack-clack tell, jump it) or rolls out two roly eyes; the lid lifts a crack, then opens.
- **Below half:** the cap is blown off, one lid jams half open, the beam sweeps there and back, crates drop in
  pairs, and a SAUCER DASH (the skirt lamps flash, it slides across the deck, hits the wall and sits dizzy with
  the eye wide open).
- **Defeat:** `onKill` returns `'dying'` and sets `G.winT = 360`; the eye goes spiral, it spins, the pods pop open,
  the freed cows stampede over it and the cap lands on a cow; `bossDefeated(e)` at frame 150.
- Fairness: every attack has a tell of at least 36 frames and an escape that works with both heroes. Targets with
  the never-dodging bot starting at the bridge checkpoint: the boss alone costs 4-7 hits and takes 45-75 s.

## 5. Gear (level5_gear.js)

- **MINI UFO** (`RIDES.miniufo`, parked `PROP_TYPES.miniufo` on a hazard pad with a blinking GET IN! arrow; the
  look is `proposals/level5/space/scene.js`: silver, red stripe, yellow star, glass bubble with the hero inside).
  - Arrows fly it in eight directions (about 2 px/frame, a little glide), hovering between y 60 and 22 px above
    the deck, inside the screen and inside x 3310-4950. At 4950 it says TOO BIG FOR THE AIRLOCK! and parks itself.
  - X: the nose blaster (yellow bolts, 1 damage, every 8 frames, level).
  - Hold C: the CYAN grab beam straight down (up to 110 px). The first thing with `grab: true` in the 24-px column
    is taken out of `G.enemies` and hangs under the UFO as cargo (drawn with its `cargoDraw`). Release C: throw it
    forward in an arc; where it lands or hits: `blast(x, y, 30, 6, 'player')`, twice the robot's points, "STRIKE!".
    It deals 8 to a boss. The beam also pulls pick-ups up to the UFO and frees a cow pod it touches. The charge bar
    (180 frames) drains while the beam is on and refills at half speed.
  - 5 armour pips, 70 mercy frames per hit; at 0 it pops and the hero is thrown out (`exitRide(p, true)`).
    Down + Z: get out; the UFO stays parked where it hovers (same armour) and can be boarded again.
  - `hud(ride)`: icon, MINI UFO, pips, beam bar (as in the proposal frame). `help`: one line with its keys.
  - The bot must never get stuck in it: on foot AREA 3 is always finishable.
- **RAY GUN** (`WEAPONS.raygun`, `ITEMS.Z`, label `RAY GUN`): a captured oggle gun. CYAN rings (never green),
  2 damage, pierce up to 3 robots, 40 ammo (max 80), every 14 frames.

## 6. Area art: `L5ART.<key>` (hangar, garden, space, bridge)

`src/level5_scenery.js` (read it: it is short) owns the level's draw hooks and calls the area modules:

```js
L5ART.<key> = {
  x0, x1,          // hangar 0-1600, garden 1600-3300, space 3300-5000, bridge 5000-6400
  steps: [f, f],   // bake steps, run once in order (idle time on the menus, or on the spot when first needed).
                   // No step much over ~100 ms in the harness. Nothing below runs before all steps ran.
  bg(g, cx),       // the whole backdrop for camera cx, drawn into the 2D context g (NOT the global ctx: g may be a
                   // scratch canvas for the crossfade). Screen space, opaque over x -10..W+10, y -10..H+10. Right
                   // for every camera the area can be seen from: backdrops crossfade over 300 px of camera travel
                   // centred on camera-centre 1600, 3300, 5000, so bg is called for camera x: hangar 0..1510,
                   // garden 1210..3210, space 2910..4910, bridge 4610..5920.
  behind(cx),      // world space (ctx translated by -cx): scenery behind the play layer, anchored at x0 <= x < x1
                   // (may overhang by up to ~100 px). Cull off-screen pieces.
  ground(cx),      // world space: the deck from the line L5ART.groundAt(x) down to the canvas bottom, x0..x1 (the
                   // joiner clips to exactly x0..x1). Use L5ART.groundAt(x), not groundAt(x) (menus have another LV).
  plat(pl),        // world space: one of YOUR platforms (pl.t: hangar 'cat' 'crate'; garden 'm1' 'm2'; space
                   // 'solar' 'tower'; bridge 'console')
  front(cx),       // screen space: low foreground at the very bottom only (the joiner clips to the screen part
                   // showing x0..x1). Never over the play lane (y 60 to the deck) except thin edge pieces.
  overlay(cx)      // screen space, optional: light, glass shine, drifting specks; called at globalAlpha = weight.
};
```
- Your mock `proposals/level5/<key>/scene.js` is the starting point; turn it into a real game file. NO mock staging
  in game files: nothing wraps `load` / `update`, pins the hero, enemies, shots, banners or scores, or depends on a
  mock camera. The mock screen must still look like the proposal at its camera (hangar 400, garden 2200,
  space 3900, bridge 5920), and the rest of the area must be as rich: walk it (render every ~300 px), with landmarks
  so no two screens look the same. The play lane stays readable: background darker and lower in contrast.
- The deck line, the nectar ranges and the platforms in §2 are gameplay: draw them where they are.
- Seams: your ground stops exactly at x0 and x1. The coordinator stands a bulkhead door (an airlock frame with
  hazard stripes) on each seam, so both ends just need to look finished under a door frame.
- Friendly background life (cows grazing in the paddock at 2540-2638, far saucers) must be clearly background.
- hangar also owns `src/level5_intro.js` (the level's `intro = { start, update, draw }`: the hero and a cow are
  beamed up from night-time Vigo Hills into the hangar; Enter skips; about 3-4 s; it ends with the hero standing at
  x 120 on the deck, `G.big` MISSION 5 START!, the AREA 1 banner, `say`) and `L5ART.card(x, y, w, h)` (the mission
  card: screen space, clipped, `G.p` may be null, no `groundAt`: Earth in the bay mouth, the hero, an oggle).
- space also owns `L5ART.helmet(x, y, facing)`: the glass bubble over the hero's head on the hull (world space; `y` =
  the feet, already 8 lower while crouching; level5.js calls it with the front layer, so it is drawn after bullets
  and particles: keep it mostly transparent).
- garden draws the nectar (surface y 240 in the three ranges, with a translucent front layer so a wading hero
  looks knee-deep) and the paddock scenery (fence, cows; the control box prop itself is the coordinator's).

## 7. Development

- Harness: `tools/harness/README.md`. Mission 5 is in the manifest, so no `--extra`:
  `node tools/harness/harness.mjs sim --level 5 --seed 1`, `... render --level 5 --x 2401.6 --frames 90 --god
  --scale 3 --out PNG`, `... sim --sandbox oggle,roller --frames 3000 --god`. `errors` and `warnings` must be `[]`
  (warnings about names another owner has not written yet are fine until integration).
  Lock renders: `--x` places the hero and the camera sits at x - 201.6 (use lock + 201.6).
- Several builders share one 8 GB Mac that restarts often. One harness run at a time per builder, in the foreground
  (`nice` it), no background processes, no subagents, no dev server. Keep `tools/m5/build/notes-<key>.md` current,
  `STATUS:` line first (done, next, exact test commands). Scratch in `tools/m5/build/<key>/`. Nothing durable in /tmp.
- Edit only your own files (§1). Never: other `src/` files, `src/manifest.json`, `docs/`, the harness, `build.py`,
  `index.html`, `proposals/` (read-only reference). Do not run `python3 build.py`.
- Engine needs: solve them inside your file. If something is truly impossible, write it under "engine requests" in
  your notes; the coordinator decides at integration.
- Parity: `node tools/harness/harness.mjs sim --level N --seed 1` for N = 1..4 must print exactly what
  `tools/m5/build/baseline-lN.json` holds. Check it before you hand back.
- Per-frame drawing cost: keep your part under ~2 ms in the harness.

## 8. Quality bar

- At least as good as the proposal frames and Missions 2-3. Pixel art: 1px `OUT` outlines on characters and
  gameplay objects, 3-tone shading, chunky readable silhouettes, crisp edges (no anti-aliased strokes for
  hard-edged things; soft light only for glows).
- Everything is alive: idle animation, blinking lamps, drifting stars, steam, swaying plants.
- Iterate: render, open every PNG with the Read tool, crop and zoom, compare with the proposal frame, fix. At least
  4 rounds. Finish with a labelled contact sheet `tools/m5/build/<key>/sheet.png` of your best 6-12 frames.
- Hand back: what you built, the exact test commands and results, the parity check, anything the coordinator must
  place or tune (per robot: hp, points, tell lengths, where it works best), engine requests, an honest "still
  weak" list.

## 9. What the skeleton taught us (read before you start; full list in `tools/m5/build/notes-skeleton.md`)

The skeleton (level5.js, level5_scenery.js, level5_cast.js, stubs) is in place and the mission is playable end to
end with stand-ins. Contact sheet: `tools/m5/build/skeleton/sheet.png`. Rule tests: `tools/m5/build/skeleton/t-rules.js`
(`--extra`, 62 checks; they must keep passing).

- **The test bot stalls easily.** It only walks toward a robot more than 24 px away in x, aims up only at `flying`
  types, never drops through platforms and never dodges.
  - A sniper oggle on a catwalk can't be reached from the deck: after its second shot (or 150 frames with the hero
    below it) it hops down and becomes an ordinary oggle.
  - A ground robot idling under the hero's platform stalls the run forever: ground robots never stand still within
    24 px of the hero's x; they keep moving.
  - A robot within about 10 px of the hero is never hit by level shots, and rollers are not `melee`: a roller keeps
    rolling through, it never parks on the hero.
- **`bg(g, cx)` must draw with `g` only.** `R`, `RO`, `text`, `spr`, `M5.px.blit` and `M5.glow` draw on the global
  `ctx` and would land on the wrong canvas during a crossfade.
- **Joiner:** ground is clipped exactly to x0..x1, front to its screen part, overlay is called at its weight; a
  missing `plat()` falls back to the stand-in platform. A stand-in is used for an area until its module has `bg`.
- **Door frames** stand on the seams (1600, 3300, 5000), occupy seam +- 44 px and are drawn after the grounds: keep
  `behind()` landmarks clear of seam +- 50.
- **Menus and the card** run with `G.p` null and another `LV`: use `L5ART.groundAt` / `L5ART.level()`.
  `L5.nectarAt` and `L5.lowG` return null / false outside Mission 5 (the sandbox too).
- **Hearts rule:** level5.js wraps `onKill` of oggle, roller, eyeflower, eyedrone and bigsaucer once when it loads,
  so those types must be registered at load time (not lazily).
- **Level rules run after `updateEnemies`** and are off while the hero rides. Only the hero on foot gets low gravity.
- **Locks:** robots the BIG SAUCER (or the boss) launches hold the lock only if created with `makeEnemy(spec, lock)`
  (`e.lock` of the launcher). The 4400 lock is `boss: true`; level5.js shows GO > and restores the tune when it ends.
- **Names:** grep any new registry name first. EB kinds `mb*` and `mw*` are taken; `mo*` is free. In level5_cast.js
  the green ramp is `GR` (the game state is `G`). Shared: `L5.level` (the level object; the intro file sets
  `L5.level.intro`), `L5.paddock`, `L5ART.level()`, `L5ART.weights`, `L5ART.bakes` (optional queue of one-off bakes).
- **The stand-ins to replace** are marked "temporary" in level5_cast.js (oggle, roller, eyedrone, ogring, podcow)
  and level5.js (eyeflower, bigsaucer, megaoggle, the card, the intro): your file loads later (cast) or earlier
  (level5.js checks `if (!ENEMY_TYPES.x)`), so registering the real one is enough. Tell the coordinator which
  stand-in is now dead code.

