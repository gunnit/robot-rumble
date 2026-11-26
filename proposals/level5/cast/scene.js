'use strict';
// MISSION 5 proposal: THE CAST sheet (a screenshot fixture, not game content). Needs kit.js loaded first:
//   node tools/harness/harness.mjs render --level 5 --x 240 --frames 30 --god --scale 4 \
//     --extra proposals/level5/kit.js --extra proposals/level5/cast/scene.js --out proposals/level5/cast/cast.png
{
const P = M5.PAL, S = P.S;
const FLOOR = 150, FLOOR2 = 236;
LEVELS.push({
  mission: 'MISSION 5', title: 'ALIEN MOTHERSHIP', end: 1200, heroStart: 240, terrain: null,
  sections: [{ x: 0, name: '' }], plats: [], spawns: [], pows: [], props: [], locks: [], music: 'main', bossMusic: 'boss', intro: null,
  load() { G.big = null; G.banner = null; },
  update() { G.big = null; G.banner = null; G.p.hidden = true; G.p.x = G.cam.x + 240; },
  drawBG() {
    ctx.fillStyle = S[1]; ctx.fillRect(-10, -10, W + 20, H + 20);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = S[2]; ctx.fillRect(i * 60 - 6, 0, 56, H); ctx.fillStyle = S[0]; ctx.fillRect(i * 60 + 50, 0, 2, H); }
    for (const fy of [FLOOR, FLOOR2]) {
      ctx.fillStyle = S[4]; ctx.fillRect(0, fy, W, 3); ctx.fillStyle = S[6]; ctx.fillRect(0, fy, W, 1); ctx.fillStyle = S[0]; ctx.fillRect(0, fy + 3, W, 21);
      ctx.fillStyle = P.MAG; ctx.fillRect(0, fy + 24, W, 1);
    }
  },
  drawOverlay() {
    const t = G.t;
    text('THE OGGLES: GREEN ONE-EYED ROBOTS', 240, 40, P.BEAM, 2, 'center');
    text('EACH ONE WARNS YOU BEFORE IT ATTACKS', 240, 58, '#ffffff', 1, 'center');
    // row 1: oggles
    M5.oggle(40, FLOOR, 1, { pose: 'walk', look: [1, 0], t });
    M5.oggle(100, FLOOR, 1, { pose: 'aim', look: [1, 0], t });
    M5.oggle(160, FLOOR, 1, { pose: 'warn', look: [1, 0], t });
    M5.oggle(220, FLOOR, 1, { pose: 'shoot', look: [1, 0], t });
    EB_TYPES.ogring.draw({ x: 262, y: FLOOR - 13, vx: 2 });
    text('OGGLE', 130, FLOOR + 5, P.BEAML, 1, 'center'); text('WALK   AIM   WARNING!   ZAP', 130, FLOOR + 14, '#b9c6e6', 1, 'center');
    // drones
    M5.drone(330, FLOOR - 52, -1, { pose: 'idle', look: [-0.6, 0.8], t, still: true });
    M5.drone(390, FLOOR - 52, -1, { pose: 'warn', look: [-0.3, 0.9], t, still: true });
    M5.drone(445, FLOOR - 66, -1, { pose: 'idle', look: [0, 1], t, still: true, beam: FLOOR - 2 });
    M5.cow(445, FLOOR - 18, -1, { float: true });
    text('EYE SAUCER', 388, FLOOR + 5, P.BEAML, 1, 'center'); text('FLIES   WARNING!   BEAM', 388, FLOOR + 14, '#b9c6e6', 1, 'center');
    // row 2: rollers, cow pod, hero for scale
    M5.roller(40, FLOOR2, 1, { pose: 'idle', look: [1, 0], t, rot: 0.3 });
    M5.roller(84, FLOOR2, 1, { pose: 'warn', look: [1, 0], t, rot: 1.2 });
    text('ROLY EYE', 62, FLOOR2 + 5, P.BEAML, 1, 'center'); text('ROLLS  WARNING!', 62, FLOOR2 + 14, '#b9c6e6', 1, 'center');
    drawHero(HEROES[0], 150, FLOOR2, 1, { pose: 'idle', t, aim: 'fwd', weapon: 'pistol' });
    drawHero(HEROES[1], 186, FLOOR2, -1, { pose: 'idle', t, aim: 'fwd', weapon: 'pistol' });
    text('INES & MATHIAS', 168, FLOOR2 + 5, '#ffffff', 1, 'center');
    M5.pod(262, FLOOR2, { id: 1, t }); M5.bubble(262, FLOOR2 - 54, 'MOO!');
    M5.cow(320, FLOOR2, 1, {});
    text('RESCUE: THE COWS', 290, FLOOR2 + 5, P.AMBL, 1, 'center'); text('TAKEN FROM VIGO HILLS', 290, FLOOR2 + 14, '#b9c6e6', 1, 'center');
    M5.oggle(400, FLOOR2, -1, { pose: 'hit', look: [-1, 0], t });
    M5.oggle(446, FLOOR2, -1, { pose: 'idle', look: [-1, -0.4], t });
    text('OUCH!   IDLE', 423, FLOOR2 + 5, '#b9c6e6', 1, 'center');
  }
});
}
