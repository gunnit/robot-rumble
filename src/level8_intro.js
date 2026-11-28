'use strict';
var L8 = L8 || {};
// =====================================================================================================================
// Mission 8's opening scene (4.6 seconds, Enter skips it). At the crash site a baby dinosaur comes running with a
// little robot after it and hides behind the hero; the hero ducks and shoots the robot while its eye is yellow.
// The one new thing this mission asks of a player (a standing shot flies over the little robots) is shown before it
// is needed, and so is the rule of every robot in the valley: a yellow eye comes before the hop.
// Nothing in it is a real robot: the baby and the robot are drawn by the scene. The shot is the hero's own (his keys
// are the scene's, G.introKeys); the scene ends it when it reaches the robot. Loads after level8.js (L8.level.intro).
// =====================================================================================================================
{
const Math = globalThis.Math;
const BARS = 34, IN_X = 34, HERO_X = 112, HIDE_X = 80, STOP_X = 176, EDGE = 496, BABY_V = 3.2, ROBOT_V = 2.6;
// frames: the baby and the robot come in; the hero ducks, fires, gets up; thanks; the baby runs off; START
const IT = { walk: 46, baby: 14, robot: 40, see: 58, duck: 150, shot: 166, up: 198, thanks: 202, away: 232, go: 248, banner: 268, end: 278 };
const HIDE_T = IT.baby + Math.ceil((EDGE - HIDE_X) / BABY_V), STOP_T = IT.robot + Math.ceil((EDGE - STOP_X) / ROBOT_V);
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

function makeIntro(lv) {
  let t = 0, skipped = false, pop = -1;
  const gy = x => Math.round(groundAt(x));
  // the baby: in from the right, past the hero, behind him; later off to the left
  const baby = () => t < IT.baby ? null
    : t < HIDE_T ? { x: EDGE - (t - IT.baby) * BABY_V, f: -1, pose: 'run' }
    : t < IT.thanks ? { x: HIDE_X + (pop < 0 && (t >> 1) % 2 ? 1 : 0), f: 1, pose: 'sit' }
    : t < IT.away ? { x: HIDE_X, f: 1, pose: 'hop' }
    : { x: HIDE_X - (t - IT.away) * 2.8, f: -1, pose: 'run' };
  // the little robot: in from the right, stops in front of the hero, its eye goes yellow (until the shot is there)
  const robot = () => t < IT.robot || pop >= 0 ? null
    : t < STOP_T ? { x: EDGE - (t - IT.robot) * ROBOT_V, pose: 'run' }
    : { x: STOP_X, pose: 'crouch' };
  return {
    start() {
      t = 0; skipped = false; pop = -1;
      const p = G.p;
      G.introKeys = {}; p.x = IN_X; p.y = groundAt(p.x); p.facing = 1;
    },
    update() {
      t++;
      const p = G.p, at = n => t === n;
      // the scene plays by itself: time to paint ahead what the menus have not painted yet. After a skip, the half
      // second until the hero is the player's does most of what is left (the pictures slow down, the game does not)
      L8.bakeSome(skipped ? 24 : 6);
      // Enter skips to the start banner
      if (!skipped && t > 10 && t < IT.go && pressed.Enter) {
        skipped = true; t = IT.go;
        if (p.x < HERO_X) { p.x = HERO_X; p.y = groundAt(p.x); }
        for (const b of G.pb) b.life = 0;
      }
      if (!skipped) {
        if (at(IT.baby + 2) || at(IT.baby + 44) || at(IT.baby + 88)) L8.BSFX.squeak();
        if (at(STOP_T)) L8.SFX.beep(2);
        // the hero's shot reaches the robot (or, should it ever miss, the scene goes on without it)
        const r = robot();
        if (r && r.pose === 'crouch') {
          const b = G.pb.find(b => b.life > 0 && b.x >= r.x - 8 && b.x <= r.x + 16);
          if (b || t >= IT.shot + 40) {
            if (b) b.life = 0;
            pop = t;
            boom(r.x, gy(r.x) - 7, 0.5); M8.burst('compy', r.x, gy(r.x), -1); L8.SFX.pop();
          }
        }
        if (at(IT.thanks)) { L8.BSFX.squeak(); G.texts.push({ x: HIDE_X - 6, y: gy(HIDE_X) - 46, s: 'SQUEAK! THANKS!', t: 60, c: '#ffe066' }); }
      }
      if (at(IT.go)) { G.big = { s: lv.startText, t: 130 }; say(lv.startSay); }
      if (at(IT.banner)) G.banner = { s: lv.sections[0].name, t: 200 };
      // the hero: in from the left, a duck, one shot, up again
      G.introKeys = skipped ? {} : { right: t <= IT.walk, down: t >= IT.duck && t < IT.up, fire: at(IT.shot) };
      if (t < IT.end) return false;
      G.introKeys = {};
      return true;
    },
    draw() {
      const cx = Math.round(G.cam.x), p = G.p;
      if (!skipped) {
        ctx.save(); ctx.translate(-cx, 0);
        const b = baby(), r = robot();
        if (b && b.x > -16) M8.hatchling(b.x, gy(b.x), b.f, { v: 1, pose: b.pose, t });
        if (r) {
          M8.compy(r.x, gy(r.x), -1, { pose: r.pose, t, mood: r.pose === 'crouch' ? 'warn' : 'look' });
          if (r.pose === 'crouch') M8.bang(r.x, gy(r.x) - 18, t);
        }
        // the hero has seen them
        if (t >= IT.see && t < IT.see + 34) text('!', Math.round(p.x) + 1, Math.round(p.y) - 50 - (t < IT.see + 6 ? IT.see + 6 - t : 0), '#ffe066', 2, 'center');
        ctx.restore();
      }
      // letterbox bars and the captions
      const k = t < 10 ? ease(t / 10) : t > IT.away ? 1 - ease((t - IT.away) / (IT.go - IT.away)) : 1, bh = Math.round(BARS * k);
      if (bh > 0) {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
        ctx.fillStyle = '#2a4a1c'; ctx.fillRect(0, bh - 1, W, 1); ctx.fillRect(0, H - bh, W, 1);
        const cap = t < IT.duck ? 'A HIDDEN VALLEY. SOMEBODY NEEDS HELP!' : 'THE LITTLE ROBOTS RUN LOW: DUCK AND SHOOT!';
        const ca = Math.min(1, (t - 6) / 12, Math.abs(t - IT.duck) / 8);
        if (ca > 0 && t < IT.away) { ctx.globalAlpha = ca; text(cap, W / 2, H - bh + 13, t < IT.duck ? '#d8f7c0' : '#ffe066', 1, 'center', null); ctx.globalAlpha = 1; }
        text(lv.mission + '  /  ' + lv.title, 8, bh - 20, '#9dff4a', 1, 'left', null);
        if (t > 30 && t < IT.go && (t >> 4) % 2) text('ENTER: SKIP', W - 8, bh - 20, '#8a8aa0', 1, 'right', null);
      }
    }
  };
}
if (L8.level) L8.level.intro = makeIntro(L8.level);
}
