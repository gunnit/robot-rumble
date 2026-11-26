# Mission 3 retune after the fix round (KEY = retune) - restart-safe notes

STATUS: [18:50 Nov 11] DONE, all checks passed. Final = t14 config.
  Never-dodger s1-10: 10/10 complete, errors [], hits 9-18 (avg 13.1), deaths 1-4 (avg 2.0), 1 continue in 2 seeds
  (s7, s9), 180-224 s (avg 200 = 3.3 min, a bit under 3.5), boss 45-72 s. Dodger: hits 7-15 (avg 9.6), deaths 0-3,
  1 continue (s4). Parity M1/M2 OK. Tables and changes at the end of this file.

Scope: only src/level3.js, level3_enemies.js, level3_bees.js, level3_boss.js, jetski.js (level3_sky/world only if needed).
Scratch: tools/m3/work-retune/ (full.sh TAG "seeds" [dodge] -> out/TAG-<seed>.json/.err + out/TAG.txt; log.js and
summ.py copied from work-tuning). Harness: tools/harness/harness.mjs (has the lava hops) on src/ directly.
Dodging bot: tools/m3/fix/B/probe/cfg-away-30.js + dodge.js (walks out of the bee ring 30 f after the white stinger).

Targets: never-dodging bot s1-10 all complete, errors [], hits avg <= ~22, none > ~30, continues <= 1 in only a few
seeds, time 3.5-4.5 min, boss fight 45-75 s. Dodger ~ Mission 2 (152-171 s, 10-14 hits, 0-2 deaths).
Parity: L1 h0 s1 [0,0,5,9] 14150; L2 s1 [0,2,0,1,7] 31950 152.4 s.

## Log
- [b0] baseline never-dodger s1-10 (src as landed): 4/10 FAIL (s1,2,5,10 hit 30000 frames, 7-8 continues, die-loop
  under hives 2620/3250 and in the 3380 queen lock). Completed: 21-57 hits, 5-17 deaths, 1-5 cont, 209-391 s.
  Per run: A1 bee 27.2 + stinger 5.8 + queen 2.6; A3 (lava) bee 5.3; A0 bee 1.7 (first bee 460: ~2 hits every run).
- [d0] dodger baseline: 10/10 complete, hits 9-18 (avg 12.4), deaths 2-5, cont 0-1 (6 seeds 1), 211-314 s.
  Dodger is bee-only: boss area 2-8 hits, lava 2-8.
- log.js (copied): caller regex fixed for full src paths (was 'update@log.js' for every hit).
- Death math: 3 hearts x 3 lives, game over (= a continue) at the 3rd death; jet-ski hits cost no heart. So
  'continues only in a few seeds' needs <= 2 deaths in most seeds (~ <= 9-11 heart hits): aim well under 22.
- [t01] bees: hive every 180 -> 300 f, own cap 3 -> 2, no release while 3 bees on screen (HIVE_GAP/OWN/SCREEN);
  DIVE_GAP 90 -> 150. Also: a full hive waited AT rel 36 = re-shake + sound every frame; now waits at 37.
  t01 result: 10/10 complete but hits 16-52 (avg 30.6), deaths 4-16, cont 1-5. Per run: jungle bee 6.4 + stinger
  2.3 + queen 1.3; lava-area bees 5.7 (!); crater: vacuum catch 2.1, steam 1.5, drops 1.0, rocks 0.7, bee 1.2.
  beelife.js (per-bee probe): free bees live ~16 s and dive 2-3x before the bot shoots them (they hover ~100 px up,
  74 px aside; the bot only aims up within 40 px).
- [t02] bee hp 2 -> 1; BEE_DIVES 2: after its 2nd dive a bee buzzes off (state 'leave', up and out of the nearer
  screen side, then e.dead).
  t02 INVALID (BEE_DIVES name clash with the dive-pose constant: level3_bees.js failed to load = no bees at all).
  Useful reference though: Mission 3 WITHOUT bees = hits 8-15 (avg 11.3), deaths 2-4, 160-215 s. Renamed DIVE_MAX.
