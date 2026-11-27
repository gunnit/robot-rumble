'use strict';
// ============================================================
// Story: THE OGGLE CASE FILE (audit 2026-11).
// One thread through all seven missions: the green one-eyed Oggles (Mission 5) built every boss. Each boss leaves a
// clue; a briefing card before each mission picks up where the last clue left off; the Case File on the mission
// select fills in as bosses fall (it reads the saved stars, so nothing new is stored). After the last mission an
// ending card plays, and with all seven clues the dinosaur epilogue (the teaser for a future Mission 8).
// Loads after screens.js and before main.js: it wraps update, draw and startMission and changes nothing else.
// The briefing only follows startMission (menus, the win screen): devStart and the harness never see it.
// Global: STORY only.
// ============================================================
const STORY = (() => {
  const GOLD = '#ffe066', MINT = '#8be0a8', PAPER = '#f4e2b8', DIM = '#8a93b0', GREEN = '#9dff4a';
  const CLUES = ['GREEN-EYE CHIP', 'STAR MAP SCRAP', 'SHIPPING TAG', 'LAUNCH PLAN', "CAPTAIN'S LOG", 'STORM KEY', 'POD TRACKER'];
  // Briefing before mission i: the clue it follows (none for Mission 1), then three short lines
  const BRIEF = [
    ['ROBOTS ARE TAKING PRISONERS IN THE JUNGLE.', 'NOBODY KNOWS WHO BUILT THEM.', 'STOP THEM AND FIND OUT!'],
    ["THE CRAB'S CHIP HAS A GREEN EYE ON IT. WHO MADE IT?", 'NOW THE ROBOTS ARE AT OUR HOME IN VIGO HILLS!', 'SAVE THE ANIMALS!'],
    ['MEGA BEAR HAD A STAR MAP WITH A VOLCANO CIRCLED.', 'THE ROBOTS ARE BUILT ON AN ISLAND.', 'FIND THE ROBOT FACTORY!'],
    ['THE TAG SAYS: DELIVER TO THE DEEP.', 'THE ROBOT PARTS ARE GOING UNDER THE SEA.', 'DIVE IN AND FOLLOW THEM!'],
    ['THE PLAN SAYS: PICK-UP TONIGHT, VIGO HILLS.', 'SOMETHING IS COMING FROM THE SKY...', "IT'S THE OGGLES! THEY BUILT EVERY ROBOT!"],
    ['MEGA OGGLE GOT AWAY IN AN ESCAPE POD!', 'HIS SHIP DROPPED ITS ENGINE INTO A MOUNTAIN CAVE.', 'COUNT CLOCKFANG FOUND IT FIRST.'],
    ['CLOCKFANG GAVE THE OGGLES A STORM KEY.', 'NOW THE STORM MANTA HIDES THE WHOLE COAST.', 'LIGHT THE LIGHTHOUSE. BRING THE SHIPS HOME!']
  ];
  const ENDING = ['THE LIGHT IS BACK. EVERY SHIP IS HOME.', 'BUT THE STORM MANTA HAD A POD TRACKER INSIDE...', 'IT IS BEEPING. SOMETHING FAR AWAY IS ANSWERING.'];
  const EPILOGUE = ["MEGA OGGLE'S ESCAPE POD LANDED IN A HIDDEN VALLEY.", 'THE OGGLES ARE WAKING UP THE DINOSAURS!', 'TO BE CONTINUED...'];

  let on = true;      // STORY.enabled = false: the old flow, for the engine's own flow tests
  let brief = null;   // { i, t }: the briefing before mission i, shown over a paused mission start
  let card = null;    // { mode: 'ending' | 'epilogue', t } while G.state === 'story'

  const found = i => !!(G.rec && G.rec[i] && G.rec[i].stars > 0);
  const count = () => { let n = 0; for (let i = 0; i < CLUES.length; i++) if (found(i)) n++; return n; };
  const full = () => count() === CLUES.length;
  const blink = n => Math.floor(G.t / n) % 2 === 0;

  // ---- clue icons, 14x14 from (x, y) ----
  function clueIcon(i, x, y, on) {
    x = Math.round(x); y = Math.round(y);
    if (!on) { RO(x, y, 14, 14, '#2a2e44'); text('?', x + 4, y + 4, '#5c6384', 1, 'left', null); return; }
    switch (i) {
      case 0: // green-eye chip
        for (let k = 0; k < 4; k++) { R(x + 2 + k * 3, y, 1, 2, '#c9c9c9'); R(x + 2 + k * 3, y + 12, 1, 2, '#c9c9c9'); }
        RO(x + 1, y + 2, 12, 10, '#26323a'); R(x + 3, y + 5, 8, 4, '#e9fbe0'); R(x + 5, y + 5, 4, 4, '#3cc23c'); R(x + 6, y + 6, 2, 2, '#0b1a0b');
        break;
      case 1: // star map scrap with a volcano circled
        RO(x + 1, y + 1, 12, 12, '#e8d7a8'); R(x + 1, y + 11, 4, 2, '#c4ae78');
        R(x + 3, y + 4, 1, 1, '#4a5aa8'); R(x + 10, y + 3, 1, 1, '#4a5aa8'); R(x + 9, y + 10, 1, 1, '#4a5aa8');
        R(x + 5, y + 8, 4, 2, '#7a4a2a'); R(x + 6, y + 7, 2, 1, '#7a4a2a');
        R(x + 4, y + 5, 6, 1, '#d23a2a'); R(x + 4, y + 10, 6, 1, '#d23a2a'); R(x + 3, y + 6, 1, 4, '#d23a2a'); R(x + 10, y + 6, 1, 4, '#d23a2a');
        break;
      case 2: // shipping tag on a string
        R(x + 1, y + 1, 4, 1, '#c9c9c9'); R(x + 4, y + 2, 1, 2, '#c9c9c9');
        RO(x + 3, y + 3, 10, 10, '#c98a4a'); R(x + 5, y + 5, 2, 2, '#4a2e14');
        R(x + 5, y + 9, 6, 1, '#5a3a1a'); R(x + 5, y + 11, 4, 1, '#5a3a1a');
        break;
      case 3: // launch plan (blueprint with an arrow up)
        RO(x + 1, y + 1, 12, 12, '#2e5fb0'); R(x + 3, y + 3, 8, 1, '#9cc4ff'); R(x + 3, y + 11, 8, 1, '#9cc4ff');
        R(x + 6, y + 5, 2, 6, '#ffffff'); R(x + 5, y + 6, 4, 1, '#ffffff'); R(x + 4, y + 7, 1, 1, '#ffffff'); R(x + 9, y + 7, 1, 1, '#ffffff');
        break;
      case 4: // captain's log: a tablet with the Oggle eye
        RO(x + 2, y + 1, 10, 12, '#5a3e8a'); R(x + 3, y + 2, 8, 8, '#1a1030');
        R(x + 4, y + 4, 6, 4, GREEN); R(x + 6, y + 5, 2, 2, '#0b1a0b'); R(x + 6, y + 11, 2, 1, '#bfa6ef');
        break;
      case 5: // brass storm key
        RO(x + 1, y + 1, 6, 6, '#d6a54a'); R(x + 3, y + 3, 2, 2, '#3a2a10');
        R(x + 6, y + 3, 7, 2, '#d6a54a'); R(x + 10, y + 5, 1, 3, '#d6a54a'); R(x + 12, y + 5, 1, 2, '#d6a54a');
        R(x + 2, y + 9, 2, 1, '#9cf2ff'); R(x + 4, y + 10, 2, 1, '#9cf2ff'); R(x + 3, y + 11, 2, 1, '#9cf2ff');
        break;
      case 6: // pod tracker with a blinking light
        RO(x + 2, y + 3, 10, 10, '#56606e'); R(x + 3, y + 4, 8, 1, '#8a97a8');
        R(x + 4, y + 7, 6, 4, '#16222a'); R(x + 5, y + 8, 4, 2, blink(12) ? GREEN : '#2e5a2e');
        R(x + 9, y, 1, 3, '#c3cdd8'); R(x + 8, y, 3, 1, '#c3cdd8');
        break;
    }
  }
  function fileStrip(x, y, label) {
    if (label) text('CASE FILE', x, y + 4, DIM, 1, 'left', null);
    const x0 = x + (label ? 60 : 0);
    for (let i = 0; i < CLUES.length; i++) clueIcon(i, x0 + i * 17, y, found(i));
    return x0 + CLUES.length * 17;
  }

  // ---- the typed text box: lines appear a letter at a time ----
  const total = lines => lines.reduce((s, l) => s + l.length, 0);
  const shown = t => Math.floor(Math.max(0, t - 24) * 1.4);
  function typed(lines, t, x, y, gap, col) {
    let left = shown(t);
    lines.forEach((l, k) => {
      const n = Math.min(l.length, Math.max(0, left)); left -= l.length;
      if (n > 0) text(l.slice(0, n), x, y + k * gap, k === lines.length - 1 ? GOLD : col, 1, 'center');
    });
  }
  const done = (lines, t) => shown(t) >= total(lines);
  function bands(left, right) {
    R(0, 0, W, 22, '#0b0d1c'); R(0, 21, W, 1, '#3a4270');
    R(0, H - 26, W, 26, '#0b0d1c'); R(0, H - 26, W, 1, '#3a4270');
    if (left) { if (blink(20)) R(10, 8, 5, 5, '#ff4a3a'); text(left, 20, 7, '#d9def5', 1, 'left', null); }
    if (right) text(right, W - 10, 7, DIM, 1, 'right', null);
  }
  function prompt(lines, t, s) { if (done(lines, t) && blink(25)) text(s, W / 2, H - 16, GOLD, 1, 'center', null); }
  function screenBG(top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.025)'; for (let y = (G.t >> 1) % 3; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  // ---- briefing before mission i ----
  function drawBrief() {
    const i = brief.i, L = LEVELS[i], t = brief.t, lines = BRIEF[i] || BRIEF[0];
    screenBG('#141a33', '#070912');
    bands('INCOMING TRANSMISSION', 'CASE FILE ' + count() + ' / ' + CLUES.length);
    // the mission's own card art, in a monitor frame
    const px = 22, py = 36, pw = 180, ph = 96;
    RO(px - 4, py - 4, pw + 8, ph + 8, '#3a4270'); R(px - 3, py - 3, pw + 6, 1, '#6b75b0');
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    try { if (L.preview) L.preview(px, py, pw, ph); else { ctx.fillStyle = '#223'; ctx.fillRect(px, py, pw, ph); } } catch (err) { errorOnce(err); }
    if (t < 20) { ctx.fillStyle = 'rgba(200,220,255,' + (0.6 - t * 0.03) + ')'; ctx.fillRect(px, py, pw, ph); }
    ctx.restore();
    // mission name, then the clue that led here
    const tx = 220;
    text(L.mission || 'MISSION ' + (i + 1), tx, 40, GOLD, 1, 'left');
    const title = L.title || '', big = title.length * 12 <= W - tx - 10;
    text(title, tx, 54, '#ffffff', big ? 2 : 1, 'left');
    if (i > 0) {
      text('LAST CLUE', tx, 88, DIM, 1, 'left', null);
      clueIcon(i - 1, tx, 100, true);
      text(CLUES[i - 1], tx + 20, 104, found(i - 1) ? PAPER : '#b8bfd8', 1, 'left');
    } else text('THE CASE BEGINS', tx, 92, DIM, 1, 'left', null);
    fileStrip(tx, 122, false);
    // the message
    panel(18, 148, W - 36, 74);
    typed(lines, t, W / 2, 158, 20, '#e8ecff');
    prompt(lines, t, 'ENTER: GO!');
  }

  // ---- after the last mission ----
  function drawEnding() {
    const t = card.t;
    screenBG('#1b2a3e', '#0a1018');
    bands('INCOMING TRANSMISSION', 'CASE FILE ' + count() + ' / ' + CLUES.length);
    // the lighthouse, lit, with five ship lights answering
    R(0, 150, W, 70, '#14324a'); for (let x = 0; x < W; x += 24) R(x + ((G.t >> 3) % 24), 160 + (x % 5), 10, 1, '#2b5878');
    RO(226, 70, 28, 80, '#e8e2d2'); R(226, 90, 28, 8, '#c0392b'); R(226, 118, 28, 8, '#c0392b'); RO(222, 58, 36, 14, '#3a4250');
    R(230, 61, 20, 8, '#fff2a8');
    ctx.fillStyle = 'rgba(255,240,170,0.13)'; ctx.beginPath(); ctx.moveTo(240, 65);
    const sw = Math.sin(G.t * 0.02) * 120; ctx.lineTo(sw < 0 ? 0 : W, 30 + Math.abs(sw) * 0.2); ctx.lineTo(sw < 0 ? 0 : W, 100 + Math.abs(sw) * 0.2); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 5; k++) { const sx = 40 + k * 95 + (k === 2 ? 20 : 0); RO(sx, 176 - (k % 2) * 6, 22, 5, '#2a2f3a'); R(sx + 9, 168 - (k % 2) * 6, 2, 8, '#2a2f3a'); if ((G.t + k * 20) % 80 < 50) R(sx + 9, 166 - (k % 2) * 6, 2, 2, '#fff2a8'); }
    clueIcon(6, 300, 120, true); text(CLUES[6], 318, 124, PAPER, 1, 'left');
    panel(18, 190, W - 36, 50);
    typed(ENDING, t, W / 2, 196, 15, '#e8ecff');
    prompt(ENDING, t, 'PRESS ENTER');
  }

  // ---- the dinosaur epilogue (all seven clues) ----
  function dino(x, y, t, c = '#0a1611', eye = true) {
    // a big two-legged dinosaur in silhouette, facing left; its robot eye glows green
    const bob = Math.round(Math.sin(t * 0.05) * 1.5);
    ctx.fillStyle = c;
    ctx.beginPath(); // tail and body
    ctx.moveTo(x + 150, y - 40); ctx.quadraticCurveTo(x + 90, y - 70, x + 40, y - 78); ctx.lineTo(x + 10, y - 70);
    ctx.quadraticCurveTo(x + 4, y - 40, x + 30, y - 30); ctx.quadraticCurveTo(x + 80, y - 30, x + 150, y - 40); ctx.fill();
    ctx.beginPath(); // neck and head
    ctx.moveTo(x + 22, y - 72); ctx.lineTo(x + 8, y - 100 + bob); ctx.lineTo(x - 30, y - 100 + bob); ctx.lineTo(x - 34, y - 88 + bob);
    ctx.lineTo(x - 8, y - 84 + bob); ctx.lineTo(x - 30, y - 78 + bob); ctx.lineTo(x - 26, y - 72 + bob); ctx.lineTo(x + 6, y - 66); ctx.closePath(); ctx.fill();
    R(x + 2, y - 62, 10, 3, c); R(x + 2, y - 62, 3, 7, c); // little arm
    ctx.fillRect(x + 26, y - 36, 12, 28); ctx.fillRect(x + 22, y - 10, 20, 10); // legs
    ctx.fillRect(x + 60, y - 36, 12, 28); ctx.fillRect(x + 56, y - 10, 20, 10);
    if (!eye) return;
    for (let k = 0; k < 5; k++) R(x - 28 + k * 4, y - 85 + bob, 2, 3, '#e8e2d2'); // teeth
    // the eye: dark, then switched on
    const on = t > 70, ex = x - 10, ey = y - 96 + bob;
    if (on) { ctx.fillStyle = 'rgba(157,255,74,' + (0.18 + 0.08 * Math.sin(t * 0.2)) + ')'; circ(ex + 2, ey + 1, 9); }
    R(ex, ey, 4, 3, on ? GREEN : '#1e3a2a'); if (on) R(ex + 1, ey + 1, 2, 1, '#eaffd0');
  }
  function drawEpilogue() {
    const t = card.t, shake = t > 110 && t < 150 ? Math.round(Math.sin(t) * 2) : 0;
    ctx.save(); ctx.translate(shake, 0);
    screenBG('#0b1430', '#1c3226');
    ctx.fillStyle = '#e9efd0'; circ(400, 50, 14); ctx.fillStyle = '#0b1430'; circ(406, 46, 12);
    for (let i = 0; i < 40; i++) R(Math.floor(hsh(i) * W), Math.floor(hsh(i + 40) * 110) + 24, 1, 1, (G.t + i * 9) % 70 < 40 ? '#ffffff' : '#7a7aa0');
    ctx.fillStyle = '#132a20'; ctx.beginPath(); ctx.moveTo(0, 170); // far hills and a smoking volcano
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 186 + Math.sin(x * 0.03) * 8 - (x > 50 && x < 150 ? 40 - Math.abs(x - 100) * 0.8 : 0));
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    for (let k = 0; k < 7; k++) { ctx.fillStyle = 'rgba(160,160,170,' + (0.18 - k * 0.02) + ')'; circ(100 + Math.sin(t * 0.02 + k) * 4 + k * 3, 140 - k * 9 - (t % 40) * 0.2, 5 + k); }
    R(0, 214, W, H - 214, '#0f2018'); // the valley floor, ferns
    for (let x = 6; x < W; x += 26) { ctx.fillStyle = '#163222'; ctx.beginPath(); ctx.moveTo(x, 216); ctx.lineTo(x + 8, 196 + (x % 7)); ctx.lineTo(x + 14, 216); ctx.fill(); }
    // the crashed escape pod, still smoking, its eye-window blinking
    ctx.fillStyle = '#6a7482'; circ(150, 206, 15); R(136, 206, 30, 10, '#4a525e'); ctx.fillStyle = '#16222a'; circ(150, 203, 7);
    if (blink(15)) { ctx.fillStyle = GREEN; circ(150, 203, 3); }
    for (let k = 0; k < 5; k++) { ctx.fillStyle = 'rgba(190,190,200,' + (0.25 - k * 0.04) + ')'; circ(158 + k * 4, 188 - k * 10 - (t % 30) * 0.3, 3 + k); }
    // a giant footprint in front of the pod
    for (const [dx, dy] of [[0, 0], [-7, -6], [0, -8], [7, -6]]) { ctx.fillStyle = '#081510'; circ(212 + dx, 224 + dy, dx || dy ? 3 : 5); }
    // the dinosaur steps in from the right
    const dx = Math.max(0, 140 - t * 2);
    dino(299 + dx, 215, t, '#5d9a7c', false); dino(300 + dx, 216, t); // moonlit rim, then the body
    if (t > 110 && t < 170) text('ROAR!', 250 + dx, 86, GREEN, 2, 'center');
    ctx.restore();
    bands('THE OGGLE CASE FILE', 'SOMEWHERE FAR AWAY...');
    R(18, 222, W - 36, 22, 'rgba(8,10,20,0.75)');
    const lines = EPILOGUE, k = Math.min(lines.length - 1, Math.floor(Math.max(0, t - 24) / 90));
    text(lines[k], W / 2, 229, k === lines.length - 1 ? GOLD : '#e8ecff', 1, 'center');
    if (t > 24 + 90 * (lines.length - 1) && blink(25)) text('PRESS ENTER', W / 2, H - 16, GOLD, 1, 'center', null);
  }
  const epilogueDone = t => t > 24 + 90 * (EPILOGUE.length - 1);

  // ---- hooks ----
  const baseUpdate = update, baseDraw = window.draw, baseStartMission = startMission;
  function idle() { G.t++; if (G.fade > 0) G.fade = Math.max(0, G.fade - 0.04); if (tap('mute')) Music.on = !Music.on; Music.update(); }

  startMission = function (i) {
    baseStartMission(i);
    if (on && LEVELS[i] === LV && BRIEF[i]) { brief = { i, t: 0 }; G.fade = 1; }
  };

  update = function () {
    if (G.state === 'story' && card) {
      idle(); card.t++;
      const ready = card.mode === 'epilogue' ? epilogueDone(card.t) : done(ENDING, card.t);
      if (tap('ok') && card.t > 20) {
        if (!ready) card.t = 1e4;   // Enter first shows the whole message
        else if (card.mode === 'ending') {
          card = null; G.state = 'allclear'; G.endT = 0; G.fw = []; G.fade = 1; Snd.win(); say('All missions complete!');
        } else { card = null; G.state = 'title'; G.level = 0; G.fade = 1; Music.stop(); }
      }
      return;
    }
    if (G.state === 'play' && brief) {
      idle(); brief.t++;
      if (tap('ok') && brief.t > 20) {
        if (!done(BRIEF[brief.i], brief.t)) brief.t = 1e4;
        else { brief = null; G.fade = 1; Snd.select(); }
      }
      return;
    }
    if (G.state !== 'play') brief = null;
    // the last mission's win: the ending card comes before ALL MISSIONS COMPLETE
    if (on && G.state === 'win' && G.endT > 120 && tap('ok') && LEVELS.length > 1 && G.level + 1 >= LEVELS.length) {
      fireworks(22); card = { mode: 'ending', t: 0 }; G.state = 'story'; G.fade = 1; Snd.select(); return;
    }
    // ALL MISSIONS COMPLETE with every clue found: the dinosaur epilogue before the title
    if (on && G.state === 'allclear' && G.endT > 120 && tap('ok') && full()) {
      card = { mode: 'epilogue', t: 0 }; G.state = 'story'; G.fade = 1; Music.stop(); Snd.tone('sawtooth', 70, 40, 1.2, 0.12); return;
    }
    baseUpdate();
  };

  window.draw = function () {
    if (G.state === 'story' && card) {
      if (card.mode === 'ending') drawEnding(); else drawEpilogue();
      if (G.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + G.fade.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
      return;
    }
    if (G.state === 'play' && brief) {
      drawBrief();
      if (G.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + G.fade.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
      return;
    }
    baseDraw();
    try {
      if (G.state === 'missions') {
        R(0, 247, W, 20, 'rgba(10,10,30,0.7)');
        const w = 60 + CLUES.length * 17 + 46, x = Math.round(W / 2 - w / 2);
        const end = fileStrip(x, 250, true);
        text(count() + ' / ' + CLUES.length, end + 6, 254, count() === CLUES.length ? GOLD : '#c8cde0', 1, 'left', null);
      } else if (G.state === 'win' && LEVELS[G.level] === LV && G.endT > 100) {
        const i = G.level, pop = G.endT < 112 ? 2 : 1;
        panel(352, 146, 120, 46);
        text('CLUE FOUND!', 412, 150, GOLD, 1, 'center');
        ctx.save(); ctx.translate(358 + 7, 166 + 7); ctx.scale(pop, pop); clueIcon(i, -7, -7, true); ctx.restore();
        text(CLUES[i], 376, 166, PAPER, 1, 'left');
        text('CASE FILE ' + count() + ' / ' + CLUES.length, 376, 179, DIM, 1, 'left', null);
      } else if (G.state === 'allclear' && !full() && G.endT > 60) {
        R(0, 236, W, 11, 'rgba(10,10,30,0.7)');
        text('FIND ALL 7 CLUES TO SEE WHERE MEGA OGGLE WENT!', W / 2, 238, MINT, 1, 'center');
      }
    } catch (err) { errorOnce(err); }
  };

  return { get enabled() { return on; }, set enabled(v) { on = !!v; if (!on) { brief = null; card = null; } }, CLUES, BRIEF, count, full, briefing: () => brief, card: () => card, clueIcon };
})();
