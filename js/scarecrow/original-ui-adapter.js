/* Keep the site's party builder and add calculator-specific preparation. */
(()=>{
 const originalRender=renderAll,originalNormalize=normalizeSavedTeam;
 normalizeSavedTeam=(saved,index)=>{const team=originalNormalize(saved,index);for(const key of ['scarecrowContracts','scarecrowGrowth','scarecrowContext'])team[key]={...(saved?.[key]||{})};team.scarecrowId=saved?.scarecrowId||crypto.randomUUID();return team;};
 const data=Promise.all(['catalog.json','data/wheel_list.json','data/silverkey_list.json','data/covenant_list.json','data/covenant_parts.json'].map(p=>fetch(p).then(r=>r.json())).concat(import('./covenant-equipment.mjs'),import('./enemy-loadout.mjs'),import('./covenant-stats.mjs')));
 const originalWheelRender=renderWheelModalUI,originalOpenWheel=openWheelModal,originalCloseModal=closeModal;
 closeModal=(id)=>{originalCloseModal(id);if(id==='modal-wheel'&&equipmentReturn){const back=equipmentReturn;equipmentReturn=null;openEditor('member',back.member,null,{gearSlot:back.slot});}};
 openWheelModal=(...args)=>{originalOpenWheel(...args);if(!wheelGrowth.hidden)requestAnimationFrame(()=>{wheelGrowth.scrollIntoView({block:'nearest'});wheelRef.focus({preventScroll:true});});};
 let catalog,wheels,keys,contracts,parts,loadout,enemyModel,covenantStats,enemyIndex=0,enemyReturn=null,equipmentReturn=null,contractOwner,contractPosition=null,contractTeam,contractReturn=null,ready=false,opener,frameTeam,view={mode:'damage'};
 const current=()=>allPages[currentPageIdx].teams[currentTeamIdx];
 const wheelGrowth=document.createElement('div');wheelGrowth.id='scarecrow-wheel-growth';wheelGrowth.innerHTML='<div class="scarecrow-wheel-stages"><label for="scarecrow-wheel-refinement"><span>돌파 <output id="scarecrow-wheel-refinement-value">0</output></span><input type="range" id="scarecrow-wheel-refinement" min="0" max="15" step="1" value="0"></label></div><output id="scarecrow-wheel-stats"></output><details><summary>명륜 효과</summary><div id="scarecrow-wheel-effect" class="character-effect-rich-text"></div></details>';document.getElementById('modal-action-buttons').before(wheelGrowth);
 const wheelRef=wheelGrowth.querySelector('#scarecrow-wheel-refinement');
 function renderWheelBadges(team,id){
  const fields=team.scarecrowGrowth?.[id]||{};
  // The shared modal rebuilds both slots, even when the newly selected slot is empty.
  // Restore both badges before returning from settings for that empty slot.
  for(let n=0;n<2;n++){
   const preview=document.getElementById('equip-slot-'+n);
   preview.querySelectorAll('.scarecrow-wheel-badge').forEach(b=>b.remove());
   if(!team.wheels[editingCharIdx][n])continue;
   const badge=document.createElement('span');badge.className='scarecrow-wheel-badge';
   badge.innerHTML=ScarecrowGrowth.stage(Number(fields[n?'refinement2':'refinement']||0),Number(fields[n?'enhancement2':'enhancement']||0));
   preview.append(badge);
  }
 }
 function wheelSettings(){
  if(!catalog)return;
  const team=current(),id=team.chars[editingCharIdx],slot=selectedWheelSlotIdx,name=team.wheels[editingCharIdx][slot],record=wheels.find(w=>w.english_name===name),weapon=catalog.weapons.find(w=>w.id===record?.clientItemId);
  wheelGrowth.hidden=!weapon;
  if(!weapon){
   const f=team.scarecrowGrowth?.[id];
   if(f&&!name){f[slot?'_weapon2':'_weapon']='';f[slot?'refinement2':'refinement']='0';f[slot?'enhancement2':'enhancement']='0';for(const k of Object.keys(f))if(k.startsWith('final-')||k==='properties')delete f[k];}
   renderWheelBadges(team,id);return;
  }
  team.scarecrowGrowth??={};
  const f=team.scarecrowGrowth[id]??={},ref=slot?'refinement2':'refinement',enh=slot?'enhancement2':'enhancement',meta=slot?'_weapon2':'_weapon';
  if(f[meta]!==name){f[ref]='0';f[enh]='0';f[meta]=name;for(const k of Object.keys(f))if(k.startsWith('final-')||k==='properties')delete f[k];}
  wheelRef.value=Number(f[ref]||0)+Number(f[enh]||0);
  const stage=Number(wheelRef.value);
  wheelGrowth.querySelector('#scarecrow-wheel-refinement-value').innerHTML=ScarecrowGrowth.stage(Math.min(stage,3),Math.max(stage-3,0),{plus:true});
  wheelRef.setAttribute('aria-valuetext',stage>3?'3돌파 +'+(stage-3):stage+'돌파');
  renderWheelBadges(team,id);
  const stats=weapon.growth.levels[String(Number(wheelRef.value))],effect=wheelGrowth.querySelector('#scarecrow-wheel-effect');
  effect.innerHTML=CharacterEffects.renderRichText(record.description,TOOLTIP_DICTIONARY);CharacterEffects.setupTooltips(effect);
  const statOutput=wheelGrowth.querySelector('#scarecrow-wheel-stats');statOutput.replaceChildren();
  for(const [key,value] of Object.entries(stats)){
   const name=({crit:'크리티컬 확률',crit_damage:'크리티컬 피해',blackcoin_upgrade_per:'검은 인장 획득률',basic_damage_per:'피해 증폭'}[key]||catalog.weaponGrowthLabels[key]);
   const row=document.createElement('span');row.className='scarecrow-wheel-stat';const iconPath=wheelMainStatIcon(name);
   if(iconPath){const icon=document.createElement('img');icon.src=iconPath;icon.alt='';icon.className='wheel-stat-icon';row.append(icon);}
   const label=document.createElement('span');label.textContent=name;const number=document.createElement('strong');number.textContent=Number(value.toFixed(6));row.append(label,number);statOutput.append(row);
  }
 }

 function changeWheelGrowth(){const team=current(),id=team.chars[editingCharIdx],slot=selectedWheelSlotIdx,f=team.scarecrowGrowth[id],stage=Number(wheelRef.value);f[slot?'refinement2':'refinement']=String(Math.min(stage,3));f[slot?'enhancement2':'enhancement']=String(Math.max(stage-3,0));for(const k of Object.keys(f))if(k.startsWith('final-')||k==='properties')delete f[k];wheelSettings();saveAllData(true);decorate();}
 wheelRef.oninput=changeWheelGrowth;renderWheelModalUI=(...args)=>{const result=originalWheelRender(...args);wheelSettings();return result;};
 const workflow=document.createElement('section');workflow.className='scarecrow-workflow';workflow.innerHTML='<h1>ScareCrow · 카드 피해 계산</h1><p id="scarecrow-party-status" role="status"></p>';document.querySelector('.main-area').prepend(workflow);
 const next=document.createElement('button');next.type='button';next.className='btn btn-yellow';next.id='scarecrow-next';next.textContent='카드·상황 →';next.onclick=()=>openEditor('damage');document.querySelector('.bottom-section .btn-yellow').replaceWith(next);
 const info=document.createElement('button');info.type='button';info.className='btn btn-blue btn-sm';info.id='scarecrow-party-info';info.textContent='파티 정보';info.onclick=()=>openEditor('party');document.querySelector('.header-left').append(info);
 document.querySelector('.back-btn')?.remove();document.querySelector('.floating-report-btn')?.remove();
 new ResizeObserver(entries=>document.documentElement.style.setProperty('--scarecrow-footer-height',entries[0].target.getBoundingClientRect().height+'px')).observe(document.querySelector('.bottom-section'));
 function modal(id,title,src){const root=document.createElement('div');root.id=id;root.className='modal-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',title);const box=document.createElement('div');box.className='modal-box';const header=document.createElement('div');header.className='modal-header';const h=document.createElement('h3');h.textContent=title;const close=document.createElement('button');close.className='btn btn-blue btn-sm';close.type='button';close.textContent='← 파티 편성';close.onclick=()=>goBack(root);header.append(h,close);const loading=document.createElement('p');loading.className='scarecrow-loading';loading.textContent='설정을 불러오는 중…';loading.setAttribute('role','status');const frame=document.createElement('iframe');frame.title=title;frame.dataset.src=src;frame.style.cssText='width:100%;flex:1;min-height:0;border:0;display:block';if(id==='modal-damage')frame.style.visibility='hidden';box.append(header,loading,frame);root.append(box);document.body.append(root);root.onclick=e=>{if(e.target===root)hide(root);};return {root,frame,loading};}
 const damage=modal('modal-damage','카드·현재 상황','battle.html?embedded=1'),contract=modal('modal-contract','비밀계약 선택','contract-picker.html');
 const relic=modal('modal-relic','유물 선택','relic-picker.html'),enemy=modal('modal-enemy','융재금구 적 선택','enemy-picker.html');enemy.loading.hidden=true;
 const relicButton=document.createElement('button');relicButton.type='button';relicButton.className='btn btn-blue';relicButton.id='scarecrow-relics';relicButton.textContent='유물 선택';relicButton.onclick=()=>show(relic);document.querySelector('.bottom-section .btn-group').prepend(relicButton);
 async function configureRelics(){
  for(let n=0;n<400&&!relic.frame.contentWindow?.RelicInfoPicker?.ready;n++)await new Promise(resolve=>setTimeout(resolve,50));
  const api=relic.frame.contentWindow?.RelicInfoPicker;if(!api?.ready){relic.loading.textContent='유물을 불러오지 못했습니다. 다시 열어 주세요.';return;}
  relic.loading.hidden=true;const team=current(),available=(await fetch('live-data.json').then(r=>r.json())).relics.map(r=>r.id);
  api.configure({selected:team.scarecrowContext?.relicIds||[],available,onChange:ids=>{team.scarecrowContext??={};team.scarecrowContext.relicIds=ids;saveAllData(true);relicButton.textContent=ids.length?'유물 '+ids.length:'유물 선택';if(ready&&frameTeam===team)damage.frame.contentWindow.postMessage({type:'scarecrow:relics',ids},location.origin);}});
 }
 relic.frame.addEventListener('load',configureRelics);

 function show(m){if(m!==damage&&damage.root.classList.contains('show'))damage.root.inert=true;if(m===damage&&view?.mode==='damage'){document.querySelector('.builder-container').hidden=true;document.body.dataset.scarecrowScreen='damage';}opener=document.activeElement;if(!m.frame.getAttribute('src'))m.frame.src=m.frame.dataset.src;m.root.classList.add('show');document.querySelector('.builder-container').inert=true;m.root.querySelector('button').focus();if(m===relic&&m.frame.contentWindow?.RelicInfoPicker?.ready)configureRelics();}
 function hide(root){root.classList.remove('show');damage.root.inert=!!document.querySelector('.modal-overlay.show');if(root===damage.root&&root.classList.contains('scarecrow-workspace')){document.querySelector('.builder-container').hidden=false;delete document.body.dataset.scarecrowScreen;}document.querySelector('.builder-container').inert=!!document.querySelector('.modal-overlay.show');decorate();(opener?.isConnected?opener:next).focus();if(root===enemy.root&&enemyReturn){const back=enemyReturn;enemyReturn=null;openEditor('damage',back.actorIndex||0,null,{enemyIndex:back.index,cardIndex:back.cardIndex,resetEnemy:back.reset});}if(root===contract.root&&contractReturn){const back=contractReturn;contractReturn=null;if(current()===back.team)openEditor('covenant',back.member,back.position??0);}}
 function goBack(root){if(root===damage.root&&view.mode==='covenant'&&view.contractPosition>0){damage.frame.contentWindow.postMessage({type:'scarecrow:covenant-overview'},location.origin);return;}hide(root);}
 function selections(){const team=current();return {members:team.chars.map((id,i)=>({id,weapons:team.wheels[i],suit:Number(team.scarecrowContracts?.[id]||0),fields:team.scarecrowGrowth?.[id]||{}})),key:team.key,context:team.scarecrowContext||{}};}
 function sendParty(){if(ready){damage.frame.style.visibility='hidden';damage.loading.hidden=false;damage.frame.contentWindow.postMessage({type:'scarecrow:party',party:selections(),view},location.origin);}}
 async function openEditor(mode,member=0,contractPosition=null,returnState=null){await initialized;if(mode==='damage'&&current().chars.filter(Boolean).length!==4)return openQuickSetup();view={mode,member,contractPosition,returnState};damage.root.querySelector('.modal-header button').textContent=mode==='covenant'&&contractPosition>0?'← 뒤로가기':'← 파티 편성';damage.root.dataset.view=mode;const mainView=mode==='damage';damage.root.classList.toggle('modal-overlay',!mainView);damage.root.classList.toggle('scarecrow-workspace',mainView);damage.root.setAttribute('role',mainView?'main':'dialog');if(mainView)damage.root.removeAttribute('aria-modal');else damage.root.setAttribute('aria-modal','true');damage.root.querySelector('h3').setAttribute('aria-level',mainView?'1':'3');if(frameTeam!==current()){damage.frame.style.visibility='hidden';ready=false;frameTeam=current();damage.loading.hidden=false;if(damage.frame.getAttribute('src'))damage.frame.src=damage.frame.dataset.src;}damage.root.querySelector('h3').textContent=mode==='damage'?'카드·현재 상황':mode==='party'?'파티 정보 · 성장 설정':`${DB.chars.find(c=>c.id===current().chars[member])?.name||'각성체'} · ${mode==='covenant'?'비밀계약':'성장·돌파'} 설정`;show(damage);sendParty();}
 function contractPerson(team,id){return {contractId:Number(team.scarecrowContracts?.[id]||0),contractSlots:team.scarecrowGrowth?.[id]?._liveSuitSlots,contractBound:team.scarecrowGrowth?.[id]?._liveContractBound,trinkets:team.scarecrowGrowth?.[id]?._liveTrinkets||[]};}
 function selectedContract(){try{const slots=loadout.covenantSlots(catalog,contractPerson(contractTeam,contractOwner));return contractPosition?slots[contractPosition-1]:slots.find(Boolean)||0;}catch{return 0;}}
 function openContract(owner,position=null,back=null){contractOwner=owner;contractPosition=position;contractTeam=current();contractReturn=back;contract.root.querySelector('.modal-header button').textContent=back?'← 뒤로가기':'← 파티 편성';contract.root.querySelector('h3').textContent=position?'비밀계약 · '+position+'번 부위':'비밀계약 선택';show(contract);if(contract.frame.dataset.ready)contract.frame.contentWindow.postMessage({type:'contract:open',suit:selectedContract(),position},location.origin);}
 function accessible(element,label,action){element.tabIndex=0;element.setAttribute('role','button');element.setAttribute('aria-label',label);element.onkeydown=e=>{if(e.target===element&&(e.key==='Enter'||e.key===' ')){e.preventDefault();action(e);}};}
 for(const id of ['grid-char','grid-wheel','grid-key']){const grid=document.getElementById(id);new MutationObserver(()=>grid.querySelectorAll('.grid-item').forEach(item=>accessible(item,item.textContent.trim(),()=>item.click()))).observe(grid,{childList:true});}
 accessible(document.querySelector('.silverkey-box'),'은열쇠 선택',()=>openKeyModal());
 function layoutCard(card){
  const row=card?.querySelector('.scarecrow-card-info');if(!row)return;
  const layout=PrefabPartyCard.layout(card,row),head=card.querySelector('.char-top-info');
  const cardRect=card.getBoundingClientRect(),rowRect=row.getBoundingClientRect();const needed=Math.ceil(head.getBoundingClientRect().bottom-cardRect.top+rowRect.height+(cardRect.bottom-rowRect.bottom)+8);
  const nameBottom=Math.ceil(head.getBoundingClientRect().bottom-cardRect.top+4)+'px';
  if(card.style.getPropertyValue('--scarecrow-name-bottom')!==nameBottom)card.style.setProperty('--scarecrow-name-bottom',nameBottom);
  card.style.minHeight=needed+'px';const wrapper=card.closest('.slot-wrapper');if(wrapper)wrapper.style.minHeight=needed+'px';
 }
 new MutationObserver(()=>document.querySelectorAll('#team-slots .char-card').forEach(layoutCard)).observe(document.documentElement,{attributes:true,attributeFilter:['style']});
 const resize=new ResizeObserver(entries=>{for(const {target} of entries)layoutCard(target.closest('.char-card'));});

 function decorate(){
  if(!parts)return;relicButton.textContent=current().scarecrowContext?.relicIds?.length?'유물 '+current().scarecrowContext.relicIds.length:'유물 선택';
  const count=current().chars.filter(Boolean).length;next.disabled=count!==4;info.disabled=!count;document.getElementById('scarecrow-party-status').textContent=count===4?'1. 카드에서 성장·장비 확인 → 2. 카드·상황 설정 → 3. 피해 확인 · 자동 저장':`각성체 네 명을 선택하세요. (${count}/4) · 이 기기에 자동 저장`;
  resize.disconnect();document.querySelectorAll('#team-slots .scarecrow-card-info,#team-slots .scarecrow-edit-growth').forEach(n=>n.remove());
  document.querySelectorAll('#team-slots .char-card').forEach((card,i)=>{if(!card.parentElement.classList.contains('slot-wrapper')){const wrap=document.createElement('div');wrap.className='slot-wrapper';card.before(wrap);wrap.append(card);}
   const id=current().chars[i];accessible(card,id?'각성체 변경':'각성체 선택',()=>openQuickSetup());if(!id)return;
   const name=DB.chars.find(c=>c.id===id)?.name||id;const edit=document.createElement('button');edit.type='button';edit.className='scarecrow-edit-growth';edit.textContent='성장·돌파';edit.setAttribute('aria-label',name+' 성장·돌파 설정');edit.onclick=e=>{e.stopPropagation();openEditor('member',i);};card.append(edit);
   card.querySelectorAll('.slot-wheel').forEach((slot,n)=>{slot.querySelectorAll('.scarecrow-wheel-badge').forEach(b=>b.remove());accessible(slot,`${name} 명륜 ${n+1} 선택`,e=>openWheelModal(i,n,e));if(current().wheels[i][n]){const stages=document.createElement('span'),f=current().scarecrowGrowth?.[id]||{};stages.className='scarecrow-wheel-badge';stages.innerHTML=ScarecrowGrowth.stage(Number(f[n?'refinement2':'refinement']||0),Number(f[n?'enhancement2':'enhancement']||0));slot.append(stages);}});
   const row=document.createElement('div');row.className='scarecrow-card-info';
   const growth=document.createElement('button');growth.className='scarecrow-growth';growth.type='button';growth.setAttribute('aria-label',`${name} 성장 정보 설정`);const f=current().scarecrowGrowth?.[id]||{};growth.innerHTML=ScarecrowGrowth.character(catalog.characters.find(c=>c.manifestId===id),f);growth.onclick=e=>{e.stopPropagation();openEditor('member',i);};row.append(growth);
   const wrap=document.createElement('div');wrap.className='covenant-wrapper';const button=document.createElement('button');button.type='button';button.className='slot-covenant';button.setAttribute('aria-label',`${name} 비밀계약 선택`);let sets=[];try{sets=loadout.covenantSets(catalog,contractPerson(current(),id));}catch{button.title='비밀계약 부위를 다시 선택하세요.';}
   if(sets.length){button.classList.add('has-contract');button.classList.toggle('has-bound',loadout.covenantBound(contractPerson(current(),id)));button.classList.toggle('is-mixed',sets.length>1);button.title=sets.map(s=>(contracts.find(c=>c.clientSuitId===s.id)?.korean_name||'비밀계약')+' '+s.count+'개').join(' · ');for(const set of sets.length===1?sets:[]){const image=document.createElement('img');image.className='scarecrow-contract-set-art';image.src='images/covenant-set/'+set.id+'.png';image.alt=(contracts.find(c=>c.clientSuitId===set.id)?.korean_name||'비밀계약')+' '+set.count+'개';image.addEventListener('load',()=>layoutCard(card));button.append(image);}}else{button.title||='비밀계약 선택';button.classList.add('is-empty');}
   if(button.classList.contains('has-bound')&&!button.classList.contains('is-mixed')){const ring=document.createElement('img');ring.src='images/growth/UI_Commpn_Image_TrinketBindCircle.png';ring.className='scarecrow-contract-bound-ring';ring.alt='';ring.setAttribute('aria-hidden','true');button.prepend(ring);}
   button.onclick=e=>{e.stopPropagation();openEditor('covenant',i);};wrap.append(button);
   const completion=document.createElement('span');completion.className='scarecrow-contract-completion';completion.hidden=!sets.length;
   const completionText=document.createElement('span');completionText.className='scarecrow-completion-text';completion.append(completionText);
   try{const value=covenantStats.covenantCompletion(loadout.equippedCovenantParts(catalog,contractPerson(current(),id)));completionText.textContent=value+'%';completion.setAttribute('aria-label','비밀계약 전체 완성도 '+value+'%');completion.title='전체 완성도 '+value+'%';}catch{completionText.textContent='확인 필요';completion.title='비밀계약 옵션을 확인하세요.';}
   wrap.append(completion);row.append(wrap);card.append(row);resize.observe(card);resize.observe(card.querySelector('.char-top-info'));resize.observe(card.querySelector('.wheels-wrapper'));resize.observe(row);
  });
 }
 renderAll=(...args)=>{const out=originalRender(...args);decorate();if(parts)saveAllData(true);return out;};
 const initialized=data.then(async values=>{while(!DB.chars.length)await new Promise(resolve=>setTimeout(resolve,20));[catalog,wheels,keys,contracts,parts,loadout,enemyModel,covenantStats]=values;window.PartyBuilderAvailability={character:c=>catalog.characters.some(v=>v.manifestId===c.id),wheel:w=>catalog.weapons.some(v=>v.id===w.clientItemId),key:k=>catalog.keepers.some(v=>v.id===k.clientItemId)};decorate();window.scarecrowOriginalReady=true;});
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin)return;await initialized;
  if(event.source===damage.frame.contentWindow){
   if(event.data?.type==='scarecrow:covenant-view'&&view.mode==='covenant'){const position=event.data.position;if(!Number.isInteger(position)||position<0||position>6)return;view.contractPosition=position||null;damage.root.querySelector('.modal-header button').textContent=position?'← 뒤로가기':'← 파티 편성';}
   if(event.data?.type==='scarecrow:covenant-back'&&view.mode==='covenant'){goBack(damage.root);return;}
   if(event.data?.type==='scarecrow:resize'&&damage.root.dataset.view==='covenant'){const height=Number(event.data.height);if(Number.isFinite(height)&&height>0&&height<30000)damage.root.style.setProperty('--covenant-editor-height',height+'px');}
   if(event.data?.type==='scarecrow:picker'&&event.data.kind==='enemy'){enemyIndex=event.data.enemyIndex;if(!Number.isInteger(enemyIndex)||enemyIndex<0||enemyIndex>6)return;enemyReturn={index:enemyIndex,actorIndex:event.data.actorIndex,cardIndex:event.data.cardIndex};if(!damage.root.classList.contains('scarecrow-workspace'))hide(damage.root);show(enemy);return;}
   if(event.data?.type==='scarecrow:picker'&&event.data.kind==='relics'){show(relic);return;}
   if(event.data?.type==='scarecrow:picker'){hide(damage.root);const i=event.data.index||0;if(event.data.kind==='equipment'){equipmentReturn={member:i,slot:event.data.position===1?1:0};openWheelModal(i,event.data.position===1?1:0);}else if(event.data.kind==='keeper')openKeyModal();else if(event.data.kind==='contract'){const position=event.data.position;if(position!=null&&(!Number.isInteger(position)||position<1||position>6))return;openContract(current().chars[i],position,{team:current(),member:i,position});}else openQuickSetup();}
   if(event.data?.type==='scarecrow:ready'){ready=true;damage.loading.hidden=true;sendParty();}
   if(event.data?.type==='scarecrow:applied'){damage.frame.style.visibility='visible';damage.loading.hidden=true;}
   if(event.data?.type==='scarecrow:fields'&&frameTeam===current()){current().scarecrowGrowth=event.data.fields;current().scarecrowContext=event.data.context;saveAllData(true);}
   if(event.data?.type==='scarecrow:edit-title')damage.root.querySelector('h3').textContent=event.data.title;
   if(event.data?.type==='scarecrow:selection'){const team=current();team.chars=event.data.party.members.map(m=>m.id);team.wheels=event.data.party.members.map(m=>m.weapons);team.key=event.data.party.key;team.scarecrowContracts={};for(const m of event.data.party.members)if(m.suit)team.scarecrowContracts[m.id]=m.suit;renderAll();}
  }
  if(event.source===enemy.frame.contentWindow&&event.data?.type==='scarecrow:enemy-selected'){
   try{const selected=event.data.selection,season=window.DzoneSeason.selectSeason(selected.period);if(season.period!==selected.period)throw Error('기수를 확인하세요.');const source=await fetch(season.path).then(r=>r.json()),value=enemyModel.resolveDzoneEnemy(source,selected);const context=current().scarecrowContext;if(!Array.isArray(context.enemies)||enemyIndex<0||enemyIndex>context.enemies.length||enemyIndex>6)throw Error('적 위치를 확인하세요.');context.enemies[enemyIndex]=value;context.enemyExplicit=(context.enemyExplicit||[]).filter(k=>!k.startsWith('enemy.'+enemyIndex+'.'));saveAllData(true);if(enemyReturn)enemyReturn.reset=true;hide(enemy.root);}catch(error){enemy.loading.hidden=false;enemy.loading.textContent=error.message;}return;
  }
  if(event.source===contract.frame.contentWindow){
   if(event.data?.type==='contract:resize'){const height=Number(event.data.height);if(Number.isFinite(height)&&height>0&&height<30000)contract.frame.style.height=height+'px';}
   if(event.data?.type==='contract:ready'){contract.loading.hidden=true;contract.frame.dataset.ready='true';contract.frame.contentWindow.postMessage({type:'contract:open',suit:selectedContract(),position:contractPosition},location.origin);}
   if(event.data?.type==='contract:select'){const id=Number(event.data.suit);if(id&&!parts.some(s=>s.suitId===id))return;if(current()!==contractTeam)return;const team=contractTeam;team.scarecrowGrowth??={};const fields=team.scarecrowGrowth[contractOwner]??={};if(contractPosition){const slots=loadout.covenantSlots(catalog,contractPerson(team,contractOwner));fields._liveSuitSlots=loadout.selectCovenantSet(slots,id,contractPosition);}else{team.scarecrowContracts??={};team.scarecrowContracts[contractOwner]=id;delete fields._liveSuitSlots;}renderAll();hide(contract.root);}
  }
  if(event.source===relic.frame.contentWindow&&event.data?.type==='scarecrow:close'){hide(relic.root);return;}
  if(event.data?.type==='scarecrow:close'&&(event.source===damage.frame.contentWindow||event.source===contract.frame.contentWindow))hide(event.source===damage.frame.contentWindow?damage.root:contract.root);
 });
 document.addEventListener('keydown',e=>{const open=[enemy.root,relic.root,contract.root,damage.root].find(m=>m.classList.contains('show'));if(open&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();goBack(open);}},true);
})();
