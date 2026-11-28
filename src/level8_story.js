'use strict';
// =====================================================================================================================
// Mission 8: the pictures for the story's last two cards (story.js draws the bands, the words and the Case File):
//   L8.storyArt('ending', t)    after the OGGLE REX: morning at the lagoon. The robots sleep where the switch caught
//                               them, TOPS and the babies have the beach, the hero looks on.
//   L8.storyArt('epilogue', t)  CASE CLOSED (all 8 clues): the crash site. Mega Oggle, as small as he really is, has a
//                               new job: he minds the babies. He calls bed time, they chase him round his own pod.
//                               Ines and Mathias watch with TOPS.
// Both are the valley's own scenery (L8.vista) without the level's pieces, shown higher on the screen so that its floor
// is inside the card's window (y 22 to `bottom`). Everything in them loops on G.t.
// =====================================================================================================================
{
const Math = globalThis.Math;
const gAt = x => Math.round(L8.groundAt(x));
// three Zs drifting up from a sleeper
function zzz(x, y, t) {
  for (let i = 0; i < 3; i++) {
    const ph = ((t + i * 30) % 90) / 90;
    ctx.globalAlpha = ph < 0.75 ? 1 : (1 - ph) * 4;
    text('Z', Math.round(x + i * 2 + ph * 10 + Math.sin(ph * 7 + i) * 1.5), Math.round(y - ph * 20), i === 1 ? '#bfe6ff' : '#ffffff', 1, 'left');
  }
  ctx.globalAlpha = 1;
}
function view(up, bottom, cx, actors) {
  ctx.save();
  try { ctx.beginPath(); ctx.rect(0, 22, W, bottom - 22); ctx.clip(); ctx.translate(0, -up); L8.vista(cx, actors); } finally { ctx.restore(); }
}
const hop = (t, n = 8, h = 3) => Math.floor(t / n) % 2 ? h : 0;

function ending() {
  const T = G.t, gy = gAt(2500);
  view(48, 190, 2200, () => {
    // the robots, asleep where the switch caught them (in front of the long-neck); a baby has found a climbing frame
    M8.compy(2420, gy, 1, { key: 'crouch', mood: 'off', look: [0, 0], t: 0 });
    zzz(2424, gy - 14, T + 41);
    M8.raptor(2462, gy, 1, { key: 'crouch:1', mood: 'off', look: [0, 0], t: 0 });
    M8.hatchling(2458, gy - 21 - hop(T + 9, 9, 2), 1, { v: 2, pose: 'hop', t: T });
    zzz(2484, gy - 26, T);
    // whoever threw the switch, TOPS and the babies have come to look
    M8.tops(2614, gy - hop(T, 10, 2), -1, { pose: 'happy', t: T });
    M8.hatchling(2656, gy - hop(T + 5), -1, { v: 1, pose: 'hop', t: T + 5 });
    M8.hatchling(2574, gy - hop(T + 11), -1, { v: 3, pose: 'hop', t: T + 11 });
    M8.hatchling(2506, gy - hop(T + 2), -1, { v: 0, pose: 'hop', t: T + 2 });
    drawHero(HEROES[G.hero || 0], 2544, gy, -1, { pose: 'idle', aim: 'fwd', t: T });
  });
}

function epilogue() {
  const T = G.t, LOOP = 420, ph = T % LOOP, out = ph < LOOP / 2;
  // he walks out to call bed time (right), then runs back with the babies after him (left)
  const u = out ? ph / (LOOP / 2) : 1 - (ph - LOOP / 2) / (LOOP / 2), mx = 464 + u * 68, f = out ? 1 : -1;
  view(16, 222, 190, () => {
    M8.hatchling(392, gAt(392) - 27, 1, { v: 3, pose: 'sit', t: T });                               // one keeps watch on the pod
    M8.tops(576, gAt(576) - hop(T, 10, 2), -1, { pose: 'happy', t: T });
    drawHero(HEROES[1], 638, gAt(638), -1, { pose: 'idle', aim: 'fwd', t: T + 16 });
    drawHero(HEROES[0], 614, gAt(614), -1, { pose: 'idle', aim: 'fwd', t: T });
    for (let i = 2; i >= 0; i--) {                                                                  // the three who will not go to bed
      const x = mx - f * (out ? 26 + i * 15 : -(18 + i * 14));
      M8.hatchling(x, gAt(x) - (out ? hop(T + i * 5, 6, 2) : 0), f, { v: i, pose: out ? 'hop' : 'run', t: T + i * 3 });
    }
    M8.captain(mx, gAt(mx), f, { pose: out ? 'walk' : 'panic', t: T, look: [1, out ? 0 : -0.4] });
    if (ph % (LOOP / 2) > 24 && ph % (LOOP / 2) < 170) M8.bubble(mx, gAt(mx) - 30, out ? 'BED TIME!' : 'HELP!', '#1a1826');
  });
}

L8.storyArt = function (mode, t) {
  if (mode === 'ending') ending(); else epilogue();
  L8.sceneWarm(); L8.bakeSome(3);
};
}
