# Fixer notes: group boss (src/level2_boss.js, src/level1.js)

Restart-safe log, appended as I go. R = /Users/macbookair/game/tools/review/fix/boss/game (RR_GAME root).
Scratch: RD/fix/boss/work, RD/fix/boss/shots. T = /Users/macbookair/game/tools/harness.

## Status
- [x] boss-1 art-1 (flash cap)            start-boss #0 (rewritten with ??)
- [x] boss-2 kids-2 (swipe)               start-boss #1-#4 + comment
- [x] boss-3 kids-1/bugs-2 (riders)       start-boss #6, #7
- [x] boss-4 bugs-1/fuzz-2 (megabear)     start-boss #5 (comment folded)  [be-deadAfterWin stays 'over': see log]
- [x] boss-5 bugs-1 (crab, level1.js)     start-boss #8 (one comment line)
- [x] boss-6 art-2 (MEGA BEAR DOWN! band)
- [x] boss-7 audio-3 (grunt/rise/growl/whine)  growl 0.24, whine 0.13 (verdict 0.2 / 0.1)
- [x] boss-8 audio-4 (thud/rumble crunch)      thud square 0.13*v (verdict 0.1*v)
- [x] final: policycheck ok, regress ALL PASS, compare-m1 as expected, smoke with all start lists ok
- [x] DONE 14:30, StructuredOutput returned. Files final: src/level2_boss.js (mtime 12:48), src/level1.js (12:17).

## Log
- (start) both owned files pristine (cmp == src-base). No earlier run.
- boss-1 art-1 DONE. Pre-fix measured on R (flash2.js, sim --x 5921.6 --god, frames 300-900): HMG 14.4/s hp 301, pistol 6.6/s hp 387,
  flame 11.2/s hp 340. Applied start-boss #0, then rewrote it with `??` (plan allows; engine.js uses it) + one comment line:
  `if (e.hitT >= 3 && G.t - (e.flashAt ?? -99) >= 24) e.flashAt = G.t;` / `FLASH = G.t - (e.flashAt ?? -99) < 2;`.
  G.t is never reset (engine.js update G.t++ only), so flashAt stays valid. After (this edit alone): HMG 2.4/s hp 301, pistol 2.2/s
  hp 387, flame 2.3/s hp 340 -> hp identical to pre-fix (draw-only). Outputs: boss/work/pre-flash-*.txt, a1-flash-*.txt.
  Visual: renders frames 400-407 HMG held (flash2.js draws every frame; ~40 s per render, slow!), before = RD/before page,
  after = R: shots/a1-strip-hmg.png (bear crop). Before: white at 400,401,406,407 (strobe); after: brown in all 8; 402-405
  pixel-identical (diff 0). Mission 2 sims s1, s2 with art-1 alone: byte-identical to baseline (=base).
  Tool: boss/work/sheet.mjs (VE/sheet.mjs with createRequire -> T/harness.mjs).
- Applied start-boss #1-#8 (all matched once). Then: swipe comment -> (0-24) (24-44) (44-52); megabear onKill's 3 trailing
  comments folded into one 2-line comment above the 3 lines; crab onKill: one short comment line above the 2 lines.
- Tests (boss/work/bd, all RR_GAME=R, 2 at a time, ~6 min for 24 runs):
  lab-swipe: walk wall-0 ok through rt 20 (25 HIT), wall-5 through rt 25, wall-10+ all ok; walk+jump identical.  [kids-2 OK]
  bossdeath2 megabear A/B/C x 0/60/109/149: all win (A-0 670, A-60 730, A-109 779, B/C 670) except A-149 over at 421 (hero
  dead 149 before the kill; continue at cam 4400, music vigo) = expected.  crab A/B: win (A-0 692, A-60 752, A-109 801, B 692)
  except A-149 over at 443 = expected.  errors [] in every JSON.
  fx-bossend: hitDuring win at 630 (150 hurtPlayer calls, no death); deadBefore win at 660; deadAfterWin OVER at 381.
  deadAfterWin analysis: the fixture forces q.dead = 1 AND G.lives = 1 directly (bypassing hurtPlayer) on the first frame
  with G.winT > 0. With this fix G.winT is set in onKill, so that is the kill frame itself (272) -> respawn at lives 0 ->
  over. The fuzz report's 'win at 630' was for patched/index-bugs1.html (p.inv 400 + engine net playerRespawn
  `G.lives > 0 || G.winT > 0`, winT only set at st 150 -> forced death at 422). The planner never ran it on bd-fix (no BE
  output in plan-work). In the fixed game that state is unreachable: the hero only dies through hurtPlayer (engine.js:217,
  grep: no other p.dead writer), which returns while G.winT > 0, i.e. from the kill on; a death begun before the kill is
  revived by the lives-2 line (deadBefore, A-0..A-109). The plan forbids the engine net, so no change: REPORT to integrator.
