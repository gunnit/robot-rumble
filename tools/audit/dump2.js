(function(){const o={};for(const k in ENEMY_TYPES){const t=ENEMY_TYPES[k];const e={type:k,x:300,y:200,facing:-1};let hp=null;try{if(t.make){t.make(e,{t:k,x:300});hp=e.hp}}catch(err){hp='err'}o[k]={hp:hp??t.hp,boss:!!(t.boss||e.boss),fly:!!(t.fly||t.flyer)};}
console.warn('DUMP'+JSON.stringify(o));})();
