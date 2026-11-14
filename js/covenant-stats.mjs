// res160: AwakerTrinketDataUtils.GetTrinketCompletionNumber/Rate/SuitCompletionRate.
// Completion describes the entered attributes; it is never a damage multiplier.
const MAIN=[4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10];
export const covenantEquivalency={18159:0.4,18105:0.6,22207:0.2,18151:1.4,18126:1,18139:0.6,18155:0.3,18142:0.4};
export const covenantLevelLimits={Orange:12,Purple:9,Blue:6};
export const covenantSubCount=3;
export const covenantSubMaxLevel=8;
const MAX=6*(10+covenantSubCount*4);
export function covenantSubValue(id,level){
 if(!covenantEquivalency[id]||!Number.isInteger(level)||level<1||level>covenantSubMaxLevel)throw Error('비밀계약 부옵션 레벨은 1~8로 설정하세요.');
 return Number((covenantEquivalency[id]*level/2).toFixed(8));
}
export function covenantSubLevel(sub){
 const level=Number(sub?.value)*2/covenantEquivalency[sub?.id];
 return Number.isFinite(level)&&Math.abs(level-Math.round(level))<1e-7&&level>=1&&level<=8?Math.round(level):null;
}
export function validateCovenantParts(parts){
 for(const part of parts){
  const sub=part.sub||[];
  if(sub.length>covenantSubCount)throw Error('비밀계약 부옵션은 3개입니다. 이전 저장값을 비밀계약 설정에서 수정하세요.');
  if(sub.some(s=>covenantSubLevel(s)==null))throw Error('비밀계약 부옵션을 Lv.1~8로 다시 설정하세요.');
 }
 return parts;
}
export function covenantNumber(piece){
 if(!piece?.main)return 0;
 if(!Number.isInteger(piece.level)||MAIN[piece.level]==null)throw Error('비밀계약 강화 단계를 확인하세요.');
 return MAIN[piece.level]+(piece.sub||[]).reduce((sum,s)=>sum+(covenantEquivalency[s.id]?Number(s.value)/covenantEquivalency[s.id]:0),0);
}
export function covenantCompletion(pieces){
 // Round only after aggregating all six pieces, exactly as the original helper.
 return Math.floor(pieces.reduce((sum,p)=>sum+covenantNumber(p),0)/MAX*1000)/10;
}
export function covenantMainValue(piece){
 if(!piece?.main||MAIN[piece.level]==null)return 0;
 const raw=MAIN[piece.level]*covenantEquivalency[piece.main];
 return piece.bound?Math.floor(raw*1.5*10+1e-9)/10:raw;
}
