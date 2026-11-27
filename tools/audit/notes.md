# Mission audit + story arc (2026-11-27)

STATUS: [2026-11-27] Boss retune (M6, M7) and M2 orchard lock DONE on branch `mission-audit-story`.
Story/progression waits for the user's picks (arc, dinosaurs). Audit doc: https://claude.ai/artifact/6ipL3KgpToCh1Et9ASV6h4

## Probes (load with `--extra`, read the JSON `warnings`)
- `probe.js`: section times, lock durations, boss fight length, kills by type (`PROBE{...}`)
- `hurtprobe.js`: every hit with the nearest enemies and shots (`HURT[...]`)
- `mprobe.js`: a boss's state/attack timeline and damage per shot (`globalThis.BOSS='countClockfang'` in an extra first; default stormManta)
- `dump.js`, `dump2.js`, `dump3.js`: level tables, enemy hp, per-area density
- `shots.sh` + `sheet.mjs`: rendered frames per area -> `sheet-lN.png` (local only)

## Measuring Mission 7 fairly
The harness's lighthouse pilot rings the bell perfectly (1 hit). `RR_NOCOUNTER=1` turns combat rings off
so it never dodges, like the other missions' bot. Missions 6 and 7 sims are deterministic (seed/hero don't change them).

## Results (never-dodging bot)
| Mission | before | after |
|---|---|---|
| 2 | 10-12 hits, 152-171 s | 11-14 hits, 159-169 s (orchard lock 4880) |
| 6 | 16 hits, boss 11 s, Mirror Lake 8 | 15 hits, boss 21 s (37 s from checkpoint), Mirror Lake 5 |
| 7 (no bell) | 10 hits, boss 15 s | 10 hits, boss 28 s (30 s from checkpoint) |
Boss HP cliffs: Clockfang > ~320 or Manta > ~200 and one death in the fight (weapon lost) snowballs to 60+ s.
Tried and reverted (no gain over 5-7 seeds): M1 drone in first lock, M3 shark/lava lock swap, M5 Mega Oggle hp 195.

## Story (THE OGGLE CASE FILE), src/story.js
Wraps update/draw/startMission only. Briefing card after every startMission (menus and win screen, never devStart),
clue panel on each win screen, Case File strip on the mission select (reads G.rec stars: nothing new saved),
ending card after Mission 7, dinosaur epilogue after ALL MISSIONS COMPLETE when all 7 clues are found.
`STORY.enabled = false` restores the old flow (flow-selftest and mission4/test.mjs set it).
Check: `node tools/audit/story-test.mjs` (screenshots in tools/audit/shots/).
Known: tools/mission4/test.mjs "Mission 3 advances to 4 and 4 to all clear" already failed on main (written when
Mission 4 was last); not touched.
