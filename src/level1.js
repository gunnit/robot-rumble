'use strict';
// ============================================================
// Mission 1: ROBOT JUNGLE — enemies, their warnings, props, prisoners and the level data. The scenery is painted by
// level1_jungle.js / level1_camp.js / level1_bridge.js / level1_base.js through level1_art.js; the Mega Crab's picture is
// level1_crab.js; the opening scene is level1_intro.js.
// Everything in this block is private: the mission is reached through LEVELS[0] and the
// registries (ENEMY_TYPES soldier/drone/tank/crab, PROP_TYPES crate/barrel, POW_KINDS human).
// ============================================================
{
// ============================================================
// Enemy sprites
// ============================================================
const ROBOT_HEAD = makeSprite([
  '....kkkkk....',
  '..kkmllllkk..',
  '.kmmlllmmmmk.',
  '.kmllmmmmmmmk',
  'kmmlmmmmmmmmk',
  'kmmmmmkkkkkkk',
  'kdmmmkrrrRRRk',
  'kddmmkrrrrrrk',
  'kdddmkkkkkkkk',
  '.kdddmmmmmdk.',
  '..kkkkkkkkk..'
], { k: OUT, m: MET, l: METL, d: METD, r: '#d62a20', R: '#ffb3a8' });

function robotLeg(lx, lift, back) {
  const y = -11 - lift, c = back ? METD : MET;
  RO(lx, y, 3, 4, c); RO(lx, y + 4, 2, 1, METDD); RO(lx, y + 5, 4, 4, c);
  if (!back) R(lx + 3, y + 5, 1, 4, METL);
  RO(lx - 1, y + 9, 7, 2, back ? METDD : METD);
}

function drawSoldier(e) {
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0;
  let legs = [[-5, 0], [1, 0]], bob = 0;
  if (e.moving) { const f = Math.floor(e.t / 6) % 6; legs = RUN6[f]; bob = f === 2 || f === 5 ? -1 : 0; }
  const ty = -21 + bob, aiming = e.state === 'aim';
  robotLeg(legs[0][0], legs[0][1], true);
  // back shoulder + arm
  RO(-6, ty + 1, 4, 4, METD);
  RO(-2, ty + 5, 9, 2, METDD);
  // pelvis + torso
  RO(-5, -13 + bob, 10, 2, METDD);
  RO(-6, ty, 12, 9, MET); R(-6, ty, 2, 9, METD); R(-4, ty, 9, 1, METL);
  RO(-2, ty + 2, 6, 5, METL); R(-2, ty + 6, 6, 1, METD);
  R(0, ty + 3, 2, 2, e.t % 40 < 20 ? EVIL : '#7a1f1f');
  // head + antenna
  spr(ROBOT_HEAD, -6, ty - 10);
  R(-3, ty - 13, 1, 3, METDD); R(-3, ty - 14, 1, 1, e.t % 30 < 15 ? EVIL : '#ffd0cc');
  if (!FLASH) { const sx = 1 + Math.floor(e.t / 5) % 5; R(sx, ty - 4, 1, 1, aiming ? '#ffffff' : '#ff8a80'); }
  robotLeg(legs[1][0], legs[1][1], false);
  // shoulder pad + rifle
  RO(-2, ty, 6, 4, METL); R(-2, ty + 3, 6, 1, METD);
  RO(2, ty + 4, 13, 3, '#2c3440'); R(3, ty + 4, 11, 1, '#4d5866'); RO(15, ty + 5, 4, 1, METDD);
  RO(5, ty + 7, 2, 3, '#2c3440');
  R(18, ty + 5, 1, 1, EVIL);
  // the aim flash: a red charge at the muzzle that grows and blinks faster until the shot
  if (aiming) {
    const k = clamp(1 - e.st / SOLDIER_AIM, 0, 1), on = e.st % (e.st < 16 ? 4 : 8) < (e.st < 16 ? 2 : 4), r = 2 + Math.round(k * 3);
    ctx.fillStyle = 'rgba(255,70,50,' + (on ? 0.55 : 0.3) + ')'; circ(20, ty + 5, r + 2);
    ctx.fillStyle = on ? '#ffffff' : '#ff8a80'; circ(20, ty + 5, r);
    ctx.fillStyle = on ? '#ff8a80' : '#ff3b30'; circ(20, ty + 5, Math.max(1, r - 2));
    for (let i = 0; i < 3; i++) R(23 + r + i * 4, ty + 5, 2, 1, on ? '#ffffff' : '#ff3b30');
  }
  FLASH = false; ctx.restore();
  if (aiming && e.st % 10 < 7) text('!', Math.round(e.x) + 1, Math.round(e.y) - 49 + bob, e.st < 16 ? '#ffe066' : '#ff3b30', 1, 'center');
}

function drawDrone(e) {
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0;
  const f = Math.floor(e.t / 2) % 3;
  // arms + rotors
  RO(-13, -16, 26, 2, METDD);
  for (const rx of [-12, 12]) {
    RO(rx - 1, -19, 2, 3, METD);
    const bw = [14, 6, 10][f];
    R(rx - bw / 2, -20, bw, 1, '#e8eef3'); R(rx - 7, -20, 14, 1, 'rgba(230,238,243,0.25)');
  }
  // body
  RO(-9, -14, 18, 8, MET); R(-9, -14, 18, 2, METL); R(-9, -8, 18, 2, METD);
  R(-7, -12, 2, 2, e.t % 30 < 15 ? EVIL : '#5a1a1a'); R(5, -12, 2, 2, e.t % 30 >= 15 ? EVIL : '#5a1a1a');
  // eye lens follows the player
  RO(-3, -11, 7, 5, '#22303c');
  const look = clamp(Math.round((G.p.x - e.x) * e.facing / 20), -2, 2);
  R(look + 0, -10, 2, 3, EVIL); R(look + 0, -10, 1, 1, '#ffd0cc');
  // bomb bay + hanging bomb when ready
  RO(-3, -6, 6, 2, METDD);
  if (e.cd < 40) { RO(-2, -4, 4, 4, '#2c3e50'); R(-1, -1, 2, 1, e.t % 10 < 5 ? EVIL : '#2c3e50'); }
  FLASH = false; ctx.restore();
}

function drawTank(e) {
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.facing, 1);
  FLASH = e.hitT > 0;
  const KH = '#8c7e3e', KHL = '#b3a55c', KHD = '#5e5427', KHDD = '#3f381a';
  // tracks
  RO(-34, -12, 68, 12, '#2b2b2b');
  const off = Math.floor(e.tread) % 6;
  for (let i = -34 + ((off + 6) % 6); i < 34; i += 6) { R(i, -12, 3, 1, '#666666'); R(i, -1, 3, 1, '#666666'); }
  for (let i = 0; i < 6; i++) {
    const wx = -29 + i * 11;
    RO(wx, -9, 8, 7, '#7f8c8d'); R(wx + 1, -9, 6, 1, '#a9b4b5');
    const sp = Math.floor(e.tread / 2) % 2;
    R(wx + 3, -7, 2, 3, '#2b2b2b'); R(wx + (sp ? 2 : 1), -6, sp ? 4 : 6, 1, '#4a4a4a');
  }
  RO(-35, -14, 70, 2, KHD);
  // hull
  RO(-30, -24, 58, 10, KH); R(-30, -24, 58, 2, KHL); R(-30, -16, 58, 2, KHD);
  RO(28, -22, 4, 8, KH); RO(32, -19, 2, 5, KHD);
  for (let i = 0; i < 6; i++) R(-26 + i * 9, -20, 1, 1, KHDD);
  RO(-24, -21, 9, 5, '#2c2c2c'); R(-23, -20, 3, 2, EVIL); R(-19, -20, 3, 2, EVIL);
  // exhaust
  RO(-36, -30, 4, 8, '#4a4a4a'); R(-36, -30, 4, 1, '#777777');
  // turret
  RO(-16, -34, 30, 10, KHD); R(-16, -34, 30, 2, KH); R(-16, -26, 30, 2, KHDD);
  RO(-6, -38, 12, 4, KHD); R(-6, -38, 12, 1, KH);
  R(-12, -46, 1, 12, '#333333'); R(-12, -47, 1, 1, e.t % 30 < 15 ? EVIL : '#ffd0cc');
  RO(6, -31, 6, 3, '#22303c'); R(7, -30, 4, 1, EVIL);
  // machine gun + cannon
  RO(26, -29, 10, 3, '#333333');
  const rc = Math.round(e.recoil || 0);
  RO(14 - rc, -32, 28, 5, '#4a4420'); R(14 - rc, -32, 28, 1, '#6a6430');
  RO(42 - rc, -33, 5, 7, '#2f2f2f');
  // machine gun warning: the muzzle blinks and a red sight line shows where the burst will fly (duck under it)
  const mg = e.mgT > 0 || e.burst > 0;
  if (mg) {
    const on = G.t % 6 < 3, len = e.facing < 0 ? e.x - 38 - G.cam.x : G.cam.x + W - e.x - 38;
    R(35, -30, 4, 5, on ? '#ffffff' : '#ff3b30');
    for (let i = 4 + (G.t >> 1) % 8; i < len; i += 8) { R(37 + i, -30, 6, 4, 'rgba(30,10,10,0.5)'); R(38 + i, -29, 4, 2, on ? '#ff3b30' : '#ffe066'); }
  }
  FLASH = false; ctx.restore();
  if (mg || G.eb.some(b => b.k === 'mg' && (G.p.x - b.x) * b.vx > 0)) heroHint('DUCK!', false, '#ffe066', e.y - 28);
}

