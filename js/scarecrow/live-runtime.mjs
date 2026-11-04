import {renderCovenantParts} from '../covenant-parts.mjs';
import {tentacleCapacity} from './tentacle-state.mjs';
import {covenantSlots,covenantSets,equippedCovenantParts,covenantBound,covenantAttributeTotals} from './covenant-equipment.mjs';
import {covenantCompletion,covenantMainValue,covenantSubCount,covenantSubLevel,covenantSubValue,validateCovenantParts} from './covenant-stats.mjs';
import {makeLiveDamageInput} from './live-damage-input.mjs';
import {renderBattleSelection,selectionOptions} from './battle-selection.mjs';
const arr=v=>Array.isArray(v)?v:[];
export async function createLiveRuntime(){
 const [data,catalog]=await Promise.all(['live-data.json','catalog.json'].map(p=>fetch(p).then(r=>{if(!r.ok)throw Error('계산 데이터를 불러오지 못했습니다.');return r.json();})));
 const worker=new Worker(new URL('worker.js',import.meta.url),{type:'module'}),pending=new Map();let serial=0,initialization;
 worker.onmessage=({data:message})=>{const job=pending.get(message.id);if(!job)return;pending.delete(message.id);message.error?job.reject(Error(message.error)):job.resolve(message.result);};
 worker.onerror=()=>{for(const job of pending.values())job.reject(Error('계산 엔진을 다시 불러와 주세요.'));pending.clear();initialization=null;};
 const rawCall=(kind,input)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,kind,input:input==null?null:JSON.parse(JSON.stringify(input))});});
 const cache=new Map();
 const call=async(kind,input)=>{
  initialization??=rawCall('initialize');await initialization;
  if(!['build','team'].includes(kind))return rawCall(kind,input);
  const key=kind+JSON.stringify(input);if(!cache.has(key))cache.set(key,rawCall(kind,input));
  return structuredClone(await cache.get(key));
 };
 let ui,version=0,timer,lastInput,lastResult,lastPreparation;
 const status=text=>{if(ui)ui.root.querySelector('footer').textContent=text;};
 const readState=()=>{
  const source=ui.state,copy=structuredClone(source);
  // Automatic display values must not turn into permanent overrides after rendering.
  if(Array.isArray(source.explicit))for(const key of ['power','weakness','amp','teamHp','teamMaxHp','teamShield','key','tentacles','tentacleLimit','tempTentacles','tentacleDamage','furnace','furnaceMax','furnaceHeal','prism','tentacleGathering','oceanDefenceCooldown','oceanFuryCooldown','dimensionCooldown','furnaceCooldown','spaceCapacity'])if(!source.explicit.includes(key))copy[key]=null;
  if(!source.explicit.includes('person.breedingCharge'))delete copy.breedingCharge;
  for(let i=0;i<copy.enemies.length;i++)for(const key of ['hp','maxHp','attack','shield','defense','vulnerable','weakness']){
   if(!source.explicit.includes('enemy.'+i+'.'+key)){if(source.enemies[i].base&&key in source.enemies[i].base)copy.enemies[i][key]=source.enemies[i].base[key];else if(!['hp','maxHp'].includes(key))copy.enemies[i][key]=null;}
  }
  copy.relicIds=(source.relics||[]).map(i=>data.relics[i]?.id).filter(Boolean);
  copy.keyCapacity=ui.realmContext().keyEnergyCapacity;
  copy.mechanicEdited=source.mechanicEdited||[];
  return copy;
 };
 async function input(){
  for(const item of ui.state.customStates){const definition=data.stateSchemas[item.sourceTid]?.options.find(s=>s.id===item.id);if(!definition)throw Error('현재 효과의 출처를 확인하세요.');if(item.layers!=null&&(!Number.isSafeInteger(item.layers)||item.layers<0||definition.max!=null&&item.layers>definition.max))throw Error('현재 효과의 중첩 범위를 확인하세요.');if(item.partialParams)throw Error('현재 효과의 효과량을 모두 입력하거나 비워 주세요.');}
  const mechanics=ui.people().flatMap(p=>ui.mechanicFields(p.id).map(f=>({stateId:f.stateId,layers:ui.state.mechanics[p.id]?.[f.key]??0,sourceTid:p.id,...(f.scope==='team'?{owner:'team'}:{ownerTid:p.id})})));
  return makeLiveDamageInput({catalog,call,state:readState(),people:ui.people(),person:ui.person(),card:ui.card(),mechanics});
 }
 function acceptAutomatic(result){
  const state=ui.state,initial=result.initial,team=arr(initial.roles).find(r=>r.roleType===3),props=initial.realmProperties||{};
  const auto=(key,value)=>{if(!state.explicit.includes(key)&&value!=null)state[key]=value;};
  if(team){state.teamHp=team.properties.hp;state.teamMaxHp=team.properties.max_hp;state.teamShield=team.properties.block;}
  auto('key',100*(props.keeper_energy||0)/(props.max_keeper_energy||1000));
  auto('tentacleLimit',tentacleCapacity(props));auto('tentacles',(props.permanent_tentacle_count||0)+(props.battle_tentacle_count||0));auto('tempTentacles',props.bout_tentacle_count||0);auto('spaceCapacity',props.dimension_slot||5);
  auto('tentacleDamage',initial.tentacleDamage);auto('furnace',props.scarlet_blood_count||0);auto('furnaceMax',props.max_scarlet_blood_count||200);auto('amp',props.enhance_per||0);
  const teamStates=arr(team?.states);auto('power',teamStates.filter(s=>s.stateId===2900).reduce((n,s)=>n+s.layer,0));auto('weakness',teamStates.filter(s=>s.stateId===3469).reduce((n,s)=>n+s.layer,0));auto('furnaceHeal',teamStates.filter(s=>s.stateId===35501).reduce((n,s)=>n+s.layer,0));
  for(const [key,id] of [['tentacleGathering',22067],['oceanDefenceCooldown',120351],['oceanFuryCooldown',120354],['dimensionCooldown',80398],['furnaceCooldown',80399]])auto(key,teamStates.filter(s=>s.stateId===id).reduce((n,s)=>n+s.layer,0));
  for(const [i,enemy] of arr(initial.roles).filter(r=>r.camp===2).entries()){
   const current=state.enemies[i];if(!current)continue;
   for(const [key,prop] of [['hp','hp'],['maxHp','max_hp'],['defense','def'],['attack','atk'],['shield','block']])current[key]=enemy.properties[prop]||0;
   for(const [key,id] of [['vulnerable',2934],['weakness',3469]])if(!state.explicit.includes('enemy.'+i+'.'+key))current[key]=arr(enemy.states).filter(s=>s.stateId===id).reduce((n,s)=>n+s.layer,0);
  }
  for(const owner of ui.people())for(const field of ui.mechanicFields(owner.id)){
   if(state.mechanicEdited?.includes(owner.id+':'+field.stateId))continue;
   const role=field.scope==='team'?team:arr(initial.roles).find(r=>r.tid===owner.id);
   state.mechanics[owner.id][field.key]=arr(role?.states).filter(s=>s.stateId===field.stateId).reduce((n,s)=>n+s.layer,0);
  }
  const current=arr(initial.cards).find(c=>c.uid===1000000);if(current&&!ui.card().costEdited)ui.card().calculatedCost=current.cost;
 }
 function actionTargets(input,preview){
  const roles=arr(preview.initial.roles),enemies=roles.filter(r=>r.camp===2&&r.properties.hp>0),p=ui.person(),card=ui.card();
  const target=card.target,actor=roles.find(r=>r.tid===p.id),team=roles.find(r=>r.roleType===3);
  let targets=target==='FrontEnemy'?[enemies[0]?.uid]:['AllEnemy','AllEnemy2'].includes(target)?enemies.map(r=>r.uid):target==='CmdCaster'?[actor?.uid]:target==='PlayerRole'?[team?.uid]:null;
  for(const action of input.actions){if(action.op==='ulti'){action.roleUid=actor?.uid;if(p.rage==null){const property=input.damage.properties.find(v=>v.owner==='actor'&&v.key==='ulti_energy');if(property)property.value=preview.initial.ultimateCosts[String(actor.uid)];}}if(['ulti','card'].includes(action.op)&&targets)action.targetUids=targets.filter(Boolean);}
 }
 async function prepare(){
  if(!ui)return;const revision=version;status('파티 능력치 계산 중…');
  try{const built=await input(),preview=await call('calculator',{...built.input,actions:[]});if(revision!==version)return;acceptAutomatic(preview);ui.render();status('카드를 고른 뒤 피해를 계산하세요.');}
  catch(error){if(revision===version)status('준비 실패 · '+friendly(error));}
 }
 function friendly(error){const text=String(error?.message||error);console.warn('ScareCrow calculator:',text);return text.includes('장비')||text.includes('명륜')||text.includes('확인')?text:'현재 카드·상태 조건을 확인해 주세요.';}
 async function finishEmptySelections(result,input){
  for(let count=0;result.current.waiting;count++){
   const request=result.current.waitingData;if(request.isReliveChoose||selectionOptions(request,result.current).options.length)return result;
   if(count>=10)throw Error('카드 선택 조건을 확인하세요.');
   // Original selection command accepts an empty result when no candidate exists.
   // This invokes the card's original fallback (e.g. Hamelin's extra hits).
   input.actions.push({op:'select',effectUid:request.effectUid,selectType:request.targetSelectType,targetUids:[]});
   result=await call('calculator',input);
  }
  return result;
 }
 function outcome(result,input){
  lastInput=input;lastResult=result;acceptAutomatic(lastPreparation??result);
  if(result.current.waiting){ui.state.calculation=null;ui.state.result=false;ui.render();ui.open('live-selection');status('효과의 선택을 마치면 계산합니다.');return;}
  const rejected=arr(result.steps).find(step=>!step.accepted);if(rejected)throw Error('카드 사용 조건을 확인하세요. 산출력·광기·봉인 상태에 따라 사용할 수 없는 카드가 있습니다.');
  const enemies=arr(result.initial.roles).filter(r=>r.camp===2),current=arr(result.current.roles);
  const targets=enemies.map(r=>{const after=current.find(x=>x.uid===r.uid);return{uid:r.uid,damage:r.properties.hp-(after?.properties.hp??r.properties.hp)};});
  ui.state.calculation={total:result.damage.total,targets,critical:arr(result.damage.hits).some(h=>h.critical),body:result.damage.body,additional:result.damage.additional,blocked:result.damage.blocked};
  ui.state.result=true;delete ui.root.dataset.calculationError;ui.root.dataset.lastDamageInput=JSON.stringify(input);ui.root.dataset.lastDamage=JSON.stringify(result.damage);if(document.body.dataset.view==='damage')ui.open('card');else ui.close();ui.render();status('계산 완료');
 }
 const siteContracts=await fetch('data/covenant_list.json').then(r=>r.json()),siteParts=await fetch('data/covenant_parts.json').then(r=>r.json());
 const siteWheels=await fetch('data/wheel_list.json').then(r=>r.json()),siteKeys=await fetch('data/silverkey_list.json').then(r=>r.json());
 const live={data,catalog,call,siteWheels,siteKeys,
  removeEnemy(index){if(ui.state.enemies.length<=1)return;ui.state.enemies.splice(index,1);ui.state.explicit=ui.state.explicit.flatMap(k=>{const match=k.match(/^enemy\.(\d+)\.(.+)$/);if(!match)return [k];const i=Number(match[1]);return i===index?[]:['enemy.'+(i>index?i-1:i)+'.'+match[2]];});ui.state.customStates=ui.state.customStates.flatMap(s=>s.owner!=='target'?[s]:(s.targetIndex??0)===index?[]:[{...s,targetIndex:(s.targetIndex??0)>index?s.targetIndex-1:s.targetIndex??0}]);live.persistEnemies?.();ui.invalidate();ui.close();ui.render();ui.root.querySelector('[data-enemy-index="'+Math.min(index,ui.state.enemies.length-1)+'"]')?.focus();},
  async preparedInput(){return (await input()).input;},
  snapshot(){return structuredClone({state:ui.state,people:ui.people(),card:ui.card()});},
  attach(context){ui=context;ui.state.explicit=[];ui.state.mechanicEdited=[];ui.state.customStates=[];ui.state.accountLevel=60;ui.state.chapter='성신편';ui.state.keeperId=0;ui.state.relics=[];ui.state.turn=1;ui.state.used=0;
   ui.state.spaceEntries=[];ui.state.otherCards=[];ui.state.spaceCards=0;for(const p of data.people)for(const c of p.cards)c.level=1;
   ui.state.keeperName='장착 안 함';for(const [i,e] of ui.state.enemies.entries())Object.assign(e,{tid:[149116,22308][i],name:data.enemies[i].name,image:data.enemies[i].image});ui.render();timer=setTimeout(prepare,0);
  },
  invalidate(){version++;clearTimeout(timer);if(ui){const ids=ui.state.partyIds;ui.state.customStates=ui.state.customStates.filter(s=>ids.includes(s.sourceTid)&&(!s.ownerTid||ids.includes(s.ownerTid)));ui.state.otherCards=(ui.state.otherCards||[]).filter(s=>ids.includes(s.ownerTid));ui.state.mechanicEdited=ui.state.mechanicEdited.filter(k=>ids.includes(Number(k.split(':')[0])));ui.state.spaceEntries=(ui.state.spaceEntries||[]).map(s=>s&&ids.includes(s.ownerTid)?s:null);ui.state.spaceCards=ui.state.spaceEntries.filter(Boolean).length;ui.state.calculation=null;delete ui.root.dataset.calculationError;timer=setTimeout(prepare,250);}},
  async calculate(){clearTimeout(timer);const revision=++version;status('카드 피해 계산 중…');
   try{const built=await input(),preview=await call('calculator',{...built.input,actions:[]});if(revision!==version)return;lastPreparation=preview;actionTargets(built.input,preview);const result=await finishEmptySelections(await call('calculator',built.input),built.input);if(revision!==version)return;outcome(result,built.input);}
   catch(error){if(revision!==version)return;ui.state.result=false;ui.render();status(friendly(error));ui.root.dataset.calculationError=String(error.message||error);}
  },
  selection(parent){renderBattleSelection({parent,state:lastResult.current,working:false,skillName:id=>catalog.skills[String(id)]?.name||'카드',roleName:r=>catalog.characters.find(c=>c.id===r.tid)?.name||'대상',act:async reply=>{
   const revision=version;try{const count=arr(lastResult.steps).length,input={...lastInput,actions:[...lastInput.actions.slice(0,count),reply,...lastInput.actions.slice(count)]};const result=await finishEmptySelections(await call('calculator',input),input);if(revision===version)outcome(result,input);}catch(error){status(friendly(error));}
  }});},
  changed(key,ownerId){
   if(!ui)return;
   if(key==='card.currentCost')ui.card().costEdited=true;
   const k=key.startsWith('enemy.')?'enemy.'+ui.enemyIndex()+'.'+key.slice(6):key;
   if(!ui.state.explicit.includes(k))ui.state.explicit.push(k);
   if(key.startsWith('mechanic.')){const [,id,name]=key.split('.'),field=ui.mechanicFields(Number(id)).find(f=>f.key===name);const identity=id+':'+field.stateId;if(!ui.state.mechanicEdited.includes(identity))ui.state.mechanicEdited.push(identity);}
   if(/^person\.refine[12]$/.test(key)){const slot=key.at(-1),ref=ui.root.querySelector('[data-field="'+key+'"]');if(Number(ref?.value)>0){const stack=ui.root.querySelector('[data-field="person.stack'+slot+'"]');if(stack)stack.value='3';}}
  },
  automatic(key){
   const k=key.startsWith('enemy.')?'enemy.'+ui.enemyIndex()+'.'+key.slice(6):key;ui.state.explicit=ui.state.explicit.filter(x=>x!==k);
   if(key.startsWith('mechanic.')){const [,id,name]=key.split('.'),field=ui.mechanicFields(Number(id)).find(f=>f.key===name);ui.state.mechanicEdited=ui.state.mechanicEdited.filter(x=>x!==id+':'+field.stateId);}
   if(key==='card.currentCost'){delete ui.card().currentCost;delete ui.card().costEdited;}
   if(key==='person.rage')delete ui.person().rage;
  },
  growth(parent,owner,mode='growth'){
   parent.classList.add('member-settings');
   const basic=parent.querySelector(':scope > .fields'),skills=parent.querySelector(':scope > .member-skills');
   const hero=document.createElement('div');hero.className='member-identity';
   const portrait=document.createElement('img');portrait.src=owner.art;portrait.alt='';
   const identity=document.createElement('div'),name=document.createElement('h2'),realm=document.createElement('p');name.textContent=owner.name;realm.textContent={chaos:'혼돈',aequor:'심해',caro:'혈육',ultra:'초차원'}[owner.realm]||'';identity.append(name,realm);hero.append(portrait,identity);
   parent.prepend(hero);
   const addSlider=(number,min,max)=>{
    number.min=String(min);number.max=String(max);number.step='1';
    const slider=document.createElement('input');slider.type='range';slider.min=number.min;slider.max=number.max;slider.step='1';slider.value=number.value;slider.setAttribute('aria-label',number.getAttribute('aria-label')+' 슬라이더');
    const controls=document.createElement('span');controls.className='member-slider';number.before(controls);controls.append(slider,number);
    slider.oninput=()=>{number.value=slider.value;number.dispatchEvent(new Event('input',{bubbles:true}));};
    number.addEventListener('input',()=>{slider.max=number.max;slider.value=number.value;});return slider;
   };
   if(mode==='growth'){
    const growth=document.createElement('section');growth.className='member-section member-basic';const heading=document.createElement('h3');heading.textContent='성장·돌파';growth.append(heading,basic);if(skills)growth.append(skills);parent.append(growth);
    for(const number of growth.querySelectorAll('input[type=number]'))addSlider(number,number.dataset.field==='person.level'||number.dataset.field?.startsWith('skill.')?1:0,Number(number.max));
    return;
   }
   let slots;try{slots=covenantSlots(catalog,owner);}catch{const error=document.createElement('p');error.textContent='비밀계약 부위 저장값을 확인하세요. 비밀계약 선택에서 다시 장착할 수 있습니다.';const reset=document.createElement('button');reset.textContent='비밀계약 다시 선택';reset.onclick=()=>live.requestPicker('contract');parent.append(error,reset);return;}
   const labels={crit:'크리티컬 확률',crit_damage:'크리티컬 피해',occupation_master:'영역 숙련',death_resist:'죽음 저항',basic_damage_per:'피해 증폭',blackcoin_upgrade_per:'검은 인장 획득률',keeper_energy_eff_2:'은열쇠 충전',ulti_energy_plus_3:'광기 충전'};
   const ids=[18159,18105,18126,18142,22207,18139,18155,18151],iconIds={18159:'008',18105:'007',18126:'002',18142:'004',22207:'003',18139:'005',18155:'001',18151:'006'};
   const attrName=id=>labels[data.equipmentMetadata.attributes[id]?.name]||'추가 속성',unit=id=>data.equipmentMetadata.attributes[id]?.percentage?'%':'';
   const attrIcon=id=>{const image=document.createElement('img');image.src='images/keyword-icons/original/ui_battle_white_buff_'+iconIds[id]+'.png';image.alt='';image.width=24;image.height=24;return image;};
   const options=document.createElement('section'),head=document.createElement('div');head.className='member-section-head';options.dataset.covenantEditor='';options.className='member-section member-covenants';const covenantTitle=document.createElement('h3');covenantTitle.textContent='비밀계약';head.append(covenantTitle);options.append(head);parent.append(options);
   const changeSet=document.createElement('button');changeSet.type='button';changeSet.className='member-set-change';changeSet.textContent='전체 세트 변경';changeSet.onclick=event=>{event.preventDefault();event.stopPropagation();live.requestPicker('contract');};head.append(changeSet);
   const reset=document.createElement('button');reset.type='button';reset.className='member-set-change';reset.textContent='전체 초기화';reset.setAttribute('aria-label','비밀계약 전체 초기화');reset.title='6부위 장착, 주옵션, 부옵션, 귀속을 모두 초기화합니다.';reset.disabled=!slots.some(Boolean)&&!owner.trinkets?.length&&!owner.contractBound;reset.onclick=()=>{owner.contractId=0;owner.contractSlots=Array(6).fill(0);owner.trinkets=[];owner.contractBound=false;owner.contract='미장착';ui.invalidate();ui.open('covenant');ui.root.querySelector('.member-covenants .member-set-change')?.focus({preventScroll:true});};head.append(reset);
   const sets=document.createElement('p');sets.className='member-set-summary';sets.textContent=covenantSets(catalog,owner).map(s=>catalog.suits.find(c=>c.id===s.id).name+' '+s.count+'개').join(' · ')||'장착 안 함';const summary=document.createElement('div');summary.className='member-contract-summary';summary.append(sets);options.append(summary);
   const completion=document.createElement('output');completion.setAttribute('aria-live','polite');completion.className='member-completion';summary.append(completion);
   const hex=document.createElement('div');hex.className='member-hex';const diagram=document.createElement('div');diagram.className='member-contract-diagram';const hint=document.createElement('p');const defaultHint='비밀계약을 장착한 뒤 부위를 눌러 주옵션과 부옵션을 설정하세요.';hint.textContent=defaultHint;hint.className='member-hex-hint';hint.setAttribute('role','status');diagram.append(hex,hint);
   const partGrid=document.createElement('div');partGrid.className='member-parts';partGrid.hidden=true;
   const overview=document.createElement('section');overview.className='member-contract-overview';const overviewTitle=document.createElement('h4');overviewTitle.textContent='비밀계약 능력치';const totals=document.createElement('dl');totals.className='contract-attribute-totals';const totalCells=new Map();
   for(const id of ids){const row=document.createElement('div'),name=document.createElement('dt'),value=document.createElement('dd');name.append(attrIcon(id),attrName(id));row.append(name,value);totals.append(row);totalCells.set(id,value);}
   const totalsNote=document.createElement('p');totalsNote.className='contract-totals-note';totalsNote.textContent='주옵션 · 부옵션 · 3세트 효과 합계';
   const effects=document.createElement('section');effects.className='contract-set-effects';const effectsTitle=document.createElement('h4');effectsTitle.textContent='세트 효과';effects.append(effectsTitle);
   const activeSets=covenantSets(catalog,owner);for(const set of activeSets){const record=siteContracts.find(s=>s.clientSuitId===set.id),group=document.createElement('section'),name=document.createElement('h5');name.textContent=catalog.suits.find(s=>s.id===set.id).name+' · '+set.count+'개';group.append(name);
    for(const count of [3,6]){const line=document.createElement('p'),threshold=document.createElement('span');line.className=set.count>=count?'is-active':'is-inactive';threshold.textContent=count+'세트';line.append(threshold,record?.['set_effect_'+count]||'효과 설명을 불러오지 못했습니다.');group.append(line);}effects.append(group);
   }
   if(!activeSets.length){const empty=document.createElement('p');empty.textContent='장착한 비밀계약이 없습니다.';effects.append(empty);}
   overview.append(overviewTitle,totals,totalsNote,effects);
   const detail=document.createElement('div');detail.className='member-contract-detail';detail.append(overview,partGrid);
   const contractLayout=document.createElement('div');contractLayout.className='member-covenant-body';contractLayout.append(diagram,detail);options.append(contractLayout);
   const refreshCompletion=()=>{try{completion.textContent='전체 완성도 '+covenantCompletion(equippedCovenantParts(catalog,owner))+'%';const values=covenantAttributeTotals(catalog,owner);for(const [id,cell]of totalCells)cell.textContent=Number((values[id]||0).toFixed(6))+unit(id);}catch{completion.textContent='옵션 수치를 확인하세요.';for(const cell of totalCells.values())cell.textContent='—';}};refreshCompletion();
   owner.contractBound=covenantBound(owner)&&slots.some(Boolean);
   const bindingLabel=document.createElement('label');bindingLabel.className='member-toggle member-contract-binding';bindingLabel.append('귀속');const binding=document.createElement('input');binding.type='checkbox';binding.checked=owner.contractBound;binding.disabled=!slots.some(Boolean);binding.setAttribute('aria-label','비밀계약 전체 귀속');bindingLabel.append(binding);head.insertBefore(bindingLabel,changeSet);
   const partRefresh=[];
   const optionTargets=new Map();
   const refreshOptionIcons=()=>{for(const targets of optionTargets.values())for(const entry of targets){
    const id=Number(entry.select.value);entry.caption.textContent=entry.name+(id?' · '+attrName(id):'');
    for(const [optionId,button]of entry.buttons)button.setAttribute('aria-pressed',String(id===optionId));
   }};
   let selectedPosition=-1;
   const backToOverview=()=>{const last=selectedPosition;drawHex(-1);hex.querySelector('[data-part-label="'+last+'"]')?.focus({preventScroll:true});};
   for(let position=1;position<=6;position++){
    const row=document.createElement('section'),title=document.createElement('h4');row.hidden=true;row.dataset.covenantPosition=position;row.dataset.covenantEquipped=String(!!slots[position-1]);title.tabIndex=-1;title.textContent=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][position-1]+' · '+(catalog.suits.find(s=>s.id===slots[position-1])?.name||'미장착');const partHead=document.createElement('div');partHead.className='member-part-head';partHead.append(title);row.append(partHead);partGrid.append(row);
    const back=document.createElement('button');back.type='button';back.className='member-overview-back';back.textContent='전체 보기';back.onclick=backToOverview;partHead.append(back);
    const choose=document.createElement('button');choose.type='button';choose.className='member-part-set';choose.textContent=slots[position-1]?'세트 변경':'비밀계약 선택';choose.setAttribute('aria-label',position+'번 비밀계약 선택');choose.onclick=()=>live.requestPicker('contract',position);partHead.append(choose);
    if(!slots[position-1]){const empty=document.createElement('p');empty.className='member-part-empty';empty.textContent='비밀계약을 먼저 장착하세요.';row.append(empty);continue;}
    const fields=document.createElement('div');fields.className='fields covenant-fields';row.append(fields);
    const current=owner.trinkets?.find(p=>p.position===position)||{position,main:0,quality:'Orange',level:0,bound:owner.contractBound,sub:[]};current.sub??=[];
    const control=(name,choices,value)=>{const label=document.createElement('label');label.textContent=name;const n=document.createElement(choices?'select':'input');if(choices)for(const [id,text]of choices)n.add(new Option(text,String(id)));else{n.type='number';n.min='0';n.step='any';}n.value=value??'';n.setAttribute('aria-label',position+'번 '+name);label.append(n);return n;};
    const attrs=ids=>ids.map(id=>[id,attrName(id)]);
    const main=control('주옵션',[[0,'미설정'],...attrs(data.equipmentMetadata.slots[position-1].main)],current.main),level=control('강화 레벨',null,current.level),levelSlider=addSlider(level,0,12);
    const mainSection=document.createElement('section');mainSection.className='contract-option-row is-main';const mainValue=document.createElement('output');mainValue.className='contract-option-value';const mainTop=document.createElement('div');mainTop.className='contract-option-head';const mainLabel=document.createElement('span');mainLabel.textContent='주옵션';mainTop.append(mainLabel,mainValue);main.closest('label').firstChild.remove();mainSection.append(mainTop,main.closest('label'),level.closest('label'));fields.append(mainSection);
    const readout=document.createElement('output');readout.className='contract-part-completion';row.append(readout);
    const warning=document.createElement('p');warning.className='member-input-warning';warning.setAttribute('role','status');row.append(warning);
    const refresh=()=>{current.bound=owner.contractBound;try{validateCovenantParts([current]);warning.textContent='';}catch(error){warning.textContent=error.message;}
     mainValue.replaceChildren();if(current.main){mainValue.append(attrIcon(current.main),Number(covenantMainValue(current).toFixed(6))+unit(current.main));mainValue.setAttribute('aria-label',attrName(current.main)+' '+Number(covenantMainValue(current).toFixed(6))+unit(current.main));}else mainValue.textContent='미설정';
     try{readout.textContent='이 부위 완성도 '+covenantCompletion([current])+'%';}catch{readout.textContent='강화 레벨을 확인하세요.';}
    };partRefresh.push(refresh);refresh();
    const sub=[];
    for(let i=0;i<covenantSubCount;i++){
     const select=control('부옵션 '+(i+1),[[0,'없음'],...attrs(data.equipmentMetadata.slots[position-1].sub)],current.sub[i]?.id||0),n=control('부옵션 '+(i+1)+' 레벨',null,covenantSubLevel(current.sub[i])??1),slider=addSlider(n,1,8),value=document.createElement('output');value.className='contract-option-value';
     const option=document.createElement('section');option.className='contract-option-row';const top=document.createElement('div');top.className='contract-option-head';const caption=document.createElement('span');caption.textContent='부옵션 '+(i+1);top.append(caption,value);select.closest('label').firstChild.remove();n.closest('label').firstChild.textContent='레벨';option.append(top,select.closest('label'),n.closest('label'));fields.append(option);sub.push({select,n,slider,value});
    }
    const refreshSub=()=>{for(const [index,{select,n,slider,value}]of sub.entries()){const id=Number(select.value);n.disabled=slider.disabled=!id;value.replaceChildren();if(id){const old=current.sub[index],invalid=old?.id===id&&covenantSubLevel(old)==null;value.append(attrIcon(id),(invalid?old.value:covenantSubValue(id,Math.max(1,Math.min(8,Number(n.value)||1))))+unit(id));value.setAttribute('aria-label',attrName(id)+' '+value.textContent+(invalid?' · 레벨 재설정 필요':''));}else{value.textContent='없음';value.removeAttribute('aria-label');}
      for(const option of select.options)option.disabled=false;
    }};refreshSub();
    const update=event=>{const subChanged=sub.some(s=>event.target===s.select||event.target===s.n);current.main=Number(main.value);current.quality='Orange';level.max=levelSlider.max='12';current.level=Math.max(0,Math.min(Math.round(Number(level.value)||0),12));level.value=levelSlider.value=String(current.level);current.bound=owner.contractBound;
     current.sub=current.sub.length>3&&!subChanged?current.sub:sub.filter(({select})=>Number(select.value)).map(({select,n,slider})=>{const old=current.sub[sub.findIndex(s=>s.select===select)];if(old?.id===Number(select.value)&&covenantSubLevel(old)==null&&event.target!==select&&event.target!==n)return old;const lv=Math.max(1,Math.min(8,Math.round(Number(n.value)||1)));n.value=slider.value=String(lv);return{id:Number(select.value),value:covenantSubValue(Number(select.value),lv)};});
     owner.trinkets=(owner.trinkets||[]).filter(p=>p.position!==position);owner.trinkets.push(current);refreshSub();refresh();refreshCompletion();drawHex(selectedPosition);ui.invalidate();
    };
    [main,level,...sub.flatMap(s=>[s.select,s.n])].forEach(n=>n.onchange=n.oninput=update);
    for(const number of [level,...sub.map(s=>s.n)]){const label=number.closest('label');if(label.firstChild.nodeType===3)label.firstChild.remove();const unit=document.createElement('span');unit.className='contract-level-unit';unit.textContent='Lv.';number.before(unit);}
    const targets=[];for(const [index,select]of [main,...sub.map(s=>s.select)].entries()){
     const label=select.closest('label');label.hidden=true;const section=label.parentElement,name=index===0?'주옵션':'부옵션 '+index;
     const icons=document.createElement('div');icons.className='contract-option-icons';icons.setAttribute('role','group');icons.setAttribute('aria-label',position+'번 '+name+' 선택');
     const buttons=new Map();for(const id of ids){const button=document.createElement('button');button.type='button';button.append(attrIcon(id));button.title=attrName(id);button.setAttribute('aria-label',attrName(id));const allowed=[...select.options].some(o=>Number(o.value)===id);button.disabled=!allowed;
      button.onclick=()=>{select.value=String(Number(select.value)===id?0:id);select.dispatchEvent(new Event('input',{bubbles:true}));};icons.append(button);buttons.set(id,button);
     }
     label.after(icons);targets.push({select,buttons,name,caption:section.querySelector('.contract-option-head>span')});
    }optionTargets.set(position,targets);
   }
   const drawHex=(index,focus=false)=>{selectedPosition=index;options.dataset.partEditing=index>=0?'true':'false';overview.hidden=index>=0;partGrid.hidden=index<0;for(const row of partGrid.children)row.hidden=Number(row.dataset.covenantPosition)!==index+1;
    const parts=slots.map((id,i)=>{const suit=catalog.suits.find(s=>s.id===id),record=siteContracts.find(s=>s.clientSuitId===id);return{suitId:id,setIcon:id?'images/covenant-set/'+id+'.png':null,name:suit?.name||'미장착',image:siteParts.find(s=>s.suitId===id)?.parts[i]?.imagePath||record?.image_path,pieceArt:!!siteParts.find(s=>s.suitId===id)?.parts[i],empty:!id,bound:!!id&&owner.contractBound,caption:id?(owner.contractBound?'귀속':'장착'):'비어 있음'};});
    renderCovenantParts(hex,{hex:true,labelsInside:true,selected:index,parts,onSelect:index=>{if(!slots[index]){live.requestPicker('contract',index+1);return;}drawHex(index,true);}});
    hint.textContent=defaultHint;hint.hidden=index>=0;refreshOptionIcons();
    if(focus&&index>=0){const row=partGrid.querySelector('[data-covenant-position="'+(index+1)+'"]');row.querySelector('h4').focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}
   };
   binding.onchange=()=>{owner.contractBound=binding.checked;for(const part of owner.trinkets||[])part.bound=owner.contractBound;for(const refresh of partRefresh)refresh();refreshCompletion();drawHex(selectedPosition);ui.invalidate();};
   drawHex(-1);
  },
  settings(parent,owner){
   const options=data.stateSchemas[owner.id]?.options||[];
   const group=document.createElement('details'),title=document.createElement('summary');title.textContent='현재 효과';group.append(title);
   const selected=document.createElement('div');selected.className='fields';group.append(selected);
   const add=document.createElement('select');add.setAttribute('aria-label',owner.name+' 효과 추가');add.add(new Option('효과 추가',''));
   for(const option of options)add.add(new Option(option.name+(option.internal?' · 누적':''),String(option.id)));
   group.append(add);parent.append(group);
   const draw=item=>{
    const definition=options.find(o=>o.id===item.id);if(!definition)return;
    const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=definition.name;box.append(legend);box.className='live-state';
    const scope=document.createElement('select');scope.setAttribute('aria-label',definition.name+' 적용 대상');
    const scopes=definition.scope==='context'?['actor','team','card','target']: [definition.scope];
    for(const name of scopes){if(name==='target'){for(let i=0;i<ui.state.enemies.length;i++)scope.add(new Option(ui.state.enemies[i].name||data.enemies[i]?.name||'적','target:'+i));}else scope.add(new Option({actor:owner.name,team:'아군 공용',card:'선택 카드'}[name],name));}
    scope.value=item.owner==='target'?'target:'+(item.targetIndex||0):item.ownerTid?'actor':item.owner||scopes[0];
    const label=document.createElement('label');label.textContent='현재 값';const value=document.createElement('input');value.type='number';value.min='0';value.step='1';if(definition.max!=null)value.max=String(definition.max);value.value=item.layers??'';value.placeholder='자동';value.setAttribute('aria-label',definition.name+' 현재 값');label.append(value);
    box.append(scope,label);
    const params=[];for(let i=0;i<definition.params;i++){const l=document.createElement('label');l.textContent='효과량 '+(i+1);const n=document.createElement('input');n.type='number';n.step='any';n.value=item.params?.[i]??'';n.placeholder='자동';n.setAttribute('aria-label',definition.name+' 효과량 '+(i+1));l.append(n);box.append(l);params.push(n);}
    const update=()=>{item.layers=value.value===''?null:Number(value.value);item.partialParams=params.some(n=>n.value!=='')&&!params.every(n=>n.value!=='');item.params=params.every(n=>n.value!=='')?params.map(n=>Number(n.value)):undefined;delete item.owner;delete item.ownerTid;const choice=scope.value;if(choice==='actor')item.ownerTid=owner.id;else if(choice.startsWith('target:')){item.owner='target';item.targetIndex=Number(choice.split(':')[1]);}else item.owner=choice;if(item.owner==='card')item.cardTid=ui.card().id;ui.invalidate();};
    value.oninput=scope.onchange=update;params.forEach(n=>n.oninput=update);
    const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.onclick=()=>{ui.state.customStates=ui.state.customStates.filter(s=>s!==item);box.remove();ui.invalidate();};box.append(remove);selected.append(box);
   };
   for(const item of ui.state.customStates.filter(s=>s.sourceTid===owner.id))draw(item);
   add.onchange=()=>{const id=Number(add.value);if(!id)return;if(ui.state.customStates.some(s=>s.sourceTid===owner.id&&s.id===id))return;const d=options.find(d=>d.id===id);const item={sourceTid:owner.id,casterTid:owner.id,id,layers:null,...d.scope==='team'?{owner:'team'}:d.scope==='card'?{owner:'card',cardTid:ui.card().id}:d.scope==='target'?{owner:'target',targetIndex:0}:{ownerTid:owner.id}};ui.state.customStates.push(item);draw(item);add.value='';};
  },
  realmSettings(parent,kind){
   if(kind==='card'){
    const group=document.createElement('details'),title=document.createElement('summary');title.textContent='다른 카드';group.append(title);parent.append(group);
    const list=document.createElement('div');list.className='fields';group.append(list);
    const add=document.createElement('select');add.setAttribute('aria-label','다른 카드 추가');add.add(new Option('카드 추가',''));
    for(const p of ui.people())for(const card of [...p.cards,...p.generated].filter(c=>!c.ulti))add.add(new Option(p.name+' · '+card.name,p.id+':'+card.id));group.append(add);
    const draw=item=>{const box=document.createElement('fieldset');box.className='live-state';const legend=document.createElement('legend');legend.textContent=catalog.skills[item.cardTid]?.name||'카드';box.append(legend);const deck=document.createElement('select');deck.setAttribute('aria-label',legend.textContent+' 위치');for(const [key,name]of [['HandDeck','손패'],['DrawDeck','뽑을 카드'],['GraveyardDeck','버린 카드'],['ConsumedDeck','소모한 카드']])deck.add(new Option(name,key));deck.value=item.deck;const count=document.createElement('input');count.type='number';count.min='1';count.max='50';count.value=item.count;count.setAttribute('aria-label',legend.textContent+' 장수');deck.onchange=count.oninput=()=>{item.deck=deck.value;item.count=Number(count.value);ui.invalidate();};const remove=document.createElement('button');remove.textContent='삭제';remove.onclick=()=>{ui.state.otherCards=ui.state.otherCards.filter(s=>s!==item);box.remove();ui.invalidate();};box.append(deck,count,remove);list.append(box);};
    ui.state.otherCards.forEach(draw);add.onchange=()=>{if(!add.value)return;const [ownerTid,cardTid]=add.value.split(':').map(Number),item={ownerTid,cardTid,count:1,deck:'HandDeck'};ui.state.otherCards.push(item);draw(item);add.value='';ui.invalidate();};
   }
   if(kind!=='space')return;
   for(const name of ['spaceCards','spaceOwner'])parent.querySelector('[data-field="'+name+'"]')?.closest('label')?.remove();
   const grid=document.createElement('div');grid.className='fields';parent.append(grid);
   for(let index=0;index<Math.min(5,ui.state.spaceCapacity);index++){
    const label=document.createElement('label');label.textContent=(index+1)+'번 공간';const select=document.createElement('select');select.setAttribute('aria-label',label.textContent);select.add(new Option('비어 있음',''));
    for(const p of ui.people())for(const card of p.cards.filter(c=>!c.ulti))select.add(new Option(p.name+' · '+card.name,p.id+':'+card.id));
    const entry=ui.state.spaceEntries[index];select.value=entry?entry.ownerTid+':'+entry.cardTid:'';
    select.onchange=()=>{const [ownerTid,cardTid]=select.value.split(':').map(Number);ui.state.spaceEntries[index]=select.value?{ownerTid,cardTid}:null;ui.state.spaceCards=ui.state.spaceEntries.filter(Boolean).length;ui.invalidate();};label.append(select);grid.append(label);
   }
  },
  save(){const value={version:1,partyIds:ui.state.partyIds,state:ui.state,people:data.people.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['sd','art','generated','sdAnchor','sdHeight'].includes(k))))};localStorage.setItem('scarecrow-live-party',JSON.stringify(value));status('파티와 현재 조건을 저장했습니다.');},
  load(){try{const saved=JSON.parse(localStorage.getItem('scarecrow-live-party'));if(saved?.version!==1||saved.partyIds.length!==4||!saved.partyIds.every(id=>data.people.some(p=>p.id===id)))throw Error();for(const p of saved.people){const current=data.people.find(c=>c.id===p.id);if(current)Object.assign(current,p);}Object.assign(ui.state,saved.state,{result:false,calculation:null});ui.render();this.invalidate();status('저장한 파티를 불러왔습니다.');}catch{status('불러올 수 있는 저장 정보가 없습니다.');}},
 };
 return live;
}
