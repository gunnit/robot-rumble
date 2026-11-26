# notes-verify-code (independent verifier of the "code" reviews: bugs, flow, fuzz F1)

Started 2026-11-03 (third attempt overall; no earlier notes file existed).
H  = /private/tmp/claude-501/-Users-macbookair-game/bf86e491-38d3-458c-a7d1-6193216e6d7e/scratchpad/harness
VW = H/work/verify-code   (fixtures, variants, outputs)
VS = H/shots/verify-code  (renders, crops)
Rules: write only this file under /Users/macbookair/game; never touch proposals/; max 3 sims at once; no Browser pane.

Findings to verify: bugs-1..5, flow-1..10 (flow-8 = K8, flow-9 = K9, flow-10 = K7), fuzz F1.
Already judged by the experience verifier (do not re-judge): kids-1 (tractor at boss: swipe/laser/wave
unavoidable, minor), kids-3 (letters overwrite in tractor), kids-7 (tractor exit never shown), K8,
audio-7/K7, K1, K2 ... see verdicts-experience.json.

## Log

### F1 (block push off the locked screen) -- CONFIRMED, pre-existing engine code, Mission 1 exposed too
- Re-ran the fuzz repro: fx-push.js -> "13 of 60 jump timings end off screen; longest 25 frames"; tractor 0 of 60.
  fx-sandwich.js: hero x 4008.6 -> 3986.2 with cam+W = 3980, body fully hidden frames 0-32.
- Own fixture VW/edgepush.js (one block enemy entering at cam+W+edge, hero at the right clamp holding Right, one jump
  at j = 0..150 step 2, 200 frames each, --god):
  bear @3500 (M2): fully off screen in 13/76 timings, j 38..62, longest 25 frames; no jump: 0.
  tank @3720 (M1, --level 1 --x 3921.6): fully off screen in 17/76 timings, j 26..58, longest 33 frames; no jump: 0.
- Pre-existing: backup/index-before-level2.html:1216 has the same push (`p.x = p.x < e.x ? tb.x - 6 : tb.x + tb.w + 6`).
- Order in updatePlay: updatePlayer -> updateCamera (clamp to cam+8..cam+W-8) -> updateEnemies (push, no clamp) -> draw.
- Picture: VS/f1/bear-00085.png (whole frame): the bear at the right edge of the 3500 lock, no hero anywhere.
- Fix variants (VW/var, built with mkvariant.py): f1-engine.html = fuzz reviewer's clamp after the push in engine.js
  updateEnemies; f1-l2.html = Mission-2-only clamp at the top of VIGO.update() in level2.js.
  edgepush: bear 0/76 (both variants), tank 0/76 (engine variant).
  Sims seeds 1-5 x heroes 0/1: Mission 1 src vs f1-engine identical JSON (10/10); Mission 2 src vs f1-engine and
  vs f1-l2 identical JSON (10/10 each). Hero 0 and 1 runs of a seed are identical (bot; heroes differ only in art).