function drawCrab(e) {
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y + e.oy));
  FLASH = e.hitT > 0;
  const ph2 = e.hp < e.max / 2;
  const C1 = ph2 ? '#b8382c' : '#d4473b', C2 = '#8a2a20', C3 = '#ff7b6b', CD = '#5a1a14';
  const ST = '#5d6d7e', STL = '#95a5a6', STD = '#3d4a57';
  const wk = e.walk * 0.18, fy = e.oy > 0 ? -e.oy : 0;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const legPath = (p, back) => {
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]);
    ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = FLASH ? '#ffffff' : back ? CD : C2; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p[0], p[1] - 1); ctx.lineTo(p[2], p[3] - 1);
    ctx.strokeStyle = FLASH ? '#ffffff' : back ? C2 : C1; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = OUT; circ(p[2], p[3], 4.5); ctx.fillStyle = FLASH ? '#ffffff' : back ? STD : STL; circ(p[2], p[3], 3);
    ctx.fillStyle = OUT; circ(p[4], p[5] - 2, 3.5); ctx.fillStyle = FLASH ? '#ffffff' : STD; circ(p[4], p[5] - 2, 2);
  };
  for (let i = 0; i < 3; i++) {
    const s = Math.sin(wk + i * 2.1);
    legPath([18 + i * 12, -38, 44 + i * 14, -56 + s * 3, 52 + i * 16 + s * 4, fy - Math.max(0, s) * 4], true);
  }
  // shell
  blob([[-50, -66, 100, 32], [-46, -72, 92, 6], [-38, -77, 76, 5], [-26, -80, 52, 3]], C1);
  R(-26, -80, 52, 1, C3); R(-38, -77, 76, 2, C3); R(-46, -72, 92, 1, C3); R(-50, -66, 100, 1, C3);
  R(-50, -44, 100, 10, C2); R(-50, -36, 100, 2, CD);
  R(-22, -79, 2, 37, C2); R(18, -79, 2, 37, C2);
  for (let i = 0; i < 8; i++) R(-46 + i * 12, -62, 2, 2, '#f4d03f');
  if (ph2) { R(-34, -70, 1, 4, OUT); R(-33, -66, 1, 3, OUT); R(-32, -63, 1, 4, OUT); R(26, -74, 1, 5, OUT); R(27, -69, 1, 4, OUT); }
  // glowing core
  const pulse = 3.5 + Math.sin(e.t * 0.2) * 1.2;
  RO(-6, -60, 16, 14, '#2c1a1a');
  ctx.fillStyle = FLASH ? '#ffffff' : ph2 ? '#ff3b30' : '#ffb52e'; circ(2, -53, pulse + 1.5);
  ctx.fillStyle = FLASH ? '#ffffff' : '#fff3b0'; circ(2, -53, pulse * 0.5);
  // belly
  RO(-44, -34, 88, 6, ST); R(-44, -34, 88, 1, STL);
  for (let i = 0; i < 8; i++) R(-40 + i * 11, -32, 6, 2, '#2c3e50');
  // missile pod
  RO(10, -88, 28, 10, ST); R(10, -88, 28, 2, STL); R(10, -80, 28, 2, STD);
  if (e.hatch > 0) for (let i = 0; i < 3; i++) { R(14 + i * 8, -90 - Math.round(e.hatch / 2), 4, 5, '#d5d8dc'); R(14 + i * 8, -90 - Math.round(e.hatch / 2), 4, 2, '#e74c3c'); }
  RO(10, -91 - Math.round(e.hatch), 28, 3, STL);
  // face plate + mandibles
  RO(-62, -64, 16, 28, ST); R(-62, -64, 16, 2, STL);
  for (let i = 0; i < 4; i++) R(-60, -59 + i * 5, 12, 2, '#2c3e50');
  const mb = Math.floor(e.t / 8) % 2;
  RO(-66, -40 + mb, 6, 3, STD); RO(-66, -35 - mb, 6, 3, STD);
  // eyes on stalks, looking at the player, blinking now and then
  RO(-34, -94, 3, 18, STL); RO(-20, -98, 3, 22, STL); R(-34, -86, 3, 1, STD); R(-20, -88, 3, 1, STD);
  const eyeC = ph2 ? '#ff3b30' : '#ffe066', blink = e.t % 180 < 6;
  const look = clamp(Math.round((G.p.x - e.x) / 60), -3, 0);
  for (const [ex, ey] of [[-39, -103], [-25, -107]]) {
    RO(ex, ey, 12, 10, blink ? C2 : '#ffffff');
    if (!blink) { R(ex + 1, ey + 1, 10, 8, eyeC); R(ex + 4 + look, ey + 2, 4, 6, OUT); R(ex + 4 + look, ey + 2, 1, 2, '#ffffff'); }
    if (ph2) R(ex - 1, ey - 2, 13, 2, OUT);
  }
  for (let i = 0; i < 3; i++) {
    const s = Math.sin(wk + i * 2.1 + 1);
    legPath([-14 - i * 12, -38, -46 - i * 12, -56 + s * 3, -52 - i * 16 + s * 4, fy - Math.max(0, s) * 4], false);
  }
  // big claw with cannon
  const op = Math.round(e.claw || 0);
  RO(-78, -55, 32, 6, ST); R(-78, -55, 32, 2, STL);
  ctx.fillStyle = OUT; circ(-76, -52, 6); ctx.fillStyle = FLASH ? '#ffffff' : STL; circ(-76, -52, 4);
  blob([[-104, -61 - op, 30, 7], [-108, -59 - op, 4, 5]], C1); R(-104, -61 - op, 30, 2, C3);
  blob([[-104, -46 + op, 30, 7], [-108, -45 + op, 4, 5]], C1); R(-104, -40 + op, 30, 1, C2);
  for (let i = 0; i < 4; i++) { R(-102 + i * 6, -54 - op, 2, 1, '#ffffff'); R(-102 + i * 6, -47 + op, 2, 1, '#ffffff'); }
  RO(-98, -53, 18, 5, '#2c3e50'); R(-98, -53, 18, 1, '#4d5866');
  // small claw
  RO(-70, -31, 20, 4, ST); blob([[-90, -35, 20, 5]], C1); blob([[-90, -26, 20, 5]], C1);
  FLASH = false;
  ENEMY_TYPES.crab.tells(e); // every warning visual of the crab (see below); the repainted crab calls it the same way
  ctx.restore();
}

