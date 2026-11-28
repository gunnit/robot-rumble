// Harness extra (sim): the runner. Between the locks it holds Right and Fire and nothing else (no jump, no crouch,
// no stopping for a fight): the way a child runs a run-and-gun. Inside a lock, on a ride and after the boss it plays
// like the steady bot (the harness's bot without its hop). Use (with the start jitter):
//   node tools/harness/harness.mjs sim --level 8 --seed 1 --extra tools/m8/jitter.js --extra tools/m8/runner.js
{
  const upd = updatePlay;
  const set = (a, on) => { for (const c of KEYMAP[a]) { if (on && !keys[c] && c === KEYMAP[a][0]) pressed[c] = true; keys[c] = on && c === KEYMAP[a][0]; if (!on) delete pressed[c]; } };
  updatePlay = function () {
    const p = G.p, lock = G.locks.some(l => l.active && !l.done);
    set('jump', false);
    if (p && !p.dead && !p.ride && !lock && G.winT <= 0 && !G.intro) {
      // a parked ride in reach: the bot's own keys (it walks into it); otherwise run and shoot
      const ride = G.props.some(o => RIDES[o.k] && !o.dead && Math.abs(o.x - p.x) < 200);
      if (!ride) { set('left', false); set('up', false); set('down', false); set('bomb', false); set('right', true); set('fire', true); }
    }
    upd();
  };
}
