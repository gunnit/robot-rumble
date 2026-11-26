# Mission 3 code review log (restart-safe)
Started 2026-11-11. Scratch: tools/m3/review-code/

## Status
- [x] read spec/api/notes (engine.js, screens.js, main.js, core.js read)
- [x] global collisions: review-code/globals.mjs -> only `var L3`/`var L2` re-declarations (legal); no registry key clashes
- [x] determinism: loadrand.mjs (0 load-time calls, all files); drawrand.js fixture (draw every frame, menus with LV/G.p null, seeds 1-2: no rand in draw, no errors); randsites/drawcalls.mjs static: no draw fn reaches rand
- [x] restart/leak paths (s-whale, s-moments, s-swarm)
- [x] guards/edges (menus.js, edge renders, sandbox, canvases.js: no per-frame canvases)
- [x] spec rules (s-frogcrouch, s-insidefire, s-jetski)
- [x] M1/M2 seeded parity with vs without M3 files (nom3 copy): identical s1/s2
- [x] api-fixes 37 ok, engine-selftest DONE, loop-test ALL OK, index.html == src (0 stale)
- [x] fix check for F1 on a scratch copy (review-code/fixed): all bees dive; but sims get much harder (s1 [4,45,5,4] 17 deaths; s3 [4,7,4,32]) -> retune needed

STATUS: DONE, report sent.

## Confirmed findings

## Checked fine

- [x] menus.js: every menu/end screen with LV null/M1/M2/M3, G.p null/set: no throw
- [x] flow-selftest 23/23 ok

## Findings (confirmed)
F1 MAJOR level3_bees.js:268-283 swarm(): SW (module state) never resets when the swarm is gone -> after the first bee
   (x 300) dies every later bee gets a formation slot near x~300..1500 (off screen left), flies off in 'enter' and is
   culled by updateEnemies (x < cam-120). Repro: beewatch.js on sim --level 3 seeds 1-3 (culled bees listed), and
   s-swarm.js (restart: queen-lock bees get sx 2445 from a previous run). Fix idea: in swarm() `if (G.t - SW.t > 1) { SW.n = 0; SW.gone = 999; }` before SW.t = G.t.
- [x] s-whale.js: caught (hidden) -> P,Q -> menus -> M3 again: hidden false after intro, eb empty, music island. PTOO kills last
      life -> over -> continue at 5300: clean, music islandlava. No lava rule inside the whale (max y 224).
- [x] s-moments.js: jet-ski ride / frog stuck / queen lock / lava lock / boss intro / inside whale / boss dying x
      (game over+continue | P,Q -> M1 and M3): all invariants ok, no errors (the 'BAD ride' lines = bot walking into the jet-ski).
- [x] edges: render x 0/8/6190/6199, sandbox each new enemy: no errors
F2 MINOR jetski.js:868 RIDES.jetski has no `help` (engine-api: pause screen shows ride keys); pause shows on-foot keys only.
F3 MINOR level3_boss.js:1264 stepHeld keeps p.fireCd >= 6, but shotgun (tapCd 10) and rockets (tapCd 6) fire on a tap
   at fireCd <= tapCd: s-insidefire.js -> rocket 5 shots/whale 350->338, shotgun 16 pellets/350->310 from inside the
   mouth while hidden. Fix: Math.max(p.fireCd, 12).
F4 MINOR/MAJOR level3_enemies.js:1388-1392 frog lash: tip starts at mouth height (feet-19..-23) and reaches standing height only at
   T.k*4>=1; overlap is tested from st 1 -> a CROUCHING hero 24-30 px away is stuck on the first frame and GULPed
   (|dx|<25) at once. Repro s-frogcrouch.js (sandbox frog): dx 24/26/28/30 STUCK, 32+ not. Fix: test overlap with
   tongueTipBox(tx, T.gy - TONGUE_H) (or only once T.k*4 >= 1).
