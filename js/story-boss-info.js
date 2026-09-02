(() => {
    const root = document.getElementById('story-boss-content');
    if (!root) return;

    const escapeHtml = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const number = new Intl.NumberFormat('ko-KR');

    function resolvedActionDescription(action, stats) {
        let description = String(action.description || '');
        description = description
            .replace(/방어력 200%만큼/g, `${number.format(stats.defense * 2)}만큼`)
            .replace(/공격력 12\.5% × \(1 \+ 대상의 손실 HP 비율\)의 피해/g,
                `${number.format(Math.ceil(stats.attack * 0.125))}~${number.format(Math.ceil(stats.attack * 0.25))} 피해`)
            .replace(/공격력 15% × \(1 \+ 대상의 손실 HP 비율\)의 피해/g,
                `${number.format(Math.ceil(stats.attack * 0.15))}~${number.format(Math.ceil(stats.attack * 0.3))} 피해`)
            .replace(/공격력 110%의 피해/g, `${number.format(Math.ceil(stats.attack * 1.1))} 피해`)
            .replace(/공격력 45%의 피해/g, `${number.format(Math.ceil(stats.attack * 0.45))} 피해`)
            .replace(/공격력 25%의 피해/g, `${number.format(Math.ceil(stats.attack * 0.25))} 피해`)
            .replace(/자신의 공격력 3%/g, number.format(Math.ceil(stats.attack * 0.03)))
            .replace(/공격력 2\.5%만큼 힘/g, `${number.format(Math.ceil(stats.attack * 0.025))}만큼 힘`);
        return description;
    }

    function renderActions(section, stats) {
        return `
            <section class="flow-phase" aria-labelledby="phase-${escapeHtml(section.title)}">
                <header>
                    <h5 id="phase-${escapeHtml(section.title)}">${escapeHtml(section.title)}</h5>
                    <span class="flow-badge">${escapeHtml(section.badge)}</span>
                </header>
                <ol class="flow-sequence">
                    ${section.actions.map((action, index) => `
                        <li class="action-step">
                            <div class="action-marker">
                                <span class="flow-step-number">${index + 1}</span>
                                <img class="intent-icon" src="images/dzone/intent/intent_${escapeHtml(action.intent)}.png" width="37" height="37" alt="">
                            </div>
                            <div class="action-copy">
                                <strong>${escapeHtml(action.name)}</strong>
                                <p>${escapeHtml(resolvedActionDescription(action, stats))}</p>
                            </div>
                        </li>
                    `).join('')}
                </ol>
                ${section.badge.includes('반복') ? '<p class="flow-loop">↺ 위 순서로 반복</p>' : ''}
            </section>`;
    }

    function renderHp(stats) {
        const phases = [stats.hp, stats.phaseTwoEntryHp];
        const phaseMap = phases.map((hp, index) => `
            <span class="hp-phase-segment" style="--hp-phase-size:${hp}" aria-hidden="true"><b>${index + 1}</b></span>
        `).join('');
        return `
            <section class="hp-breakdown" aria-label="HP 2줄">
                <header><h5>HP <span>2줄</span></h5></header>
                <div class="hp-phase-map" aria-hidden="true">${phaseMap}</div>
                <dl>
                    <div class="hp-stage"><dt>1페이즈 시작 HP</dt><dd>${number.format(stats.hp)}</dd></div>
                    <div class="hp-stage"><dt>2페이즈 진입 HP</dt><dd>${number.format(stats.phaseTwoEntryHp)}</dd></div>
                    <div class="hp-stage"><dt>2페이즈 최대 HP</dt><dd>${number.format(stats.phaseTwoMaxHp)}</dd></div>
                    <div class="hp-stage hp-stage--total"><dt>기본 총 소진 HP</dt><dd>${number.format(stats.minimumEffectiveHp)}</dd></div>
                </dl>
                <p class="story-boss-hp-note">1페이즈에서 「유혹의 열매」로 최대 HP가 증가하지 않은 기준입니다. 최대 HP가 증가했다면 2페이즈 수치도 함께 증가합니다.</p>
            </section>`;
    }

    function renderInitialRules(items) {
        return `
            <section class="monster-rules story-boss-initial-effects" aria-label="보스 상태와 특수 규칙">
                ${items.map(item => `
                    <article>
                        ${item.icon ? `<span class="monster-rule-icon"><img src="${escapeHtml(item.icon)}" alt="" width="28" height="28"></span>` : ''}
                        <div><div class="monster-rule-heading"><strong>${escapeHtml(item.name)}</strong></div><p>${escapeHtml(item.description)}</p></div>
                    </article>
                `).join('')}
            </section>`;
    }

    function renderDifficultySelector(difficulties, selectedKey) {
        return `
            <section class="story-boss-difficulty" aria-labelledby="difficulty-title">
                <div>
                    <h3 id="difficulty-title">난이도별 실제 수치</h3>
                    <p>${escapeHtml(difficulties[selectedKey].stage)} · Lv.${number.format(difficulties[selectedKey].level)}</p>
                </div>
                <div class="story-boss-difficulty-options" role="group" aria-label="난이도 선택">
                    ${Object.entries(difficulties).map(([key, difficulty]) => `
                        <button type="button" class="monster-badge story-boss-difficulty-button" data-difficulty="${escapeHtml(key)}" aria-pressed="${key === selectedKey}">${escapeHtml(difficulty.label)}</button>
                    `).join('')}
                </div>
            </section>`;
    }

    function renderTransition(transition) {
        return `
            <div class="flow-connector flow-connector--phase" aria-hidden="true"><span>첫 체력바 소진</span></div>
            <section class="phase-transition" aria-labelledby="transition-title">
                <header>
                    <h5 id="transition-title">${escapeHtml(transition.title)}</h5>
                    <span>${escapeHtml(transition.badge)}</span>
                </header>
                <div class="story-boss-transition-lead">
                    <img src="${escapeHtml(transition.portrait)}" width="256" height="256" alt="산의 기생충 2단계 초상화">
                    <div>
                        <p class="story-boss-transition-trigger"><b>발동:</b> ${escapeHtml(transition.trigger)}</p>
                        <p class="phase-transition-summary">${escapeHtml(transition.description)}</p>
                    </div>
                </div>
                <div class="monster-rules story-boss-transition-rules" aria-label="2페이즈 전환 효과">
                    <article>
                        <span class="monster-rule-icon"><img src="images/keyword-icons/original/icons_buff_016.png" alt="" width="28" height="28"></span>
                        <div><div class="monster-rule-heading"><strong>전환 처리</strong></div><p>${escapeHtml(transition.steps.join(' '))}</p></div>
                    </article>
                    ${transition.treasures.map(item => `
                        <article>
                            <span class="monster-rule-icon"><img src="${escapeHtml(item.icon)}" alt="" width="28" height="28"></span>
                            <div><div class="monster-rule-heading"><strong>${escapeHtml(item.name)}</strong></div><p>${escapeHtml(item.effect)}<br><span class="story-boss-break"><b>파손:</b> ${escapeHtml(item.break)}</span></p></div>
                        </article>
                    `).join('')}
                </div>
            </section>
            <div class="flow-connector flow-connector--phase" aria-hidden="true"><span>새 행동 목록 적용</span></div>`;
    }

    function renderFlatRules(title, items, className = '') {
        const renderGroups = groups => groups?.length ? `
            <div class="story-boss-support-groups">
                ${groups.map(group => `
                    <section class="story-boss-support-group">
                        <h4>${escapeHtml(group.name)}</h4>
                        ${group.summary ? `<p>${escapeHtml(group.summary)}</p>` : ''}
                        ${group.variants?.length ? `<p class="story-boss-support-variants"><b>생성 카드:</b> ${group.variants.map(escapeHtml).join(' · ')}</p>` : ''}
                        ${group.entries?.length ? `
                            <ul>
                                ${group.entries.map(entry => `
                                    <li><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.effect)}</span></li>
                                `).join('')}
                            </ul>` : ''}
                    </section>
                `).join('')}
            </div>` : '';
        return `
            <section class="story-boss-flat-section ${escapeHtml(className)}">
                <h3>${escapeHtml(title)}</h3>
                <div class="monster-rules">
                    ${items.map(item => `
                        <article>
                            <span class="monster-rule-icon" aria-hidden="true">◆</span>
                            <div>
                                <div class="monster-rule-heading"><strong>${escapeHtml(item.name || item.title)}</strong></div>
                                ${item.trigger ? `<p class="story-boss-flat-trigger"><b>발동:</b> ${escapeHtml(item.trigger)}</p>` : ''}
                                <p>${escapeHtml(item.description)}</p>
                                ${item.note ? `<p class="story-boss-support-note">${escapeHtml(item.note)}</p>` : ''}
                                ${renderGroups(item.groups)}
                            </div>
                        </article>
                    `).join('')}
                </div>
            </section>`;
    }

    function renderConditionalActions(items) {
        return `
            <section class="conditional-actions story-boss-conditional-actions" aria-labelledby="conditional-actions-title">
                <h3 id="conditional-actions-title" class="section-label">조건부 행동·상태</h3>
                ${items.map(item => `
                    <article class="conditional-action">
                        <span class="monster-rule-icon" aria-hidden="true">!</span>
                        <div class="conditional-action-copy">
                            <header><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.badge)}</span></header>
                            <p class="conditional-trigger"><b>발동:</b> ${escapeHtml(item.trigger)}</p>
                            <p>${escapeHtml(item.description)}</p>
                        </div>
                    </article>
                `).join('')}
            </section>`;
    }

    function renderMonster(monster, source, selectedDifficulty = 'normal') {
        const stats = monster.difficulties[selectedDifficulty] || monster.difficulties.normal;
        root.innerHTML = `
            <div class="monster-list">
                <article class="monster-card">
                    <header class="monster-heading">
                        <img class="monster-portrait story-boss-portrait" src="${escapeHtml(monster.portrait)}" width="256" height="256" alt="${escapeHtml(monster.name)} 1단계 초상화">
                        <div class="monster-heading-copy">
                            <h2>${escapeHtml(monster.name)}</h2>
                            <div class="story-boss-meta">
                                <span class="monster-badge" data-type="${escapeHtml(monster.class)}">보스</span>
                                ${monster.tags.map(tag => `<span class="monster-tag">${escapeHtml(tag)}</span>`).join('')}
                                <span class="hp-count-badge">HP ${monster.hpBars}줄</span>
                            </div>
                        </div>
                    </header>

                    <div class="monster-body">
                        <p class="story-boss-description">${escapeHtml(monster.description)}</p>
                        ${renderDifficultySelector(monster.difficulties, selectedDifficulty)}
                        <div class="monster-overview">${renderHp(stats)}</div>
                        ${renderInitialRules(monster.initialMechanics)}

                        <div class="combat-flow" aria-label="행동 패턴">
                            ${renderActions(monster.opening, stats)}
                            <div class="flow-connector" aria-hidden="true"><span>이어서</span></div>
                            ${renderActions(monster.phaseOne, stats)}
                            ${renderTransition(monster.transition)}
                            ${renderActions(monster.phaseTwo, stats)}
                        </div>

                        ${renderConditionalActions(monster.conditionalActions)}
                        ${renderFlatRules('스토리 지원', monster.supportMechanics, 'story-boss-flat-section--support')}

                        <p class="story-boss-source">게임 설정 원본 ${escapeHtml(source)}의 스테이지·몬스터·스킬·명령·상태 데이터를 연결해 정리했습니다. HP와 피해는 선택 난이도 기준이며, 2페이즈 HP는 1페이즈 최대 HP 증가가 없을 때의 기준값입니다.</p>
                    </div>
                </article>
            </div>`;
    }

    fetch('data/story_boss_mountain_parasite.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            renderMonster(data.monster, data.source);
            root.addEventListener('click', event => {
                const button = event.target.closest('[data-difficulty]');
                if (!button) return;
                renderMonster(data.monster, data.source, button.dataset.difficulty);
            });
        })
        .catch(error => {
            console.error(error);
            root.innerHTML = '<div class="dzone-error">산의 기생충 전투 정보를 불러오지 못했습니다.</div>';
        });
})();