- t02 (valid): 10/10, hits 14-33 (avg 23.8), deaths 3-10, cont 1-3, 206-325 s, boss 24-51 s. Bee hits ~11/run
  (A0 1.9, jungle 3.2, lava 4.5, crater 1.7). beelife (s2,3,5,9): ~30 bees/run, ~18 dives, most bees shot after
  0.5-1.2 dives; dives come early in a bee's life (first dive cd only 50-90 f).
- [t03] FIRST_CD 150: a new bee (placed/hive/lock/queen/whale) flies about 2.5 s before its first warning (was 50,
  hive 70, queen 90).
- t03: hits 14-33 (avg 22.8), cont 1-3: no real gain. trace.js (s10 jungle): the bot can't shoot hovering bees
  (V hovers ~75 px aside, it aims up only within 40 px; it even stands 30 s under a hive at dx 35 missing it), so
  nearly every bee that gets to dive = 1 hit. Bee hits ~ number of bee dives: cut the bee SUPPLY.
- [t04] DIVE_MAX 2 -> 1 (a bee dives once, then buzzes off); HIVE_TOTAL 2 (a hive sends 2 bees in all, then it is
  empty); QUEEN_BEES 3 -> 2, QUEEN_CALL_MAX 6 -> 2.
- t04: s2/s5/s6 STUCK at x 3217 under the (now empty) 3250 hive for 400 s: the pistol bot stops at dx < 40 to aim
  up but the hive box is +-19 (its up-shot at ~p.x+4 misses); before, bee knock-backs moved it on. Completed seeds:
  14-31 hits. Jungle queen+stingers 4.5/run.
- [t05] hive box 38 -> 42 wide (= the drawn hive incl. outline; > 40 so the bot throws grenades at it, a kid
  gets a fairer target); level3.js: removed the lone bee 2640 (20 px from the 2620 hive). s2/5/6 now complete.
- t05: 10/10, hits 16-29 (avg 21.3), deaths 4-8, cont 1-2 (all seeds), 195-291 s, boss 17-54 s. Per run: bees 7.2
  (A0 1.2, jungle 2.8, lava 2.5, crater 0.7); queen + stingers 4.8 (lock 3380 up to 80 s when dying there);
  lava bombs 1.6 + lava sharks 1.0; boss 4.7 (vacuum catch 2.4, steam 1.3, drops 0.6, rocks 0.4); ski sharks 1.3.
- [t06] queen hp 38 -> 30, QUEEN_REST +30 f after each of her attacks; lava lock 4440: 1 bee (dropped bee d330).
- t06: 10/10, hits 16-21 (avg 18.3), deaths 4-5, cont 1 in EVERY seed, 205-253 s, boss 36-62 s. Deaths: queen lock
  ~1, lava area ~1.5, crater/boss ~2 per run. Boss area ~5.7 hits (vacuum 2.4, steam 1.1, bees 1.4, drops 0.5).
- [t07] level3_boss.js: the whale's next attack waits while L3.beeBusy() (no pile-up); rest between attacks +30 f
  (phase 1 140-160 -> 170-190, phase 2 112-128 -> 140-156).
- t07: hits 15-26 (avg 18.6), deaths 3-7, cont 1-2: whale changes barely moved the crater (~6 hits: every whale
  attack ~1 hit on the non-dodger; bosstr.js s8: 9 attacks, 7 hits, 3/3 vacuums catch).
- [t08] bees: no warning starts while the hero is over a lava river (x0-10..x1+10: columns / hops); level3.js:
  lava bombs also hold while L3.beeBusy().
