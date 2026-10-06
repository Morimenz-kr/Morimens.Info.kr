(() => {
  'use strict';
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {Common:'일반',Elite:'엘리트',Boss:'보스'};
  const number = new Intl.NumberFormat('ko-KR');
  const intentIcons={Intent_Attack:'001',Intent_HeavyAttack:'002',Intent_Debuff:'003',Intent_StrongDebuff:'004',Intent_Buff:'005',Intent_StrongBuff:'006',Intent_Defence:'007',Intent_AttackDefence:'008',Intent_AttackDebuff:'009',Intent_AttackBuff:'010',Intent_DefenceBuff:'011',Intent_DefenceDebuff:'012',Intent_Dizzy:'013',Intent_Burst:'015',Intent_Burst2:'015'};
  const $ = id => document.getElementById('story-'+id);
  let index, revision=0, glossary={};
  const text = value => {
    let s=String(value??'');
    for(let i=0;i<5;i++)s=s.replace(/<[^:<>]+:([^<>]+)>/g,'$1');
    return s.replace(/\[Layer\]/g,'현재 스택').replace(/\[(?:Damage|AttackTimes|Heal):([^\]]+)\]/g,'$1');
  };
  const rich = value => window.DzoneRichText?.render(value,glossary,text) ?? escape(text(value));
  function skillBody(m,stats,id){const skill=m.skills.find(s=>s.id===id),resolved=stats?.resolvedSkills?.[id];return `<strong>${rich(skill?.name||'행동')}</strong><p>${rich(resolved?.richDescription||resolved?.description||skill?.descriptionTemplate||'')}</p>${(m.conditionalActions||[]).filter(a=>a.skillId===id&&m.patterns.some(p=>p.skillIds.includes(id))).map(a=>`<p class="conditional-trigger">${rich(a.conditionText)}에도 사용</p>`).join('')}`;}
  function actionStep(m,stats,id,position,label){const skill=m.skills.find(s=>s.id===id);return `<li class="action-step" data-skill-id="${id}"><div class="action-marker"><span class="flow-step-number">${String(label||position+1).replace('턴 이후','~').replace(/턴|번째/g,'')}</span><img class="intent-icon" src="images/dzone/intent/intent_${intentIcons[skill?.type]||'014'}.png" width="36" height="36" alt="" loading="eager"></div><div class="action-copy">${skillBody(m,stats,id)}</div></li>`;}
  function finalTurnOrder(m,stats){
    const opening=m.patterns.find(p=>p.id==='opening'),cycle=m.patterns.find(p=>p.id==='cycle-1'),overrides=m.turnOverrides;
    const last=overrides.at(-1),same=opening&&cycle&&JSON.stringify(opening.skillIds)===JSON.stringify(cycle.skillIds);
    const skillAt=turn=>{if(same)return cycle.skillIds[(turn-1)%cycle.skillIds.length];if(opening&&turn<=opening.skillIds.length)return opening.skillIds[turn-1];const repeating=cycle||opening;if(!repeating?.skillIds.length)return null;return repeating.skillIds[(turn-(opening?.skillIds.length||0)-1)%repeating.skillIds.length];};
    const rows=[];for(let turn=1;turn<=last.firstTurn;turn++){const override=overrides.filter(o=>o.firstTurn<=turn).at(-1);const id=override?.skillId||skillAt(turn);if(id)rows.push(actionStep(m,stats,id,turn-1,turn===last.firstTurn?`${turn}턴 이후`:`${turn}턴`));}
    return `<section class="flow-phase"><header><h5>행동 순서</h5></header><ol class="flow-sequence">${rows.join('')}</ol></section>`;
  }
  function renderStageRules(stage){
    if(!stage.rules.length)return '';
    const groups=[['chapter',`${stage.arc} 공통 규칙`],['stage','이 스테이지의 추가 규칙'],['positive','이 스테이지의 지원 효과']];
    return `<section class="story-stage-rules" aria-label="${escape(stage.arc)} 전투 규칙">${groups.map(([source,label])=>{const rows=stage.rules.filter(r=>r.source===source);if(!rows.length)return '';return `<details class="story-rule-group" ${source!=='chapter'?'open':''}><summary><strong>${rich(label)}</strong><span>${rows.map(r=>escape(r.name)).join(' · ')}</span></summary><div class="story-rule-grid">${rows.map(r=>`<article class="story-rule-card" id="story-rule-${escape(r.id)}"><header><h4>${rich(r.name||'스테이지 규칙')}</h4><span class="flow-badge">${rich(r.scope||'스테이지 규칙')}</span></header><div><p>${rich(r.richDescription||r.description)}</p></div></article>`).join('')}</div></details>`;}).join('')}</section>`;
  }
  function monsterCard(stage,tid,stats,ancestors=[],summoned=false){
    const m=stage.monsters[tid];if(!m)return '';
    const already=ancestors.includes(tid),chain=[...ancestors,tid];
    const stat=(label,value)=>Number.isFinite(value)?`<div class="monster-stat ${label==='HP'||label.includes('체력바')?'monster-stat--hp':''}"><dt>${label}</dt><dd>${number.format(value)}</dd></div>`:'';
    const hp=stats?.phases?.length>1?stats.phases.map((p,i)=>stat(`${i+1}번째 체력바`,p.hp)).join(''):stat('HP',stats?.hp);
    const statMarkup=`${stats?.startingBars>1?`<p class="story-hp-detail">시작 체력바 ${stats.startingBars}개 · 각 체력바 HP</p>`:''}<dl class="story-statistics">${hp}</dl>${stats?.hpDisplay?`<p class="story-hp-detail">${rich(stats.hpDisplay)}</p>`:stats?.hpDescription?`<p class="story-hp-detail">HP: ${rich(stats.hpDescription)}</p>`:''}`;
    const transitions=(m.storyTransitions||[]).filter(t=>!(t.sourceSkillId&&m.patterns.some(p=>p.skillIds.includes(t.sourceSkillId)))&&(t.changesPortrait||t.condition&&!m.conditionalActions?.some(a=>a.commandId===t.commandId)));
    const allPatterns=m.patterns||[];
    const opening=allPatterns.find(p=>p.id==='opening'),cycle=allPatterns.find(p=>p.id==='cycle-1');
    const patterns=opening&&cycle&&JSON.stringify(opening.skillIds)===JSON.stringify(cycle.skillIds)?allPatterns.filter(p=>p!==opening):allPatterns;
    const body=already?'':m.turnOverrides?.length?finalTurnOrder(m,stats):patterns.map(p=>{
      const cycle=p.id.startsWith('cycle-')?Number(p.id.split('-')[1]):0;
      const phase=(m.storyTransitions||[]).find(t=>t.cycleIndex===cycle);
      const changeSkill=phase?.sourceSkillId?m.skills.find(s=>s.id===phase.sourceSkillId):phase?m.conditionalActions?.find(a=>a.commandId===phase.commandId):null;
      const phaseCondition=changeSkill?`「${changeSkill.name||m.skills.find(s=>s.id===changeSkill.skillId)?.name}」 사용 후`:phase?.changesPortrait?phase.condition:'';
      const phaseStats=stats?.phaseResolvedSkills?.[cycle]?{...stats,resolvedSkills:stats.phaseResolvedSkills[cycle]}:stats;
      const title=cycle?(phase?'전환 후 행동 순서':cycle===1?'기본 행동 순서':`행동 순서 ${cycle}`):'첫 행동';
      return `<section class="flow-phase story-phase"><header>${phase?.changesPortrait?`<img class="monster-portrait" src="${escape(phase.image)}" width="56" height="56" alt="전환 후 초상" loading="eager">`:''}<h5>${title}</h5>${phaseCondition?`<p class="conditional-trigger">${rich(phaseCondition)}</p>`:''}${cycle?'<span class="flow-badge">반복</span>':''}</header><ol class="flow-sequence">${p.skillIds.map((id,i)=>actionStep(m,phaseStats,id,i,cycle&&(opening||patterns.filter(p=>p.id.startsWith('cycle-')).length>1)?`${i+1}번째`:null)).join('')}</ol>${cycle?'<div class="flow-loop">이후 1번부터 반복</div>':''}</section>`;
    }).join('');
    const stateRows=[...new Map([...(stats?.resolvedStates||m.states||[]),...(stats?.entryStates||[])].filter(s=>s.visible!==false&&(s.description||s.descriptionTemplate)).map(s=>[s.id,s])).values()];
    const stateMarkup=rows=>rows.map(s=>`<article>${s.icon?`<span class="monster-rule-icon"><img src="${escape(s.icon)}" alt="" width="28" height="28" loading="eager"></span>`:''}<div class="rule-copy"><strong>${rich(s.id===120218?'지원 선택':s.name||'효과')}</strong>${Number.isFinite(s.initialLayer?.value?.display)&&s.initialLayer.value.display>1?`<span class="monster-initial-stack story-initial-stack">시작 ${number.format(s.initialLayer.value.display)}스택</span>`:''}<p>${rich(s.richDescription||s.description||s.descriptionTemplate)}</p></div></article>`).join('');
    const rules=already?'':stateMarkup(stateRows);
    const playerRules=already?'':stateMarkup(stats?.playerEntryStates||[]);
    const changes=already?'':transitions.map(t=>{const state=stats?.resolvedStates?.find(s=>s.id===t.sourceStateId)||stats?.entryStates?.find(s=>s.id===t.sourceStateId)||stats?.transitionStates?.find(s=>s.id===t.sourceStateId);return `<section class="phase-transition"><header>${t.changesPortrait?`<img class="monster-portrait" src="${escape(t.image)}" width="56" height="56" alt="${escape(m.nameKo)} 전환 후 초상" loading="eager">`:''}<h5>${rich(t.title)}${t.cycleIndex?` · 페이즈 ${t.cycleIndex}`:''}</h5></header>${t.condition?`<p>${rich(t.condition)}</p>`:''}<p>${rich(state?.richDescription||state?.description||t.description)}</p></section>`;}).join('');
    const conditional=already?[]:(m.conditionalActions||[]).filter(a=>!patterns.some(p=>p.skillIds.includes(a.skillId)));
    const actions=conditional.length?`<section class="conditional-actions" aria-label="조건부 행동"><h5 class="section-label">조건부 행동</h5>${conditional.map(a=>{const skill=m.skills.find(s=>s.id===a.skillId),resolved=stats?.resolvedSkills?.[a.skillId];return `<article class="conditional-action" data-skill-id="${a.skillId}"><img class="intent-icon" src="images/dzone/intent/intent_${intentIcons[skill?.type]||'014'}.png" width="36" height="36" alt="" loading="eager"><div class="conditional-action-copy"><header><strong>${rich(skill?.name||'행동')}</strong></header>${a.conditionText?`<p class="conditional-trigger">${rich(a.conditionText)}</p>` : ''}<p>${rich(resolved?.richDescription||resolved?.description||skill?.descriptionTemplate||'')}</p></div></article>`}).join('')}</section>`:'';
    const summonGroups=new Map();
    if(!already)for(const summon of m.linkedSummons||[]){const group=summonGroups.get(summon.commandId)||[];group.push(summon);summonGroups.set(summon.commandId,group);}
    const summons=[...summonGroups.values()].map(group=>`<section class="summon-section" aria-label="소환 개체"><h5 class="section-label">${group[0].condition?rich(group[0].condition):'소환 개체'}</h5><div class="summon-list">${group.map(s=>{const summonStats=stage.summonedMonsters.find(r=>r.parentTid===tid&&r.tid===s.tid&&(!r.commandId||r.commandId===s.commandId));return monsterCard(stage,s.tid,summonStats,chain,true);}).join('')}</div></section>`).join('');
    return `<details class="monster-card story-monster${summoned?' monster-card--summon':''}" data-monster-id="${tid}" open><summary class="monster-heading"><img class="monster-portrait" src="${escape(m.webImage)}" width="56" height="56" alt="" loading="lazy"><div class="monster-heading-copy"><h4>${rich(m.nameKo)}</h4>${summoned?'<span class="monster-badge" data-type="Summon">소환 개체</span>':m.monsterClass!=='Common'?`<span class="monster-badge" data-type="${escape(m.monsterClass)}">${labels[m.monsterClass]||'적'}</span>`:''}${m.monsterTags?.length?`<span class="monster-heading-tags">${m.monsterTags.map(id=>window.MonsterTypeCatalog?.[id]).filter(Boolean).map(tag=>`<span class="monster-tag">${escape(tag.label)}</span>`).join('')}</span>`:''}${stats?.phases?.length>1?`<span class="hp-count-badge">HP ${stats.phases.length}줄</span>`:''}</div><span class="collapse-indicator" aria-hidden="true"></span></summary><div class="monster-body"><div class="monster-overview">${statMarkup}</div>${rules||playerRules?`<section class="story-entry-effects" aria-label="전투 시작 상황">${rules?`<section class="monster-rules story-unique-rules"><h5 class="section-label">적의 시작 상태</h5>${rules}</section>`:''}${playerRules?`<section class="monster-rules story-player-effects"><h5 class="section-label">플레이어가 받는 효과</h5>${playerRules}</section>`:''}</section>`:''}<section class="combat-flow" aria-label="행동 목록">${changes}${body}${actions}</section>${summons}</div></details>`;
  }
  function renderStage(stage){
    glossary=stage.keywordGlossary||{};
    const counts={};const types=stage.encounters.reduce((n,e)=>(n[e.battleType]=(n[e.battleType]||0)+1,n),{});
    return `<header class="story-stage-heading"><h2>${rich(stage.arc)} ${stage.chapter}장 · ${rich(stage.difficulty)} · ${rich(stage.number)} ${rich(stage.name)}</h2></header>${renderStageRules(stage)}${stage.encounters.length?stage.encounters.slice().sort((a,b)=>['Common','Elite','Boss'].indexOf(a.battleType)-['Common','Elite','Boss'].indexOf(b.battleType)).map(e=>{
      counts[e.battleType]=(counts[e.battleType]||0)+1;
      const label=`${labels[e.battleType]||'일반'} 전투${types[e.battleType]>1?' 구성 '+counts[e.battleType]:''}`;
      return `<details class="encounter-card story-encounter" data-battle-id="${e.battleId}" open><summary class="encounter-header"><h3>${label} · 적 ${e.members.length}명</h3><span class="collapse-indicator" aria-hidden="true"></span></summary><div class="monster-list">${e.members.map(m=>monsterCard(stage,m.tid,stage.stats[m.tid])).join('')}</div></details>`;
    }).join(''):'<p>이 스테이지에는 등록된 직접 전투 구성이 없습니다.</p>'}`;
  }
  async function loadStage(){
    const id=Number($('stage').value),current=++revision;
    $('content').setAttribute('aria-busy','true');$('status').textContent='전투 정보를 불러오는 중입니다.';$('content').innerHTML='';
    try{const response=await fetch(`data/story/stages/${id}.json?v=${index.version}`);if(!response.ok)throw new Error('stage');const stage=await response.json();if(current!==revision)return;$('content').innerHTML=renderStage(stage);window.CharacterEffects?.configureTooltips(Object.fromEntries(Object.entries(glossary).map(([key,entry])=>[key,{...entry,icon:entry.tooltipIcon||entry.icon,cost:entry.description?.split(/\n{2,}/)[0]?.match(/산출력\s+(\d+(?:·\d+)*)/)?.[1],category:entry.description?.split('|')[0]?.trim()||'상태 효과'}])));window.CharacterEffects?.setupTooltips($('content'));$('status').textContent=`${stage.combatCount}개 전투 구성`;history.replaceState(null,'',`#stage-${id}`);}catch(error){if(current!==revision)return;$('status').textContent='전투 정보를 불러오지 못했습니다.';$('content').innerHTML='<div class="story-error"><p>잠시 후 다시 시도해 주세요.</p><button type="button" id="story-retry">다시 불러오기</button></div>';$('retry').addEventListener('click',loadStage);}finally{if(current===revision)$('content').setAttribute('aria-busy','false');}
  }
  function options(select,rows,value){select.innerHTML=rows.map(r=>`<option value="${escape(r.value)}">${escape(r.label)}</option>`).join('');if(rows.some(r=>String(r.value)===String(value)))select.value=value;}
  function refreshStages(preferred){const rows=index.stages.filter(s=>s.arc===$('arc').value&&s.chapter===Number($('chapter').value)&&s.difficulty===$('difficulty').value);options($('stage'),rows.map(s=>({value:s.id,label:`${s.number} ${s.name}${s.combatCount?'':' · 전투 구성 없음'}`})),preferred||rows.find(s=>s.combatCount)?.id);loadStage();}
  function refreshChapters(preferred,stageId){const chapters=[...new Map(index.stages.filter(s=>s.arc===$('arc').value).map(s=>[s.chapter,s])).values()];options($('chapter'),chapters.map(s=>({value:s.chapter,label:`${s.chapter}장 ${s.chapterName}`})),preferred);refreshStages(stageId);}
  window.addEventListener('hashchange',()=>{if(!index)return;const id=Number(location.hash.match(/^#stage-(\d+)$/)?.[1]),selected=index.stages.find(s=>s.id===id);if(!selected||String(id)===$('stage').value)return;$('arc').value=selected.arc;$('difficulty').value=selected.difficulty;refreshChapters(selected.chapter,selected.id);});
  async function initialize(){try{const response=await fetch('data/story/index.json');if(!response.ok)throw new Error('index');index=await response.json();const id=Number(location.hash.match(/^#stage-(\d+)$/)?.[1]);const selected=index.stages.find(s=>s.id===id);options($('arc'),index.arcs.map(a=>({value:a,label:a})),selected?.arc);$('difficulty').value=selected?.difficulty||'노말';const chapters=[...new Map(index.stages.filter(s=>s.arc===$('arc').value).map(s=>[s.chapter,s])).values()];options($('chapter'),chapters.map(s=>({value:s.chapter,label:`${s.chapter}장 ${s.chapterName}`})),selected?.chapter);refreshStages(selected?.id);$('arc').addEventListener('change',()=>refreshChapters());$('chapter').addEventListener('change',()=>refreshStages());$('difficulty').addEventListener('change',()=>refreshStages());$('stage').addEventListener('change',loadStage);}catch(error){$('status').textContent='스토리 목록을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';$('content').setAttribute('aria-busy','false');}}
  window.StoryEncounterView={renderStage,text};
  initialize();
})();
