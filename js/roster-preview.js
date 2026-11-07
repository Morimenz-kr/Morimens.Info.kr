(function () {
'use strict';
const M = window.RosterModel, $ = id => document.getElementById(id);
const realms = {chaos:'혼돈',aequor:'심해',caro:'혈육',ultra:'초차원'};
const potencyLabel = n => n === 0 ? '명함' : n === 7 ? '초한' : n === 15 ? '풀돌' : `${n}돌`;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {account:M.empty(),chars:[],wheels:[],growth:{},tab:'characters',view:'cards',owned:'all',bulk:false,selected:new Set(),undo:null,editIds:[],lastFocus:null,teams:[],demo:false,teamStats:false};
const entry = id => state.account.characters[id] || {owned:false,potency:0,talents:{},skills:{}};
const wheel = id => state.account.wheels[id] || {owned:false,potency:0};
const char = id => state.chars.find(c=>c.id===id);
function notice(message, undo=false) { $('toast-message').textContent=message; $('undo-button').hidden=!undo; $('toast').hidden=false; }
function commit(account,message) {
    try { localStorage.setItem(M.KEY,JSON.stringify(account)); }
    catch { notice('저장 공간이 부족하거나 저장이 차단됐습니다. 변경을 적용하지 않았습니다.'); return false; }
    state.undo=M.clone(state.account); state.account=account; render(); if(message)notice(message,true); return true;
}
function mutate(fn,message) {const next=M.clone(state.account);fn(next);return commit(next,message);}
async function load() {
    try {
        const fetchJSON = async path => {const response=await fetch(path);if(!response.ok)throw Error(path);return response.json();};
        const [chars,wheels,growth] = await Promise.all([fetchJSON('data/character_manifest.json'),fetchJSON('data/wheel_list.json'),fetchJSON('data/character_growth.json')]);
        state.chars=chars;state.wheels=wheels.filter(w=>w.grade!=='UR');state.growth=growth.characters;
        try { const saved=localStorage.getItem(M.KEY);state.account=saved?M.validate(JSON.parse(saved),chars.map(c=>c.id),state.wheels.map(w=>w.english_name),state.growth).account:M.migrate(JSON.parse(localStorage.getItem(M.LEGACY)||'null')); }
        catch { notice('저장값을 읽지 못했습니다. 원본은 유지했으며 빈 프리뷰로 열었습니다.'); }
        state.teams=[
            {id:'aequor',name:'심해 조합',members:['Murphy_Fauxborn','miryam','goliath','tulu'],wave:3},
            {id:'ultra',name:'초차원 조합',members:['pollux','castor','clementine','arachne'],wave:1},
            {id:'chaos',name:'혼돈 조합',members:['24','nautila','ogier','tawil'],wave:5},
            {id:'caro',name:'혈육 조합',members:['saya','salvador','murphy','vortice'],wave:4}
        ].map(t=>({...t,members:t.members.filter(id=>char(id))})).filter(t=>t.members.length===4);
        const options=state.chars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
        $('team-include').insertAdjacentHTML('beforeend',options);$('team-exclude').insertAdjacentHTML('beforeend',options);
        bind();render();
    } catch(error) { $('inventory-grid').innerHTML='<div class="empty"><h2>자료를 불러오지 못했어요.</h2><p>연결 상태를 확인하고 새로고침해 주세요.</p><button onclick="location.reload()">다시 시도</button></div>';console.error(error); }
}
function filtered() {
    const query=$('search').value.trim().toLowerCase(),realm=$('realm').value,role=$('role').value;
    let rows=(state.tab==='wheels'?state.wheels:state.chars).filter(c=>{
        const isWheel=state.tab==='wheels', id=isWheel?c.english_name:c.id, e=isWheel?wheel(id):entry(id);
        return (!query||`${c.name||c.korean_name} ${id}`.toLowerCase().includes(query))
            &&(state.owned==='all'||(state.owned==='owned'?e.owned:!e.owned))
            &&(isWheel||realm==='all'||c.relems===realm)&&(isWheel||role==='all'||c.class===role)
            &&(isWheel||!$('incomplete').checked||e.owned&&!M.complete(e,state.growth[id]));
    });
    if($('sort').value==='name') rows.sort((a,b)=>(a.name||a.korean_name).localeCompare(b.name||b.korean_name,'ko'));
    if($('sort').value==='potency') rows.sort((a,b)=>(state.tab==='wheels'?wheel(b.english_name).potency:entry(b.id).potency)-(state.tab==='wheels'?wheel(a.english_name).potency:entry(a.id).potency));
    return rows;
}
function selectionHTML(id) {return state.bulk?`<label class="select-label"><span class="sr-only">${esc(char(id)?.name)} 편집 대상으로 선택</span><input type="checkbox" data-select="${esc(id)}" ${state.selected.has(id)?'checked':''}></label>`:'';}
function characterCard(c) {
    const e=entry(c.id),g=state.growth[c.id],skills=g?.skillUpgrades||[];
    const filled=skills.filter(s=>e.skills?.[s.slot]!=null).length;
    const allMax=skills.length&&skills.every(s=>e.skills?.[s.slot]===s.maxLevel);
    const skillLabel=!filled?'미입력':allMax?'전체 최대':filled<skills.length?`${filled}/${skills.length}개 입력`:'개별 설정';
    const talentRows=[2,1,3].map(type=>g?.talentUpgrades?.find(t=>t.type===type)).filter(Boolean);
    return `<article class="character-card ${e.owned?'':'not-owned'} ${state.selected.has(c.id)&&state.bulk?'is-selected':''}">
    ${selectionHTML(c.id)}<div class="card-identity"><img class="card-portrait" src="${esc(c.image_thumb)}" alt="" width="64" height="76" loading="lazy"><div><span class="realm-name">${realms[c.relems]||''} · ${{assault:'공격형',warden:'방어형',chorus:'보조형'}[c.class]||''}</span><h3>${esc(c.name)}</h3><p class="card-sub">Lv.${e.level??'—'} · ${potencyLabel(e.potency??0)}</p><label class="ownership"><input data-own="${esc(c.id)}" type="checkbox" ${e.owned?'checked':''}> 보유${e.owned&&!M.complete(e,g)?' · 성장 미입력':''}</label></div></div>
    <div class="card-growth">${g?talentRows.map(t=>`<div class="stat-line"><span>${esc(t.name)}</span><strong>${e.talents?.[t.type]??'—'} <span class="muted">/ ${t.maxLevel}</span></strong></div>`).join('')+`<details class="card-skill"><summary>스킬 · ${skillLabel}</summary><dl>${skills.map(s=>`<div class="stat-line"><dt>${esc(s.name)}</dt><dd>${e.skills?.[s.slot]??'—'} / ${s.maxLevel}</dd></div>`).join('')}</dl></details>`:'<p class="missing-data">성장 데이터 준비 중<br>보유·돌파는 등록할 수 있어요.</p>'}</div>
    <div class="card-actions"><button data-edit="${esc(c.id)}">성장 편집</button><button data-find="${esc(c.id)}">조합 찾기</button></div></article>`;
}
function wheelCard(w) { const e=wheel(w.english_name);return `<article class="character-card wheel-card ${e.owned?'':'not-owned'}"><div class="card-identity"><img class="card-portrait" src="${esc(w.image_path)}" alt="" width="70" height="70" loading="lazy"><div><span class="realm-name">${esc(w.grade)}</span><h3>${esc(w.korean_name)}</h3><label class="ownership"><input type="checkbox" data-wheel-own="${esc(w.english_name)}" ${e.owned?'checked':''}> 보유</label></div></div><div class="card-actions"><label for="wheel-${esc(w.english_name)}">돌파</label><select id="wheel-${esc(w.english_name)}" data-wheel-potency="${esc(w.english_name)}">${[0,1,2,3].map(n=>`<option value="${n}" ${e.potency===n?'selected':''}>${potencyLabel(n)}</option>`).join('')}</select></div></article>`; }
function render() {
    const focus=document.activeElement;const focusData=['own','select','wheelOwn','wheelPotency'].find(key=>focus?.dataset?.[key]);
    const owned=state.chars.filter(c=>entry(c.id).owned),complete=owned.filter(c=>M.complete(entry(c.id),state.growth[c.id]));
    $('account-summary').textContent=`각성체 ${owned.length}/${state.chars.length} · 성장 입력 ${complete.length}/${owned.length} · 명륜 ${state.wheels.filter(w=>wheel(w.english_name).owned).length}`;
    $('character-total').textContent=owned.length;$('wheel-total').textContent=state.wheels.filter(w=>wheel(w.english_name).owned).length;
    document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    $('inventory-panel').hidden=state.tab==='teams';$('teams-panel').hidden=state.tab!=='teams';
    $('search').placeholder=state.tab==='wheels'?'명륜 이름 검색':'각성체 이름 검색';
    $('realm').closest('label').hidden=state.tab==='wheels';$('incomplete').closest('label').hidden=state.tab==='wheels';$('role').closest('label').hidden=state.tab==='wheels';
    $('bulk-toggle').hidden=state.tab!=='characters';$('presets-button').hidden=state.tab!=='characters';
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
    document.querySelectorAll('[data-owned]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.owned===state.owned)));
    $('bulk-toggle').textContent=state.bulk?'일괄 편집 중':'일괄 편집';$('selection-tools').hidden=!state.bulk;$('bulk-bar').hidden=!state.bulk;
    const rows=filtered();$('result-count').textContent=`${state.tab==='wheels'?'명륜':'각성체'} ${rows.length}${state.tab==='wheels'?'개':'명'} · ${state.bulk?'편집할 대상을 선택하세요.':'— 는 미입력 값입니다.'}`;
    $('filter-badge').textContent=[$('role').value!=='all',$('incomplete').checked,$('sort').value!=='default'].filter(Boolean).length||'';
    $('inventory-grid').className=`character-grid ${state.view==='list'?'list-view':''}`;
    $('inventory-grid').innerHTML=rows.length?rows.map(state.tab==='wheels'?wheelCard:characterCard).join(''):'<div class="empty"><h2>조건에 맞는 항목이 없어요.</h2><p>검색어나 보유 조건을 바꿔보세요.</p><button data-reset-inventory>필터 초기화</button></div>';
    $('bulk-count').textContent=`${state.selected.size}명 선택`;
    const visible=new Set(rows.map(c=>c.id));const hidden=[...state.selected].filter(id=>!visible.has(id)).length;
    $('hidden-selection').textContent=hidden?`현재 목록 밖 ${hidden}명 포함`:'';
    ['bulk-edit','bulk-register','bulk-unregister'].forEach(id=>$(id).disabled=!state.selected.size);
    if(state.tab==='teams')renderTeams();
    if(focusData&&!focus.isConnected){const attr='data-'+focusData.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());document.querySelector('['+attr+'="'+CSS.escape(focus.dataset[focusData])+'"]')?.focus();}
}
function bind() {
    document.addEventListener('click',event=>{
        const b=event.target.closest('button');if(!b)return;
        if(b.dataset.tab){state.tab=b.dataset.tab;state.bulk=false;state.selected.clear();$('search').value='';render();}
        if(b.dataset.view){state.view=b.dataset.view;render();}
        if(b.dataset.owned){state.owned=b.dataset.owned;render();}
        if(b.dataset.edit)openEditor([b.dataset.edit]);
        if(b.dataset.find){state.tab='teams';state.bulk=false;$('team-include').value=b.dataset.find;render();$('teams-panel').scrollIntoView({block:'start'});}
        if(b.hasAttribute('data-close')) { if(b.closest('#editor')&&$('editor-form').dataset.dirty==='true') {if(!confirm('저장하지 않은 변경을 닫을까요?'))return;} b.closest('dialog').close(); }
        if(b.hasAttribute('data-reset-inventory'))resetInventory();
        if(b.dataset.teamExport)exportBuild(b.dataset.teamExport);
        if(b.dataset.presetApply!==undefined)applyPreset(Number(b.dataset.presetApply));
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
    $('search').addEventListener('input',render);['realm','role','incomplete','sort'].forEach(id=>$(id).addEventListener('change',render));
    $('bulk-toggle').onclick=()=>{state.bulk=!state.bulk;state.selected.clear();render();};
    $('select-visible').onclick=()=>{filtered().forEach(c=>state.selected.add(c.id));render();};
    $('select-owned').onclick=()=>{state.chars.filter(c=>entry(c.id).owned).forEach(c=>state.selected.add(c.id));render();};
    $('clear-selected').onclick=()=>{state.selected.clear();render();};
    $('bulk-cancel').onclick=()=>{state.bulk=false;state.selected.clear();render();};
    for(const [id,value] of [['bulk-register',true],['bulk-unregister',false]])$(id).onclick=()=>{const r=M.apply(state.account,[...state.selected],{owned:value},state.growth);commit(r.account,`${state.selected.size}명 ${value?'보유 등록':'보유 해제'}했습니다.`);};
    $('bulk-edit').onclick=()=>openEditor([...state.selected],true);
    $('editor-form').onsubmit=saveEditor;
    $('editor-form').addEventListener('input',()=>{$('editor-form').dataset.dirty='true';updatePatchSummary();});
    $('editor-form').addEventListener('change',()=>{$('editor-form').dataset.dirty='true';updatePatchSummary();});
    $('editor').addEventListener('cancel',e=>{if($('editor-form').dataset.dirty==='true'&&!confirm('저장하지 않은 변경을 닫을까요?'))e.preventDefault();});
    $('undo-button').onclick=()=>{if(!state.undo)return;const prev=state.undo;if(commit(prev,'직전 변경을 되돌렸습니다.')){$('undo-button').hidden=true;state.undo=null;}};
    $('dismiss-toast').onclick=()=>{$('toast').hidden=true;};
    $('demo-button').onclick=demoAccount;$('backup-button').onclick=showBackup;$('presets-button').onclick=showPresets;
    ['team-wave','team-include','team-exclude','team-owned','team-support'].forEach(id=>$(id).addEventListener('change',renderTeams));
    $('show-team-list').onclick=()=>{state.teamStats=false;renderTeams();};$('show-team-stats').onclick=()=>{state.teamStats=true;renderTeams();};
    $('reset-teams').onclick=()=>{$('team-wave').value='all';$('team-include').value='';$('team-exclude').value='';$('team-owned').checked=false;$('team-support').checked=false;renderTeams();};
    document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('close',()=>{document.body.style.overflow='';const focus=state.lastFocus;if(focus?.isConnected)focus.focus();else if(focus?.dataset.edit)document.querySelector('[data-edit="'+CSS.escape(focus.dataset.edit)+'"]')?.focus();else $('backup-button').focus();});});
}
function resetInventory(){ $('search').value='';$('realm').value='all';$('role').value='all';$('incomplete').checked=false;$('sort').value='default';state.owned='all';render(); }
function modal(id) {state.lastFocus=document.activeElement;$(id).showModal();document.body.style.overflow='hidden';}
function inputField(key,label,max,value='',min=0,bulk=false) {
    if(bulk)return `<label class="field"><span>${esc(label)}</span><select data-field="${esc(key)}"><option value="">変更 안 함</option><option value="max">각자 최대</option><option value="null">미입력으로 비우기</option>${Array.from({length:Math.min(max-min+1,100)},(_,i)=>i+min).map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>`.replace('変更','변경');
    return `<label class="field"><span>${esc(label)}</span><input type="number" data-field="${esc(key)}" min="${min}" max="${max}" step="1" value="${value??''}" placeholder="미입력"><small>${min}–${max} · 빈칸은 미입력</small></label>`;
}
function openEditor(ids,bulk=false) {
    state.editIds=ids;$('editor-form').dataset.bulk=String(bulk);$('editor-form').dataset.dirty='false';
    const c=char(ids[0]),e=entry(ids[0]),g=state.growth[c.id];
    $('editor-title').innerHTML=bulk?`<h2>${ids.length}명 성장값 적용</h2><p class="muted editor-note">선택한 필드만 변경합니다.</p>`:`<div class="editor-person"><img src="${esc(c.image_thumb)}" alt=""><div><h2>${esc(c.name)}</h2><span class="muted">성장 정보 편집</span></div></div>`;
    const allFields=bulk?[...new Map(Object.values(state.growth).flatMap(M.fields).map(f=>[f.key,f])).values()]:M.fields(g);
    // Bulk talent maxima use the maximum catalog range; applying is resolved per character.
    const bulkFields=bulk?allFields.map(f=>({...f,max:Math.max(...Object.values(state.growth).flatMap(x=>M.fields(x).filter(t=>t.key===f.key).map(t=>t.max)))})):allFields;
    const fHTML=fs=>fs.map(f=>inputField(f.key,f.label,f.max,M.get(e,f.key),f.min,bulk)).join('');
    $('editor-body').innerHTML=`${bulk?`<label class="field"><span>성장 프리셋</span><select id="editor-preset"><option value="">직접 설정</option><option value="cards">카드만 최대</option><option value="talents">특성만 최대</option><option value="growth">레벨·특성·카드 최대</option>${state.account.presets.map((p,i)=>`<option value="user:${i}">${esc(p.name)}</option>`).join('')}</select></label>`:''}
    <label class="check-line"><input type="checkbox" id="editor-owned" ${!bulk&&e.owned?'checked':''}> ${bulk?'선택한 캐릭터를 보유 등록':'보유 캐릭터'}</label>
    <h3 class="field-heading">기본 성장</h3><div class="field-grid">${inputField('potency','돌파',15,e.potency??0,0,bulk)}${fHTML(bulkFields.filter(f=>f.key==='level'))}</div>
    ${!g&&!bulk?'<p class="editor-note warning">이 캐릭터의 성장 데이터는 준비 중입니다. 보유·돌파만 저장할 수 있습니다.</p>':''}
    <h3 class="field-heading">특성</h3><div class="field-grid">${fHTML(bulkFields.filter(f=>f.key.startsWith('talent:')).sort((a,b)=>['talent:2','talent:1','talent:3'].indexOf(a.key)-['talent:2','talent:1','talent:3'].indexOf(b.key)))}</div>
    <h3 class="field-heading">스킬 레벨</h3><div class="quick-actions"><button type="button" id="max-skills">스킬 모두 최대</button><button type="button" id="clear-skills">스킬 미입력으로</button></div><div class="field-grid">${fHTML(bulkFields.filter(f=>f.key.startsWith('skill:')).map(f=>bulk?{...f,label:({'Slot_Strike':'타격','Slot_Defend':'방어','Slot_Skill1':'전술 스킬 1','Slot_Skill2':'전술 스킬 2','Slot_Awake':'각성 스킬','Slot_Super':'초각성 스킬'})[f.key.split(':')[1]]||f.label}:f))}</div>
    <p class="editor-note">레벨 상한은 원본 성장 자료를 사용합니다. 해금 단계·장비·전투 조건까지 충족했다는 뜻은 아닙니다.</p>
    ${bulk?'<label class="check-line"><input type="checkbox" id="blanks-only" checked> 미입력 항목만 채우기</label><label class="field"><span>이 설정을 프리셋으로 저장 (선택)</span><input type="text" maxlength="80" id="preset-name" placeholder="예: 내 주력 특성"></label>':'<label class="check-line"><input type="checkbox" id="save-next"> 저장 후 다음 캐릭터 편집</label>'}
    <p id="patch-summary" class="import-summary" aria-live="polite"></p>`;
    $('editor-submit').textContent=bulk?`${ids.length}명에게 적용`:'저장';
    $('max-skills').onclick=()=>{document.querySelectorAll('#editor [data-field^="skill:"]').forEach(el=>el.value=bulk?'max':el.max);$('editor-form').dataset.dirty='true';updatePatchSummary();};
    $('clear-skills').onclick=()=>{document.querySelectorAll('#editor [data-field^="skill:"]').forEach(el=>el.value=bulk?'null':'');$('editor-form').dataset.dirty='true';updatePatchSummary();};
    if(bulk)$('editor-preset').onchange=()=>{const value=$('editor-preset').value;let patch={};if(value.startsWith('user:'))patch=state.account.presets[Number(value.split(':')[1])].patch;else for(const f of bulkFields)if(value==='growth'||value==='cards'&&f.key.startsWith('skill:')||value==='talents'&&f.key.startsWith('talent:'))patch[f.key]='max';document.querySelectorAll('#editor [data-field]').forEach(el=>el.value=patch[el.dataset.field]===null?'null':patch[el.dataset.field]??'');$('editor-form').dataset.dirty='true';updatePatchSummary();};
    updatePatchSummary();if(!$('editor').open)modal('editor');else $('editor').scrollTop=0;
}
function readPatch() {const bulk=$('editor-form').dataset.bulk==='true',patch={};document.querySelectorAll('#editor [data-field]').forEach(el=>{const value=el.value;if(bulk&&value==='')return;patch[el.dataset.field]=value==='max'?'max':value==='null'||value===''?null:Number(value);});if(!bulk||$('editor-owned').checked)patch.owned=$('editor-owned').checked;return patch;}
function patchResult(){return M.apply(state.account,state.editIds,readPatch(),state.growth,$('blanks-only')?.checked===true);}
function updatePatchSummary() { const r=patchResult();$('patch-summary').textContent=`${state.editIds.length}명 · 변경 ${r.changes}개 항목${r.skipped.length?` · 자료 누락/범위 초과 ${r.skipped.length}개 항목 제외`:''}`; }
function saveEditor(event) {
    event.preventDefault();const r=patchResult(),bulk=$('editor-form').dataset.bulk==='true',next=$('save-next')?.checked,id=state.editIds[0];
    if(bulk&&$('preset-name').value.trim())r.account.presets.push({name:$('preset-name').value.trim(),patch:readPatch()});
    if(!commit(r.account,`성장값 ${r.changes}개 항목 저장${r.skipped.length?` · ${r.skipped.length}개 항목 제외`:''}`))return;
    $('editor-form').dataset.dirty='false';if(next){const rows=filtered(),i=rows.findIndex(c=>c.id===id);if(rows[i+1]){openEditor([rows[i+1].id]);$('save-next').checked=true;return;}}$('editor').close();
}
function showPresets(){ $('utility-title').textContent='성장 프리셋';$('utility-body').innerHTML=`<p class="muted">돌파는 유지하고 필요한 성장값만 빠르게 적용하세요.</p><div class="quick-actions"><button id="new-preset" class="primary">새 프리셋 만들기</button></div>${state.account.presets.length?state.account.presets.map((p,i)=>`<div class="preset-row"><strong>${esc(p.name)}</strong><div><button data-preset-apply="${i}">적용</button><button data-preset-rename="${i}">이름 변경</button><button data-preset-duplicate="${i}">복제</button><button data-preset-delete="${i}">삭제</button></div></div>`).join(''):'<p class="editor-note">아직 저장한 프리셋이 없어요. 일괄 편집에서 설정에 이름을 붙여 저장할 수 있습니다.</p>'}`;$('new-preset').onclick=()=>{const ids=state.selected.size?[...state.selected]:state.chars.filter(c=>entry(c.id).owned).map(c=>c.id);$('utility').close();if(!ids.length){notice('보유 캐릭터를 등록하거나 일괄 편집에서 대상을 선택해 주세요.');return;}openEditor(ids,true);$('preset-name').focus();};if(!$('utility').open)modal('utility'); }
function applyPreset(i){const ids=state.selected.size?[...state.selected]:state.chars.filter(c=>entry(c.id).owned).map(c=>c.id);if(!ids.length){notice('보유 캐릭터나 편집 대상을 먼저 선택해 주세요.');return;}$('utility').close();openEditor(ids,true);$('editor-preset').value=`user:${i}`;$('editor-preset').dispatchEvent(new Event('change'));}
function demoAccount() {
    if(!confirm('가상 데모 계정을 프리뷰에 적용할까요? 현재 프리뷰는 되돌리기로 복구할 수 있습니다.'))return;
    let a=M.empty();const ids=['ramona','goliath','miryam','tulu','pollux','castor','clementine','arachne','24','nautila','ogier','tawil','saya','salvador'];
    for(const [i,id] of ids.entries()){if(!char(id))continue;let patch={owned:true,potency:[0,2,3,7][i%4]};if(i%4!==0){for(const f of M.fields(state.growth[id]))patch[f.key]=f.key==='level'?60:f.key.startsWith('talent:')?Math.max(f.min,f.max-(i%3)):f.max;}a=M.apply(a,[id],patch,state.growth).account;}
    state.wheels.slice(0,8).forEach(w=>a.wheels[w.english_name]={owned:true,potency:0});
    a.presets=[{name:'카드만 최대',patch:Object.fromEntries(['Slot_Strike','Slot_Defend','Slot_Skill1','Slot_Skill2','Slot_Awake','Slot_Super'].map(s=>[`skill:${s}`,'max']))},{name:'특성만 최대',patch:{'talent:1':'max','talent:2':'max','talent:3':'max'}}];
    if(commit(a,'가상 데모 계정을 적용했습니다.')){$('save-state').textContent='가상 데모 계정 · 이 기기에 저장';}
}
function download(data,name,type='application/json') { const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function showBackup(){ $('utility-title').textContent='백업·불러오기';$('utility-body').innerHTML=`<section class="utility-section"><h3>계정 파일 내보내기</h3><p>보유·돌파·특성·스킬·명륜·성장 프리셋을 JSON으로 저장합니다.</p><button id="download-account" class="primary">백업 파일 다운로드</button> <button id="download-image">보유 이미지 저장</button></section><section class="utility-section"><h3>파일 불러오기</h3><p>보유 현황 프리뷰에서 내보낸 JSON을 선택하세요. 적용 전에 내용을 확인합니다.</p><label class="field"><span>백업 JSON 파일</span><input type="file" id="import-file" accept=".json,application/json"></label><div id="import-preview"></div></section><section class="utility-section"><h3>기존 보유 현황 다시 가져오기</h3><p>기존 페이지의 각성체·돌파·명륜 정보를 읽습니다. 새 성장 항목은 미입력입니다.</p><button id="import-legacy">기존 보유 현황 가져오기</button> <button id="recover-import">불러오기 전 상태 복구</button></section>`;
    $('download-account').onclick=()=>download({...state.account,exportedAt:new Date().toISOString()},`morimens-roster-${new Date().toISOString().slice(0,10)}.json`);
    $('download-image').onclick=exportImage;
    $('recover-import').onclick=()=>{try{const raw=JSON.parse(localStorage.getItem(`${M.KEY}_before_import`)||'null');if(!raw){notice('복구용 백업이 없습니다.');return;}prepareImport(raw);}catch(error){notice(error.message||'복구용 백업을 읽지 못했습니다.');}};
    $('import-legacy').onclick=()=>{try{const raw=JSON.parse(localStorage.getItem(M.LEGACY)||'null');if(!raw){notice('기존 보유 현황이 없습니다.');return;}prepareImport(M.migrate(raw));}catch{notice('기존 보유 현황을 읽지 못했습니다.');}};
    $('import-file').onchange=async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2e6)throw Error('2MB 이하 파일을 선택해 주세요.');prepareImport(JSON.parse(await file.text()));}catch(error){$('import-preview').textContent=error.message||'파일을 읽지 못했습니다.';}};
    if(!$('utility').open)modal('utility');
}
function prepareImport(raw){const result=M.validate(raw,state.chars.map(c=>c.id),state.wheels.map(w=>w.english_name),state.growth);if(result.unknown.length)throw Error(`현재 자료에 없는 ID ${result.unknown.length}개가 있어 적용하지 않았습니다. 원본 파일을 보존해 주세요.`);
    const count=Object.values(result.account.characters).filter(c=>c.owned).length;$('import-preview').innerHTML=`<div class="import-summary">보유 각성체 ${count}명 · 명륜 ${Object.values(result.account.wheels).filter(w=>w.owned).length}개 · 프리셋 ${result.account.presets.length}개</div><label class="field"><span>적용 방식</span><select id="import-mode"><option value="merge">병합 · 기존 값 유지, 빈 항목만 채우기</option><option value="replace">프리뷰 계정 전체 교체</option></select></label><p class="editor-note">적용 전 상태는 이 기기에 복구용으로 저장합니다.</p><button id="confirm-import" class="primary">확인 후 적용</button>`;
    $('confirm-import').onclick=()=>{try{localStorage.setItem(`${M.KEY}_before_import`,JSON.stringify(state.account));const next=$('import-mode').value==='merge'?M.merge(state.account,result.account):result.account;if(commit(next,'파일 내용을 적용했습니다.'))$('utility').close();}catch{notice('복구용 백업 저장에 실패해 불러오기를 중단했습니다.');}};
}
async function exportImage(){const rows=state.chars.filter(c=>entry(c.id).owned);if(!rows.length){notice('이미지로 저장할 보유 캐릭터가 없습니다.');return;}const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=120+Math.ceil(rows.length/5)*190;const ctx=canvas.getContext('2d');ctx.fillStyle='#202224';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#eadfc4';ctx.font='bold 28px sans-serif';ctx.fillText(`모리멘즈 · 보유 각성체 ${rows.length}명`,30,50);ctx.fillStyle='#aab0b4';ctx.font='16px sans-serif';ctx.fillText('보유 현황 프리뷰 · 직접 입력한 성장 정보',30,82);await Promise.all(rows.map(async(c,i)=>{const x=30+(i%5)*195,y=120+Math.floor(i/5)*190;try{const img=new Image();img.src=c.image_thumb;await img.decode();ctx.drawImage(img,x,y,82,96);}catch{}ctx.fillStyle='#eee';ctx.font='16px sans-serif';ctx.fillText(c.name,x,y+120,175);ctx.fillStyle='#adb5b9';ctx.font='14px sans-serif';ctx.fillText(`Lv.${entry(c.id).level??'—'} · ${potencyLabel(entry(c.id).potency)}`,x,y+145,175);}));canvas.toBlob(blob=>{if(!blob){notice('이미지 생성에 실패했습니다.');return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='morimens-roster.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
function renderTeams(){
    const include=$('team-include').value,exclude=$('team-exclude').value,wave=$('team-wave').value,support=$('team-support').checked;
    let rows=state.teams.filter(t=>(wave==='all'||t.wave===Number(wave))&&(!include||t.members.includes(include))&&(!exclude||!t.members.includes(exclude))&&(!$('team-owned').checked||M.availability(t,state.account).missing.length<=(support?1:0)));
    rows.sort((a,b)=>M.availability(a,state.account).missing.length-M.availability(b,state.account).missing.length);
    $('show-team-list').setAttribute('aria-pressed',String(!state.teamStats));$('show-team-stats').setAttribute('aria-pressed',String(state.teamStats));$('team-stats').hidden=!state.teamStats;$('team-grid').hidden=state.teamStats;
    const counts=new Map();for(const team of rows)for(const id of team.members)counts.set(id,(counts.get(id)||0)+1);
    $('team-stats').innerHTML='<p class="editor-note">현재 필터에 맞는 합성 데모 '+rows.length+'개 조합 안에서의 등장 비율입니다. 실제 유저 채용률이 아닙니다.</p><div class="demo-stats-grid">'+[...counts].sort((a,b)=>b[1]-a[1]).map(([id,count])=>'<button class="demo-stat" data-find="'+esc(id)+'"><img src="'+esc(char(id).image_thumb)+'" alt="" width="40" height="48"><span>'+esc(char(id).name)+'</span><strong>'+count+'/'+rows.length+'</strong></button>').join('')+'</div>';
    $('team-summary').textContent=`${rows.length}개 데모 조합 · 합성 예시이며 실제 클리어 기록이 아닙니다.`;
    $('team-grid').innerHTML=rows.length?rows.map(t=>{const a=M.availability(t,state.account);const missing=a.missing.map(id=>char(id).name);const incomplete=t.members.filter(id=>!M.complete(entry(id),state.growth[id]));return `<article class="team-card"><header><h3>${t.name}</h3><span class="team-tag">${t.wave}파 · 합성 데모</span></header><div class="team-members">${t.members.map(id=>`<div class="team-member"><img src="${esc(char(id).image_thumb)}" alt="" width="64" height="76" loading="lazy"><strong>${esc(char(id).name)}</strong><p class="muted">${entry(id).owned?potencyLabel(entry(id).potency):support&&a.missing.length===1?'지원 필요':'미보유'}</p></div>`).join('')}</div><div class="team-status">캐릭터 ${a.owned}/4 보유${missing.length?` · ${support&&a.missing.length===1?'지원 1명으로 구성 가능':'미보유: '+esc(missing.join(', '))}`:' · 전원 보유'}<br><span class="muted">성장 ${incomplete.length?`${incomplete.length}명 미입력 항목 있음`:'입력 완료'} · 장비 비교는 미적용</span></div><details><summary>내 성장과 데모 빌드 비교</summary><div class="comparison">${t.members.map(id=>{const g=state.growth[id],e=entry(id);return `<p><strong>${esc(char(id).name)}</strong><br>내 Lv.${e.level??'—'} / 예시 Lv.60 · 내 ${potencyLabel(e.potency??0)} / 예시 3돌<br><span class="muted">${[2,1,3].map(type=>{const f=g?.talentUpgrades.find(x=>x.type===type);return f?`${esc(f.name)} ${e.talents?.[type]??'—'} / 예시 ${f.maxLevel}`:'';}).filter(Boolean).join(' · ')}</span></p>`;}).join('')}<p class="muted">예시 수치는 클리어 최소 조건이 아닙니다. 이 데모로 성능이나 승률을 판단하지 마세요.</p></div></details><div class="team-actions"><button data-team-export="${t.id}">내 성장 빌드 내보내기</button><button data-edit="${esc(t.members[0])}">첫 캐릭터 편집</button></div></article>`;}).join(''):'<div class="empty"><h3>조건에 맞는 데모 조합이 없어요.</h3><p>지원 1명을 허용하거나 보유 조합 조건을 풀어보세요.</p><button id="relax-teams">보유 조건 풀기</button></div>';
    if($('relax-teams'))$('relax-teams').onclick=()=>{$('team-owned').checked=false;renderTeams();};
}
function exportBuild(id){const team=state.teams.find(t=>t.id===id);const missing=team.members.filter(id=>!M.complete(entry(id),state.growth[id]));$('utility-title').textContent='내 성장 빌드 내보내기';$('utility-body').innerHTML=`<p class="editor-note">ScareCrow 연결을 위한 프리뷰 JSON입니다. 현재 시뮬레이터 자동 가져오기는 연결하지 않았습니다.</p><div class="import-summary">${missing.length?`성장 미입력 ${missing.length}명: ${missing.map(id=>esc(char(id).name)).join(', ')}`:'4명 성장 입력 완료'}<br>명륜·비밀계약·은열쇠는 포함되지 않습니다.</div><button id="download-build" class="primary">프리뷰 빌드 JSON 다운로드</button>`;$('download-build').onclick=()=>download({format:'morimens-roster-preview-build',version:1,isDemo:true,characters:team.members.map(id=>({siteId:id,clientId:char(id).client_id,...entry(id)})),missingGrowth:missing,equipmentIncluded:false},'morimens-preview-build.json');modal('utility');}
load();
})();
