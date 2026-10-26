import {connectParty} from './live-party-bridge.mjs';
import {createLiveRuntime} from './live-runtime.mjs';
globalThis.scarecrowLive=await createLiveRuntime();

(()=>{
const root=document.getElementById('sc-previsual'),q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)],D=globalThis.scarecrowLive.data;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;},img=(src,alt='')=>{const n=el('img');n.src=src;n.alt=alt;return n;};
q('.friendly').append(q('.team-panel'));q('.battle').insertBefore(q('.hud'),q('.dock'));
// Party-derived rule context. These are rule parameters, not final card damage.
function inferRealmContext(party, specialLists) {
  const counts={chaos:0,aequor:0,caro:0,ultra:0};
  for(const p of party) if(p && p.realm in counts) counts[p.realm]++;
  const hasSpecial=key=>party.some(p=>(specialLists[key]||[]).includes(p.id));
  const primordial=hasSpecial('NewChaosSchoolAwakerList');
  const variants={
    chaos:primordial?'primordial':'base',
    aequor:hasSpecial('NewOceanSchoolAwakerList')?'reverberant':'base',
    caro:hasSpecial('NewBloodSchoolAwakerList')?'breeding':'base',
    ultra:hasSpecial('NewDimensionSchoolAwakerList')?'singularity':'base'
  };
  const pure={};
  for(const realm of Object.keys(counts)) {
    const others=Object.keys(counts).filter(r=>r!==realm&&r!=='chaos');
    pure[realm]=counts[realm]>0 && (realm==='chaos'
      ? counts.chaos===party.length
      : others.every(r=>counts[r]===0)&&(!primordial||counts.chaos===0));
  }
  return {counts,variants,pure,symbiosis:counts.chaos>0&&!primordial&&counts.chaos<party.length,
    masteryMultiplier:Object.fromEntries(Object.keys(counts).map(r=>[r,pure[r]?2:1])),
    keyEnergyCapacity:primordial?2000:1000,
    keyChargeRule:primordial?'each-owner-first-command':'spent-card-cost',
    tentacleGathering:counts.aequor>0&&variants.aequor==='base',
    oceanStanceCooldown:variants.aequor==='reverberant'?3:0,
    furnaceCooldown:variants.caro==='breeding'?3:0,
    dimensionTransition:variants.ultra==='singularity'?'replace-current-turn':'extra-turn',
    dimensionAnnihilation:variants.ultra==='singularity'?'retrieve-left-card':'remove-left-card',
    dimensionAnnihilationCooldown:variants.ultra==='singularity'?3:0};
}

function realmRuleValues(context,{maxHp,currentHp,mastery=null,spaceTurn=false}={}) {
  const H=Math.max(1,Number(maxHp)||1),h=Math.max(0,Math.min(H,Number(currentHp)||0));
  const masteryAvailable=mastery!==null&&Number.isFinite(Number(mastery));
  const lost=(H-h)/H,M=masteryAvailable?Math.max(0,Number(mastery)):null;
  const newOcean=context.variants.aequor==='reverberant';
  const newBlood=context.variants.caro==='breeding';
  const newSpace=context.variants.ultra==='singularity';
  return {
    masteryAvailable,
    // Do not replace final tentacle damage with this base term: other effects apply later.
    tentacleBaseKind:newOcean?'team-max-hp':'team-attack-and-keeper-level',
    tentacleBaseHpTerm:newOcean?H*.05:null,
    oceanDefenceShield:!masteryAvailable ? null : newOcean ? Math.ceil(H*(.25+M*.00025)) : Math.ceil(H*.01*(8+M/100)),
    oceanDefenceEndAttack:!newOcean,
    oceanFuryDamagePercent:newOcean ? (masteryAvailable?125+Math.ceil(.025*M):null) : 125,
    oceanFuryFollowupPercent:newOcean ? 100 : (masteryAvailable?50+Math.ceil(M/50):null),
    embryoFusionPerTurn:(newBlood?50:30)*(1+lost),
    // This is the separate Scarlet Furnace healing pool, NOT the embryo fusion bar.
    furnaceHealingCapacity:H*(newBlood ? .5 : .25),
    bloodFirstSwallow:newBlood?'owner-breeding-charge':'team-shield-and-power',
    breedingChargeAtTurnStart:newBlood ? (masteryAvailable?Math.ceil(20*(1+.0005*M)):null) : 0,
    breedingChargeAtFirstConsumption:newBlood ? (masteryAvailable?Math.ceil(40*(1+.0005*M)):null) : 0,
    dimensionTurnMultiplier:spaceTurn&&!newSpace&&!context.pure.ultra ? .75 : 1,
    singularityBeaconOnTransfer:newSpace ? (masteryAvailable?Math.ceil(25*(1+.0005*M)):null) : 0
  };
}