- t08: hits 11-26 (avg 20.2), deaths 2-8, cont 0-2: lava bombs 1.6 -> 2.9/run (bombs bunch up right after a bee
  attack: busy sets bombT >= 45), bees over lava 0.9 -> ~0.3. Large seed-to-seed chaos (an area swings +-5 hits).
  heartlog.js (s1,3,7,9): the bot picks up 3-4 honeys per run, usually with 1-2 hearts (hive 2620/3250/5500 honey,
  the queen's 2); hearts 1540/1560 come at full health on the ski; crates 4440/5340 rarely collected.
- [t09] honey heals: +1 heart when hurt (still 1000 points, '+1 HEART' text above 'YUM! HONEY').
- t09: 10/10, hits 9-21 (avg 14.2), deaths 0-5, cont 1 in 3 seeds (s1,s3,s6), 171-235 s (avg 194 = 3.2 min, a bit
  short), boss 37-54 s (s6 16 s after a continue). Fewer deaths = less replay = fewer hits overall.
- d09 (dodger on t09): 10/10, hits 9-12 (avg 10.3), deaths 1-3, cont 0 (s1: 1), 180-229 s; 0 bee hits.
- [t10] time is short (194 s, boss 37-54 s): whale hp 350 -> 420, queen hp 30 -> 34.
- t10: hits 9-21 (avg 15.4), deaths 1-4, cont 1 in 6 seeds (too many), 187-245 s (avg 219 = 3.65 min OK), boss
  39-70 s (s6 18.5 after a continue). Deaths now mostly in the boss fight (~1.5/run) + queen lock (~0.6).
  Crates: the bot's standing shot (feet-19) passes over a 16 px crate, so crate hearts are luck; honey is its heal.
- [t11] boss rest phase 1 170-190 -> 200-220, phase 2 140-156 -> 170-186 (fewer attacks, same hp/fight);
  the roar calls 1 bee (from the right), was 2 (lava-shark roars still 2).
- t11: hits 12-19 (avg 15.2), deaths 2-4, cont 1 in 5 seeds, 190-241 s (avg 216), boss 32-70 s. Crater: vacuum
  catch 2.2/run is the top killer (each vacuum catches the non-dodger), steam 1.3, drops 0.6, rocks 0.3, bees 0.5.
- [t12] boss attack order: the 2nd vacuum of a cycle comes later (ph1 vac,spit,dive,roar,spit,vac,dive; ph2
  steam,vac,spit,dive,roar,spit,steam,vac,dive) so a phase usually has one vacuum.
- t12: hits 12-21 (avg 16), cont 1 in the same 5 seeds: vacuum 2.2 -> 1.8 but spit rocks 0.3 -> 1.4 (kept the
  order anyway: it is milder for a kid, the rocks are easier to read than the pull). The continue seeds all
  lose a life in the QUEEN lock first: queentr.js s9: 4 fans = 4 stinger hits, 1 swoop hit, 2 lock-bee hits.
- [t13] queen hp 34 -> 30, QUEEN_REST 30 -> 50; lock 3380: 1 bee (dropped bee -1 d320).
- t13: hits 10-18 (avg 13.1), deaths 1-4, cont 1 in 3 seeds (s1,s5,s9), 180-240 s (avg 206), boss 36-75 s (s1 11 s
  after a continue at the boss). Jungle 3.1/run (bees 1.6, queen 0.9, stingers 0.4); queen lock only 10-20 s.
- t13 s11-20: cont 1 in 6/10 (s14-19), hits 9-20 (avg 15.1). Over 20 seeds: 9/20 continue. Per run (20 seeds):
  crater 5.7 (vacuum 2.1, rocks 1.1, steam 1.1, drops 0.65, bee 0.45, frog 0.25), lava 2.6 (bombs 1.8),
  jungle 3.4, first bee 1.25 (+ ski sharks 1.3, no heart). Heals ~3 honey + ~1 heart.
- [t14] whale hp 420 -> 380 (fewer attacks per fight); lava bombs 300 -> 360 f (lock 150 -> 180).
- t14 (20 seeds): cont 1 in 7/20 (s1-10: 2), hits 9-19 (avg 13.6), deaths 1-4 (mean 2.3), 180-246 s (avg 206),
  boss 45-72 s without a continue (19-38 s after one: measured from the rebuilt whale).
  Vacuum geometry: phase-1 pull (0.8) moves a standing hero ~80 px over VSUCK 130 (caught from ~ax+130); phase 2
  (1.1 x 170 f) ~140 px: catches a standing hero from ~ax+75, i.e. anywhere the bot stands after a PTOO (ax+100).
- [t15] phase-2 vacuum: pull 1.1 -> 0.95, VSUCK2 170 -> 150 (a hero standing mid-ledge is no longer caught; at the
  lip still; walking away still always wins).
- t15 = t14 (cont 7/20, deaths mean 2.35, hits 13.5, 204 s). vactr.js: the bot is caught because it stands AT THE
  LIP (x = ax+214) when the vacuum starts (it walks up to the whale), so pull strength doesn't matter for it.
  REVERTED the phase-2 pull/VSUCK2 change (keeps fixer C's tuning; no measured effect).
- [t16] queen hp 30 -> 36 (her fight was 10-11 s in 5/20 seeds: too short for a mini-boss), QUEEN_REST stays 50.
- t16 (queen 36): cont 10/20, deaths mean 2.9, hits 15.3, 216 s: worse (part chaos: the queen change reshuffles
  every later area) -> REVERTED queen hp to 30. Final config = t14 exactly (whale 380, bombs 360/180, queen 30,
  fixer C's vacuum untouched).
- parity (current src): L1 h0 s1 true [] [0,0,5,9] 14150; L2 s1 true [] [0,2,0,1,7] 31950 152.4 s deaths 0. OK.
- [final] re-running s1-10 plain (f-*) + dodger (fd-*) on the final files; expect f == t14 (determinism).

## Changes (final; originals in work-retune/*.pre-retune.js)
level3_bees.js
- bee hp 2 -> 1 (one shot pops it).
- DIVE_MAX 1 (new): after its dive a bee buzzes off (new state 'leave': up and out of the nearer screen side, then
  e.dead); was: it stayed and dived again until shot.
- FIRST_CD 150 (new): a new bee flies about 2.5 s before its first warning (was cd 50; hive bees 70; queen's 90).
- DIVE_GAP 90 -> 150 (breather after any dive before the next bee's warning).
- overLava(p) (new): no bee warning starts while the hero is over a lava river (+-10 px): bees attack on banks.
- hive: HIVE_GAP 180 -> 300 f between bees, HIVE_OWN 3 -> 2, HIVE_SCREEN 3 (new: no release while 3 bees are on
  screen), HIVE_TOTAL 2 (new: 2 bees in all, then it is empty); a full/empty hive waits at rel 37 (was 36: it re-shook
  and replayed the shake sound every frame while full); box 38 -> 42 wide (= the drawn hive with its outline).
- queen: hp 38 -> 30, QUEEN_BEES 3 -> 2, QUEEN_CALL_MAX 6 -> 2, QUEEN_REST 50 (new: +50 f after each attack).
- honey heals: +1 heart when hurt (still 1000 points; '+1 HEART' above 'YUM! HONEY').
level3.js
- spawn bee 2640 removed (20 px from the 2620 hive); lock 3380: bee -1 d320 removed; lock 4440: bee +1 d330 removed.
- lava bombs: every 300 -> 360 f (lock 150 -> 180) and they also hold while L3.beeBusy().
level3_boss.js
- megawhale hp 350 -> 380; rest between attacks 140-160 -> 200-220 (phase 2 112-128 -> 170-186);
  the next attack waits while L3.beeBusy(); attack order: the 2nd vacuum of a cycle comes later
  (ph1 vac,spit,dive,roar,spit,vac,dive; ph2 steam,vac,spit,dive,roar,spit,steam,vac,dive);
  a bee roar calls 1 bee from the right (was 2, one from each side); lava-shark roars still 2.
Unchanged: level3_enemies.js, jetski.js, level3_sky.js, level3_world.js.
- NOTE: full.sh's throttle `$(jobs -r | wc -l)` is always 0 in zsh (subshell): every batch so far ran all its
  seeds at once (10-20 sims), not 4. Results are unaffected (seeded, deterministic); fixed full.sh to xargs -P 4.

## Final table, never-dodging bot, s1-10 (out/f-<seed>.json/.err; identical to t14)
| seed | done | time s | hits by area | total | deaths | cont | boss s | errors |
|---|---|---|---|---|---|---|---|---|
| 1 | yes | 194 | 4,3,0,7 | 14 | 2 | 0 | 63.7 | 0 |
| 2 | yes | 192.8 | 2,4,1,5 | 12 | 1 | 0 | 71.6 | 0 |
| 3 | yes | 206.8 | 2,4,0,5 | 11 | 1 | 0 | 65.1 | 0 |
| 4 | yes | 201.7 | 2,3,3,4 | 12 | 2 | 0 | 56.8 | 0 |
| 5 | yes | 203.7 | 2,3,1,6 | 12 | 2 | 0 | 70.7 | 0 |
| 6 | yes | 191.7 | 3,2,1,6 | 12 | 2 | 0 | 70.5 | 0 |
| 7 | yes | 224.2 | 2,4,4,7 | 17 | 3 | 1 | 18.7 | 0 |
| 8 | yes | 179.7 | 2,3,0,4 | 9 | 1 | 0 | 55.5 | 0 |
| 9 | yes | 221.4 | 3,3,4,8 | 18 | 4 | 1 | 45.2 | 0 |
| 10 | yes | 182.7 | 3,2,3,6 | 14 | 2 | 0 | 55.9 | 0 |

mean: time 199.9 s (179.7-224.2), hits 13.1 (9-18), deaths 2.00, seeds with a continue 2/10, completed 10/10

Boss s = from the (last) whale appearance to the kill; s7/s9 had a game over at the boss: from the FIRST appearance 84.7 s (s7) / 72.5 s (s9), incl. the continue and the crater replay.
Seeds 11-20 (same config, t14): all complete, hits 10-19 (avg 14.1), 5/10 with 1 continue, 180-246 s.

## Dodging bot (dodge.js R30 away), s1-10 (out/fd-*)
| seed | done | time s | hits by area | total | deaths | cont | boss s | errors |
|---|---|---|---|---|---|---|---|---|
| 1 | yes | 186.5 | 1,1,2,4 | 8 | 1 | 0 | 54.8 | 0 |
| 2 | yes | 194.6 | 1,2,0,4 | 7 | 1 | 0 | 63 | 0 |
| 3 | yes | 219 | 2,2,2,5 | 11 | 2 | 0 | 65.5 | 0 |
| 4 | yes | 223.2 | 2,4,4,5 | 15 | 3 | 1 | 33.2 | 0 |
| 5 | yes | 190 | 2,2,0,4 | 8 | 1 | 0 | 56.3 | 0 |
| 6 | yes | 204 | 1,1,3,5 | 10 | 2 | 0 | 59.7 | 0 |
| 7 | yes | 238.7 | 1,1,3,2 | 7 | 1 | 0 | 55 | 0 |
| 8 | yes | 192.9 | 2,1,4,5 | 12 | 2 | 0 | 56.7 | 0 |
| 9 | yes | 180 | 2,1,4,4 | 11 | 2 | 0 | 52.6 | 0 |
| 10 | yes | 191.2 | 2,3,0,2 | 7 | 0 | 0 | 56.1 | 0 |

mean: time 202.0 s (180-238.7), hits 9.6 (7-15), deaths 1.50, seeds with a continue 1/10, completed 10/10

## Checks on the final files
- parity: L1 h0 s1 true [] [0,0,5,9] 14150; L2 s1 true [] [0,2,0,1,7] 31950 152.4 s, deaths 0. OK.
- loop-test 49 ok (no FAIL); flow-selftest 23 ok; api-fixes 37 ok; review-code s-swarm / s-whale / s-moments:
  errors [], no THREW.
- bee hits per run (never-dodger, s1-10 by area): 1.2 / 1.6 / 0.4 / 0.6; dodger 0. beelife s1: jungle 7 bees,
  4 dives; lava 5 bees, 1 dive; crater 1 bee.
- drawrand.js (review-code) on M3 s1, draw every frame: completed, errors [], 0 DRAWRAND/DRAWERR lines.
