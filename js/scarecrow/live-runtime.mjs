import {renderCovenantEditor} from '../covenant-editor.mjs';
import {effectPresentation,effectSnapshot} from './effect-presentation.mjs';
import {tentacleCapacity} from './tentacle-state.mjs';
import {makeLiveDamageInput} from './live-damage-input.mjs';
import {sequenceInput,sequenceStep} from './sequence-calculator.mjs';
import {renderBattleSelection,selectionOptions} from './battle-selection.mjs';
import {nativeCardDescription} from './card-description.mjs';
const arr=v=>Array.isArray(v)?v:[];
export async function createLiveRuntime(){
 const [data,catalog]=await Promise.all(['live-data.json','catalog.json'].map(p=>fetch(p).then(r=>{if(!r.ok)throw Error('계산 데이터를 불러오지 못했습니다.');return r.json();})));
 const worker=new Worker(new URL('worker.js',import.meta.url),{type:'module'}),pending=new Map();let serial=0,initialization;
 worker.onmessage=({data:message})=>{const job=pending.get(message.id);if(!job)return;pending.delete(message.id);message.error?job.reject(Error(message.error)):job.resolve(message.result);};
 worker.onerror=()=>{for(const job of pending.values())job.reject(Error('계산 엔진을 다시 불러와 주세요.'));pending.clear();initialization=null;};
 const rawCall=(kind,input)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,kind,input:input==null?null:JSON.parse(JSON.stringify(input))});});
 const cache=new Map(),descriptionCache=new Map();
 const call=async(kind,input)=>{
  initialization??=rawCall('initialize');await initialization;
  if(!['build','team'].includes(kind))return rawCall(kind,input);
  const key=kind+JSON.stringify(input);if(!cache.has(key))cache.set(key,rawCall(kind,input));
  return structuredClone(await cache.get(key));
 };
 let ui,version=0,timer,lastInput,lastResult;
 let sequenceBase=null,initialSetup=null,applied=[],lastBase,lastStep,lastCompletedVersion=-1,setupIdentity='';
 const previews=new Map();
 const identity=()=>JSON.stringify({party:ui.state.partyIds,keeper:ui.state.keeperId,relics:ui.state.relics,chapter:ui.state.chapter,account:ui.state.accountLevel,enemies:ui.state.enemies.map(e=>({tid:e.tid,level:e.level,source:e.source,base:e.base})),people:ui.people().map(p=>({id:p.id,level:p.level,potency:p.potency,sign:p.sign,training:p.training,inherent:p.inherent,gear1:p.gearId1,gear2:p.gearId2,stack1:p.stack1,stack2:p.stack2,refine1:p.refine1,refine2:p.refine2,trinkets:p.trinkets,contractId:p.contractId,contractSlots:p.contractSlots,contractName:p.contract,contract:p.contractBound,levels:p.cards.filter(c=>!c.generated).map(c=>[c.id,c.level])}))});
 async function runCalculator(request){
  const key=JSON.stringify(request);if(previews.has(key))return structuredClone(previews.get(key));
  const result=await call('calculator',request);
  if(!result.current.waiting&&arr(result.steps).every(s=>s.accepted)){previews.set(key,structuredClone(result));if(previews.size>48)previews.delete(previews.keys().next().value);}
  return result;
 }
 function restoreSetup(){if(!initialSetup)return;const person=ui.state.person,card=ui.state.card;Object.assign(ui.state,structuredClone(initialSetup.state),{person,card,result:false,calculation:null});for(const saved of initialSetup.people){const p=data.people.find(p=>p.id===saved.id);if(p)Object.assign(p,structuredClone(saved));}if(!ui.person().cards[ui.state.card])ui.state.card=0;}
 function clearSequence(restore=true){if(restore)restoreSetup();sequenceBase=null;initialSetup=null;applied=[];lastCompletedVersion=-1;}
 function syncSequence(){
  if(!ui)return;const root=ui.root,active=applied.length>0;
  root.dataset.appliedCards=JSON.stringify(applied.map(a=>a.label));
  const history=root.querySelector('[data-applied-cards]');if(history){history.hidden=!active;history.textContent=applied.map((a,i)=>(i+1)+'. '+a.label).join(' → ');}
  for(const [selector,disabled] of [['[data-commit-state]',applied.length>=100||lastCompletedVersion!==version||!ui.state.result||ui.state.calculating],['[data-undo-state]',!active||ui.state.calculating],['[data-reset-state]',!active||ui.state.calculating]]){const b=root.querySelector(selector);if(b)b.disabled=!!disabled;}
  const note=root.querySelector('[data-sequence-note]');if(note){note.hidden=!active;note.textContent='카드를 고르면 이 상태에서 미리 계산합니다. 공통 설정을 수정하려면 처음 설정으로 돌아가세요.';}
  root.querySelectorAll('.enemy-edit,.relics button,[data-open=key]').forEach(b=>b.disabled=active);
  const editor=root.querySelector('.editor');if(editor){let locked=editor.querySelector('.sequence-lock-note');if(!locked){locked=document.createElement('p');locked.className='sequence-lock-note readout';editor.querySelector('.editor-head').after(locked);}locked.hidden=!active||editor.dataset.kind==='card';locked.textContent='적용한 효과를 확인하는 화면입니다. 직접 바꾸려면 ‘처음 설정으로’를 눌러 주세요.';}if(active&&editor?.dataset.kind!=='card')editor?.querySelectorAll('input,select,[data-body] button').forEach(n=>n.disabled=true);
  if(active&&editor?.dataset.kind==='card')editor.querySelectorAll('details input,details select,details button').forEach(n=>n.disabled=true);
 }
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
  if(applied.length){state.stance={OceanModel1:'조수',OceanModel2:'정해',OceanModel3:'노도'}[initial.oceanModel]||state.stance;if(result.sequenceStatistics?.used!=null)state.used=result.sequenceStatistics.used;if(result.sequenceStatistics?.ulti!=null)state.ultiCount=result.sequenceStatistics.ulti;}
  const auto=(key,value)=>{if((applied.length||!state.explicit.includes(key))&&value!=null)state[key]=value;};
  if(team){state.teamHp=team.properties.hp;state.teamMaxHp=team.properties.max_hp;state.teamShield=team.properties.block;}
  auto('key',100*(props.keeper_energy||0)/(props.max_keeper_energy||1000));
  auto('tentacleLimit',tentacleCapacity(props));auto('tentacles',(props.permanent_tentacle_count||0)+(props.battle_tentacle_count||0));auto('tempTentacles',props.bout_tentacle_count||0);auto('spaceCapacity',props.dimension_slot||5);
  auto('tentacleDamage',initial.tentacleDamage);auto('furnace',props.scarlet_blood_count||0);auto('furnaceMax',props.max_scarlet_blood_count||200);auto('amp',props.enhance_per||0);
  const teamStates=arr(team?.states);state.temporaryPower=teamStates.filter(s=>s.stateId===3130).reduce((n,s)=>n+s.layer,0);auto('power',teamStates.filter(s=>s.stateId===2900).reduce((n,s)=>n+s.layer,0));auto('weakness',teamStates.filter(s=>s.stateId===3469).reduce((n,s)=>n+s.layer,0));auto('furnaceHeal',teamStates.filter(s=>s.stateId===35501).reduce((n,s)=>n+s.layer,0));
  for(const [key,id] of [['tentacleGathering',22067],['oceanDefenceCooldown',120351],['oceanFuryCooldown',120354],['dimensionCooldown',80398],['furnaceCooldown',80399]])auto(key,teamStates.filter(s=>s.stateId===id).reduce((n,s)=>n+s.layer,0));
  for(const [i,enemy] of arr(initial.roles).filter(r=>r.camp===2).entries()){
   const current=state.enemies[i];if(!current)continue;
   for(const [key,prop] of [['hp','hp'],['maxHp','max_hp'],['defense','def'],['attack','atk'],['shield','block']])current[key]=enemy.properties[prop]||0;
   for(const [key,id] of [['vulnerable',2934],['weakness',3469]])if(applied.length||!state.explicit.includes('enemy.'+i+'.'+key))current[key]=arr(enemy.states).filter(s=>s.stateId===id).reduce((n,s)=>n+s.layer,0);
  }
  for(const owner of ui.people())for(const field of ui.mechanicFields(owner.id)){
   if(!applied.length&&state.mechanicEdited?.includes(owner.id+':'+field.stateId))continue;
   const role=field.scope==='team'?team:arr(initial.roles).find(r=>r.tid===owner.id);
   state.mechanics[owner.id][field.key]=arr(role?.states).filter(s=>s.stateId===field.stateId).reduce((n,s)=>n+s.layer,0);
  }
  const current=arr(initial.cards).find(c=>c.uid===(result.selectedCardUid??1000000));if(current&&!ui.card().costEdited)ui.card().calculatedCost=current.cost;
 }
 async function prepare(){
  if(!ui)return;if(document.body.dataset.view==='damage')return live.calculate();const revision=version;status('파티 능력치 계산 중…');
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
   result=await runCalculator(input);
  }
  return result;
 }
 function outcome(result,input){
  lastInput=input;lastResult=result;acceptAutomatic(result);
  if(result.current.waiting){ui.state.calculation=null;ui.state.result=false;ui.render();ui.open('live-selection');status('효과의 선택을 마치면 계산합니다.');return;}
  const rejected=arr(result.steps).find(step=>!step.accepted);if(rejected)throw Error('카드 사용 조건을 확인하세요. 산출력·광기·봉인 상태에 따라 사용할 수 없는 카드가 있습니다.');
  const enemies=arr(result.initial.roles).filter(r=>r.camp===2),current=arr(result.current.roles);
  const targets=enemies.map(r=>{const after=current.find(x=>x.uid===r.uid);return{uid:r.uid,damage:r.properties.hp-(after?.properties.hp??r.properties.hp)};});
  ui.state.calculation={total:result.damage.total,targets,critical:arr(result.damage.hits).some(h=>h.critical),body:result.damage.body,additional:result.damage.additional,blocked:result.damage.blocked};
  ui.state.result=true;lastCompletedVersion=version;delete ui.root.dataset.calculationError;ui.root.dataset.lastDamageInput=JSON.stringify(input);ui.root.dataset.lastDamage=JSON.stringify(result.damage);if(document.body.dataset.view==='damage')ui.open('card');else ui.close();ui.render();status('계산 완료');
 }
 const siteContracts=await fetch('data/covenant_list.json').then(r=>r.json()),siteParts=await fetch('data/covenant_parts.json').then(r=>r.json());
 const siteWheels=await fetch('data/wheel_list.json').then(r=>r.json()),siteKeys=await fetch('data/silverkey_list.json').then(r=>r.json());
 globalThis.CharacterEffects?.configureTooltips(await fetch('data/db_tooltips.json').then(r=>r.json()));
 const live={data,catalog,call,siteWheels,siteKeys,
  syncSequence,
  commitState(){if(applied.length>=100||lastCompletedVersion!==version||!ui.state.result||ui.state.calculating)return;
   if(!sequenceBase){sequenceBase=structuredClone(lastBase);initialSetup={state:structuredClone(ui.state),people:structuredClone(ui.people())};setupIdentity=identity();}
   const index=lastInput.actions.findLastIndex(a=>a.sequenceStep);
   applied.push({step:structuredClone(lastStep),replies:structuredClone(lastInput.actions.slice(index+1)),label:ui.person().name+' · '+ui.card().name});
   live.invalidate();ui.render();
  },
  undoState(){if(!applied.length)return;applied.pop();if(!applied.length)clearSequence();live.invalidate();ui.render();},
  resetState(){clearSequence();live.invalidate();ui.render();},
  async cardDescription(parent,owner,card){
   const renderer=globalThis.CharacterEffects;
   if(card.nativeDescription){
    const token={};parent._descriptionToken=token;
    const render=text=>{if(parent._descriptionToken!==token||!parent.isConnected)return;parent.innerHTML=renderer.renderEffectBody({effect:text},owner.potency??0,card.level??1);renderer.setupTooltips(parent);};
    const plain=nativeCardDescription(card,owner.potency??0);
    if(plain){render(plain);return;}
    parent.textContent='효과 설명을 불러오는 중…';
    try{const {input:request}=await input();request.actions=[];request.damage.preparing=true;const key=JSON.stringify(request);if(!descriptionCache.has(key)){if(descriptionCache.size>=128)descriptionCache.clear();descriptionCache.set(key,call('calculator',request).catch(error=>{descriptionCache.delete(key);throw error;}));}const result=await descriptionCache.get(key);const text=nativeCardDescription(card,owner.potency??0,result.initial.cardDescription);if(!text)throw Error('원본 설명 인자를 확인하지 못했습니다.');render(text);}
    catch(error){if(parent._descriptionToken===token&&parent.isConnected)parent.textContent='효과 설명을 불러오지 못했습니다. '+error.message;}
    return;
   }
   parent._descriptionToken=null;
   if(!card.effectRecord||!renderer){parent.textContent='이 카드의 효과 설명은 아직 등록되지 않았습니다.';return;}
   parent.innerHTML=renderer.renderEffectBody(card.effectRecord,owner.potency??0,card.level??1);
   renderer.setupTooltips(parent);
  },
  removeEnemy(index){if(ui.state.enemies.length<=1)return;ui.state.enemies.splice(index,1);ui.state.explicit=ui.state.explicit.flatMap(k=>{const match=k.match(/^enemy\.(\d+)\.(.+)$/);if(!match)return [k];const i=Number(match[1]);return i===index?[]:['enemy.'+(i>index?i-1:i)+'.'+match[2]];});ui.state.customStates=ui.state.customStates.flatMap(s=>s.owner!=='target'?[s]:(s.targetIndex??0)===index?[]:[{...s,targetIndex:(s.targetIndex??0)>index?s.targetIndex-1:s.targetIndex??0}]);live.persistEnemies?.();ui.invalidate();ui.close();ui.render();ui.root.querySelector('[data-enemy-index="'+Math.min(index,ui.state.enemies.length-1)+'"]')?.focus();},
  async preparedInput(){return (await input()).input;},
  snapshot(){return structuredClone({state:ui.state,people:ui.people(),card:ui.card()});},
  attach(context){ui=context;ui.state.explicit=[];ui.state.mechanicEdited=[];ui.state.customStates=[];ui.state.accountLevel=60;ui.state.chapter='성신편';ui.state.keeperId=0;ui.state.relics=[];ui.state.turn=1;ui.state.used=0;
   ui.state.spaceEntries=[];ui.state.otherCards=[];ui.state.spaceCards=0;for(const p of data.people)for(const c of p.cards)c.level=1;
   ui.state.keeperName='장착 안 함';for(const [i,e] of ui.state.enemies.entries())Object.assign(e,{tid:[149116,22308][i],name:data.enemies[i].name,image:data.enemies[i].image});ui.render();timer=setTimeout(prepare,0);
  },
  invalidate(){version++;clearTimeout(timer);lastCompletedVersion=-1;if(ui){ui.state.calculating=false;ui.state.result=false;if(applied.length&&identity()!==setupIdentity)clearSequence(false);const ids=ui.state.partyIds;for(const item of ui.state.customStates){const normalized=effectSnapshot(item);for(const key of Object.keys(item))if(!(key in normalized))delete item[key];Object.assign(item,normalized);}ui.state.customStates=ui.state.customStates.filter(s=>ids.includes(s.sourceTid)&&(!s.ownerTid||ids.includes(s.ownerTid)));ui.state.otherCards=(ui.state.otherCards||[]).filter(s=>ids.includes(s.ownerTid));ui.state.mechanicEdited=ui.state.mechanicEdited.filter(k=>ids.includes(Number(k.split(':')[0])));ui.state.spaceEntries=(ui.state.spaceEntries||[]).map(s=>s&&ids.includes(s.ownerTid)?s:null);ui.state.spaceCards=ui.state.spaceEntries.filter(Boolean).length;ui.state.calculation=null;delete ui.root.dataset.calculationError;timer=setTimeout(prepare,100);syncSequence();}},
  async calculate(){clearTimeout(timer);const revision=++version,started=performance.now();ui.state.calculating=true;ui.state.result=false;ui.render();status('카드 피해 계산 중…');
   try{const base=sequenceBase??(await input()).input;if(revision!==version)return;lastBase=base;lastStep=sequenceStep(ui.person(),ui.card(),ui.state);const request=sequenceInput(base,applied,lastStep),result=await finishEmptySelections(await runCalculator(request),request);if(revision!==version)return;ui.root.dataset.previewMs=String(Math.round(performance.now()-started));outcome(result,request);}
   catch(error){if(revision!==version)return;ui.state.result=false;ui.render();status(friendly(error));ui.root.dataset.calculationError=String(error.message||error);}
   finally{if(revision===version){ui.state.calculating=false;ui.render();syncSequence();}}
  },
  selection(parent){renderBattleSelection({parent,state:lastResult.current,working:false,skillName:id=>catalog.skills[String(id)]?.name||'카드',roleName:r=>catalog.characters.find(c=>c.id===r.tid)?.name||'대상',act:async reply=>{
   const revision=version;try{const count=arr(lastResult.steps).length,input={...lastInput,actions:[...lastInput.actions.slice(0,count),reply,...lastInput.actions.slice(count)]};const result=await finishEmptySelections(await runCalculator(input),input);if(revision===version)outcome(result,input);}catch(error){status(friendly(error));}
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
   const editor=renderCovenantEditor(parent,{owner,catalog,metadata:data.equipmentMetadata,contracts:siteContracts,parts:siteParts,
    onChange:()=>ui.invalidate(),onPick:position=>live.requestPicker('contract',position),onReset:()=>ui.open('covenant'),
    onPartChange:index=>{if(window.parent!==window)window.parent.postMessage({type:'scarecrow:covenant-view',position:index+1},location.origin);}});
   live.editCovenantPart=position=>editor?.editPart(position);
   live.showCovenantOverview=()=>editor?.showOverview();
  },
  settings(parent,owner,{placement='actor',targetIndex=0}={}){
   const options=(data.stateSchemas[owner.id]?.options||[]).map(effectPresentation).filter(o=>o.placement===placement);if(!options.length)return;
   const group=document.createElement('section'),title=document.createElement('h3');group.className='battle-effects';title.textContent=owner.name+'의 효과';group.append(title);
   const selected=document.createElement('div');selected.className='fields';group.append(selected);
   const add=document.createElement('select');add.setAttribute('aria-label',owner.name+' 효과 추가');add.add(new Option('효과 추가',''));
   for(const option of options)add.add(new Option(option.name,String(option.id)));
   group.append(add);const receiver=document.createElement('p');receiver.className='readout';receiver.textContent='적용 대상: '+(placement==='target'?(ui.state.enemies[targetIndex]?.name||'선택한 적'):['team','tentacle'].includes(placement)?'아군 공용':placement==='card'?'선택한 카드':options.some(o=>o.scope==='context')?'효과별로 선택':owner.name);group.prepend(receiver);parent.append(group);
   const draw=item=>{
    const definition=options.find(o=>o.id===item.id);if(!definition)return;
    const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=owner.name+' · '+(definition.source||definition.name);box.append(legend);box.className='live-state';if(definition.description){const note=document.createElement('p');note.className='readout';note.textContent=definition.description;box.append(note);}
    const scope=document.createElement('select');scope.setAttribute('aria-label',definition.name+' 적용 대상');
    const scopes=definition.scope==='context'?['actor','team','card','target']: [definition.scope];
    for(const name of scopes){if(name==='target'){for(let i=0;i<ui.state.enemies.length;i++)scope.add(new Option(ui.state.enemies[i].name||data.enemies[i]?.name||'적','target:'+i));}else scope.add(new Option({actor:owner.name,team:'아군 공용',card:'선택 카드'}[name],name));}
    scope.value=item.owner==='target'?'target:'+(item.targetIndex||0):item.ownerTid?'actor':item.owner||scopes[0];
    const label=document.createElement('label');label.textContent=definition.valueLabel||'현재 값';const value=document.createElement('input');value.type='number';value.min='0';value.step='1';if(definition.max!=null)value.max=String(definition.max);value.value=item.layers??'';value.placeholder='자동';value.setAttribute('aria-label',definition.name+' 현재 값');label.append(value);
    if(definition.scope==='context')box.append(scope);box.append(label);
    const params=[];for(let i=0;i<definition.params;i++){const l=document.createElement('label');l.textContent='효과량 '+(i+1);const n=document.createElement('input');n.type='number';n.step='any';n.value=item.params?.[i]??'';n.placeholder='자동';n.setAttribute('aria-label',definition.name+' 효과량 '+(i+1));l.append(n);box.append(l);params.push(n);}
    const update=()=>{item.layers=value.value===''?null:Number(value.value);item.partialParams=params.some(n=>n.value!=='')&&!params.every(n=>n.value!=='');item.params=params.every(n=>n.value!=='')?params.map(n=>Number(n.value)):undefined;delete item.owner;delete item.ownerTid;const choice=scope.value;if(choice==='actor')item.ownerTid=owner.id;else if(choice.startsWith('target:')){item.owner='target';item.targetIndex=Number(choice.split(':')[1]);}else item.owner=choice;if(item.owner==='card')item.cardTid=ui.card().id;ui.invalidate();};
    value.oninput=scope.onchange=update;params.forEach(n=>n.oninput=update);
    const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.onclick=()=>{ui.state.customStates=ui.state.customStates.filter(s=>s!==item);box.remove();ui.invalidate();};box.append(remove);selected.append(box);
   };
   const matches=item=>item.sourceTid===owner.id&&options.some(o=>o.id===item.id)&&(placement!=='target'||item.owner==='target'&&(item.targetIndex??0)===targetIndex);
   for(const item of ui.state.customStates.filter(matches))draw(item);
   add.onchange=()=>{const id=Number(add.value);if(!id)return;if(ui.state.customStates.some(s=>matches(s)&&s.id===id))return;const d=options.find(d=>d.id===id);const item={sourceTid:owner.id,casterTid:owner.id,id,layers:null,...d.scope==='team'?{owner:'team'}:d.scope==='card'?{owner:'card',cardTid:ui.card().id}:d.scope==='target'?{owner:'target',targetIndex}:{ownerTid:owner.id}};ui.state.customStates.push(item);draw(item);add.value='';ui.invalidate();};
  },
  realmSettings(parent,kind){
   if(kind==='card'){
    const group=document.createElement('details'),title=document.createElement('summary');title.textContent='손패·카드 더미';group.append(title);parent.append(group);
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
