export const FLAME_SOURCE_TID=77913;
export function hasFlameSource(party){
 return party.some(member=>Number(typeof member==='object'?member.id:member)===FLAME_SOURCE_TID);
}
export function flameOverride(party,choice){
 if(!hasFlameSource(party)||choice==null||choice==='자동')return undefined;
 const levels={'없음':0,'1단계':1,'2단계':2,'3단계':3};
 if(!Object.hasOwn(levels,choice))throw Error('활염 단계를 다시 선택하세요.');
 return levels[choice];
}
