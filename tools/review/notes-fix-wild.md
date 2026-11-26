# Fixer notes: group WILD (src/level2_enemies.js, src/level2_sky.js)

Restart-safe log, appended as I go. R = RD/fix/wild/game (RR_GAME root). Scratch: RD/fix/wild/work, RD/fix/wild/shots.
T=/Users/macbookair/game/tools/harness, FX=RD/fix, VE=RD/verify-experience-work.

## Status
- [x] wild-1 kids-5 wolf contact (start-wild #0)
- [x] wild-2 kids-6 charge box (start-wild #1)
- [x] wild-3 audio-3 growl mid layer
- [x] wild-4 audio-4 heavy steps
- [x] wild-5 art-3 eagle wing edge in rain
- [x] wild-6 art-4 bear legs warm palette
- [x] wild-7 art-12/K3 FADE 150 -> 90
- [x] wild-8 audio-8 rain sound
- [x] final: policycheck, regress.sh, required checks, StructuredOutput

## Log
- 2026-11-11 start: no earlier notes; my two files == src-base (md5 278fc142.../ee1f67ec...).
- wild-1 kids-5 + wild-2 kids-6 DONE (12:10): apply.py start-wild.json all (both matched once). node --check ok.
  lab-wolf (R): safe jump frames from 10 at d40/d60/d72 (10-29, 10-33, 10-35); pre-fix 19 (plan-work/out/ref/wolf-base.err).
  lab-charge (R): robobear in place 13/12/21 (d70/110/150), bear 17/17/25; pre-fix robobear 6/5/14, bear 13/12/21.
  M2 sims s1-5 hero 0 (work/k56): all win, errors [], 177.5/180.1/176.1/178.2/177.4 s, deaths 1-2, cont 0
  (pre-fix 181.6/180.1/176.1/180.4/177.4; s2, s3, s5 unchanged times).
- wild-3 audio-3 growl (12:30): growl() now 4 lines (235-238): low line kept (236) + mid layer (237). Verdict values
  (saw 300-10i>200 v0.13, noise v0.1 LP1500) measured with GAP=0.5 an.mjs cue (GAP 0.5 reproduces the verdict's pre-fix
  -5.6/-10.3/-6.0 on VE logs; default GAP 0.3 splits a growl): seeds 1-3 only -4.1/-8.0/-3.6 (0/41 louder), and with the
  level group's new vigo music (MUSO lead square + bassUp) -5.0/-8.2/-5.3 -> misses the verdict's own aim (>= -3).
  Offline grid via log rewrites (work/snd/logvar.py, var/grid.txt; pitch x1/1.25/1.5, vol x1.25-1.75) -> chose
  saw 380-12i>250 v0.16 + noise v0.12 LP1900 (pitch x1.25, vol x1.25): seeds 1-5 -0.0/-1.2/-0.5/-1.3/-0.2 (26/68 louder),
  new music -1.6/-2.3/-2.1/-2.3/-1.4; old growl -5.8/-10.3/-6.0/-7.4/-5.8. iso Mmax -37.5 (laptop -38.4), peak -20.4 dBFS
  (verdict values -38.9/-40.5, old -43.0/-47.5; hurt sound -37.9, bear roar -36.2, shotgun peak -10.4) -> no clipping.
  Logs: work/snd/a3-s1..5.log (verdict-value growl), k56-s1..3.log (kids-5/6 only root work/k56root). Sound edits do not
  change gameplay: a3-s1..3 JSON == k56-s1..3 JSON.
- wild-4 audio-4 heavy (12:33): verdict values (square 150>75 v0.07 + noise 0.1 v0.2 LP1200) iso laptop -46.5 (target
  >= -46; pre-fix -57.5, full -39.2). Nudged to square v0.08 + noise v0.22: laptop -45.6, full -37.6, peak -16.6
  (work/snd/heavyvar.sh on a3-s1.log; iso = 2 steps 0.18 s apart, as the verifier measured).
- wild-7 art-12 + wild-8 audio-8 EDITED (12:45, not yet tested): level2_sky.js FADE 150 -> 90 (+ header '300 px' -> '180 px'),
  skyUpdate: `if (WX.rain > 0.05 && T % 6 === 0) Snd.noise(0.3, 0.04 + 0.03 * WX.rain, 6000); // the rain's hiss` after
  weatherNow() (not in skyLoad's warm-up), header notes it. weights() also feeds stepParticles (petals/leaves/butterflies,
  private rnd stream): visual only.
- art-3 before renders: shots/art3/k56-x3801/x3951-f60..260.png (k56root, gameplay == mine).
- art-3 exploration (13:10): rainNow() helper (L2.weather().rain cached per G.t, 0 on the mission card or without L2) +
  WET flag set in drawEagle. Lab fixture work/fx/eaglelab.js (8 poses x 2 facings drawn over the frame; render --x 3801.6
  --frames 300). P1 = far wing arm gets the METL limb edge in the rain (near wing already has one): visible only in
  glide/flap (the far wing's top peeks above the near arm), nothing in the dive (far wing hidden). P3 = P1 + feather
  spines one step lighter (near METL, far MET). P4 = P3 + dive spines run 0.9 of the feather in the rain (else hidden
  under the arm): the dive's trailing feathers get light streaks. Copies: work/edits/level2_enemies.p1/p3/p4.js.
- art-3 DECIDED (13:20): P5 = in the rain (WET = rain > 0.3) the near wing's feathers are one shade lighter (MET fill,
  METL spines), the far wing gets MET spines, BOTH arms carry the METL top edge (near already had it), dive spines run
  0.9 of the feather (0.5 dry; hidden under the arm otherwise). Reason: the literal 1px edge (P1) changed 0-36 px per
  game frame and nothing in the dive (the verifier's weakest pose); lab sheets shots/art3/lab-{k56,p1,p3,p4,p5}-c.png.
  Dry = identical code paths (every expression reduces to the old one when WET is false).
- art-4 APPLIED (13:22): edits/art4.py: BLG/BLGL/BLGD = #6a5a50/#8a7868/#4a3c34 (PAL keys e/E/f), drawLeg AND drawArm
  limbs (the front legs become the arms when the bear rears up: same limb, same colour) and the P_BLEG break-apart piece.
  Joints, paws, claws, armour caps unchanged. Wolves unchanged.
- Snapshot of my files at this point: work/edits/level2_enemies.final1.js, level2_sky.final1.js.
- Renders: queue ../shots/jobs-final1b.txt (art-3 fin-*, art-4 fin/k56, dry fin/k56/base) 1 slot; art-12 via a camera
  sweep fixture (work/fx/camsweep.js + fx/cs-<band>.js, tools/sweep.sh TAG ROOT -> shots/art12/sweep/TAG-c<centre>.png;
  one process per band, frame 60 built at the band centre, camera centre stepped BOUNDS-180..+180 by 30). The plan's
  'c 1170-1530' are camera CENTRES (= BOUNDS +- 180); 'c = x - 201.6' would be the camera's left edge, which would miss
  most of each band. Machine load avg 70-90 (5 fixers): ~30 s per render.
- wild-7 art-12 TESTED (13:45): sweeps shots/art12/sweep/{k56,fin}-c<centre>.png (camera centres 1170-1530, 2670-3030,
  4220-4580 step 30; frame 60). harness diff k56 vs fin: identical at the band ends outside FADE 150 (1170, 1200, 1500,
  1530, 2670, 2700, 3000, 3030, 4550, 4580) and at the band centres (1350, 2850; k = 0.5 for any FADE), different
  inside (shorter blend). Sheets shots/art12/sheet-b{1350,2850,4400}.png: the ghost trunks / ghost fields now span
  centre +-90 instead of +-150; no hole or seam (SCN ranges still cover: FADE 90 needs cam 1020-1200, 2520-2700,
  4070-4250, all inside SCN). Band-3 frames also differ by 57 px on an eagle (art-3): the sweep draws 13 frames inside
  one update and rainNow() caches per G.t, so the first (rainy) camera's WET carries over - a sweep artifact (the game
  draws once per update).
- wild-8 audio-8 TESTED (13:50): plan command (x 3101.6, seed 1, god, 1400 f, tr-farm + tractor + sndlog) -> work/snd/
  rain.log (the bot left the tractor at ~2 s and walked; cam 3500 lock from 14 s). Rain calls: 180, all level2_sky.js:1498,
  10 per s; first at frame 324 (cam ~3170-3210, hero x ~3370) -> none before x 3150. vol 0.042 -> 0.0505 (cam 3300) ->
  0.0692 at the lock. an.mjs win: drizzle 6-9 s (cam 3210-3355) rain alone -45.4 LUFS (laptop -45.4); downpour 15-18 s
  (cam 3500) -42.3 (laptop -42.4); music alone -38.9 (laptop -44.8); level group's new vigo (MUSO lead square + bassUp)
  -38.1 (laptop -40.8) -> rain under the music on both models with the new track; full mix -31.7 / -30.8. Tractor gun
  reference -40.9 sustained (planner). work/rain.wav = downpour window, rain only.
- FINAL SOUND (13:58, real code; lines moved +2 by the art-4 palette lines: growl 237-240 (low 238, mid 239), heavy 248,
  rain level2_sky.js:1498): logs work/snd/fin-s1..3.log, JSON == a3/k56 JSON (sound and draw edits don't change play).
  growl cue (GAP 0.5): -0.1 / -1.2 / -0.5 dB (15/41 louder than the rest; pre-fix same play -6.0/-10.3/-6.0, 0/40);
  with the new vigo (MUSO) -1.7 / -2.3 / -1.9. heavy iso laptop -45.6 (full -37.6, peak -16.6; pre-fix -57.5 / -39.2).
  growl iso -37.5 M (laptop -38.4), peak -20.4 dBFS.
- art-3 / art-4 renders (14:00, final code): shots/art3/fin-x{3801,3951}-f{60..260}.png vs k56-*.png (pairs:
  pair-x3801-f140.png, pair-x3801-f100.png, pair-x3801-f60-bear.png); art-4: shots/art4/{fin,k56}-x3801-f120.png,
  {fin,k56}-x2451-f{100..200}.png, sheets pair-x3801-f120.png, pair-x2451.png, pair-x2451-f150z.png: the wolf in front
  of a bear now separates (grey wolf over warm dark legs); the ROBO BEAR reads golden armour over dark limbs.
- policycheck --group wild: RESULT ok (both files owned, no random calls, no glyph issues).
- level2-spec.md (level group) already describes: wolf skid safe, charge box 40x24, bear legs AND arms warm dark,
  eagles' wings lighter in the rain, rain hiss, crossfade 180 px. Not in it: the louder growl / bear steps (mid layer).
- dry check (14:12): x 3201.6 and 4851.6 frames 60/200: k56 == base-game (kids-5/6 change nothing there); fin differs
  from base only on the bear (art-4 limbs: boxes on the bear, shots/dry/pair-x3201.png); no eagle change outside the rain.
- FINAL files snapshot: work/edits/level2_enemies.final.js, level2_sky.final.js (md5 in edits/final.md5). node --check ok.
- regress.sh started 14:13 -> work/reg (summary.txt), log work/reg-run.out.
- REGRESS (14:37) work/reg/summary.txt: RESULT ALL PASS. M1 10/10 == legacy, M1 sound s1 SAME (1928 events), M2 h0/h1
  s1-5 all win errors [] (177.5/180.1/176.1/178.2/177.4 s; s2, s3, s5 '=base'; s1, s4 changed by kids-5/6), flow 18 ok,
  api 37 ok, selftest DONE, loop-test ALL OK. tools/postcheck.py: every M2 h0 JSON == the kids-5/6-only run (work/k56)
  and h1 == h0 -> the draw and sound edits are gameplay-neutral. Required: M1 h0 s1 completed true, errors [],
  [0,0,5,9], 14150, 140.3 s; M2 s1-3 win errors [].
- Post jobs (work/jobs-after.txt, 1 slot): lab-fin render, both.html (my root + start-engine/level/boss/gear, 29 edits)
  M2 s1/s2 with lockobs, M1 s1.
- Post jobs (14:45): lab-fin == lab-p5 on every eagle (only a bear differs: art-4); sheet shots/art3/lab-before-after.png.
  both.html (my live files + start-engine/level/boss/gear): M2 s1 win 152.4 s errors [] (= planner's allstart 152.4),
  locks 900 7.3 s, ROBO BEAR 2250 12.6 s (rockets), 3500 18.0 s, boss 47.9 s; s2 win 171.3 s errors [] (= allstart),
  2250 17.8 s (pistol), boss 52.1 s; M1 s1 == legacy. ROBO BEAR lock stays a fight (12.6-17.8 s, pre-fix 17.8-21.3).
- Mission card guard (14:48): --screen missions with fx/missions-rain.js (LV = Mission 2, camera 3600 = downpour,
  G.level 1), frames 60/300/500: my root == base-game (eagle visible on the card at 300/500): no rain look on the card.
  --screen missions default: == baseline/png/base-missions.png.
- FINAL (14:50): node --check ok both files; policycheck --group wild RESULT ok; live files == work/edits/final.*.
- HANDOVER (14:55): line refs for sndlog regexes: growl level2_enemies.js:238 (low) + :239 (mid), heavy :248, rain
  level2_sky.js:1498. StructuredOutput returned to the workflow. Nothing of mine left running.
