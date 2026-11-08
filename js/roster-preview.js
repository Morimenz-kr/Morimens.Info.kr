(function () {
'use strict';
const M = window.RosterModel, $ = id => document.getElementById(id);
const DATA_REVISION = 'res18-growth-6e8b876';
const SHARE_SCOPE_KEY = 'morimens_roster_share_scope_v1';
const shareScope = value => ['all','characters','wheels'].includes(value) ? value : 'all';
const builtinPresets = [{id:'defaults',name:'기본값'},{id:'cards',name:'카드만 최대'},{id:'talents',name:'특성만 최대'},{id:'growth',name:'전체 최대 (돌파 포함)'}];
const realms = {chaos:'혼돈',aequor:'심해',caro:'혈육',ultra:'초차원'};
const potencyLabel = n => n === 0 ? '명함' : n === 7 ? '초한' : n === 15 ? '풀돌' : `${n}돌`;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {account:M.empty(),chars:[],wheels:[],growth:{},tab:'characters',view:'cards',owned:'all',bulk:false,selected:new Set(),editIds:[],lastFocus:null,group:'all',role:'all',grade:'all',groups:{},limitedIds:[]};
const entry = id => M.characterDefaults(state.account.characters[id],state.limitedIds.includes(id));
const wheel = id => state.account.wheels[id] || {owned:false,potency:0};
const char = id => state.chars.find(c=>c.id===id);
function notice(message,type='') {
    document.querySelector('.inventory-toast')?.remove();
    if(!message)return;
    const toast=document.createElement('div');
    toast.className=`inventory-toast ${type}`.trim();toast.textContent=message;toast.setAttribute('role',type==='error'?'alert':'status');
    const host=document.querySelector('dialog[open]')||document.body;
    const footer=host.querySelector('.dialog-footer');
    if(host!==document.body&&footer)toast.style.bottom=`${innerHeight-footer.getBoundingClientRect().top+12}px`;
    host.appendChild(toast);
    setTimeout(()=>toast.remove(),2600);
}
function commit(account,message) {
    account=M.normalizeDefaults(account,state.limitedIds);
    const linked=['ramona','ramona_timeworn'];const changed=linked.find(id=>account.characters[id]?.owned&&account.characters[id].potency!==state.account.characters[id]?.potency);if(changed)for(const id of linked)if(account.characters[id]?.owned)account.characters[id].potency=account.characters[changed].potency;
    try { localStorage.setItem(M.KEY,JSON.stringify(account)); }
    catch { notice('저장 공간이 부족하거나 저장이 차단됐습니다. 변경을 적용하지 않았습니다.'); return false; }
    state.account=account; render(); document.querySelector('.inventory-toast')?.remove(); return true;
}
function mutate(fn,message) {const next=M.clone(state.account);fn(next);return commit(next,message);}
async function load() {
    try {
        const fetchJSON = async path => {const response=await fetch(`${path}?v=${DATA_REVISION}`,{cache:'no-cache'});if(!response.ok)throw Error(path);return response.json();};
        const [chars,wheels,growth,groups] = await Promise.all([fetchJSON('data/character_manifest.json'),fetchJSON('data/wheel_list.json'),fetchJSON('data/character_growth.json'),fetchJSON('data/gachatype.json')]);
        state.chars=chars;state.wheels=wheels.filter(w=>['SSR','SR','R'].includes(w.grade));state.growth=growth.characters;state.groups=groups;state.classification=window.SummonClassification.create(groups);state.limitedIds=[...new Set([...(groups.forgotten||[]),...(groups.celestial||[])])];state.identity=window.CharacterIdentity.create(chars);
        try { const saved=localStorage.getItem(M.KEY);state.account=saved?M.validate(JSON.parse(saved),chars.map(c=>c.id),state.wheels.map(w=>w.english_name),state.growth).account:M.migrate(JSON.parse(localStorage.getItem(M.LEGACY)||'null')); }
        catch { notice('저장값을 읽지 못했습니다. 원본은 유지했으며 빈 보유 현황으로 열었습니다.'); }
        state.account=M.normalizeDefaults(state.account,state.limitedIds);
        bind();render();document.body.dataset.rosterReady='true';window.dispatchEvent(new Event('roster-ready'));
    } catch(error) { $('inventory-grid').innerHTML='<div class="empty"><h2>자료를 불러오지 못했어요.</h2><p>연결 상태를 확인하고 새로고침해 주세요.</p><button onclick="location.reload()">다시 시도</button></div>';console.error(error); }
}
function filtered(tab=state.tab) {
    const query=tab===state.tab?$('search').value.trim().toLowerCase():'';
    const matches=(id,value)=>$(id).value==='all'||$(id).value===value;
    let rows=(tab==='wheels'?state.wheels:state.chars).filter(c=>{
        const isWheel=tab==='wheels', id=isWheel?c.english_name:c.id, e=isWheel?wheel(id):entry(id);
        return (!query||(window.SearchUtils?window.SearchUtils.matchesSearchText(isWheel?`${c.korean_name} ${c.main_stat}`:state.identity.searchText(c),query):`${c.name||c.korean_name} ${id} ${(c.name_aliases||[]).join(' ')}`.toLowerCase().includes(query)))
            &&(isWheel?state.grade==='all'||c.grade===state.grade:matches('availability-filter',state.classification.characterAvailability(c))&&matches('chapter-filter',state.classification.characterChapter(c))&&matches('grade-filter',c.grade))
            &&(state.owned==='all'||(state.owned==='owned'?e.owned:!e.owned))
            &&(isWheel||matches('relems-filter',c.relems)&&matches('class-filter',c.class));
    });
    if($('sort').value==='name') rows.sort((a,b)=>(a.name||a.korean_name).localeCompare(b.name||b.korean_name,'ko'));
    if($('sort').value==='potency') rows.sort((a,b)=>(tab==='wheels'?wheel(b.english_name).potency:entry(b.id).potency)-(tab==='wheels'?wheel(a.english_name).potency:entry(a.id).potency));
    return rows;
}
const skillSlots = [
    ['Slot_Super', '광기 폭발'], ['Slot_Strike', '타격'], ['Slot_Defend', '방어'],
    ['Slot_Awake', '각성'], ['Slot_Skill1', '스킬 1'], ['Slot_Skill2', '스킬 2']
];
function potencyBadge(value) {
    const p = M.potencyDisplay(value), base = 'images/growth/';
    const stars = [0,1,2].map(i => `<span class="potency-diamond ${i < p.diamonds ? 'lit' : 'unlit'}"><img src="${base}UI_Common_Star_Icon_7.png" alt="" width="80" height="80">${i < p.diamonds ? `<img src="${base}UI_Common_Star_Icon_6.png" alt="" width="79" height="80">` : ''}</span>`).join('');
    const extra = p.extra > 0 ? `<span class="potency-number"><span class="potency-game-parent"><img class="potency-game-background ${p.max ? '' : 'potency-background-regular'}" src="${base}${p.max ? 'UI_Common_Potency_02' : 'UI_Common_Potency_01'}.png" alt="" width="${p.max ? 100 : 84}" height="${p.max ? 90 : 72}">${p.max ? `<img class="potency-max" src="${base}UI_Common_Potency_MaxNumber.png" alt="" width="54" height="50">` : `<span class="potency-game-text">${p.extra}</span>`}</span></span>` : '';
    return `<span class="potency-badge" role="img" aria-label="${value == null ? '돌파 미입력' : `돌파 ${value}단계 · 다이아 ${p.diamonds}개${p.extra ? ` · 강화 ${p.extra}` : ''}`}">${stars}${extra}${value == null ? '<span class="potency-unknown">—</span>' : ''}</span>`;
}
function stepper(id,value,type='character') {
    const name = type === 'character' ? char(id)?.name : state.wheels.find(w=>w.english_name===id)?.korean_name;
    return `<div class="classic-stepper"><button data-step="${esc(id)}" data-kind="${type}" data-delta="-1" aria-label="${esc(name)} ${value===0?'풀돌로 변경':'돌파 낮추기'}">〈</button>${potencyBadge(value)}<button data-step="${esc(id)}" data-kind="${type}" data-delta="1" aria-label="${esc(name)} ${value===15?'명함으로 변경':'돌파 올리기'}">〉</button></div>`;
}
function characterCard(c) {
    const e=entry(c.id),g=state.growth[c.id];
    const skills=skillSlots.map(([slot])=>e.skills?.[slot]??'–');
    const talents=[e.talents?.[2]??'–',e.talents?.[1]??'–',state.limitedIds.includes(c.id)?5:e.talents?.[3]??'–'];
    const skillText=skills.join('/'),talentText=talents.join('/');
    const skillLabel=skillSlots.map(([,label],i)=>`${label} ${skills[i]}`).join(', ');
    const talentLabel=['영혼 단련','광기의 징조','내재 영격'].map((label,i)=>`${label} ${talents[i]}`).join(', ');
    const numbers=(values,highlight=false)=>values.map((value,i)=>highlight&&i===0?`<span class="madness-skill-value">${esc(value)}</span>`:esc(value)).join('/<wbr>');
    return `<article class="character-card ${e.owned?'selected':'not-owned'} ${state.bulk&&state.selected.has(c.id)?'is-selected':''}" data-card-id="${esc(c.id)}">
      <button class="compact-select" data-toggle-card="${esc(c.id)}" aria-pressed="${state.bulk?state.selected.has(c.id):e.owned}" aria-label="${esc(c.name)} ${state.bulk?'편집 대상':'보유'} 선택"><span class="check-mark" aria-hidden="true">✓</span><img src="${esc(c.image_thumb)}" alt="" width="100" height="108" loading="lazy"><span class="inventory-card-name">${esc(c.name)}</span></button>
      ${e.owned?`<button type="button" class="compact-level" data-edit="${esc(c.id)}" data-edit-level aria-label="${esc(c.name)} 레벨 ${e.level??1} 성장 편집">Lv.${e.level??'—'}</button>${stepper(c.id,e.potency??0)}<button class="growth-entry compact-growth" data-edit="${esc(c.id)}" aria-label="${esc(c.name)} 성장 편집. ${esc(skillLabel)}. ${esc(talentLabel)}"><span class="growth-icon-row"><img src="images/growth/UI_Comon_Icon_AwakerSkill.png" alt="" aria-hidden="true" width="14" height="14"><span class="growth-values compact-skills" title="${esc(skillLabel)}" aria-label="${esc(skillLabel)}">${numbers(skills,true)}</span></span><span class="growth-icon-row"><img src="images/growth/UI_Common_Icon_AwakerTalent.png" alt="" aria-hidden="true" width="14" height="14"><span class="growth-values compact-talents" title="${esc(talentLabel)}" aria-label="${esc(talentLabel)}">${numbers(talents)}</span></span></button>`:''}
    </article>`;
}
function wheelCard(w) {const e=wheel(w.english_name);return `<article class="character-card wheel-card ${e.owned?'selected':'not-owned'} ${state.bulk&&state.selected.has(w.english_name)?'is-selected':''}"><button class="compact-select" data-toggle-wheel="${esc(w.english_name)}" aria-pressed="${state.bulk?state.selected.has(w.english_name):e.owned}" aria-label="${esc(w.korean_name)} ${state.bulk?'편집 대상':'보유'} 선택"><span class="check-mark" aria-hidden="true">✓</span><img src="${esc(w.image_path.replace('/wheel/','/wheel_thumb/'))}" alt="" width="100" height="108" loading="lazy"><span class="inventory-card-name">${esc(w.korean_name)}</span></button>${e.owned?stepper(w.english_name,e.potency??0,'wheel'):''}</article>`;}
function render() {
    const focus=document.activeElement;const focusData=['toggleCard','toggleWheel','step'].find(key=>focus?.dataset?.[key]);
    const owned=state.chars.filter(c=>entry(c.id).owned),complete=owned.filter(c=>M.complete(entry(c.id),state.growth[c.id]));
    $('account-summary').textContent=`각성체 ${owned.length}/${state.chars.length} · 성장 입력 ${complete.length}/${owned.length} · 명륜 ${state.wheels.filter(w=>wheel(w.english_name).owned).length}`;
    $('character-total').textContent=owned.length;$('wheel-total').textContent=state.wheels.filter(w=>wheel(w.english_name).owned).length;
    document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    $('search').placeholder=state.tab==='wheels'?'명륜 이름 검색':'각성체 이름 검색';
    $('character-filters').hidden=state.tab==='wheels';$('wheel-filters').hidden=state.tab!=='wheels';
    $('bulk-toggle').hidden=state.tab==='teams';$('presets-button').hidden=state.tab!=='characters';
            $('bulk-toggle').textContent='일괄 편집';$('selection-tools').hidden=!state.bulk;$('bulk-bar').hidden=!state.bulk;
    const rows=filtered();$('result-count').textContent=`${state.tab==='wheels'?'명륜':'각성체'} ${rows.length}${state.tab==='wheels'?'개':'명'}${state.bulk?' · 선택 '+state.selected.size+(state.tab==='wheels'?'개':'명'):''}`;
    document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===state.group)));document.querySelectorAll('[data-role]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.role===state.role)));document.querySelectorAll('[data-grade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.grade===state.grade)));
    $('inventory-grid').className=state.tab==='wheels'?'character-grid classic-wheels':'character-grid classic-groups';
    $('inventory-grid').innerHTML=rows.length?(state.tab==='wheels'?rows.map(wheelCard).join(''):Object.entries(realms).map(([key,label])=>{const members=rows.filter(c=>c.relems===key);return members.length?`<section class="relems-section ${key}" aria-label="${label}"><h2 class="relems-section-title">${label}</h2><div class="relems-character-grid">${members.map(characterCard).join('')}</div></section>`:'';}).join('')):'<div class="empty"><h2>조건에 맞는 항목이 없어요.</h2><p>검색어나 보유 조건을 바꿔보세요.</p><button data-reset-inventory>필터 초기화</button></div>';
    const catalog=state.tab==='wheels'?state.wheels:state.chars;
    const filteredScope=rows.length!==catalog.length;
    $('register-visible').textContent=filteredScope?'검색 결과 전체 선택':'전체 선택';
    $('unregister-visible').textContent=filteredScope?'검색 결과 전체 해제':'전체 해제';
    $('register-visible').disabled=!rows.some(c=>!(state.tab==='wheels'?wheel(c.english_name):entry(c.id)).owned);
    $('unregister-visible').disabled=!rows.some(c=>(state.tab==='wheels'?wheel(c.english_name):entry(c.id)).owned);
    const unit=state.tab==='wheels'?'개':'명';
    $('bulk-count').textContent=`${state.selected.size}${unit} 선택`;
    $('bulk-edit').textContent=state.tab==='wheels'?'돌파 설정':'성장값 적용';
    const visible=new Set(rows.map(c=>state.tab==='wheels'?c.english_name:c.id));const hidden=[...state.selected].filter(id=>!visible.has(id)).length;
    $('hidden-selection').textContent=hidden?`현재 목록 밖 ${hidden}${unit} 포함`:'';
    ['bulk-edit','bulk-register','bulk-unregister'].forEach(id=>$(id).disabled=!state.selected.size);
    if(focusData&&!focus.isConnected){const attr='data-'+focusData.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());document.querySelector('['+attr+'="'+CSS.escape(focus.dataset[focusData])+'"]'+(focusData==='step'?'[data-delta="'+focus.dataset.delta+'"]':''))?.focus();}
}
function bind() {
    document.addEventListener('click',event=>{
        const b=event.target.closest('button');if(!b)return;
        if(b.dataset.group){state.group=b.dataset.group;render();}if(b.dataset.role){state.role=b.dataset.role;render();}if(b.dataset.grade){state.grade=b.dataset.grade;render();}
        if(b.dataset.toggleCard){const id=b.dataset.toggleCard;if(state.bulk){state.selected.has(id)?state.selected.delete(id):state.selected.add(id);render();}else mutate(a=>{const e=a.characters[id]||={owned:false,potency:0,talents:{},skills:{}};e.owned=!e.owned;},'보유 현황을 저장했습니다.');}
        if(b.dataset.toggleWheel){const id=b.dataset.toggleWheel;if(state.bulk){state.selected.has(id)?state.selected.delete(id):state.selected.add(id);render();}else mutate(a=>{const e=a.wheels[id]||={owned:false,potency:0};e.owned=!e.owned;},'명륜 보유 현황을 저장했습니다.');}
        if(b.dataset.step){const id=b.dataset.step;mutate(a=>{const collection=b.dataset.kind==='wheel'?a.wheels:a.characters;collection[id].potency=M.stepPotency(collection[id].potency??0,Number(b.dataset.delta));if(b.dataset.kind==='character'&&['ramona','ramona_timeworn'].includes(id)){for(const linked of ['ramona','ramona_timeworn'])if(a.characters[linked]?.owned)a.characters[linked].potency=collection[id].potency;}},'돌파를 저장했습니다.');}
        if(b.dataset.tab&&['characters','wheels'].includes(b.dataset.tab)){state.tab=b.dataset.tab;state.bulk=false;state.selected.clear();$('search').value='';render();}
        if(b.dataset.edit){openEditor([b.dataset.edit]);if(b.hasAttribute('data-edit-level'))document.querySelector('#editor [data-range="level"]')?.focus();}
        if(b.hasAttribute('data-close')) { if(b.closest('#editor')&&$('editor-form').dataset.dirty==='true') {if(!confirm('저장하지 않은 변경을 닫을까요?'))return;} b.closest('dialog').close(); }
        if(b.hasAttribute('data-reset-inventory'))resetInventory();
        if(b.dataset.presetApply!==undefined)applyPreset(Number(b.dataset.presetApply));
        if(b.dataset.builtinPreset)applyPreset(b.dataset.builtinPreset);
        if(b.dataset.presetDelete!==undefined) {mutate(a=>a.presets.splice(Number(b.dataset.presetDelete),1),'프리셋을 삭제했습니다.');showPresets();}
        if(b.dataset.presetDuplicate!==undefined) {mutate(a=>{const p=M.clone(a.presets[Number(b.dataset.presetDuplicate)]);p.name+=' 복사';a.presets.push(p);},'프리셋을 복제했습니다.');showPresets();}
        if(b.dataset.presetRename!==undefined) { const i=Number(b.dataset.presetRename),name=prompt('프리셋 이름',state.account.presets[i].name);if(name?.trim()){mutate(a=>a.presets[i].name=name.trim().slice(0,80),'프리셋 이름을 변경했습니다.');showPresets();} }
    });
    $('inventory-grid').addEventListener('change',event=>{
        const el=event.target;
        if(el.dataset.select){el.checked?state.selected.add(el.dataset.select):state.selected.delete(el.dataset.select);render();}
        if(el.dataset.own)mutate(a=>{const e=a.characters[el.dataset.own]||={owned:false,potency:0,talents:{},skills:{}};e.owned=el.checked;},el.checked?'보유 등록했습니다.':'보유를 해제했습니다. 성장값은 보존됩니다.');
        if(el.dataset.wheelOwn)mutate(a=>{(a.wheels[el.dataset.wheelOwn]||={owned:false,potency:0}).owned=el.checked;},'명륜 보유 현황을 저장했습니다.');
        if(el.dataset.wheelPotency)mutate(a=>{(a.wheels[el.dataset.wheelPotency]||={owned:false,potency:0}).potency=Number(el.value);},'명륜 돌파를 저장했습니다.');
    });
    $('search').addEventListener('input',render);['availability-filter','chapter-filter','grade-filter','relems-filter','class-filter','sort'].forEach(id=>$(id).addEventListener('change',render));
    $('owned-filter').onchange=()=>{state.owned=$('owned-filter').value;render();};
    $('register-visible').onclick=()=>setVisibleOwnership(true);$('unregister-visible').onclick=()=>setVisibleOwnership(false);
    $('clear-account').onclick=()=>{if(confirm('전체 보유·성장 정보를 초기화할까요?'))commit(M.empty(),'보유 현황을 초기화했습니다.');};
    $('preview-image-button').onclick=()=>shareImage('preview');$('copy-image').onclick=()=>shareImage('copy');
    try{$('share-scope').value=shareScope(localStorage.getItem(SHARE_SCOPE_KEY));}catch{$('share-scope').value='all';}
    $('share-scope').onchange=()=>{try{localStorage.setItem(SHARE_SCOPE_KEY,shareScope($('share-scope').value));}catch{notice('공유 범위를 기억하지 못했습니다. 이번 선택은 적용됩니다.');}};
    $('bulk-toggle').onclick=()=>{state.bulk=true;state.selected.clear();selectVisibleOwned();if(state.selected.size)openEditor([...state.selected],true);else{state.bulk=false;render();notice(`현재 목록에 보유한 ${state.tab==='wheels'?'명륜이':'각성체가'} 없습니다. 먼저 보유 항목을 선택해 주세요.`);}};
    $('select-visible').onclick=()=>{filtered().forEach(c=>state.selected.add(state.tab==='wheels'?c.english_name:c.id));render();};
    $('select-owned').onclick=selectVisibleOwned;
    $('clear-selected').onclick=()=>{state.selected.clear();render();};
    $('bulk-cancel').onclick=()=>{state.bulk=false;state.selected.clear();render();};
    for(const [id,value] of [['bulk-register',true],['bulk-unregister',false]])$(id).onclick=()=>{const r=state.tab==='wheels'?M.applyWheels(state.account,[...state.selected],{owned:value}):M.apply(state.account,[...state.selected],{owned:value},state.growth);commit(r.account,`${state.selected.size}${state.tab==='wheels'?'개':'명'} ${value?'보유 등록':'보유 해제'}했습니다.`);};
    $('bulk-edit').onclick=()=>openEditor([...state.selected],true);
    $('editor-form').onsubmit=saveEditor;
    $('editor-form').addEventListener('input',handleEditorInput);
    $('editor-form').addEventListener('change',handleEditorInput);
    $('editor').addEventListener('cancel',e=>{if($('editor-form').dataset.dirty==='true'&&!confirm('저장하지 않은 변경을 닫을까요?'))e.preventDefault();});
    $('presets-button').onclick=showPresets;
    document.querySelectorAll('dialog:not(#roster-tour):not(#report-modal)').forEach(d=>{d.addEventListener('close',()=>{if(d.id==='editor'&&$('editor-form').dataset.bulk==='true'&&state.bulk)endBulkEdit();document.body.style.overflow='';const focus=state.lastFocus;if(focus?.isConnected)focus.focus();else if(focus?.dataset.edit)document.querySelector((focus.hasAttribute('data-edit-level')?'[data-edit-level]':':not([data-edit-level])')+'[data-edit="'+CSS.escape(focus.dataset.edit)+'"]')?.focus();else $('roster-help').focus();});});
}
function setVisibleOwnership(owned){const ids=filtered().map(c=>state.tab==='wheels'?c.english_name:c.id);mutate(a=>{for(const id of ids){if(state.tab==='wheels')(a.wheels[id]||={owned:false,potency:0}).owned=owned;else(a.characters[id]||={owned:false,potency:0,talents:{},skills:{}}).owned=owned;}},`현재 검색 결과 ${ids.length}${state.tab==='wheels'?'개':'명'} ${owned?'보유 등록':'해제'}했습니다.`);}
function selectVisibleOwned(){filtered().forEach(c=>{const id=state.tab==='wheels'?c.english_name:c.id;if((state.tab==='wheels'?wheel(id):entry(id)).owned)state.selected.add(id);});render();}
function resetInventory(){ $('search').value='';['availability-filter','chapter-filter','grade-filter','relems-filter','class-filter'].forEach(id=>$(id).value='all');state.role='all';state.group='all';state.grade='all';$('owned-filter').value='all';$('sort').value='default';state.owned='all';render(); }
function endBulkEdit(){state.bulk=false;state.selected.clear();render();state.lastFocus=$('bulk-toggle');}
function modal(id) {state.lastFocus=document.activeElement;$(id).showModal();document.body.style.overflow='hidden';}
function inputField(key,label,max,value='',min=0,bulk=false) {
    const id=`growth-${key.replaceAll(':','-')}`;
    const icons={'talent:2':'UI_Character_Talent_Common_S1.png','talent:1':'UI_Character_Potency_energy_increase.png','talent:3':'UI_Character_Potency_actor_crit.png',potency:'UI_Common_Star_Icon_6.png'};
    const icon=icons[key]||(key.startsWith('skill:')?'UI_Comon_Icon_AwakerSkill.png':null);
    const slotLabel=skillSlots.find(([slot])=>key===`skill:${slot}`)?.[1];
    if(slotLabel)label=slotLabel;
    const current=value==null?'':value;
    const canonical=bulk?`<input type="hidden" data-field="${esc(key)}" min="${min}" max="${max}" value="">`:'';
    const mode=bulk?`<select data-mode="${esc(key)}" aria-label="${esc(label)} 적용 방식"><option value="">변경 안 함</option><option value="custom">값 지정</option><option value="max">각자 최대</option><option value="null">기본값</option></select>`:'';
    return `<div class="field slider-field ${key==='skill:Slot_Super'?'madness-field':''}" data-slider-field="${esc(key)}"><span class="field-art" aria-hidden="true">${icon?`<img src="images/growth/${icon}" alt="" width="258" height="258">`:'<span class="level-mark">Lv.</span>'}</span><label for="${id}">${esc(label)}</label>${canonical}${mode}<div class="slider-controls" ${bulk?'hidden':''}><span class="field-value"><input id="${id}" type="number" ${bulk?'data-range-number':'data-field'}="${esc(key)}" min="${min}" max="${max}" step="1" value="${bulk?'':current}" placeholder="—" aria-label="${esc(label)} 정확한 값"><span class="field-maximum">/ ${max}</span></span><input type="range" data-range="${esc(key)}" min="${min}" max="${max}" step="1" value="${current===''?min:current}" aria-label="${esc(label)} 슬라이더"></div>${key==='potency'?'<span class="field-potency-preview classic-stepper" data-potency-preview></span>':''}</div>`;
}
function syncSliders(preserveCustom = false) {
    document.querySelectorAll('#editor [data-slider-field]').forEach(field=>{
        const canonical=field.querySelector('[data-field]'),range=field.querySelector('[data-range]'),mode=field.querySelector('[data-mode]'),number=field.querySelector('input[type=number]');
        const value=canonical.value;
        if(mode){const custom=value!==''&&value!=='max'&&value!=='null'||preserveCustom&&mode.value==='custom'&&value==='';mode.value=custom?'custom':value;field.querySelector('.slider-controls').hidden=!custom;if(custom)number.value=value;}
        range.disabled=canonical.disabled;number.disabled=canonical.disabled;
        if(mode)mode.disabled=canonical.disabled;
        const explicit=value!==''&&value!=='max'&&value!=='null';
        range.value=explicit?value:range.min;
        range.style.setProperty('--range-fill',`${100*(Number(range.value)-Number(range.min))/Math.max(1,Number(range.max)-Number(range.min))}%`);
        range.setAttribute('aria-valuetext',explicit?value:'미입력');
        field.classList.toggle('fixed-field',canonical.disabled);
        const preview=field.querySelector('[data-potency-preview]');
        if(preview){preview.hidden=!explicit;preview.innerHTML=explicit?potencyBadge(Number(value)):'';}
    });
}
function handleEditorInput(event) {
    const target=event.target,field=target.closest('[data-slider-field]');
    if(field){
        const canonical=field.querySelector('[data-field]'),range=field.querySelector('[data-range]'),number=field.querySelector('input[type=number]'),mode=field.querySelector('[data-mode]');
        if(target.hasAttribute('data-mode')){
            canonical.value=target.value==='custom'?(number.value||range.min):target.value;
        }else if(target.hasAttribute('data-range')){
            canonical.value=target.value;number.value=target.value;
        }else if(target===number){
            canonical.value=target.value;
        }
        syncSliders(true);
    }
    $('editor-form').dataset.dirty='true';updatePatchSummary();
}
function openEditor(ids,bulk=false) {
    state.editIds=ids;$('editor-form').dataset.bulk=String(bulk);$('editor-form').dataset.dirty='false';
    const isWheel=state.tab==='wheels';$('editor-form').dataset.kind=isWheel?'wheel':'character';
    $('editor').setAttribute('aria-label',isWheel?'명륜 돌파 편집':'성장 정보 편집');
    if(isWheel){
        const e=wheel(ids[0]);
        $('editor-title').innerHTML=`<h2>${bulk?`${ids.length}개 명륜 편집`:esc(state.wheels.find(w=>w.english_name===ids[0]).korean_name)}</h2>`;
        $('editor-body').innerHTML=`<div class="editor-options"><label class="check-line"><input type="checkbox" id="editor-owned" ${!bulk&&e.owned?'checked':''}> ${bulk?'선택한 명륜을 보유 등록':'보유 명륜'}</label></div><section class="editor-section"><div class="field-grid">${inputField('potency','돌파',15,e.potency??0,0,bulk)}</div></section><p id="patch-summary" class="import-summary" role="status" aria-live="polite" hidden></p>`;
        $('editor-submit').textContent=bulk?`${ids.length}개에 적용`:'저장';
        syncSliders();updatePatchSummary();if(!$('editor').open)modal('editor');else $('editor-body').scrollTop=0;
        return;
    }
    const c=char(ids[0]),e=entry(ids[0]),g=state.growth[c.id];
    $('editor-title').innerHTML=bulk?`<h2>${ids.length}명 편집</h2>`:`<div class="editor-person"><img src="${esc(c.image_thumb)}" alt=""><div><h2>${esc(c.name)}</h2></div></div>`;
    const allFields=bulk?[...new Map(Object.values(state.growth).flatMap(M.fields).map(f=>[f.key,f])).values()]:M.fields(g);
    if(!bulk&&state.limitedIds.includes(c.id)&&!allFields.some(f=>f.key==='talent:3'))allFields.push({key:'talent:3',label:'내재 영격',min:0,max:5});
    // Bulk talent maxima use the maximum catalog range; applying is resolved per character.
    const bulkFields=bulk?allFields.map(f=>({...f,max:Math.max(...Object.values(state.growth).flatMap(x=>M.fields(x).filter(t=>t.key===f.key).map(t=>t.max)))})):allFields;
    const fHTML=fs=>fs.map(f=>inputField(f.key,f.label,f.max,M.get(e,f.key),f.min,bulk)).join('');
    $('editor-body').innerHTML=`<div class="editor-options"><label class="editor-preset-field"><span>프리셋</span><select id="editor-preset"><option value="">직접 설정</option>${builtinPresets.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}${state.account.presets.map((p,i)=>`<option value="user:${i}">${esc(p.name)}</option>`).join('')}</select></label>
    <label class="check-line"><input type="checkbox" id="editor-owned" ${!bulk&&e.owned?'checked':''}> ${bulk?'선택한 캐릭터를 보유 등록':'보유 캐릭터'}</label></div>
    <section class="editor-section"><h3 class="field-heading">기본 성장</h3><div class="field-grid">${inputField('potency','돌파',15,e.potency??0,0,bulk)}${fHTML(bulkFields.filter(f=>f.key==='level'))}</div>
    ${!g&&!bulk?'<p class="editor-note warning">성장 데이터 없음</p>':''}
    </section><section class="editor-section editor-talents"><h3 class="field-heading">특성</h3><div class="field-grid">${fHTML(bulkFields.filter(f=>f.key.startsWith('talent:')).sort((a,b)=>['talent:2','talent:1','talent:3'].indexOf(a.key)-['talent:2','talent:1','talent:3'].indexOf(b.key)))}</div></section>
    <section class="editor-section"><div class="editor-section-heading"><h3 class="field-heading">스킬 레벨</h3><div class="quick-actions"><button type="button" id="max-skills">스킬 모두 최대</button><button type="button" id="clear-skills">스킬 초기화</button></div></div><div class="field-grid">${fHTML(bulkFields.filter(f=>f.key.startsWith('skill:')).map(f=>bulk?{...f,label:({'Slot_Strike':'타격','Slot_Defend':'방어','Slot_Skill1':'전술 스킬 1','Slot_Skill2':'전술 스킬 2','Slot_Awake':'각성 스킬','Slot_Super':'초각성 스킬'})[f.key.split(':')[1]]||f.label}:f))}</div></section>
    <div class="editor-followup">${bulk?'<label class="check-line"><input type="checkbox" id="blanks-only"> 기본값만 변경</label><label class="field"><span>이 설정을 프리셋으로 저장 (선택)</span><input type="text" maxlength="80" id="preset-name" placeholder="프리셋 이름"></label>':'<label class="check-line"><input type="checkbox" id="save-next"> 저장 후 다음 캐릭터 편집</label>'}</div>
    <p id="patch-summary" class="import-summary" role="status" aria-live="polite" hidden></p>`;
    $('editor-submit').textContent=bulk?`${ids.length}명에게 적용`:'저장';
    $('max-skills').onclick=()=>{document.querySelectorAll('#editor [data-field^="skill:"]').forEach(el=>el.value=bulk?'max':el.max);$('editor-form').dataset.dirty='true';syncSliders();updatePatchSummary();};
    $('clear-skills').onclick=()=>{document.querySelectorAll('#editor [data-field^="skill:"]').forEach(el=>el.value=bulk?'null':'1');$('editor-form').dataset.dirty='true';syncSliders();updatePatchSummary();};
    $('editor-preset').onchange=()=>{const value=$('editor-preset').value;let patch={};if(value.startsWith('user:'))patch=state.account.presets[Number(value.split(':')[1])].patch;else for(const f of [{key:'potency'},...bulkFields])if(value==='defaults'||value==='growth'||value==='cards'&&f.key.startsWith('skill:')||value==='talents'&&f.key.startsWith('talent:'))patch[f.key]=value==='defaults'?(f.key==='level'||f.key.startsWith('skill:')?1:0):'max';document.querySelectorAll('#editor [data-field]').forEach(el=>{if(el.disabled)return;const value=patch[el.dataset.field];if(bulk)el.value=value===null?'null':value??'';else if(value!==undefined)el.value=value==='max'?el.max:value??'';});$('editor-form').dataset.dirty='true';syncSliders();updatePatchSummary();};
    if(ids.every(id=>state.limitedIds.includes(id))){const locked=document.querySelector('#editor [data-field="talent:3"]');if(locked){locked.value=5;locked.disabled=true;locked.setAttribute('aria-label','내재 영격 5 고정');}}
    syncSliders();updatePatchSummary();if(!$('editor').open)modal('editor');else $('editor-body').scrollTop=0;
}
function readPatch() {const bulk=$('editor-form').dataset.bulk==='true',patch={};document.querySelectorAll('#editor [data-field]').forEach(el=>{if(el.disabled)return;const value=el.value;if(bulk&&value==='')return;patch[el.dataset.field]=value==='max'?'max':value==='null'||value===''?null:Number(value);});if(!bulk||$('editor-owned').checked)patch.owned=$('editor-owned').checked;return patch;}
function patchResult(){return $('editor-form').dataset.kind==='wheel'?M.applyWheels(state.account,state.editIds,readPatch()):M.apply(state.account,state.editIds,readPatch(),state.growth,$('blanks-only')?.checked===true,state.limitedIds,true);}
function updatePatchSummary() { const r=patchResult();$('patch-summary').hidden=!r.skipped.length;$('patch-summary').textContent=r.skipped.length?`${r.skipped.length}개 항목 적용 불가`:''; }
function saveEditor(event) {
    event.preventDefault();const r=patchResult(),bulk=$('editor-form').dataset.bulk==='true',next=$('save-next')?.checked,id=state.editIds[0];
    const presetName=$('preset-name')?.value.trim();
    if(bulk&&presetName)r.account.presets.push({name:presetName,patch:readPatch()});
    if(!commit(r.account,`성장값 ${r.changes}개 항목 저장${r.skipped.length?` · ${r.skipped.length}개 항목 제외`:''}`))return;
    const savedNotice=()=>notice(`${bulk?'일괄 설정을 저장했습니다.':'저장했습니다.'}${r.skipped.length?` (${r.skipped.length}개 항목 제외)`:''}`,'success');
    if(bulk)endBulkEdit();
    $('editor-form').dataset.dirty='false';if(next){const rows=filtered(),i=rows.findIndex(c=>c.id===id);if(rows[i+1]){openEditor([rows[i+1].id]);$('save-next').checked=true;savedNotice();return;}}$('editor').close();savedNotice();
}
function showPresets(){
    const dialog=$('utility');
    if(!dialog.classList.contains('preset-dialog')){
        dialog.classList.add('preset-dialog');
        dialog.addEventListener('close',()=>dialog.classList.remove('preset-dialog'),{once:true});
    }
    const icons={cards:'UI_Comon_Icon_AwakerSkill.png',talents:'UI_Common_Icon_AwakerTalent.png',growth:'UI_Common_Star_Icon_6.png'};
    $('utility-title').textContent='프리셋';
    $('utility-body').innerHTML=`<section class="preset-section" aria-labelledby="builtin-presets-title"><h3 id="builtin-presets-title">기본 프리셋</h3><div class="builtin-preset-grid">${builtinPresets.map(p=>`<button class="builtin-preset" data-builtin-preset="${p.id}" aria-label="${esc(p.name)} 적용" aria-haspopup="dialog"><span class="preset-icon" aria-hidden="true">${icons[p.id]?`<img src="images/growth/${icons[p.id]}" alt="" width="28" height="28">`:'↺'}</span><span>${esc(p.name)}</span><span class="preset-arrow" aria-hidden="true">›</span></button>`).join('')}</div></section>
    <section class="preset-section" aria-labelledby="user-presets-title"><div class="preset-section-heading"><h3 id="user-presets-title">내 프리셋 <span class="preset-count">${state.account.presets.length}</span></h3><button id="new-preset"><span aria-hidden="true">＋</span> 새 프리셋</button></div><div class="user-preset-list">${state.account.presets.length?state.account.presets.map((p,i)=>`<div class="user-preset-row"><button class="user-preset-apply" data-preset-apply="${i}" aria-label="${esc(p.name)} 적용" aria-haspopup="dialog"><span>${esc(p.name)}</span><span class="preset-arrow" aria-hidden="true">›</span></button><details class="preset-menu"><summary aria-label="${esc(p.name)} 관리">⋯</summary><div><button data-preset-rename="${i}">이름 변경</button><button data-preset-duplicate="${i}">복제</button><button data-preset-delete="${i}">삭제</button></div></details></div>`).join(''):'<p class="preset-empty">저장한 프리셋 없음</p>'}</div></section>`;
    $('new-preset').onclick=()=>{const ids=state.selected.size?[...state.selected]:state.chars.filter(c=>entry(c.id).owned).map(c=>c.id);dialog.close();if(!ids.length){notice('보유 캐릭터를 등록하거나 일괄 편집에서 대상을 선택해 주세요.');return;}openEditor(ids,true);$('preset-name').focus();};
    if(!dialog.open)modal('utility');
}
function applyPreset(i){const ids=state.selected.size?[...state.selected]:state.chars.filter(c=>entry(c.id).owned).map(c=>c.id);if(!ids.length){notice('보유 캐릭터나 편집 대상을 먼저 선택해 주세요.');return;}$('utility').close();openEditor(ids,true);$('editor-preset').value=typeof i==='number'?`user:${i}`:i;$('editor-preset').dispatchEvent(new Event('change'));}
async function buildShareImage(options) {
    const scope=shareScope($('share-scope').value);
    const characterRows=scope==='wheels'?[]:filtered('characters'),wheelRows=scope==='characters'?[]:filtered('wheels');
    const characters=characterRows.filter(c=>entry(c.id).owned),wheels=wheelRows.filter(c=>wheel(c.english_name).owned);
    if(!characters.length&&!wheels.length)throw Error('현재 범위에 공유할 보유 항목이 없습니다.');
    const characterOwned=characters.length,wheelOwned=wheels.length;
    const describeFilters=tab=>{
        const filters=[...document.querySelectorAll(tab==='wheels'?'#owned-filter':'#character-filters select,#owned-filter')].filter(s=>s.value!=='all').map(s=>s.selectedOptions[0].textContent);
        if(tab===state.tab&&$('search').value.trim())filters.push($('search').value.trim());
        if(tab==='wheels'&&state.grade!=='all')filters.push(state.grade);
        return filters.length?`<p class="share-filter-summary">${esc(filters.join(' · '))}</p>`:'';
    };
    const characterGrid=Object.entries(realms).map(([key,label])=>{
        const members=characters.filter(c=>c.relems===key);
        return members.length?`<section class="relems-section ${key}"><h3 class="relems-section-title">${label}</h3><div class="relems-character-grid">${members.map(characterCard).join('')}</div></section>`:'';
    }).join('');
    const html=`<header class="inventory-summary"><h1>각성체 / 명륜 보유 현황</h1><div class="summary-counts"><span>각성체 <strong>${characterOwned}</strong> / ${characterRows.length}</span><span>명륜 <strong>${wheelOwned}</strong> / ${wheelRows.length}</span></div></header>
    <section class="share-roster-section" data-share-kind="characters"><header class="share-section-heading"><h2>각성체</h2>${describeFilters('characters')}</header><div id="inventory-grid" class="character-grid classic-groups">${characterGrid||'<p class="muted">조건에 맞는 각성체가 없습니다.</p>'}</div></section>
    <section class="share-roster-section" data-share-kind="wheels"><header class="share-section-heading"><h2>명륜</h2>${describeFilters('wheels')}</header><div class="character-grid share-wheel-grid">${wheels.map(wheelCard).join('')||'<p class="muted">조건에 맞는 명륜이 없습니다.</p>'}</div></section>`;
    const snapshot=document.createElement('div');snapshot.innerHTML=html;
    if(scope!=='all'){
        const excluded=scope==='characters'?'wheels':'characters';
        snapshot.querySelector(`[data-share-kind="${excluded}"]`).remove();
        snapshot.querySelector('.summary-counts').children[scope==='characters'?1:0].remove();
        snapshot.querySelector('h1').textContent=`${scope==='characters'?'각성체':'명륜'} 보유 현황`;
    }
    snapshot.querySelectorAll('.character-card').forEach(card=>{
        card.classList.remove('is-selected');
        card.querySelector('.compact-select').setAttribute('aria-pressed',String(card.classList.contains('selected')));
    });
    return window.RosterShareImage.render(snapshot.innerHTML,options);
}
function saveShareCanvas(canvas){
    canvas.toBlob(blob=>{if(!blob){notice('이미지 생성에 실패했습니다.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=blob.type==='image/webp'?'morimens-inventory.webp':'morimens-inventory.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/webp',.92);
}
async function shareImage(mode){
    if(state.shareBusy)return;
    state.shareBusy=true;
    const actions=[$('copy-image'),$('preview-image-button'),$('share-scope')];actions.forEach(button=>button.disabled=true);
    try{
    if(mode==='copy'&&navigator.clipboard?.write&&window.ClipboardItem){
        const dialog=$('utility');dialog.classList.add('share-copy-dialog');
        $('utility-title').textContent='이미지 복사';
        $('utility-body').innerHTML='<div class="share-loading" role="status" aria-busy="true"><span><span id="copy-progress-label">이미지 준비 중</span><strong id="copy-progress-value">0%</strong></span><progress id="copy-progress" max="100" value="0" aria-label="이미지 복사 진행률"></progress></div>';
        if(!dialog.open)modal('utility');
        const progress=$('copy-progress'),value=$('copy-progress-value'),label=$('copy-progress-label'),loading=progress.closest('.share-loading');
        const update=(amount,text)=>{progress.value=Math.max(progress.value,amount);value.textContent=`${Math.round(progress.value)}%`;label.textContent=text;};
        dialog.addEventListener('close',()=>{dialog.classList.remove('share-copy-dialog');$('utility-body').replaceChildren();},{once:true});
        const imagePromise=buildShareImage({onProgress:n=>update(n*.55,'이미지 준비 중'),onRenderProgress:n=>update(55+n*.37,'이미지 변환 중')}).then(canvas=>{
            update(92,'클립보드에 복사 중');
            return new Promise((resolve,reject)=>canvas.toBlob(blob=>{if(blob){update(98,'클립보드에 복사 중');resolve(blob);}else reject(Error('이미지 생성에 실패했습니다.'));},'image/png'));
        });
        try{
            await navigator.clipboard.write([new ClipboardItem({'image/png':imagePromise})]);
            update(100,'복사 완료');loading.setAttribute('aria-busy','false');
            if(progress.isConnected&&dialog.open)dialog.close();
            notice('이미지를 클립보드에 복사했습니다.');
        }catch(error){
            await imagePromise.catch(()=>{});loading.setAttribute('aria-busy','false');
            label.textContent='복사하지 못했습니다. 미리보기에서 다운로드해 주세요.';progress.remove();value.remove();
            notice('이미지 복사에 실패했습니다. 미리보기에서 다운로드할 수 있습니다.');
        }return;
    }
    try{
        $('utility').classList.add('share-preview-dialog');
        $('utility-title').textContent='공유 이미지 미리보기';
        $('utility-body').innerHTML='<div class="quick-actions"><button id="zoom-share" aria-pressed="false" disabled>확대 보기</button><button id="save-share" class="primary" disabled>이미지 다운로드</button></div><div id="share-image-stage" class="share-image-stage" tabindex="0" aria-label="보유 현황 이미지. 확대하면 스크롤해서 볼 수 있습니다." aria-busy="true"><div class="share-loading" role="status"><span>미리보기 준비 중 <strong id="share-progress-value">0%</strong></span><progress id="share-progress" max="100" value="0" aria-label="미리보기 준비 진행률"></progress></div></div>';
        if(!$('utility').open)modal('utility');
        const progress=$('share-progress'),progressValue=$('share-progress-value');
        const capture=await buildShareImage({preview:true,host:$('share-image-stage'),onProgress:value=>{progress.value=value;progressValue.textContent=`${Math.round(value)}%`;}});
        if(!$('utility').open){capture.dispose();$('utility').classList.remove('share-preview-dialog');$('utility-body').replaceChildren();return;}
        $('zoom-share').onclick=()=>{const expanded=$('share-image-stage').classList.toggle('is-expanded');capture.expand(expanded);$('zoom-share').setAttribute('aria-pressed',String(expanded));$('zoom-share').textContent=expanded?'화면에 맞춤':'확대 보기';};
        $('save-share').onclick=async()=>{const button=$('save-share');button.disabled=true;button.textContent='이미지 만드는 중…';try{saveShareCanvas(await capture.canvas());}catch(error){notice(error.message);}finally{button.disabled=false;button.textContent='이미지 다운로드';}};
        $('utility').addEventListener('close',()=>{capture.dispose();$('utility').classList.remove('share-preview-dialog');$('utility-body').replaceChildren();},{once:true});
        if(!$('utility').open)modal('utility');
        capture.mount($('share-image-stage'));
        $('share-image-stage').setAttribute('aria-busy','false');
        $('share-image-stage').querySelector('.share-loading')?.remove();
        $('zoom-share').disabled=false;$('save-share').disabled=false;
        if(mode==='copy')notice('이 브라우저에서는 이미지 복사를 지원하지 않아 미리보기를 열었습니다.');
    }catch(error){const loading=$('share-image-stage')?.querySelector('.share-loading');if(loading)loading.textContent=error.message;$('share-image-stage')?.setAttribute('aria-busy','false');notice(error.message);}
    }finally{state.shareBusy=false;actions.forEach(button=>button.disabled=false);}
}
load();
})();
