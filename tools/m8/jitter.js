// Harness extra (sim): the bot starts 0 to 41 frames late (drawn from the seed), so that every seed plays a different
// run from its first step. Without it the bot's first 35 seconds are the same on every seed (nothing random reaches
// it that early), and one coincidence there (an ambush that happens to catch it mid-hop) reads as "every run". Use:
//   node tools/harness/harness.mjs sim --level 8 --seed 1 --extra tools/m8/jitter.js
{
  const upd = updatePlay;
  let wait = -1;
  updatePlay = function () {
    if (wait < 0) wait = Math.floor(Math.random() * 42);     // 42 = the bot's hop cycle (it decides every 6 frames)
    if (wait > 0) { wait--; return; }
    upd();
  };
}
