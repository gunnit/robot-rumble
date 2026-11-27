// Story flow check: node tools/audit/story-test.mjs [outDir]  (RR_GAME = the game folder)
import {boot} from '../mission4/runtime.mjs';
const out=(process.argv[2]||'tools/audit/shots')+'/';
const e=boot(1),g=e.get,G=g('G'),S=g('STORY');let fails=0;
const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++;};
const enter=()=>{e.step(1,['enter']);e.step(1,[]);};
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
for(let i=0;i<7;i++){G.state='play';g('startMission')(i);e.step(260);e.shot(out+'story-brief'+(i+1)+'.png');ok(S.briefing()&&S.briefing().i===i,'briefing '+(i+1)+' draws');enter();}
// the last mission: ending card, then ALL MISSIONS COMPLETE, then (full file) the epilogue
G.rec={};g('devStart')({level:7,x:10100,god:true});g('toWin')();e.step(130);
enter();ok(G.state==='story'&&S.card().mode==='ending','Enter on the Mission 7 win: the ending card');
e.step(240);e.shot(out+'story-ending.png');enter();
ok(G.state==='allclear','Enter: ALL MISSIONS COMPLETE');
e.step(130);e.shot(out+'story-allclear-missing.png');enter();
ok(G.state==='title','missing clues: Enter goes to the title (no epilogue)');
for(let i=0;i<7;i++)G.rec[i]={stars:1,best:0};
g('devStart')({level:7,x:10100,god:true});g('toWin')();e.step(130);enter();e.step(240);enter();enter();
ok(G.state==='allclear','second run reaches ALL MISSIONS COMPLETE');
e.step(130);enter();ok(G.state==='story'&&S.card().mode==='epilogue','full case file: the dinosaur epilogue');
e.step(130);e.shot(out+'story-epilogue-a.png');e.step(150);e.shot(out+'story-epilogue-b.png');
enter();ok(G.state==='title','Enter: back to the title');
ok(!e.errors.length,'no errors '+e.errors.slice(0,3).join(' | '));
console.log(fails?fails+' FAILED':'ALL OK');process.exit(fails?1:0);
