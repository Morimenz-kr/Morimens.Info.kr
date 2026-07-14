(function () {
    let tooltipDictionary = {};

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

    function renderRichText(value) {
        const text = String(value ?? '');
        const parts = [];
        let lastIndex = 0;

        text.replace(/\[([^\]]+)\]/g, (match, keyword, offset) => {
            parts.push(escapeHtml(text.slice(lastIndex, offset)));
            if (tooltipDictionary[keyword]) {
                parts.push(
                    `<button type="button" class="tooltip-trigger" data-keyword="${escapeHtml(keyword)}" aria-describedby="character-effect-tooltip-box" aria-controls="character-effect-tooltip-box" aria-expanded="false" aria-haspopup="dialog">${escapeHtml(keyword)}</button>`
                );
            } else {
                parts.push(escapeHtml(keyword));
            }
            lastIndex = offset + match.length;
            return match;
        });
        parts.push(escapeHtml(text.slice(lastIndex)));

        return parts.join('').replace(/\n/g, '<br>');
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
            .filter(([key]) => (
                key !== 'level' &&
                !/(?:돌파\s*\d+|\d+\s*돌파)/.test(key)
            ))
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

    function sanitizeDisplayedEffect(text) {
        return String(text || '')
            .replace(/\s*[\(\{]\s*돌파\s*\d+\s*\|[^)\}]*[\)\}]\s*/g, ' ')
            .replace(/\(\s*효과는 기본 ['"]?타격['"]?의 레벨에 따라 증가한다\.?\s*\)/g, '')
            .replace(
                /기본 '타격' 사용 시 공격력 n% 반격 을 획득한다\./g,
                "기본 '타격' 사용 시 공격력의 15 ~ 30%에 해당하는 반격을 획득한다."
            )
            .replace(/\s+/g, ' ')
            .replace(/\s+([,.])/g, '$1')
            .trim();
    }

    function renderEffectBody(effect) {
        const defaultLevel = getDefaultLevel(effect.levels);
        const interpolatedEffect = sanitizeDisplayedEffect(
            interpolateEffect(effect.effect, effect.levels, defaultLevel)
        );

        return `
            <p class="character-effect-description" data-effect-template="${escapeHtml(effect.effect)}">${renderRichText(interpolatedEffect)}</p>
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
            <details class="character-effect-card" data-effect-name="${escapeHtml(skill.name)}"${index === 0 ? ' open' : ''}>
                <summary>
                    <span class="character-effect-type">${escapeHtml(skill.type)}</span>
                    <strong>${escapeHtml(skill.name)}</strong>
                    ${renderHeaderControls(skill)}
                </summary>
                <div class="character-effect-body">${body}</div>
            </details>
        `;
    }

    function renderEmpty(message) {
        return `<div class="character-effects-empty">${escapeHtml(message)}</div>`;
    }

    function renderEnlighten(items, skills) {
        if (!items.length && !skills.length) {
            return renderEmpty('등록된 계령 정보가 없습니다.');
        }

        return `
            ${items.length ? `
                <section class="character-enlighten-section">
                    <div class="character-breakthrough-list">
                        ${items.map((item, index) => `
                            <article class="character-breakthrough-card">
                                <span class="character-breakthrough-step">계령 ${index + 1}</span>
                                <h3>${escapeHtml(item.name)}</h3>
                                <p>${renderRichText(sanitizeDisplayedEffect(
                                    interpolateEffect(item.effect, item.levels, getDefaultLevel(item.levels))
                                ))}</p>
                            </article>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
            ${skills.length ? `
                <section class="character-enlighten-section">
                    <div class="character-effect-list">
                        ${skills.map(renderSkill).join('')}
                    </div>
                </section>
            ` : ''}
        `;
    }

    function renderTraits(items) {
        if (!items.length) return renderEmpty('등록된 특성 정보가 없습니다.');

        return `
            <div class="character-trait-list">
                ${items.map(item => `
                    <article class="character-trait-card">
                        ${item.level_range ? `<span class="character-trait-level">${escapeHtml(item.level_range)}</span>` : ''}
                        <h3>${escapeHtml(item.name)}</h3>
                        <p>${renderRichText(sanitizeDisplayedEffect(item.effect))}</p>
                    </article>
                `).join('')}
            </div>
        `;
    }

    function renderDimensionalImage(item, characterName) {
        if (!item) return renderEmpty('등록된 차원영상 정보가 없습니다.');

        return `
            <article class="character-dimensional-card">
                <h3>${escapeHtml(item.name || `차원 영상: ${characterName}`)}</h3>
                <p>${renderRichText(sanitizeDisplayedEffect(item.effect))}</p>
            </article>
        `;
    }

    function setupTooltips(container) {
        if (container.dataset.tooltipEventsBound === 'true') return;
        container.dataset.tooltipEventsBound = 'true';

        let tooltipBox = document.getElementById('character-effect-tooltip-box');
        if (!tooltipBox) {
            tooltipBox = document.createElement('div');
            tooltipBox.id = 'character-effect-tooltip-box';
            tooltipBox.className = 'character-effect-tooltip-box';
            document.body.appendChild(tooltipBox);
        }
        tooltipBox.setAttribute('role', 'tooltip');
        tooltipBox.setAttribute('aria-hidden', 'true');
        tooltipBox.tabIndex = -1;
        let tooltipPinned = false;
        let activeTooltipTrigger = null;
        let suppressedFocusTrigger = null;

        function showTooltip(trigger, pinned = false) {
            const description = tooltipDictionary[trigger.dataset.keyword];
            if (!description) return;

            if (activeTooltipTrigger && activeTooltipTrigger !== trigger) {
                activeTooltipTrigger.setAttribute('aria-expanded', 'false');
            }
            tooltipPinned = pinned;
            activeTooltipTrigger = trigger;
            tooltipBox.textContent = description;
            tooltipBox.dataset.pinned = String(pinned);
            tooltipBox.setAttribute('role', pinned ? 'dialog' : 'tooltip');
            tooltipBox.tabIndex = pinned ? 0 : -1;
            tooltipBox.setAttribute('aria-label', `${trigger.dataset.keyword} 설명`);
            if (pinned) tooltipBox.setAttribute('aria-modal', 'false');
            else tooltipBox.removeAttribute('aria-modal');
            trigger.setAttribute('aria-expanded', String(pinned));
            tooltipBox.classList.add('visible');
            tooltipBox.setAttribute('aria-hidden', 'false');
            tooltipBox.scrollTop = 0;

            const rect = trigger.getBoundingClientRect();
            const boxRect = tooltipBox.getBoundingClientRect();
            const margin = 10;
            const gap = 7;
            const left = Math.min(
                window.innerWidth - boxRect.width / 2 - margin,
                Math.max(boxRect.width / 2 + margin, rect.left + rect.width / 2)
            );
            const placeBelow = window.innerHeight - rect.bottom >= boxRect.height + gap;
            const preferredTop = placeBelow
                ? rect.bottom + gap
                : rect.top - boxRect.height - gap;
            const top = Math.min(
                window.innerHeight - boxRect.height - margin,
                Math.max(margin, preferredTop)
            );

            tooltipBox.style.left = `${left}px`;
            tooltipBox.style.top = `${top}px`;
            if (pinned) requestAnimationFrame(() => tooltipBox.focus({ preventScroll: true }));
        }

        function hideTooltip(force = false, restoreFocus = false) {
            if (tooltipPinned && !force) return;
            const returnTarget = activeTooltipTrigger;
            tooltipPinned = false;
            tooltipBox.dataset.pinned = 'false';
            tooltipBox.classList.remove('visible');
            tooltipBox.setAttribute('role', 'tooltip');
            tooltipBox.tabIndex = -1;
            tooltipBox.removeAttribute('aria-modal');
            tooltipBox.setAttribute('aria-hidden', 'true');
            returnTarget?.setAttribute('aria-expanded', 'false');
            activeTooltipTrigger = null;
            if (restoreFocus && returnTarget?.isConnected) {
                suppressedFocusTrigger = returnTarget;
                returnTarget.focus({ preventScroll: true });
                setTimeout(() => {
                    if (suppressedFocusTrigger === returnTarget) suppressedFocusTrigger = null;
                }, 0);
            }
        }

        container.addEventListener('mouseover', event => {
            if (!window.matchMedia('(hover: hover)').matches) return;
            if (tooltipPinned) return;
            const trigger = event.target.closest('.tooltip-trigger');
            if (trigger && container.contains(trigger)) showTooltip(trigger);
        });
        container.addEventListener('mouseout', event => {
            if (!window.matchMedia('(hover: hover)').matches) return;
            if (
                event.target.closest('.tooltip-trigger') &&
                !tooltipBox.contains(event.relatedTarget)
            ) {
                hideTooltip();
            }
        });
        container.addEventListener('focusin', event => {
            const trigger = event.target.closest('.tooltip-trigger');
            if (!trigger || !container.contains(trigger) || tooltipPinned) return;
            if (suppressedFocusTrigger === trigger) {
                suppressedFocusTrigger = null;
                return;
            }
            showTooltip(trigger);
        });
        container.addEventListener('focusout', event => {
            if (
                event.target.closest('.tooltip-trigger') &&
                !tooltipBox.contains(event.relatedTarget)
            ) {
                hideTooltip();
            }
        });
        container.addEventListener('click', event => {
            const trigger = event.target.closest('.tooltip-trigger');
            if (trigger && container.contains(trigger)) {
                event.preventDefault();
                event.stopPropagation();
                if (tooltipPinned && activeTooltipTrigger === trigger) {
                    hideTooltip(true, true);
                    return;
                }
                showTooltip(trigger, true);
            } else {
                hideTooltip(true);
            }
        });
        document.addEventListener('click', event => {
            if (
                event.target.closest('.tooltip-trigger') ||
                tooltipBox.contains(event.target)
            ) {
                return;
            }
            hideTooltip(true);
        });
        tooltipBox.addEventListener('click', event => {
            event.stopPropagation();
        });
        tooltipBox.addEventListener('focusout', event => {
            if (!tooltipPinned || tooltipBox.contains(event.relatedTarget) || event.relatedTarget === activeTooltipTrigger) return;
            hideTooltip(true);
        });
        tooltipBox.addEventListener('mouseleave', () => hideTooltip());
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !tooltipBox.classList.contains('visible')) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            hideTooltip(true, true);
        });
        window.addEventListener('resize', () => hideTooltip(true));
        window.addEventListener('scroll', () => hideTooltip(), { passive: true });
    }

    function bindEvents(container) {
        if (container.dataset.characterEffectEventsBound === 'true') return;
        container.dataset.characterEffectEventsBound = 'true';

        function activatePanel(button, moveFocus = false) {
            if (!button || !container.contains(button)) return;
            const target = button.dataset.effectPanel;
            container.querySelectorAll('[data-effect-panel]').forEach(item => {
                const active = item === button;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', String(active));
                item.tabIndex = active ? 0 : -1;
            });
            container.querySelectorAll('[data-effect-content]').forEach(panel => {
                const active = panel.dataset.effectContent === target;
                panel.classList.toggle('active', active);
                panel.hidden = !active;
            });
            if (moveFocus) button.focus();
        }

        container.addEventListener('click', event => {
            const button = event.target.closest('[data-effect-panel]');
            if (!button || !container.contains(button)) return;
            activatePanel(button);
        });

        container.addEventListener('keydown', event => {
            const button = event.target.closest('[data-effect-panel]');
            if (!button || !container.contains(button)) return;
            const tabs = Array.from(container.querySelectorAll('[data-effect-panel]:not([hidden])'));
            const currentIndex = tabs.indexOf(button);
            if (currentIndex < 0) return;

            let nextIndex = null;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            if (nextIndex === null) return;

            event.preventDefault();
            activatePanel(tabs[nextIndex], true);
        });

        container.addEventListener('change', event => {
            if (!event.target.matches('.character-effect-level-select')) return;
            const scope = event.target.closest('.character-effect-variant, .character-effect-card');
            if (!scope) return;

            const description = scope.querySelector('.character-effect-description');
            if (description) {
                const levels = JSON.parse(event.target.dataset.levels || '[]');
                description.innerHTML = renderRichText(interpolateEffect(
                    description.dataset.effectTemplate,
                    levels,
                    event.target.value
                ));
            }
        });

        container.addEventListener('click', event => {
            if (event.target.closest('.character-effect-level-select')) {
                event.stopPropagation();
            }
        });
    }

    function render(container, character, characterName, tooltips = {}) {
        if (!container) return;
        tooltipDictionary = tooltips;
        if (!character) {
            container.innerHTML = renderEmpty('등록된 캐릭터 정보가 없습니다.');
            return;
        }

        const allSkills = character.skills || [];
        const enlightenTypes = new Set(['초월 폭발', '최종 법칙']);
        const skills = allSkills.filter(skill => !enlightenTypes.has(skill.type));
        const enlightenOrder = new Map([
            ['초월 폭발', 0],
            ['최종 법칙', 1]
        ]);
        const storedEnlighten = character.enlighten || character.breakthroughs || [];
        const enlighten = storedEnlighten.filter(item => !enlightenTypes.has(item.type));
        const enlightenSkills = [
            ...allSkills.filter(skill => enlightenTypes.has(skill.type)),
            ...storedEnlighten.filter(item => enlightenTypes.has(item.type))
        ]
            .sort((left, right) => enlightenOrder.get(left.type) - enlightenOrder.get(right.type));
        const traits = character.traits || [];

        container.innerHTML = `
            <div class="character-effects-switch" role="tablist" aria-label="스킬, 계령, 특성, 차원영상">
                <button type="button" id="character-effects-tab-skills" class="active" data-effect-panel="skills" role="tab" aria-selected="true" aria-controls="character-effects-panel-skills" tabindex="0">스킬</button>
                <button type="button" id="character-effects-tab-enlighten" data-effect-panel="enlighten" role="tab" aria-selected="false" aria-controls="character-effects-panel-enlighten" tabindex="-1">계령</button>
                <button type="button" id="character-effects-tab-traits" data-effect-panel="traits" role="tab" aria-selected="false" aria-controls="character-effects-panel-traits" tabindex="-1">특성</button>
                <button type="button" id="character-effects-tab-dimensional-image" data-effect-panel="dimensional-image" role="tab" aria-selected="false" aria-controls="character-effects-panel-dimensional-image" tabindex="-1">차원영상</button>
            </div>
            <div id="character-effects-panel-skills" class="character-effect-panel active" data-effect-content="skills" role="tabpanel" aria-labelledby="character-effects-tab-skills" tabindex="0">
                ${skills.length ? `
                    <div class="character-effect-list">
                        ${skills.map(renderSkill).join('')}
                    </div>
                ` : renderEmpty('등록된 스킬 정보가 없습니다.')}
                ${character.derivedCards?.length ? `
                    <section class="character-derived-section">
                        <h3>파생 카드</h3>
                        <div class="character-effect-list">
                            ${character.derivedCards.map((card, index) => renderSkill(card, index)).join('')}
                        </div>
                    </section>
                ` : ''}
            </div>
            <div id="character-effects-panel-enlighten" class="character-effect-panel" data-effect-content="enlighten" role="tabpanel" aria-labelledby="character-effects-tab-enlighten" tabindex="0" hidden>
                ${renderEnlighten(enlighten, enlightenSkills)}
            </div>
            <div id="character-effects-panel-traits" class="character-effect-panel" data-effect-content="traits" role="tabpanel" aria-labelledby="character-effects-tab-traits" tabindex="0" hidden>
                ${renderTraits(traits)}
            </div>
            <div id="character-effects-panel-dimensional-image" class="character-effect-panel" data-effect-content="dimensional-image" role="tabpanel" aria-labelledby="character-effects-tab-dimensional-image" tabindex="0" hidden>
                ${renderDimensionalImage(character.dimensionalImage, characterName)}
            </div>
        `;

        bindEvents(container);
        setupTooltips(container);
    }

    window.CharacterEffects = Object.freeze({ render });
})();
