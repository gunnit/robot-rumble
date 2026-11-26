# Mission 3 tuning (KEY = tuning) - notes

STATUS: [16:08 Nov 11] DONE. Bot crosses lava (tools/m3/harness.mjs), parity OK, Mission 3 tuned, final table
  f20 (s1-10 x h0/h1) below: 20/20 complete, 0 errors, hits mean 17.7 (11-26), time mean 238 s (206-301), boss
  49.5-67.3 s. Hero 0/1 are cosmetic: same seed = identical run.

Owner of: tools/m3/harness.mjs (isolated copy of tools/harness/harness.mjs with lava hops), tools/m3/run.sh
(points at the copy), tuning knobs in the 7 Mission 3 files. Scratch: tools/m3/work-tuning/

## Log
(Entries t01.. are in order; their clock times were not recorded. The final table started at 16:04.)
- [15:08] Read spec, harness. Hero physics (base.html updatePlayer): vx 1.7 (crouch 0.9), jump tap on ground
  vy -5.4, then vy += 0.26 per frame (cap 6), jump released while vy < -2.6 -> vy = -2.6. Full jump ~56 px high,
  ~41 frames, ~70 px at same height. Plats: land if x in (pl.x-3, pl.x+pl.w+3) falling through the top.
  Lava (level3.js liquidRules): feet below lv.y inside [x0,x1] -> hurtPlayer + vy -7.5 (kept full height).
- [15:15] tools/m3/harness.mjs = copy + makeHops() (only built when LV.lava is non-empty; M1/M2 bot unchanged).
  tools/m3/node_modules -> ../harness/node_modules (symlink). The harness has no self-relative paths (GAME env,
  fixtures only via --extra), so nothing else to fix. run.sh: H=$G/tools/m3.
- [15:17] Parity with the copy: L1 h0 s1 true [] [0,0,5,9] 14150; L2 s1 true [] [1,4,1,10] 33000. OK.
- Fixture work-tuning/log.js (read-only, wraps update + dbg.onHurt): HITLOG per hit with caller (stack), BOSSLOG
  (megawhale appear -> dying, s), LOCKLOG (lock durations). Use: run.sh sim ... --extra work-tuning/log.js 2> x.err
- [15:17] First M3 s1 with hops: x 4638 (river 2), hits [3,8,69,0], 0 lava hits; 35 hits at x 4080-4100 (column 1
  of river 1) all enemy contact (updateEnemies) + 19 enemy bullets. Investigating.
- [15:28] Mac restarted; all files intact. Resumed.
- [~15:50] Hops work (crossing river 1 in ~5 s). Added to the bot copy: (1) unplanned air near lava (the bot's
  42-frame jump, knock-back, bounce, respawn): a landing predictor reach() (engine order, jump held) -> carry on to
  the next support when it reaches, else come down on the support below (walk on, not off its ends), else over lava
  go for the reachable support ahead/behind. (2) "sunk" targets: a lava dweller anchored at/below the lava surface
  (lava shark swim/warn/rise/under) is no target unless nothing else is on screen AND a camera lock is on (the bot
  stood on river 1's column 1 for minutes under a swimming lava shark it can't shoot).
- Finding: LAVA LOCK (4440) is where runs die: 3 lava sharks (hp 7, armored, hittable only mid-leap), each leap = 1
  hit on the never-dodging bot, it deals ~1 damage per leap (often in the air from its 42-frame jump). Seeds 1-2:
  ~60-80 hits in AREA 3, 9 continues, never opens. Tuning target #1.
- [~15:55] Coordinator: M2 fix round landed; tools/m3/base.html = new index.html (old: base-pre-m2fix.html). New
  parity: L1 [0,0,5,9] 14150; L2 true [] [0,2,0,1,7] deaths 0, 31950, 152.4 s. All earlier M3 numbers are on the old
  base: re-run.
