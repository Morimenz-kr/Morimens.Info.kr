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

    function getDefaultLevel(levels) {
        return levels?.length ? levels[levels.length - 1].level : '';
    }

    function renderLevelSelect(levels) {
        if (!levels?.length) return '';

        const options = levels.map((level, index) => `
            <option value="${level.level}"${index === levels.length - 1 ? ' selected' : ''}>Lv.${level.level}</option>
        `).join('');
        const levelsJson = escapeHtml(JSON.stringify(levels));

        return `
            <select class="character-effect-level-select" aria-label="스킬 레벨 선택" data-levels="${levelsJson}">
                ${options}
            </select>
        `;
    }

    function splitCompoundValue(value) {
        return String(value || '').split('/').map(part => part.trim()).filter(Boolean);
    }

    function replaceCompoundPlaceholders(text, entries, star) {
        const pattern = star
            ? /\*l%?\s*\/\s*\*m%?\s*\/\s*\*n%?/g
            : /(?<!\*)\bl%?\s*\/\s*m%?\s*\/\s*n%?/g;

        return text.replace(pattern, match => {
            const index = entries.findIndex(entry => {
                const keyMatches = star ? entry.key.startsWith('*') : !entry.key.startsWith('*');
                return keyMatches && String(entry.value || '').includes('/');
            });
            if (index < 0) return match;

            const [entry] = entries.splice(index, 1);
            const parts = splitCompoundValue(entry.value);
            return parts.length === 3 ? parts.join('/') : entry.value;
        });
    }

    function interpolateEffect(effect, levels, selectedLevel) {
        if (!levels?.length) return effect;

        const level = levels.find(item => String(item.level) === String(selectedLevel)) || levels[levels.length - 1];
        const entries = Object.entries(level)
            .filter(([key]) => key !== 'level')
            .map(([key, value]) => ({ key, value: String(value) }));
        let nextIndex = 0;
        let text = String(effect || '');

        text = replaceCompoundPlaceholders(text, entries, true);
        text = replaceCompoundPlaceholders(text, entries, false);

        text = text.replace(/\*n%?|(?<!\*)\bn%?/g, match => {
            const entry = entries[nextIndex];
            if (!entry) return match;
            nextIndex += 1;
            return entry.value;
        });

        return text;
    }

    function renderEffectBody(effect) {
        const defaultLevel = getDefaultLevel(effect.levels);
        const interpolatedEffect = interpolateEffect(effect.effect, effect.levels, defaultLevel);

        return `
            <p class="character-effect-description" data-effect-template="${escapeHtml(effect.effect)}">${escapeHtml(interpolatedEffect)}</p>
        `;
    }

    function renderHeaderControls(effect) {
        return `
            <span class="character-effect-header-controls">
                ${renderCost(effect.cost)}
                ${renderLevelSelect(effect.levels)}
            </span>
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
                                ${renderHeaderControls(variant)}
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
                    ${renderHeaderControls(skill)}
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
        const visibleSkills = character.skills.filter(skill => skill.type !== '최종 법칙');
        const finalLaw = character.skills.find(skill => skill.type === '최종 법칙');

        container.innerHTML = `
            <div class="character-effects-switch" role="tablist" aria-label="스킬과 돌파">
                <button type="button" class="active" data-effect-panel="skills" role="tab" aria-selected="true">스킬</button>
                <button type="button" data-effect-panel="breakthroughs" role="tab" aria-selected="false">돌파</button>
            </div>
            <div class="character-effect-panel active" data-effect-content="skills" role="tabpanel">
                <div class="character-effect-list">
                    ${visibleSkills.map(renderSkill).join('')}
                </div>
                ${character.derivedCards?.length ? `
                    <section class="character-derived-section">
                        <h3>파생 카드</h3>
                        <div class="character-effect-list">
                            ${character.derivedCards.map((card, index) => renderSkill(card, index)).join('')}
                        </div>
                    </section>
                ` : ''}
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
                    ${finalLaw ? `
                        <article class="character-breakthrough-card final-law">
                            <span class="character-breakthrough-step">최종 법칙</span>
                            <h3>${escapeHtml(finalLaw.name)}</h3>
                            <p>${escapeHtml(finalLaw.effect)}</p>
                        </article>
                    ` : ''}
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
            const scope = event.target.closest('.character-effect-variant, .character-effect-card');
            if (!scope) return;

            const description = scope.querySelector('.character-effect-description');
            if (description) {
                const levels = JSON.parse(event.target.dataset.levels || '[]');
                description.textContent = interpolateEffect(
                    description.dataset.effectTemplate,
                    levels,
                    event.target.value
                );
            }
        });

        container.addEventListener('click', event => {
            if (event.target.closest('.character-effect-level-select')) {
                event.stopPropagation();
            }
        });
    }

    window.CharacterEffects = { render };
})();
