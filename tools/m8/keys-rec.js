// Harness extra (sim): writes down the keys of every frame of a run (what the bot held and what it tapped), for
// tools/m8/browser-check.mjs to play back in a real browser. One line to stderr when the run ends:
//   KEYS {"frames": n, "rows": [[frame, "held,keys", "tapped,keys"], ...]}     (a row where something changed)
//   node tools/harness/harness.mjs sim --level 8 --seed 1 --hero 1 --extra tools/m8/keys-rec.js 2> keys.txt
{
  const upd = update, rows = [];
  let last = null, f = 0, told = false;
  update = function () {
    const h = Object.keys(keys).filter(k => keys[k]).sort().join(','), t = Object.keys(pressed).filter(k => pressed[k]).sort().join(',');
    if (h !== last || t) { rows.push([f, h, t]); last = h; }
    f++;
    const r = upd();
    if (!told && (G.state === 'win' || G.state === 'allclear' || G.state === 'over')) { told = true; console.log('KEYS ' + JSON.stringify({ frames: f, rows })); }
    return r;
  };
}
