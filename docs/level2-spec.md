# Robot Rumble — Mission 2 "Vigo Hills" spec

Audience: two kids aged 8–10 (heroes Ines and Mathias). Mission 1 (robot jungle, crab boss) already exists and must keep working exactly as it does now. Mission 2 must look and play **significantly better** than Mission 1.

Agreed with the parent: Galician stone house on a hill in Vigo, battle tractor ride, new weapons, rescuing animals, rain + rainbow, giant robot bear boss.

---

## 1. Architecture (after the engine refactor)

The single file `index.html` is split into source files so several people can work in parallel. Kids still double-click one file: `build.py` inlines everything into `index.html`.

```
game/
  index.html        BUILT single file (python3 build.py). Do not hand-edit after the refactor.
  dev.html          loads src/*.js in manifest order (development, no build step)
  build.py          reads src/manifest.json, inlines all scripts into index.html
  src/manifest.json ordered list of source files (dev.html, build.py and the harness all use it)
  src/core.js       canvas, helpers, input, pixel font, R/RO/blob/makeSprite/spr, groundAt()
  src/audio.js      Snd, Music, TRACKS, say()
  src/heroes.js     hero sprites + drawHero (gun drawing delegated to WEAPONS[w].drawGun)
  src/engine.js     state G, registries, physics, player, bullets, items, effects, camera, locks, update()
  src/weapons.js    WEAPONS: pistol + hmg (moved from engine)
  src/level1.js     Mission 1: data, enemy types (soldier, drone, tank, crab boss), props (crate, barrel), human POW, scenery
  src/screens.js    HUD, title, mission select, hero select, intro text, win, all-clear, game over, pause, draw()
  src/main.js       main loop + dev hooks (devStart)
  -- Mission 2 (content files, one owner each) --
  src/weapons_extra.js   S / R / F weapons + items 'S','R','F','cherry','chestnut'
  src/vehicle.js         battle tractor ride (RIDES.tractor, PROP_TYPES.tractor)
  src/level2_enemies.js  ENEMY_TYPES wolf, eagle, bear (+ their projectiles, sounds)
  src/level2_boss.js     ENEMY_TYPES megabear
  src/level2_sky.js      sky, Ría de Vigo, parallax, weather (rain, rainbow), petals, birds
  src/level2_world.js    terrain/ground drawing, house + door, hórreo, walls, trees, stream, foreground, interactive tree props
  src/level2.js          the LEVELS[1] definition: terrain, layout, spawns, locks, animals (POW_KINDS), intro cutscene, music tracks
```

Load order (manifest): core, audio, heroes, weapons, engine, level1, weapons_extra, vehicle, level2_enemies, level2_boss, level2_sky, level2_world, level2, screens, main.
All files are classic scripts sharing one global scope (top-level `const`/`function` are globals). Code that runs at load time may only use things from earlier files; anything referenced inside functions can live in any file.

### Registries (created in engine.js unless noted)

```js
const LEVELS = [];          // LEVELS[0] = mission 1, LEVELS[1] = mission 2
let LV = null;              // current level definition (set by loadLevel)
const ENEMY_TYPES = {};     // name -> enemy type
const PROP_TYPES = {};      // kind -> prop type (crate, barrel live in level1.js)
const POW_KINDS = {};       // kind -> prisoner/animal type ('human' lives in level1.js)
const ITEMS = {};           // item letter/kind -> pickup
const WEAPONS = {};         // weapon name -> weapon (weapons.js)
const RIDES = {};           // ride type -> vehicle (vehicle.js)
const EB_TYPES = {};        // custom enemy-projectile kinds
```

**Enemy type** — `ENEMY_TYPES[name] = { hp, boss?, bossName?, flying?, activateMargin?, make(e, spec), update(e), draw(e), box(e), contact, onKill(e) }`
- `e` always has: `type, x, y (feet), vx, vy, t, hitT, facing, active, dead, lock, hp, max`.
- `contact`: `'hurt' | 'block' | 'none'` or `function(e)` returning one of those (e.g. a bear only hurts while swiping).
- `onKill(e)`: effects + score. Engine sets `e.dead = true` afterwards unless `onKill` returns `'dying'` (bosses run their own death animation, then call `bossDefeated(e)`).
- `damageEnemy(e, dmg)` is generic: respects `e.inv` and `e.state === 'dying'`, sets `hitT`, calls `killEnemy` at 0 hp.
- Boss HUD bar: engine shows it for the first enemy whose type has `boss: true`, using `bossName`, `e.hp / e.max`, hidden while `e.state` is `'intro'` or `'dying'`.

