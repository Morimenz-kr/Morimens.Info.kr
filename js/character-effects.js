(function () {
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderCost(cost) {
        if (!cost) return '';
        return `<span class="character-effect-cost">${escapeHtml(cost.type)} ${escapeHtml(cost.value)}</span>`;
    }

    function renderLevels(levels) {
        if (!levels?.length) return '';

        const options = levels.map((level, index) => `
            <option value="${level.level}"${index === levels.length - 1 ? ' selected' : ''}>Lv.${level.level}</option>
        `).join('');
        const rows = levels.map((level, index) => {
            const stats = Object.entries(level)
                .filter(([key]) => key !== 'level')
                .map(([key, value]) => `
                    <div class="character-effect-stat">
                        <span>${escapeHtml(key)}</span>
                        <strong>${escapeHtml(value)}</strong>
                    </div>
                `).join('');
            return `
                <div class="character-effect-level-row${index === levels.length - 1 ? ' active' : ''}" data-level="${level.level}">
                    ${stats}
                </div>
            `;
        }).join('');

        return `
            <div class="character-effect-levels">
                <label>
                    스킬 레벨
                    <select class="character-effect-level-select" aria-label="스킬 레벨 선택">
                        ${options}
                    </select>
                </label>
                <div>${rows}</div>
            </div>
        `;
    }

    function renderEffectBody(effect) {
        return `
            <p class="character-effect-description">${escapeHtml(effect.effect)}</p>
            ${renderLevels(effect.levels)}
        `;
    }

    function renderSkill(skill, index) {
        let body;
        if (skill.variants?.length) {
            body = `
                <div class="character-effect-variants">
                    ${skill.variants.map(variant => `
                        <section class="character-effect-variant">
                            <div class="character-effect-variant-header">
                                ${variant.condition ? `<span class="character-effect-condition">${escapeHtml(variant.condition)}</span>` : ''}
                                <strong>${escapeHtml(variant.name)}</strong>
                                ${renderCost(variant.cost)}
                            </div>
                            ${renderEffectBody(variant)}
                        </section>
                    `).join('')}
                </div>
            `;
        } else {
            body = renderEffectBody(skill);
        }

        return `
            <details class="character-effect-card"${index === 0 ? ' open' : ''}>
                <summary>
                    <span class="character-effect-type">${escapeHtml(skill.type)}</span>
                    <strong>${escapeHtml(skill.name)}</strong>
                    ${renderCost(skill.cost)}
                </summary>
                <div class="character-effect-body">${body}</div>
            </details>
        `;
    }

    function render(container, character, characterName) {
        if (!container) return;
        if (!character) {
            container.innerHTML = '<div class="character-effects-empty">등록된 스킬/돌파 정보가 없습니다.</div>';
            return;
        }

        container.innerHTML = `
            <div class="character-effects-summary">
                <strong>${escapeHtml(characterName)} 스킬 정보</strong>
                <span>스킬 ${character.skills.length}개 · 돌파 ${character.breakthroughs.length}개</span>
            </div>
            <div class="character-effects-switch" role="tablist" aria-label="스킬과 돌파">
                <button type="button" class="active" data-effect-panel="skills" role="tab" aria-selected="true">스킬</button>
                <button type="button" data-effect-panel="breakthroughs" role="tab" aria-selected="false">돌파</button>
            </div>
            <div class="character-effect-panel active" data-effect-content="skills" role="tabpanel">
                <div class="character-effect-list">
                    ${character.skills.map(renderSkill).join('')}
                </div>
            </div>
            <div class="character-effect-panel" data-effect-content="breakthroughs" role="tabpanel">
                <div class="character-breakthrough-list">
                    ${character.breakthroughs.map((item, index) => `
                        <article class="character-breakthrough-card">
                            <span class="character-breakthrough-step">돌파 ${index + 1}</span>
                            <h3>${escapeHtml(item.name)}</h3>
                            <p>${escapeHtml(item.effect)}</p>
                        </article>
                    `).join('')}
                </div>
            </div>
        `;

        container.addEventListener('click', event => {
            const button = event.target.closest('[data-effect-panel]');
            if (!button || !container.contains(button)) return;
            const target = button.dataset.effectPanel;
            container.querySelectorAll('[data-effect-panel]').forEach(item => {
                const active = item === button;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', String(active));
            });
            container.querySelectorAll('[data-effect-content]').forEach(panel => {
                panel.classList.toggle('active', panel.dataset.effectContent === target);
            });
        });

        container.addEventListener('change', event => {
            if (!event.target.matches('.character-effect-level-select')) return;
            const levels = event.target.closest('.character-effect-levels');
            levels.querySelectorAll('.character-effect-level-row').forEach(row => {
                row.classList.toggle('active', row.dataset.level === event.target.value);
            });
        });
    }

    window.CharacterEffects = { render };
})();
