(() => {
    const root = document.getElementById('monster-preview-content');
    const header = document.querySelector('.monster-preview-header');
    if (!root || !header) return;

    const escapeHtml = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    const number = new Intl.NumberFormat('ko-KR');
    const plainGameText = value => String(value || '').replace(/<[^:>]+:\s*([^>]+)>/g, '$1');

    function patternTitle(pattern) {
        if (pattern.kind === 'opening') return '전투 진입 시 등록된 행동 목록';
        return `${pattern.cycleIndex}번 순환 행동 목록`;
    }

    function renderSkill(skill, order) {
        return `<li class="monster-preview-skill">
            <span class="monster-preview-order">${order}</span>
            <div class="monster-preview-copy">
                <header><strong>${escapeHtml(skill.name || '이름 없는 내부 스킬')}</strong><span class="monster-preview-source-id">Skill ${skill.id}</span></header>
                ${skill.resolvedDescription ? `<p>${escapeHtml(skill.resolvedDescription)}</p>` : ''}
            </div>
        </li>`;
    }

    function renderPattern(pattern, data) {
        const phase = pattern.cycleIndex === 2 ? data.phaseSkills[1] : data.phaseSkills[0];
        return `<section class="monster-preview-pattern">
            <h3>${escapeHtml(patternTitle(pattern))}</h3>
            <ol class="monster-preview-skill-list">
                ${pattern.skillIds.map((id, index) => renderSkill(phase.skills[id], index + 1)).join('')}
            </ol>
        </section>`;
    }

    function renderTransition(data) {
        return data.transitions.map(item => {
            const forced = item.forcedSkillIds.map(id => data.phaseSkills[1]?.skills[id]?.name || `Skill ${id}`).join(' · ');
            return `<article class="monster-preview-rule">
                <h3>첫 체력바 소진 시 실행되는 전환</h3>
                <p>두 번째 체력바 최대 HP ${number.format(data.hpPhases[1]?.maxHp || data.stats.hp)} · 행동 목록 ${escapeHtml(item.targetSkillList)}번 · 전환 의도 ${escapeHtml(forced)}</p>
                <code class="monster-preview-code">State ${item.stateId} → Cmd ${item.commandId}\n${escapeHtml(item.triggerEvents.join(', '))}</code>
            </article>`;
        }).join('');
    }

    function renderConditionals(data) {
        return data.conditionalActions.map(item => {
            const skill = data.skills[item.skillId];
            return `<article class="monster-preview-rule">
                <h3>${escapeHtml(data.states[item.stateId]?.name || `State ${item.stateId}`)} → ${escapeHtml(skill?.name || `Skill ${item.skillId}`)}</h3>
                ${skill?.resolvedDescription ? `<p>${escapeHtml(skill.resolvedDescription)}</p>` : ''}
                <code class="monster-preview-code">${escapeHtml(item.condition)}\nState ${item.stateId} → Cmd ${item.commandId} step ${item.commandStep} → Skill ${item.skillId}</code>
            </article>`;
        }).join('');
    }

    function renderStates(data) {
        const relevantIds = new Set([
            ...(data.initialStateIds || []),
            ...(data.conditionalStates || []).map(item => item.appliedStateId)
        ]);
        const visible = [...relevantIds]
            .map(id => data.states[id])
            .filter(state => state && state.visible && state.name && !state.name.includes('상태@'));
        return visible.map(state => `<li class="monster-preview-state">
            <span class="monster-preview-order">◆</span>
            <div class="monster-preview-copy">
                <header><strong>${escapeHtml(plainGameText(state.name))}</strong><span class="monster-preview-source-id">State ${state.id}</span></header>
                ${state.descriptionTemplate ? `<p>${escapeHtml(plainGameText(state.descriptionTemplate))}</p>` : ''}
            </div>
        </li>`).join('');
    }

    function render(data) {
        header.innerHTML = `<p>공용 자동 변환기 · 대표 표본</p><h1>${escapeHtml(data.name)}</h1>`;
        root.innerHTML = `
            <section class="monster-preview-hero">
                <img class="monster-preview-portrait" src="images/dzone/monster/Portrait_Minihead_EnemyAwaker_B05EX_AF.webp" width="256" height="256" alt="${escapeHtml(data.name)} 초상화">
                <div class="monster-preview-title">
                    <h2>${escapeHtml(data.name)}</h2>
                    <div class="monster-preview-tags"><span class="monster-preview-tag">TID ${data.monsterId}</span><span class="monster-preview-tag">융재금구 5파 · 경계도 4</span><span class="monster-preview-tag">HP ${data.hpPhases.length}줄</span></div>
                    <p>${escapeHtml(data.description)}</p>
                </div>
            </section>
            <section class="monster-preview-section">
                <h2>실제 전투 수치</h2>
                <dl class="monster-preview-stats">
                    <div><dt>1번째 HP</dt><dd>${number.format(data.stats.hp)}</dd></div>
                    <div><dt>공격</dt><dd>${number.format(data.stats.attack)}</dd></div>
                    <div><dt>방어</dt><dd>${number.format(data.stats.defense)}</dd></div>
                    <div><dt>총 소진 HP</dt><dd>${number.format(data.effectiveHp)}</dd></div>
                </dl>
                <div class="monster-preview-hp">${data.hpPhases.map(item => `<div class="monster-preview-hp-row"><span>${item.phaseIndex}번째 체력바</span><strong>${number.format(item.maxHp)}</strong></div>`).join('')}</div>
            </section>
            <section class="monster-preview-section">
                <h2>원본 행동 목록과 계산된 전문</h2>
                <div class="monster-preview-patterns">${data.patterns.map(pattern => renderPattern(pattern, data)).join('')}</div>
            </section>
            <section class="monster-preview-section">
                <h2>전환과 조건부 교체</h2>
                ${renderTransition(data)}${renderConditionals(data)}
            </section>
            <section class="monster-preview-section">
                <h2>연결된 인게임 상태</h2>
                <ul class="monster-preview-state-list">${renderStates(data)}</ul>
                <details class="monster-preview-details">
                    <summary>원본 추적 정보 ${data.states ? Object.keys(data.states).length : 0}개 상태 · 진단 ${data.diagnostics.length}건</summary>
                    <code class="monster-preview-code">${escapeHtml(JSON.stringify({ templateSource: data.templateSource, transitions: data.transitions, conditionalActions: data.conditionalActions, conditionalStates: data.conditionalStates, diagnostics: data.diagnostics }, null, 2))}</code>
                </details>
            </section>`;
    }

    fetch('data/monster_combat_148007_preview.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(render)
        .catch(error => {
            console.error(error);
            root.innerHTML = '<p class="monster-preview-error">변환 결과를 불러오지 못했습니다.</p>';
        });
})();
