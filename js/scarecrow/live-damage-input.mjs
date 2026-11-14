import {effectSnapshot} from './effect-presentation.mjs';
import {validateCovenantParts} from './covenant-stats.mjs';
import {flameOverride} from './character-conditions.mjs';
import {validateEnemies} from './enemy-loadout.mjs';
import {covenantSets,equippedCovenantParts} from './covenant-equipment.mjs';
import {makeDamageInput} from './damage-input.mjs';
const finite=(v,label,min=0)=>{const n=Number(v);if(!Number.isFinite(n)||n<min)throw Error(label+' 값을 확인하세요.');return n;};
const provided=v=>v!==null&&v!==undefined&&v!=='';
export function liveParty(catalog,people){
 return people.map(p=>{
  const c=catalog.characters.find(c=>c.id===p.id);if(!c)throw Error('각성체 데이터가 없습니다.');
  // Keep the three editable rows in saves; the build boundary expects one entry per attribute.
  const trinkets=validateCovenantParts(equippedCovenantParts(catalog,p)).map(piece=>{
   const sums=new Map();for(const sub of piece.sub||[])sums.set(sub.id,Number(((sums.get(sub.id)||0)+sub.value).toFixed(8)));
   return {...piece,sub:[...sums].map(([id,value])=>({id,value}))};
  });
  const equipment={weapons:[],trinkets};
  for(const slot of [1,2]){
   const name=p['gear'+slot];if(!name||name==='미장착')continue;
   const weapon=catalog.weapons.find(w=>p['gearId'+slot]?w.id===p['gearId'+slot]:w.name===name||w.id===Number(name));if(!weapon)throw Error('명륜을 다시 선택하세요.');
   const stack=finite(p['stack'+slot],'중첩'),enhancement=finite(p['refine'+slot],'강화');
   if(!Number.isInteger(stack)||stack>3||!Number.isInteger(enhancement)||enhancement>12||enhancement>0&&stack!==3)throw Error('명륜 강화는 중첩 3단계 이후에 설정하세요.');
   const attributes=weapon.growth?.levels[String(stack+enhancement)];if(!attributes)throw Error('명륜 성장 데이터가 없습니다.');
   equipment.weapons.push({id:weapon.id,refinement:stack,enhancement,attributes:{atk:0,def:0,physique:0,...attributes}});
  }
  const suits=covenantSets(catalog,p);
  return {tid:p.id,level:finite(p.level,'레벨',1),talent:finite(p.inherent??0,'내재영격'),madness:finite(p.sign??0,'광기의 징조'),soulTraining:finite(p.training??0,'영혼 단련'),potency:finite(p.potency??0,'돌파'),cardLevel:p.skill??1,skillLevels:Object.fromEntries(p.cards.map(c=>[c.id,c.level??p.skill??1])),weapon:0,refinement:0,suits,equipment,override:{}};
 });
}

export function selectedKeeper(catalog,state){
 // Explicit stable IDs, including zero, override legacy translated names.
 const keeper=state.keeperId!=null?catalog.keepers.find(k=>k.id===Number(state.keeperId)):catalog.keepers.find(k=>k.name===state.keeperName);
 if(!keeper&&(Number(state.keeperId)||state.keeperId==null&&state.keeperName&&state.keeperName!=='장착 안 함'))throw Error('은열쇠를 다시 선택하세요.');
 return keeper;
}

