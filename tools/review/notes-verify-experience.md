# Verifier notes: experience reviews (art, kids, audio)

Started 2026-11-01. Scratch: H/work/verify-experience (W), H/shots/verify-experience (S).
H = /private/tmp/claude-501/-Users-macbookair-game/f3aa9207-fb8c-45b4-914e-f54b88055d86/scratchpad/harness
32 findings: art-1..12, kids-1..11, audio-1..9. Known K1-K14.

## Verdicts (appended as reached)

### art-1 MEGA BEAR white strobe: CONFIRMED (major)
- Tools: W/cap.mjs (harness copy + `cap` mode, multi-frame PNGs), W/fx/flash.js (+ cfg-*.js: FX_CFG {weapon, mash, type, flashGT}).
- `render --level 2 --x 5921.6 --frames 905 --god --extra fx/cfg-hmg.js --extra fx/flash.js`: HMG 14.5 onsets/s, 49.3% white frames; pistol held 6.6/s (22%); pistol mashed 7.4/s.
- Order: updateEnemies hitT-- then updateBullets sets hitT=4 -> draw sees 4,3 (white under `>2`), 2,1 not: 2 white frames per hit. HMG cd 4 => 2 on / 2 off = 15 Hz square wave.
- S/strobe-sheet.png (frames 400-407): whole bear silhouette white on 400, 406, 407 etc. M1 crab under HMG (hitT>0) only 1.4 onsets/s.
- Fix in level2_boss.js drawBear line 737 only (drawing only; M1 untouched).
### art-2 MEGA BEAR DOWN! text: CONFIRMED but downgraded to polish
- W/fx/killboss.js kills the boss at f300; text pushed at f450 at screen (371,102), 1x yellow with 1px black drop shadow, rises to y~53.
- S/bossdie-text.png: washed out only for ~10 frames under the 0.6 sflash; f460-560 it reads clearly over sky/bridge thanks to the shadow. Small and low-contrast yellow-on-pale, but legible. Same 1x style as every other floating text (HEAVY MACHINE GUN!, THANK YOU!).
### art-3 eagles in the downpour: CONFIRMED, polish (not minor)
- S/eagles-rain-sun.png (cap at x 3801.6/3951.6/4101.6 vs 3201.6/4851.6, scale 3): grey wings are close in value to the storm sky, but the 1px dark outline, white head, red eye and gold feet keep the bird readable; the diving pose (f200) is the weakest. "Wings vanish" is overstated. Red aim line still telegraphs the dive.
### art-4 wolf vs bear legs same metal: CONFIRMED, polish
- S/wolf-bear.png (cam 3600 f60/f120, x 3801.6): a wolf in front of the bear's legs merges into the same grey metal; its red eye and cyan lights still mark it. Code: drawWolfLeg and bear drawLeg both `c = near ? MET : METD` (level2_enemies.js).
### art-5 log brown-on-brown over trunks: REFUTED (no change needed)
- Seed-1 no-input run at x 2451.6 throws a log at f1311 (boulders earlier). S/logs-woods.png (f1314-1359, 3x): crossing dark trunks the log keeps its 1px dark outline and cream end ring; readable in every frame.
### art-6 flag pop at 2986: CONFIRMED, polish
- drawFlag: cloth extends 22 px LEFT of the pole when wind < -0.05 (dir -1), REACH.flag = [4, 30] (left 4). Variant W/var/flag.html (REACH [26,30], built by W/mkvariant.py) vs W/var/base.html at cam 2494 frame 400: 1440 px (3x) differ, the cloth at the right screen edge is missing in the current build (S/pop-flag.png). At frame 1 (wind > -0.05) no difference.
### art-7 overlay over HELP! bubbles: CONFIRMED by code (screens.js drawPlay: pows line ~100, LV.drawOverlay ~110), polish/optional. Rare transient overlap; not reproduced visually in a 16-frame sample (S/help-sheet.png).
### art-8 copy-pasted trees: CONFIRMED, polish
- S/full/c2250-f60.png: three identical chestnut canopies (props 2370/2560/2690) on one screen; all chestnut props use CHEST_TOP, all cherries CHERRY_TOP (level2_world.js:880-882, draw at :2081/:2141).
### art-9 rotated boss parts: CONFIRMED by code (part() rotates any |ang|>=0.03, level2_boss.js:601-606), polish; S/pound-sheet.png at 6x shows mild stair-stepping on the reared arm, invisible at play size. Recommend skip (large effort).
### art-10 soil seam at area borders: CONFIRMED (faint), polish. S/seams.png: dithered palette switch visible in the earth band at x 2850; barely at 1350/4400.
### art-11 (K14) tractor 2deg tilt on the whole orchard hill: CONFIRMED, polish
- W/fx/tractor.js (+tr-right.js) pushes a tractor prop under the hero at --x 4251.6 and drives right: tilt != 0 on 1030/1060 ride frames (x 4264-5021, 17 s). Farm 2950-3358: 0 tilted frames. Same with threshold 0.045 (variant W/var/tilt.html): 0 tilted frames.
- S/tilt-sheet.png: current 2deg rotation stair-steps the canopy/hood and the seated hero; the 0.045 variant is pixel-exact, wheels still on the ground.
- Note: tilt also drives dirOf() (gun and cannon direction) -> small M2 gameplay change; M1 unaffected (vehicle.js only used in M2).
### art-12 (K3) crossfade veil: CONFIRMED (known), polish
- weights() (level2_sky.js:143-150): blend purely from camera centre, BOUNDS [1350,2850,4400], FADE 150 -> cam bands 960-1260, 2460-2760, 4010-4310. No camera lock sits inside a band.
- S/full/c1110-f200.png: woods trunks ghost over the ria (reads like mist); S/full/c4150-f200.png: Rande bridge + fields double-exposed. Soft, not ugly; M1 has the same kind of crossfade.
### kids-2 swipe from the wall: CONFIRMED, major
- W/fx/lab-swipe.js (forces e.state='swipe' at wall-d, hero holds Left rt frames after the growl): current code: wall 0-5px only rt<=5 ok (rt10+ HIT); 10-15px rt<=10; 20px rt<=15; 30px rt<=20. walk+jump identical (zone 70 px tall, jump peak ~56 px).
- Geometry: wall keeps hero box right edge <= e.x-86; zone [e.x-136, e.x-86] (50 px) -> 29 frames of walking; damage st 35-42; trigger p.x > e.x-132.
- Variant W/var/swipe.html (REACH 120, all swipe keys +7, damage 42-49): wall 0-5px rt<=20 ok, 10px rt<=25, 15px+ all ok. Variant W/var/swipe10.html (REACH 120, glint hold +10 for keys>=24, damage 45-52): wall 0px rt<=20 ok (rt25 HIT), 5px rt<=25, 10px+ all ok.
### kids-1 MEGA BEAR vs tractor: CONFIRMED, downgraded to minor
- W/fx/lab-tractor-boss.js: tractor at the wall (p.x = e.x-110): swipe HIT at 0-10px even with rt 0; 20px only rt<=5; HIGH laser HIT for stand/hop/hold Down; Down+Z = hero gets out (then avoids). LOW laser and pound wave in the tractor: hop windows 1-2 sampled frames (W/fx/lab-tractor-hop.js, step 2) -> effectively unavoidable. drawHint (level2_boss.js:1152) shows DUCK!/JUMP! regardless of p.ride; tractor box fixed 40 tall (vehicle.js RIDES.tractor.box).
- Cost is tractor armour (6), not hearts; tractor explodes, hero ejected with inv. Main kid-facing problem = misleading hints + unavoidable swipe.
### kids-3 rockets never fired: CONFIRMED, major
- W/fx/wobs.js observer, sims seeds 1-3 level 2: picks rocket@~3150(riding), flame@~4541(riding); shots {pistol ~420-480, flame 120}, no rocket shot; ride in@2950 out@~6055. level2.js pows comment says "rockets for the farm" but the tractor covers the farm. Items are collected through the ride's box (engine.js updateItems uses pbox).
- Flame: 120 ammo x cd 3 = 360 frames = 6 s (120 shots logged).
### kids-4 / K1 items dropped behind: CONFIRMED for H (and B), S part REFUTED as bot artifact; major
- W/fx/iobs.js (wraps dropItem / ITEMS[k].collect), sims seeds 1-3: H dropped at 5550 with the tractor already at ~5614 (64 px past), lost 1.6 s later (hero 5766) in 3/3. S dropped at 550 IN FRONT of the hero (492, cage shot from range), landed 533, lost because the hopping bot jumped over it (3/3). B in the 2250 lock and R/F collected 3/3.
- engine.js updatePows: dropItem(o.item, o.x - 10, o.y - 14, -1) at o.t 40, same code as Mission 1 prisoners -> an engine change alters M1; prefer a level2.js-only toss.
### kids-5 wolf skid hurts early jumpers: CONFIRMED, minor
- W/fx/lab-wolf.js (wolf put into crouch st 0 at d px, tx = hero x; hero jumps at frame j): safe j = 18-30 (d40), 17-34 (d60), 17-37 (d72); j 9-17 HIT in state 'skid', j 0-8 and late j HIT in 'pounce'. contact rule level2_enemies.js:511 `(e.state === 'skid' && e.st < 8)`.
### kids-6 ROBO BEAR charge jump window: CONFIRMED, minor
- W/fx/lab-charge.js (paw st 0, goal = hero x, charge at st 44): robobear jump in place ok 6/5/15 frames (d70/110/150), jump toward 15/14/15, walk away always ok; bear in place 13/12/21, toward 26. Charge box 48S x 30S (S 1.25 -> 60 x 37.5 px) vs hero jump ~56 px peak.
### kids-7 tractor controls not taught / JUMP! at wreck: CONFIRMED in part, polish
- vehicle.js prompt() only 'GET IN!'; boardIt pushes 'BATTLE TRACTOR!'; drawPause (screens.js ~414-421) lists on-foot controls only; wreck() pushes 'JUMP!' while exitRide(p, true) ejects automatically and explode() blast(...,'player') never hurts the hero (engine.js blast).
- But the ride maps onto the on-foot keys (X fire, Up aims, C = grenade key -> cannon with a shell counter in the HUD, Z hop), so the cannon is discoverable; only Down+Z (exit) is hidden. "Children don't find the cannon" not supported.
### kids-8 / K2 no checkpoint before the boss: CONFIRMED, minor (closer to major for a game over at the boss)
- W/fx/bosslock.js: sim --x 4460 seeds 1-3 (on foot, tractor not rebuilt): boss lock reached after 36.6 / 33.7 / 30.8 s; seed 1 lost a life on the way. M1 by contrast: last checkpoint 4400, boss lock 4620 (220 px).
- loadLevel(cp) needs cp to equal a section x; flow-selftest only uses LEVELS[1].sections[1] -> a 5th section is safe for it.
### kids-9 shotgun range / flame duration: flame part CONFIRMED (120 shots = 6 s, wobs.js), shotgun range is per spec (~100 px: 17 frames x 7.5 px x 0.955 drag = ~90 px + muzzle) -> design, not a defect. Polish/minor; merge flame ammo with kids-3.
### kids-10 lull before boss: fact true (last spawns wolf 5180, eagle 5300; lock at cam 5720) but it is normal calm-before-the-boss pacing with the dog rescue; reviewer says "mostly fine". Judged not a defect.
### kids-11 intro skip only with Enter: CONFIRMED (level2.js update: `pressed.Enter` only, t>10 && t<IT.go), polish/optional.

