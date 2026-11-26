# Fix notes: group GEAR (level2_world.js, vehicle.js, weapons_extra.js)

Restart-safe running log (append as you go). Root R=/Users/macbookair/game/tools/review/fix/gear/game.
Scratch: RD/fix/gear/work (fixtures, logs, reg), RD/fix/gear/shots (PNGs).
T=/Users/macbookair/game/tools/harness, FX=RD/fix, VE=RD/verify-experience-work.

## Status (update as tasks finish)
- [x] start-gear.json #0-2 (flame 240/300, tilt 0.045, flag [26,30])
- [x] art-6 flag test
- [x] art-8 trees (three canopies by seed, not mirrored: see log)
- [x] art-10 zoneAt band
- [x] audio-1 flame hiss
- [x] audio-6 shotgun
- [x] audio-5 tractor exhaust
- [x] audio-4 tractor landing
- [x] art-11/K14 tilt test
- [x] kids-7/flow-1 BAIL OUT!, RIDES.tractor.help, boarding text
- [x] kids-3/9 flame ammo test
- [x] final: node --check, policycheck, regress.sh, required sims, loop-test

## Log
- 2026-11-11 start: own files == src-base (pristine), no earlier run.
- Applied FX/edits/start-gear.json all (#0 flame 240/300 weapons_extra.js:533, #1 tilt 0.045 vehicle.js:367, #2 flag [26,30]
  level2_world.js:1552): each matched once; node --check ok on the three files.
- BEFORE captures (pre-fix): sound logs in fix/gear/work/before (flame/shotgun/pistol sandboxes, ride.log, ridefire.log with
  work/tr-fire.js), renders in fix/gear/shots/before (from RD/before/index-before-fixes.html).
  Pre-fix levels: flame wl 'weapons_extra\.js:54[34]' -47.5 (lap -51.3); shotgun '(290|291)' -31.6 (lap -37.3, peak -10.2);
  pistol 'weapons\.js:28' -40.6; tractor exhaust :496 -59.9 (lap -65.3); gun :601 -40.9 (ridefire); landing :562 iso
  full -37.7 lap -49.1. TILT thr 0.025: 811/846 ride frames tilted.
- art-6 DONE (start-gear #2): render --x 2695.6 frame 400 vs before: 1440 px differ, box [1410,474,1439,527] (the cloth now
  drawn at the right edge, shots/cmp-flag-400.png); frame 1 identical.
