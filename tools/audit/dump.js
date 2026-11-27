(function(){
  const out = LEVELS.map((L,i)=>{
    const cnt = a => { const m={}; (a||[]).forEach(s=>{m[s.t||s.k||s.kind||s.item]=(m[s.t||s.k||s.kind||s.item]||0)+1}); return m; };
    return { n:i+1, mission:L.mission, title:L.title, end:L.end, sections:(L.sections||[]).map(s=>s.x+':'+s.name),
      spawnN:(L.spawns||[]).length, spawns:cnt(L.spawns),
      locks:(L.locks||[]).map(k=>({at:k.at,boss:!!k.boss,waves:k.waves.length,types:cnt(k.waves)})),
      pows:(L.pows||[]).map(p=>p.x+':'+p.item+':'+(p.kind||'human')),
      props:cnt(L.props), music:L.music, bossMusic:L.bossMusic, intro:!!L.intro, freedLabel:L.freedLabel, startText:L.startText,
      hasScene: !!L.updateScene };
  });
  console.warn('DUMP'+JSON.stringify(out));
})();
