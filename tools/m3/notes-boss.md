# Mission 3 boss (KEY = boss) - notes

Owner of: src/level3_boss.js (ENEMY_TYPES.megawhale 'MEGA WHALE SHARK', EB_TYPES mw*).
Scratch: tools/m3/work-boss/

## Progress log
- [start] No earlier work (file was the 154-byte stub). Read spec, engine-api, proposal boss scene + notes,
  level2_boss.js (Mega Bear), level3.js wiring. Other M3 files are still stubs: testing on the skeleton's
  stand-in crater.
- [art r1-r3] Part painters written (Pix buffers like the proposal): head (3/4 view, flat top, pale upper lip, eye
  socket, 5 curved gill louvres), jaw x8 gapes (lower lip sags, D-shaped maw), body1/body2 segments (spine bands,
  checkerboard stripes broken at the ridges, collars), dorsal x2, pectoral x5 flaps, tail x5 sweeps, cheek bulge x3,
  fan (+jammed), rock, bits; lava on the back = 6 pre-rendered frames per segment (tongues + crust specks).
  Fixed vs the proposal: mouth no longer a porthole (throat right of centre, lit tongue floor, ribs), gills are
  louvres not scratches, spots jittered checker (no mattress grid), pectoral sweeps back along the waterline.
  Fixture: work-boss/pose.js + p-*.js (POSE/HERO globals). crop: node work-boss/crop.mjs in out x y w h scale.

## Geometry (design = screen coords with cam 5720)
- anchor e.x = lock.at + 330, e.y = 238 (lava surface). Mouth far corner F (237,194), near N (296,205), gape 40.
- Ledge 0-220 (y 222), lava 224+. Catch line: hero x >= cam + 214 during suction (still on the ledge).
- [behaviour r1] State machine written (intro, idle, vac + held/PTOO, burp, spit, dive/breach, steam, roar, phase2,
  dying), EB mwrock / mwdrop (shootable, marked) / mwfx (front layer: words, vacuum streams, steam jet, DUCK!),
  breach = pre-composited whale rotated at load (1.18 and 0.72 rad, nearest + re-outline).
  Follows the new engine-doc final-boss rule: onKill sets G.winT = 360, gives a falling last life back.
- Tools: work-boss/mrender.mjs (one boot, many frames: --at 40,130 --extra f-attack.js --extra p-*.js),
  work-boss/sheet.mjs (labelled sheets). Machine load ~30: a 300-frame render takes ~80 s.
- [sim r1] raw sim seed 1: the harness bot walks into the crater lake in the 60 frames before the boss wave and then
  bounces in the lava all fight (111 hits). Added LAKE RESCUE: a hero bouncing in the lake >= 10 frames is gulped
  and spat back onto the ledge, no extra hit ("NO SWIMMING!"). Kid-friendly safety net + fixes the bot.
- [sim r2] diag (work-boss/diag.js logs HIT/ATK/CAUGHT): boss 480 -> 29 hp in ~67 s with the bot (pistol +
  grenades; 4 BURPs), bot died 3x (9 hits: 5 lava from chasing the roar's bees, steam, rocks, drops). Roars cut to
  1 per phase.
- [art r4] breach flops back away from the ledge (angles 1.18 / 1.85), bx 290-310 so it never hangs over the ledge;
  steam jet redrawn as boiling puffs (was a laser band), gill heat red/orange (was white bars), holes oval.
- [sim r3] OFFICIAL seed 1 (hero 0): completed true, errors [], hits [0,0,0,6], deaths 2, 78.3 s total;
  boss arrives t61, KILL t4228 (~69 s incl. 3.3 s intro), 3 BURPs; 4 of 6 hits = bot walking into lava.
- [art r5] eye: bigger amber lens, blink, cross brow during wind-ups; rounder body bands; phase-2 holes = sprites
  over the lava tongues; 3-tone pixel steam puffs; hero's boots kick out of the lips while it chews (gag).
- [sims r4] seeds 2 (hero 1), 3, 4 (hero 1) + seed 1 --god: all completed, errors [], hits 7/7/8/0, deaths 2/2/2/0,
  kill 4192/4130/4283/4614 frames after the boss appears (incl. 200-frame intro). 3 of each 7-8 hits = bot lava.
  hp 480 -> 450 (pistol bot ~66 s; the flamingo's H.M.G. makes it shorter for real players).
- [r6] grenade into the wide-open mouth always BURPs (also during the gape warning); RUN! + left arrow over the hero
  during the pull; legs + boots kick out of the lips while it chews; lava tongues cool and break into blobs low
  down; breach composite now carries the spots; SPLOOSH! moved off the face.
- [final] grenade swallow window: generous while sucking (y > 160), the maw itself during the gape warning.
  Contact sheet tools/m3/work-boss/sheet.png (12 frames: idle, vac warning, pull, chew, BURP, spit warning, rocks,
  dive tell, breach, phase 2 steam, CLUNK, BUUURP).
- Parity (this code): L1 true [] [0,0,5,9] 14150; L2 true [] [1,4,1,10] 33000.
- Full L3 sim seed 1: errors [], completed false, hits [3,3,103,0], x 4158: the bot is stuck in AREA 3's lava rivers
  (never jumps gaps, integration task); it never reaches the boss.
- [FINAL boss sims, final code, hp 450] run.sh sim --level 3 --x 5921.6 --seed N [--hero 1] [--god] + diag.js:
  s1 h0: true [] [0,0,0,5] deaths 1, boss->kill 54.8 s, 3 BURPs; s2 h1: true [] [0,0,0,5] 52.8 s;
  s3 h0: true [] [0,0,0,5] 58.2 s; s4 h1: true [] [0,0,0,5] 52.8 s; god s1: 68.2 s, s2: 68.9 s (0 hits).
  2 of every 5 hits = the bot walking into the lake before the boss surfaces (pre-spawn, not the boss's doing).
STATUS: done (art 6 rounds, all attacks, phase 2, death). Weak points: see the builder JSON knownIssues.
