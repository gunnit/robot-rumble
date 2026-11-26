# Review-play log (Mission 3 playtest review)
Started 2026-11-11. Read-only review; scratch in tools/m3/review-play/.

## Progress
- [ ] read docs/notes
- [ ] read source
- [ ] sims
- [ ] renders/contact sheets
- [ ] findings

## Findings so far
- [16:40] Tools: review-play/mr.mjs (multi-frame renderer on src/manifest, EACH/INFO/SNAP/STOP hooks), warnlog.js
  (HIT lines with time since warning), vac-probe.js, st-boss.js, st-bay.js. Sweep shots/sweep/x*.png.
- Sims s1-6 (warnlog): identical to tuner f20. Bot hit causes (110): lavashark 18, whale vac 17, stinger 13, bee 12,
  lavabomb 12, queen swoop 8, mwdrop 7, shark 6 (ALL at t587 boarding the ski, hit on leap frame 0), steam 6.
- Vacuum probe (probe-vac.out): from ledge X>=205 a kid reacting 24 f after suction start (=RUN! appears) is caught;
  X>=190 caught with 36 f reaction. Phase 2 standing still is caught from anywhere (X 60 at 146 f).
- Respawn after dying in the whale mouth: x 5941 (on the lake lip, beyond catch line 5934).
- Frog 5470 sits on the flamingo cage (5480): covers it + HELP bubble (sweep x5400/x5600).
- [17:20] Lava probe (probe-lava.out, lava-probe.js): forced lava-shark leaps at a hero on a column: stand 9/9 bitten,
  crouch 9/9, jump during the warning (-40..-6 f) 8-9/9 (the leap re-aims at the airborne hero; A clamps at 92; the
  descending jaws clip the landed hero's head ~rel 27), only exact timings work (j0 3/9, j6 2/9 bitten), shoot 3/9.
  Bank hero never bitten. What-if rising-only jaws (whatif-risejaws.js): still 6/9 stand, 5-7/9 for most jumps.
- Death in the whale (st-die2.js): body pops out through the snout, lies upside-down in the lava lake ~2 s, respawn x 5932
  on the lake lip. Bot runs (respawnlog.js): dead x 6058-6059 -> respawn 5934 in s1/s2/s6.
- Intro: first bee dives ~68 f after control returns (all seeds), its charge hidden behind the MISSION 3 START! band.
- Jet-ski has no RIDES.jetski.help (tractor shows 'C: CANNON DOWN+Z: GET OUT' on boarding + pause).
- Pelican heart from the ski lands on the lagoon floor (1443,246), tinted under water; ski picks it up by driving on.
- Frog hop landing shadow mostly under the front grass (shots/st/z-hop1.png). Frog close-range: stuck at dx<=43 ->
  GULP hit within <30 f.
- M2 vs M3 bot: M2 152-171 s, 10-14 hits, 0-2 deaths, 0 continues; M3 206-301 s, 16-26 hits, 4-7 deaths, 1-2 continues.
- Stacking (stacklog.js): lavabomb+lavashark 45-70 frames/run in A3; frog+queen in A2; bee keeps diving during queen rise.
- Sheets: review-play/sheet-tells.png, review-play/sheet-issues.png. STATUS: findings written (final report).