- boss-4 bugs-1 alone (page work/bd-only.html = src-base + my final megabear onKill): M2 s1-5 h0 byte-identical to baseline (=base).
- boss-3 kids-1: ridenoswipe (render 3300 frames, ~6 min): RNS boarded 273, riding 3018, swipe 0, laser 1, hints 0, errors [].
  Picture: work/riderhint.js (tractor 150 px left of the bear, HIGH laser forced 30 frames later), renders f331 (aim) and f357
  (fire) before (RD/before page) / after (R): shots/k1-rider-hint.png: DUCK! over the tractor before, nothing after; diff box
  only the hint [696,540,779,590].
- boss-6 art-2: stepDying st 150 -> `G.big = { s: 'MEGA BEAR DOWN!', t: 130 };` (G.texts.push removed). Fixture work/killboss2.js.
- boss-7/8 sounds: verdict values applied, then measured (logs boss/work/snd: pre = base-game root, post = R, --x 5921.6 s1-3).
  an.mjs cue medians (default GAP 0.3) pre -> verdict values: grunt -9.7/-9.9/-9.5 -> -1.5/-1.4/-1.4; rise -4.3/-4.2/-4.6 ->
  -1.7/-0.8/-0.9; growl -17.9/-17.9/-17.6 -> -6.0/-3.8/-5.7 (GAP 0.3 splits each growl: its 4th tone at +0.36 s is
  scored alone; GAP=0.5 groups the whole growl: pre -19.3/-19.2/-19.4 -> -3.5/-2.2/-2.5); whine -10.9/-11.5/-7.9 ->
  -3.7/-1.0/-4.8. iso thud (first event = v 0.41+0.61 approach tremors) laptop -55.6 -> -46.5 (target -46), rumble -54.1
  -> -43.8. Offline exploration (snd/scale.py, scale2.py scale the vol of logged events; snd/iso2.mjs = every group):
  growl x1.1 (0.22) GAP0.5 -2.8/-1.5/-1.8; whine x1.3 (0.13) -1.7/+1.0/-2.7; thud square layer x1.3 (0.13*v) first-event
  laptop -45.3, all-thud median laptop -41.5 (pre -51.8), full-range median -32.2 (pre -33.2, +1.0 dB), max peak -9.1 dBFS.
  -> DECISION: growl 0.2 -> 0.22, whine 0.1 -> 0.13, thud square 0.1*v -> 0.13*v (small bumps over the verdict values to
  meet the plan's targets); grunt, rise, rumble and the thud noise layer exactly as the verdict. Re-measure with real logs.
- Real logs with growl 0.22 / whine 0.13 / thud square 0.13*v (snd/fin-s*.log, final-measures.txt): grunt -1.9/-1.9/-1.9,
  rise -1.8/-0.9/-1.0, whine -1.7/+1.0/-2.7, growl GAP0.5 -3.3/-1.9/-2.3 (GAP0.3 -5.9/-3.6/-5.6, split artifact), thud iso
  laptop -45.3 (full -35.7), all-thud median laptop -41.5/-41.4/-41.4, rumble iso laptop -43.8 (full Mmax -33.4 vs -34.2).
  snd/cue3.mjs (per-cue masker breakdown): the pound growl (st 30) window overlaps its own slam 0.4 s later (boom :816 + thud
  :757), which is the residual masking; the louder thud lowered the growl/grunt ratios a little.
  Offline growl 0.24: GAP0.5 -2.6/-1.2/-1.6 (GAP0.3 still -5.2/-3.1/-5.0: the lone 4th tone). -> growl 0.22 -> 0.24.
  Peaks (snd/tmp/synthetic.log, iso2.mjs, single sounds): shotgun pre -10.4 dBFS, gear plan -14.8; grunt -16.6, rise -19.5,
  growl(0.22) -19.5, whine -24.1 (all below both); thud(1.0) -15.5 -> -11.2, thud(1.4) -12.6 -> -8.3 (slam; its Snd.boom(true)
  alone peaks -9.6); rumble -16.2 -> -14.9. Full-range M: thud(1.0) -33.5 -> -32.6, thud(1.4) -30.8 -> -29.9 (+0.9 dB).
- e.pups left in place (now write-only in level2_boss.js) because the fuzz drivers fuzz2-frozen-b/c.js read e.pups for stats.
  NOTE for the lead: src/level3_boss.js (Mission 3 session, not ours) copies the old pattern `for (const m of e.pups) ...
  damageEnemy(m, 99)` in its onKill: it will have the same last-life death window unless it adopts G.winT = 360 + revive.
- (12:50) running policycheck, regress.sh (work/reg), compare-m1.sh (shots/m1).
- regress.sh (work/reg, load avg ~350!, ~10 min): RESULT ALL PASS. M1 10/10 identical to legacy; M1 sound s1 SAME (1928
  events); M2 h0=h1 s1-5 win 182.2/178.6/173.3/182.3/178.0 s (pre-fix 181.6/180.1/176.1/180.4/177.4), deaths 1/1/1/2/2
  (pre 2 each), cont 0, boss-section hits 6/6/8/10/7 (pre-fix s1 10), errors [], warnings 0; flow 18/18, api 37/37,
  selftest DONE, loop-test ALL OK.
- compare-m1.sh (shots/m1): every case identical to base (13/13); vs legacy identical except win (prompt line box
  [489,642,950,665], the pre-existing PRESS ENTER FOR MISSION 2!). crab and x4620 identical to base and legacy.
- (13:20) running final task tests on the final code (work/finjobs.txt, pool N=1, outputs work/fin, snd/fin2-*).
- Pre-fix confirmations (base-game root, work/pre): megabear A-0 over at 421, B-60 over at 481 (winT 189 when the hero died),
  C-0 over at 565 (a real wolf kills at st 143); crab A-0 over at 443, B-60 over at 503. Fixed: all win (above).
  Fresh `sim --legacy backup/index-before-level2.html --level 1 --seed 1` h0 and h1: byte-identical to the boss root's M1 JSONs.
- lockobs (work/lock, full M2 sims h0): MEGA BEAR lock 5720: 58.3/56.6/57.2/61.2/59.3 s (pre-fix 57.7-59.9), pistol, win, errors [].
- Final task tests on the FINAL code (work/fin): lab-swipe same as before (wall-0 ok <= rt 20, wall-5 <= 25, 10+ all ok);
  bossdeath2 megabear all win except A-149 (A-0 670, A-60 730, A-109 779, B/C 670), crab all win except A-149 (692-801);
  fx-bossend hitDuring win 630, deadBefore win 660, deadAfterWin over 381 (see analysis above); flash2 final HMG 2.4/s
  (hp 299: the swipe timing shifts the fight a little; art-1 alone kept 301), pistol 2.2/s (hp 387), flame 2.4/s (hp 338);
  ridenoswipe final RNS swipe 0, hints 0, laser 1, riding 3018, errors []; arena sims (--x 5921.6) all win errors [].
- Arena balance probe (bot never dodges; work/hurt, work/rocks): 20 seeds from --x 5921.6: deaths 37 -> 52, runs with a
  GAME OVER 1 -> 3 (s4, s8, s14), median 69.7 -> 70.4 s. First attempt, 10 seeds, hits by cause (rocklog2.js, stack of
  hurtPlayer): swipe 9 -> 4, rocks 22 -> 30, wolves (contact) 8 -> 13, waves 13 -> 14, laser 10 -> 12 (62 -> 73, ~1.3 sigma).
  Full-mission sims s1-5 the other way: boss hits 45 -> 37, deaths 10 -> 7, lock 56.6-61.2 s. Likely mechanism for rocks:
  the closer prowl (tx = p.x + REACH + 8 = 128 instead of 144) puts the phase-2 third rock, clamped at e.x - 102, 26 px to
  the right of the hero instead of 42: a bot walking right into the bear meets it. Kids see the landing rings ~75 frames
  ahead. Not changed (the plan accepts REACH's prowl effect); REPORT to the lead/integrator.
- Final sound measures (snd/final2-measures.txt, logs fin2-s1..3 with the final values): grunt -1.9/-1.9/-1.9; rise
  -2.0/-1.1/-1.2; growl GAP0.5 -2.6/-1.2/-1.6 (default GAP -5.2/-3.1/-5.0: 4th tone scored alone); whine -1.7/+1.0/-2.7;
  iso peaks grunt -16.6, rise -19.5, growl -18.8, whine -24.1 dBFS (shotgun pre -10.4, gear plan -14.8). thud iso laptop
  -45.3 (pre -55.6), full Mmax -35.7 (pre -36.6); all-thud median laptop -41.5 (pre -51.8), max peak -9.1/-8.6 (pre -12.4);
  rumble laptop -43.8 (pre -54.1), full Mmax -33.4 (pre -34.2).
- (14:15) integration smoke page work/allstart-boss.html = my live files + start-engine/level/wild/gear lists.
- Smoke (work/allstart-boss.html = final boss files + start-engine/level/wild/gear, work/smoke): M2 s1-3 win 152.4/171.3/160.6 s
  errors [] (= the planner's allstart numbers: art-2 and the sounds are sim-neutral), M1 s1 == legacy, megabear A-0/B-60/C-0
  and crab A-0/B-60 win, lab-swipe as alone, MEGA BEAR DOWN! band at 450, ridenoswipe swipe 0 hints 0 laser 1 riding 3018.
- Final checks 14:25: node --check both ok; audio/heroes/weapons/main/manifest unchanged; policycheck --group boss ok.
