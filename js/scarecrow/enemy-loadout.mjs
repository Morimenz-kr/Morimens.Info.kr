// Resolve only published D-Zone records. Display text is never an identity key.
export function resolveDzoneEnemy(data,{period,wave,alert,tid}){
 if(data.period!==period)throw Error('융재금구 기수를 확인하세요.');
 const zone=data.waves.find(w=>w.wave===wave),difficulty=zone?.alerts.find(a=>a.alert===alert);
 const monster=zone?.monsters.find(m=>m.tid===tid)||zone?.summonDefinitions?.find(m=>m.tid===tid);
 const stats=difficulty?.monsters.find(m=>m.tid===tid);
 if(!monster||!stats||![stats.hp,stats.attack,stats.defense].every(Number.isFinite)||stats.hp<=0)throw Error('이 적의 능력치를 확인하세요.');
 const image=[monster.webImage,monster.portrait,monster.icon,monster.image].find(p=>/^images\//.test(p||''))||'';
 return {tid,name:monster.nameKo,image,level:stats.level,hp:stats.hp,maxHp:stats.hp,attack:stats.attack,defense:stats.defense,shield:0,vulnerable:0,weakness:0,base:{hp:stats.hp,maxHp:stats.hp,attack:stats.attack,defense:stats.defense},source:{period,wave,alert,stageId:difficulty.stageId}};
}
export function validateEnemies(enemies){
 if(!Array.isArray(enemies)||enemies.length<1||enemies.length>7)throw Error('적은 1~7명을 선택하세요.');
 for(const e of enemies)if(!Number.isSafeInteger(e.tid)||e.tid<=0)throw Error('적을 다시 선택하세요.');
}
