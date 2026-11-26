# Robot Rumble: shared rules for every coding agent

This file is read by **Codex** (AGENTS.md) and by **Claude Code** (CLAUDE.md imports it).
Both agents work on the same game, so both follow these rules. Keep it current: if you change
how the project works, update this file in the same commit.

## What this is

A side-scrolling run-and-gun HTML5 canvas game (480x270) a parent is making for their two kids
(ages 8-10). Heroes: Ines and Mathias. Missions, in order:

| # | Mission | Main files |
|---|---------|-----------|
| 1 | ROBOT JUNGLE | `src/level1*.js` |
| 2 | VIGO HILLS | `src/level2*.js`, spec `docs/level2-spec.md` |
| 3 | VOLCANO ISLAND | `src/level3*.js`, spec `docs/level3-spec.md` |
| 4 | CORAL KINGDOM (underwater) | `src/level4*.js`, notes `tools/m4polish/` |
| 5 | ALIEN MOTHERSHIP | `src/level5*.js`, spec `docs/level5-spec.md`, notes `tools/m5/` |
| 6 | CLOCKFANG CAVERN | `src/level6*.js` |
| 7 | THE LAST LIGHTHOUSE | `src/level7*.js` |

Engine API for mission authors: `docs/engine-api.md`.

## Where things live

- **Repo:** https://github.com/gunnit/robot-rumble (branch `main`)
- **Live game:** https://gunnit.github.io/robot-rumble/ (GitHub Pages, redeploys on every push to `main`)
- **Local folder:** `/Users/macbookair/game`. Work here, not in a copy. If your app gives you a
  separate scratch folder, use it only for throwaway files and edit the game in this folder.

## Start of every session

```bash
cd /Users/macbookair/game
git status            # uncommitted changes? another agent may be mid-task: ask before touching them
git pull --rebase     # get what the other agent pushed
```

Then read the notes for the area you will touch (`tools/<task>/notes.md`, the mission spec in `docs/`).

## Making changes

1. Edit `src/*.js`. Load order is `src/manifest.json`; a new file must be added there.
2. Never edit `index.html` by hand. Rebuild it: `python3 build.py`
   (inlines every `src/` file into `index.html`, the single file the kids double-click and the file Pages serves).
3. `dev.html` loads `src/` directly: serve the folder (`python3 -m http.server 8123`) and open
   `http://localhost:8123/dev.html` for quick checks without rebuilding.
4. Test with the headless harness (`tools/harness/README.md`; run `npm install` in `tools/harness` once):
   ```bash
   node tools/harness/harness.mjs sim --level N --seed 1      # bot playthrough of mission N
   ```
   Fixtures in `tools/harness/fixtures/` (flow-selftest, api-fixes, engine-selftest, ...).
   Reference numbers per mission are in the mission notes; a change must not break earlier missions.

## End of every session (or every finished step)

```bash
python3 build.py
git add -A
git commit -m "<mission/area>: <what changed>"
git push              # deploys to the live game within about a minute
```

- Commit small and often, with a message that says which mission/area changed.
- Always commit `index.html` together with the `src/` change it was built from (they must match).
- If `git push` is rejected, `git pull --rebase`, rebuild (`python3 build.py`), commit, push again.
  On a conflict in `index.html`, never merge it by hand: resolve `src/` and rebuild.

## Two agents, one game

- Only one agent edits at a time. If `git status` shows changes you did not make, stop and ask the user.
- For bigger parallel work, use a branch (`git switch -c m8-proposal`) and merge into `main` when done.
- Durable notes go in `tools/<task>/notes.md` (tracked, with a STATUS line at the top so the other agent
  or a restarted session can resume). Scratch (screenshots, probes, work copies) goes in sub-folders of
  `tools/<task>/`; `.gitignore` keeps those local.
- `backup/` is local only; git history is the backup now.

## How the user likes new missions made

- New mission: make a **screenshot proposal first** (real-engine mock frames + a short list of choices),
  wait for their picks and "build it".
- Each mission must be clearly better than the one before. Mission 2 is the quality and difficulty bar:
  the never-dodging bot takes about 150-170 s and 10-14 hits.
- Fair for 8-10 year olds: readable warnings before attacks, an escape for every attack, heart drops.
- Original art and characters only.
