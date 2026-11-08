(() => {
    'use strict';
function renderHp(stats, monster, {escapeHtml, number, dynamicMarkup, skillById, data}) {
        const showHpBar = monster?.monsterClass !== 'Common';
        if ((!stats.phases || stats.phases.length < stats.startingBars) && Number.isInteger(stats.startingBars) && stats.startingBars > 1 && Number.isFinite(stats.hp)) {
            const bars=Array.from({length:stats.startingBars},(_,index)=>`<span class="hp-phase-segment" style="--hp-phase-size: ${stats.hp}" aria-hidden="true"><b>${index+1}</b></span>`).join('');
            return `<section class="hp-breakdown" aria-label="시작 HP ${stats.startingBars}줄"><header><h5>시작 HP <span>${stats.startingBars}줄</span></h5></header>${showHpBar?`<div class="hp-phase-map" aria-hidden="true">${bars}</div>`:''}<dl><div class="hp-stage"><dt>체력바당 HP</dt><dd>${number.format(stats.hp)}</dd></div><div class="hp-stage hp-stage--total"><dt>시작 총 HP</dt><dd>${number.format(stats.hp*stats.startingBars)}</dd></div></dl></section>`;
        }
        if (!stats.phases || stats.phases.length < 2) {
            const hp = stats.hpDisplay ? escapeHtml(stats.hpDisplay) : Number.isFinite(stats.hp) ? number.format(stats.hp) : '전투 중 결정';
            const bar = showHpBar && (Number.isFinite(stats.hp)||Number.isFinite(stats.hpRange?.max)) ? `<div class="hp-phase-map" aria-hidden="true"><span class="hp-phase-segment" style="--hp-phase-size: ${stats.hp??stats.hpRange.max}"></span></div>` : '';
            const value = `<dl class="monster-stats"><div class="monster-stat monster-stat--hp"><dt>${escapeHtml(stats.hpLabel||'HP')}</dt><dd>${hp}</dd></div></dl>`;
            return showHpBar ? `<section class="hp-breakdown" aria-label="HP ${hp}">${bar}${value}</section>` : value;
        }
        const phaseCount = stats.phases.length;
        const phaseMap = stats.phases.map((phase, index) => `<span class="hp-phase-segment" style="--hp-phase-size: ${phase.hp}" aria-hidden="true"><b>${index + 1}</b></span>`).join('');
        const phaseTransition = (monster?.phaseTransitions || []).find(transition => transition.phaseIndex === 2);
        const bars = stats.phases.map((phase, index) => `<div class="hp-stage"><dt>${index + 1}번째 체력바${index === 1 && phaseTransition ? ' · 각성 후' : ''}</dt><dd>${number.format(phase.hp)}</dd></div>`).join('');
        return `<section class="hp-breakdown" aria-label="HP ${phaseCount}줄"><header><h5>HP <span>${phaseCount}줄</span></h5></header>${showHpBar?`<div class="hp-phase-map" aria-hidden="true">${phaseMap}</div>`:''}<dl>${bars}<div class="hp-stage hp-stage--total"><dt>실질 총 HP</dt><dd>${number.format(stats.effectiveHp ?? stats.phases.reduce((sum, phase) => sum + phase.hp, 0))}</dd></div></dl></section>`;
    }
function renderPhaseTransition(monster, transition, stats, {escapeHtml, number, dynamicMarkup, skillById, data}) {
        if (!transition) return '';
        const awakeningSkill = transition.phaseSkillIds?.[0];
        const heading = awakeningSkill ? (skillById(monster, awakeningSkill)?.name || transition.stateName || '각성') : '단계 전환';
        const awakening = stats?.phaseResolvedSkills?.[String(transition.phaseIndex)]?.[String(awakeningSkill)]
            || stats?.resolvedSkills?.[String(awakeningSkill)];
        const following=(transition.entryActions||[]).slice(1).map(action=>{
            const skill=skillById(monster,action.skillId),resolved=stats?.phaseResolvedSkills?.[String(transition.phaseIndex)]?.[String(action.skillId)]||stats?.resolvedSkills?.[String(action.skillId)];
            return skill&&resolved?`<div class="phase-followup-action" data-skill-id="${action.skillId}">${action.condition?`<p class="conditional-trigger">${escapeHtml(action.condition)}</p>`:''}<strong>${dynamicMarkup(skill.name)}</strong><p>${dynamicMarkup(resolved.richDescription||resolved.description)}</p></div>`:'';
        }).join('');
        const effects = [];
        if (transition.rebirth) effects.push('쓰러지면 부활');
        if (transition.maxHpMultiplier) effects.push(`최대 HP ${transition.maxHpMultiplier}배로 증가`);
        if (transition.healsToMax) effects.push('증가한 최대 HP까지 회복');
        const stateKeywordMarkup = (state, markup) => {
            if (state.id !== 140728 || /<kw_[a-f0-9]{16}:허기>/.test(markup || '')) return markup;
            const entry = Object.entries(data.keywordGlossary || {}).find(([, item]) =>
                item.source?.type === 'State' && item.source.id === 140727 && item.name === '허기');
            return entry ? String(markup).replace('허기', `<${entry[0]}:허기>`) : markup;
        };
        const stateItems = (transition.addedStates || [])
            .map(state => transition.displayStateReplacements?.[String(state.id)] || state)
            .filter(state => state.visible && (state.name || state.descriptionTemplate))
            .map(state => `<li>${state.icon ? `<img src="${escapeHtml(state.icon)}" alt="" width="22" height="22" loading="lazy" decoding="async">` : ''}<span><b>${escapeHtml(state.name || '효과')}</b>${state.descriptionTemplate ? ` — ${dynamicMarkup(stateKeywordMarkup(state, state.richDescriptionTemplate || state.descriptionTemplate))}` : ''}</span></li>`)
            .join('');
        const cards = (transition.createdCards || []).map(card => `
            <article class="phase-card">
                <header><span>생성 카드</span><strong>${escapeHtml(card.name || '카드')}</strong><em>비용 ${number.format(card.cost || 0)}</em></header>
                ${card.effects?.length ? `<p>${card.effects.map(effect => dynamicMarkup(effect)).join(' · ')}</p>` : (card.descriptionTemplate ? `<p>${dynamicMarkup(card.descriptionTemplate)}</p>` : '')}
            </article>`).join('');
        return `<section class="phase-transition" data-skill-id="${awakeningSkill||''}" aria-label="${escapeHtml(heading)} 단계 전환">
            <header><h5>${escapeHtml(heading)}</h5><span>${escapeHtml(transition.phaseIndex || 2)}단계 전환</span></header>
            ${transition.condition ? `<p class="conditional-trigger">${dynamicMarkup(transition.condition)}</p>` : ''}
            ${effects.length ? `<p class="phase-transition-summary">${effects.join(' · ')}</p>` : ''}
            ${transition.sequenceDescription ? `<p class="phase-transition-summary">${dynamicMarkup(transition.sequenceDescription)}</p>` : ''}
            ${awakening ? `<p>${dynamicMarkup(awakening.richDescription || awakening.description)}</p>` : ''}${following}
            ${stateItems ? `<ul class="phase-transition-states">${stateItems}</ul>` : ''}
            ${cards}
        </section>`;
    }
window.BattleView = {renderHp, renderPhaseTransition};
})();