- art-8 DONE, deviation from the plan's mirror idea (documented): mirroring would flip the light (every canopy cluster
  is lit from the top right, like all sprites) and move the leaves under the burrs (BURR_AT is also the burr drop point
  in update code, so it can't move). Instead three canopies per kind from other seeds, the file's own idiom (ORCH_TOP,
  BIG_TOP, BACK_TOP): CHERRY_TOP = [31 (old), 24, 33], CHEST_TOP = [41 (old), 75, 26] (arrays, built at load with
  mk(..., true) so each has its white FLASH copy; same w/h/ox/oy so swayBlit and the canopy boxes are unchanged).
  Pick: treeLook(o) = index among LV.props of the same kind with smaller x, % 3, stored as o.look in make().
  Chestnuts 1480/1700/1940/2370/2560/2690 -> 0 1 2 0 1 2; cherries 300/4470/4690/4880/5130/5400 -> 0 1 2 0 1 2.
  Seeds chosen from contact sheets (work/exp/sheet-*.png; probe: all three burr points covered on 75 and 26).
  Renders: shots/after/trees-2451.png (three different chestnuts), trees-4801.png, trees-5251.png, trees-2451-flash.png
  (work/flashtrees.js: white copies match each canopy).
- art-10 DONE with one refinement (documented): the plan's single ±64 jitter also speckles the plateau's granite
  flagstones (facePx: z === 0 && x 98-296) with path dirt from x 186 and puts flagstone pixels on the hill path past
  the wall (exp root work/exp/z128, shots/cmp-z201-zoom2.png at 9x). So a width per border: ZW = [32, 128, 128, 128]
  (the plateau's border at 250 keeps ±16, exactly as before; 1350, 2850 and 4400 get ±64), zoneAt uses
  x + (nz - 0.5) * ZW[z]. Callers checked (all drawing: groundPx/groundFeatures at worldLoad bake, liveGrass and
  drawFront per frame). Renders after vs before: zone-201 identical; zone-2901/1551/4601 identical to the plain ±64
  variant; crops shots/cmp-z2901-zoom2.png, cmp-z1451.png, cmp-z4501.png: the seams become wide dithered blends.
- audio-1 DONE weapons_extra.js:543 whoosh + Snd.noise(0.3, 0.15, 2000); :544 hiss every 6 frames Snd.noise(0.3, 0.25, 1500).
  Flame sandbox (work/after/flame.log) wl 'weapons_extra\.js:54[34]': -39.7 sustained (lap -40.3, peak -16.0)
  [pre-fix -47.5 / lap -51.3]; target -41 +- 2 ok; pistol -40.6.
- audio-6 DONE weapons_extra.js:290 blast 0.45/0.42/0.1 -> 0.27/0.25/0.06 (click line 291 unchanged). Shotgun sandbox wl
  '(290|291)': -35.7 sustained (lap -41.3, peak -14.6 dBFS) [pre-fix -31.6, peak -10.2]; iso -35.1 [-31.0]. Still the
  loudest gun: rockets -35.9 (peak -13.4), HMG -39.9, pistol -40.6, flame -39.7, music -39.
- audio-5 DONE vehicle.js:496 exhaust (driving only, quiet for parked): sawtooth 95/110->70 0.1 s 0.12/0.15 + noise 0.09 s
  0.11/0.14 1000. Ride log (work/after/ride.log): wl ':496' -43.2 sustained (lap -46.8) [pre-fix -59.9 / -65.3]; fire
  ride (ridefire.log, work/tr-fire.js): engine -45.1 vs gun :601 -40.9 -> the gun stays louder; music -38.9.
- audio-4 (gear part) DONE vehicle.js:562 landing + square 150->75 0.1 s 0.08 + noise 0.1 s 0.18 1200: an.mjs iso
  ':562' full -35.9, laptop -43.6 [pre-fix -37.7 / -49.1]; target laptop >= -46 ok.
- kids-7/flow-1 (gear half) DONE vehicle.js: wreck text 'JUMP!' -> 'BAIL OUT!'; RIDES.tractor.help = 'C: CANNON   DOWN+Z:
  GET OUT' (new optional field, contract C4); boardIt (first boarding only, r.hello) also pushes the help line at gl.y - 70,
  t 160, white, under BATTLE TRACTOR! (gl.y - 84). Tests: render --x 2900 --frames 40 + VE/fx/tractor.js
  (shots/after/board-40.png, cmp-board-40.png): both lines readable; work/walkboard.js (hero walks into the level tractor,
  boards f=156 at x 2950) shots/after/walkboard-200.png: both lines over the sky; work/wreck.js (armour 1, inv 0,
  hurtPlayer at f60) render f70: 'BAIL OUT!' (before: 'JUMP!'), shots/cmp-wreck-70.png. Contract: work/both.html (root +
  edits/start-engine.json) + FX/tools/ridepause.js without stub: RP 'state pause riding true help "C: CANNON   DOWN+Z: GET
  OUT"', green line between panel and prompt (shots/after/pause-ride-both.png).
- art-11/K14 DONE (start-gear #1, tilt 0.045): renders --x 4251.6 + VE/fx/tr-right.js + tractor.js frames 300/500:
  shots/cmp-tractor-300z.png (before 2-degree jagged rotation, after pixel-exact, both wheels on the grass), frame 500
  level too (diff there = the art-8 canopy). TILT line with the fixture thr 0.045 (work/tr-right45.js): 0 of 846 ride
  frames tilted (thr 0.025: 811).
- kids-3/9 (gear half) DONE (start-gear #0): work/flameammo.js (sandbox wolf, render 10 frames): 'FA f1 weapon flame
  ammo 240 def 240/300', second pickup -> 300 (maxAmmo); HUD shows FLAME 240 (shots/after/flame-hud.png).
  Integration preview on work/both-level.html (root + edits/start-level.json) with VE/fx/wobs.js: s1 flame 132 shots
  (then R picked at 2410 replaces it), s2 125 (R at 2410), s3 221 (no R) -- the R pickup, not the fuel, ends the flame
  in s1/s2. s2 took 345 s with 2 continues (29 hits in section 3, boss without the boss group's fixes) vs level-only
  s2 165.7 s: running seeds 1-10 level-only vs gear+level (work/cmp10) to check it is chance, not the gear changes.
- Seeds 1-10 (work/cmp10): level-only (src-base + start-level) vs gear+level (gear root + start-level): both 10/10 win,
  errors 0, one 2-continue boss run each (lo s8 341.9 s, gl s2 345.2 s, 26/29 hits in section 3 = the pristine boss
  fight), medians 163.4 vs 161.6 s, total hits 133 vs 144: chance, not the gear changes.
- '=base' check of the draw/sound/text changes alone: work/iso/game (my files with the flame ammo and the tilt reverted):
  M2 h0 s1-5 and h1 s1 byte-identical to baseline m2-base (6/6 =base).
- Running regress.sh on R -> fix/gear/work/reg.
- regress.sh R (work/reg/summary.txt): RESULT ALL PASS. M1 10/10 identical to legacy, M1 sound s1 SAME (1928 events),
  M2 h0/h1 s1-5 all win errors [] (180.7/263.4/173.6/178.1/258.7 s; s2 and s5 1 continue each, 18-19 hits in
  section 3), flow 18/18, api 37/37, selftest DONE, loop-test ALL OK.
  Checking whether the 2 continues are chance (pristine boss) or the tilt/flame changes: base vs R on more seeds.
- Base vs R, M2 seeds 2 and 6-15 with work/hurtlog.js (work/rate, summ.py): base 11/11 win, errors 0, 8 continues in
  4 runs, median 180.8 s, hurts orchard 34 / boss 147, deaths 44; R 11/11 win, errors 0, 5 continues in 5 runs,
  median 188.4 s, hurts orchard 20 / boss 124, deaths 35. The pristine MEGA BEAR fight costs the bot a continue in
  ~40% of seeds either way (base s1-5 were lucky); the gear changes don't make Mission 2 harder.
- Running compare-m1.sh (extra evidence; my files draw nothing in Mission 1).
- Final files (unchanged since 12:38, before regress started 13:08): md5 level2_world.js dee1c15654f82a5f6c22343c64829841,
  vehicle.js 57771fda54a5ed52ae52452ee4fa5d7f, weapons_extra.js ff3cd73a2dd1625257c1668041fce0cd; node --check ok on all three.
  Required values (work/reg): M1 h0 s1 completed true, errors [], hits [0,0,5,9], score 14150 (140.3 s); M2 h0 s1/s2/s3
  win, errors [] (180.7 / 263.4 / 173.6 s); loop-test ALL OK; policycheck --group gear: RESULT ok.
- compare-m1.sh (work/compare-m1.out, shots/m1): all 13 cases identical to base; vs legacy only win [489,642,950,665]
  (the pre-existing PRESS ENTER FOR MISSION 2! line).
- DONE (all tasks). API for other files: RIDES.tractor.help (string, contract C4); WEAPONS.flame ammo 240 / maxAmmo 300
  (C5). Internal only: tree props get o.look (0-2) in make(); level2_world.js ZW, treeLook are block-private.
