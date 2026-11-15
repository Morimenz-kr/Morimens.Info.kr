import {covenantSubValue,covenantSubLevel,covenantCompletion} from './covenant-stats.mjs';
import {covenantAttributeTotals} from './covenant-equipment.mjs';
export {selectCovenantSet} from './covenant-equipment.mjs';

export const simulatorAttributeIds={critRate:18159,critDamage:18105,domainMastery:18126,damageAmp:18142,madnessRegen:22207,silverCharge:18139,blackSealDrop:18155,deathResist:18151};
const keys=Object.fromEntries(Object.entries(simulatorAttributeIds).map(([key,id])=>[id,key]));
export function simulatorPart(part,position,bound=false){
 return {position,main:simulatorAttributeIds[part.mainOption]||0,quality:'Orange',level:part.mainLevel,bound,
  sub:part.substats.map((s,slot)=>({...s,slot})).filter(s=>simulatorAttributeIds[s.option]).map((s,index)=>({id:simulatorAttributeIds[s.option],value:covenantSubValue(simulatorAttributeIds[s.option],s.level),...(s.slot!==index?{slot:s.slot}:{})}))};
}
export function simulatorEquipment(parts,{fallbackSetId=0,bound=false}={}){
 const contractSlots=parts.map(p=>p.setId??fallbackSetId);bound=!!bound&&contractSlots.some(Boolean);
 return {contractSlots,contractBound:bound,trinkets:parts.map((p,i)=>simulatorPart(p,i+1,bound))};
}
export function applyEditorEquipment(owner,parts){
 return parts.map((old,i)=>{
  const piece=owner.trinkets.find(p=>p.position===i+1);
  return {...old,setId:owner.contractSlots[i],mainOption:keys[piece?.main]||'none',mainLevel:piece?.level||0,
   substats:Array.from({length:3},(_,n)=>{const sub=piece?.sub?.find((s,index)=>(s.slot??index)===n);return{option:keys[sub?.id]||'none',level:covenantSubLevel(sub)||1,locked:!!owner.contractSlots[i]&&!!sub&&!!old.substats[n]?.locked};}),lastTouched:true};
 });
}
export function simulatorCompletion(parts,bound=false){return covenantCompletion(parts.flatMap((p,i)=>p.setId===0?[]:[simulatorPart(p,i+1,bound)]));}
export function simulatorTotals(parts,catalog,options){return covenantAttributeTotals(catalog,simulatorEquipment(parts,options));}