**Prop type** — `PROP_TYPES[kind] = { make(o, spec), box(o), hit(o, dmg, src), update(o), draw(o) }`. Props sit at `o.y = groundAt(o.x)` unless spec gives `y`.

**POW kind** — `POW_KINDS[kind] = { draw(o), box?(o), thanks: 'THANK YOU!', onFree?(o) }`. `o.state` is `'tied' | 'free' | 'salute' | 'run'` (engine drives the timeline, drops `o.item`, counts rescues). Default kind `'human'`.

**Item** — `ITEMS[k] = { draw(it), collect(it, p) }`. Existing: `H`, `B`, `heart`, `coin`.

**Weapon** — `WEAPONS[name] = { label, ammo, maxAmmo, cd, tapCd?, muzzle(aim) -> [x,y], fire(p, mx, my, dx, dy), drawGun(aim, ty, r), icon(x, y), bigFlash? }`. Pistol is the default (infinite ammo). Picking up a weapon item sets `p.weapon` and adds ammo; at 0 ammo the player falls back to the pistol.
Player bullets in `G.pb` may carry optional hooks: `{ x, y, vx, vy, dmg, life, pierce?, update?(b), draw?(b), onHit?(b, e), onGround?(b) }`. Without hooks the engine uses today's bullet behaviour.

**Ride** — `RIDES[type] = { update(p, ride), box(p, ride), draw(p, ride), hurt(p, ride), hud(ride) }`. While `p.ride` is set, the engine calls `update` instead of the normal player update, uses `box` as the hurtbox, calls `hurt` instead of removing hearts, and calls `draw` instead of drawing the hero. Engine helpers `boardRide(p, ride)` and `exitRide(p, ejected)`.

**Enemy projectile kinds** — existing kinds (`laser, orb, mg, shell, bomb, mup, mdown, wave`) stay in the engine. New kinds register `EB_TYPES[k] = { r, update?(b), draw(b), onGround?(b), shootable? }`.

**Level definition** — pushed onto `LEVELS`:
```js
{
  mission: 'MISSION 2', title: 'VIGO HILLS', end: 6200, heroStart: 140,
  sections: [{ x, name }], terrain: [[x, y], ...] | null,
  plats: [{ x, y, w, t }], spawns: [{ t, x, y? }], pows: [{ x, item, kind? }],
  props: [{ k, x, ... }], locks: [{ at, waves: [{ t, side, d, y? }], boss? }],
  music: 'vigo', bossMusic: 'bearboss',
  clearMusic: 'victory',       // optional: ALL MISSIONS COMPLETE music (default 'victory' when TRACKS has it)
  startText: 'MISSION 2 START!', startSay: 'Mission two, start!',  // optional: start band and voice (also on a continue)
  drawBG(cx), drawBehind(cx), drawGround(cx), drawPlat(pl), drawFront(cx), drawOverlay(cx),
  update(), intro: { start(), update() -> true when the player gets control, draw() } | null,
  preview(x, y, w, h),         // art for the mission-select card
  menuBG()                     // optional: the hero select's backdrop while this mission is chosen (screen space)
}
```
The optional fields are read by the engine (see `docs/engine-api.md`); without them a level gets the old behaviour.
Mission 1 is converted to this same shape (with its current drawing code) and must look and play exactly as before.

### Terrain
`groundAt(x)` returns the ground surface y at world x for the current level (linear between `terrain` points, clamped at the ends, `GROUND` = 232 when the level has no terrain). Everything that used the flat `GROUND` for physics uses `groundAt(x)`: landing, bullets/grenades/particles/items hitting the ground, shockwaves, markers, dust, POW and prop placement. Walking downhill must not make the player "fall" (snap to the ground when it is less than ~6px below and the player was grounded last frame). Ground stays within y 150–245 so no vertical camera is needed.

### Mission flow
Title → **Mission select** (2 cards with preview art) → Hero select → mission intro → play.
After Mission 1 is complete, Enter goes straight into Mission 2 with the same hero (score carries over). After Mission 2: an **ALL MISSIONS COMPLETE** celebration (fireworks, then the `victory` track), then title, with Mission 1 selected again. Both missions are always selectable. Continue restarts at the last checkpoint of the current mission (in Mission 2 with MISSION 2 START! and "Mission two, start!"). Q on the pause screen goes back to the title.