const POW_HEAD = makeSprite([
  '...kkkkkk...',
  '..khhjhhhk..',
  '.khhhhhhhhk.',
  '.khhhhssssk.',
  'khhhhsssHHk.',
  'khhhSssswek.',
  'khhhSssswesk',
  'khhbSsssssbk',
  '.kbbbbbbbbk.',
  '.kbbbmmbbbk.',
  '..kbbbbbbk..',
  '...kbbbbk...',
  '....kkkk....'
], { ...FACE, h: '#5d4037', H: '#3e2a24', j: '#8d6e63', b: '#7b5a48' });

function drawPrisoner(o) {
  ctx.save(); ctx.translate(Math.round(o.x), Math.round(o.y));
  const SH = '#f2efe6', SHD = '#c9c3b3', PN = '#8a6b4a', PND = '#6b5236', ROPE = '#c49a5a';
  if (o.state === 'tied') {
    const w = Math.floor(o.t / 18) % 4 === 0 ? 1 : 0;
    // post
    RO(-11, -36, 5, 36, '#7a5230'); R(-11, -36, 1, 36, '#5b3a1e'); R(-10, -36, 3, 1, '#9a7048');
    // sitting legs + bare feet
    RO(-3, -5, 11, 5, PN); R(-3, -5, 11, 1, '#a88760'); RO(8, -4, 3, 4, SKIN);
    // torso + ropes
    RO(-6, -19 + w, 10, 14, SH); R(-6, -19 + w, 2, 14, SHD); R(-2, -14 + w, 2, 2, '#d8d2c0');
    R(-11, -15 + w, 15, 2, ROPE); R(-11, -10 + w, 15, 2, ROPE); R(-11, -13 + w, 15, 1, '#8a6a3a');
    spr(POW_HEAD, -6, -31 + w);
    if (Math.floor(o.t / 40) % 2 === 0) text('HELP!', 0, -46, '#ffffff', 1, 'center');
  } else {
    const run = o.state === 'run';
    if (run) ctx.scale(-1, 1);
    let legs = [[-4, 0], [0, 0]], bob = 0;
    if (run) { const f = Math.floor(o.t / 3) % 6; legs = RUN6[f]; bob = f === 2 || f === 5 ? -1 : 0; }
    else if (o.state === 'free') bob = -Math.round(Math.abs(Math.sin(o.t * 0.25)) * 4);
    ctx.translate(0, bob);
    for (const [i, lg] of legs.entries()) { RO(lg[0], -11 - lg[1], 3, 8, i ? PN : PND); RO(lg[0], -3 - lg[1], 4, 3, SKIN); }
    RO(-5, -21, 10, 10, SH); R(-5, -21, 2, 10, SHD); R(-3, -21, 1, 6, '#8a6b4a'); R(2, -21, 1, 6, '#8a6b4a');
    RO(-5, -13, 10, 2, PN);
    spr(POW_HEAD, -6, -33);
    if (o.state === 'salute') { RO(3, -23, 2, 6, SKIN); RO(4, -30, 2, 7, SKIN); }
    else if (o.state === 'free') { RO(-8, -27, 2, 8, SKIN); RO(5, -27, 2, 8, SKIN); }
    else RO(1, -19, 2, 7, SKIN);
  }
  ctx.restore();
}

// ============================================================
// Fair fights: every attack shows where it will hit about a second before it does, and has a way out.
//   soldier   SOLDIER_AIM frames of a growing, blinking muzzle flash and a '!' before the laser (jump it)
//   drone     hangs still for DRONE_HOLD frames, then drops; a ring blinks where the bomb lands (step out of it,
//             or shoot the drone first: no bomb). A bomb lands on a platform, so you can hide under one
//   tank      shell: a ring blinks on its landing spot for the whole flight (1 s). Machine gun: a red sight line
//             for MG_TELL frames and DUCK! (crouch under the burst, or jump it)
//   Mega Crab orbs: the claw glows, an aim line follows you, then LOCKS (red / yellow, beep) and three orbs fly
//             down that line into the ring (step back out of it, or jump). Missiles: a ring on each landing spot
//             from the launch on (stand between them). Stomp: JUMP! shows when it is time to jump the shockwave
// A ring is as wide as its danger: with your whole body outside it you are safe.
// One at a time: soldiers, drones and the tank start a warning at least GATE_* frames after the last one, and the
// crab's next attack waits until the last one has landed.
// Hearts: the tank (half health, wreck) and the crab (every fifth of its health) throw a heart that flies to the
// hero, and so does the first soldier or drone beaten in an area while he is on his last heart.
// ============================================================
const SOLDIER_AIM = 46;                    // was 32
const DRONE_HOLD = 26;                     // the bomb hangs (ring blinking) this long before it falls
const MG_TELL = 44;                        // sight line before the tank's burst
const GATE_SOLDIER = 45, GATE_DRONE = 70, GATE_TANK = 70; // after a warning starts, nobody starts another for this long
const TANK_CD = 150;                       // frames between the tank's attacks
const SHELL_MIN = 0.9;                     // a shell's least forward speed: it can't land closer than ~55 px to the muzzle
const CRAB_CHARGE = 34, CRAB_TRACK = 20;   // the claw follows the hero (first volley / later ones) ...
const CRAB_LOCK = 40, CRAB_LOCK2 = 36;     // ... then the aim stands still this long before the orbs (phase 1 / 2)
const ORB_N = 3, ORB_GAP = 7, ORB_FLY = 34; // orbs in a volley, frames between them, frames to the ring (speed 1.6 - 6)
const CRAB_VOLLEYS = 2;                    // volleys in one orb attack
const CRAB_REST = 95, CRAB_REST2 = 75, CRAB_MERCY = 50; // walking about between two attacks (were 70 / 45), longer
                                           // after an attack that hit; its orbs and missiles land before the next one
const JUMP_LEAD = 50;                      // JUMP! shows this many frames before the shockwave is past the hero
const MISSILE_GAP = 72, MISSILE_FALL = 50; // landing spots left and right of the hero's; a missile comes down 50 f after its ring
const WAVE_V = 3.4, WAVE_X = 64;           // the stomp's shockwave starts under the crab's body
const RING_R = '#ff3b30', RING_Y = '#ffe066';

// One at a time: gateT = G.t before which no soldier, drone or tank starts a warning (and none while the hero is down)
let gateT = 0;
const gateOpen = () => G.t >= gateT && !G.p.dead;
const gate = n => { gateT = G.t + n; };

