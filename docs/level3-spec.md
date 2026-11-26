# Mission 3: VOLCANO ISLAND — design spec and builder contract

The parent asked: "third level is bees, frogs, sharks and whale shark, setting a volcano". They approved the
proposal in `proposals/level3/` (proposal.md, proposal-sheet.png and four painted frames: bay, jungle, lava,
boss). Each scene's art code is in `proposals/level3/<scene>/scene.js`. **That look is the target**: reuse its
sprites and painters, and beat it where it was weak (see each scene's notes.md). They also approved these four
choices:

1. **The jet-ski covers part of Shark Bay** (the lagoon), like the tractor in Mission 2. The beaches are on foot.
2. **The jungle rescues both a parrot and a little monkey.**
3. **The frog's tongue sticks and pulls the hero in until they jump free** (or the frog is shot).
4. **The whale shark's vacuum gently pulls the hero toward its mouth.** If it catches them, it spits them out with
   PTOO! and they lose one heart.

The audience is two kids aged 8-10 playing with a keyboard. The game is cartoon robots: no blood, nothing scary,
and every danger warns at least ~0.4 s ahead. Mission 1 and Mission 2 must play and look exactly as before.

## 1. Files and owners

All new files. Nothing else in `src/` changes until integration (see §6).

| File | Owner | Registers |
|---|---|---|
| `src/level3.js` | level | `LEVELS[2]`, POW_KINDS of the 7 animals, `TRACKS.island`, `TRACKS.whaleboss`, intro, hazards, bomb schedule, card preview, hook wiring |
| `src/level3_world.js` | world | `L3.worldLoad/worldUpdate/drawBehind/drawGround/drawPlat/drawFront`, `PROP_TYPES.palm` and `.beachrock` |
| `src/level3_sky.js` | sky | `L3.skyLoad/skyUpdate/drawBG/drawOverlay`, `L3.weather()` |
| `src/level3_enemies.js` | enemies | `ENEMY_TYPES.shark`, `.lavashark`, `.frog`; `EB_TYPES.lavabomb`; `L3.lavaBomb(tx)` |
| `src/level3_bees.js` | bees | `ENEMY_TYPES.bee`, `.hive`, `.queenbee` (mini-boss); `EB_TYPES.stinger`; `ITEMS.honey` |
| `src/level3_boss.js` | boss | `ENEMY_TYPES.megawhale`; its `EB_TYPES` all start with `mw` |
| `src/jetski.js` | jetski | `RIDES.jetski`, `PROP_TYPES.jetski` (and `PROP_TYPES.jetskiwreck` if needed) |

File layout, exactly like level1.js / level2*.js:
- the first line is `'use strict';`
- only a file that exports L3 hooks then has `var L3 = L3 || {};`
- then ONE block `{ ... }` holding everything

Registry entries are assigned inside that block. Nothing else goes at top level.

Final manifest order (set at integration): `... level2.js, jetski.js, level3_enemies.js, level3_bees.js,
level3_boss.js, level3_sky.js, level3_world.js, level3.js, screens.js, main.js`. During development the files
are loaded after the whole game instead (see §5), so only reference other files' globals at call time, never at
load time.

Load-time rule: **never call `Math.random()` or `rand()` at load time or in draw code**. The harness seeds
Math.random, and an extra call shifts Missions 1-2's seeded runs. Use `hsh(n)` and `G.t` for decoration;
`rand()` only in update logic.

## 2. Layout (world x; y is screen y; canvas 480x270; `end` 6200, camera max 5720)

`mission 'MISSION 3'`, `title 'VOLCANO ISLAND'`, `freedLabel 'ANIMALS RESCUED'`, `music 'island'`,
`bossMusic 'whaleboss'`, `heroStart 140`.

Sections (each is also the checkpoint): `AREA 1: SHARK BAY` at 0, `AREA 2: HONEY JUNGLE` at 2250,
`AREA 3: LAVA RIVERS` at 3900, `FINAL AREA: THE CRATER` at 5300. The checkpoint at 5300 sits just before the boss.

Terrain points:
```
(0,214) (140,214) (240,220) (380,226) (520,230) (620,232) (660,240) (700,246)
(1460,246) (1490,232) (1590,232) (1620,246) (2030,246) (2070,238) (2110,230) (2250,226)
(2400,220) (2560,214) (2700,208) (2850,204) (3000,206) (3120,214) (3160,228) (3180,236)
(3320,236) (3345,226) (3380,214) (3520,210) (3700,212) (3900,216)
(4040,220) (4058,220) (4064,262) (4296,262) (4302,222) (4540,224) (4556,224) (4562,262)
(4824,262) (4830,222) (5030,220) (5036,262) (5184,262) (5190,222) (5300,222)
(5400,224) (5600,224) (5720,222) (5940,222) (5946,262) (6200,262)
```

Liquids are level data (`LV.water`, `LV.lava`). The world draws them and level3.js applies their rules:
- `water: [{ x0: 640, x1: 2090, y: 234 }, { x0: 3150, x1: 3355, y: 228 }]`: the lagoon and the jungle hot-spring
  pond. The lagoon floor is at 246, so on foot the hero wades knee-to-waist deep. That is safe, with splashes.
  The sandbar 1490-1590 (ground 232) is dry.
- `lava: [{ x0: 4060, x1: 4300, y: 250 }, { x0: 4558, x1: 4828, y: 250 }, { x0: 5032, x1: 5188, y: 250 },
  { x0: 5944, x1: 6200, y: 238 }]`: three lava rivers and the crater's lava lake.
- **Lava rule** (level3.js): when the hero's feet go below a lava surface inside its range, they take one hit
  (`hurtPlayer()`, which respects invulnerability) and get a strong bounce up (`vy = -7.5`). They bounce even
  while invulnerable. Enemies (other than lava sharks and the whale shark) treat lava as a wall. Items that fall
  into lava pop back up onto the nearest bank.

Platforms `{ x, y, w, t }` (x = left edge, y = top). One-way, Down+Jump drops through. In the lava, edge-to-edge
gaps are at most 34 px and the rise between neighbours at most 18 px:
- AREA 1: `pier` 960/208/90 (a wooden pier in the lagoon), `pier` 1700/206/80.
- AREA 2: `log` 2480/200/60, `rock` 2900/186/50, `lily` 3196/225/18, `lily` 3252/225/18, `lily` 3300/225/16,
  `log` 3460/194/56, `rock` 3720/192/44.
- AREA 3 (basalt `column`s):
  - river 1: 4066/210/30, 4118/200/28, 4170/208/30, 4222/198/28, 4268/206/28
  - river 2: 4566/212/30, 4618/202/28, 4670/196/30, 4722/204/28, 4774/210/30
  - river 3: 5040/206/30, 5094/198/30, 5146/206/30
- FINAL: `catwalk` 5380/196/60, `catwalk` 5560/190/50. No platform at x ≥ 5700.

Props: `jetski` at 700, parked at the shoreline. Palms: 60, 230, 410, 1530, 2140, 2230. Crates (Mission 1's crate
prop): 330 coin, 1560 heart (on the sandbar, inside the 1200 lock), 2760 coin, 3560 heart, 4440 coin, 5340 heart.
`beachrock` 600 and 2100.

Animals (`pows`, each in a robot cage with a HELP! bubble):
- turtle 520 `S`
- pelican 1540 `heart` (sandbar)
- parrot 2700 `F`
- monkey 2980 `B`
- toucan 3640 `heart` (inside the 3380 lock)
- iguana 4420 `R`
- flamingo 5480 `H`

Each one, when freed, **tosses its item forward**, so it lands on screen about 30-50 px ahead of the hero (Mission 2
taught us that items dropped behind get missed). It says THANK YOU! with its own call, then leaves happily.

Spawns (asleep until `x <= cam + W + activateMargin`):
- AREA 1:
  - bee 300 (the first robot; flyers pick their height)
  - shark 760, shark 880, shark 1020
  - after the 1200 lock: shark 1760, shark 1880, shark 1990
- AREA 2:
  - bee 2350, frog 2560, bee 2640
  - hive 2620 (`y: 120`, hangs from a branch)
  - frog 2780, frog 2900 (on the rock), bee 3000
  - hive 3250 (`y: 112`)
  - frog 3200 and frog 3300 (on lily pads)
- AREA 3:
  - lavashark 4180 (river 1), bee 4350, frog 4400
  - after the 4440 lock: lavashark 5100 (river 3), bee 5150, frog 5250
- FINAL:
  - bee 5350, frog 5420
  - hive 5500 (`y: 104`)
  - bee 5600, frog 5640
  - nothing between 5660 and the boss

Locks:
- `1200` SHARK PACK: shark +1 d20, shark +1 d90, shark -1 d160, shark +1 d260, shark -1 d360, shark +1 d460.
  Sharks wave in from the lagoon, never on land.
- `3380` QUEEN BEE: queenbee +1 d40, bee +1 d200, bee -1 d320, frog +1 d420. The boss bar reads 'QUEEN BEE'; on
  death it ends with `e.dead = true`, never `bossDefeated`.
- `4440` LAVA LOCK: lavashark +1 d30, bee -1 d120, lavashark +1 d220, bee +1 d330, lavashark -1 d430. Lava sharks
  enter in river 2, and the lava-bomb rate is doubled while this lock is on.
- `5720` boss: megawhale +1 d60.

No spawn sits in a lock's wake band. Each lock's screen ends before the next section's trigger.

## 3. The robots (cartoon robot animals: chunky silhouettes, 1px dark outlines, 3-tone shading, rivets, one glowing eye)

- **shark** (lagoon). It cruises with only its dorsal fin above the water, its dark shape visible below.
  - **Warning:** it stops and turns toward the hero for ~50 frames. Ripple rings spread, a red and yellow ring
    flashes on the water, a red `!` pops up and its beacon blinks fast.
  - **Leap:** it bursts out in a high arc toward where the hero was, jaws wide open on a glowing mouth.
  - **What hurts:** only the leaping shark. A fin can be shot (small box). In the jet-ski, hold Up to aim the nose
    gun at a leaping shark.
  - Wave entries arrive along the water. It never leaves the water range.
  - hp ~6.
- **lavashark** (lava rivers and lake edges). The same pattern in red-hot armour: a glowing wake.
  - **Warning:** the wake turns white-hot, bubbles swell, the eye blinks.
  - **Leap:** it jumps over the gap toward the hero's column or bank.
  - It never leaves its lava range.
- **frog** (ground, logs, lily pads, catwalks). Big headlight eyes on top.
  - **Warning:** the throat bulges with a croak for ~30 frames.
  - **Tongue:** a long pink sticky tongue lashes out at standing height (crouch or jump avoids it).
  - **Stuck:** if the tongue hits, it STICKS. The hero is pulled ~0.6 px/frame toward the frog and can't walk.
    Pressing jump breaks free (the tongue snaps back). Shooting the frog also frees the hero.
  - **Reaching the frog:** one hit, and the hero is pushed back.
  - **Leap:** sometimes it hops to a new spot, with a growing landing shadow.
  - hp ~5.
- **bee** (flyer). Swarms in a loose V, with a buzz.
  - **Warning:** its stinger glows orange (getting ready), then white with a sparkle (now!).
  - **Dive:** it dives straight at where the hero stood, then climbs back.
  - hp ~2.
- **hive** (stationary, hangs at its `y` from a branch it draws itself).
  - While on screen it releases a bee every ~3 s, with at most 3 of its own bees alive.
  - It shakes before each release.
  - When destroyed (hp ~14): big points, it drops `honey` (bonus points), and bolts and hexagon plates rain down.
- **queenbee** (mini-boss, AREA 2 lock).
  - A big robot queen with a crown antenna, armoured abdomen, glass wings and a royal stinger.
  - Attacks:
    - calls 2 bees (a buzz-roar);
    - fires a fan of 3 `stinger` darts after a glowing wind-up;
    - a swooping dive with a shadow on the ground first.
  - hp ~60. On death it breaks apart with a crown pop, and ends with `e.dead = true`.
- **lavabomb** (EB, AREA 3).
  - `L3.lavaBomb(tx)` launches one from the volcano direction, landing at world x `tx`.
  - A blinking ring with a `!` shows at the landing spot ~1.5 s before impact.
  - It can be shot in the air. On impact it splashes small embers that hurt only right at the impact.
  - It also tells the sky to flash the eruption (`L3.eruptT = 30`).

## 4. The boss: MEGA WHALE SHARK (`bossName 'MEGA WHALE SHARK'`)

A gigantic robot whale shark in the crater's lava lake (x 5944-6200), about 200+ px long. It has:
- a broad flat head and a huge wide mouth at the front;
- the white spots and stripes as glowing lamps and rivets on dark blue-grey armour;
- gill plates venting steam and small eyes that follow the hero;
- dorsal and pectoral fins, and lava pouring off its back.

Goofy-cool, never scary. Its words appear as comic text (SLUUURP!, PTOO!, BURP!).

The hero fights from the basalt ledge (5720-5940). Attacks (pick timings fair for an 8-year-old):
- **VACUUM (SLUUURP!).**
  - **Warning:** the mouth gapes, the throat glows white and a fan spins up inside (~60 frames).
  - It sucks in air, sparks, rocks and lava, and pulls the hero toward the mouth at ~0.8 px/frame. Walking away
    beats the pull; standing still slowly loses.
  - If the hero reaches the mouth, it closes, then spits them back onto the ledge with PTOO! and one hit (no other
    damage).
  - The open throat is the **weak spot**: double damage while the mouth is open. A grenade sucked in is a big hit:
    BURP!.
- **ROCK SPIT (PTOO!).**
  - **Warning:** it shuts its mouth and the cheeks bulge.
  - It spits 3 lava rocks in arcs. A red ring with a `!` blinks first where each one will land (~1.2 s). The rocks
    can be shot.
- **DIVE AND BREACH.**
  - It sinks until only the fin shows.
  - **Warning:** bubbles and a growing glow mark where it will come up (~1 s).
  - It bursts out near the ledge and splashes lava drops, which are marked.
- **Phase 2** (below 50%):
  - armour plates pop off and the vacuum gets stronger (~1.1 px/frame);
  - **Warning:** the gill vents redden.
  - The gills then fire steam jets across at standing height, which the hero ducks under.
- **Its roar** can call 2 lava sharks or 2 bees (sparingly).
- **Death:** a rock jams its fan, its lights go out one by one, it sinks with a huge burp of bolts, then calls
  `bossDefeated(e)` (onKill returns `'dying'`, like the Mega Bear). It sets `G.treeShake`-style shake through
  `G.shake` as the engine allows.
- Target fight length 45-75 s with the pistol plus pickups. The flamingo's H drop arrives just before the arena.

## 5. Development setup (until integration)

- The harness is `/Users/macbookair/game/tools/harness` (README there).
- **Run Mission 3 with `/Users/macbookair/game/tools/m3/run.sh`.** It runs the harness on `tools/m3/base.html` (the
  frozen pre-Mission-3 build: Missions 1-2 as of Nov 1) with the Mission 3 files loaded on top in manifest order.
  Your own fixtures go after: `run.sh sim --level 3 --seed 1 --extra my.js`, or
  `run.sh render --level 3 --x 1200 --frames 90 --scale 3 --out PNG`.
- Lock renders: `--x` places the hero, and the camera sits at x - 201.6. Use x = lock + 201.6 (1401.6, 3581.6,
  4641.6, 5921.6).
- A separate session is fixing Mission 2 in the existing `src/` files right now. **Never edit any existing file**:
  - not `src/` (other than your own new file), `src/manifest.json`, `docs/engine-api.md`, the harness,
    `build.py`, `index.html`, `tools/review`;
  - not `proposals/` (read-only reference).
- Engine needs: solve them inside your file first (e.g. pull the hero by adjusting `G.p.x` in your enemy's update).
  If something is truly impossible without the engine, file it under engineRequests: the integrator implements
  it after Mission 2's fixes land.
- Keep a running notes file `tools/m3/notes-<key>.md` (decisions, progress, test results), and save your file
  often. The computer has restarted several times during this project.
- Scratch files and renders go in your session's scratchpad or `tools/m3/work-<key>/`.

## 6. Integration (later, after Mission 2's fixes land)

- Add the 7 files to the manifest.
- Mission select with 3 cards: screens.js lays out 2 cards (180x96) today.
- `ALL MISSIONS COMPLETE` after Mission 3.
- Any engine requests, and teaching the harness bot to jump lava gaps.
- Difficulty tuning (targets: ≤ ~22 never-dodging-bot hits, 3-4 min, boss 45-75 s, checkpoint continues
  gentle).
- Parity: Missions 1-2 identical to the fixed build.
- Fixtures; build.py and index.html.

## 7. Quality bar

- At least as good as Mission 2 and the proposal frames, ideally better. Pixel art consistent with Missions 1-2:
  1px OUT outlines on characters and foreground objects, 3-tone shading, chunky readable silhouettes, canvas paths
  only for big background shapes.
- Everything is alive: idle animation, sway, blinking lights, smoke, water, lava glow.
- Iterate: render, open every PNG, crop and zoom, compare with Mission 2 and the proposal frames, and fix.
  At least 3 rounds.
- Finally compose a labelled contact sheet `tools/m3/work-<key>/sheet.png` of your best 6-12 frames.
