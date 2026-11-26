# Polish pass over the 3 missions: restart-safe notes

STATUS: [Nov 13 17:20] DONE. Everything is in src/ and checked; nothing left running.
Final checks on src and on the index.html on disk: Mission 1 seeds 1-10 complete, errors [], 8-14 hits (avg 11.9),
0-2 lives lost, no continues, 122-147 s (seed 1: [1,2,4,5] 15050 143.8 s); Mission 2 [0,2,0,1,7] 31950 and Mission 3
[4,3,0,7] 31100 identical to before; FLOW ok (27 now, another session added checks), API 37 ok, loop-test ALL OK
(src and built). Real browser: no errors, bake 0.75 s behind the loading bar (15 frames, 1.5 s in the throttled
preview pane), 1-3 ms per frame.
ANOTHER SESSION is building Mission 4 (CORAL KINGDOM: src/level4*.js, tools/mission4/, docs/superpowers/) in this
folder at the same time. It rebuilt index.html at 17:08 with its unfinished Mission 4 included; that file also
holds all of the polish. tools/polish/build/build-without-m4.py builds index.html without the level4 files.
Backups: backup/index-before-polish.html, backup/src-before-polish/.
Not done / left as is: crate and barrel props keep their look (Missions 2 and 3 share them); sounds of the intro
and the new warnings were never heard; nobody has played it by hand yet.

## Build state (update as pieces land)
- [x] Stars per mission (engine.js, screens.js; card pictures drawn 12 px higher so the strip covers soil).
- [x] src/level1_art.js (old-art fallback removed: all four areas are in), src/main.js loading bar (+ window.bootMs).
- [x] src/level1_jungle.js, _camp.js, _bridge.js, _base.js: real L1ART modules, all rendered and checked
      (tools/polish/build/chk-*.png). Seams at 1620 / 3060 / 4340 look fine as delivered.
- [x] src/level1_intro.js (parachute, 5.5 s, Enter skips), src/level1_crab.js (repaint; hit flash limited to a
      2-frame blink every 24 frames like the Mega Bear).
- [x] src/level1.js fairness retune (tools/polish/build/notes-tune.md): warnings for every attack, crab hp 330,
      heart drops (tank 2, crab 4, one rescue heart per area on the last heart). Old scenery painters deleted from
      level1.js (527 lines; copy before: tools/polish/build/level1.pre-strip.js).
- Browser (dev.html, real Chromium pane): no errors; bake of all four areas 753 ms, worst step 30 ms;
  update+draw 0.7-2.0 ms per frame in Mission 1 (M2 2.2, M3 1.9). The pane is hidden, so rAF does not run there:
  the loading bar itself was not watched.
- If a restart killed the workers: re-dispatch each unfinished piece with "read tools/polish/build-contract.md and
  tools/polish/build/notes-<key>.md, resume".

## The pick (what the proposal offers)
1. Mission 1 repaint to the Mission 2/3 art standard, all 4 areas (mocks: proposals/polish/{jungle,camp,bridge,base}/,
   each scene.js + <key>.png + before.png + notes.md; brief in tools/polish/brief.md; scratch tools/polish/<key>/).
   If a painter died in a restart: re-dispatch it with the prompt pattern "read tools/polish/brief.md, your area is X,
   key K, camera --x N" and tell it to resume from tools/polish/<key>/notes.md.
   Cameras: jungle --x 1000, camp --x 2200, bridge --x 3400, base = boss lock at 4620.
2. Mission 1 opening scene (it has `intro: null`; M2 and M3 have letterboxed arrivals with a place caption).
3. Mission 1 fairness. Never-dodging bot, seeds 1-6 (tools/polish/m1-tune/base-*.json/.err, log.js HITLOG):
   M1 12-24 hits, 4-7 lives lost, 1-2 continues in EVERY seed, 130-178 s; M2 10-14 hits, 0-2, 0 continues.
   Causes (100 hits over 6 seeds): crab orb bursts 29, tank shells 16, drone bombs 15, soldier lasers 16,
   missiles 10, tank mg 3, stomp wave 4. Idea: readable warnings (landing rings like M3's lava bombs, claw glow that
   locks its aim) and fewer orbs with a jump gap; target M2's numbers.
4. Mission cards remember stars + best score per mission (mock: proposals/polish/menus/scene.js, missions.png).
   Today only one global best score is saved (localStorage robotRumbleBest); stars are worked out on the win screen
   and forgotten.
- Already fine: all 3 missions complete with errors []; Mission 3 review items (jet-ski help, frog on the flamingo
  cage) were fixed on Nov 11.

## Reference pictures
tools/polish/compare-missions.png (M1|M2|M3), sheet-m1/m2/m3.png, sheet-screens.png, shots/.