- Verdict F1: confirmed, minor (0.4-0.55 s invisible hero, no damage, can't shoot); also in Mission 1 (tank at 3720).

### bugs-1 (boss beaten but GAME OVER) -- CONFIRMED (major)
- VW/bossdeath.js, --level 2 --x 5921.6 --seed 1, G.lives 1, hearts 1, no input; T0 = 40 frames after the boss is
  first hurtable (frame 312). Outputs VW/out/bd/*.out.
  A (hero dies at T0, boss killed k frames later): k 0, 20, 60, 100, 109 -> state over at 422 (winT 0, boss dying),
  Enter -> play at cam 4400, hero 4460, continues 1, boss gone (MEGA BEAR again after the orchard).
  B (boss killed at T0, hurtPlayer k frames later): k 0, 20, 60, 100, 109, 140, 149 -> over (k >= 60: over even with
  winT 189..100 already set: playerRespawn ignores winT). k 150 -> win (winT blocks hurtPlayer from st 150 on).
  C (a real non-pup wolf put on the hero at the kill): hero killed at st 144 -> over at 566 with winT 105.
  => window: any last-life death from 109 frames before the kill to st 149 after it (~4.3 s).
- Code: megabear onKill (level2_boss.js:1269-1276) kills only e.pups; bossDefeated (sets winT) only at st 150
  (level2_boss.js:1003-1013); hurtPlayer checks winT only (engine.js:212); playerRespawn -> over at 0 lives (engine.js:233).
- Mission 1's crab has the same 150-frame dying window before bossDefeated (level1.js:380-389): pre-existing pattern.
- Frequency (VW/bdobs.js observer, plain bot sims --level 2 seeds 1-60, 40000-frame cap): 60/60 won, 22 runs had
  a game over at the boss, 114 boss-fight deaths (28 on the last life), but 0 deaths inside [kill-109, kill+149];
  closest death was 265 frames before the kill (after a death the hero has inv 180 and the bear rests +45).
  => the bot never hits it; kids hit it by a "trade" (dying while a grenade/rocket/bullets in flight finish the bear)
  or a leftover non-pup robot (e.g. an eagle that followed into the arena) during the 150-frame death animation.
  Severity: major-but-rare (takes away a beaten final boss), not "will be hit".
- FIX VALIDATED (VW/var/bd-fix.html, level2_boss.js megabear onKill only: kill every other active robot instead of
  e.pups, G.winT = 360 at the kill, if (G.p.dead && G.lives <= 1) G.lives = 2): scenarios A k 0/60/109, B k
  0/60/109/149, C 0 all end in 'win', errors []; win frame unchanged (kill + 358, e.g. 670 like an untouched kill);
  Mission 2 bot sims seeds 1-5 byte-identical to src (VW/out/fix). Mission 1 untouched (file not loaded by M1 logic).

### bugs-3 (pony culled before its drop) -- CONFIRMED, polish (and mostly masked by K1 today)
- VW/powcull.js (--level 2 --x 2451.6 --god): pony freed at f10, lock's last robot removed at 10+k, hero at cam+440
  holding Right once the lock is over. k 0/5/10 -> pony removed at t 24/29/34, B never dropped; k >= 15 -> dropped at t 40.
- BUT in every case the dropped B was gone by f160 (items now empty): it drops at o.x-10 moving left, behind a hero
  running right, culled at cam-30 = K1. So bugs-3 only bites once K1's toss fix is in.

### bugs-4 (flash particle NaN) -- CONFIRMED, polish, pre-existing
- VW/flashnan.js: src and legacy both "created at [300,200], vx undefined, after one updateFx: x NaN y NaN".
- VW/flashdraw.js, Mission 1 seed 1 bot: 400 draws sampled, flash particles at draw time: finite 0, NaN 21.

### bugs-5 (shake uses Math.random in drawPlay) -- CONFIRMED (harness-only effect)
- --level 2 --seed 1 plain: hits [1,4,1,10] deaths 2 cont 0 181.6 s; with VW/drawmore.js (draw after every update):
  [1,6,1,17] deaths 5 cont 1 261.1 s. Same numbers as the reviewer.

### flow-2 (continue says MISSION START!) -- CONFIRMED, polish
- VW/contrender.js: continue -> big 'MISSION START!', voice 'Mission start!'. Picture VS/flow2/cont-00175.png.

### flow-6 (boss bar touches GAME OVER) -- CONFIRMED, polish (pre-existing layout; M1 crab too)
- VS/flow6/robo-00560.png, mega-00560.png (whole frames), crops robo-crop.png / mega-crop.png (2x of box 260,50-700,180
  of the 2x frame): the bar's bottom line sits on the top edge of the GAME OVER letters.

### flow-3 / flow-4 / flow-5 -- CONFIRMED, polish
- VW/menuflow.js (cap.mjs, --level 2 --x 5921.6 --god): toWin -> Enter -> allclear (Music.track none; Music calls
  play:vigo, play:bearboss, stop at the win; nothing after) -> Enter -> title (level 1) -> Enter x3 -> VIGO HILLS
  starts again (state play, LV VIGO HILLS, music vigo). VS/flow3/mf-00310.png: VIGO card preselected.
  VS/flow3/mf-00325.png: hero select with the jungle trunks behind (dark under the 0.6 overlay).

### F1 extra checks
- robobear at 2250 (edgepush, VC_TYPE robobear): 0/76 (its walk-in is the 'intro' state = offStage, no push).

### flow-9 / K9 -- known; node timing only
- VW/k9.js: first L2.skyLoad 1598 ms vs second 4.3 ms in node + napi-canvas on a machine at load ~20 (not Chrome;
  the Chrome 154/299 ms figures could not be re-measured: no Browser pane). One-time, during the fade-in from black.
- F1 fixed render: VS/f1/fixed-00085.png (f1-engine.html): Ines visible at the right edge, drawn over the bear's back.

### bugs-2 (tractor vs MEGA BEAR laser/pound) -- CONFIRMED as a DUPLICATE of kids-1 (experience verdict, minor)
- Equivalent check by the code's numbers: RIDES.tractor.box = p.y-40..p.y (vehicle.js:790), HIGH lane hurts
  ground-33..-27 (LANES.high y -30, rect h 6, level2_boss.js:491/958); HOP -3.4, GRAV 0.24 -> max hop 24 px < 33:
  HIGH can be neither ducked nor hopped. LOW pulse (rect ground-12..-4, 36 px at 5 px/f) needs the 48 px box >12 px up
  for 16.8 f; the hop stays >12 px up 20.1 f -> ~3 f window (on foot ~20). mbwave (r 5 at ground-3, 2.5-2.9 px/f)
  needs >8 px up for 23.2 f; the hop gives 23.1 f -> ~0 window. Same as kids-1's labs.
- New vs kids-1: the LOW cue (level2_boss.js:967) is timed for p.x + 6, the ride's front is p.x + 24 -> JUMP! comes
  ~3.6 f late for riders; and the alternative fix (riders always get LOW, cue from pbox front, HOP -4.4).

### flow-1 -- DUPLICATE of kids-3 (letters overwrite in the tractor; reorder) + kids-7 (exit/pause help). Code
  re-read: engine.js:548 pickups via pbox (ride box), :268 giveWeapon replaces, vehicle.js:772-786 rideHud shows no
  weapon, screens.js:415-425 pause lists on-foot keys only. Nothing new beyond kids-3's optional HUD icon.
### flow-7 -- CONFIRMED by code (engine.js:734-736 pause only resumes; title reachable only via game-over countdown,
  allclear, or reload). Polish / feature request.
### flow-8 = K8, flow-10 = K7/audio-7: covered by the experience verdicts; nothing to re-judge.

### Mission 1 parity of the F1 engine fix (renders)
- VS/m1parity: src vs f1-engine renders identical (0 px) for --level 1 --x 250/1950/3350/4620 (60 f), x 3921.6
  (tank lock, 200 f), screens title/select/over/pause/win. Baseline: src == legacy for x 250/1950/3350/4620 renders
  and Mission 1 sims seeds 1-3 (byte-identical JSON).
- Fixtures on variants bd-fix, f1-engine, f1-l2: flow 18/18, api 37/37, engine self-test DONE (all three).

### flowfix variant (VW/var/flowfix.json: LV.startText/startSay in engine loadLevel/beginMission/continueGame +
### VIGO fields; allclear -> title sets G.level = 0; drawHUD skips the boss bar when G.state === 'over')
- Mission 1 and 2 sims seeds 1-5 byte-identical to src; Mission 1 renders x 250/1950/3350/4620 and screens
  title/select/over/pause/win 0 px vs src; flow 18/18; api 37/37.
- continue -> 'MISSION 2 START!' + 'Mission two, start!'; after allclear Enter x4 -> ROBOT JUNGLE (level 0, music
  main); game over at the MEGA BEAR: no bar over the title (VS/flow6/fixed-mega-crop.png).
- bugs-5 fix risk MEASURED (VW/var/shake.html, the reviewer's hsh-based shake in screens.js drawPlay):
  Mission 2 seed 1 becomes cadence-independent ([1,4,3,7] 175.6 s with and without drawmore.js), BUT Mission 1 seed 1
  changes: [0,0,5,9] 4 deaths 140.3 s 14150 -> [0,0,4,11] 5 deaths 147.6 s 14200. => the game-side fix breaks the
  "Mission 1 sims byte-identical to backup/index-before-level2.html" regression check. Don't ship it; if wanted,
  isolate draw-time randomness in the harness instead (separate seeded Math.random around draw()).

### flow-4 optional fix validated (VW/var/selectbg.json: drawSelect calls LEVELS[G.level].menuBG() when G.level > 0;
### VIGO.menuBG() = L2.drawBG(0))
- --screen select (G.level 0) 0 px vs src; with G.level = 1: the ria/hills behind the cards (VS/flow3/selectbg-m2.png),
  errors []. Moves the one-time K9 sky build to the hero-select screen.
- F1 sandwich on the variants: f1-engine -> hero squeezed out left of both bears (3944.6 -> 3913.7), visible;
  f1-l2 -> hero held at the edge 3972, visible.

## Summary of verdicts (final)
1. bugs-1 confirmed, major-but-rare; fix level2_boss.js onKill (3 lines) validated (bd-fix).
2. F1 confirmed, minor; engine clamp (both missions) or level2.js clamp (M2 only), both validated; M1 tank fixed by the engine line.
3. flow-1 = kids-3 + kids-7 (dup). 4. bugs-2 = kids-1 (dup) + cue offset + alternative fix.
5. flow-2, flow-3, flow-6 confirmed polish; fixes validated together (flowfix). 6. flow-5, flow-7 confirmed polish (plans).
7. flow-4 confirmed polish; optional menuBG fix validated (selectbg). 8. bugs-3 confirmed polish (masked by K1).
9. bugs-4 confirmed polish, leave. 10. bugs-5 confirmed harness-only; game fix breaks M1 legacy sim parity (measured).
11. flow-9 = K9 (Chrome number not re-measurable); flow-8 = K8; flow-10 = K7/audio-7.
Gaps noted: M1 crab has the bugs-1 window; M1 tank has F1; fixes never tested together with the experience plan;
KEYMAP ok = Enter/Space/Z/X lets mashing skip end screens (amplifies flow-3); fuzz final JSON not available.
