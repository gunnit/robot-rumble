// Harness extra (sim): painting takes its random numbers from a generator of its own, and can be asked for more or
// less often than the harness does it.
//
// Why: a browser paints every frame, the harness every 15th. Does that change the game? The engine's screen shake
// takes two random numbers every time a shaking picture is painted (screens.js drawPlay: rand(-G.shake, G.shake)),
// so a run does depend on how often it is painted: every number after the first shake is another one. With this
// extra the game's numbers stay the same whatever is painted, so one run can be played with any painting and
// compared. Whatever then still differs is a painter changing the game, which it must not.
//
//   node tools/harness/harness.mjs sim --level 8 --seed 1 --extra tools/m8/paint-apart.js
//   ... --extra every.js --extra tools/m8/paint-apart.js        every.js is one line: window.PAINT_EVERY = 1;
//       PAINT_EVERY: 0 never, 1 every frame, 2 twice a frame; not set: as the harness paints (every 15th frame)
// At the end of the run it prints, to stderr: PAINT <pictures> pictures, <n> random numbers taken while painting.
// tools/m8/browser-check.mjs uses it for both sides: the browser then plays the very run the harness played, painted
// every frame.
//
// What it found in Mission 8 (seed 1, Mathias): never, every 15th frame, every frame and twice a frame give the same
// run, byte for byte in the harness's result, except that a run that is NEVER painted differs by one thing:
// CLUBTAIL's spike volley throws its spikes up from where the painter last put them on her back (level8_bosses.js:
// e.pts, a few sparks that take one random number each), so without any picture there are none. It is for show only,
// and both a browser and the harness always paint.
{
  const EVERY = window.PAINT_EVERY;
  const game = Math.random;
  let b = 12345, painting = false, pictures = 0, taken = 0, told = false;
  const own = () => { b = (Math.imul(b, 1103515245) + 12345) >>> 0; return b / 4294967296; };
  Math.random = function () { if (painting) { taken++; return own(); } return game(); };
  const d = draw, u = update;
  const paint = () => { painting = true; pictures++; try { return d(); } finally { painting = false; } };
  // the harness's own call (every 15th frame, and once at the start), or whoever else paints
  draw = function () { if (EVERY === undefined) return paint(); };
  update = function () {
    const r = u();
    for (let i = 0; i < (EVERY || 0); i++) paint();
    if (!told && (G.state === 'win' || G.state === 'allclear' || G.state === 'over')) {
      told = true;
      console.log('PAINT ' + pictures + ' pictures, ' + taken + ' random numbers taken while painting');
    }
    return r;
  };
  window.PAINTAPART = { paint, get pictures() { return pictures; }, get taken() { return taken; } };
}
