# Integrator notes (Mission 2 fix round)

Started 2026-11-11 14:27 CET. Restart-safe log: status at top, detail below. Scratch/pictures: RD/after.
(RD = /Users/macbookair/game/tools/review, FX = RD/fix, T = /Users/macbookair/game/tools/harness)

## Status
- [x] 1 checks (node --check, sims M2/M1, compare-refactor, compare-screens, fixtures, loop-test, sound parity)
- [x] 2 cross-group checks
- [x] 3 fuzz fixtures + random fuzz
- [x] 4 render sweep + contact sheets
- [x] 5 before/after pairs
- [x] 6 build + built checks
- [x] 7 real browser
- [x] 8 docs + harness copies

## Log
- 14:27 live src vs FX/src-base: exactly the 11 owned files changed (core engine level1 level2 level2_boss level2_enemies
  level2_sky level2_world screens vehicle weapons_extra). audio/heroes/weapons/main/manifest identical. Mission 3 files
  (level3*.js, jetski.js) present in src/ but not in the manifest (not ours, untouched).
- 14:28 node --check: all 22 src files ok. policycheck --group all: RESULT ok (11 owned files changed, no random calls
  added, no glyph problems). after/policycheck.txt. Diffs of every group: after/diff-*.txt (reviewed).
- 14:35 regress.sh after/reg (real tree, N 3): RESULT ALL PASS. M1 10/10 == legacy, M1 sound SAME 1928 events,
  M2 h0=h1: s1 152.4 s d0 c0 hits 10, s2 171.3 d2 c0 13, s3 160.6 d2 c0 14, s4 168.1 d2 c0 14, s5 160.9 d1 c0 10,
  errors [] warnings 0 (pre-fix 181.6/180.1/176.1/180.4/177.4, 2 deaths, 0 cont, hits 14-16). flow 18, api 37,
  selftest DONE, loop-test ALL OK.
- 14:36 started balance run after/bal (seeds 1-20 x h0/h1, iobs+wobs+lockobs+after/fx/k10.js), pool 3.
- 14:47 compare-refactor.sh: title differs only in [426,564,1013,587] (K8), select/x250/1950/3350/4620 0 px.
  compare-screens.sh: win [489,642,950,665] (pre-existing MISSION 2 prompt), over 0 px, pause [453,450,992,473] (flow-7).
  Viewed: after/shots/m1/refactor-diffs.png, refactor-screens.png (all intended).
- 14:48-15:00 balance after/bal (40 runs, summ.py -> summary.txt): all win, errors [] warnings 0, h0==h1 20/20,
  152.2-171.3 s (median 159.5), hits 9-16 (median 10.5), deaths 0-2, continues 0 everywhere. S 20/20 (25-30 shots),
  F on foot 19/20 (100-240 shots, s6 lost: bot jumped over it), B riding 20/20, H riding 20/20 (175-200 HMG shots at
  the boss). R only 9/20 collected+fired: never freed 3 (s7 s11 s14, bot hopped over the cage), tossed short 5
  (s3 s4 s13 s15 s20: the flame frees the pony from ~300 px during the 2250 lock, the +-4 px x 38 f toss reaches 152 px,
  lands ~2441, culled when the lock ends), landed at the 2440 boulder's foot under the bot standing on it 3 (s8 s16 s17).
  Locks: 2250 10.6-19.9 s, boss 47.7-55.5 s. K10: 101 rocket bursts in the 2250 lock, 94 on robots, 7 in canopies.
