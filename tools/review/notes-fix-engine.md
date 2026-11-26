# Fix notes: group ENGINE (engine.js, screens.js, core.js, docs/engine-api.md)

Restart-safe log. R = RD/fix/engine/game (RR_GAME root). Scratch: RD/fix/engine/work, RD/fix/engine/shots.
Tasks: engine-1 F1/fuzz-1, engine-2 flow-2, engine-3 flow-3, engine-4 flow-5, engine-5 flow-6, engine-6 flow-7,
engine-7 K8/flow-8, engine-8 flow-4, engine-9 kids-7/flow-1 (engine halves), docs.

## Status
- [x] read plan, README, harness, start-engine.json
- [x] apply start-engine.json (13 edits)
- [x] per-task tests
- [x] docs/engine-api.md
- [x] policycheck, regress.sh, compare-m1.sh
- [x] final required checks; returning JSON (13:05)

## Log
- (start) No earlier notes: fresh run.
- 12:02 Applied FX/edits/start-engine.json all (13 edits, each matched once): engine.js #0 F1 clamp, #1-#3 flow-2,
  #4 flow-3, #9 flow-7 pause quit, #12 flow-5 victory/stop; screens.js #5 flow-6, #6 flow-4 menuBG, #7 K8 hint,
  #10 flow-7 pause line, #11 kids-7 ride help; core.js #8 quit key. node --check ok on all three.
  Pristine doc copy: RD/fix/engine/work/engine-api.before.md.
- engine-1 F1/fuzz-1 tests (work/f1-*): edgepush bear lock 3500: before 13 of 76 (j 38..62, longest 25) -> after 0 of 76;
  tank lock 3720 (--level 1 --x 3921.6): before 17 of 76 (longest 33) -> after 0 of 76; fx-sandwich: before 33 of 40
  frames invisible -> after visible=true on all 40 (hero squeezed out left at x 3913.7); errors [] in all runs.
- engine-2 flow-2 (work/f2-*, shots/f2-cont-*): contrender --level 2 --x 1200: root 'big MISSION START!' + 'Mission start!'
  (devStart and continue), errors []; root+start-level page (work/both-level.html) 'big MISSION 2 START!' +
  'Mission two, start!' at devStart and at the continue; --level 1 on both: old texts. Render f200: root == before
  (0 px), both differs only in the band box [194,206,755,253] at scale 2 (MISSION 2 START!), checked by eye.
- engine-3 flow-3 + engine-4 flow-5 (work/mf-*, shots/mf-*): menuflow2 --level 2 --x 5921.6: before 'title level 1' ...
  'play level 1 music vigo LV VIGO HILLS'; after 'MF f=290 state title level 0', 'MF f=330 state play level 0 music
  main LV ROBOT JUNGLE'; no stub: no play call, warnings [], errors []; with cfg/victory-stub.js: 'play:victory@212'
  (endT 72), title 'music none'; root+start-level page (no TRACKS.victory yet): silent, warnings []. Mission select
  after the allclear (shots/mf-missions-*.png f312): ROBOT JUNGLE card selected (was VIGO HILLS).
  Sound (sndlog, work/snd-mf-*.log): SND events of the win->allclear->title flow identical before/root (71, ignoring
  the caller); MUS adds only stop@290 (title). With the stand-in track: victory starts 3.533 s, the Snd.win jingle ends
  3.493 s (no overlap); stand-in loudness -39.5 LUFS full / -40.0 laptop (stand-in only; the real track is level's).
- NB zsh: an unquoted $var holding several args is ONE word; use ${=var} (first over-* renders were wrong for that).
- engine-5 flow-6 (shots/over-*): overboss f560, game over at f409 in all three: mega (--level 2 --x 5921.6), robo
  (--x 2451.6), crab (--level 1 --x 4821.6): after vs before differs only in box [402,102,1037,161] (scale 3) = the
  boss bar, gone from the GAME OVER title (opened mega before/after and crab). errors [].
- engine-6 flow-7 (work/q*, shots/q*.png, shots/pause-m1-*): quitflow --level 2 --x 1200: pause f100, title f130 (music
  none, best 12345, level 1), missions, select, play f260 (VIGO HILLS, score 0, lives 3, cam 0, intro true); --level 1:
  the same with ROBOT JUNGLE (intro false: Mission 1 has none); errors [] both. Before: Q ignored (Enter resumes).
  Pause render M1 scale 2: differs only in box [302,300,661,315] (the music line, + '   Q: QUIT TO TITLE'), checked.
- engine-7 K8/flow-8 (shots/title*.png): render --screen title: differs from before only in [426,564,1013,587] (scale 3),
  'RESCUE EVERYONE FOR POWER-UPS!' read in the PNG; errors [].
- engine-8 flow-4 (shots/select-*): --screen select: Mission 1 chosen root == before (0 px); --extra VC/lvl1.js
  (VIGO chosen) root == before (0 px, jungle: no menuBG yet), errors []; root+start-level page: the ria, hills and
  houses behind the cards (whole frame differs, by eye ok), errors [] warnings [].
- engine-9 kids-7/flow-1 (work/rp-*, shots/pause-ride*.png): ridepause + cfg/rp-stub.js: 'RP f=61 state pause riding
  true help "C: CANNON   DOWN+Z: GET OUT"', green line at y 174 between the panel and PRESS P (opened PNG; diff vs before
  [453,450,992,545] = music line + help line); without the stub: help undefined, diff only the music line
  [453,450,992,473] (no ride line); errors [] both.
