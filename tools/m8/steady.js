// Harness extra (sim): the bot without its hop. The standard bot presses jump every 42 frames and a jump lasts about
// 40, so it is in the air nearly all the time and most of its shots fly over anything that walks (a raptor is 30 px
// tall, its shots leave up to 56 px higher). This one stands and shoots: still no dodging, but the player an
// 8-year-old is more like. Judge a change on both. Use (with the start jitter):
//   node tools/harness/harness.mjs sim --level 8 --seed 1 --extra tools/m8/jitter.js --extra tools/m8/steady.js
{
  const upd = updatePlay;
  updatePlay = function () {
    for (const c of KEYMAP.jump) { keys[c] = false; delete pressed[c]; }
    upd();
  };
}
