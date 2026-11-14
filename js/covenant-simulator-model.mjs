import {covenantSubValue,covenantSubLevel,covenantCompletion} from './covenant-stats.mjs';
import {covenantAttributeTotals} from './covenant-equipment.mjs';

export const simulatorAttributeIds={critRate:18159,critDamage:18105,domainMastery:18126,damageAmp:18142,madnessRegen:22207,silverCharge:18139,blackSealDrop:18155,deathResist:18151};
const keys=Object.fromEntries(Object.entries(simulatorAttributeIds).map(([key,id])=>[id,key]));
export function simulatorPart(part,position,bound=false){
 return {position,main:simulatorAttributeIds[part.mainOption]||0,quality:'Orange',level:part.mainLevel,bound,
  sub:part.substats.filter(s=>simulatorAttributeIds[s.option]).map(s=>({id:simulatorAttributeIds[s.option],value:covenantSubValue(simulatorAttributeIds[s.option],s.level)}))};
}
export function simulatorEquipment(parts,{fallbackSetId=0,bound=false}={}){
 return {contractSlots:parts.map(p=>p.setId??fallbackSetId),contractBound:bound,trinkets:parts.map((p,i)=>simulatorPart(p,i+1,bound))};
}
export function applyEditorEquipment(owner,parts){
 return parts.map((old,i)=>{
  const piece=owner.trinkets.find(p=>p.position===i+1);
  return {...old,setId:owner.contractSlots[i],mainOption:keys[piece?.main]||'none',mainLevel:piece?.level||0,
   substats:Array.from({length:3},(_,n)=>({option:keys[piece?.sub[n]?.id]||'none',level:covenantSubLevel(piece?.sub[n])||1,locked:!!old.substats[n]?.locked})),lastTouched:true};
 });
}
export function simulatorCompletion(parts,bound=false){return covenantCompletion(parts.map((p,i)=>simulatorPart(p,i+1,bound)));}
export function simulatorTotals(parts,catalog,options){return covenantAttributeTotals(catalog,simulatorEquipment(parts,options));}