- 15:00 cross checks after/x (all on the real tree): ridenoswipe swipe 0 hints 0 laser 1 riding 3018; lab-swipe wall-0
  ok through rt 20, wall-5 through 25, 10+ all ok; flash2 hmg 2.4/s (hp 299) pistol 2.2 (387) flame 2.4 (338) tractor
  rider 2.4 (393); bossdeath2 megabear A/B/C 0/60/109 + B/C 149 win (670-779), A-149 over -> continue cam 5450 hero 5510
  checkpoint 5450 music vigo; crab A 0/60/109 + B all win (692-801), A-149 over (cont 4400, music main);
  fx-bossend hitDuring win 630, deadBefore win 660, deadAfterWin OVER 381 (fixture forces q.dead on the kill frame after
  onKill's revive check, bypassing hurtPlayer: unreachable in game; needs the engine net the plan excluded);
  killboss2 BIG on at 450 (t 129, winT 209) x4; contrender 5921.6: continue cam 5450 hero 5510 big MISSION 2 START!
  banner FINAL AREA: THE BIG CHERRY TREES, said Mission two, start! @0 and @150; menuflow2 play:victory@212, title
  music none level 0, play ROBOT JUNGLE; quitflow l1/l2 ok; ridepause help shown; wreck texts BATTLE TRACTOR!, help,
  BAIL OUT!; edgepush bear 0/76, tank 0/76; sandwich visible 40/40; fx-push 0/60 foot, 0/60 tractor; lab-wolf safe from
  10; lab-charge robobear 13/12/21 bear 17/17/25; powcull2 R dropped on screen for every k (lost 41 f later: hero
  400 px ahead running right, as the level group found). All JSON errors [] warnings [].
- 15:02 DECISION: integration fix in level2.js toss(): a far hero (> 152 px) gets a higher, longer lob (T up to 80 f,
  vx still <= 4, vy -3.4*T/38) so the pony's R reaches the hero across the locked screen / onto the boulder. Short
  tosses unchanged. Backup: after/level2.before-integrator.js. Re-run balance + regress after.
- 15:05 bal2 (after the lob): all 40 sim JSONs byte-identical to bal (the bot's game is unchanged); R fates: case B now
  lands near the hero (2563-2626 instead of 2441) but the lock ends as it arrives (the flame freed the pony while
  burning the lock's last wolf at the left) and the bot walks on; case C (boulder foot, short toss path) unchanged.
  tossdemo (free the first dog, keep walking right, --x 600): level group's toss lands the S at 677 behind the hero
  (left behind); with the lob the S lands on the hero (collected f85). Kept: it fixes K1's main case for a walking kid.
  Old-toss root for comparisons: after/oldtoss/game (RR_GAME).
- 15:10 sweep after/shots/sweep (75 renders, errors [] in all): sheets after/shots/sheet-sweep-a/b, sheet-intro-locks,
  sheet-tractor-boss, sheet-screens (all viewed). Only oddities: devStart artefacts (MISSION 2 START! band under the
  boss WARNING band at --x 5921.6; band + banner over the boarding frame) and single-draw renders catching the
  MEGA BEAR white (drawBear's capped flash needs per-frame draws; after/fx/drawevery.js / flash2.js show it right).
- 15:20 before/after: after/ba (58 renders + cont190/soil1451), tools/ba.mjs, specs ba/spec-main.json + spec-art.json ->
  after/before-after.png (10 items) + after/before-after-art.png (art polish). Viewed both.
- 15:30 sound (after/snd, logs l2s1-3, boss1-3, flame, shotgun, ride, ridefire, rain, allclear): animal calls GAP0.6 dog
  +2.5..+15.2, sheep +2.6/-3.9/+2.6, pony +6.2/+5.0/-0.1, cow -0.4/-6.1/-9.8, hen +4.6/+3.2/+3.4, goat +6.9/-1.7/-1.6
  (14/21 above the rest; pre-fix 5/21); MEGA BEAR grunt -1.9 x3, rise -2.0/-1.1/-1.2, whine -1.7/+1.0/-2.7, growl GAP0.5
  -2.6/-1.2/-1.6; iso laptop thud -45.3, rumble -43.8, heavy -45.6, tractor landing -43.6; flame -39.7, shotgun -35.7
  (peak -14.6); tractor engine -43.2 (with fire -45.1 vs gun -40.9); rain downpour -42.3 / drizzle -45.4 vs music -38.1;
  vigo -38.0/-40.8, bearboss -38.8/-41.5, victory -38.3/-40.9. Full mix l2s1 I -31.1 peak -3.3 dBFS (pre-fix -32.6 /
  -4.1): no clipping. Wolf growl GAP0.5 was -2.6/-0.6/-3.2 (s3 under -3: the louder flame hiss, shotgun and tractor
  gun mask it) -> INTEGRATION FIX level2_enemies.js:239 growl mid layer 0.16/0.12 -> 0.2/0.15 (offline grid x1.25):
  -1.3/+0.7/-1.8, iso peak -18.7 dBFS, sims identical. Backup after/level2_enemies.before-integrator.js.

## Resumed by the lead session after the 15:20 restart (Nov 11)
- 15:28 state: plan + 5 fixers done (workflow journal), integrator log above reached sound checks. Steps 1, 2, 4, 5 done per the log.
- 15:30 node --check of the 15 manifest files ok; python3 build.py -> index.html 653686 bytes (15 files; no Mission 3 file inside).
- Fuzz (step 3): after/fuzz jobs 1-23 had finished before the restart (errors [], 0 invariant violations, heroOffScreen 0,
  stuckMax 1249); jobs 24-46 re-run with pool.py.
- Browser (step 7): preview server "game" (.claude/launch.json, port 8123). index.html: title -> missions -> VIGO HILLS ->
  select -> intro (ENTER: SKIP shown); console empty; devStart({level: 2, x: 5921.6}): MEGA BEAR 480 hp in the arena,
  0.56 ms per update+draw; network: only index.html.
- Docs (step 8): engine-api.md already points to tools/harness; level2-spec.md already has the toss lob and the growl note;
  tools/harness/README.md: the new intended compare differences (title hint, pause Q quit) and 5 Mission 2 areas.
- 15:45 fuzz final (after/fuzz, 46 runs x 40000 frames, fuzz2-frozen-a.js): errors [] everywhere, 0 invariant violations,
  heroOffScreen 0 (pre-fix: in 60 of 120 runs), stuckMax 1364 frames, 410 tractor boardings / 403 exits / 6 wrecks.
- 15:45 built index.html: regress.sh reg-built (--html index.html) RESULT ALL PASS (M1 10/10 == legacy, M1 sound SAME
  1928, M2 s1-5 x h0/h1 win errors [] 152-171 s, flow 18, api 37, selftest DONE); M2 s1 --html == src; loop-test built
  ALL OK. Before/after sheets sent to the user. Fix round DONE.