// A landing ring: a red / yellow ellipse blinking on the ground at (x, gy), rx wide (= the danger), a '!' above it.
// soon: about to hit (it blinks faster)
function landRing(x, gy, rx, soon) {
  x = Math.round(x); gy = Math.round(gy);
  const on = Math.floor(G.t / (soon ? 3 : 6)) % 2 === 0, c1 = on ? RING_R : RING_Y, c2 = on ? RING_Y : RING_R;
  ctx.fillStyle = on ? 'rgba(255,59,48,0.34)' : 'rgba(255,224,102,0.26)';
  ctx.beginPath(); ctx.ellipse(x, gy - 1, rx, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,10,10,0.55)';
  ctx.beginPath(); ctx.ellipse(x, gy - 1, rx, 4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = c1;
  ctx.beginPath(); ctx.ellipse(x, gy - 1, rx, 4, 0, 0, Math.PI * 2); ctx.stroke();
  R(x - 1, gy - 2, 3, 2, c2);
  text('!', x + 1, gy - 52 - (on ? 1 : 0), c1, 2, 'center'); // above head height
}
// pixel arrow (dark edge, then colour), like the Mega Bear's hints
function hintArrow(x, y, up, col) {
  for (const [o, c] of [[1, OUT], [0, col]]) {
    for (let j = 0; j < 4; j++) R(x - j + o, (up ? y + j : y + 6 - j) + o, j * 2 + 1, 1, c);
    R(x - 1 + o, (up ? y + 4 : y) + o, 3, 3, c);
  }
}
// What to do, over the hero's head: JUMP! (arrow up) or DUCK! (arrow down). lineY: only when the hero's body
// crosses that height (a machine gun burst flying over a platform hero's feet needs no hint)
function heroHint(s, up, col, lineY) {
  const p = G.p;
  if (!p || p.dead || p.ride) return;
  if (lineY != null && (p.y < lineY - 2 || p.y - 34 > lineY)) return;
  if (Math.floor(G.t / 6) % 3 === 0) return;
  const x = Math.round(p.x), top = Math.round(p.y) - (p.crouch ? 26 : 34);
  text(s, x, top - 18, col, 1, 'center'); hintArrow(x, top - 9, up, col);
}
// A bomb, shell or missile going off at (x, y): it hurts a hero whose body is within d px (the ring is d + 2 wide)
function impact(x, y, d, size) {
  const p = G.p;
  boom(x, y - 4, size);
  if (!p.dead && distToBox(x, y - 4, pbox(p)) < d) hurtPlayer();
}
// A heart from a robot (the tank and the crab crack open, a rescue heart) pops out and flies to the hero by itself,
// so it is never left behind a wreck, under the crab or up on a platform. It is an ordinary heart item with
// it.home set: flyHearts() (from the level's update) steers it, the engine moves it and picks it up
function throwHeart(x, y) {
  G.items.push({ k: 'heart', x, y, vx: 0, vy: -2.5, onGround: false, t: 0, home: true, dropT: 999 }); // dropT: through platforms
}
function flyHearts() {
  const p = G.p;
  if (p.dead) return;
  for (const it of G.items) {
    if (!it.home || it.t < 16) continue;
    const dx = p.x - it.x, dy = p.y - 7 - it.y, d = Math.hypot(dx, dy) || 1, v = Math.min(3.2, 0.8 + (it.t - 16) * 0.08);
    it.vx = dx / d * v; it.vy = dy / d * v - 0.2; it.onGround = false; // (the engine adds the 0.2 back)
  }
}
// A rescue heart: the first soldier or drone beaten in an area while the hero is down to his last heart drops one
// (once per area; a continue starts afresh)
let rescueSec = -1;
function rescueHeart(x, y) {
  const p = G.p;
  if (p.dead || p.hearts !== 1 || rescueSec === G.section) return;
  rescueSec = G.section; throwHeart(x, y);
}
// the first thing a falling bomb meets under (x, y): a platform top or the ground
function surfaceBelow(x, y) {
  let s = groundAt(x);
  for (const pl of LV.plats || []) if (x >= pl.x && x <= pl.x + pl.w && pl.y > y && pl.y < s) s = pl.y;
  return s;
}

// ============================================================
// Enemy behaviour
// ============================================================
function updSoldier(e) {
  const p = G.p, dx = p.x - e.x, adx = Math.abs(dx);
  const vis = e.x > G.cam.x + 16 && e.x < G.cam.x + W - 16; // far enough in for its flash to be seen
  e.moving = false;
  if (e.state === 'walk') {
    e.facing = dx < 0 ? -1 : 1;
    const minX = G.cam.x + 14, maxX = G.cam.x + W - 14;
    const out = e.x < minX || e.x > maxX;
    let mv = 0;
    if (out) mv = e.x < minX ? 1 : -1; // always walk onto the screen so they can be shot
    else if (adx > e.range) mv = Math.sign(dx);
    else if (adx < 36) mv = -Math.sign(dx);
    if (!out && mv && (e.x + mv < minX || e.x + mv > maxX)) mv = 0; // never back off the screen
    if (mv) { e.x += mv * 0.6; e.moving = true; }
    if (--e.cd <= 0 && vis && !p.dead && gateOpen()) {
      e.state = 'aim'; e.st = SOLDIER_AIM; gate(GATE_SOLDIER);
      Snd.tone('square', 620, 930, 0.09, 0.035);
    }
  } else if (e.state === 'aim') {
    e.facing = dx < 0 ? -1 : 1;
    if (--e.st <= 0) {
      const mx = e.x + e.facing * 19, my = e.y - 16;
      const a = Math.atan2(p.y - (p.crouch ? 12 : 18) - my, p.x - mx);
      G.eb.push({ k: 'laser', x: mx, y: my, vx: Math.cos(a) * 2.1, vy: Math.sin(a) * 2.1, r: 3, life: 280 });
      Snd.laser();
      e.state = 'walk'; e.cd = rand(80, 140) | 0;
    }
  }
  const py = e.y;
  e.vy = Math.min(e.vy + 0.26, 6); e.y += e.vy;
  land(e, py);
  if (e.onPlat) e.x = clamp(e.x, e.onPlat.x + 4, e.onPlat.x + e.onPlat.w - 4);
}

function updDrone(e) {
  const p = G.p;
  if (e.bomb && (e.bomb.life <= 0 || !e.bomb.hold)) e.bomb = null; // dropped, or gone
  if (e.t % 160 === 1) e.offX = rand(-50, 50);
  if (!e.bomb) { // it hangs still while its bomb's ring blinks
    const tx = p.x + e.offX, ty = groundAt(e.x) - e.alt + Math.sin(e.t * 0.05) * 6;
    e.x += clamp(tx - e.x, -1.1, 1.1);
    e.y += clamp(ty - e.y, -0.8, 0.8);
  }
  e.facing = p.x < e.x ? -1 : 1;
  const vis = e.x > G.cam.x && e.x < G.cam.x + W;
  if (--e.cd <= 0 && !e.bomb && vis && Math.abs(p.x - e.x) < 40 && !p.dead && gateOpen()) {
    e.bomb = { k: 'l1bomb', e, hold: DRONE_HOLD, r: -1, x: e.x, y: e.y + 2, vx: 0, vy: 0, life: 400, tx: e.x, ty: surfaceBelow(e.x, e.y + 2) };
    G.eb.push(e.bomb);
    e.cd = rand(130, 190) | 0; gate(GATE_DRONE);
    Snd.tone('square', 990, 990, 0.05, 0.05); Snd.tone('square', 990, 990, 0.05, 0.05, 0.1);
  }
}

// where a lobbed shell comes down (the engine's own steps: x += vx, y += vy, vy += g)
function shellLanding(x, y, vx, vy, g) {
  for (let i = 0; i < 400; i++) { x += vx; y += vy; vy += g; if (y >= groundAt(x)) break; }
  return x;
}

function updTank(e) {
  const p = G.p;
  e.y = groundAt(e.x);
  if (e.recoil > 0) e.recoil -= 0.5;
  if (!e.gift && e.hp <= e.max / 2) { // half way: a plate flies off and a heart with it (and another one when it blows up)
    e.gift = 1;
    throwHeart(e.x, e.y - 34); debris(e.x, e.y - 30, 8, '#8c7e3e'); sparks(e.x, e.y - 30, 6);
    G.texts.push({ x: e.x, y: e.y - 52, s: 'CRACK!', t: 60, c: '#ffe066' });
  }
  if (e.state === 'enter') {
    e.x -= 0.8; e.tread += 0.8; e.facing = -1;
    if (e.x < G.cam.x + W - 70) { e.state = 'fight'; e.cd = 50; e.tx = e.x; }
    return;
  }
  if (Math.abs(e.tx - e.x) < 1) e.tx = rand(G.cam.x + 200, G.cam.x + W - 50);
  const mv = Math.sign(e.tx - e.x) * 0.45;
  e.x += mv; e.tread += mv * e.facing;
  if (!(e.mgT > 0 || e.burst > 0)) e.facing = p.x < e.x ? -1 : 1; // the sight line doesn't flip
  if (e.burst > 0 && --e.burstT <= 0) {
    G.eb.push({ k: 'mg', x: e.x + e.facing * 37, y: e.y - 28, vx: e.facing * 3, vy: 0, r: 2, life: 200 });
    e.burst--; e.burstT = 9;
    Snd.shoot();
  }
  if (e.mgT > 0 && --e.mgT === 0) { e.burst = 3; e.burstT = 1; } // the sight line has been on for MG_TELL frames
  if (--e.cd <= 0 && !p.dead && gateOpen()) {
    e.atk++;
    if (e.atk % 3 === 0) {
      e.mgT = MG_TELL;
      Snd.noise(0.04, 0.12, 2400); Snd.noise(0.04, 0.12, 2400, 0.12); Snd.noise(0.04, 0.12, 2400, 0.24);
    } else {
      const mx = e.x + e.facing * 46, my = e.y - 30;
      // aimed at the hero, give or take 10%; the cannon can't point down at its own tracks (SHELL_MIN)
      const vx = e.facing * clamp((p.x - mx) / 61 * rand(0.9, 1.1) * e.facing, SHELL_MIN, 3.2);
      const tx = shellLanding(mx, my, vx, -4.2, 0.15);
      G.eb.push({ k: 'l1shell', x: mx, y: my, vx, vy: -4.2, g: 0.15, r: -1, t: 0, life: 300, tx, ty: groundAt(tx) });
      e.recoil = 4;
      for (let i = 0; i < 4; i++) G.parts.push({ type: 'smoke', x: mx, y: my, vx: e.facing * rand(0.2, 0.8), vy: rand(-0.6, -0.1), life: 30, max: 30, size: 4 });
      Snd.cannon();
    }
    e.cd = TANK_CD; gate(GATE_TANK);
  }
}

// Between two attacks the crab walks about for CRAB_REST frames (phase 2: CRAB_REST2), CRAB_MERCY longer when its
// last attack hit the hero (e.mercy; like the Mega Bear): time to get up and shoot back
function crabToIdle(e, ph2) { e.state = 'idle'; e.st = (ph2 ? CRAB_REST2 : CRAB_REST) + (e.mercy ? CRAB_MERCY : 0); e.mercy = false; e.tx = null; }

function updCrab(e) {
  const p = G.p, L = G.cam.x, ph2 = e.hp < e.max / 2;
  if (e.state !== 'dying' && !p.dead && p.x > e.x - 112) p.x = e.x - 112; // stay in front of the crab's claws
  // a piece of armour breaks off at every fifth of its health (4 times): a heart flies out to the hero
  if (e.state !== 'dying' && e.gift < 4 && e.hp <= e.max * (4 - e.gift) / 5) {
    e.gift++;
    const x0 = e.x - 78, y0 = e.y + e.oy - 78; // over the big claw's shoulder, in front of the shell
    throwHeart(x0, y0);
    debris(x0, y0, 10, '#d4473b'); sparks(x0, y0, 8); boom(x0, y0, 0.8);
    G.texts.push({ x: x0, y: y0 - 16, s: 'CRACK!', t: 60, c: '#ffe066' });
  }
  if (ph2 && e.state !== 'dying' && e.t % 40 === 0) sparks(e.x + rand(-40, 30), e.y + e.oy - rand(40, 70), 6);
  if (ph2 && e.state !== 'dying' && e.t % 12 === 0) G.parts.push({ type: 'smoke', x: e.x + rand(-40, 30), y: e.y + e.oy - 66, vx: rand(-0.3, 0.3), vy: -0.8, life: 50, max: 50, size: 5 });
  if (e.state !== 'idle' && (p.inv > 0 || p.dead)) e.mercy = true; // this attack hit: a longer rest after it
  switch (e.state) {
    case 'intro':
      e.x -= 0.9; e.walk++;
      if (e.x <= L + 380) { e.inv = false; crabToIdle(e, false); e.st = 40; }
      break;
    case 'idle': {
      // while its missiles are coming down it only backs off (e.tx set by the missile attack): it never pushes the
      // hero into a ring, and the next attack waits for them
      const falling = G.eb.some(b => b.k === 'l1missile');
      if (!falling && (e.tx == null || Math.abs(e.tx - e.x) < 2)) e.tx = rand(L + 270, L + 400);
      if (e.tx != null && Math.abs(e.tx - e.x) >= 1) { e.x += Math.sign(e.tx - e.x) * (ph2 ? 0.9 : 0.6); e.walk++; }
      if (--e.st <= 0 && !falling) {
        const pat = ph2 ? ['spread', 'stomp', 'missile', 'stomp'] : ['missile', 'spread']; // it opens with the missiles
        e.state = pat[e.atkI++ % pat.length]; e.st = 0; e.vt = 0; e.vol = 0; e.aim = null;
        if (e.state === 'spread') Snd.tone('sawtooth', 110, 330, 0.5, 0.05);
      }
      break;
    }
    case 'spread': {
      // CRAB_VOLLEYS orb volleys. Each one: the claw's aim follows the hero (e.aim: the line and ring are drawn by
      // EB_TYPES.l1aim), then it LOCKS and stands still, then ORB_N orbs fly down the line into the ring. The crab
      // stays put until the last orbs have landed
      const track = e.vol ? CRAB_TRACK : CRAB_CHARGE, lock = ph2 ? CRAB_LOCK2 : CRAB_LOCK, n = ORB_N;
      const last = e.vol >= CRAB_VOLLEYS - 1;
      const mx = e.x - 100, my = e.y + e.oy - 51;
      e.st++; e.claw = Math.min(5, e.st / 4);
      if (!e.aim) { e.aim = { k: 'l1aim', e, lock: 0, x: p.x, y: 0, vx: 0, vy: 0, life: 99 }; G.eb.push(e.aim); }
      const b = e.aim;
      if (e.vt < track) { b.x = clamp(p.x, L + 10, e.x - 114); b.y = groundAt(b.x) - 12; b.life = 99; }
      else if (e.vt === track) {
        b.lock = 1; b.life = lock + (n - 1) * ORB_GAP + ORB_FLY + 16;
        Snd.tone('square', 520, 520, 0.06, 0.07); Snd.tone('square', 1040, 1040, 0.09, 0.07, 0.09);
      }
      e.lk = e.vt >= track ? e.vt - track + 1 : 0; // frames since the lock (0 = still following): the claw's glow
      const ft = e.vt - track - lock;
      if (ft >= 0 && ft % ORB_GAP === 0 && ft < n * ORB_GAP) {
        const tx = b.x, ty = groundAt(b.x), d = Math.hypot(tx - mx, ty - my), v = clamp(d / ORB_FLY, 1.6, 6);
        G.eb.push({ k: 'orb', x: mx, y: my, vx: (tx - mx) / d * v, vy: (ty - my) / d * v, r: 4, life: 300 });
        Snd.laser();
      }
      e.vt++;
      if (ft >= (n - 1) * ORB_GAP + 8) e.lk = 0;
      // the next volley, or the end: after the last orbs have landed. In phase 1 a volley that hit the hero is the
      // last one (e.mercy: no second volley on a hero who is still blinking); in phase 2 it is angry
      const end = last || (e.mercy && !ph2);
      if (ft >= (n - 1) * ORB_GAP + (end ? ORB_FLY + 2 : 8)) {
        e.vol++; e.vt = 0; e.aim = null;
        if (end) { e.claw = 0; crabToIdle(e, ph2); }
      }
      break;
    }
    case 'missile':
      e.st++;
      e.hatch = e.st <= 70 ? Math.min(8, e.st / 2) : Math.max(0, 8 - (e.st - 70) / 2);
      if (e.st >= 20 && e.st <= 50 && e.st % 10 === 0) { G.eb.push({ k: 'mup', x: e.x + 24, y: e.y - 92, vx: 0, vy: -4, r: 3, life: 60 }); Snd.throw(); }
      if (e.st === 70) {
        // a ring on every landing spot now; each missile comes down MISSILE_FALL frames after its ring. The spots
        // are a row MISSILE_GAP apart: the hero's, then the nearest ones left and right of it that are on the screen
        // and clear of the crab's claws (3 missiles, phase 2: 4). Between two rings is always safe
        let n = 0;
        for (const k of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
          const tx = p.x + k * MISSILE_GAP;
          if (n >= (ph2 ? 4 : 3) || tx < L + 12 || tx > e.x - 110) continue; // (the hero can't be past e.x - 112)
          G.eb.push({ k: 'l1missile', x: tx, y: -60, vx: 0, vy: 0, t: -n * 8, life: 400, ty: groundAt(tx) });
          n++;
        }
        Snd.tone('square', 880, 880, 0.05, 0.05); Snd.tone('square', 880, 880, 0.05, 0.05, 0.1); Snd.tone('square', 880, 880, 0.05, 0.05, 0.2);
      }
      if (e.st >= 100) { crabToIdle(e, ph2); e.tx = Math.min(L + 400, e.x + 70); } // it backs off while they come down
      break;
    case 'stomp':
      e.st++;
      if (e.st < 20) e.oy = Math.min(4, e.st / 4);
      else if (e.st < 60) e.oy = -Math.sin((e.st - 20) / 40 * Math.PI) * 60;
      if (e.st === 20) Snd.noise(0.35, 0.12, 500);
      if (e.st === 30) {
        // the shockwave waits under the crab until it lands (EB_TYPES.l1wave shows JUMP! when it is time)
        e.wave = { k: 'l1wave', e, wait: 1, hint: 0, x: e.x - WAVE_X, y: -80, vx: 0, vy: 0, life: 400 };
        G.eb.push(e.wave);
      }
      if (e.st === 60) {
        e.oy = 0; G.shake = 8; Snd.boom(true);
        const w = e.wave;
        if (w && w.life > 0) { w.wait = 0; w.x = e.x - WAVE_X; w.y = groundAt(w.x) - 3; w.vx = -WAVE_V; w.life = 220; }
        e.wave = null;
        for (let i = 0; i < 12; i++) G.parts.push({ type: 'smoke', x: e.x + rand(-80, 60), y: e.y - 4, vx: rand(-1, 1), vy: rand(-0.6, -0.1), life: 40, max: 40, size: 6 });
      }
      if (e.st >= 90) crabToIdle(e, ph2);
      break;
    case 'dying':
      e.st++;
      G.shake = Math.max(G.shake, 3);
      if (e.st % 6 === 0) boom(e.x + rand(-90, 40), e.y - rand(20, 90), rand(0.6, 1.2));
      if (e.st >= 150) {
        boom(e.x - 20, e.y - 50, 2.4);
        for (let i = 0; i < 6; i++) G.later.push({ t: 4 + i * 6, x: e.x + rand(-80, 40), y: e.y - rand(10, 80), s: 1.8 });
        debris(e.x - 20, e.y - 50, 24, '#d0453a');
        bossDefeated(e);
      }
      break;
  }
}

// ============================================================
// Mission 1's own projectiles (each draws its warning with itself)
// ============================================================
// drone bomb: hangs under its drone for b.hold frames (shoot the drone: no bomb), then falls onto (b.tx, b.ty)
EB_TYPES.l1bomb = {
  r: 3, // (b.r is -1 while it hangs under the drone: touching it there is touching the drone)
  update(b) {
    if (b.hold > 0) {
      const e = b.e;
      if (!e || e.dead || e.hp <= 0) { b.life = 0; return; }
      b.x = e.x; b.y = e.y + 2; b.vx = 0; b.vy = 0;
      if (--b.hold === 0) { b.vy = 0.5; b.g = 0.07; b.r = 3; b.shoot = true; Snd.throw(); }
      return;
    }
    if (b.y + b.vy >= b.ty) { b.life = 0; impact(b.tx, b.ty, 11, 0.67); }
  },
  draw(b) {
    const x = Math.round(b.x), y = Math.round(b.y), gy = Math.round(b.ty), on = G.t % 6 < 3;
    landRing(b.tx, b.ty, 13, !b.hold && b.ty - b.y < 45);
    for (let yy = gy - 34; yy > y + 8; yy -= 5) R(x, yy, 1, 2, on ? 'rgba(255,90,70,0.85)' : 'rgba(255,224,102,0.6)');
    RO(x - 2, y - 3, 5, 7, '#2c3e50'); R(x - 2, y - 5, 5, 2, '#566573'); R(x, y + 1, 1, 1, G.t % (b.hold ? 4 : 10) < (b.hold ? 2 : 5) ? EVIL : '#2c3e50');
  },
  onHit(b) { boom(b.x, b.y, 0.6); }
};

// tank shell: the ring is on its landing spot (b.tx, b.ty) from the shot on
EB_TYPES.l1shell = {
  r: 3, shootable: true,
  update(b) {
    // it only hurts over its ring (it comes down at a slant: without this it would clip a hero standing just
    // outside the ring on the tank's side), and not while it leaves the barrel (a hero right at the muzzle)
    b.r = ++b.t >= 10 && Math.abs(b.x - b.tx) <= 10 ? 3 : -1;
    if (b.vy > 0 && b.y + b.vy >= b.ty) { b.life = 0; impact(b.tx, b.ty, 12, 0.75); }
  },
  draw(b) {
    const x = Math.round(b.x), y = Math.round(b.y);
    landRing(b.tx, b.ty, 14, b.vy > 0 && b.ty - b.y < 50);
    RO(x - 3, y - 3, 6, 6, '#3d3d3d'); R(x - 2, y - 2, 2, 2, '#9a9a9a');
  },
  onHit(b) { boom(b.x, b.y, 0.6); },
  onGround(b) { impact(b.x, groundAt(b.x), 12, 0.75); }
};

// crab missile: its ring shows at b.t 0, the missile comes down from b.t MISSILE_FALL (about 1.4 s in all)
EB_TYPES.l1missile = {
  r: 4,
  update(b) {
    b.t++;
    if (b.t === MISSILE_FALL) { b.y = -10; b.vy = 2; b.g = 0.25; b.shoot = true; }
    if (b.t > MISSILE_FALL && b.y + b.vy >= b.ty) { b.life = 0; impact(b.x, b.ty, 12, 0.75); }
  },
  draw(b) {
    if (b.t < 0) return;
    const x = Math.round(b.x), y = Math.round(b.y);
    landRing(b.x, b.ty, 14, b.t > MISSILE_FALL + 8);
    if (b.t >= MISSILE_FALL) { RO(x - 2, y - 5, 4, 10, '#d5d8dc'); R(x - 2, y + 3, 4, 2, '#e74c3c'); R(x - 1, y - 8 - (G.t % 3), 2, 3, '#ff9f1c'); }
  },
  onHit(b) { boom(b.x, b.y, 0.6); }
};

// the crab's aim (harmless): a dotted line from the cannon to a ring on the ground. Orange while it follows the
// hero, red / yellow and blinking once it is locked: the orbs fly down that line into the ring
EB_TYPES.l1aim = {
  r: -1, // never touches the hero, never shot
  update(b) {
    const e = b.e;
    if (!e || e.dead || e.state === 'dying' || (!b.lock && (e.state !== 'spread' || e.aim !== b))) b.life = 0;
  },
  draw(b) {
    const e = b.e, x = Math.round(b.x), gy = Math.round(groundAt(b.x)), mx = e.x - 100, my = e.y + e.oy - 51;
    const d = Math.hypot(x - mx, gy - my) || 1, ux = (x - mx) / d, uy = (gy - my) / d;
    if (!b.lock) {
      ctx.fillStyle = 'rgba(255,159,28,0.75)';
      for (let i = 10 + (G.t >> 1) % 8; i < d - 6; i += 8) ctx.fillRect(Math.round(mx + ux * i), Math.round(my + uy * i), 2, 2);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,159,28,0.8)';
      ctx.beginPath(); ctx.ellipse(x, gy - 1, 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    const on = Math.floor(G.t / 3) % 2 === 0;
    for (let i = 9; i < d - 6; i += 7) {
      const px = Math.round(mx + ux * i), py = Math.round(my + uy * i);
      ctx.fillStyle = 'rgba(30,10,10,0.6)'; ctx.fillRect(px - 2, py - 2, 5, 5);
      ctx.fillStyle = on ? RING_R : RING_Y; ctx.fillRect(px - 1, py - 1, 3, 3);
    }
    landRing(x, gy, 12, true);
  }
};

// the stomp's shockwave: it waits under the crab (b.wait) until the crab lands, then rolls left; jump it.
// Over the hero (b.hint): an arrow first (1), JUMP! (2) from JUMP_LEAD frames before the wave is past him, counting
// with the way he is walking (toward it: sooner)
EB_TYPES.l1wave = {
  r: 5, // hurts feet lower than 8 px over the ground (the crest is drawn 16 px tall)
  update(b) {
    const e = b.e, p = G.p;
    if (b.wait) { if (!e || e.dead || e.state !== 'stomp') { b.life = 0; return; } b.x = e.x - WAVE_X; b.y = -80; b.life = 400; }
    else {
      b.y = groundAt(b.x + b.vx) - 3;
      if (G.t % 3 === 0) G.parts.push({ type: 'smoke', x: b.x, y: b.y, vx: 0.5, vy: -0.4, life: 20, max: 20, size: 3 });
    }
    // frames until it is past the hero: the wait for the landing, then the gap closing at the wave's speed plus his
    const wait = b.wait ? Math.max(0, 60 - e.st) : 0, pv = p.dead ? 0 : clamp(p.vx, -1.7, 1.7);
    const left = b.x - (p.x - 11) - pv * wait;
    b.hint = p.dead || left <= 0 ? 0 : wait + left / (WAVE_V + pv) <= JUMP_LEAD ? 2 : 1;
  },
  draw(b) {
    const p = G.p, x = Math.round(b.x), gy = Math.round(groundAt(b.x));
    if (b.hint === 2) heroHint('JUMP!', true, G.t % 6 < 3 ? '#ffe066' : '#ffffff');
    else if (b.hint === 1 && Math.floor(G.t / 8) % 2) hintArrow(Math.round(p.x), Math.round(p.y) - (p.crouch ? 26 : 34) - 9, true, '#ffe066');
    if (b.wait) return;
    const k = G.t % 6 < 3;
    ctx.fillStyle = 'rgba(255,214,90,0.3)'; ctx.beginPath(); ctx.ellipse(x, gy, 16, 18, 0, Math.PI, 0); ctx.fill();
    R(x - 7, gy - 8, 14, 8, k ? '#ffe9a0' : '#ffd060'); R(x - 4, gy - 13, 8, 13, '#fff6d0'); R(x - 1, gy - 16, 2, 16, '#ffffff');
    R(x - 9, gy - 5, 2, 5, k ? '#ffffff' : '#ffd060');
  }
};

// ============================================================
// Registry entries
// ============================================================
ENEMY_TYPES.soldier = {
  hp: 2, melee: true, contact: 'hurt',
  make(e) { Object.assign(e, { state: 'walk', cd: rand(50, 110) | 0, range: rand(80, 160), st: 0 }); },
  update: updSoldier, draw: drawSoldier,
  box: e => ({ x: e.x - 7, y: e.y - 31, w: 14, h: 31 }),
  onKill(e, cx, cy, b) {
    boom(cx, cy, 0.7); debris(cx, cy, 7, MET); debris(cx, cy, 3, METDD);
    G.parts.push({ type: 'sprite', s: ROBOT_HEAD, x: e.x, y: e.y - 26, vx: rand(-1.2, 1.2) - e.facing * 0.6, vy: rand(-4.5, -3.5), g: 0.22, rot: 0, vr: rand(-0.3, 0.3), life: 80, max: 80 });
    addScore(100, cx, b.y);
    rescueHeart(cx, cy);
  }
};

ENEMY_TYPES.drone = {
  hp: 2, flying: true, contact: 'hurt',
  make(e, s) {
    if (!s.y) e.y = groundAt(e.x) - (e.lock ? rand(100, 125) : rand(105, 130)); // wave drones fly a bit lower
    Object.assign(e, { alt: groundAt(e.x) - e.y, cd: rand(90, 150) | 0, offX: rand(-40, 40) });
  },
  update: updDrone, draw: drawDrone,
  box: e => ({ x: e.x - 13, y: e.y - 20, w: 26, h: 20 }),
  onKill(e, cx, cy, b) {
    boom(cx, cy, 0.8); debris(cx, cy, 5, '#6b7a8a');
    addScore(150, cx, b.y);
    rescueHeart(cx, cy);
  }
};

// the tank blocks you (jump over it!) but touching it doesn't hurt
ENEMY_TYPES.tank = {
  hp: 40, armored: true, edge: 40, contact: 'block',
  make(e) { Object.assign(e, { state: 'enter', cd: 80, atk: 0, burst: 0, burstT: 0, tread: 0, recoil: 0, mgT: 0, gift: 0 }); },
  update: updTank, draw: drawTank,
  box: e => ({ x: e.x - 34, y: e.y - 38, w: 68, h: 38 }),
  onKill(e, cx, cy, b) {
    boom(cx, cy, 1.6); debris(cx, cy, 12, '#8c7e3e');
    for (let i = 0; i < 6; i++) G.later.push({ t: 6 + i * 7, x: cx + rand(-24, 24), y: cy + rand(-12, 8), s: rand(0.8, 1.4) });
    addScore(1000, cx, b.y);
    G.texts.push({ x: cx, y: b.y - 14, s: 'GREAT!', t: 90, c: '#ffe066' });
    throwHeart(cx, cy); // like the ROBO BEAR: beating the tank gives a heart back
  }
};

// the crab keeps you in front of its claws itself (see updCrab), so touching it does nothing
ENEMY_TYPES.crab = {
  hp: 330, boss: true, bossName: 'MEGA CRAB', armored: true, edge: 110, contact: 'none',
  make(e) { Object.assign(e, { state: 'intro', st: 0, walk: 0, oy: 0, hatch: 0, claw: 0, atkI: 0, inv: true, tx: null, vt: 0, vol: 0, lk: 0, aim: null, wave: null, gift: 0, mercy: false }); },
  update: updCrab, draw: drawCrab,
  box: e => ({ x: e.x - 102, y: e.y + e.oy - 98, w: 152, h: 72 }),
  onKill(e, cx, cy, b) {
    e.state = 'dying'; e.st = 0; e.hitT = 0;
    G.eb = []; G.markers = [];
    addScore(5000, cx, b.y);
    // nothing hurts the hero from here on (same win time), and one falling on the last life comes back and wins
    G.winT = 360;
    if (G.p.dead && G.lives <= 1) G.lives = 2;
    return 'dying';
  }
};

// Every warning visual on the crab's body, in the crab's local coordinates (origin = e.x, e.y + e.oy; the cannon
// muzzle is at (-100, -51), the missile pod at (24, -92)). drawCrab calls it last, inside its translate; so does
// the repainted crab (level1_crab.js). Aim line, rings and JUMP! are drawn by the projectiles (EB_TYPES.l1aim ...).
ENEMY_TYPES.crab.tells = function (e) {
  if (e.state === 'spread') {
    // the cannon charges (orange, growing) while its aim follows the hero; locked = white-hot, blinking, with rays
    const lk = e.lk > 0, on = G.t % 6 < 3, k = clamp(e.vt / (e.vol ? CRAB_TRACK : CRAB_CHARGE), 0, 1);
    const r = lk ? 6 + (on ? 1 : 0) : 2 + k * 4;
    ctx.fillStyle = lk ? 'rgba(255,90,60,0.45)' : 'rgba(255,159,28,0.35)'; circ(-100, -51, r + 4);
    ctx.fillStyle = lk ? (on ? '#ffffff' : '#ff3b30') : '#ff9f1c'; circ(-100, -51, r);
    ctx.fillStyle = lk ? (on ? '#ffe066' : '#ffffff') : '#fff3a0'; circ(-100, -51, r * 0.5);
    if (lk) for (let i = 0; i < 4; i++) { const dx = [-1, 0, 1, 0][i], dy = [0, -1, 0, 1][i]; R(-101 + dx * (r + 4), -52 + dy * (r + 4), 3, 3, on ? '#ffe066' : '#ffffff'); }
  } else if (e.state === 'missile' && e.st < 70) {
    // launching: warning lamps blink on the pod
    for (let i = 0; i < 2; i++) R(13 + i * 20, -86, 3, 3, (G.t >> 2) % 2 === i ? '#ff3b30' : '#ffe066');
  } else if (e.state === 'stomp' && e.oy < 0) {
    // in the air: its shadow on the ground (the ground is at -e.oy here), growing as it comes down
    const k = clamp(1 + e.oy / 60, 0, 1), gy = Math.round(-e.oy);
    ctx.fillStyle = 'rgba(20,10,10,' + (0.2 + k * 0.3).toFixed(2) + ')';
    ctx.beginPath(); ctx.ellipse(-20, gy - 1, 50 + k * 40, 3 + k * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
};

PROP_TYPES.crate = {
  make(o) { o.hp = 2; },
  box: o => ({ x: o.x - 8, y: o.y - 16, w: 16, h: 16 }),
  hit(o, d) {
    if (!propHurt(o, d)) return;
    o.dead = true;
    debris(o.x, o.y - 8, 8, '#b7792b');
    addScore(50, o.x, o.y - 16);
    if (o.item) dropItem(o.item, o.x, o.y - 10, 0);
    Snd.hit();
  },
  draw: o => drawCrate(o.x - 8, o.y - 16)
};

// barrels explode a moment after they break (makes chain reactions)
PROP_TYPES.barrel = {
  make(o) { o.hp = 2; o.fuse = 0; },
  box: o => ({ x: o.x - 6, y: o.y - 16, w: 12, h: 16 }),
  hit(o, d) { if (!o.fuse && propHurt(o, d)) o.fuse = 5; },
  update(o) {
    if (o.fuse && --o.fuse <= 0) {
      o.dead = true;
      addScore(100, o.x, o.y - 16);
      blast(o.x, o.y - 8, 36, 8, 'barrel');
    }
  },
  draw(o) {
    const x = o.x;
    RO(x - 6, o.y - 16, 12, 16, '#c0392b');
    R(x - 6, o.y - 13, 12, 1, '#7b241c'); R(x - 6, o.y - 4, 12, 1, '#7b241c');
    R(x - 4, o.y - 15, 2, 12, '#e8705f');
    R(x - 1, o.y - 10, 3, 3, o.fuse && G.t % 4 < 2 ? '#ffffff' : '#f4d03f');
  }
};

POW_KINDS.human = { draw: drawPrisoner, thanks: 'THANK YOU!', onFree() { say('Thank you!', 1.3, 1.1); } };

// ============================================================
// Level data
// ============================================================
const L1 = {
  mission: 'MISSION 1', title: 'ROBOT JUNGLE', end: 5100, heroStart: 60, terrain: null,
  music: 'main', bossMusic: 'boss', intro: null,
  sections: [
    { x: 0, name: 'AREA 1: THE JUNGLE' },
    { x: 1600, name: 'AREA 2: ENEMY CAMP' },
    { x: 3000, name: 'AREA 3: THE BIG BRIDGE' },
    { x: 4400, name: 'FINAL AREA: ROBOT BASE' }
  ],
  grounds: [[0, 1620, 'grass'], [1620, 3060, 'sand'], [3060, 4340, 'bridge'], [4340, 6000, 'metal']],
  plats: [
    { x: 290, y: 208, w: 54, t: 'rock' },
    { x: 520, y: 198, w: 84, t: 'log' },
    { x: 860, y: 210, w: 46, t: 'rock' },
    { x: 930, y: 188, w: 64, t: 'rock' },
    { x: 1330, y: 200, w: 70, t: 'log' },
    { x: 1812, y: 200, w: 32, t: 'crates' },
    { x: 1980, y: 192, w: 90, t: 'scaffold' },
    { x: 2190, y: 184, w: 50, t: 'tower' },
    { x: 2400, y: 198, w: 70, t: 'scaffold' },
    { x: 2720, y: 190, w: 80, t: 'scaffold' },
    { x: 3220, y: 200, w: 32, t: 'crates' },
    { x: 3520, y: 184, w: 48, t: 'crates' }
  ],
  spawns: [
    { t: 'soldier', x: 540 }, { t: 'soldier', x: 590, y: 198 }, { t: 'soldier', x: 820 },
    { t: 'soldier', x: 960, y: 188 }, { t: 'soldier', x: 1080 }, { t: 'soldier', x: 1370, y: 200 },
    { t: 'soldier', x: 1760 }, { t: 'soldier', x: 1828, y: 200 }, { t: 'drone', x: 1960 },
    { t: 'soldier', x: 2030, y: 192 }, { t: 'soldier', x: 2215, y: 184 }, { t: 'soldier', x: 2320 },
    { t: 'drone', x: 2380 }, { t: 'soldier', x: 2435, y: 198 }, { t: 'soldier', x: 2760, y: 190 },
    { t: 'soldier', x: 2990 }, { t: 'drone', x: 3060 },
    { t: 'soldier', x: 3160 }, { t: 'soldier', x: 3236, y: 200 }, { t: 'drone', x: 3300 },
    { t: 'soldier', x: 3430 }, { t: 'soldier', x: 3544, y: 184 }, { t: 'drone', x: 3620 },
    { t: 'soldier', x: 4260 }, { t: 'drone', x: 4330 }, { t: 'soldier', x: 4380 }
  ],
  pows: [
    { x: 700, item: 'H' }, { x: 1250, item: 'B' }, { x: 2110, item: 'heart' }, { x: 2650, item: 'H' },
    { x: 3380, item: 'B' }, { x: 3820, item: 'heart' }, { x: 4480, item: 'H' }
  ],
  props: [
    { k: 'crate', x: 470, item: 'coin' }, { k: 'crate', x: 1120, item: 'heart' },
    { k: 'crate', x: 1790, item: 'B' }, { k: 'barrel', x: 1905 }, { k: 'barrel', x: 2290 }, { k: 'barrel', x: 2304 },
    { k: 'crate', x: 2600, item: 'coin' }, { k: 'barrel', x: 2870 },
    { k: 'barrel', x: 3330 }, { k: 'crate', x: 3660, item: 'coin' },
    { k: 'crate', x: 4545, item: 'heart' }
  ],
  // Camera locks: the screen stops scrolling until these waves are beaten
  locks: [
    { at: 1100, waves: [{ t: 'soldier', side: 1, d: 20 }, { t: 'soldier', side: 1, d: 80 }, { t: 'soldier', side: -1, d: 140 }, { t: 'soldier', side: 1, d: 200 }] },
    { at: 2460, waves: [{ t: 'drone', side: 1, d: 10 }, { t: 'soldier', side: 1, d: 50 }, { t: 'soldier', side: -1, d: 110 }, { t: 'drone', side: 1, d: 170 }, { t: 'soldier', side: 1, d: 220 }] },
    { at: 3720, waves: [{ t: 'tank', side: 1, d: 30 }, { t: 'soldier', side: -1, d: 260 }, { t: 'drone', side: 1, d: 420 }] },
    { at: 4620, boss: true, waves: [{ t: 'crab', side: 1, d: 60 }] }
  ],
  decor: [
    { t: 'statue', x: 150 }, { t: 'ruin', x: 1010 }, { t: 'ruin', x: 1480 },
    ...[40, 200, 350, 480, 660, 800, 990, 1160, 1290, 1470].map(x => ({ t: 'palm', x })),
    ...[120, 260, 420, 610, 760, 900, 1050, 1220, 1420, 1560].map(x => ({ t: 'bush', x })),
    ...[90, 310, 540, 720, 940, 1190, 1380, 1530].map(x => ({ t: 'fern', x })),
    { t: 'sign', x: 1585, s: 'CAMP >' }, { t: 'flag', x: 1660 },
    { t: 'radio', x: 1760 }, { t: 'jeep', x: 2260 }, { t: 'drums', x: 2010 }, { t: 'drums', x: 2700 },
    ...[1700, 2120, 2560, 2830].map(x => ({ t: 'tent', x })),
    ...[1880, 2490, 2940].map(x => ({ t: 'sandbags', x })),
    { t: 'palm', x: 2350 }, { t: 'palm', x: 2990 },
    { t: 'sign', x: 3020, s: 'BRIDGE' }, { t: 'truss', x: 3060 },
    { t: 'gate', x: 4400 }, { t: 'pipes', x: 4440 }, { t: 'wall', x: 4600 }
  ],
  // drawBG / drawBehind / drawGround / drawPlat / drawFront / preview: the painted scenery, set by level1_art.js
  load() { G.door = 0; gateT = 0; rescueSec = -1; },
  update() {
    flyHearts();
    // the base door rises once the crab's lock starts, shaking the screen
    if (G.door < 1 && G.locks.some(l => l.boss && l.active)) {
      G.door = Math.min(1, G.door + 0.012);
      if (G.t % 6 === 0) G.shake = Math.max(G.shake, 1.5);
    }
  }
};
LEVELS.push(L1);

}
