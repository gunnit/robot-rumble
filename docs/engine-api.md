# Robot Rumble engine API

Reference for everyone adding Mission 2 content. The game is plain JavaScript in `src/`: classic
scripts that share one global scope, loaded in the order of `src/manifest.json`. Spec:
`docs/level2-spec.md`. Every name below is real and used by Mission 1 (`src/level1.js` is the
worked example for nearly everything).

## 1. Files, load order, workflow

| File | Contents |
|---|---|
| `core.js` | canvas `ctx`, `W`/`H`/`GROUND`, helpers, `warnOnce/errorOnce`, input, pixel font `text()`, `R/RO/blob/makeSprite/spr`, `groundAt()` |
| `audio.js` | `Snd`, `say()`, `TRACKS`, `Music` |
| `heroes.js` | `HEROES`, `RUN6`, `drawHero()`, `flashAt()` |
| `weapons.js` | `WEAPONS` (pistol, hmg), `weaponOf()`, `casing()` |
| `engine.js` | registries, state `G`, mission flow, physics, player, enemies, bullets, props, POWs, items, effects, camera, locks, `update()` |
| `level1.js` | Mission 1 (`LEVELS[0]`): soldier/drone/tank/crab, their warnings, crate/barrel, human POW, level data |
| `level1_jungle.js` `level1_camp.js` `level1_bridge.js` `level1_base.js` | Mission 1's painted scenery, one area each: `L1ART.<key> = { x0, x1, steps, bg, behind, ground, plat, front }` |
| `level1_art.js` | joins the four areas into `LEVELS[0]`'s draw hooks and card `preview`; sky crossfade; baking (`L1ART.pump/left/total`) |
| `level1_crab.js` | the Mega Crab's picture (`ENEMY_TYPES.crab.draw`; calls `ENEMY_TYPES.crab.tells(e)` from level1.js) |
| `level1_intro.js` | Mission 1's opening scene (parachute arrival), `startText` / `startSay` |
| `weapons_extra.js` ... `level2.js` | Mission 2 content (one owner each, see spec) |
| `screens.js` | HUD, `drawPlay()`, title, mission select, hero select, win, all clear, game over, pause, `draw()` (only `panel`, `drawStar`, `logoText`, `drawPlay`, `draw` are global) |
| `main.js` | main loop, `devStart()`, sandbox arena, `dev.html?...` options (only `devStart` is global) |

- **Load-time rule:** code that runs while a file loads (top level) may only use earlier files.
  Code inside functions may use anything. Registries are declared in `engine.js` (except
  `WEAPONS`, declared in `weapons.js`), so content files only *add* entries.
- **Names are shared.** A top-level `function drawTree()` in two files silently replaces the first
  one. Wrap private code in a block like `level1.js` does (`'use strict'; { ... }` makes functions
  and consts inside it private) and keep only intended exports at the top level (e.g.
  `function l2Weather()`). Never declare one of the engine's global names at your top level
  (inside your block any name is fine):
  - `core.js`: `W H GROUND cvs ctx resize rand clamp hsh overlap inBox distToBox hex mix circ warned warnOnce
    errorsLogged errorAt errorOnce groundAt keys pressed KEYMAP held tap GLYPHS glyphCache glyph text OUT MET METD
    METL METDD EVIL FLASH R RO blob HEART drawHeart drawCrate makeSprite spr`
  - `audio.js`: `Snd say TRACKS mf BEAT44 drumHit Music`
  - `heroes.js`: `SKIN SKIND BOOT BOOTD BOOTL SOLE FACE INES_HAIR HEROES RUN6 heroLeg flashAt drawHero`
  - `weapons.js`: `GUN GUNL GUND WEAPONS weaponOf casing hmgShot`
  - `level1_*.js`: `L1ART`
  - `engine.js`: `LEVELS LV ENEMY_TYPES PROP_TYPES POW_KINDS ITEMS RIDES EB_TYPES G dbg saveBest missionStars saveRecord newPlayer makeEnemy
    makeProp powKind loadLevel startGame startMission beginMission continueGame toWin boom dust sparks debris
    addScore blast pbox ebox propBox powBox land prevIntroKeys ctl ctlTap hurtPlayer playerRespawn boardRide
    exitRide knifeTarget giveWeapon shoot updatePlayer offStage damageEnemy killEnemy bossDefeated updateEnemies
    updateBullets updateBullet EB_BUILTIN updateEnemyBullets updateEnemyBullet updateGrenades hitProp propHurt
    updateProps freePow updatePows dropItem updateItems letterBox updateFx updateCamera updateLocks updatePlay
    fireworks update drawProp drawPow drawItem drawEnemy drawPlayer drawGrenades drawPB drawEB drawMarkers drawFx`
  - `screens.js`: `panel drawStar logoText drawPlay draw`; `main.js`: `devStart`

  "Identifier 'x' has already been declared" means two files declare `x` at the top level; it is
  reported for the one that loads later. When that is `screens.js` (which loads after all content), a
  content file has taken one of its names above: rename it in the content file.
- **Develop:** open `http://localhost:8123/dev.html` (loads `src/` directly, no build).
  `dev.html?level=2&x=1200&hero=1&god=1` starts Mission 2 at x 1200 as Mathias, invulnerable;
  `dev.html?sandbox=wolf,eagle` opens the test arena.
  The page needs a web server on the game folder. The desktop app's preview server (`.claude/launch.json`,
  `python3 -m http.server 8123`) usually runs already; if not, start one from `/Users/macbookair/game`:
  `python3 -c "import http.server as h,functools;h.ThreadingHTTPServer.request_queue_size=128;h.ThreadingHTTPServer(('',8123),functools.partial(h.SimpleHTTPRequestHandler,directory='.')).serve_forever()"`
  (the plain `http.server` only queues 5 connections and drops bursts beyond that).
  `dev.html` loads the files one at a time and retries a failed one, so it works with either server. Load failures,
  `console.error` messages and uncaught exceptions show in a red box on the page (click it to hide it).
- **Errors don't stop the game:** an exception inside the game loop is logged once per message
  (`console.error`) and the game carries on at full speed: an update that throws still counts as a step,
  and the frame is drawn anyway. An enemy, prop, player bullet or enemy projectile whose own `update` or
  `draw` throws is dropped, so one broken wolf can't stop the mission or blank the screen; any other
  error skips the rest of that update, or the rest of that frame's drawing. While errors happen (and
  for 2 s after the last one) a red `OOPS! ERROR - SEE THE CONSOLE` line shows at the bottom of the
  canvas, also in `index.html`. A failing `dev.html?level=...` start falls back to the title screen.
  The harness reports the same errors under `errors`, with file:line.
- **Ship:** `python3 build.py` writes `index.html` (all files inlined, one `<script>` each). Never
  edit `index.html` by hand.

## 2. Coordinates and conventions

