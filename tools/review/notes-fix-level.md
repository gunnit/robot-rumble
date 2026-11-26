# Fixer notes: group "level" (src/level2.js, docs/level2-spec.md)

Restart-safe log, appended as I go. R = RD/fix/level/game (RR_GAME root), FX = RD/fix, T = tools/harness.
Scratch: FX/level/work, FX/level/shots. Plan: RD/fix-plan.md (Group: level, tasks level-1 .. level-12).

## Status
- 2026-11-11 start: src/level2.js == FX/src-base/level2.js (pristine), docs/level2-spec.md unchanged since Nov 1.

## Log
- Pre-fix refs (FX/level/work/pre, base-game root): sound logs l2s1-3.log; cue (GAP=0.6, = the verdict's numbers): sheep
  -13.5/-10.5/-9.3, pony -0.2/-10.2/-13.3, cow -15.7/-11.5/-11.6, goat -1.9/-8.8/-8.9, hen +6.6/+2.9/+5.1, dog (2 calls)
  -1.1/21.4, -1/17.2, -1.1/7.3; creak -6.5 (all seeds). iso l2s1 peaks: dog -26.4, sheep -33.3, pony -34.3, cow -25.3,
  hen -30.8, goat -33.3, creak -35.8 dBFS. music l2s1: vigo all -38.9 / lap -44.8, lead -51.6, bass -41.7 / lap -48.5;
  bearboss -38.8 / -41.5. MUSO lead square + bassUp: vigo -38.0 / -40.8, lead -47.2, bass lap -42.3.
- level-1/2/3 + start list: applied start-level.json all (#0 toss, #1 pows, #2 startText/Say, #3 menuBG), then toss() helper
  (after the POW_KINDS loop) with the on-screen clamp and the bugs-3 catch loop before the toss loop in VIGO.update.
- iobs/wobs on my root s1-5 h0/h1 (work/t1): all win, errors [], 161-171 s, 0 continues; S, F, B, H collected 10/10
  (H while riding, last pickup), R collected 1/5 seeds (lost s1-s4: bot hops over it / stands on the 2440 boulder / far).
  Same as the validated start list alone (work/startonly.html, identical sims) -> the clamp/catch never trigger there.
  With the gear start list too (work/gear.html, flame 240): seeds 1-10 R collected 6/10 (s1 2 5 6 9 10), s7 pony never
  freed, s3/s4/s8 lost at 2441 (boulder base / hero 290 px away: the +-4 px/frame toss reaches 152 px).
- bugs-3: work/powcull2.js (adapted, + item fate, + VC_HX hero offset). Found a gap in the planned threshold -36: an
  animal at x in (cam-36, cam-15] at salute t 40 drops its item at x-10, which updateItems culls in the same frame (before
  LV.update can toss it): base and plan -36 both 'lost at once' for k 16-20. Threshold changed to o.x <= cam.x - 15
  (math: not caught => o.x > cam-15 => x-10.6 > cam'-30 for any 4 px camera step). Now every k drops the R on screen.
  Collected in none of the fixture runs: the hero runs right from cam+440 (also 300/220/160), out of the +-4 toss reach.
- level-4 kids-8: SECTIONS 4400 -> 'AREA 4: CHERRY ORCHARD', + { x: 5450, 'FINAL AREA: THE BIG CHERRY TREES' } (comment).
  bossdeath2 A-149 at --x 5921.6: base 'RB continue -> state play cam 4400 hero x 4460 checkpoint 4400 ... music vigo',
  mine 'cam 5450 hero x 5510 checkpoint 5450 continues 1 boss present false music vigo'. --x 5460 s1-3: win 63.8/76.4/
  61.6 s, errors [], hitsBySection 5 entries. Render shots/banner-5450.png: the 32-char banner fits (382 px).
- level-5 audio-2: SOUNDS volumes as the verdict (dog 0.14 + noise 0.1, sheep/goat 0.13, pony 0.12, cow 0.15/0.09/0.11/
  0.07, hen 0.08). Post logs work/t3/l2s1-3.log, cue GAP=0.6 (lines 469-474): sheep +0.7/-2.0/+0.4, pony +7.7/+6.2/-0.6,
  cow -5.5/-2.9/-10.1, hen +4.1/+3.2/+6.4, goat +2.2/+1.2/-1.6, dog 2.5/8.8, 2.6/12.3, 2.5/9.7 -> 15 of 21 calls >= 0 dB
  (pre-fix 5 of 21). Cow: the verdict's values give ~+6 dB (pre log scaled: -9.5/-5.2/-5.4; the music change costs it
  0.1-0.3 dB); it is freed in the farm (tractor noise) and stays under; louder moo variants (0.2) only reach -3/-1/-8:
  kept the verdict's values. iso peaks (full): dog -22.5, sheep -24.1, pony -24.8, cow -18.9, hen -28.3, goat -24.1 dBFS
  (all below the shotgun's -10.2).
- level-6 audio-7: TRACKS.vigo lead 'square', bass [50,0,57,62,0,57], comment. an.mjs music on a fresh log (work/t3/
  l2s1.log): vigo all -38.0 / lap -40.8, lead -47.2, bass -41.0 / lap -42.3 (= MUSO prediction, 0.0 dB off); bearboss
  unchanged -38.8 / -41.5.
- level-7 audio-9: the planned doubling measured -6.4 dB (pre -6.5): the octave-up drone (D3 147, A3 220, D4 294 Hz) now
  sits in the creak's band (pre log with the creak x2 and the OLD music: -1.1; with MUSO bassUp: -6.4). Doubled again:
  tones 0.12/0.12/0.1, noise 0.12 -> cue -1.0 dB (fresh log work/t3/creak.log, line 681), iso peak -24.1 dBFS.
- level-10/11/12: VIGO clearMusic 'victory' + startText/startSay (own line, comment), the intro's at(IT.go) uses VIGO
  .startText/startSay. TRACKS.victory: 6/8 at bpm 150, square lead, the jig's (raised) drone, 8 bars, drums like vigo.
  both.html (my root + start-engine.json): menuflow2 -> 'play:victory@212', title music none, then ROBOT JUNGLE. allclear
  render 2400 frames + sndlog: victory -38.3 / lap -40.9 (vigo -38.0 / -40.8). WAVs for a by-ear check:
  FX/level/shots/victory-loop.wav, vigo-jig.wav (offline synth).
- level-8 kids-11: intro draw, 'ENTER: SKIP' 1x '#9aa3c0' right-aligned at W - 8 in the bottom bar, alpha
  min(1, (t-134)/12, (IT.go-t)/8), hidden once skipped; intro comment updated. Renders (shots/intro, scale 2) vs base:
  f100 identical (caption), f200 differs only in [814,500,943,513] = the hint (opened: readable, muted), f290 identical.
- level-9 art-7: drawTied's bubble block -> helpBubble(K, o) (same pixels, own translate to the cage, same blink);
  VIGO.drawOverlay calls L2.drawOverlay, then translate(-cx) and draws the tied cages' bubbles. Renders vs base-game
  (shots/bubble, scale 3): x 3651.6 (hen in the downpour) f30/100/180 differ only in the bubble box [999,543,1103,593]:
  base bubble greyed by the storm tint and rain streaks, mine crisp white (pair-3651-100z.png). x 4451.6 (goat) f30-180
  differ only in the banner (AREA 4 rename), f210/260/290/340 identical (no petal over the bubble in those frames; same
  pixels when nothing covers it).
- level-10/11 tests on work/both.html (my root + start-engine.json): contrender 'big MISSION 2 START!', 'Mission two,
  start!' at devStart and at the continue, errors []; --screen select + VC/lvl1.js -> the ria and hills behind the cards
  (shots/select-vigo.png), errors [].
- docs/level2-spec.md updated (copy of the old one: work/level2-spec.before.md): level fields (clearMusic, startText/Say,
  menuBG), mission flow, harness path, layout table (AREA 4 + FINAL AREA 5450 checkpoint), rescues (order, toss, catch,
  louder calls, bubbles), wolf skid, bear charge box / legs / push clamp, eagles in the rain, MEGA BEAR fixes, tractor
  (help line, BAIL OUT!, tilt, sounds), shotgun/flame, sky (rain hiss, 180 px crossfades), world (soil dither, canopies,
  flag), music (vigo square + D3 drone, victory), intro ENTER: SKIP. Other groups' lines from the plan + their notes
  (13:2x): boss growl/whine/thud bumps, wild art-3 P5, gear art-8 three canopies, art-10 per-border widths.
- Comments: pows comment rewritten (flame for the woods, rockets for the ROBO BEAR, grenades for the farm, hearts, H; S F R
  on foot); plats/spawns 'FINAL AREA' comments -> 'AREA 4'; hint and victory comments polished. policycheck --group level:
  RESULT ok (before the comment edits; re-run at the end).
- Variant pages for the draw-only and sound-only claims: work/var/drawonly.json/.html (art-7 + kids-11 on src-base),
  work/var/soundonly.json/.html (SOUNDS, creak, vigo track, victory track on src-base). To run: M2 sims vs baseline.
- 13:05 regress.sh restarted on the final code (work/reg, work/reg.out); load average ~290 (all fixers running).
- K1/R analysis (work/tobs.js observer, t1/tobs-*.err, t1/so-*.err, t1/gear-*.err): every lost R is either the bot
  hopping over it / standing on the 2440 boulder above it (s1 s2 s3 s8), or the hero > 152 px away standing at the 2250
  lock (s4 root, s3 s4 gear): the planned +-4 px/frame toss lands 137 px short at the boulder's base; the bot never walks
  back and the camera culls it after the lock. Kept the planned +-4 (validated design); reported, not changed.
- Final verification jobs prepared: work/fin/jobs.txt (iobs/wobs/tobs s1-5 h0/h1, drawonly/soundonly s1-2, powcull2,
  contrender/menuflow2/select on a fresh fin/both.html). Run after regress.sh.
- 13:2x regress.sh work/reg R: RESULT ALL PASS. M1 10/10 == legacy, M1 sound s1 SAME (1928 events), M2 h0/h1 s1-5 win
  errors [] warnings 0: 171.3/165.7/161/166.6/163.4 s, deaths 1-2, 0 continues, hits 12-15 (5 sections), flow 18 ok,
  api 37 ok, engine-selftest DONE, loop-test ALL OK.
- Final jobs (work/fin, fresh both.html): iobs/wobs/tobs s1-5 h0/h1 (h0 == h1): all win, 0 continues, errors []; S, F, B,
  H collected 10/10 (H while riding, the last pickup: hmg 200 shots at the boss), F fired on foot 107-120 shots (120 fuel
  in my root), S 26-30 shots, R collected and fired (11 rockets) in s5 only (s1-s4: bot hops over it / far, see above).
  drawonly s1/s2 and soundonly s1/s2 pages: M2 sims byte-identical to the pre-fix baseline (=base). powcull2 (cam+440):
  R dropped on screen for every k (k 0-20 by the catch at x 2338, k >= 25 by the engine at t 40 then tossed), never
  culled at once; lost ~41 frames later (the hero runs right, 400 px ahead). contrender: MISSION 2 START! / 'Mission
  two, start!' at devStart and continue. menuflow2: play:victory@212, title music none, then ROBOT JUNGLE. select:
  errors []. Mission select: only the VIGO card's '4 AREAS' -> '5 AREAS' differs from base ([834,576,851,599] at
  scale 3, shots/missions-pair.png).
- compare-m1.sh shots/m1 R: title, select, win (= base; vs legacy the pre-existing prompt line [489,642,950,665]), over,
  pause, allclear, x250/1950/3350/4620, tank, crab identical to base (and legacy); missions differs only in
  [834,576,851,599] = the VIGO card's '5 AREAS' (planned with kids-8).
- Final: node --check level2.js ok; policycheck --group level RESULT ok; level2.js md5 0486bdc3a144d60f7a03f7ab97251376.
  DONE (all 12 tasks); returning the JSON.
## Status (final)
- [x] level-1..12 done; deviations: bugs-3 threshold -15 (was -36), creak x4 (was x2), toss loop simplified (same
  behaviour), intro uses VIGO.startText/startSay. Not met: powcull2's 'collected' (out of the +-4 toss reach), R pickups
  1/5 on my root (bot), cow call under the farm mix. Not done by plan: rideHud weapon icon, riders keep their weapon.