### Dev hooks and test harness
- `window.devStart({ level, hero, x, god, sandbox, frames })` in main.js: sets up a game in that state, runs `frames` updates synchronously, draws once, returns a summary. `sandbox: ['wolf','eagle']` = flat test arena with those enemies spawned ahead of the player.
- Node harness (`/Users/macbookair/game/tools/harness/harness.mjs`, README there, uses `@napi-rs/canvas` installed there):
  - `node harness.mjs sim --level 2 [--hero 0] [--frames 30000] [--god]` → JSON `{completed, state, errors[], hitsBySection, deaths, seconds, score, freed, x}` from a bot playthrough (bot shoots the nearest enemy, aims up at flyers, jumps regularly, throws grenades at big enemies, walks into vehicles).
  - `node harness.mjs render --level 2 --x 1200 [--frames 60] [--sandbox wolf,eagle] [--hero 1] [--scale 3] --out shot.png` → PNG of the real game frame (nearest-neighbour upscaled). Also `--screen title|missions|select|win|over|allclear`.
  - Look at PNGs with the Read tool. Every visual change must be checked this way.

---

## 2. Mission 2 content: "VIGO HILLS"

Setting: Vigo, Galicia (Spain), a sunny spring morning. A little Galician stone house sits on top of a hill looking over the Ría de Vigo. Robots attack from the woods. Day goes: golden morning → midday → Galician drizzle at the farm → rainbow and sunny afternoon at the cherry orchard.

### Layout (world x; ground baseline 232; level end 6200, camera max 5720)
| Area / checkpoint | x | What happens |
|---|---|---|
| AREA 1: HOME SWEET HOME | 0 | Intro cutscene at the house (plateau y=176 from x 0–250). Path slopes down to y≈224 by x 520, gentle hills after. Garden with hydrangeas and a cherry tree. First robot eagles screech overhead, robot wolves come up the hill. Lock at cam 900: wolf pack + first eagle. |
| AREA 2: CHESTNUT WOODS | 1350 | Old chestnut trees with spiky burrs, ferns, moss, granite boulders, light shafts through the canopy. Shallow stream at x 2010–2130 (ground dips to y 240; player wades with splashes). Lock at cam 2250: robot BEAR mini-boss + helpers. |
| AREA 3: THE FARM | 2850 | Fields, vineyard trellises with grapes, corn, haystacks, a stone farmhouse. The battle tractor is parked at x 2950. Drizzle starts around x 3200, heavy rain 3500–4000, clears by 4200. Lock at cam 3500: eagles + wolves + a bear. |
| AREA 4: CHERRY ORCHARD | 4400 | Rainbow over the orchard, pink blossom, petals blowing, cherries to shoot down. |
| FINAL AREA: THE BIG CHERRY TREES | 5450 | Checkpoint before the boss: a continue starts here (camera 5450, hero 5510) next to the dog with the H (5560); no robots until the lock. Boss arena flat from x 5600; lock at cam 5720: MEGA BEAR crashes out of the trees. |

Terrain points (owner level2.js may tune ±): (0,176) (250,176) (300,182) (360,196) (430,212) (520,224) (600,230) (700,232) (850,228) (1000,218) (1150,214) (1300,224) (1450,232) (1650,226) (1850,218) (1960,230) (2010,240) (2130,240) (2180,230) (2350,222) (2550,228) (2750,232) (3300,228) (3500,232) (3900,228) (4250,232) (4450,226) (4650,218) (4850,224) (5050,232) (6200,232).

Fixed positions other modules rely on: house x 40–170 with the front door centred at x 120 on the plateau; hórreo at x 190–245; tractor parked at x 2950; stream x 2010–2130; boss arena x 5720–6200.

### Rescues (POW_KINDS in level2.js) — animals in robot cages, cage bursts open, animal hops out happy, drops the item, runs off left
dog x 560 → `S`; sheep x 1550 → `F`; pony (Galician garrano) x 2300 → `R`; cow x 3200 → `B`; hen x 3800 → `heart`; goat x 4600 → `heart`; dog x 5560 → `H` (just before the boss). The shotgun comes before the first wolves, the flame for the woods, rockets for the ROBO BEAR, grenades for the farm and the H for the MEGA BEAR: S, F and R are picked up and used on foot before the tractor (letters picked up inside the tractor replace each other), and the H is the last pickup before the boss, also for riders.
A freed animal tosses its item to where the hero will be when it lands (about 0.6 s later, at most 4 px a frame, never off screen); a hero further away than that throw reaches (walking on after freeing it, across a locked screen, up on a boulder) gets a higher, longer lob of up to 1.3 s, still at most 4 px a frame. The engine on its own drops it behind the animal, where a running hero or the tractor would leave it. An animal freed just as the camera moves on drops its item on screen at once (otherwise it could scroll away before its drop). Each has a little sound (woof, baa, neigh, moo, cluck, bleat), loud enough to be heard over a fight. The HELP! bubbles over the cages are drawn above the weather (rain, petals and butterflies never cover them).