export async function makeLiveDamageInput({catalog,call,state,people,person,card,mechanics=[]}){
 for(const key of ['tentacles','tempTentacles','tentacleLimit'])if(provided(state[key])&&(!Number.isSafeInteger(Number(state[key]))||Number(state[key])<0))throw Error('촉수 개수와 상한은 0 이상의 정수로 입력하세요.');
 if(provided(state.tentacleLimit)&&provided(state.tentacles)&&Number(state.tentacles)>Number(state.tentacleLimit))throw Error('영구 촉수 개수가 현재 촉수 상한을 넘었습니다. 상한도 함께 설정하세요.');
 const party=liveParty(catalog,people),actor=people.findIndex(p=>p.id===person.id);
 const keeper=selectedKeeper(catalog,state);
 const result=await makeDamageInput({catalog,call,party,chapter:state.chapter==='망각편'?'StageChapterMorimens':'StageChapterStarsCameRight',accountLevel:state.accountLevel??60,actor,skill:card.id,skillLevel:card.level??person.skill??1,keeper:keeper?.id||0,relics:state.relicIds||[],seed:12345});
 const input=result.input,d=input.damage;
 d.snapshotRestore=true;
 d.ultimate=!!card.ulti;
 input.prepareSchoolInitialization=true;
 validateEnemies(state.enemies.map((e,i)=>({...e,tid:e.tid??[149116,22308][i]})));
 input.init.enemySnapshots=state.enemies.flatMap((enemy,index)=>enemy.base?[{tid:enemy.tid,point:index+1,level:enemy.level,properties:{atk:finite(enemy.base.attack,'적 기본 공격'),def:finite(enemy.base.defense,'적 기본 방어')}}]:[]);
 input.init.coverMonsters={};
 state.enemies.forEach((enemy,index)=>{Object.assign(input.init.coverMonsters,{['Monster'+(index+1)]:enemy.tid??[149116,22308][index],['MonsterPoint'+(index+1)]:index+1,['MonsterHp'+(index+1)]:finite(enemy.maxHp,'적 최대 HP',1)});});
 for(const [index,entry] of (state.spaceEntries||[]).entries()){
  if(!entry)continue;const owner=people.find(p=>p.id===entry.ownerTid),stored=owner?.cards.find(c=>c.id===entry.cardTid);
  if(!stored||stored.ulti)throw Error('초차원 공간의 카드를 확인하세요.');
  input.init.cards.push({uid:1000100+index,tid:stored.id,level:stored.level??1,deck:'DimensionDeck'});
 }
 let cardUid=1001000;
 for(const entry of state.otherCards||[]){
  const owner=people.find(p=>p.id===entry.ownerTid),stored=[...owner?.cards||[],...owner?.generated||[]].find(c=>c.id===entry.cardTid);
  if(!stored||stored.ulti||!['HandDeck','DrawDeck','GraveyardDeck','ConsumedDeck'].includes(entry.deck)||!Number.isSafeInteger(entry.count)||entry.count<1||entry.count>50)throw Error('다른 카드의 소유자·위치·장수를 확인하세요.');
  for(let n=0;n<entry.count;n++)input.init.cards.push({uid:cardUid++,tid:stored.id,level:stored.level??1,deck:entry.deck});
 }
 const prop=(owner,key,value,extra={})=>{if(provided(value))d.properties.push({owner,key,value:finite(value,key),...extra});};
 prop('team','hp',state.teamHp);prop('team','max_hp',state.teamMaxHp);prop('team','block',state.teamShield);
 prop('team','enhance_per',state.amp);prop('team','energy',state.energy??100);
 prop('team','keeper_energy',provided(state.key)?Number(state.key)/100*(state.keyCapacity??1000):null);
 if(provided(state.tentacleLimit)){prop('team','permanent_max_tentacle_count',state.tentacleLimit);prop('team','battle_max_tentacle_count',0);prop('team','bout_max_tentacle_count',0);}
 if(provided(state.tentacles)){prop('team','permanent_tentacle_count',state.tentacles);prop('team','battle_tentacle_count',0);}
 prop('team','bout_tentacle_count',state.tempTentacles);
 // Final displayed tentacle damage is not the pre-strength additive property.
 if(provided(state.tentacleDamage))d.tentacleDamage=finite(state.tentacleDamage,'촉수 피해');
 prop('team','scarlet_blood_count',state.furnace);prop('team','max_scarlet_blood_count',state.furnaceMax);
 prop('actor','ulti_energy',card.ulti?(person.rage??(person.superUltimate?200:100)):person.rage);
 const st=(id,owner,layers,extra={})=>{if(provided(layers))d.states.push({id,owner,layers:finite(layers,'상태 중첩'),...extra});};
 st(2900,'team',state.power);st(3469,'team',state.weakness);
 st(35501,'team',state.furnaceHeal);
 if(provided(card.beacon))st(126895,'card',card.beacon);
 if(provided(state.prism)){st(133368,'actor',state.prism);st(133993,'team',state.prism);}
 if(provided(person.breedingCharge))st(139039,'actor',person.breedingCharge);
 st(22067,'team',state.tentacleGathering);
 st(120351,'team',state.oceanDefenceCooldown);st(120354,'team',state.oceanFuryCooldown);
 st(80398,'team',state.dimensionCooldown);st(80399,'team',state.furnaceCooldown);
 prop('team','dimension_slot',state.spaceCapacity);
 d.spaceTurn=state.spaceTurn==='초차원 턴';
 state.enemies.forEach((enemy,index)=>{
  prop('target','hp',enemy.hp,{targetIndex:index});prop('target','max_hp',enemy.maxHp,{targetIndex:index});
  prop('target','atk',enemy.attack,{targetIndex:index});
  prop('target','block',enemy.shield,{targetIndex:index});prop('target','def',enemy.defense,{targetIndex:index});
  st(2934,'target',enemy.vulnerable,{targetIndex:index});st(3469,'target',enemy.weakness,{targetIndex:index});
 });
 for(const effect of mechanics){
  const source=effect.sourceTid??effect.ownerTid,key=source+':'+effect.stateId;
  if(!state.mechanicEdited?.includes(key))continue;
  const {stateId,...value}=effect;d.states.push({id:stateId,...value,casterTid:source});
 }
 // Explicit zeros clear a state; a blank field preserves original preparation.
 for(const item of (state.customStates||[]).map(effectSnapshot)){if(!provided(item.layers)||item.owner==='card'&&item.cardTid&&item.cardTid!==card.id)continue;const layers=finite(item.layers,'현재 상태');if(!Number.isInteger(layers))throw Error('상태 중첩은 정수로 입력하세요.');if(!people.some(p=>p.id===item.sourceTid)||item.ownerTid&&!people.some(p=>p.id===item.ownerTid))throw Error('현재 편성의 상태 소유자를 확인하세요.');d.states.push({...item,id:Number(item.id),layers,casterTid:item.casterTid??item.sourceTid});}
 // A custom snapshot replaces the compact editor for the same concrete owner.
 d.states=[...new Map(d.states.map(s=>[[s.owner??'actor',s.ownerTid??'',s.targetIndex??'',s.id].join(':'),s])).values()];
 for(const p of people){
  if(p.actorUsed==='이미 사용')d.states.push({id:80187,ownerTid:p.id,layers:1});
  if(p.id===77917&&p.actorUsed==='이미 사용'&&!d.states.some(s=>s.id===117853&&s.ownerTid===77917))d.states.push({id:117853,ownerTid:77917,layers:0});
 }
 const flame=flameOverride(people,state.flame);if(flame!==undefined)d.flame=flame;
 if(state.crit==='치명'||state.crit==='비치명')d.critical=state.crit==='치명';
 if(provided(card.currentCost))d.cardCost=finite(card.currentCost,'현재 카드 비용');
 if(state.stance)d.oceanModel={조수:'OceanModel1',정해:'OceanModel2',노도:'OceanModel3'}[state.stance];
 if(provided(state.used))d.history.push({scope:'CurBoutStats',key:'UsedCardCount',value:finite(state.used,'사용한 카드 수')});
 if(provided(state.ultiCount))d.history.push({scope:'CurBoutStats',key:'UltiSkillCount',value:finite(state.ultiCount,'광기폭발 횟수')});
 if(provided(state.turn))d.history.push({scope:'BattleStats',key:'BoutCount',value:Math.max(0,finite(state.turn,'현재 턴')-1)});
 const pre=state.keyAction==='지령 사용'?'keeper':state.keyAction==='은열쇠 각성'?'silver':null;
 if(pre&&!keeper)throw Error('은열쇠를 장착한 뒤 지령이나 각성을 사용하세요.');
 if(pre){d.preparing=true;input.actions.push({op:pre});}
 // Target selection stays with the original card command. No free enemy picker.
 input.actions.push(card.ulti?{op:'ulti',actorTid:person.id,measureStart:!!pre}:{op:'card',cardUid:1000000,measureStart:!!pre});
 return {...result,input};
}
