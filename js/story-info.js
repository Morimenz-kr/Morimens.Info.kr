(() => {
  'use strict';
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ASSET_REVISION='story-viewer-20261030-1';
  const labels = {Common:'일반',Elite:'엘리트',Boss:'보스'};
  const number = new Intl.NumberFormat('ko-KR');
  const intentIcons={Intent_Attack:'001',Intent_HeavyAttack:'002',Intent_Debuff:'003',Intent_StrongDebuff:'004',Intent_Buff:'005',Intent_StrongBuff:'006',Intent_Defence:'007',Intent_AttackDefence:'008',Intent_AttackDebuff:'009',Intent_AttackBuff:'010',Intent_DefenceBuff:'011',Intent_DefenceDebuff:'012',Intent_Dizzy:'013',Intent_Burst:'015',Intent_Burst2:'015'};
  const $ = id => document.getElementById('story-'+id);
  let index, mapIndex, revision=0, glossary={}, baseGlossary={}, researchLevel=81;
  const text = value => {
    let s=String(value??'');
    for(let i=0;i<5;i++)s=s.replace(/<[^:<>]+:([^<>]+)>/g,'$1');
    return s.replace(/\[Layer\]/g,'현재 스택').replace(/\[(?:Damage|AttackTimes|Heal):([^\]]+)\]/g,'$1');
  };
  const rich = value => window.DzoneRichText?.render(value,glossary,text) ?? escape(text(value));
  function resolveEnchantGlossary(entries) {
    const depth=window.ResearchDepth.depthAt(researchLevel);
    return Object.fromEntries(Object.entries(entries).map(([key,entry])=>{
      if(!entry.source?.enchantId||!entry.richDescriptionTemplate)return [key,entry];
      const args=entry.source.args||[];
      let complete=true;
      let description=entry.richDescriptionTemplate.replace(/\{\{parameter:(\d+)\}\}/g,(token,index)=>{
        const value=window.ResearchDepth.evaluate(args[Number(index)-1],depth);
        if(value===null){complete=false;return token;}
        return number.format(value);
      });
      if(!complete)return [key,entry];
      description=description.replace(/([\d,]+)의 실드를 획득한다/g,'실드를 <amount_shield:$1pt> 획득한다');
      const growth=args.some(arg=>/PlayerGrowth|GetAccountStageGrow/.test(String(arg)));
      const research=growth||args.some(arg=>/ResearchDepth/.test(String(arg)));
      return [key,{...entry,richDescription:description,
        description:entry.description.split(/\n{2,}/)[0]+'\n\n'+text(description),
        contextNote:research?`금기 학식 ${researchLevel}등급 기준${growth?' · 기록 각인 보정 제외':''}`:undefined}];
    }));
  }
  function configureStoryTooltips(){
    window.CharacterEffects?.configureTooltips(Object.fromEntries(Object.entries(glossary).map(([key,entry])=>[key,{...entry,icon:entry.tooltipIcon||entry.icon,cost:entry.description?.split(/\n{2,}/)[0]?.match(/산출력\s+(\d+(?:·\d+)*)/)?.[1],category:entry.category||entry.description?.split('|')[0]?.trim()||'상태 효과'}])));
  }
  function skillBody(m,stats,id){const skill=m.skills.find(s=>s.id===id),resolved=stats?.resolvedSkills?.[id];return `<strong>${rich(skill?.name||'행동')}</strong><p>${rich(resolved?.richDescription||resolved?.description||skill?.descriptionTemplate||'')}</p>${(m.conditionalActions||[]).filter(a=>!(m.randomActionGroups||[]).some(g=>g.commandId===a.commandId)&&a.skillId===id&&!m.phaseFlow?.groups.some(g=>g.shiftOnCardUse&&g.skillIds.includes(id))&&m.patterns.some(p=>p.skillIds.includes(id))).map(a=>`<p class="conditional-trigger">${rich(a.conditionText)}에도 사용</p>`).join('')}`;}
  function actionStep(m,stats,id,position,label){const skill=m.skills.find(s=>s.id===id);return `<li class="action-step" data-skill-id="${id}"><div class="action-marker"><span class="flow-step-number${String(label||'').includes('~')?' flow-step-number--range':''}">${String(label||position+1).replace('턴 이후','~').replace(/턴|번째/g,'')}</span><img class="intent-icon" src="images/dzone/intent/intent_${intentIcons[skill?.type]||'014'}.png" width="36" height="36" alt="" loading="eager"></div><div class="action-copy">${skillBody(m,stats,id)}</div></li>`;}
  function flowSections(m,stats,prefix='') {
    if(m.phaseFlow)return branchSections(m,stats,prefix);
    const shown = new Set(), shownReactions=new Set(), shownAppearances=new Set();
    return window.StoryFlow.build(m).map(section => {
      if(section.healthTransition){
        const t=section.healthTransition,step=section.startTurn;
        const hp=Number.isFinite(stats?.hp)?` · 체력바당 최대 HP ${number.format(stats.hp)} → ${number.format(Math.ceil(stats.hp*t.maxHpMultiplier))}`:'';
        const condition=`기본 행동 순서의 ${step}번째 행동${t.condition?' 또는 '+t.condition:''}`;
        return window.BattleView.renderPhaseTransition(m,{phaseIndex:2,phaseSkillIds:[t.skillId],condition,sequenceDescription:`남은 HP 줄에 ${t.addedBars}줄 추가${hp}`},stats,{escapeHtml:escape,number,dynamicMarkup:rich,skillById:(monster,id)=>monster.skills.find(s=>s.id===id),data:{keywordGlossary:glossary}})+(stats?.phaseAppearances?.['skill-'+t.skillId]?phaseIdentity(m,stats.phaseAppearances['skill-'+t.skillId]):'');
      }
      const transitions = (m.phaseTransitions||[]).filter(t=>t.phaseIndex===section.cycle&&!shown.has(t.phaseIndex));
      const transition = transitions[0];
      if(transition)shown.add(transition.phaseIndex);
      const change=transition?window.BattleView.renderPhaseTransition(m,transition,stats,{escapeHtml:escape,number,dynamicMarkup:rich,skillById:(monster,id)=>monster.skills.find(s=>s.id===id),data:{keywordGlossary:glossary}}):'';
      const appearance=stats?.phaseAppearances?.[section.cycle];
      const identity=appearance&&!shownAppearances.has(section.cycle)?phaseIdentity(m,appearance):'';
      if(identity)shownAppearances.add(section.cycle);
      const phaseStats=stats?.phaseResolvedSkills?.[section.cycle]?{...stats,resolvedSkills:stats.phaseResolvedSkills[section.cycle]}:stats;
      const condition=change?'':section.transition?.condition;
      const reactionNote=(m.reactiveActions||[]).filter(reaction=>!shownReactions.has(reaction)&&reaction.skillIds.some(id=>section.ids.includes(id))).map(reaction=>{shownReactions.add(reaction);return '<p class="story-pattern-note">'+rich(reaction.richDescription||reaction.description)+'</p>';}).join('');
      const randomNote=section.random?'<p class="story-pattern-note">'+escape(section.random.description)+'</p>':'';
      const rows=window.StoryFlow.rows(section).map(block=>{
        const content=block.ids.map((id,i)=>actionStep(m,phaseStats,id,i,section.random?String.fromCharCode(65+section.ids.indexOf(id)):block.labels[i])).join('');
        return block.groupRepeat?'<li class="flow-repeat-block"><p class="flow-repeat-label"><span class="flow-repeat-icon" aria-hidden="true">↻</span><span>반복 ×'+block.count+'</span><span class="flow-repeat-range">'+block.labels[0]+'~'+(Number(block.labels[0])+block.ids.length*block.count-1)+'</span></p><ol class="flow-sequence">'+content+'</ol></li>':content;
      }).join('');
      return change+identity+'<section class="flow-phase story-phase"><header><h5>'+escape(prefix+section.label)+'</h5>'+(section.loop?'<span class="flow-badge">반복</span>':'')+'</header>'+reactionNote+randomNote+(condition?'<p class="conditional-trigger">'+rich(condition)+'</p>':'')+'<ol class="flow-sequence">'+rows+'</ol>'+(section.end?'<p class="flow-end">이 행동 후 사망 · 이후 행동 없음</p>':section.loop?'<div class="flow-loop">이 구간의 첫 행동부터 반복</div>':'')+'</section>';
    }).join('');
  }
  function branchSections(m,stats,prefix=''){
    const flow=m.phaseFlow,label=id=>flow.groups.find(g=>g.id===id)?.label||'행동 구간';
    const routes=renderRuleCard({id:'phase-routes-'+m.tid,name:'전환 흐름',scope:'조건 분기',contentHtml:flow.routes.map(r=>'<p><strong>'+escape(label(r.from))+' → '+escape(label(r.to))+'</strong><br>'+escape(r.condition)+(r.skillId?' · '+escape(m.skills.find(s=>s.id===r.skillId)?.name||'전환 행동'):'')+'</p>').join('')});
    const initial=flow.groups.find(g=>g.id===flow.initial),opening=window.StoryFlow.initialAndLoop(m.patterns.find(p=>p.id==='opening')?.skillIds||[],initial.skillIds).initial;
    const intro=opening.length?flowSections({...m,phaseFlow:undefined,phaseTransitions:[],storyTransitions:[],patterns:[{id:'opening',skillIds:opening}]},stats,prefix):'';
    return routes+intro+flow.groups.map(group=>{
      const incoming=flow.routes.filter(r=>r.to===group.id);
      const changes=incoming.map(r=>{
        const first=group.skillIds.slice(r.resumeStartIndex||0),phaseStats=stats?.phaseResolvedSkills?.[group.id]?{...stats,resolvedSkills:stats.phaseResolvedSkills[group.id]}:stats;
        const remainder=r.resumeStartIndex&&window.StoryFlow.initialAndLoop(first,group.skillIds).initial.length?'<section class="flow-phase story-phase"><header><h5>전환 후 · 첫 주기</h5></header><ol class="flow-sequence">'+first.map((id,i)=>actionStep(m,phaseStats,id,i,String(i+1+r.resumeStartIndex))).join('')+'</ol></section>':'';
        return window.BattleView.renderPhaseTransition(m,{phaseIndex:Number(group.label.match(/^\d+/)?.[0]),phaseSkillIds:r.skillId?[r.skillId]:[],entryActions:r.entryActions,rebirth:r.rebirth,sequenceDescription:r.recoveryRatio?'최대 HP의 '+number.format(r.recoveryRatio*100)+'% 회복':'',condition:label(r.from)+'에서 '+r.condition},stats,{escapeHtml:escape,number,dynamicMarkup:rich,skillById:(monster,id)=>monster.skills.find(s=>s.id===id),data:{keywordGlossary:glossary}})+remainder;}).join('');
      const identity=group.id!==flow.initial&&stats?.phaseAppearances?.[group.id]?phaseIdentity(m,stats.phaseAppearances[group.id]):'';
      const phaseStats=stats?.phaseResolvedSkills?.[group.id]?{...stats,resolvedSkills:stats.phaseResolvedSkills[group.id]}:stats;
      const exits=flow.routes.some(r=>r.from===group.id&&r.triggerSkillId===group.skillIds.at(-1));
      const ids=exits?group.skillIds:window.StoryFlow.unit(group.skillIds);
      const rows=ids.map((id,i)=>actionStep(m,phaseStats,id,i)).join('');
      return '<section class="story-phase-group" data-phase-group="'+group.id+'"><h5 class="section-label">'+escape(prefix+group.label)+'</h5>'+changes+identity+'<section class="flow-phase story-phase"><header><h5>행동 순서</h5>'+(exits?'':'<span class="flow-badge">반복</span>')+'</header>'+(group.shiftOnCardUse?'<p class="story-pattern-note">플레이어가 카드를 사용할 때 의도가 다음 행동으로 변경됩니다.</p>':'')+'<ol class="flow-sequence">'+rows+'</ol>'+(exits?'':'<div class="flow-loop">이 구간의 첫 행동부터 반복</div>')+'</section></section>';
    }).join('');
  }
  function conditionalActions(m,stats){
    const conditional=(m.conditionalActions||[]).filter(a=>!m.phaseFlow?.routes.some(r=>r.skillId===a.skillId&&r.sourceStateId===a.stateId&&r.commandId===a.commandId)&&!(m.phaseTransitions||[]).some(p=>p.stateId===a.stateId&&p.phaseSkillIds?.includes(a.skillId))&&!m.patterns.some(p=>p.skillIds.includes(a.skillId))&&!(m.storyTransitions||[]).some(t=>t.entrySkillId===a.skillId&&t.sourceStateId===a.stateId&&t.commandId===a.commandId));
    return (conditional.length?`<section class="conditional-actions" aria-label="조건부 행동"><h5 class="section-label">조건부 행동</h5>${conditional.some(a=>a.priorityGroup&&conditional.filter(b=>b.priorityGroup===a.priorityGroup).length>1)?'<p class="story-pattern-note">같은 조건군에서 여러 조건을 만족하면 뒤에 표시된 행동이 우선합니다.</p>':''}${conditional.map(a=>{const skill=m.skills.find(s=>s.id===a.skillId),resolved=stats?.resolvedSkills?.[a.skillId];return `<article class="conditional-action" data-skill-id="${a.skillId}"><img class="intent-icon" src="images/dzone/intent/intent_${intentIcons[skill?.type]||'014'}.png" width="36" height="36" alt="" loading="eager"><div class="conditional-action-copy"><header><strong>${rich(skill?.name||'행동')}</strong></header>${a.conditionText?`<p class="conditional-trigger">${rich(a.conditionText)}</p>` : ''}<p>${rich(resolved?.richDescription||resolved?.description||skill?.descriptionTemplate||'')}</p></div></article>`}).join('')}</section>`:'');
  }
  function disclosure(title,caption,content,{open=false,bodyClass='story-rule-grid'}={}){
    return `<details class="story-rule-group" ${open?'open':''}><summary class="encounter-header"><div class="story-disclosure-copy"><h3>${title}</h3>${caption?'<span class="story-rule-caption">'+caption+'</span>':''}</div><span class="collapse-indicator" aria-hidden="true"></span></summary><div class="${bodyClass}">${content}</div></details>`;
  }
  function renderRuleCard(rule){
    return `<article class="story-rule-card ${escape(rule.className||'')}" id="story-rule-${escape(rule.id)}"${rule.focusable?' tabindex="-1"':''}><header>${rule.iconHtml||''}<h4>${rich(rule.name||'스테이지 규칙')}</h4><span class="flow-badge">${rich(rule.scope||'스테이지 규칙')}</span></header><div>${rule.contentHtml||'<p>'+rich(rule.richDescription||rule.description)+'</p>'}</div></article>`;
  }
  function resonanceLink(node){return `<button type="button" class="story-resonance-link" data-resonance-select="${node.id}">${escape(node.name)}</button>`;}
  function renderResonanceDetail(tree,node){
    return renderRuleCard({id:'resonance-'+node.id,name:node.name,iconHtml:window.StoryResonance.icon(tree,node.id,escape),scope:node.default?'기본 효과':node.inherited?'계승 공명':'공명 강화',contentHtml:
      node.levels.map(level=>'<section class="story-resonance-level"><h5>Lv.'+level.level+(level.cost?' · 강화 비용 '+level.cost:'')+'</h5><p>'+rich(level.richDescription||level.description)+'</p></section>').join('')});
  }
  function renderResonanceTree(tree,chapterKey){
    if(!tree)return '';
    const content=(tree.inherited?'<p>망각편 8장의 공명을 계승하고, 9장의 공명이 추가됩니다.</p>':'')+
      window.StoryResonance.render(tree,{escapeHtml:escape,chapterKey,detailHtml:node=>renderResonanceDetail(tree,node)});
    return disclosure('공명 강화 트리','',content,{open:true,bodyClass:'story-resonance-body'});
  }
  function renderMechanicCard(card,tree){
    const requires=card.requires&&tree?.nodes.find(n=>n.id===card.requires);
    const choices=card.choices?.length?disclosure('조합 재료',card.choices.length+'종 중 제시된 3종에서 선택',card.choices.map(c=>renderMechanicCard(c,tree)).join(''),{bodyClass:'story-card-choices'}):'';
    const effects=(card.effects||[]).map(effect=>'<section class="story-resonance-level"><h5>'+rich(effect.name)+'</h5><p>'+rich(effect.description)+'</p></section>').join('');
    return renderRuleCard({id:'special-card-'+card.id,name:card.name,className:card.cost===null?'story-card-choice':'',scope:[card.cost!==null?'행동력 '+card.cost:'',...(card.traits||[])].filter(Boolean).join(' · ')||'조합 재료',contentHtml:(requires?'<div class="story-resonance-pre">해금 공명 '+resonanceLink(requires)+'</div>':'')+'<p>'+rich(card.description)+'</p>'+effects+choices});
  }
  function renderChapterMechanics(stage){
    const ids=mapIndex?.chapters?.[stage.arc+':'+stage.chapter]||[];
    const rows=ids.map(id=>mapIndex.mechanics[id]).filter(Boolean);if(!rows.length)return '';
    const tree=mapIndex.resonance?.[stage.arc+':'+stage.chapter];
    const base=tree?.nodes.filter(n=>n.default&&!n.inherited)||[];
    return '<section class="story-stage-rules" aria-label="이 장의 특수 기믹">'+disclosure('이 장의 특수 기믹',rows.map(row=>escape(row.name)).join(' · '),rows.map(row=>row.cards?.length?'<section class="story-rule-grid story-mechanic-cards" id="story-rule-mechanic-'+row.id+'" tabindex="-1" aria-label="강화 전 카드 효과">'+row.cards.map(card=>renderMechanicCard(card,tree)).join('')+'</section>':renderRuleCard({id:'mechanic-'+row.id,name:row.name,scope:'기본 기믹',focusable:true,contentHtml:base.map(n=>'<p>'+rich(n.levels[0].richDescription||n.levels[0].description)+'</p>').join('')})).join('')+renderResonanceTree(tree,stage.arc+':'+stage.chapter),{open:true})+'</section>';
  }
  document.addEventListener('click',event=>{
    const view=event.target.closest('[data-resonance-view]');
    if(view){const graph=view.closest('.story-resonance'),key=graph.dataset.resonanceChapter,tree=mapIndex.resonance[key],section=graph.parentElement;graph.outerHTML=window.StoryResonance.render(tree,{escapeHtml:escape,chapterKey:key,layoutGroup:view.dataset.resonanceView,detailHtml:node=>renderResonanceDetail(tree,node)});section.querySelector('[data-resonance-view][aria-pressed="true"]')?.focus({preventScroll:true});return;}
    const button=event.target.closest('[data-resonance-select]');if(!button)return;
    const section=button.closest('.story-stage-rules');let graph=section?.querySelector('.story-resonance');const tree=mapIndex?.resonance?.[graph?.dataset.resonanceChapter],id=Number(button.dataset.resonanceSelect),node=tree?.nodes.find(n=>n.id===id);if(!node)return;
    if(!graph.querySelector(`.story-resonance-node[data-resonance-select="${id}"]`)){const key=graph.dataset.resonanceChapter,group=window.StoryResonance.groupForNode(tree,id);graph.outerHTML=window.StoryResonance.render(tree,{escapeHtml:escape,chapterKey:key,layoutGroup:group,detailHtml:node=>renderResonanceDetail(tree,node)});graph=section.querySelector('.story-resonance');}
    for(let parent=graph.parentElement;parent&&parent!==section;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    graph.querySelectorAll('.story-resonance-node').forEach(n=>n.setAttribute('aria-pressed',String(Number(n.dataset.resonanceSelect)===id)));
    graph.querySelectorAll('[data-resonance-edge]').forEach(edge=>{const [from,to]=edge.dataset.resonanceEdge.split(':').map(Number);edge.classList.toggle('is-selected',from===id||to===id);});
    graph.querySelector('#story-resonance-detail').innerHTML=renderResonanceDetail(tree,node);
    const selected=graph.querySelector('.story-resonance-node[aria-pressed="true"]');
    selected?.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});
    if(!button.classList.contains('story-resonance-node'))selected?.focus({preventScroll:true});
  });
  function renderStageRules(stage){
    if(!stage.rules.length)return '';
    const groups=[['chapter',`${stage.arc} 공통 규칙`],['stage','이 스테이지의 추가 규칙'],['positive','이 스테이지의 지원 효과']];
    return `<section class="story-stage-rules" aria-label="${escape(stage.arc)} 전투 규칙">${groups.map(([source,label])=>{const rows=stage.rules.filter(r=>r.source===source);if(!rows.length)return '';return disclosure(rich(label),rows.map(r=>escape(r.name)).join(' · '),rows.map(renderRuleCard).join(''),{open:source!=='chapter'});}).join('')}</section>`;
  }
  function monsterHeading(m,stats,{summoned=false,variantLabel='',phaseLabel='',collapsible=true}={}){
    return `<img class="monster-portrait" src="${escape(m.webImage)}" width="56" height="56" alt="" loading="lazy"><div class="monster-heading-copy"><h4>${rich(m.nameKo)}</h4>${phaseLabel?'<span class="flow-badge">'+escape(phaseLabel)+'</span>':''}${summoned?'<span class="monster-badge" data-type="Summon">소환 개체</span>'+(variantLabel?'<span class="monster-tag">'+escape(variantLabel)+'</span>':'')+'':m.monsterClass!=='Common'?`<span class="monster-badge" data-type="${escape(m.monsterClass)}">${labels[m.monsterClass]||'적'}</span>`:''}${m.monsterTags?.length?`<span class="monster-heading-tags">${m.monsterTags.map(id=>window.MonsterTypeCatalog?.[id]).filter(Boolean).map(tag=>`<span class="monster-tag">${escape(tag.label)}</span>`).join('')}</span>`:''}${Math.max(stats?.phases?.length||0,stats?.startingBars||0)>1?`<span class="hp-count-badge">HP ${Math.max(stats?.phases?.length||0,stats?.startingBars||0)}줄</span>`:''}</div>${collapsible?'<span class="collapse-indicator" aria-hidden="true"></span>':''}`;
  }
  function phaseIdentity(m,appearance){
    const hp={...appearance,phases:undefined,startingBars:undefined,hpDisplay:appearance.hpRange?number.format(appearance.hpRange.min)+' ~ '+number.format(appearance.hpRange.max):appearance.hpDisplay};
    return `<section class="monster-card story-phase-identity" aria-label="전환 후 몬스터 정보"><header class="monster-heading">${monsterHeading({...m,webImage:appearance.image},hp,{phaseLabel:'전환 후',collapsible:false})}</header><div class="monster-body"><div class="monster-overview">${window.BattleView.renderHp(hp,m,{escapeHtml:escape,number})}${appearance.hpNote?'<p class="story-hp-detail">'+escape(appearance.hpNote)+'</p>':''}</div></div></section>`;
  }
  function monsterCard(stage,tid,stats,ancestors=[],summoned=false,scope='story',variantLabel='',patternVariants=null){
    const m=stage.monsters[tid];if(!m)return '';
    const already=ancestors.includes(tid),chain=[...ancestors,tid];
    const varyingStats=patternVariants&&patternVariants.some(v=>['hp','attack','defense'].some(key=>v.stats[key]!==stats[key]));
    const hpValues=patternVariants?.map(v=>v.stats.hp).filter(Number.isFinite)||[];
    const hpStats=varyingStats&&hpValues.length===patternVariants.length?{...stats,phases:undefined,hpDisplay:Math.min(...hpValues)===Math.max(...hpValues)?number.format(hpValues[0]):number.format(Math.min(...hpValues))+' ~ '+number.format(Math.max(...hpValues))}:stats;
    const statMarkup=window.BattleView.renderHp(hpStats||{},m,{escapeHtml:escape,number});
    const allPatterns=m.patterns||[];
    const opening=allPatterns.find(p=>p.id==='opening'),cycle=allPatterns.find(p=>p.id==='cycle-1');
    const patterns=opening&&cycle&&JSON.stringify(opening.skillIds)===JSON.stringify(cycle.skillIds)?allPatterns.filter(p=>p!==opening):allPatterns;
    const allStateRows=[...new Map([...(stats?.resolvedStates||m.states||[]),...(stats?.entryStates||[])].filter(s=>s.visible!==false&&(s.description||s.descriptionTemplate)).map(s=>[s.id,s])).values()];
    const stateRows=allStateRows.filter(state=>!patternVariants||patternVariants.every(v=>[...(v.stats.resolvedStates||[]),...(v.stats.entryStates||[])].some(candidate=>candidate.id===state.id&&JSON.stringify(candidate)===JSON.stringify(state))));
    const stateMarkup=rows=>rows.map(s=>`<article>${s.icon?`<span class="monster-rule-icon"><img src="${escape(s.icon)}" alt="" width="28" height="28" loading="eager"></span>`:''}<div class="rule-copy"><div class="monster-rule-heading"><strong>${rich(s.id===120218?'지원 선택':s.name||'효과')}</strong>${Number.isFinite(s.initialLayer?.value?.display)&&s.initialLayer.value.display>1?`<span class="monster-initial-stack story-initial-stack">시작 ${number.format(s.initialLayer.value.display)}스택</span>`:''}</div><p>${rich(s.richDescription||s.description||s.descriptionTemplate)}</p></div></article>`).join('');
    const variantStateMarkup=rows=>rows.length?`<section class="monster-rules">${stateMarkup(rows)}</section>`:'';
    const body=already?'':patternVariants?`<section class="story-pattern-choices" aria-label="무작위 행동 패턴"><h5 class="section-label">행동 목록</h5><p class="story-pattern-note">${patternVariants.length}가지 패턴 중 무작위로 하나를 사용합니다.</p>${patternVariants.map((v,i)=>`<section data-pattern-monster-id="${v.monster.tid}">${variantStateMarkup([...(v.stats.resolvedStates||[]),...(v.stats.entryStates||[])].filter(state=>state.visible!==false&&(state.description||state.descriptionTemplate)&&!stateRows.some(common=>common.id===state.id)))}${flowSections(v.monster,v.stats,`패턴 ${i+1} · `)}${conditionalActions(v.monster,v.stats)}</section>`).join('')}</section>`:flowSections(m,stats);
    const rules=already?'':stateMarkup(stateRows);
    const playerRules=already?'':stateMarkup((stats?.playerEntryStates||[]).filter(state=>state.visible!==false));
    const actions=already||patternVariants?'':conditionalActions(m,stats);
    const summonGroups=new Map();
    if(!already)for(const summon of m.linkedSummons||[]){const group=summonGroups.get(summon.commandId)||[];group.push(summon);summonGroups.set(summon.commandId,group);}
    const summons=[...summonGroups.values()].map(group=>{
      const variants=new Map();
      for(const ref of group){const key=ref.choiceGroup||'single:'+ref.tid;const rows=variants.get(key)||[];rows.push(ref);variants.set(key,rows);}
      const cards=[...variants.values()].map(refs=>{
        const choices=refs[0].choiceGroup&&refs.length===refs[0].choiceCount;
        const render=ref=>{const summonStats=stage.summonedMonsters.find(r=>r.parentTid===tid&&r.tid===ref.tid&&(!r.commandId||r.commandId===ref.commandId));const def=stage.monsters[ref.tid];const first=def?.patterns.find(p=>p.id==='opening')?.skillIds[0]??def?.patterns.find(p=>p.id==='cycle-1')?.skillIds[0];const label=choices?'첫 행동: '+(def?.skills.find(s=>s.id===first)?.name||'알 수 없음'):'';return monsterCard(stage,ref.tid,summonStats,chain,true,scope,label);};
        if(!choices)return refs.map(render).join('');
        const buckets=window.StoryFlow.partitionVariants(stage,refs,tid);
        return buckets.map(rows=>{
          const combined=window.StoryFlow.combineVariants(stage,rows,tid,{subset:true});
          return combined?monsterCard(stage,rows[0].tid,combined[0].stats,chain,true,scope,'',combined):rows.map(render).join('');
        }).join('');
      }).join('');
      return `<section class="summon-section" aria-label="소환 개체"><div class="summon-list">${cards}</div></section>`;
    }).join('');
    const cardTag='details',headingTag='summary';
    return `<${cardTag} class="monster-card story-monster${summoned?' monster-card--summon':''}" data-monster-id="${tid}" id="${scope}-${chain.join('-')}" ${patternVariants||!summoned?'open':''}><${headingTag} class="monster-heading">${monsterHeading(m,stats,{summoned,variantLabel})}</${headingTag}><div class="monster-body"><div class="monster-overview">${statMarkup}</div>${rules||playerRules?`<section class="story-entry-effects" aria-label="전투 시작 상황">${rules?`<section class="monster-rules story-unique-rules"><h5 class="section-label">적의 시작 상태</h5>${rules}</section>`:''}${playerRules?`<section class="monster-rules story-player-effects"><h5 class="section-label">플레이어가 받는 효과</h5>${playerRules}</section>`:''}</section>`:''}<section class="combat-flow" aria-label="행동 목록">${body}${actions}</section>${summons}</div></${cardTag}>`;
  }
  function renderStoryMap(stage){
    const map=mapIndex?.stages?.[stage.id];if(!map)return '';
    return map.layouts.map((layout,i)=>window.BattleMap.render(layout,{escapeHtml:escape,
      title:map.type==='hex'?'스테이지 지도':'진행 경로',id:'story-'+stage.id+'-'+i,simplifySingleCombat:false,
      hint:map.type==='hex'?'지도를 좌우로 이동할 수 있습니다. 전투·기믹 노드를 선택하면 해당 설명으로 이동합니다.':'노드 진행 순서입니다. 좌우로 이동하거나 전투·기믹 노드의 설명을 확인할 수 있습니다.'})).join('');
  }
  function renderStage(stage){
    baseGlossary={...(stage.keywordGlossary||{}),...(mapIndex.resonance?.[stage.arc+':'+stage.chapter]?.keywordGlossary||{})};glossary=resolveEnchantGlossary(baseGlossary);
    const counts={};const types=stage.encounters.reduce((n,e)=>(n[e.battleType]=(n[e.battleType]||0)+1,n),{});
    return `<header class="story-stage-heading"><h2>${rich(stage.arc)} ${stage.chapter}장 · ${rich(stage.difficulty)} · ${rich(stage.number)} ${rich(stage.name)}</h2></header>${renderStageRules(stage)}${renderChapterMechanics(stage)}${renderStoryMap(stage)}${stage.encounters.length?stage.encounters.slice().sort((a,b)=>['Common','Elite','Boss'].indexOf(a.battleType)-['Common','Elite','Boss'].indexOf(b.battleType)).map(e=>{
      counts[e.battleType]=(counts[e.battleType]||0)+1;
      const label=`${labels[e.battleType]||'일반'} 전투${types[e.battleType]>1?' 구성 '+counts[e.battleType]:''}`;
      const followups=(stage.reinforcements||[]).filter(r=>r.battleId===e.battleId),initial=e.members.filter(m=>!followups.some(r=>r.tid===m.tid)),later=e.members.filter(m=>followups.some(r=>r.tid===m.tid));
      const cards=members=>members.map(m=>monsterCard(stage,m.tid,stage.stats[m.tid],[],false,'battle-'+e.battleId+'-slot-'+m.slot)).join('');
      return `<details class="encounter-card story-encounter" data-battle-id="${e.battleId}" open><summary class="encounter-header"><h3>${label} · 적 ${initial.length}명${later.length?' · 후속 '+later.length+'명':''}</h3><span class="collapse-indicator" aria-hidden="true"></span></summary><div class="monster-list">${cards(initial)}${later.length?'<h4 class="section-label">앞선 적 처치 후 등장</h4>'+cards(later):''}</div></details>`;
    }).join(''):'<p>이 스테이지에는 등록된 직접 전투 구성이 없습니다.</p>'}`;
  }
  async function loadStage(){
    const id=Number($('stage').value),current=++revision;
    $('content').setAttribute('aria-busy','true');$('status').textContent='전투 정보를 불러오는 중입니다.';$('content').innerHTML='';
    try{const response=await fetch(`data/story/stages/${id}.json?v=${index.version}-${ASSET_REVISION}`);if(!response.ok)throw new Error('stage');const stage=await response.json();if(current!==revision)return;$('content').innerHTML=renderStage(stage);window.BattleMap.activate($('content'));configureStoryTooltips();window.CharacterEffects?.setupTooltips($('content'));$('status').textContent=`${stage.combatCount}개 전투 구성`;history.replaceState(null,'',`#stage-${id}`);}catch(error){if(current!==revision)return;$('status').textContent='전투 정보를 불러오지 못했습니다.';$('content').innerHTML='<div class="story-error"><p>잠시 후 다시 시도해 주세요.</p><button type="button" id="story-retry">다시 불러오기</button></div>';$('retry').addEventListener('click',loadStage);}finally{if(current===revision)$('content').setAttribute('aria-busy','false');}
  }
  function options(select,rows,value){select.innerHTML=rows.map(r=>`<option value="${escape(r.value)}">${escape(r.label)}</option>`).join('');if(rows.some(r=>String(r.value)===String(value)))select.value=value;}
  function refreshStages(preferred){const rows=index.stages.filter(s=>s.arc===$('arc').value&&s.chapter===Number($('chapter').value)&&s.difficulty===$('difficulty').value);options($('stage'),rows.map(s=>({value:s.id,label:`${s.number} ${s.name}`})),preferred||rows.find(s=>s.combatCount)?.id);loadStage();}
  function refreshChapters(preferred,stageId){const chapters=[...new Map(index.stages.filter(s=>s.arc===$('arc').value).map(s=>[s.chapter,s])).values()];options($('chapter'),chapters.map(s=>({value:s.chapter,label:`${s.chapter}장 ${s.chapterName}`})),preferred);refreshStages(stageId);}
  window.addEventListener('hashchange',()=>{if(!index)return;const id=Number(location.hash.match(/^#stage-(\d+)$/)?.[1]),selected=index.stages.find(s=>s.id===id);if(!selected||String(id)===$('stage').value)return;$('arc').value=selected.arc;$('difficulty').value=selected.difficulty;refreshChapters(selected.chapter,selected.id);});
  async function initialize(){try{const response=await fetch(`data/story/index.json?v=${ASSET_REVISION}`);if(!response.ok)throw new Error('index');index=await response.json();const mapsResponse=await fetch(`data/story/maps.json?v=${ASSET_REVISION}`);if(!mapsResponse.ok)throw new Error('maps');mapIndex=await mapsResponse.json();await window.StoryResonance.load();await window.ResearchDepth.load();const researchInput=window.ResearchDepth.mountLevelControl($('research-control'),'story-research-level');researchLevel=window.ResearchDepth.bindLevelInput(researchInput,level=>{researchLevel=level;glossary=resolveEnchantGlossary(baseGlossary);configureStoryTooltips();});index.stages=index.stages.filter(stage=>stage.combatCount>0);const id=Number(location.hash.match(/^#stage-(\d+)$/)?.[1]);const selected=index.stages.find(s=>s.id===id);options($('arc'),index.arcs.map(a=>({value:a,label:a})),selected?.arc);$('difficulty').value=selected?.difficulty||'노말';const chapters=[...new Map(index.stages.filter(s=>s.arc===$('arc').value).map(s=>[s.chapter,s])).values()];options($('chapter'),chapters.map(s=>({value:s.chapter,label:`${s.chapter}장 ${s.chapterName}`})),selected?.chapter);refreshStages(selected?.id);$('arc').addEventListener('change',()=>refreshChapters());$('chapter').addEventListener('change',()=>refreshStages());$('difficulty').addEventListener('change',()=>refreshStages());$('stage').addEventListener('change',loadStage);}catch(error){$('status').textContent='스토리 목록을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';$('content').setAttribute('aria-busy','false');}}
  window.StoryEncounterView={renderStage,text};
  initialize();
})();
