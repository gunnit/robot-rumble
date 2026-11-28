#!/usr/bin/env node
// Which lines of a mission did no test ever run? The test players never dodge, so everything that only happens to a
// player who does (a robot that misses, a ride left by choice) is run by nobody unless a test asks for it.
// Node writes down what ran (V8 block coverage) when NODE_V8_COVERAGE names a folder; this adds up every run in
// that folder and lists what is left, per file, with the line.
//
//   export RR_GAME=$PWD; mkdir -p tools/m8/work/cov
//   NODE_V8_COVERAGE=tools/m8/work/cov node tools/harness/harness.mjs sim --level 8 --seed 1 > /dev/null
//   NODE_V8_COVERAGE=tools/m8/work/cov node tools/m8/paths-test.mjs                (... as many runs as you like)
//   node tools/m8/coverage.mjs tools/m8/work/cov [level8]        (the second word: which src files, a RegExp)
//   node tools/m8/coverage.mjs tools/m8/work/cov level8 --all    (also functions that are only painters' helpers)
//
// A line listed here is not a fault: it is a line nobody has seen working. Read it, or write the test that runs it.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2], want = new RegExp(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'level8');
const GAME = process.env.RR_GAME || process.cwd();
if (!dir) { console.error('usage: node tools/m8/coverage.mjs <folder with coverage-*.json> [file RegExp]'); process.exit(2); }
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/^coverage-.*\.json$/.test(f.name)) files.push(p); } })(dir);
const ran = new Map();        // 'src/x.js' -> Uint8Array, one flag per character of the file: 1 = it ran in some run
let runs = 0;
for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  let any = false;
  for (const s of j.result) {
    // the harness names its scripts src/x.js, tools/mission4/runtime.mjs just x.js
    const b = /(?:^|\/)([\w.-]+\.js)$/.exec(s.url);
    if (!b || /node_modules|^node:/.test(s.url)) continue;
    const m = [null, 'src/' + b[1]];
    if (!want.test(m[1])) continue;
    const file = path.join(GAME, m[1]);
    if (!fs.existsSync(file)) continue;
    const len = fs.readFileSync(file, 'utf8').length;
    // this run: the count of the innermost range that holds each character (ranges come outer first)
    const c = new Int32Array(len).fill(-1);
    const fns = [...s.functions].sort((a, b) => a.ranges[0].startOffset - b.ranges[0].startOffset || b.ranges[0].endOffset - a.ranges[0].endOffset);
    for (const fn of fns) for (const r of fn.ranges) c.fill(r.count, Math.max(0, r.startOffset), Math.min(len, r.endOffset));
    let a = ran.get(m[1]); if (!a) ran.set(m[1], a = new Uint8Array(len));
    if (a.length !== len) { console.error(m[1] + ' changed between runs: start again with an empty folder'); process.exit(2); }
    for (let i = 0; i < len; i++) if (c[i] > 0) a[i] = 1;
    any = true;
  }
  if (any) runs++;
}
if (!ran.size) { console.error('no coverage of ' + want + ' under ' + dir); process.exit(2); }
console.log(runs + ' runs, ' + ran.size + ' files');
let total = 0, left = 0;
for (const [name, a] of [...ran].sort()) {
  const src = fs.readFileSync(path.join(GAME, name), 'utf8');
  // what counts: code, not comments or blank space
  const code = new Uint8Array(src.length);
  { let i = 0; while (i < src.length) {
      const ch = src[i], two = src.substr(i, 2);
      if (two === '//') { while (i < src.length && src[i] !== '\n') i++; }
      else if (two === '/*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; }
      else if (ch === "'" || ch === '"' || ch === '`') { const q = ch; code[i++] = 1; while (i < src.length && src[i] !== q) { if (src[i] === '\\') code[i++] = 1; code[i++] = 1; } code[i++] = 1; }
      else { if (!/\s/.test(ch)) code[i] = 1; i++; }
    } }
  const lineAt = []; { let n = 1; for (let i = 0; i < src.length; i++) { lineAt.push(n); if (src[i] === '\n') n++; } }
  const spans = [];
  let n = 0, miss = 0;
  for (let i = 0; i < src.length; i++) {
    if (!code[i]) continue;
    n++;
    if (a[i]) continue;
    miss++;
    const last = spans[spans.length - 1];
    // one span while nothing that ran lies between
    let joined = false;
    if (last) { joined = true; for (let k = last.end; k < i; k++) if (code[k] && a[k]) { joined = false; break; } }
    if (joined) last.end = i + 1; else spans.push({ start: i, end: i + 1 });
  }
  total += n; left += miss;
  console.log('\n' + name + ': ' + (100 - miss / n * 100).toFixed(1) + ' % of its code ran' + (spans.length ? ', never ran:' : ''));
  for (const s of spans) {
    const size = [...src.slice(s.start, s.end)].filter((_, k) => code[s.start + k]).length;
    if (size < 3) continue;                                   // a lone bracket
    const l0 = lineAt[s.start], l1 = lineAt[s.end - 1];
    const text = src.slice(s.start, s.end).replace(/\s+/g, ' ').trim();
    console.log('  ' + (l0 === l1 ? String(l0) : l0 + '-' + l1).padEnd(9) + (text.length > 150 ? text.slice(0, 147) + '...' : text));
  }
}
console.log('\nall: ' + (100 - left / total * 100).toFixed(1) + ' % ran (' + left + ' of ' + total + ' characters of code never ran)');
