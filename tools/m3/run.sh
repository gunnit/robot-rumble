#!/bin/bash
# Mission 3 dev runner: the harness on the frozen pre-Mission-3 build (tools/m3/base.html, Missions 1-2 as of Nov 1)
# with the Mission 3 files loaded on top as --extra, in their final manifest order. Your own extra fixtures go after.
#   tools/m3/run.sh sim --level 3 --seed 1
#   tools/m3/run.sh render --level 3 --x 1200 --frames 90 --out /path/x.png
#   tools/m3/run.sh sim --level 3 --seed 1 --extra my-fixture.js
G=/Users/macbookair/game
H=$G/tools/m3   # tools/m3/harness.mjs: the Mission 3 copy of tools/harness/harness.mjs (+ lava hops); node_modules -> ../harness/node_modules
cmd=$1; shift
if [ "$cmd" = diff ]; then exec node "$H/harness.mjs" diff "$@"; fi
X=()
for f in jetski level3_enemies level3_bees level3_boss level3_sky level3_world level3; do
  [ -f "$G/src/$f.js" ] && X+=(--extra "$G/src/$f.js")
done
exec node "$H/harness.mjs" "$cmd" --html "$G/tools/m3/base.html" "${X[@]}" "$@"