// Reviewed inputs only. Reachable State rows are audit candidates, never UI controls.
const characterMechanics = Object.freeze({
  77917: Object.freeze([
    {key:'pain',label:'고통구원 잔여 적용 카드',stateId:117853,max:99,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTAfterBoutEnd','BSTBeforeBattleEnd'],consumption:'owner command card only'},
    {key:'sinner',label:'죄인',stateId:117346,max:999999,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_078.png',clear:['BSTBeforeBattleEnd'],consumption:'preserve original trigger rules'},
    {key:'polluxRepeat',label:'다음 명령 카드 추가 발동',stateId:117355,max:999999,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTBeforeBattleEnd'],consumption:'next own command card'},
    {key:'whiteNight',label:'백야의 빛을 비추며 · 남은 턴',stateId:117851,max:99,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTBeforeBattleEnd'],consumption:'original duration reduction'},
  ]),
  15576: Object.freeze([
    {key:'murphyInheritance',label:'허망한 계승자 · 남은 턴',stateId:35811,max:999999999,scope:'team',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTBeforeBattleEnd'],consumption:'damage reception trigger; duration separate from sacrifice amount'},
  ]),
  15585: Object.freeze([
    {key:'ogierResolve',label:'헌신의 결의 · 남은 턴',stateId:54071,max:999999999,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTBeforeBattleEnd'],consumption:'active damage count +1 while active'},
  ]),
  130901: Object.freeze([
    {key:'vortexLoading',label:'소용돌이 장전 · 남은 횟수',stateId:131351,max:99999,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_081.png',clear:['BSTBeforeBattleEnd'],consumption:'another awakener ultimate'},
    {key:'vortexRepeat',label:'와류탄 2회 발동 · 남은 횟수',stateId:131684,max:9999,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTBeforeBattleEnd'],consumption:'next vortex projectile effects'},
  ]),
  15589: Object.freeze([
    {key:'birthPact',label:'명계 · 중첩',stateId:120320,max:5,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTBeforeBattleEnd'],consumption:'next false princess; five-layer damage-count boundary'},
  ]),
  77918: Object.freeze([
    {key:'weaveFate',label:'직명',stateId:134237,max:999999999,scope:'team',input:'current',hud:true,icon:'IconS_Buff_084.png',clear:[],consumption:'ultimate follow-up; actual capacity depends on growth state'},
    {key:'weaveNet',label:'영겁의 베틀 추가 생성 · 남은 횟수',stateId:134240,max:999999999,scope:'team',input:'current',hud:true,icon:'IconS_Buff_016.png',clear:['BSTBeforeBattleEnd'],consumption:'next eternal weaving uses'},
  ]),
  77921: Object.freeze([
    {key:'offering',label:'봉헌',stateId:145229,max:5,scope:'team',input:'current',hud:true,icon:'IconS_Buff_092.png',clear:['LisStageEndAfter'],consumption:'ultimate; survives battle end'},
  ]),
  130226: Object.freeze([
    {key:'featherSeed',label:'우종',stateId:138824,max:4,scope:'team',input:'current',hud:true,icon:'IconS_Buff_087.png',clear:[],consumption:'ultimate; survives battle end'},
  ]),
  141302: Object.freeze([
    {key:'groupHunt',label:'집단 사냥',stateId:143340,max:9,scope:'owner',input:'current',hud:true,icon:'IconS_Buff_090.png',clear:[],consumption:'imprisoned nightmare; survives battle end'},
  ]),
});

function mechanicFields(ownerId){
  return (characterMechanics[ownerId]||[]).map(x=>({...x,clear:[...x.clear]}));
}

// Battle snapshot belongs to this party, not the selected portrait or array slot.
function reconcileMechanicParty(partyIds,previous={}){
  if(new Set(partyIds).size!==partyIds.length)throw new Error('Duplicate party member');
  return Object.fromEntries(partyIds.map(id=>[id,Object.fromEntries(mechanicFields(id).map(f=>{
    const raw=previous[id]?.[f.key];
    return [f.key,Number.isInteger(raw)&&raw>=0&&raw<=f.max?raw:0];
  }))]));
}

function setMechanicValue(snapshot,partyIds,ownerId,key,value){
  if(!partyIds.includes(ownerId))throw new Error('Mechanic owner is not in the party');
  const field=mechanicFields(ownerId).find(f=>f.key===key);
  if(!field)throw new Error('Unreviewed mechanic');
  if(!Number.isInteger(value)||value<0||value>field.max)throw new Error('Invalid mechanic value');
  const next=reconcileMechanicParty(partyIds,snapshot);
  next[ownerId][key]=value;
  return next;
}

function partyMechanicHud(partyIds,snapshot){
  return partyIds.flatMap(ownerId=>mechanicFields(ownerId)
    .filter(f=>f.hud&&(snapshot[ownerId]?.[f.key]||0)>0)
    .map(f=>({...f,ownerId,value:snapshot[ownerId][f.key]})));
}

function mechanicEngineContext(partyIds,snapshot){
  // Context contract only: never inject a layer into a live game or silently
  // substitute a hidden growth counter for a displayed state.
  return partyIds.flatMap(sourceTid=>mechanicFields(sourceTid)
    .filter(f=>(snapshot[sourceTid]?.[f.key]||0)>0)
    .map(f=>({... (f.scope==='team'?{owner:'team',sourceTid}:{ownerTid:sourceTid}),stateId:f.stateId,layers:snapshot[sourceTid][f.key]})));
}

const state={partyIds:[77917,15576,15585,130901],person:0,card:0,party:false,power:52,weakness:1,teamHp:1476,teamMaxHp:2029,teamShield:12,spaceCards:1,spaceOwner:'폴룩스',spaceCapacity:5,spaceTurn:'일반 턴',tentacles:2,tempTentacles:0,tentacleDamage:230,tentacleGathering:0,oceanDefenceCooldown:0,oceanFuryCooldown:0,dimensionCooldown:0,beacon:0,prism:15,stance:'조수',furnace:12,furnaceMax:200,furnaceCooldown:0,furnaceHeal:39,amp:0,key:75,turn:1,used:0,ulti:'미사용',keyAction:'없음',flame:'자동',crit:'자동',enemies:[{defense:100,shield:0,hp:6733,maxHp:8189,vulnerable:1,weakness:2,previewDamage:null},{defense:100,shield:0,hp:12140,maxHp:12140,vulnerable:0,weakness:1,previewDamage:null}],relics:[0,1],result:false};
state.mechanics=reconcileMechanicParty(state.partyIds);
let editor='',enemyEdit=0,trigger=null;const people=()=>state.partyIds.map(id=>D.people.find(p=>p.id===id)),person=()=>people()[state.person],card=()=>person().cards[state.card]||person().cards[0];
const target=()=>{const r=card().target;return r==='FrontEnemy'?{ids:[0],label:'맨 앞의 적'}:r==='AllEnemy'?{ids:[0,1],label:'적 전체'}:r==='PlayerRole'?{ids:[],label:'아군 팀'}:r==='CmdCaster'?{ids:[],label:'시전자'}:{ids:[],label:'원본 효과에 따라 결정'};};
function close(){q('.editor').hidden=true;if(state.party)q('.party').hidden=false;trigger?.focus({preventScroll:true});}
function invalidate(){state.result=false;state.calculation=null;globalThis.scarecrowLive.invalidate();}
function realmContext(){return inferRealmContext(people(),D.specialLists);}
function realmName(realm,context=realmContext()){
 const base={chaos:'혼돈',aequor:'심해',caro:'혈육',ultra:'초차원'};
 const special={primordial:'원초 혼돈',reverberant:'회명 심해',breeding:'번식 혈육',singularity:'특이점 초차원'};
 return special[context.variants[realm]]||base[realm];
}
function replaceMember(index,id){
 if(!D.people.some(p=>p.id===id)||state.partyIds.some((x,i)=>i!==index&&x===id))return;
 if(state.partyIds[index]===id){close();return;}
 const before=realmContext();const old=people()[index];old.actorUsed="미사용";delete old.breedingCharge;old.cards.forEach(c=>c.beacon=0);state.partyIds[index]=id;state.mechanics=reconcileMechanicParty(state.partyIds,state.mechanics);const after=realmContext();
 if(before.variants.aequor!==after.variants.aequor||!after.counts.aequor){state.stance='조수';state.tentacleDamage=null;state.tentacleGathering=0;state.oceanDefenceCooldown=0;state.oceanFuryCooldown=0;}
 if(before.variants.ultra!==after.variants.ultra||!people().some(p=>p.name===state.spaceOwner)){state.spaceCards=0;state.spaceOwner=(people().find(p=>p.realm==='ultra')||people()[0]).name;state.spaceTurn='일반 턴';state.dimensionCooldown=0;D.people.forEach(p=>p.cards.forEach(c=>c.beacon=0));}
 if(before.variants.caro!==after.variants.caro)state.furnaceCooldown=0;
 state.person=index;state.card=0;invalidate();close();render();persist();
 q('.party-slot:nth-child('+(index+1)+') .party-swap')?.focus({preventScroll:true});
}
function pick(p,c,focus='card'){state.person=p;state.card=c;invalidate();close();render();q('.'+focus+'[aria-pressed=true]')?.focus({preventScroll:true});}
function persist(){globalThis.openai?.setWidgetState?.({modelContent:{partyIds:state.partyIds,actor:person().name,card:card().name,target:target().label},privateContent:null})?.catch(()=>{});}
function statusIcon(name,value,src,onclick){const b=el('button');b.className='status-icon';b.setAttribute('aria-label',name+' '+value+' 설정');b.dataset.tooltip=name;b.append(img(src),el('span',String(value)));b.onclick=()=>onclick(b);return b;}
function health(hp,max,shield,ally,onclick){const b=el('button');b.className='health '+(ally?'ally-health':'enemy-health');b.setAttribute('aria-label',(ally?'아군':'적')+' HP '+hp+' / '+max+', 보호막 '+shield+' 설정');const meter=el('span');meter.className='hp-bar';meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',ally?'아군 HP':'적 HP');meter.setAttribute('aria-valuenow',hp);meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',max);const fill=el('span');fill.className='hp-fill';fill.style.width=Math.max(0,Math.min(100,hp/Math.max(1,max)*100))+'%';fill.style.backgroundImage='url('+D.hud[ally?'hpGreen':'hpRed']+')';meter.append(fill);const value=el('span',hp+' / '+max);value.className='hp-value';const main=el('span');main.className='hp-main';main.append(meter,value);for(const side of ['left','right']){const end=img(D.hud.hpEnd);end.className='hp-end hp-end-'+side;main.append(end);}b.append(main);if(shield){const s=el('span');s.className='shield-value';s.append(img(D.hud.shield),el('span',String(shield)));b.append(s);}b.onclick=()=>onclick(b);return b;}
function realms(){const box=q('.realm-hud');box.replaceChildren();const context=realmContext(),has=r=>context.counts[r]>0;
 if(has('ultra')){const b=el('button');b.className='realm-control space-control';b.dataset.variant=context.variants.ultra;b.setAttribute('aria-label','초차원 공간 설정');b.append(el('span','초차원 공간'+(state.spaceTurn==='초차원 턴'?' · 초차원 턴':'')));const row=el('span');row.className='space-row';row.append(img(D.hud.space));for(let i=0;i<state.spaceCapacity;i++){const slot=el('span');slot.className='space-slot';if(state.spaceEntries?.[i]){slot.append(img(D.people.find(p=>p.id===state.spaceEntries?.[i]?.ownerTid)?.art||person().art));slot.dataset.occupied='true';}else{slot.append(img(D.hud.spaceBase),img(D.hud.spaceStar));}row.append(slot);}if(state.spaceTurn==='초차원 턴'){const flag=el('span','초차원 턴');flag.className='realm-flag';row.append(flag);}b.dataset.tooltip='초차원 공간';b.append(row);b.onclick=()=>show('space',b);box.append(b);}
 if(has('aequor')){const b=el('button');b.className='realm-control ocean-control';b.dataset.variant=context.variants.aequor;b.dataset.stance=state.stance;b.setAttribute('aria-label','촉수 설정');b.append(el('span','촉수 · '+state.stance));const row=el('span');row.className='ocean-row';const count=state.tentacles+state.tempTentacles;const art=D.hud[state.stance==='정해'?'tentacleGray':state.stance==='노도'?'tentacleRed':'tentacle'];const main=el('span');main.className='tentacle-main';main.dataset.active=String(count>0);const backdrop=img(D.hud.oceanSlot);backdrop.className='tentacle-backdrop';const frame=el('span');frame.className='tentacle-frame';frame.style.setProperty('--frame-art','url('+D.hud.oceanFrame+')');const ray=img(D.hud.oceanRay);ray.className='tentacle-ray';const body=img(art);body.className='tentacle-body';const damage=el('strong',(state.tentacleDamage==null?'—':state.tentacleDamage)+' × '+count);damage.className='tentacle-damage';main.append(frame,ray,backdrop);if(count)main.append(body);main.append(damage);if(count>1){const total=el('span',state.tentacleDamage==null?'—':'('+state.tentacleDamage*count+')');total.className='tentacle-total';main.append(total);}row.append(main);const slots=el('span');slots.className='tentacle-slots';for(let i=1;i<5;i++){const slot=el('span');slot.className='tentacle-slot';slot.dataset.active=String(i<count);slot.append(img(i>=state.tentacles?D.hud.oceanTempSlot:D.hud.oceanSlot));if(i<count){const small=img(art);small.className='tentacle-small';slot.append(small);}slots.append(slot);}row.append(slots);b.dataset.tooltip='촉수 · '+state.stance;b.append(row);b.onclick=()=>show('tentacle',b);box.append(b);}
 if(has('caro')){const b=el('button');b.className='realm-control furnace-control';b.dataset.variant=context.variants.caro;b.setAttribute('aria-label','스칼렛 용광로 설정');b.append(el('span','스칼렛 용광로'+(state.furnaceCooldown?' · '+state.furnaceCooldown+'턴':'')));const row=el('span');row.className='furnace-row';const meter=el('span');meter.className='furnace-meter';meter.style.backgroundImage='url('+D.hud.furnaceFrame+')';const fill=el('span');fill.style.width=Math.max(0,Math.min(100,state.furnace/Math.max(1,state.furnaceMax)*100))+'%';fill.style.backgroundImage='url('+D.hud.furnaceFill+')';meter.append(fill,el('strong',state.furnace+' / '+state.furnaceMax));const heal=el('span');heal.className='furnace-heal';heal.setAttribute('aria-label','혈육 회복량 '+state.furnaceHeal);heal.append(img(D.hud.furnaceHeal),el('span',String(state.furnaceHeal)));row.append(heal,meter,img(D.hud.furnace));if(state.furnaceCooldown){const cooldown=el('span',state.furnaceCooldown+'턴');cooldown.className='realm-flag';row.append(cooldown);}b.dataset.tooltip='스칼렛 용광로';b.append(row);b.onclick=()=>show('furnace',b);box.append(b);}
}
function render(){D.key=D.keys.find(k=>k.name===state.keeperName)||D.keys[0];
 const context=realmContext();root.dataset.partyIds=JSON.stringify(state.partyIds);root.dataset.realmContext=JSON.stringify(context);root.dataset.realmRules=JSON.stringify(realmRuleValues(context,{maxHp:state.teamMaxHp,currentHp:state.teamHp,spaceTurn:state.spaceTurn==='초차원 턴'}));realms();q('.party-realms').replaceChildren(...Object.keys(context.counts).filter(r=>context.counts[r]).map(r=>el('span',realmName(r,context))));q('.team-health').replaceChildren(health(state.teamHp,state.teamMaxHp,state.teamShield,true,b=>show('team-hp',b)));q('.team-icons').replaceChildren();if(state.weakness)q('.team-icons').append(statusIcon('허약',state.weakness,D.hud.weakness,b=>show('team',b)));for(const effect of partyMechanicHud(state.partyIds,state.mechanics)){const owner=D.people.find(p=>p.id===effect.ownerId);const name=effect.key==='pain'?'고통구원':effect.label;q('.team-icons').append(statusIcon(name,effect.value,D.hud[effect.key]||D.mechanicIcons[effect.icon],b=>show('actor-'+owner.id,b)));}root.dataset.mechanicContext=JSON.stringify(mechanicEngineContext(state.partyIds,state.mechanics));
 q('.party').hidden=!state.party;q('.battle').hidden=state.party;q('[data-party]').textContent=state.party?'편성 완료':'파티 편집';
 q('.allies').replaceChildren();q('.party-grid').replaceChildren();
 people().forEach((p,i)=>{const b=el('button');b.className='unit';b.style.setProperty('--sd-anchor',p.sdAnchor);b.style.setProperty('--sd-height',p.sdHeight+'px');b.setAttribute('aria-label',p.name+' 카드 선택');b.setAttribute('aria-pressed',String(state.person===i));b.dataset.tooltip=p.name;b.append(img(p.sd));b.onclick=()=>{pick(i,0,'unit');persist();};q('.allies').append(b);const t=el('button');t.className='party-tile';t.append(img(p.sd),el('strong',p.name),el('span','Lv.'+p.level+' · 돌파 '+p.potency),el('span','성장 · 명륜 · 비밀계약'));t.onclick=()=>{state.person=i;state.card=0;invalidate();render();show('growth',t);};const slot=el('div');slot.className='party-slot';const swap=el('button','교체');swap.className='party-swap';swap.setAttribute('aria-label',(i+1)+'번 각성체 교체');swap.onclick=()=>{state.person=i;show('party-member',swap);};slot.append(t,swap);q('.party-grid').append(slot);});
 q('.relics').replaceChildren();state.relics.forEach(i=>{const r=D.relics[i],b=el('button');b.className='relic';b.setAttribute('aria-label',r.name+' 설정');b.append(img(r.image));b.onclick=()=>show('relic-'+i,b);q('.relics').append(b);});const add=el('button','＋');add.className='add';add.setAttribute('aria-label','유물 편집');add.onclick=()=>show('relics',add);q('.relics').append(add);
 q('.enemies').replaceChildren();D.enemies.forEach((p,i)=>{const unit=el('section');unit.className='enemy-slot';const b=el('button');b.className='enemy';b.dataset.hit=String(target().ids.includes(i));b.setAttribute('aria-label',p.name+' 상태 편집');const n=el('span',p.name);n.className='enemy-name';b.append(img(p.image),n);b.onclick=()=>{enemyEdit=i;show('enemy',b);};const e=state.enemies[i];const hp=health(e.hp,e.maxHp,e.shield,false,from=>{enemyEdit=i;show('enemy-hp',from);});const states=el('div');states.className='status-strip';for(const [key,name]of [['vulnerable','취약'],['weakness','허약']])if(e[key])states.append(statusIcon(name,e[key],D.hud[key],from=>{enemyEdit=i;show('enemy',from);}));unit.append(b,hp,states);q('.enemies').append(unit);});
 q('[data-summary]').hidden=!state.result;q('[data-summary]').replaceChildren();if(state.result){const entered=!!state.calculation;q('[data-summary]').dataset.critical=String(state.calculation?.critical??state.crit==='치명');const label=el('span','총 피해');label.className='result-label';const total=el('strong',entered?state.calculation.total.toLocaleString():'—');total.className='result-value';q('[data-summary]').append(label,total);if(target().ids.length>1){for(const i of target().ids){const row=el('span');row.className='result-target';row.append(el('span',D.enemies[i].name),el('span',state.calculation?.targets[i]?.damage?.toLocaleString()??'—'));q('[data-summary]').append(row);}}}
 q('.cards').replaceChildren();person().cards.forEach((c,i)=>{if(c.ulti)return;const b=el('button');b.className='card';b.setAttribute('aria-pressed',String(state.card===i));b.setAttribute('aria-label',c.name);const cost=el('span',String(c.currentCost??c.calculatedCost??c.cost??'—'));cost.className='cost';const n=el('span',c.name);n.className='card-name';const head=el('span');head.className='card-head';head.append(cost,n);b.append(img(person().art),head);b.onclick=()=>{pick(state.person,i);persist();};q('.cards').append(b);});q('.cards').style.setProperty('--hand-count',String(Math.min(7,person().cards.filter(c=>!c.ulti).length)));q('[data-ultimate]').setAttribute('aria-pressed',String(!!card().ulti));
 q('[data-owner]').textContent=person().name;q('[data-selection]').textContent=card().name+' · '+target().label;q('[data-power]').textContent=state.power;q('[data-amp]').textContent=state.amp;q('[data-amp]').closest('button').hidden=state.amp===0;q('[data-key]').textContent=state.key+'%';q('[data-key-fill]').style.width=state.key+'%';q('[data-key-ring]').style.background='conic-gradient(var(--gold) '+(state.key*3.6)+'deg,#ffffff18 0)';q('[data-key-image]').src=D.key.image;q('[data-history]').textContent=state.used?state.used+'장':'';q('[data-run]').disabled=!!state.calculating;q('[data-run]').textContent=state.calculating?'계산 중…':'피해 계산';q('[data-icon=power]').src=D.power;
}
function appendMechanicFields(grid,owner){for(const f of mechanicFields(owner.id))grid.append(field(f.label,'mechanic.'+owner.id+'.'+f.key,state.mechanics[owner.id]?.[f.key]??0,null,f.max));}
function field(label,key,value,options,max){const l=el('label',label),n=el(options?'select':'input');if(options)options.forEach(x=>{const o=el('option',x);o.value=x;n.append(o);});else{n.type='number';n.min='0';n.max=String(max??999999);}n.value=value;n.dataset.field=key;n.setAttribute('aria-label',label);n.placeholder='자동';for(const event of ['input','change'])n.addEventListener(event,()=>globalThis.scarecrowLive.changed(key));l.append(n);return l;}
function text(t){const p=el('p',t);p.className='readout';return p;}
function show(kind,from){if(['party-member','relics'].includes(kind)){globalThis.scarecrowLive.requestPicker(kind);return;}editor=kind;trigger=from||root.ownerDocument.activeElement;const sheet=q('.editor');if(state.party)q('.party').after(sheet);else q('.field').after(sheet);sheet.hidden=false;q('[data-apply]').hidden=false;const body=q('[data-body]');body.replaceChildren();const grid=el('div');grid.className='fields';body.append(grid);let title='';
 if(kind==='team'){title='아군 효과';grid.append(field('힘','power',state.power),field('피해 증폭 (%)','amp',state.amp),field('허약 중첩','weakness',state.weakness));}
 if(kind==='team-hp'){title='아군 HP·보호막';grid.append(field('현재 HP','teamHp',state.teamHp),field('최대 HP','teamMaxHp',state.teamMaxHp),field('보호막','teamShield',state.teamShield));}
 if(kind==='enemy-hp'){title=D.enemies[enemyEdit].name+' · HP';const e=state.enemies[enemyEdit];grid.append(field('현재 HP','enemy.hp',e.hp),field('최대 HP','enemy.maxHp',e.maxHp),field('보호막','enemy.shield',e.shield));}
 if(kind==='space'){title='초차원 공간';grid.append(field('보관 카드 수','spaceCards',state.spaceCards,null,5),field('공간 크기','spaceCapacity',state.spaceCapacity,null,5),field('카드 소유자','spaceOwner',state.spaceOwner,people().map(p=>p.name)),field('현재 턴 종류','spaceTurn',state.spaceTurn,['일반 턴','초차원 턴']));if(realmContext().dimensionAnnihilationCooldown)grid.append(field('특이점 소멸 남은 대기 턴','dimensionCooldown',state.dimensionCooldown,null,3));}
 if(kind==='tentacle'){const context=realmContext();title='촉수';grid.append(field('영구 촉수','tentacles',state.tentacles,null,5),field('임시 촉수','tempTentacles',state.tempTentacles),field('현재 자세','stance',state.stance,['조수','정해','노도']),field('촉수 피해량','tentacleDamage',state.tentacleDamage));if(context.tentacleGathering)grid.append(field('집결','tentacleGathering',state.tentacleGathering));if(context.oceanStanceCooldown)grid.append(field('정해 남은 대기 턴','oceanDefenceCooldown',state.oceanDefenceCooldown,null,3),field('노도 남은 대기 턴','oceanFuryCooldown',state.oceanFuryCooldown,null,3));}
 if(kind==='furnace'){title='배아 융합 · 스칼렛 용광로';grid.append(field('배아 융합','furnace',state.furnace),field('융합 상한','furnaceMax',state.furnaceMax),field('용광로 회복량','furnaceHeal',state.furnaceHeal));if(realmContext().furnaceCooldown)grid.append(field('용광로 남은 대기 턴','furnaceCooldown',state.furnaceCooldown,null,3));}
 if(kind==='actor'||kind.startsWith('actor-')){const owner=kind==='actor'?person():people().find(p=>p.id===Number(kind.slice(6)));if(!owner)return close();title=owner.name+' · 현재 상태';grid.append(field('이번 턴 이 각성체의 카드','owner.'+owner.id+'.actorUsed',owner.actorUsed,['미사용','이미 사용']));appendMechanicFields(grid,owner);}
 if(kind==='card'){const context=realmContext();title=card().name+' · 조건';grid.append(field('현재 카드 비용','card.currentCost',card().currentCost??card().calculatedCost??card().cost),field('활염','flame',state.flame,['자동','없음','1단계','2단계','3단계']),field('치명타','crit',state.crit,['자동','비치명','치명']));if(card().ulti)grid.append(field('현재 광기','person.rage',person().rage??''));if(card().ulti&&context.variants.caro==='breeding'&&context.counts.caro)grid.append(field('번식 축전','person.breedingCharge',person().breedingCharge??0));if(context.variants.ultra==='singularity'&&context.counts.ultra)grid.append(field('특이점 비콘','card.beacon',card().beacon??0),field('특이점 프리즘','prism',state.prism));const own=el('details'),ownGrid=el('div');ownGrid.className='fields';own.append(el('summary',person().name+' 상태'));ownGrid.append(field('이번 턴 이 각성체의 카드','owner.'+person().id+'.actorUsed',person().actorUsed,['미사용','이미 사용']));appendMechanicFields(ownGrid,person());own.append(ownGrid);body.append(own);body.append(text('대상: '+target().label));}
 if(kind==='key'){title='은열쇠';grid.append(field('은열쇠','keeperName',state.keeperName,D.keys.map(k=>k.name))); grid.append(field('충전량 (%)','key',state.key,null,100),field('카드 사용 직전','keyAction',state.keyAction,['없음','지령 사용','은열쇠 각성']));if(realmContext().variants.chaos==='primordial')grid.append(field('이 각성체의 이번 턴 첫 명령 카드','person.actorUsed',person().actorUsed,['미사용','이미 사용']));}
 if(kind==='history'){title='사용 이력';grid.append(field('현재 턴','turn',state.turn),field('이번 턴 사용한 카드','used',state.used),field('이번 턴 광기폭발 횟수','ultiCount',state.ultiCount??0));}
 if(kind==='enemy'){title=D.enemies[enemyEdit].name+' · 상태';const e=state.enemies[enemyEdit];grid.append(field('방어력','enemy.defense',e.defense),field('보호막','enemy.shield',e.shield),field('취약 중첩','enemy.vulnerable',e.vulnerable),field('허약 중첩','enemy.weakness',e.weakness));const details=el('details'),g=el('div');g.className='fields';g.append(field('현재 HP','enemy.hp',e.hp),field('최대 HP','enemy.maxHp',e.maxHp));details.append(el('summary','HP 조건'),g);body.append(details);}
 if(kind==='enemy-list'){title='적 상태';grid.remove();D.enemies.forEach((e,i)=>{const b=el('button',e.name+' · 방어 '+state.enemies[i].defense);b.onclick=()=>{enemyEdit=i;show('enemy',b);};body.append(b);});q('[data-apply]').hidden=true;}
 if(kind==='growth'){q('.party').hidden=true;title=person().name+' · 성장·장비';grid.append(field('레벨','person.level',person().level,null,90),field('돌파','person.potency',person().potency,null,15));const sk=el('details'),sg=el('div');sg.className='fields';sk.append(el('summary','스킬·특성'));person().cards.forEach(c=>sg.append(field(c.name+' 레벨','skill.'+c.id,c.level??6,null,6)));sg.append(field('광기의 징조','person.sign',person().sign,null,12),field('영혼 단련','person.training',person().training,null,10),field('내재 영격','person.inherent',person().inherent,null,5));sk.append(sg);body.append(sk);const gear=el('details'),gg=el('div');gg.className='fields';gg.className='fields gear-fields';gear.append(el('summary','명륜·비밀계약'));gg.append(field('명륜 1','person.gear1',person().gear1,D.gearNames),field('명륜 1 중첩','person.stack1',person().stack1,null,3),field('명륜 1 강화','person.refine1',person().refine1,null,12),field('명륜 2','person.gear2',person().gear2,D.gearNames),field('명륜 2 중첩','person.stack2',person().stack2,null,3),field('명륜 2 강화','person.refine2',person().refine2,null,12),field('비밀계약','person.contract',person().contract,D.contractNames));gear.append(gg);body.append(gear);}
 if(kind.startsWith('relic-')){const r=D.relics[Number(kind.split('-')[1])];title=r.name;grid.remove();body.append(text(r.description));}
 if(kind==='generated'){title='생성 카드';grid.remove();const cards=person().generated;if(!cards.length)body.append(text('이 시안에 포함된 생성 카드 없음'));cards.forEach(c=>{const b=el('button',c.name);b.onclick=()=>{let i=person().cards.findIndex(x=>x.id===c.id);if(i<0){person().cards.push(c);i=person().cards.length-1;}pick(state.person,i);persist();};body.append(b);});q('[data-apply]').hidden=true;}
 if(kind==='card'||kind==='actor'||kind.startsWith('actor-'))globalThis.scarecrowLive.settings(body,kind.startsWith('actor-')?people().find(p=>p.id===Number(kind.slice(6))):person());if(kind==='live-selection'){title='효과 선택';q('[data-apply]').hidden=true;grid.remove();globalThis.scarecrowLive.selection(body);}if(kind==='growth'){globalThis.scarecrowLive.growth(body,person());const gear=body.querySelector('.gear-fields')?.closest('details');if(gear){gear.replaceChildren();const b=el('button','명륜·비밀계약 선택');b.onclick=()=>globalThis.scarecrowLive.requestPicker('equipment');const c=el('button','비밀계약 선택');c.onclick=()=>globalThis.scarecrowLive.requestPicker('contract');b.textContent='명륜 선택';gear.replaceWith(b,c);}}globalThis.scarecrowLive.realmSettings(body,kind);if(kind==='account'){title='파티 정보';grid.append(field('편','chapter',state.chapter,['성신편','망각편']),field('수호자 레벨','accountLevel',state.accountLevel,null,100));}q('[data-title]').textContent=title;sheet.scrollIntoView({block:'nearest'});q('[data-close]').focus({preventScroll:true});
}
qa('[data-open]').forEach(b=>b.onclick=()=>show(b.dataset.open,b));q('[data-close]').onclick=close;q('[data-apply]').onclick=()=>{const inputs=qa('[data-field]');for(const n of inputs){const v=['enemy.previewDamage','tentacleDamage','card.currentCost'].includes(n.dataset.field)&&n.value===''?null:n.type==='number'?Math.max(0,Math.min(Number(n.max)||999999,Number(n.value)||0)):n.value;const k=n.dataset.field;if(n.type==='number'&&n.value===''){globalThis.scarecrowLive.automatic(k);continue;}if(k==='card.currentCost'&&!card().costEdited)continue;if(k.startsWith('mechanic.')){const [,ownerId,key]=k.split('.');state.mechanics=setMechanicValue(state.mechanics,state.partyIds,Number(ownerId),key,Math.floor(v));}else if(k.startsWith('owner.')){const [,ownerId,key]=k.split('.');const owner=people().find(p=>p.id===Number(ownerId));if(owner&&key==='actorUsed')owner.actorUsed=v;}else if(k.startsWith('skill.'))person().cards.find(c=>c.id===Number(k.slice(6))).level=v;else if(k.startsWith('card.'))card()[k.slice(5)]=v;else if(k.startsWith('person.'))person()[k.slice(7)]=v;else if(k.startsWith('enemy.'))state.enemies[enemyEdit][k.slice(6)]=v;else state[k]=v;}state.teamMaxHp=Math.max(1,state.teamMaxHp);state.teamHp=Math.min(state.teamHp,state.teamMaxHp);state.enemies.forEach(e=>{e.maxHp=Math.max(1,e.maxHp);e.hp=Math.min(e.hp,e.maxHp);});state.furnaceMax=Math.max(1,state.furnaceMax);state.furnace=Math.min(state.furnace,state.furnaceMax);state.spaceCapacity=Math.max(1,state.spaceCapacity);state.spaceCards=Math.min(state.spaceCards,state.spaceCapacity);invalidate();close();render();const focus=state.party?q('.party-slot:nth-child('+(state.person+1)+') .party-tile'):editor==='enemy'?q('.enemy:nth-child('+(enemyEdit+1)+')'):q('[data-open="'+editor+'"]');focus?.focus({preventScroll:true});persist();};q('[data-party]').onclick=()=>{close();state.party=!state.party;render();};q('[data-next]').onclick=()=>{close();state.party=false;render();};q('[data-ultimate]').onclick=()=>{pick(state.person,person().cards.findIndex(c=>c.ulti));q('[data-ultimate]').focus({preventScroll:true});persist();};q('[data-run]').onclick=async()=>{if(state.calculating)return;close();state.calculating=true;render();try{await globalThis.scarecrowLive.calculate();}finally{state.calculating=false;render();persist();}};root.addEventListener('keydown',e=>{if(e.key==='Escape')close();});function restore(value){const before=state.partyIds.join(',')+'|'+state.person+'|'+state.card;const saved=value?.modelContent||value;if(!saved)return false;if(Array.isArray(saved.partyIds)&&saved.partyIds.length===4&&new Set(saved.partyIds).size===4&&saved.partyIds.every(id=>D.people.some(p=>p.id===id)))state.partyIds=[...saved.partyIds];state.mechanics=reconcileMechanicParty(state.partyIds,state.mechanics);const i=people().findIndex(p=>p.name===saved.actor);if(i>=0){state.person=i;const j=person().cards.findIndex(c=>c.name===saved.card);state.card=j>=0?j:0;}return before!==state.partyIds.join(',')+'|'+state.person+'|'+state.card;}restore(globalThis.openai?.widgetState);globalThis.addEventListener('openai:set_globals',e=>{const saved=e.detail?.globals?.widgetState;if(saved&&restore(saved)){invalidate();render();}});render();globalThis.scarecrowLive.attach({root,state,people,person,card,render,invalidate,open:kind=>show(kind),close,realmContext,mechanicFields,enemyIndex:()=>enemyEdit,mechanicContext:()=>mechanicEngineContext(state.partyIds,state.mechanics)});connectParty(globalThis.scarecrowLive,{root,state,people,person,render,invalidate,open:kind=>show(kind),close});for(const [label,run]of [['파티 정보',()=>show('account')],['저장',()=>globalThis.scarecrowLive.save()],['불러오기',()=>globalThis.scarecrowLive.load()]]){const b=el('button',label);b.type='button';b.onclick=run;q('.party-bottom').prepend(b);}
})();
