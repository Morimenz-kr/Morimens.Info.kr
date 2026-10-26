const list=v=>Array.isArray(v)?v:[];
export function selectionOptions(request,state){
 const packs=list(request?.packList);
 const raw=packs.length?packs:list(request?.targetUids);
 const options=raw.map((value,i)=>{
  const id=packs.length?value.index:typeof value==='object'?value.uid:value;
  if(!Number.isSafeInteger(id))throw new Error('선택 후보를 확인할 수 없습니다.');
  const entity=typeof value==='object'?value:list(state.cards).find(c=>c.uid===id)||list(state.roles).find(r=>r.uid===id);
  return {id,entity,index:i+1,pack:packs.length>0};
 });
 if(new Set(options.map(o=>o.id)).size!==options.length)throw new Error('선택 후보가 중복되었습니다.');
 const min=Number(request.selectMinNum??request.minNum??1),max=Number(request.selectMaxNum??request.selectNum??1);
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min)throw new Error('선택 개수를 확인할 수 없습니다.');
 return {options,min,max,pack:packs.length>0};
}
export function selectionReply(request,state,ids){
 const {options,min,max,pack}=selectionOptions(request,state);
 if(new Set(ids).size!==ids.length||ids.length<min||ids.length>max||ids.some(id=>!options.some(o=>o.id===id)))throw new Error(`${min===max?min:`${min}~${max}`}개를 선택하세요.`);
 if(!Number.isSafeInteger(request.effectUid))throw new Error('현재 선택 요청을 확인할 수 없습니다.');
 return {op:'select',effectUid:request.effectUid,selectType:request.targetSelectType,[pack?'packIndexList':'targetUids']:ids};
}
export function renderBattleSelection({parent,state,working,act,skillName,roleName}){
 parent.replaceChildren();const request=state.waitingData||{};
 if(!state.waiting||request.isReliveChoose)return;
 const {options,min,max}=selectionOptions(request,state);if(!options.length)return;
 const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${min===max?min:`${min}~${max}`}개를 선택하세요`;field.append(legend);
 const grid=document.createElement('div');grid.className='combat-grid';field.append(grid);const selected=new Set();
 const submit=document.createElement('button');submit.type='button';submit.textContent='선택 완료';
 const refresh=()=>{submit.disabled=working||selected.size<min||selected.size>max;};
 for(const option of options){
  const entity=option.entity,button=document.createElement('button');button.type='button';button.className='battle-choice';button.disabled=working;button.setAttribute('aria-pressed','false');button.dataset.selectionId=String(option.id);
  const label=s=>{const values=list(s.descArgs?.curValues);return skillName(s.tid)+(values.length?` (${values.join(', ')})`:'');};
  button.textContent=option.pack?list(entity.keeperSkillInfos??entity.cardInfos).map(label).join(' · ')||`선택지 ${option.index}`:entity?.roleType?roleName(entity):entity?.tid?label(entity):`선택지 ${option.index}`;
  button.addEventListener('click',()=>{if(selected.has(option.id))selected.delete(option.id);else if(selected.size<max)selected.add(option.id);button.setAttribute('aria-pressed',String(selected.has(option.id)));refresh();});grid.append(button);
 }
 const actions=document.createElement('div');actions.className='actions';actions.append(submit);field.append(actions);
 submit.addEventListener('click',()=>act(selectionReply(request,state,[...selected])));
 if(request.cancelable){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='선택 취소';cancel.disabled=working;cancel.addEventListener('click',()=>act({op:'cancelSelect',effectUid:request.effectUid}));actions.append(cancel);}
 parent.append(field);refresh();
}