- 12:35 docs/engine-api.md updated (diff vs work/engine-api.before.md): held/tap list + quit (Q, pause only); hurtPlayer
  row (G.winT > 0); contact 'block' push clamp; final boss kill pattern (G.winT 360 at the kill, bossDefeated at st 150
  sets 210, revive line); RIDES help? + bullet + cart example help; Levels rows startText/startSay, clearMusic,
  menuBG(); Mission flow paragraph (menuBG, clearMusic/victory at endT 72, title stops music + Mission 1, game over
  keeps the mission, Q quit); intro note (starts without the intro show startText/say startSay); example fields.
- NEXT: policycheck, regress.sh (work/reg), compare-m1.sh (shots/m1), final required checks.
- 12:47 policycheck --group engine: RESULT ok (3 owned files changed, no random calls, no glyph problems).
- regress.sh work/reg R (load avg ~40, took ~10 min): RESULT ALL PASS: M1 10/10 == legacy, M1 sound s1 SAME 1928 events,
  M2 h0/h1 s1-5 win errors [] =base (181.6/180.1/176.1/180.4/177.4 s, 2 deaths, 0 cont), flow 18 ok, api 37 ok,
  selftest DONE, loop-test ALL OK (private screens/main names not global). No fixture needed adapting.
- compare-m1.sh shots/m1 R: title [426,564,1013,587] and pause [453,450,992,473] only (vs base and legacy); win vs legacy
  [489,642,950,665] (pre-existing prompt line), = base; select, missions, over, allclear, x250/1950/3350/4620, tank,
  crab identical to base and legacy.
- Fresh --legacy sims (work/legacy, pool N 2): M1 seeds 1-5 x heroes 0/1 from the root (work/reg) byte-identical to
  fresh --legacy /Users/macbookair/game/backup/index-before-level2.html runs: 10/10 (fresh legacy == baseline too).
  M1 h0 s1: completed true, errors [], hits [0,0,5,9], score 14150, 140.3 s.
- Live files verified == src-base + start-engine.json (re-applied on copies in work/recheck, cmp equal).
- Contract smoke check with the OTHER groups' live halves (snapshot of the live tree at ~12:55 in work/mix/game, src-base
  manifest, no Mission 3 files): contrender 'big MISSION 2 START!' + 'Mission two, start!' (devStart and continue);
  menuflow2 'play:victory@212', title 'music none' level 0, then ROBOT JUNGLE; ridepause (no stub) help
  "C: CANNON   DOWN+Z: GET OUT" drawn at y 174; select with VIGO chosen shows the ria/hills (level's live menuBG);
  quitflow ok; edgepush bear 0 of 76 with wild's charge box. errors [] warnings [] in all.
- 13:05 doc: boss bar 'hidden ... and on GAME OVER'. Final: node --check ok x3, policycheck ok. DONE; returned JSON.
  Not changed (out of scope): docs/engine-api.md section 6 still names the harness at an old scratchpad path
  (/private/tmp/.../f3aa9207.../harness); the live copy is /Users/macbookair/game/tools/harness.