- [t01] Backups of originals: work-tuning/*.orig.js. TRY lavashark hp 7 -> 4 (level3_enemies.js).
- [t02] Bot: in a lock with only sunk targets it waits on its support over/next to that river (no chasing: lava
  sharks patrol 46-96 px from the hero, chasing = endless hopping). Hero 0/1 are cosmetic: same seed = same run.
- Full runs (hp 4, 3 lock sharks): s1 true 323 s hits [3,6,24,6]=39, lock 4440 92 s, boss 75 s; s2 false (7 cont).
  AREA 3 hits: lava shark leaps 15/37, lava bombs 9/15. TRY lock = 2 lava sharks (drop `lavashark +1 d220`).
- [t03] lock 2 sharks (hp 4): lock ends ~9.6 s for 8/8 seeds, AREA-3 hits 1-4 from x 4540. Note hp 4 = one grenade (blast 6 dmg) kills a lava shark; hp 7 needed grenade + shot.
- [t04] f5 (2 lock sharks, hp 4), s1-4 h0: all complete; t 318/326/286/481 s; hits 36/35/25/55 (AREA 3 21/20/12/35);
  boss 64/65/71/80 s. Leap log (work-tuning/leaplog.js): the bot is airborne ~85% of each leap (its 42-frame jump; the
  shark aims at where it was), ~0.9 pistol damage per leap; grenades (6) kill; deaths -> continue from 3900 -> river 1
  shark + lock again. TRY lavashark hp 4 -> 3, bomb interval 210 -> 270 (lock 105 -> 135, still doubled).
- [t05] f6 (hp 3, bombs 270/135): s1 409 s 55 hits (AREA 3 38: dies in the lock 4x, leaps every ~130 f), s2 326/37,
  s3 244/21, s4 283/30; boss 67-76 s. Variance = deaths in the lock. TRY lavashark hp 3 -> 2 and its cooldown after a
  leap rand(100,160) -> rand(150,220) (level3_enemies.js updLava 'under').
- [t06] f7 (hp 2, cd 150-220): s1 235 s 21 hits (AREA3 8), s2 358/29 (9), s3 330/25 (10), s4 321/34 (17); boss fight 60-79 s, boss lock 70-168 s (continues in the boss fight). Next: boss.
- [t07] log.js also prints SECLOG (area entry times) and DEADLOG; summ.py shows seconds per area + death spots.
  AREA 2 = 6-8 hits, mostly the QUEEN BEE (stinger fans 4, swoops 2-3) in a 26-32 s lock. TRY queenbee hp 60 -> 45
  (level3_bees.js), megawhale hp 450 -> 400 (level3_boss.js; fights were 60-79 s).
- [t08] f8 (queen 45, whale 400), s1-8 h0: all complete, t 240-339 s, hits 15-33 (avg ~25); boss 49-70 s; AREA 3
  lava sharks ~9/run: leap log s1 = 23 leaps, 83% hit the hero, 0.43 damage/leap (the shark aims at the hero's chest
  where it is at leap start, mid-jump for this bot). TRY (level3_enemies.js) standY(): a hero in the air is aimed at
  the support below it, so jumping over a leap works (like the frog tongue). lavashark hp stays 2.
- [t09] f9 (standY): WORSE (lava shark hits 2-21/run, 3 runs 44-45 hits): reverted standY (aim at p.y again).
- [t10] TRY lava shark bites only with its jaws (contact: lavaJaws box 22x18 at the nose, 19 px ahead of the body middle along the leap; checked in a render with work-tuning/jaws.js). hp 2.
- [t11] f10 (jaws-only bite), s1-8 h0: all complete, t 223-358 (avg ~290), hits 17-34 (avg 25.4): AREA 3 3-17 (lava
  sharks ~7.4), boss area 6-10 (vacuum catches 2-4, breach drops 1-4, steam 0-3), boss fight 53-69 s, but the final
  area takes 84-158 s (game overs in the boss fight). TRY: a lava shark swims off for good after 3 leaps (LAVA_LEAPS,
  e.dead while under the lava): no lock or column stand-off lasts long.
- [t12] f11 (3 leaps then gone): avg 23 hits, AREA 3 avg 8.1. Leap log s1: the hero reaches the lock with 1 heart
  and dies on the first leap; the lock's 2 sharks leap every ~2.8 s, ~1 hit per leap. Geometry: the arc's apex is at
  the hero's chest (feet-16), 3 px under the shot line (feet-19), so a standing hero can only shoot it as it bites.
  TRY LAVA_LEAPS 3 -> 2, crate 4440 coin -> heart (level3.js: a heart just before the lava lock).
- [t13] f12 (2 leaps, heart crate 4440), s1-8 h0: all complete; t 206-323 (avg 271); hits 16-28 (avg 22.3); AREA 3
  3-11 (avg 7.5); boss fight 49-61 s; FINAL area 3-9 hits (vacuum catch 2.75/run, steam 2, breach drops 1.4, rocks
  0.75) and 77-143 s (game over in the boss fight -> boss restarts). Next: per-attack boss stats (--x 5921.6).
- [t14] boss only (--x 5921.6, pistol, s1-8): fight 60-71 s, 5-8 hits: steam 2/fight (100% vs a non-ducker), vacuum
  1-2, breach drops 1-3, roar bees 1-2, rocks 0-1; s8 18 hits/2 continues (bees 5). TRY phase-2 order
  steam,vac,spit,dive,roar,vac,spit,steam,dive (was ...dive,steam,roar,vac,spit,steam,dive: 3 steams in 10 -> 2 in 9,
  the 2nd one later).
- [t15] f13 (phase-2 order): avg 21.75 hits (15-28), t avg 271 s (205-322). Lock 0-5 hits, river 1 1-2, river 3
  0-2, bombs 0-4. Time sink = a game over in the FINAL area restarts the boss (+50-70 s). TRY queen hp 45 -> 38,
  bombs 270/135 -> 300/150, vacuum VSUCK (phase 1) 150 -> 130 frames (from mid-ledge the pull no longer reaches the
  mouth in phase 1; at the edge it still does; phase 2 VSUCK2 170 unchanged).
- [t16] f14 (queen 38, bombs 300/150, VSUCK 130): avg 20.9 hits (11-27), t avg 280 (196-362): queen change
  reshuffles the RNG for all later areas (chaotic seeds; 8 seeds is a small sample). Boss trace: first vacuum catches
  the bot at the ledge edge at once; phase-1 vacuum from mid-ledge no longer catches; phase 2 does. TRY river (and
  whale-called) lava sharks leap once then leave; lock sharks twice (e.lock).
- [t17] f15 (river sharks 1 leap): avg 20.1 hits (16-28), t avg 277 (237-354), boss 58-71 s (VSUCK 130 = less
  open-mouth double damage). Structural: ~4 deaths/run -> the 3rd (game over) often falls in the FINAL area -> the
  boss restarts (+60-80 s). TRY megawhale hp 400 -> 350.
- [t18] f16 (whale 350): avg 19.75 hits (14-29), t avg 281 (223-350), boss 47-57 s. s6: frog 5420 sits under the
  5380 catwalk; the bot on the catwalk can't shoot it (nor can a kid) and gets hopped on (3 hits, 2 deaths before the
  boss). TRY frog 5420 -> 5470 (level3.js spawns).
- [t19] f17 (frog 5470): avg 20.75 hits (15-27), t avg 260 (222-323), boss 44-58 s. Spirals in AREA 3 (s1/2/4:
  10-13 hits): the bot reaches the lock with 1 heart, ~80% of leaps hit. TRY LAVA_LEAPS 1 everywhere (each lava shark
  leaps once, then swims off unless shot).
- [t20] f18 (LAVA_LEAPS 1): avg 18.1 hits (16-23), t avg 246 (222-290), boss 44-68 s, AREA 3 3-8. FINAL area is now
  the biggest: ~6.9 hits (each warned attack ~1 hit on a non-dodger: vacuum 2.5, drops 1.4, rocks 1.1, steam 1.1) and
  the game over usually lands in the boss fight (restart +50-70 s). TRY boss rest between attacks 108-126 -> 140-160
  frames (phase 2 86-100 -> 112-128): fewer attacks in a fight whose length is set by the bot's damage.
- [t21] f19 (boss rests 2.5/2 s): s1-8 h0 all complete, avg 17.4 hits (11-26), t avg 235 s (206-301), boss 49.5-67
  s. ON TARGET (s6 = outlier, 26 hits/301 s: dies 3x around the lava lock). Next: parity + final 20-run table.
- [t22] reverted the unreachable lava shark cooldown change (rand(150,220) -> rand(100,160) again: with LAVA_LEAPS 1 that line never runs). Starting final table f20 (s1-10 x h0/h1) + parity.
- [16:06] parity (final M3 files loaded): L1 h0 s1 true [] [0,0,5,9] 14150; L2 s1 true [] [0,2,0,1,7] deaths 0 31950 152.4 s. OK.

## Final tuning changes (originals in work-tuning/*.orig.js)
- level3_enemies.js lavashark: hp 7 -> 2; bites only with its jaws (contact via lavaJaws(), 22x18 at the nose);
  LAVA_LEAPS = 1: after one leap it swims off for good unless shot (e.dead while under the lava).
- level3.js: LAVA LOCK waves 3 lava sharks -> 2 (dropped `lavashark +1 d220`); lava bombs every 210 -> 300 frames
  (lock 105 -> 150, still doubled); crate 4440 coin -> heart; frog 5420 -> 5470 (off the 5380 catwalk).
- level3_bees.js queenbee hp 60 -> 38.
- level3_boss.js megawhale hp 450 -> 350; phase-1 suction VSUCK 150 -> 130; rest between attacks 108-126 -> 140-160
  (phase 2 86-100 -> 112-128); phase-2 order: one steam fewer per cycle.

## Final table f20 (work-tuning/f20.txt, f20-<seed>-<hero>.json/.err)
| seed | done | time s | hits by area | total | deaths | cont | boss s |
|---|---|---|---|---|---|---|---|
| 1 | yes | 227.8 | 3,3,4,6 | 16 | 4 | 1 | 53.2 |
| 2 | yes | 230.2 | 3,4,5,6 | 18 | 4 | 1 | 56.6 |
| 3 | yes | 254.8 | 3,4,3,6 | 16 | 4 | 1 | 53.3 |
| 4 | yes | 224.0 | 3,4,5,5 | 17 | 4 | 1 | 49.5 |
| 5 | yes | 205.7 | 3,3,4,7 | 17 | 4 | 1 | 49.8 |
| 6 | yes | 300.9 | 3,5,8,10 | 26 | 7 | 2 | 49.9 |
| 7 | yes | 217.1 | 3,1,4,3 | 11 | 2 | 0 | 52.1 |
| 8 | yes | 221.8 | 3,4,5,6 | 18 | 4 | 1 | 67.3 |
| 9 | yes | 283.2 | 3,6,4,5 | 18 | 4 | 1 | 55.5 |
| 10 | yes | 218.7 | 3,7,7,3 | 20 | 5 | 1 | 50.2 |
(hero 1 = identical numbers for every seed; 0 lava touches by the bot in all 20 runs)