### Enemies (level2_enemies.js)
- **wolf** — robot wolf, ~34×22, hp 3. Prowls, then runs at the player (fast), crouches 12 frames with eyes flashing and a growl (telegraph; its mid layer is pitched for laptop speakers and loud enough over the hero's own shotgun, flame and tractor gun), then pounces in an arc; skids, backs off, repeats. Comes in packs, howls when it appears. Contact hurts while it runs and pounces; the skid after a pounce doesn't, so an early jump that lands on a skidding wolf is safe. Short enough that crouch shots hit it well; standing shots still hit its head.
- **eagle** — robot eagle, ~40px wingspan, hp 3, flying. Enters from an edge high up, circles, screeches + eye flash before a straight dive at where the player was, then pulls up. Sometimes drops an egg-bomb instead. Hurts only during the dive or with its bomb.
- **bear** — robot bear, ~56×44, hp 30. Walks heavily (ground shakes a little, heavy footsteps). Attacks: stands up and swipes (telegraphed; hurts only when close), throws a boulder or log in an arc, short charge. Contact blocks (doesn't hurt) except during the swipe/charge; the charge's hurt box is 40×24 (scaled up for the ROBO BEAR), low enough to jump over. Legs and arms in a warm dark brown, so a grey wolf in front of a bear stays separate. A block push never leaves the hero off screen.
- In the rain the eagles' wings are drawn lighter (light top edges) so they read against the storm clouds.
All three: clear 1px dark outlines, 3-tone shading, multi-frame animation, glowing red eyes, robot plating so they read as robots not real animals, satisfying break-apart deaths (parts fly, sparks, explosion).

### Boss (level2_boss.js) — MEGA BEAR
Giant robot bear, ~150×110, hp 480 (integration tuning: about 2.4 s between attacks in phase 1 and 1.9 s in phase 2, and its plating halves the battle tractor's machine-gun bullets, so the tractor shortens the fight without ending it in seconds). Intro: trees shake, it crashes in from the right with a roar, screen shake, WARNING. Phase 1: boulder toss (ground markers), paw ground-pound shockwave (jump), swipe at close range. Phase 2 (<50%): plating breaks off showing a glowing core, eyes turn red, chest laser that sweeps at a telegraphed height (high = crouch, low = jump), roar that calls 2 wolves. Every attack is clearly telegraphed and fair for an 8–10 year old. A fight lasts about 45–75 s with pistol + grenades, faster with power-ups or the tractor. Player cannot walk through it (invisible wall in front of it). Big multi-explosion death, then `bossDefeated(e)`.
Review fixes (2026-11): the swipe reaches 120 px and telegraphs 10 frames longer (paw up 0-24, claw glint 24-44, sweep 44-52), so a hero on foot at the wall can still get away; it never swipes at a rider (the tractor can't back off in time) and shows no DUCK!/JUMP! hints to a rider. From the kill on nothing hurts the hero (`G.winT` is set at the kill; a hero already falling on the last life respawns and still wins). MEGA BEAR DOWN! in the big band when it falls. Its hit flash is capped (at most 2 white frames every 24 frames, no strobe under the H). Its warning sounds (grunt, rise, growl, whine) are louder than the music's bass, and its thuds and rumble get a mid layer that laptop speakers play.

### Battle tractor (vehicle.js)
Red Galician farm tractor with armour plates, big rear wheel, small front wheel, exhaust puffing, a turret with a machine gun and a cannon. Parked at x 2950 with a bouncing "GET IN!" arrow; walking into it boards it (hero hops in, visible in the seat).
Controls while riding: ←/→ drive, Z hop, X machine gun (holds fire, aims forward; ↑ swings the gun up smoothly to 90°), C fires a cannon shell in an arc (big blast, 15 shells), ↓+Z jumps out. The first boarding shows `C: CANNON   DOWN+Z: GET OUT` under BATTLE TRACTOR!, and the pause screen shows the same line while riding (`RIDES.tractor.help`). Armour 6 (HUD bar). At 0 armour it flashes, the hero is thrown clear with invulnerability (BAIL OUT!), and the tractor explodes a moment later. Fits through the whole rest of the level including the boss arena. It tilts only on steep slopes (no jagged 2° rotation on the orchard hill), its engine is heard while driving (quiet when parked) and a hard landing thumps.

### New weapons (weapons_extra.js)
- **S — Shotgun**: 5 pellets in a fan, short range (~100px), 2 dmg each, big blast flash, 30 shells. Still the punchiest gun, but its blast is about 4 LU quieter than at first.
- **R — Rocket launcher**: rocket accelerates with a smoke trail, gently homes on the nearest enemy ahead, explodes (radius ~26, 6 dmg), 30 rockets.
- **F — Flame shot**: short stream of growing flame that passes through enemies (damage with a per-enemy cooldown), 240 fuel (300 max: 12 s of held fire, like the other weapons). Its hiss is heard while it is held.
- Items: `cherry` (+1 heart, or 300 points if full), `chestnut` (300 points).
Each weapon has its own gun drawing in the hero's hands for all aims, HUD icon, sound and muzzle flash.

### Scenery — sky + far layers (level2_sky.js)
At least 6 parallax layers. Ría de Vigo: sea with moving sparkles, the Cíes Islands, the Rande bridge (cable-stayed, two towers, fan cables), Vigo city (white buildings) and port cranes on the far shore, sailboats and a ferry moving slowly, seagulls. Woods area: misty forest layers instead of the sea. Golden morning light (sun glow, light shafts), rain clouds and darker sky during the rain, then a rainbow. Screen-space weather overlay: rain streaks with ground splashes, wind-blown cherry petals and leaves, occasional butterflies; a soft rain hiss under the music while it rains. The scenes crossfade over 180 px of camera travel at each area border (300 px before: about 3 s of walking with the scenery double-exposed). Exposes `l2Weather()` → `{ rain: 0..1, rainbow: 0..1 }` for other modules.

### Scenery — world layer (level2_world.js)
The house: Galician granite stone house, red clay tile roof, chimney with smoke, wooden front door that opens during the intro (`G.introDoor` 0..1), windows with flower boxes, hydrangeas. Hórreo (granite granary on legs with a cross-less gabled roof). Granite walls along the path, chestnut trees (thick gnarled trunks, long serrated leaves, spiky green burrs), cherry trees (dark trunks, clouds of pink and white blossom), ferns, gorse with yellow flowers, mossy boulders, the stream with flowing water and a few stepping stones, vineyard trellises with grapes, corn, haystacks, farmhouse, fences. Ground follows `groundAt` with grass, earth path, rocks, wet sheen while it rains; the soil colour changes at area borders are dithered over a wide band instead of a seam. Foreground plants passing in front. Trees sway in the wind; neighbouring trees of a kind have different canopies. The Galician flag at the farm no longer pops in at the right screen edge.
Interactive props it owns: `cherrytree` (shoot the canopy 3 times → blossom burst + 2–3 `cherry` items fall, once per tree) and `chestnuttree` (shoot the canopy → 3 spiky burrs drop; a burr that lands on an enemy deals 4 damage; burrs break into `chestnut` items; they never hurt the player).
Level-specific platform types it draws (`LV.drawPlat`): `wall` (granite wall), `stump`, `hay`, `cart`, `boulder`.

### Level wiring (level2.js)
The LEVELS[1] definition using all of the above, spawns, locks and waves, the 7 animal rescues, props (cherry/chestnut trees, crates, barrels, the tractor), the intro cutscene (camera at the house, door opens, hero walks out onto the plateau, door closes, "MISSION 2 START!", eagles fly over), weather schedule hook, and three new music tracks for TRACKS: `vigo` (Galician gaita-style jig in 6/8 on a square-wave lead, the D drone from D3 up so laptop speakers carry it), `bearboss` (driving, minor) and `victory` (the ALL MISSIONS COMPLETE screen, looped: the jig's drone under a bright D major tune in 6/8, bpm 150, about as loud as `vigo`). Enter skips the intro to the start banner; the bottom letterbox bar says `ENTER: SKIP` once the location caption has gone (only Enter: Z and X would skip by accident). Difficulty target: the never-dodging harness bot takes ≤ 22 hits over the whole mission and finishes in about 3–4 minutes. Integration result before the 2026-11 review fixes (seeds 1–5, both heroes): 14–16 hits, about 3 minutes, boss fight 51–53 s in the mission flow and 55–64 s on foot with the pistol (see the integration report).

---

## 3. Quality bar (everyone)
- Pixel art consistent with Mission 1: 480×270 canvas, 1px dark outlines (`OUT`), 3-tone shading, chunky readable silhouettes; character art built from `R/RO/blob/makeSprite`, canvas paths only for large background shapes.
- Everything moves: idle animations, wind sway, water flow, smoke, blinking lights.
- Kid-friendly: no blood or gore (robots break into parts and sparks), every danger is telegraphed, nothing unfair, nothing scary beyond cartoon robots.
- No runtime errors: `node harness.mjs sim --level 2` must finish with `errors: []`, and Mission 1 must still complete with no errors.
- Performance: keep each frame cheap (no per-frame canvas creation; cache sprites).
