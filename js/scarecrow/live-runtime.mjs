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
  if(Array.isArray(source.explicit))for(const key of ['power','weakness','amp','teamHp','teamMaxHp','teamShield','key','tentacles','tempTentacles','tentacleDamage','furnace','furnaceMax','furnaceHeal','prism','tentacleGathering','oceanDefenceCooldown','oceanFuryCooldown','dimensionCooldown','furnaceCooldown','spaceCapacity'])if(!source.explicit.includes(key))copy[key]=null;
  if(!source.explicit.includes('person.breedingCharge'))delete copy.breedingCharge;
  for(let i=0;i<copy.enemies.length;i++)for(const key of ['hp','maxHp','shield','defense','vulnerable','weakness']){
   if(!source.explicit.includes('enemy.'+i+'.'+key)&&!['hp','maxHp'].includes(key))copy.enemies[i][key]=null;
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
  auto('tentacles',(props.permanent_tentacle_count||0)+(props.battle_tentacle_count||0));auto('tempTentacles',props.bout_tentacle_count||0);auto('spaceCapacity',props.dimension_slot||5);
  auto('tentacleDamage',initial.tentacleDamage);auto('furnace',props.scarlet_blood_count||0);auto('furnaceMax',props.max_scarlet_blood_count||200);auto('amp',props.enhance_per||0);
  const teamStates=arr(team?.states);auto('power',teamStates.filter(s=>s.stateId===2900).reduce((n,s)=>n+s.layer,0));auto('weakness',teamStates.filter(s=>s.stateId===3469).reduce((n,s)=>n+s.layer,0));auto('furnaceHeal',teamStates.filter(s=>s.stateId===35501).reduce((n,s)=>n+s.layer,0));
  for(const [key,id] of [['tentacleGathering',22067],['oceanDefenceCooldown',120351],['oceanFuryCooldown',120354],['dimensionCooldown',80398],['furnaceCooldown',80399]])auto(key,teamStates.filter(s=>s.stateId===id).reduce((n,s)=>n+s.layer,0));
  for(const [i,enemy] of arr(initial.roles).filter(r=>r.camp===2).entries()){
   const current=state.enemies[i];if(!current)continue;
   for(const [key,prop] of [['hp','hp'],['maxHp','max_hp'],['defense','def'],['shield','block']])current[key]=enemy.properties[prop]||0;
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
  ui.state.result=true;delete ui.root.dataset.calculationError;ui.root.dataset.lastDamageInput=JSON.stringify(input);ui.root.dataset.lastDamage=JSON.stringify(result.damage);ui.close();ui.render();status('계산 완료');
 }
 const siteWheels=await fetch('data/wheel_list.json').then(r=>r.json()),siteKeys=await fetch('data/silverkey_list.json').then(r=>r.json());
 const live={data,catalog,call,siteWheels,siteKeys,
  async preparedInput(){return (await input()).input;},
  snapshot(){return structuredClone({state:ui.state,people:ui.people(),card:ui.card()});},
  attach(context){ui=context;ui.state.explicit=[];ui.state.mechanicEdited=[];ui.state.customStates=[];ui.state.accountLevel=60;ui.state.chapter='성신편';ui.state.keeperId=catalog.keepers[0]?.id;ui.state.relics=[];ui.state.turn=1;ui.state.used=0;
   ui.state.spaceEntries=[];ui.state.otherCards=[];ui.state.spaceCards=0;for(const p of data.people)for(const c of p.cards)c.level=1;
   ui.state.keeperName=catalog.keepers[0]?.name;ui.render();timer=setTimeout(prepare,0);
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
  growth(parent,owner){
   const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='게임 표시 최종 능력치';detail.append(summary);
   const grid=document.createElement('div');grid.className='fields';detail.append(grid);parent.append(detail);
   for(const [key,name] of [['atk','공격'],['def','방어'],['physique','체질']]){const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.type='number';input.min='0';input.placeholder='자동';input.setAttribute('aria-label',name+' 최종 능력치');input.value=owner.finalAttributes?.[key]??'';input.oninput=()=>{owner.finalAttributes??={};if(input.value==='')delete owner.finalAttributes[key];else owner.finalAttributes[key]=Number(input.value);ui.invalidate();};label.append(input);grid.append(label);}
   if(!owner.contract||owner.contract==='미장착')return;
   const options=document.createElement('details'),head=document.createElement('summary');head.textContent='비밀계약 주·부옵션';options.append(head);parent.append(options);
   const labels={atk:'공격',def:'방어',physique:'체질',crit:'치명 확률',crit_damage:'치명 피해',occupation_master:'영역 숙련',death_resist:'죽음 저항',basic_damage_per:'피해 강효',blackcoin_upgrade_per:'흑인장 획득',keeper_energy_eff_2:'은열쇠 충전',ulti_energy_plus_3:'광기 충전'};
   for(let position=1;position<=6;position++){
    const row=document.createElement('details'),title=document.createElement('summary');title.textContent=position+'번 부위';row.append(title);options.append(row);
    const fields=document.createElement('div');fields.className='fields';row.append(fields);
    const current=owner.trinkets?.find(p=>p.position===position)||{position,main:0,quality:'Orange',level:0,bound:false,sub:[]};
    const control=(name,choices,value)=>{const label=document.createElement('label');label.textContent=name;const n=document.createElement(choices?'select':'input');if(choices)for(const [id,text] of choices)n.add(new Option(text,String(id)));else{n.type='number';n.min='0';n.step='any';}n.value=value??'';n.setAttribute('aria-label',position+'번 '+name);label.append(n);fields.append(label);return n;};
    const attrs=ids=>ids.map(id=>[id,labels[data.equipmentMetadata.attributes[id].name]||'추가 속성']);
    const main=control('주옵션',[[0,'미설정'],...attrs(data.equipmentMetadata.slots[position-1].main)],current.main),quality=control('품질',[['Orange','주황'],['Purple','보라'],['Blue','파랑']],current.quality),level=control('강화',null,current.level);level.step='1';level.max='12';
    const sub=[];for(let i=0;i<4;i++)sub.push([control('부옵션 '+(i+1),[[0,'없음'],...attrs(data.equipmentMetadata.slots[position-1].sub)],current.sub[i]?.id||0),control('부옵션 '+(i+1)+' 수치',null,current.sub[i]?.value??0)]);
    const update=()=>{current.main=Number(main.value);current.quality=quality.value;current.level=Number(level.value);current.sub=sub.filter(([select])=>Number(select.value)).map(([select,n])=>({id:Number(select.value),value:Number(n.value)}));owner.trinkets=(owner.trinkets||[]).filter(p=>p.position!==position);if(current.main)owner.trinkets.push(current);ui.invalidate();};
    [main,quality,level,...sub.flat()].forEach(n=>n.onchange=n.oninput=update);
   }
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
    for(const name of scopes){if(name==='target'){for(let i=0;i<ui.state.enemies.length;i++)scope.add(new Option(data.enemies[i].name,'target:'+i));}else scope.add(new Option({actor:owner.name,team:'아군 공용',card:'선택 카드'}[name],name));}
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
