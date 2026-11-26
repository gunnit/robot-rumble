# Mission 5 (ALIEN MOTHERSHIP) proposal: director notes

STATUS: 2026-11-16 BUILD in progress (user said "Build it" on 2026-11-16, no changes to the proposal).
Spec + builder contract: docs/level5-spec.md. Phases:
  1. skeleton (one agent): level5.js, level5_scenery.js, level5_cast.js, stubs, manifest, baselines  DONE 2026-11-16
     notes: tools/m5/build/notes-skeleton.md
  2. eight parallel builders, one per owner in spec section 1: robots, saucers, gear, boss, hangar (+intro, card),
     garden, space, bridge. Notes: tools/m5/build/notes-<key>.md  <- RUNNING since 2026-11-16 (prompts = spec section 1
     owner + sections 3-6 + 9; restart any whose notes STATUS is not DONE)
  3. integration (coordinator): join, place, tune to the Mission 2 bar (never-dodging bot 150-170 s, 10-14 hits),
     parity of Missions 1-4 vs tools/m5/build/baseline-l*.json, docs/engine-api.md section, build.py, browser check
  4. built screenshots for the user (proposals/level5/built-sheet.png)
To resume after a restart: read the STATUS line of each notes file above and restart whatever is not DONE.

Request (user, 2026-11-15): "next mission is alien robots, they are green, have one eye, the scenery is a spaceship,
prototype". Taken as: the usual screenshot proposal first (nothing in src/ changes).

## Files
- proposals/level5/brief.md      shared painter brief (mission, ship look, rules, render loop)
- proposals/level5/kit.js        shared cast + palette (global M5): oggle, eye saucer, roly eye, cow, pod. Mine.
- proposals/level5/cast/scene.js cast sheet. Render:
  node tools/harness/harness.mjs render --level 5 --x 240 --frames 30 --god --scale 3 \
    --extra proposals/level5/kit.js --extra proposals/level5/cast/scene.js --out proposals/level5/cast/cast.png
- proposals/level5/<key>/{scene.js,<key>.png,notes.md}  one painter each; scratch in tools/m5/<key>/
- proposals/level5/sheet.mjs     composes proposal-sheet.png (2x2 frames + cast band); edit captions there
- proposals/level5/proposal.md   to write

## Design decisions (mine, for the user to correct)
- Robots are called OGGLES (green, one eye). Green is reserved for them; the ship is blue-violet with magenta/cyan/amber.
- Areas: 1 THE HANGAR (0-1600), 2 STAR GARDEN (1600-3300), 3 SPACE WALK (3300-5000), FINAL THE BRIDGE (5000-6400).
- Rescue: cows beamed up from Vigo Hills, in glass pods. New ride: stolen MINI UFO with a grab beam. Boss: MEGA OGGLE.