- Canvas 480×270 (`W`, `H`), 60 updates per second. Speeds are px per frame, timers are frames.
- **World space:** x from 0 to `LV.end`; the camera `G.cam.x` scrolls right only, up to
  `LV.end - W` (or the next lock's `at`). There is no vertical camera: y is screen y.
- **Feet:** every character's `x, y` is the point between its feet. `GROUND = 232` is the flat
  baseline; with terrain use **`groundAt(x)`** for "the ground here" (keep it within y 150–245).
- **Boxes** are `{ x, y, w, h }` in world space, `y` = top edge.
- **Facing:** `1` = right, `-1` = left. Draw characters facing right around their feet, after
  `ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);`.
- **Hit flash:** while the global `FLASH` is true, `R/RO/spr/blob` paint white. Enemy draw code sets
  `FLASH = e.hitT > 0` itself and resets it to `false`; the engine does it for props.
- **Randomness:** use `rand(a, b)`; the harness makes `Math.random` deterministic with `--seed`.
  In drawing code prefer `hsh(n)` (stable 0..1 per n) so scenery doesn't flicker.
- **Performance:** never create canvases per frame. Build sprites once (`makeSprite` at load).

## 3. Globals you may use

### Helpers (core.js)
| Name | Use |
|---|---|
| `W, H, GROUND, ctx, cvs` | canvas size, flat ground y, 2D context, canvas element |
| `rand(a, b)` / `clamp(v, a, b)` / `hsh(n)` | random float in [a, b) / clamp / stable hash 0..1 |
| `overlap(a, b)` / `inBox(px, py, b)` / `distToBox(px, py, b)` | box-box, point-box, point-to-box distance |
| `hex(c)` / `mix(a, b, k)` | `'#rrggbb'` → `[r,g,b]` / blend two hex colours → `'rgb(...)'` |
| `circ(x, y, r)` | filled circle in the current `fillStyle` |
| `groundAt(x)` | ground y at world x for the current level (linear between `LV.terrain` points) |
| `warnOnce(kind, name)` | one console warning per unknown name |
| `errorOnce(err)` | log an exception once per message (the game loop does this for errors it catches) |
| `held(a)` / `tap(a)` | keyboard: action held / pressed this frame (`left right up down jump fire bomb ok pause mute quit`; `quit` is Q, read only on the pause screen) |
| `ctl(a)` / `ctlTap(a)` | **player controls**: like held/tap, but follow `G.introKeys` during an intro (an intro key counts as tapped on the first frame the player update sees it, keys set in `intro.start()` included). Use these in rides. |

### Drawing
| Name | Use |
|---|---|
| `R(x, y, w, h, col)` | filled rect (white while `FLASH`) |
| `RO(x, y, w, h, col)` | rect with a 1px `OUT` outline |
| `blob(rects, col)` | several `[x, y, w, h]` rects as one outlined shape |
| `makeSprite(rows, pal)` → `{ img, white, w, h }` | pixel map: rows of palette letters, `.` transparent, `k` stays dark in the white copy |
| `spr(s, x, y)` | draw a sprite (white copy while `FLASH`) |
| `text(s, x, y, col='#ffffff', sc=1, align='left', shadow='#000000')` | 5×7 pixel font, upper case; `align` `'left'|'center'|'right'`; `shadow` `null` for none. Plain A–Z, 0–9 and `! ? . , : - ' / + > < & % ( )` only: accented letters are drawn without the accent (write `RIA`, `CIES`, `HORREO`) |
| `OUT` and `MET METD METL METDD EVIL` | outline colour; robot metal palette + robot-eye red |
| `drawHeart(x, y, s, full)`, `drawCrate(x, y)` | HUD heart, 16×16 wooden crate (top-left at x, y) |
| `drawHero(HEROES[G.hero], x, y, facing, { pose, t, aim, weapon, muzzle, knife, rot })` | the hero; `pose` `'idle'|'run'|'jump'|'crouch'`, `aim` `'fwd'|'up'|'down'` |
| `flashAt(x, y, big)` | muzzle flash |
| `letterBox(it, col, top, ink)` | the H/B-style item crate showing the letter `it.k` |
| `panel(x, y, w, h)`, `logoText(s, y, sc, base, top, shadow)`, `drawStar(x, y, r, col)` | HUD/menu panel, two-tone logo text, star |

### Gameplay and effects (engine.js)
| Name | Use |
|---|---|
| `boom(x, y, s=1)` | explosion (fire, smoke, sparks, ring, shake, sound). `s` = size |
| `blast(x, y, r, dmg, src)` | `boom` + area damage. `src` `'player'`/`'barrel'` hurts enemies, props (99) and frees POWs; `'enemy'` hurts the player |
| `sparks(x, y, n=4, col)` / `debris(x, y, n, col)` / `dust(x, y, n, dir=0)` | particles (sparks and debris bounce on the ground) |
| `addScore(n, x, y)` | add score with a floating number |
| `G.texts.push({ x, y, s, t, c })` | floating text for `t` frames |
| `G.later.push({ t, x, y, s })` | `boom(x, y, s)` after `t` frames |
| `G.markers.push({ x, t })` | Mission 1 target marker; a missile drops on it at `t = 50` |
| `G.shake`, `G.sflash` | screen shake (px, decays) / white screen flash (0..0.6) |
| `makeEnemy(spec, lock)` | create an enemy, then push it to `G.enemies` (e.g. a boss calling wolves: `const w = makeEnemy({ t: 'wolf', x }); w.active = true; G.enemies.push(w);`). An unknown type gives a dead stand-in plus one warning, so this never crashes; the stand-in is dropped on the next update |
| `damageEnemy(e, dmg)` → bool | damage (ignored while `e.inv`, `e.dying` or `e.state === 'dying'`; a type's `shield(e, dmg)` may cut it down or turn it away); kills at 0 hp |
| `hurtPlayer()` | one hit on the hero (or its ride); does nothing while invulnerable, in god mode, during an intro or after the boss is beaten (`G.winT > 0`) |
| `bossDefeated(e)` | end of the **final** boss's death animation: removes it and **ends the mission** (win screen 210 frames later). A mini-boss sets `e.dead = true` instead |
| `land(e, prevY)` | gravity landing for anything with `x, y, vy, onGround, onPlat`: terrain + one-way platforms, sticks to the ground going downhill |
| `dropItem(k, x, y, dir)` | spawn a pickup (skipped with a warning if `ITEMS[k]` is unknown) |
| `giveWeapon(p, name)` | weapon pickup: switch, or top up ammo |
| `casing(p, size)` | spent shell flying out of the hero's gun |
| `freePow(o)` / `hitProp(o, dmg, src)` / `propHurt(o, dmg)` | free a POW / damage a prop / shared prop damage (see Props) |
| `boardRide(p, ride)` / `exitRide(p, ejected)` | get into / out of a ride (see Rides) |
| `ebox(e)`, `pbox(p)`, `propBox(o)`, `powBox(o)` | current hitboxes |

### Audio (audio.js)
- `Snd.tone(type, f1, f2, dur, vol, delay = 0)`: oscillator (`'square'|'triangle'|'sawtooth'|'sine'`) sliding f1→f2 Hz over `dur` s.
- `Snd.noise(dur, vol, freq, delay = 0)`: filtered noise burst (`freq` = low-pass start Hz).
- Ready-made: `Snd.shoot() hmg() laser() jump() hit() clank() boom(big) cannon() throw() hurt() die() pickup() freed() slash() select() win()`.
- `say(text, pitch = 1, rate = 1)`: spoken line (browser voice; silently does nothing without one).
- `Music.play(name)` / `Music.stop()`. Tracks: `TRACKS[name] = { bpm, bass: [...], mel: [...], lead?, drums? }`;
  one entry per eighth note, MIDI note numbers (69 = A4), `0` = rest; arrays loop independently.
  `lead` = melody oscillator (default `'square'`). `drums` = `{ kick, snare, hat }`, one char per
  eighth, `'x'` = hit, e.g. a 6/8 jig: `{ kick: 'x..x..', hat: '.xx.xx' }`. Only the drums you list play
  (a drum left out, or `''`, is silent). Without `drums` you get the 4/4 beat
  `{ kick: 'x...', snare: '....x...', hat: '.x' }`.

```js
TRACKS.vigo = { bpm: 200, lead: 'triangle', bass: [38, 0, 0, 38, 0, 0], mel: [62, 66, 69, 71, 69, 66], drums: { kick: 'x..x..', hat: '.xx.xx' } }; // no snare
```

### State `G` (engine.js)
`G.state` (`'title' 'missions' 'select' 'play' 'pause' 'over' 'win' 'allclear'`), `G.t` (frame
counter, always running), `G.level` (index into `LEVELS`), `G.hero`, `G.score`, `G.lives`,
`G.time` (play frames this mission), `G.section`, `G.checkpoint`, `G.cam.x`, `G.p` (player),
`G.enemies`, `G.props`, `G.pows`, `G.items`, `G.pb` (player bullets), `G.eb` (enemy
projectiles), `G.grenades`, `G.parts`, `G.locks`, `G.freed` (Set of freed POW ids),
`G.banner = { s, t }` (area name, 200 frames), `G.big = { s, t }` (big centre banner, 130 frames),
`G.warnT` (WARNING frames), `G.intro`, `G.introKeys`, `G.winT`, `G.rec` (per-mission records for the cards:
`G.rec[i] = { stars, best }`, saved on every win under `robotRumbleRecords`; `best` = points earned in that mission,
`G.score - G.score0`).
Player `G.p`: `x, y, vx, vy, facing, onGround, onPlat, crouch, aim, t, hearts (max 3), inv
(invulnerable frames), weapon, ammo, bombs, fireCd, muzzle, knife, dead (0 or frames since death),
ride, hidden` (`true` = not drawn, e.g. still inside the house during an intro; `newPlayer()` leaves it unset).

## 4. Registries

Unknown names never crash the game: an enemy type (`makeEnemy` gives a dead stand-in), prop kind,
item, POW kind (falls back to `'human'`), weapon (falls back to the pistol), ride, enemy projectile
kind (removed before it can hurt) or music track that doesn't exist yet is skipped with one
`console.warn` per name (the harness lists them under `warnings`).

### ENEMY_TYPES
`ENEMY_TYPES[name] = { hp, boss?, bossName?, flying?, activateMargin?, edge?, armored?, melee?, contact?, make?(e, spec), update(e), draw(e), box(e), shield?(e, dmg), onKill?(e, cx, cy, box) }`

- Every enemy `e` has `type, x, y (feet), vx, vy, t, hitT, facing (-1), active, dead, lock, hp, max`
  plus whatever `make` adds. `e.state === 'intro'` or `'dying'` (or `e.dying`, see `onKill`) switches
  off touch damage and grenade hits, hides the boss bar and the hero doesn't knife it; `e.inv` truthy =
  immune to damage. A dying enemy (`e.dying` or `e.state === 'dying'`) also lets player bullets fly
  through to whatever is behind it, unless it is a boss: a boss's wreck still stops them with sparks,
  like Mission 1's crab.
- `hp` starting health (`max` = `hp` unless `make` sets it). `boss: true` shows the boss bar
  (`bossName`, `hp / max`, hidden during `'intro'`/`'dying'`/`e.dying` and on GAME OVER) and stops it being removed off screen.
  `flying` = the bot aims up at it. `activateMargin` (default 30): spawned enemies wake up when
  this close to the right screen edge. `edge` (default 16): wave enemies appear this far outside
  the screen. `armored` = clank sound on hits. `melee` = the hero knifes it at close range.
- `shield(e, dmg)` → the damage that gets through (optional; asked by `damageEnemy` before every hit, whatever dealt
  it). `0` or less turns the hit away: no hp lost, no hit flash, no sound (play your own), `damageEnemy` returns
  `false`. More than `dmg` is allowed (a weak moment). Mission 8's CLUBTAIL uses it: only 10 hit points get through
  per attack of hers, and hits count double while she is dizzy.
- `contact`: `'hurt'` (default), `'block'` (pushes the hero, or the ride's box by its edges, back out;
  harmless; the push never takes the hero past the screen edges, `G.cam.x + 8` to `G.cam.x + W - 8` like the
  camera, so a block enemy walking into a locked screen can't hide the hero), `'none'`, or a function
  `e => 'hurt' | 'block' | 'none'` (e.g. hurt only while swiping).
- Each frame the engine does `e.t++`, `e.hitT--`, `update(e)`, then contact. Move yourself;
  use `land(e, prevY)` or `e.y = groundAt(e.x)` for ground. Enemies left 120px behind the camera
  are removed (not bosses).
- `box(e)` height: the hero's standing shots fly at feet − 19 and crouching shots at feet − 11
  (pistol). A short enemy (wolf) whose box reaches less than about 24px above its feet gets missed by
  standing shots on slopes; that's fine if crouch shots are meant for it.
- `onKill(e, cx, cy, box)` runs at 0 hp (cx, cy = hitbox centre): effects + `addScore`. The
  engine then sets `e.dead = true`, unless onKill returns `'dying'`: then the enemy stays with
  `e.dying = true` (immune, harmless to touch, no boss bar, no knife, `hitT` reset, shots pass through
  unless it is a boss) and runs its own death
  animation in `update` (any `e.state` you like), ending it with `bossDefeated(e)` (the final boss:
  ends the mission) or `e.dead = true` (anything else, e.g. the AREA 2 bear mini-boss).
- Final boss kill (Mission 1's crab and the MEGA BEAR): the `onKill` that returns `'dying'` also sets
  `G.winT = 360`. While `G.winT > 0` `hurtPlayer()` does nothing, so no leftover shot or enemy can hurt the
  hero during the death animation; `bossDefeated(e)` at frame 150 of the animation sets it to 210, the same
  win time (360 frames after the kill). A hero already falling on the last life gets one back there
  (`if (G.p.dead && G.lives <= 1) G.lives = 2;`), so the respawn comes instead of GAME OVER and the kill still wins.
- `boss: true` on a mini-boss is fine (bar + not culled): the mission card names the boss of the
  `boss: true` lock.
- `draw(e)` runs in world space for active enemies.

```js
ENEMY_TYPES.hopper = {
  hp: 3, contact: 'hurt',
  make(e) { e.cd = 60; },
  update(e) {
    const py = e.y;
    if (e.x > G.cam.x + W - 30) e.x -= 0.8;                   // walk on screen first
    e.facing = G.p.x < e.x ? -1 : 1;
    if (--e.cd <= 0 && e.onGround) { e.vy = -4; e.cd = 90; }  // hop
    e.vy = Math.min(e.vy + 0.26, 6); e.y += e.vy; land(e, py);
  },
  draw(e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
    FLASH = e.hitT > 0;
    RO(-8, -14, 16, 14, MET); R(2, -11, 3, 2, EVIL);
    FLASH = false; ctx.restore();
  },
  box: e => ({ x: e.x - 8, y: e.y - 14, w: 16, h: 14 }),
  onKill(e, cx, cy, b) { boom(cx, cy, 0.7); debris(cx, cy, 6, MET); addScore(100, cx, b.y); }
};
```

### PROP_TYPES
`PROP_TYPES[kind] = { make?(o, spec), box(o), hit(o, dmg, src), update?(o), draw(o) }`

- Level props `{ k, x, ...anything }` become `o` = a copy of the spec plus `y` (= `groundAt(x)`
  unless the spec gives `y`), `hitT: 0`, `dead: false`; then `make(o, spec)` (set `o.hp` here).
- Player bullets call `hit(o, b.dmg, 'bullet')` and stop; blasts call `hit(o, 99, 'player' |
  'barrel')`. `propHurt(o, dmg)` does the usual hp/flash/click and returns true once broken.
  `box(o)` returns the hitbox, or `null` for props that can't be hit (e.g. a parked vehicle).
- Each frame: `o.hitT--`, `update(o)`. Set `o.dead = true` to remove it; props 60px behind the
  camera are removed. The engine sets `FLASH = o.hitT > 0` around `draw(o)` (world space).

```js
PROP_TYPES.pumpkin = {
  make(o) { o.hp = 3; },
  box: o => ({ x: o.x - 7, y: o.y - 12, w: 14, h: 12 }),
  hit(o, d) {
    if (!propHurt(o, d)) return;
    o.dead = true; debris(o.x, o.y - 6, 8, '#e67e22'); addScore(50, o.x, o.y - 14);
    if (o.item) dropItem(o.item, o.x, o.y - 10, 0);
  },
  draw(o) { RO(o.x - 7, o.y - 12, 14, 12, '#e67e22'); R(o.x - 1, o.y - 15, 2, 3, '#2e7d32'); }
};
// level: props: [{ k: 'pumpkin', x: 900, item: 'heart' }]
```

### POW_KINDS
`POW_KINDS[kind] = { draw(o), box?(o), thanks, onFree?(o), run?(o) }` (default kind `'human'`, Mission 1's
prisoner).

- `o = { id, x, y, item, kind, state, t }`; `state` is `'tied' | 'free' | 'salute' | 'run'`, `y`
  follows the ground. `t` counts frames since the level loaded while tied, then restarts at 0 when it
  is freed and keeps counting through the other states (it does **not** restart per state).
- Freed by touching, a bullet in `box(o)` (default `{ x: o.x - 8, y: o.y - 32, w: 18, h: 32 }`) or
  a player blast: +500 points, `Snd.freed()`, floating `thanks`, then `onFree(o)` (play its own
  sound). Engine timeline after freeing: `'free'` from t 0, `'salute'` from t 24 (drops `o.item` at
  t 40), `'run'` from t 64. The default escape runs left 2.2 px/frame along the ground. A kind can supply `run(o)` to move across platforms or other terrain. `G.freed` counts rescues; set
  `freedLabel: 'ANIMALS RESCUED'` on the level for the win screen.
- Standing shots fly at feet − 19: a cage `box` lower than about 20px is only freed by crouch shots,
  touching or blasts.

```js
POW_KINDS.dog = {
  thanks: 'WOOF!',
  draw(o) {
    ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
    if (o.state === 'run') ctx.scale(-1, 1);
    if (o.state === 'tied') { RO(-12, -20, 24, 20, '#566573'); }    // the cage
    RO(-7, -9, 14, 7, '#c49a6c'); RO(4, -13, 6, 6, '#c49a6c');
    ctx.restore();
  },
  box: o => ({ x: o.x - 12, y: o.y - 20, w: 24, h: 20 }),
  onFree() { Snd.tone('square', 600, 900, 0.08, 0.1); Snd.tone('square', 600, 900, 0.08, 0.1, 0.12); }
};
// level: pows: [{ x: 560, item: 'S', kind: 'dog' }]
```

### ITEMS
`ITEMS[k] = { draw(it), collect(it, p) }`. Existing: `H` (heavy machine gun), `B` (+10 grenades),
`heart`, `coin` (500 points).

- `it = { k, x, y (feet), vx, vy, onGround, t }` falls and lands by itself; touching it after
  10 frames plays `Snd.pickup()` and calls `collect(it, p)`. Spawn with `dropItem(k, x, y, dir)`
  (crates and POWs do this for their `item`).

```js
ITEMS.S = {
  draw: it => letterBox(it, '#e74c3c', '#ff9a8a', '#ffffff'),
  collect(it, p) { giveWeapon(p, 'shotgun'); G.texts.push({ x: it.x, y: it.y - 24, s: 'SHOTGUN!', t: 80, c: '#ffe066' }); say('Shotgun!'); }
};
```

### WEAPONS
`WEAPONS[name] = { label, ammo, maxAmmo, cd, tapCd?, muzzle(aim), fire(p, mx, my, dx, dy), drawGun(aim, ty, r), icon(x, y), bigFlash?, flash?(x, y, aim) }`

- `ammo`: per pickup (`Infinity` = the pistol), capped at `maxAmmo` when topping up. The engine
  spends 1 per shot and falls back to the pistol at 0.
- `cd`: frames between shots while fire is held; tapping can fire once `p.fireCd <= tapCd`
  (default 4).
- `muzzle(aim)` → `[x, y]` relative to the hero's feet, facing right, standing (`aim` is
  `'fwd' | 'up' | 'down'`; down only in the air). The engine mirrors it, adds 8 when crouching and
  starts forward shots 6px behind it.
- `fire(p, mx, my, dx, dy)`: world muzzle point and direction (`(±1, 0)`, `(0, -1)` up,
  `(0, 1)` down). Push bullets to `G.pb`, call `casing(p, size)`, play a sound. The engine then
  sets `p.fireCd = cd` and `p.muzzle = 4` (flash frames).
- `drawGun(aim, ty, r)`: hero-local space (feet at 0,0, facing right; `ty` = torso top, about -21
  standing / -13 crouching; `r` = 1 recoil pixel). The hand is already drawn.
- `icon(x, y)`: HUD icon, top-left at (131, 9), about 18×8 px. `label` is shown next to it.
- Muzzle flash: `flashAt` (bigger with `bigFlash: true`), or your own `flash(x, y, aim)`.

**Player bullets** in `G.pb`: `{ x, y, vx, vy, dmg, life, pierce?, update?(b), draw?(b), onHit?(b, e), onGround?(b), onProp?(b, o), onPow?(b, o) }`.
Each frame: `update(b)` (steer: homing, gravity, growth; setting `b.life = 0` there removes it at
once, e.g. a rocket exploding by proximity), then `x += vx, y += vy, life--`. Removed at `life` 0,
10px off the left, right or top edge, or below the bottom of the screen. Then, in this order:
- reaching `groundAt(x)`: sparks, or `onGround(b)` instead;
- touching an enemy's box: `damageEnemy(e, dmg)` + sparks, or `onHit(b, e)` instead; removed unless
  `pierce` (a piercing bullet hits each enemy once). Shots fly through a dying enemy that isn't a boss;
- touching a prop's box: `hit(o, dmg, 'bullet')`, or `onProp(b, o)` instead;
- touching a tied POW's cage: `freePow(o)`, or `onPow(b, o)` instead;
- within 8px of a shootable enemy projectile: both are destroyed.

Ground, props and cages stop every bullet (even `pierce`) unless its `onGround` / `onProp` / `onPow`
returns exactly `true` (e.g. a bouncing grenade-shot, or a falling chestnut burr that passes through its tree:
`onProp: () => true`). Any other value stops it, so an arrow body that returns something by accident
(`b => G.texts.push(...)` returns a number) is safe. A rocket explodes in all three: `onGround/onProp/onPow(b) { blast(b.x, b.y, 26, 6, 'player'); }`.
`draw(b)` in world space (default: the yellow pistol shot).

```js
WEAPONS.shotgun = {
  label: 'SHOTGUN', ammo: 30, maxAmmo: 60, cd: 22, tapCd: 8, bigFlash: true,
  muzzle: aim => aim === 'up' ? [5, -42] : aim === 'down' ? [1, 0] : [22, -19],
  fire(p, mx, my, dx, dy) {
    for (let i = -2; i <= 2; i++) {
      const a = Math.atan2(dy, dx) + i * 0.12;
      G.pb.push({ x: mx, y: my, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, dmg: 2, life: 17,
        draw: b => R(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3, '#ffd23f') });
    }
    casing(p, 2); Snd.cannon();
  },
  drawGun(aim, ty, r) { if (aim === 'fwd') { RO(5 - r, ty, 16, 4, '#6b4423'); R(5 - r, ty, 16, 1, '#8b5a2b'); } else RO(3, aim === 'up' ? ty - 18 : ty + 9, 4, 14, '#6b4423'); },
  icon(x, y) { RO(x, y + 1, 16, 4, '#6b4423'); }
};
```

### RIDES
`RIDES[type] = { update(p, ride), box(p, ride), draw(p, ride), hurt(p, ride), hud(ride), help? }`

- `ride` is any object with a `type` (keep armour, ammo, cooldowns on it). `boardRide(p, ride)`
  sets `p.ride` (returns false for an unknown type); `exitRide(p, ejected)` clears it, pops the hero
  out with a hop (`ejected`: higher, 120 frames invulnerable, knocked back) and returns the ride.
- While `p.ride` is set the engine still counts `p.t`, `p.inv` and runs the camera, but:
  `update` replaces the whole normal player update (move `p.x`/`p.y` yourself, feet on the ground,
  read `ctl()`/`ctlTap()`, fire into `G.pb`); `box` is the hurtbox for enemies and projectiles
  and the pickup box for items (POWs are still freed by touching `p.x`/`p.y`; the box may be
  off-centre, `'block'` enemies push it out by its edges); `hurt` is called
  instead of losing a heart (after the invulnerability check: set
  `p.inv` for mercy frames); `draw` replaces the hero (draw the hero in the seat with `drawHero`);
  `hud(ride)` fills the weapon panel (screen x 126–230, y 4–32) instead of weapon and grenades.
- `help` (optional): one line with the ride's own keys, shown on the pause screen (green, under the key
  panel) while the hero rides it, e.g. the tractor's `'C: CANNON   DOWN+Z: GET OUT'`. Pixel-font glyphs only,
  up to about 40 characters. Without it the pause screen shows only the on-foot keys.
- A parked vehicle is a prop whose `update` calls `boardRide` when the hero touches it, then sets
  `o.dead = true`; the bot walks into any prop whose kind is also a `RIDES` key.
- Fire the forward gun low: a wolf is about 22px tall, so a shot at feet − 14 or lower also hits one
  standing a little downhill (the hero's standing shot flies at feet − 19). Let ↓ + Z (`ctl('down')` +
  `ctlTap('jump')`) get out, like the cart below: the bot leaves a ride that hurts nothing for 1.5 s.

```js
RIDES.cart = {
  help: 'X: FIRE   DOWN+Z: GET OUT',
  update(p, r) {
    const mv = ctl('left') && !ctl('right') ? -1 : ctl('right') && !ctl('left') ? 1 : 0;
    if (mv) p.facing = mv;
    p.x += mv * 1.4; p.y = groundAt(p.x);
    if (r.cd > 0) r.cd--;
    if (ctl('fire') && r.cd <= 0) { r.cd = 7; G.pb.push({ x: p.x + p.facing * 16, y: p.y - 14, vx: p.facing * 6, vy: 0, dmg: 1, life: 80 }); Snd.hmg(); }
    if (ctlTap('jump') && ctl('down')) exitRide(p, false);
  },
  box: p => ({ x: p.x - 14, y: p.y - 26, w: 28, h: 26 }),
  draw(p) { drawHero(HEROES[G.hero], p.x, p.y - 8, p.facing, { pose: 'idle', t: p.t, aim: 'fwd' }); RO(Math.round(p.x) - 14, Math.round(p.y) - 16, 28, 12, '#3355aa'); },
  hurt(p, r) { if (--r.hp <= 0) { exitRide(p, true); boom(p.x, p.y - 10); } else p.inv = 60; },
  hud(r) { text('CART', 154, 8, '#ffe066'); for (let i = 0; i < 3; i++) R(154 + i * 8, 20, 6, 4, i < r.hp ? '#8be0a8' : '#3a3a4a'); }
};
PROP_TYPES.cart = {
  box: () => null, hit() {},
  update(o) { const p = G.p; if (!p.dead && !p.ride && Math.abs(p.x - o.x) < 10 && boardRide(p, { type: 'cart', hp: 3, cd: 0 })) o.dead = true; },
  draw(o) { RO(o.x - 14, o.y - 16, 28, 12, '#3355aa'); }
};
```

### EB_TYPES (enemy projectiles)
Enemy projectiles live in `G.eb`: `{ k, x, y, vx, vy, g?, r?, life, shoot? }`. Built-in kinds:
`laser orb mg shell bomb mup mdown wave` (`wave` = ground shockwave: jump it; `bomb`/`shell`
explode on the ground). New kinds: `EB_TYPES[k] = { r, update?(b), draw(b), onGround?(b), onHit?(b), shootable? }`.
Each frame: `update(b)`, `x += vx, y += vy, vy += g, life--`; touching the hero (`distToBox <
b.r ?? r`) → `hurtPlayer()`, `onHit(b)`, removed; reaching `groundAt(x)` → `onGround(b)` and
removed (return exactly `true` from onGround to keep it, e.g. to bounce); removed 30px off screen.
`shootable` (or `b.shoot`): the hero's bullets destroy it. A `k` that is neither built in nor in
`EB_TYPES` (not written yet, or misspelled) is removed on its first update with one warning, so it can
never hurt the hero unseen.

```js
EB_TYPES.boulder = {
  r: 6, shootable: true,
  draw(b) { RO(Math.round(b.x) - 5, Math.round(b.y) - 5, 10, 10, '#8d8478'); },
  onGround(b) { debris(b.x, groundAt(b.x) - 3, 6, '#8d8478'); G.shake = Math.max(G.shake, 2); }
};
// thrown from an enemy's update(e):
// G.eb.push({ k: 'boulder', x: e.x, y: e.y - 40, vx: e.facing * 2.2, vy: -4, g: 0.15, life: 300 });
```

## 5. Levels

`LEVELS.push({...})` (Mission 2 goes to `LEVELS[1]`; the mission select shows a locked "COMING
SOON" card until it exists). `LV` is the level being played.

| Field | Meaning |
|---|---|
| `mission`, `title` | card / win screen names, e.g. `'MISSION 2'`, `'VIGO HILLS'`. Set both (a card without them shows `MISSION n` and no title) |
| `end` | level length; the camera stops at `end - 480` |
| `heroStart` | hero x on a fresh start (checkpoints start at checkpoint x + 60) |
| `sections: [{ x, name }]` | areas: passing `x + 30` shows the name and makes `x` the checkpoint. `sections[0].x` must be 0 |
| `terrain: [[x, y], ...] \| null` | ground outline for `groundAt` (sorted by x, clamped at the ends); `null` = flat `GROUND` |
| `plats: [{ x, y, w, t }]` | one-way platforms (top at `y`, from `x` to `x + w`); `t` is yours for `drawPlat`. Down+Jump drops through |
| `spawns: [{ t, x, y? }]` | enemies placed at load (`y` defaults to the ground; flyers pick their own height) |
| `pows: [{ x, item, kind? }]` | rescues, `kind` defaults to `'human'` |
| `props: [{ k, x, ... }]` | props; extra fields are copied onto the prop |
| `locks: [{ at, waves, boss? }]` | camera locks, see below |
| `music`, `bossMusic` | `TRACKS` names (default `'main'` / `'boss'`) |
| `startText`, `startSay` | band text and spoken line of a start without an intro, of a continue and of a `devStart` build (default `'MISSION START!'` / `'Mission start!'`), e.g. `'MISSION 2 START!'` / `'Mission two, start!'`. An intro shows and says its own |
| `clearMusic` | `TRACKS` name for the ALL MISSIONS COMPLETE screen when this is the last mission, started just after its jingle (default `'victory'`; played only if `TRACKS` has it, otherwise silence and no warning) |
| `freedLabel` | optional win-screen label for rescues (default `'PRISONERS FREED'`) |
| `drawBG(cx)` | **screen space** (shake applied). Paint the whole sky/background: nothing clears the canvas |
| `drawBehind(cx)`, `drawGround(cx)` | **world space** (`ctx` translated by `-cx`), behind everything else |
| `drawPlat(pl)` | **world space**, called for each platform within 20px of the screen |
| `drawFront(cx)`, `drawOverlay(cx)` | **screen space** (shake applied), after all world objects: foreground plants, then weather/light |
| `drawHUD()` | Fixed screen coordinates after the shared HUD, before the intro overlay. Use for mission equipment or objectives. |
| `updateScene()`, `drawScene()` | Optional alternate playable scene. Return true to take over that tick or to paint the full frame including its HUD. The play clock, pause controls, and music continue through the usual game loop. Return false to run or render the normal side-scrolling world. |
| `beforePlayerUpdate()` | After the intro step and before movement and firing. Use for input that must affect the current shot. |
| `update()` | once per play frame, after all objects (also during the intro) |
| `load(cp)` | optional: after the level is (re)built for camera x `cp` (start: 0, continue: the checkpoint, `devStart` with an x: that camera x): reset all level state there. Runs once per build, before `intro.start()` |
| `intro: { start(), update(), draw() } \| null` | opening cutscene, below |
| `preview(x, y, w, h)` | mission card art, **screen space**, clipped to the rect (180×96 with two cards). `G.p` may be null and `LV` may be another level: don't use them or `groundAt`. Give every mission one (scenery, the hero `HEROES[G.hero]` and an enemy, like Mission 1's `drawPreview`): without it the card only shows its colours and the hero |
| `menuBG()` | hero select backdrop while this mission is chosen: **screen space**, paint the whole screen, every frame (Mission 1, and a mission without it, shows the jungle). It may build its caches once. `G.p` may be null and `LV` may be another level or null: don't use them or `groundAt`, and no `Math.random`/`rand` |

All hooks are optional except the data arrays. Draw order each frame: `drawBG` → (world)
`drawBehind`, `drawGround`, platforms, props, markers, POWs, items, enemies, hero, grenades,
bullets, enemy projectiles, particles/texts → `drawFront` → `drawOverlay` → screen flash → HUD →
`intro.draw()`. On entry `FLASH` is false and `globalAlpha` 1; set the colours and line widths you
use and leave `ctx` as you found it (`save`/`restore` around transforms and clips).

### Spawns, locks, waves, sections
- **Spawns** with `x >= checkpoint + 40` are created when the level loads, asleep until they come
  within `activateMargin` of the right screen edge.
- **Locks**: when the camera reaches `at` it stops scrolling and the lock starts (`boss: true`:
  WARNING banner + `bossMusic`). Each wave `{ t, side, d, y?, ...anything }` appears `d` frames after
  the start just outside the left (`side: -1`) or right (`side: 1`) edge, awake, facing into the screen.
  Like spawns, the whole entry (with `x` set) reaches `make(e, spec)`, e.g. `{ t: 'wolf', side: 1, d: 30, leader: true }`.
  The lock ends when all its waves have appeared and every enemy with `e.lock === lock` is gone
  (dead or culled); then "GO >" shows and the camera scrolls on. **Wave enemies must move onto the
  screen by themselves**, or the lock can never be finished.
- A boss lock never shows GO: the mission ends 210 frames after `bossDefeated(e)`.
- **Checkpoints**: continuing after game over reloads the current mission at the last section
  reached (`G.checkpoint`): locks with `at` before it count as done, spawns/props/POWs from there
  on are recreated, the intro does not replay.

### Mission flow and intro
Title → mission select (a card per `LEVELS` entry, `preview` art) → hero select (the chosen mission's
`menuBG`, else the jungle) → mission. After a win, Enter starts the next mission with the same hero and
score (lives back to 3); after the last mission: ALL MISSIONS COMPLETE (the last mission's `clearMusic`,
else `TRACKS.victory` when it exists, starts 72 frames in, just after the jingle) → title, where the
music stops and the mission select starts again on Mission 1. A game over whose countdown runs out also
goes to the title but keeps the mission, so the mission select opens on the mission just lost. On the
pause screen Q (`quit`) goes back to the title: the best score is saved, the music stops and the mission
select opens on the paused mission; the next start builds it afresh from its beginning. While Mission 1
is the only mission, its win screen says PRESS ENTER TO PLAY AGAIN and goes back to the title, as before
Mission 2.

On a fresh mission start with `intro` set (not a continue, not `devStart` with an x):
`intro.start()` runs once, then `intro.update()` every frame before the player update until it
returns `true`. Meanwhile the keyboard is ignored and the player is driven by `G.introKeys` (e.g.
`G.introKeys = { right: t < 40 }` walks the hero right; `{ jump: true }` on one frame jumps, a key
counts as tapped on the first frame the player update sees it, also when `intro.start()` sets it), the
hero can't be hurt, `G.time` doesn't count, and
the engine shows no area banner, no MISSION START and says nothing: show
`G.big = { s: 'MISSION 2 START!', t: 130 }`, `G.banner = { s, t: 200 }` and `say(...)` yourself.
Every start without the intro (a mission without one, a continue, `devStart` with an x) shows the area name and
`LV.startText` and says `LV.startSay`.
`G.p.hidden = true` keeps the hero out of sight (inside the house) until he steps out: set it back to `false`
yourself (Mission 2's `load(cp)` resets it too).
`intro.draw()` is drawn last (screen space, over the HUD), e.g. letterbox bars.

```js
LEVELS.push({
  mission: 'MISSION 2', title: 'VIGO HILLS', end: 6200, heroStart: 120, freedLabel: 'ANIMALS RESCUED',
  sections: [{ x: 0, name: 'AREA 1: HOME SWEET HOME' }, { x: 1350, name: 'AREA 2: CHESTNUT WOODS' }],
  terrain: [[0, 176], [250, 176], [520, 224], [700, 232], [6200, 232]],
  plats: [{ x: 1600, y: 206, w: 60, t: 'wall' }],
  spawns: [{ t: 'wolf', x: 820 }, { t: 'eagle', x: 980 }],
  pows: [{ x: 560, item: 'S', kind: 'dog' }],
  props: [{ k: 'crate', x: 700, item: 'coin' }],
  locks: [{ at: 900, waves: [{ t: 'wolf', side: 1, d: 20 }, { t: 'wolf', side: -1, d: 80 }] },
          { at: 5720, boss: true, waves: [{ t: 'megabear', side: 1, d: 60 }] }],
  music: 'vigo', bossMusic: 'bearboss', startText: 'MISSION 2 START!', startSay: 'Mission two, start!',
  drawBG(cx) { ctx.fillStyle = '#8fd0ff'; ctx.fillRect(-10, -10, W + 20, H + 20); },
  drawGround(cx) {
    ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.moveTo(cx - 10, H);
    for (let x = cx - 10; x <= cx + W + 10; x += 4) ctx.lineTo(x, groundAt(x));
    ctx.lineTo(cx + W + 10, H); ctx.fill();
  },
  drawPlat(pl) { RO(pl.x, pl.y, pl.w, groundAt(pl.x) - pl.y, '#8a8f98'); },
  intro: (() => {
    let t = 0;
    return {
      start() { t = 0; },
      update() {
        G.introKeys = { right: ++t < 30 };
        if (t === 40) { G.big = { s: 'MISSION 2 START!', t: 130 }; say('Mission two, start!'); }
        return t >= 60;
      },
      draw() { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 20); ctx.fillRect(0, H - 20, W, 20); }
    };
  })(),
  preview(x, y, w, h) { ctx.fillStyle = '#8fd0ff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#4caf50'; ctx.fillRect(x, y + h - 24, w, 24); }
});
```

## 6. Testing

**Harness** (`/Users/macbookair/game/tools/harness/harness.mjs`, see the README there). It runs the real
`src/` files headless; errors come back with file:line.

```sh
H=/Users/macbookair/game/tools/harness
node $H/harness.mjs sim --level 2 --seed 1                 # bot playthrough → JSON
node $H/harness.mjs sim --sandbox wolf,eagle --frames 3000 --god
node $H/harness.mjs render --level 2 --x 1200 --frames 60 --out $H/shots/l2-1200.png
node $H/harness.mjs render --level 2 --frames 90 --out $H/shots/l2-intro.png   # no --x: the mission start, intro included
node $H/harness.mjs render --sandbox wolf,eagle --x 300 --frames 90 --out $H/shots/wolves.png
node $H/harness.mjs render --screen missions --out $H/shots/missions.png
node $H/harness.mjs render --level 2 --screen win --out $H/shots/l2-win.png  # also over, pause, allclear
node $H/harness.mjs sim --level 2 --extra my-draft.js      # load an extra file after the manifest
```

`sim` prints `{ completed, state, errors[], hitsBySection[], deaths, continues, seconds, frames,
score, freed, x, level, warnings[] }`. `errors` must stay `[]` (it also lists the errors the game
caught and logged, with file:line). The bot faces the nearest enemy and
holds fire, walks toward targets its shots can't reach, crouches for short ones its standing shot
passes over, aims up at flyers overhead, jumps every 42 frames, throws grenades at wide enemies and
walks into vehicles; in a ride it drives up to its target (under a flyer, holding Up) and gets out
(↓ + Z) to fight on foot when nothing gets hurt for 1.5 s. It never dodges. Look at every render with the Read tool.

**In the browser** (`dev.html` or `index.html`), from the console:
- `devStart({ level: 2, hero: 1, x: 3000, god: true, frames: 0 })`: start mission 2 at x 3000
  (built straight there: earlier locks done, enemies from there on, no intro), run `frames` updates,
  draw, return a summary. Without `x` the mission starts from the beginning, intro included.
  `level` is the mission number; `sandbox: ['wolf', 'eagle']` opens a flat arena where those
  enemies keep appearing ahead of the hero (bosses come back instead of ending the run).
- `G` is the whole game state, `dbg.god = true` makes the hero invulnerable, `dbg.onHurt =
  section => ...` is called on every hit the hero takes.


## Mission 4: Coral Kingdom (2026-11-13)

`level4_art.js`, `level4_player.js`, `level4_enemies.js`, `level4.js` load after `level3.js`.
They share `var L4` and register new content without replacing the engine's land physics.
`RIDES.scuba` is the swimming controller (the hero remains a swimmer, not a physical vehicle);
`RIDES.minisub` is the optional submarine, parked as `PROP_TYPES.oceansub`.
Enter boards/exits; arrows/WASD move in four directions; X/J fires bubbles and C/L fires torpedoes.
Vertical input controls swimming, not aim. The existing hearts/lives/continue flow still applies.
A destroyed submarine ejects an invulnerable swimmer. `L4.playerLoad/playerUpdate` restore swimming
on load or respawn. POW heights and floating rewards are owned by this mission's load/update hooks.
`LV.controls` optionally provides the first two pause instructions; the ride's existing `help`
field provides the boarding hint. The mission selector windows three cards when four or more exist.

Verification: `node tools/mission4/test.mjs controls`;
`node tools/mission4/sim.mjs 0 1 swim`; `node tools/mission4/sim.mjs 1 2 sub`.
`RR_HTML=/absolute/path/index.html` runs these tests against a standalone bundle.
The generic engine stand-in is the mission after the last real one. With eight campaign missions, run
`node tools/harness/harness.mjs sim --level 9 --extra tools/harness/fixtures/engine-selftest.js`.


## Mission 5: Alien Mothership (2026-11-16)

Spec and builder contract: `docs/level5-spec.md`. Twelve files load after `level4_intro.js`: `level5_cast.js`,
`level5_enemies.js`, `level5_saucers.js`, `level5_gear.js`, `level5_boss.js`, `level5_hangar.js`, `level5_garden.js`,
`level5_space.js`, `level5_bridge.js`, `level5_scenery.js`, `level5.js`, `level5_intro.js`.
New top-level names (never declare them elsewhere): `M5` (the cast's looks: palette, pixel helpers, `oggle`, `drone`,
`roller`, `flower`, `cow`, `pod`, `burst`, ...), `L5` (level logic: `level`, `nectarAt`, `lowG`, `paddock`, `meteor`,
`craneCrate`, `drawCargo`, the joiner's draw hooks), `L5ART` (area art: `hangar`, `garden`, `space`, `bridge`, `card`,
`helmet`, `groundAt`, `pump/left/total/bakeAll`, `bakes`).
Registry names it adds: enemies `oggle roller eyeflower eyedrone bigsaucer megaoggle`; props `cargo paddock miniufo
miniufopad miniufodock miniufowreck ogwreck`; POW kind `podcow` (Mission 2 owns `cow`); ride `miniufo`; weapon
`raygun` with item `Z`; projectiles `ogring oseed odbeam od* mo*`; tracks `mothership spacewalk oggleboss`.
Level rules live in `level5.js` and never touch the engine: nectar wading (60 % speed), low gravity on foot over the
hull (x 3300-4990), bouncy pink caps, the hearts rule, the hazard schedule, the paddock stampede, the BIG SAUCER's
lock (GO > and the tune afterwards). Enemy types carry `grab: true | false` and `cargoDraw(x, y, t, rot, e)` for the
MINI UFO's beam.

Verification: `node tools/harness/harness.mjs sim --level 5 --seed 1`; rule tests
`... sim --level 5 --seed 1 --frames 1 --extra tools/m5/build/skeleton/t-rules.js` (62 checks); the tuning log
`sh tools/m5/build/coord/batch.sh "1 2 3 4 5 6 7 8 9 10 11 12"` (never-dodging bot, 2026-11-16: 11.9 hits on average,
per area 3.4 / 1.9 / 2.8 / 3.8, about 198 s); parity of Missions 1-4 against `tools/m5/build/baseline-lN.json`.


## Mission 8: Dinosaur Valley (2026-11-28)

Design, as built: `docs/superpowers/specs/2026-11-27-mission8-dinosaur-valley-design.md`. Build notes, the three test
players and the reference numbers: `tools/m8/notes.md`. Fourteen files load after `level7.js`: `level8_kit.js`,
`level8_cast.js`, `level8_friends.js`, `level8_giants.js`, `level8_enemies.js`, `level8_gear.js`, `level8_bosses.js`,
`level8.js`, `level8_chase.js`, `level8_backdrops.js`, `level8_scenery.js`, `level8_music.js`, `level8_story.js`,
`level8_intro.js`. The header comment of each file is the reference for what it does.
New top-level names (never declare them elsewhere): `M8` (the looks: the private pixel kit `M8.px`, the palettes and
one painter per character: `compy`, `raptor`, `ptero`, `spitter`, `tops`, `clubtail`, `rex`, `hatchling`, `ring`,
`bang`, `burst`, ...), `L8` (the rules and the level's joiners: `level`, `poolAt`, `sticky`, `cageOpen`, `robotDown`,
`scram`, `chase`, `rexKeep`, the draw hooks, `storyArt`, ...). Everything else is private to its file's block.
Registry names it adds: enemies `compy raptor ptero spitter robonest boulderwall clubtail ogglerex rexeye`; props
`amber tops topscage topsrun topswait rexwreck`; POW kind `hatchling`; ride `tops`; weapon `dinorang` with item `D`;
projectiles `dinoegg spitgoo tailspike rexrock` (its ground waves are the engine's built-in `wave`); tracks
`dinovalley dinochase clubtail ogglerex dinodawn`.
The engine gained one hook for it, `ENEMY_TYPES[type].shield(e, dmg)` (section 4; CLUBTAIL's armour). Mission 8 also
wraps three hooks of Mission 5's `oggle` (`onKill`, `update`, `contact`): in any other level they behave as before.
Level rules, none of them in the engine: wading (water 65 % of the hero's speed, tar 45 %); the hearts rule (a robot
beaten while the hero is on his last heart leaves one, at most every 20 s); CLUBTAIL's lock is a checkpoint of its
own (`L8.CLUB_AT`, and `L8.CLUB_AT + 1` once she is beaten); a giant's arena holds the giant and nothing else
(`L8.scram`: at WARNING every small robot that is not part of that lock runs or flies off); a bomber flies home after
its third pass, so no lock waits for it; the chase's Rex is a level object, not an enemy (`L8.chase`); the OGGLE REX
comes back after a continue with the health it had, at most 75 % (`L8.rexKeep`); the scenery is painted ahead a
little at a time, on the mission card, in the briefing, in the opening scene and every fourth frame of play
(`L8.sceneWarm`, `L8.bakeSome(ms)`; `M8.queued()` says how many pictures still wait).
The story's last two pictures and the eighth clue are wired in `src/story.js` (pictures: `level8_story.js`).

Verification: `node tools/harness/harness.mjs sim --level 8 --seed 1 --hero 1`; the three never-dodging test players
(add `--extra tools/m8/jitter.js`, and `--extra tools/m8/steady.js` or `--extra tools/m8/runner.js`); who hits the
bot where and how long each lock lasts (`--extra tools/m8/trace.js`, read stderr); `node tools/m8/music-check.mjs`;
the campaign flow (`... sim --level 1 --frames 1 --extra tools/harness/fixtures/flow-selftest.js`, 42 checks) and the
story (`node tools/audit/story-test.mjs`). What the test players never do, played on purpose in the real game (every
attack and its escape, the giants' arenas, the chase, TOPS, every checkpoint):
`RR_GAME=$PWD node tools/m8/paths-test.mjs`. A real browser with sound against the test rig's run:
`node tools/m8/browser-check.mjs`. The harness extras behind them (`audio-check.js`: strict sound calls;
`paint-apart.js`: painting cannot change a run; `keys-rec.js`: a run's keys for a replay; `coverage.mjs`: which lines
no test ran) are described in their headers. Parity of Missions 1 to 7 and the measured numbers: `tools/m8/notes.md`.
