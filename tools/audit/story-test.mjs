// Story flow check: node tools/audit/story-test.mjs [outDir]  (RR_GAME = the game folder; RR_HTML = a built
// index.html to check instead of src/)
import {boot} from '../mission4/runtime.mjs';
const out=(process.argv[2]||'tools/audit/shots')+'/';
const e=boot(1,process.env.RR_HTML||null),g=e.get,G=g('G'),S=g('STORY');let fails=0;
const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++;};
const enter=()=>{e.step(1,['enter']);e.step(1,[]);};
const N=S.CLUES.length,LAST=g('LEVELS.length');
ok(N===8&&LAST===8&&g('LEVELS[7].title')==='DINOSAUR VALLEY','eight missions, eight clues (the last: '+S.CLUES[N-1]+')');
// mission select with 3 clues found
G.rec={0:{stars:3,best:1},1:{stars:2,best:1},2:{stars:1,best:1}};
G.state='missions';G.level=2;e.step(5);e.shot(out+'story-missions.png');
ok(S.count()===3,'the case file counts missions won (3)');
// briefing from the hero select
G.state='select';enter();
ok(G.state==='play'&&S.briefing()&&S.briefing().i===2,'Enter on hero select opens the Mission 3 briefing');
const x0=G.p.x,t0=G.time;e.step(200);e.shot(out+'story-brief3.png');
ok(G.time===t0&&G.p.x===x0,'the mission waits under the briefing');
enter();ok(G.state==='play'&&!S.briefing(),'Enter closes the briefing');
e.step(30);ok(G.time>t0||G.intro,'the mission (or its intro) runs after the briefing');
// a win shows the clue
g('devStart')({level:3,x:5800,god:true});g('toWin')();e.step(130);e.shot(out+'story-win3.png');
ok(G.state==='win','win screen');
enter();ok(G.state==='play'&&G.level===3&&S.briefing()&&S.briefing().i===3,'Enter on the Mission 3 win: Mission 4 briefing');
e.step(220);e.shot(out+'story-brief4.png');enter();
// every briefing draws
for(let i=0;i<N;i++){G.state='play';g('startMission')(i);e.step(260);e.shot(out+'story-brief'+(i+1)+'.png');ok(S.briefing()&&S.briefing().i===i,'briefing '+(i+1)+' draws');enter();}
// Mission 7's win: the tracker's trail, one line at a time, then Mission 8's briefing
G.rec={};g('devStart')({level:7,x:10100,god:true});g('toWin')();e.step(130);
enter();ok(G.state==='story'&&S.card().mode==='bridge','Enter on the Mission 7 win: the trail to the valley');
e.step(120);e.shot(out+'story-bridge-a.png');
ok(S.card().t<200,'the first line is still up after 2 s (it stays 3.5 s)');
e.step(260);ok(S.card()&&S.card().t>24+210,'the next line comes by itself');
e.shot(out+'story-bridge-b.png');
enter();e.step(5);ok(S.card()&&S.card().t>=24+420,'Enter: the last line');
enter();ok(G.state==='story','Enter right after a new line does nothing (no skipping by accident)');
e.step(30);e.shot(out+'story-bridge-c.png');enter();
ok(G.state==='play'&&G.level===7&&S.briefing()&&S.briefing().i===7,'Enter on the last line: Mission 8 with its briefing');
e.step(260);e.shot(out+'story-brief8.png');enter();ok(!S.briefing(),'Enter: the mission starts');
// Mission 8's win: the Master Switch is the clue; the ending card, then ALL MISSIONS COMPLETE
g('devStart')({level:8,x:7600,god:true});g('toWin')();e.step(130);e.shot(out+'story-win8.png');
ok(G.state==='win'&&G.rec[7]&&G.rec[7].stars>0,'Mission 8 win saves its stars (the eighth clue)');
enter();ok(G.state==='story'&&S.card().mode==='ending','Enter on the Mission 8 win: the ending card');
ok(g('Music.track')===g('TRACKS.dinodawn'),'the morning tune plays under it');
e.step(40);enter();ok(G.state==='story'&&S.card().t>=1e4,'Enter while it types: the whole message');
e.step(40);e.shot(out+'story-ending.png');enter();
ok(G.state==='allclear','Enter: ALL MISSIONS COMPLETE');
e.step(80);ok(g('Music.track')===g('TRACKS.victory'),'the victory tune plays under the fireworks');
e.step(50);e.shot(out+'story-allclear-missing.png');enter();
ok(G.state==='title','missing clues: Enter goes to the title (no CASE CLOSED)');
for(let i=0;i<N;i++)G.rec[i]={stars:1,best:0};
ok(S.full(),'eight missions won: the case file is full');
G.state='missions';G.level=7;e.step(5);e.shot(out+'story-missions-full.png');
g('devStart')({level:8,x:7600,god:true});g('toWin')();e.step(130);enter();e.step(40);enter();e.step(5);enter();
ok(G.state==='allclear','second run reaches ALL MISSIONS COMPLETE');
e.step(130);enter();ok(G.state==='story'&&S.card().mode==='epilogue','full case file: CASE CLOSED');
e.step(100);e.shot(out+'story-closed-a.png');enter();e.step(140);e.shot(out+'story-closed-b.png');enter();e.step(200);e.shot(out+'story-closed-c.png');
ok(G.state==='story','still on the last line');
enter();ok(G.state==='title','Enter: back to the title');
// with the story switched off the engine's own flow is untouched (Mission 7's win goes straight to Mission 8)
S.enabled=false;g('devStart')({level:7,x:10100,god:true});g('toWin')();e.step(130);enter();
ok(G.state==='play'&&G.level===7&&!S.briefing()&&!S.card(),'story off: Mission 7 win starts Mission 8, no cards');
S.enabled=true;
ok(!e.errors.length,'no errors '+e.errors.slice(0,3).join(' | '));
ok(!e.warnings.length,'no warnings '+e.warnings.slice(0,3).join(' | '));
console.log(fails?fails+' FAILED':'ALL OK');process.exit(fails?1:0);