## Audio (in progress)
- No node-web-audio-api after the restart; building W/snd/ (sndlog.js logger fixture + render.mjs JS synth of audio.js primitives + ffmpeg ebur128 for LUFS).
- Tools: W/snd/sndlog.js (logger), W/snd/synth.mjs (Snd.tone/noise/Music re-implementation, BS.1770 loudness mono, laptop = 4th-order HPF 180 Hz, 1/3-oct band ratio), W/snd/an.mjs (music|src|cue|win|iso), W/snd/wl.mjs (sustained weapon loudness). Logs W/snd/logs (l2s1-3, l1s1, sandboxes sb-*). Numbers agree with the audio reviewer within ~1 dB.
### audio-7 / K7 music: CONFIRMED (not harsh; thin), polish-minor
- an.mjs music: vigo all -38.9 (laptop -44.8), lead -51.6, bass -41.7 (laptop -48.5); M1 main all -39.0 (laptop -43.0), lead -48.2, bass -39.9 (laptop -44.6). Vigo lead 3.4 LU under M1's; vigo bass 3.9 dB weaker on the laptop model. K7's "harsh" worry refuted.
### audio-1 flame quiet: CONFIRMED, minor
- wl.mjs sandboxes (wolf x3, god, held fire, 3 s busiest window, weapon's own lines): flame -47.5 (laptop -51.3), pistol -40.6, HMG -39.9, rockets -35.9, shotgun -31.5 (peak -10.4 dBFS), music -39.0. Flame hiss = weapons_extra.js:544 noise 0.2 s v0.08 LP1800 every 9 f; whoosh (543) only on fire start.
### audio-6 shotgun loud + pellet stacking: CONFIRMED, polish-minor
- shotgun ~9 LU over pistol/HMG, 7.5 over the music. Stacking: shotgun vs bear sandbox: frames with 2/3/4/5 simultaneous engine.js:340/341 hit sounds = 3/2/2/1 (wolves die from 2 pellets: none). 5 identical clanks = +14 dB (synthetic test).
### audio-2 animal calls buried: CONFIRMED, minor
- an.mjs cue (target vs rest in its bands), seeds 1-3: sheep -13.5/-10.5/-9.3 dB, pony -0.2/-10.2/-13.3, cow -15.7/-11.5/-11.6, goat -1.9/-8.8/-8.9, hen +6.6/+2.9/+5.1, dog 560 -1.1, dog 5560 +7..+21; freed jingle median +5.7 (5-7 of 7 louder).
### audio-3 warning cues buried: CONFIRMED, minor
- cue seeds 1-3: wolf growl (enemies:235) median -5.6/-10.3/-6.0, 0/36 louder; eagle dive (705) -4.6/-5.8/-4.4 (it is the attack sound, the screech is the tell); MB grunt -10, rise -9/-3.4/-5.5, growl -12/-13/-5, whine -8.5/-11/-11; laser charge ~0.
### audio-4 thuds bass-only: CONFIRMED, minor
- iso full -> laptop (Mmax): MB thud -36.6 -> -55.6, rumble -34.2 -> -54.1, bear heavy step -39.2 -> -57.5, tractor landing -37.7 -> -49.1; M1 boom -31.4 -> -37.9.
### audio-5 tractor silent engine: CONFIRMED, minor. Puff vehicle.js:496 square 70->50 v0.02: -57.2 M (laptop -62.6) vs music -39.
### audio-8 no rain sound: CONFIRMED by grep (no Snd/Music/say in level2_sky.js), polish.
### audio-9 creak under music: CONFIRMED, polish. cue: creak -6.5 dB vs rest (music only), door thud +2.5, screech +7.4, chirps +10.2.
### Fix tests (variants built with W/mkvariant.py from src, run with --html)
- art-1 W/var/flashfix.html (drawBear: flash at most every 24 frames, 2 frames): HMG 14.6 -> 2.4 flashes/s, pistol 6.5 -> 2.2; boss hp at f900 identical (321/411) -> draw-only.
- K1 W/var/toss.html (level2.js LV.update: an item dropped by a saluting pow at it.t==1 gets vy -3.4, vx = clamp((p.x + v*38 - it.x)/38, -4, 4), v = ride.vx or p.vx): seeds 1-3 S, R, F, H all collected (H at ~5615 while riding).
- Interaction found: weapon letters picked up while riding overwrite each other (R->F->H). W/var/swaptoss.html (toss + pony R / cow B + flame 240): rockets fired on foot in 3/5 seeds but F now overwritten by H inside the tractor (flame never used in 4/5).
- W/var/plan.html (toss + sheep 1550 F, pony 2300 R, cow 3200 B, goat 4600 heart, flame ammo 240/300): seeds 1-5 all complete, 0 continues, 154-169 s (base ~176-182 s); S used 5/5 (26-30 shells), F 5/5 (107-221 shots), R picked+fired 3/5 (bot jumps over the crate in 2/5, artifact), H 5/5 at the boss (200 shots).
- Audio fix checks (synthetic, 3 s holds): flame hiss now -51.9 sustained; reviewer fix (every 6 f, noise 0.3 s v0.25 LP1500) -40.2 = pistol -40.6. Tractor puff now -59 (laptop -64); fix (saw 110>70 0.1 s v0.15 + noise 0.09 s v0.14 LP1000 every 9 f) -42.3 (laptop -45.9) vs music -39.

## Unreported known issues
- K8 title hint (screens.js:144 'FREE THE PRISONERS FOR POWER-UPS!'): CONFIRMED, polish; shared title screen -> compare-refactor title frame will differ (intended).
- K4 (tractor easy / half MG damage no feedback): skip, fine for 8-10 year olds; boss bar still moves.
- K5 wolves over caged animal, K6 eagles bunch in the 3500 lock, K9 154 ms sky build at first M2 load, K11 lower half of the shotgun fan vs wolves (2 pellets kill a wolf anyway), K12 core double damage mostly by jump shots (bonus only), K13 upright debris / call after pause: skip (cosmetic or invisible to kids).
- K10 rockets vs canopies: with R moved to the pony at 2300, the 2250 lock has no eagles (robobear + 2 wolves), rockets home on targets below the chestnut canopy box (o.y-102..o.y-56), so K10 stays harmless; recheck after the move.

## Merges
art-11+K14, art-12+K3, kids-4+K1, kids-8+K2, audio-7+K7, kids-3+kids-9(flame part; shotgun range = spec, not a defect).
## Refuted: art-5, kids-10 (and the S part of kids-4/K1 = bot artifact, kids-9 shotgun range = by design)

## Final ranking submitted (2026-11-01)
major: art-1; kids-4+K1; kids-3+kids-9; kids-2. minor: kids-8+K2, kids-1, kids-5, kids-6, audio-2, audio-1, audio-5, audio-3, audio-4.
polish: art-11+K14, kids-7, audio-6, audio-7+K7, art-2, art-3, art-4, art-12+K3, art-6, art-8, art-10, art-7, audio-8, audio-9, kids-11, K8, art-9 (skip).
refuted: art-5, kids-10. Skipped knowns: K4, K5, K6, K9, K10, K11, K12, K13.
