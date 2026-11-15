// Rates must be loaded from the verified client extraction; no uniform fallback.
export const covenantRollOptions=['critRate','critDamage','domainMastery','damageAmp','madnessRegen','silverCharge','blackSealDrop','deathResist'];
let rollData;
export function setCovenantRollRates(data){
 if(data?.schema!==1||data.positions?.length!==6||data.levels?.length!==8)throw Error('전사 확률 자료를 확인하세요.');
 const validWeight=r=>Number.isFinite(r.weight)&&r.weight>0;
 for(const [i,p]of data.positions.entries())if(p.position!==i+1||p.attributes?.length!==8||new Set(p.attributes.map(r=>r.option)).size!==8||p.attributes.some(r=>!covenantRollOptions.includes(r.option)||!validWeight(r)))throw Error('부위별 전사 확률 자료를 확인하세요.');
 if(data.levels.some((r,i)=>r.level!==i+1||!validWeight(r)))throw Error('전사 레벨 확률 자료를 확인하세요.');
 if(!data.costs||['gold','seals','lock1Fragments','lock1Quills','lock2Quills','maxLocks'].some(key=>!Number.isInteger(data.costs[key])||data.costs[key]<0)||data.costs.maxLocks!==2)throw Error('전사 비용 자료를 확인하세요.');
 rollData=structuredClone(data);
}
function rates(){if(!rollData)throw Error('검증된 전사 확률 자료를 먼저 불러오세요.');return rollData;}
function sampleWeighted(rows,random){
 const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('전사 난수 범위를 확인하세요.');
 let cursor=value*rows.reduce((sum,r)=>sum+r.weight,0);
 for(const row of rows){if(cursor<row.weight)return row;cursor-=row.weight;}
 return rows.at(-1);
}
export function rerollCovenantSubstats(substats,{position=1,random=Math.random,lockedIndexes=null}={}){
 const data=rates(),attributes=data.positions.find(p=>p.position===position)?.attributes;
 if(!attributes)throw Error('전사 부위를 확인하세요.');
 const locked=new Set(lockedIndexes??substats.flatMap((s,i)=>s.locked&&covenantRollOptions.includes(s.option)?[i]:[]));
 return substats.map((s,i)=>locked.has(i)?{...s}:{option:sampleWeighted(attributes,random).option,level:sampleWeighted(data.levels,random).level,locked:false});
}
export function covenantRerollCost(lockedCount,mode='fragment'){
 const c=rates().costs;if(!Number.isInteger(lockedCount)||lockedCount<0||lockedCount>c.maxLocks)throw Error('전사 잠금 개수를 확인하세요.');
 return{gold:c.gold,seals:c.seals,fragments:lockedCount===1&&mode!=='quill'?c.lock1Fragments:0,quills:lockedCount===2?c.lock2Quills:lockedCount===1&&mode==='quill'?c.lock1Quills:0};
}

// Solve the small bipartite matching instead of assigning broad goals first.
// When equally many goals match, preserve the rarer (higher-level) goals.
export function matchCovenantGoals(substats,goals){
 let best=[],bestWeight=-1;
 const visit=(goalIndex,used,pairs,weight)=>{
  if(goalIndex===goals.length){if(pairs.length>best.length||pairs.length===best.length&&weight>bestWeight){best=pairs.slice();bestWeight=weight;}return;}
  const goal=goals[goalIndex];
  for(let index=0;index<substats.length;index++)if(!used.has(index)&&substats[index].option===goal.option&&substats[index].level>=goal.level){
   used.add(index);pairs.push({goalIndex,substatIndex:index});visit(goalIndex+1,used,pairs,weight+goal.level);pairs.pop();used.delete(index);
  }
  visit(goalIndex+1,used,pairs,weight);
 };
 visit(0,new Set(),[],0);return best;
}

export function covenantGoalsMet(substats,goals){return matchCovenantGoals(substats,goals).length===goals.length;}

export function rollCovenantTowardGoals(substats,goals,{random=Math.random,maxLocks=2,position=1}={}){
 const locked=matchCovenantGoals(substats,goals).sort((a,b)=>goals[b.goalIndex].level-goals[a.goalIndex].level).slice(0,maxLocks).map(p=>p.substatIndex);
 return {lockedCount:locked.length,substats:rerollCovenantSubstats(substats,{position,random,lockedIndexes:locked}).map(s=>({...s,locked:false}))};
}
