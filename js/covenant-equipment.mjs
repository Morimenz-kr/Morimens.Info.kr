import {covenantMainValue} from './covenant-stats.mjs';
// One slot model for the shared party editor and the damage adapter.
export function covenantSlots(catalog,person){
 const legacyMatch=catalog.suits.find(s=>s.name===person.contract||s.id===Number(person.contract));
 if(person.contractSlots==null&&person.contractId==null&&person.contract&&!['미장착','장착 안 함'].includes(person.contract)&&!legacyMatch)throw Error('비밀계약의 세트를 다시 선택하세요.');
 const legacy=person.contractId!=null?Number(person.contractId):legacyMatch?.id||0;
 const slots=person.contractSlots??Array(6).fill(legacy);
 if(!Array.isArray(slots)||slots.length!==6||slots.some(id=>!Number.isSafeInteger(id)||id!==0&&!catalog.suits.some(s=>s.id===id)))throw Error('비밀계약의 부위별 세트를 다시 선택하세요.');
 return [...slots];
}
export function covenantSets(catalog,person){
 const counts=new Map();for(const id of covenantSlots(catalog,person))if(id)counts.set(id,(counts.get(id)||0)+1);
 return [...counts].map(([id,count])=>({id,count}));
}
// The first choice initializes an empty contract; later choices replace one slot.
export function selectCovenantSet(slots,setId,position=null){
 if(!Array.isArray(slots)||slots.length!==6||!Number.isSafeInteger(setId)||setId<0||position!=null&&(!Number.isInteger(position)||position<1||position>6))throw Error('비밀계약 부위 선택을 확인하세요.');
 if(position==null||setId&&slots.every(id=>id===0))return Array(6).fill(setId);
 return slots.map((id,i)=>i===position-1?setId:id);
}
// Legacy part flags migrate once to the contract-wide binding state.
export function covenantBound(person){
 return typeof person.contractBound==='boolean'?person.contractBound:!!person.trinkets?.some(p=>p.bound);
}
export function equippedCovenantParts(catalog,person){
 const slots=covenantSlots(catalog,person);
 return (person.trinkets||[]).filter(p=>slots[p.position-1]&&p.main).map(p=>({...p,bound:covenantBound(person)}));
}

// Static equipment totals; triggered six-piece states remain in the battle engine.
export function covenantAttributeTotals(catalog,person){
 const totals={};const add=(id,value)=>{if(!Number.isFinite(value))throw Error('비밀계약 옵션 수치를 확인하세요.');totals[id]=Number(((totals[id]||0)+value).toFixed(8));};
 for(const part of equippedCovenantParts(catalog,person)){
  add(part.main,covenantMainValue(part));
  for(const sub of part.sub||[])add(sub.id,Number(sub.value));
 }
 for(const set of covenantSets(catalog,person))for(const effect of catalog.suits.find(s=>s.id===set.id).effects||[]){
  if(effect.type==='CommonAttr'&&set.count>=effect.num)for(let i=0;i<effect.params.length;i+=2)add(effect.params[i],effect.params[i+1]);
 }
 return totals;
}
