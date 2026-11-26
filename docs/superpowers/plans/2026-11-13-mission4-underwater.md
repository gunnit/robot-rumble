# Mission 4 Underwater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship the approved Coral Kingdom mission with free swimming, a usable submarine, marine scenery and a robot octopus boss.

**Architecture:** Add isolated L4 registries and content files. Swimming and submarine use the existing RIDES API so the original player physics remain untouched. All new drawings are deterministic; the source manifest and four-card menu are the only shared integration edits.

**Tech Stack:** Existing plain JS Canvas2D, Python HTML bundler, Node VM and @napi-rs/canvas harness.

**Spec:** ../specs/2026-11-13-mission4-underwater-design.md (approved by user 2026-11-13).

## Global Constraints
- 480 × 270 canvas, keyboard, offline standalone index.html.
- Preserve Missions 1–3; no random draws at load time or in new rendering.
- All requested marine life visible. Free vertical movement in both modes.
- No oxygen timer; advertised attacks at least ~0.5 seconds.
- Existing files have concurrent edits: save current copies and patch only exact integration sites.
- No Git repository: use local backups and file hashes, no worktree or commits.

## Review Focus
- Enter held near a submarine must not repeatedly enter/exit (Task 1).
- Death/continue/destroyed vehicle must always restore playable swimming (Task 1/4).
- Camera locks cannot strand enemies outside reachable water (Task 2/4).
- Rewards at different depths and freed animals must remain reachable (Task 3/4).
- Four mission names and records must remain readable; transition 3→4 and all-clear must work (Task 4).

### Task 1: Swimming and submarine
**Files:** Create src/level4_player.js; tools/mission4/test.mjs and runtime.mjs.
**Interfaces:** L4.attach(p), L4.playerLoad(cp), L4.playerUpdate(); RIDES.scuba, RIDES.minisub; PROP_TYPES.oceansub; ITEMS.oceanPearl, oceanCharge. Consumes L4.drawDiver(p), L4.drawSub(x,y,facing,hp,pilot,t) from art task at draw time only.
- [x] Write failing behavior checks: Mission 4 exists; free up/down, no gravity, normalized diagonal, entering/exiting and ejection; pause and respawn.
- [x] Run `node tools/mission4/test.mjs controls`; expect Mission 4 missing before code.
- [x] Implement confined water physics, bubble cannon and torpedo charges through ride update; keep normal hearts/death flow and explicit Enter edge handling.
- [x] Verify controls after Task 3 provides the level data.

### Task 2: Marine art and enemies
**Files:** Create src/level4_art.js and src/level4_enemies.js.
**Interfaces:** L4.drawCreature(kind,x,y,s,t,robot), drawDiver, drawSub, drawBG/Behind/Ground/Front/Overlay, preview/menuBG; ENEMY_TYPES.roboctopus, roboray, robojelly, robocuttle, megaoctopus; EB_TYPES.oceanInk/oceanBolt.
- [x] Add render/error checks for all 4 areas, both modes and all enemy types; add arena completion checks with real player inputs.
- [x] Implement deterministic layered pixel art: caustics, reef, kelp, ruin, glowing cave; recognizable requested species.
- [x] Implement visible attack tells, bounded swimming enemy positions, mini-boss and final boss; death completes only final encounter.
- [x] Render real frames and inspect details, silhouettes and readability.

### Task 3: Mission integration and rescues
**Files:** Create src/level4.js; modify src/manifest.json.
**Interfaces:** LEVELS[3], L4.playerLoad/update and drawing hooks from Tasks 1–2. Six marine POW kinds and 4 sections; level end 6400.
- [x] Add checks for every rescue altitude and rewards, intro skip, checkpoint continue and registry coverage.
- [x] Implement level data, opening descent, music, cages at varied depths, floating pickups, safe boss preparation.
- [x] Insert new scripts after level3.js and before screens.js, preserving current contents.
- [x] Run controls and multi-seed underwater bot tests; tune only observed problems.

### Task 4: Menu, delivery and review
**Files:** Modify src/screens.js; update docs/engine-api.md only for added content overview; build index.html.
- [x] Keep three visible cards with a sliding window when more than three missions exist. Current selection visible; long titles fit; page count at bottom.
- [x] Test 3→4, 4→allclear, saved records, pause and every checkpoint.
- [x] Run prior-mission baseline sims and existing loop/API/flow checks; explain any pre-existing failure.
- [x] Request fresh final code review; resolve gameplay-affecting findings and verify.
- [x] Run build.py; verify standalone HTML, visually inspect in a browser and deliver tested game plus concise controls.
