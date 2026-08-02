(function () {
    let tooltipDictionary = {};
    const keywordIconBasePath = 'images/keyword-icons/reference/';
    const keywordIcons = {
        '장벽': ['barrier.png', '#628da5'],
        '출혈': ['bleed.png', '#b75a64'],
        '반격': ['counter.png', '#628da5'],
        '창의': ['creativity.png', '#b75a64'],
        '죽음 저항': ['death-resistance.png', '#5e9177'],
        '배아': ['derived-card.png', '#c79374'],
        '몽인': ['dream-lure.png', '#aa71ae'],
        '공감': ['empathy.png', '#aa71ae'],
        '정신적 외상': ['empathy.png', '#aa71ae'],
        '두려움 고착': ['empathy.png', '#aa71ae'],
        '인내': ['endurance.png', '#c79374'],
        '침식': ['erosion.png', '#aa71ae'],
        '광상': ['fantasy.png', '#5e9177'],
        '운명 재단': ['fate-judgment.png', '#aa71ae'],
        '손상': ['fragile.png', '#aa71ae'],
        '경계': ['guard.png', '#628da5'],
        '강생 의식': ['incarnation-ritual.png', '#628da5'],
        '도취': ['intoxication.png', '#b75a64'],
        '약속': ['intoxication.png', '#b75a64'],
        '영혼 탈취': ['intoxication.png', '#b75a64'],
        '활염': ['living-flame.png', '#b75a64'],
        '연소': ['living-flame.png', '#b75a64'],
        '폭염': ['living-flame.png', '#b75a64'],
        '옛날 잔재': ['old-ember.png', '#b75a64'],
        '중독': ['poison.png', '#aa71ae'],
        '희생': ['sacrifice.png', '#628da5'],
        '죄의 낙인': ['sin-mark.png', '#aa71ae'],
        '강탈': ['steal.png', '#aa71ae'],
        '차원 이동': ['dimensional-travel.png', '#936394'],
        '특이점 프리즘': ['dimensional-travel.png', '#936394'],
        '특이점 도약': ['dimensional-travel.png', '#936394'],
        '특이점 신호': ['dimensional-travel.png', '#936394'],
        '직명': ['weave-fate.png', '#946495'],
        '우종': ['praise-seed.png', '#ffffff'],
        '지연 희생': ['delayed-sacrifice.png', '#c79374'],
        '잔해': ['remains.png', '#a1525a'],
        '부활': ['revival.png', '#5d9278'],
        '둔화': ['slow.png', '#966697'],
        '회귀': ['return.png', '#ffffff'],
        '음엔트로피': ['negative-entropy.png', '#ffffff'],
        '힘 감소': ['strength-down.png', '#976798'],
        '사냥': ['group-hunt.png', '#628da5'],
        '집단 사냥': ['group-hunt.png', '#628da5'],
        '힘': ['strength.png', '#5e9177'],
        '소용돌이 장전': ['vortex-loading.png', '#628da5'],
        '취약': ['vulnerability.png', '#b75a64'],
        '허약': ['weakness.png', '#aa71ae']
    };
    [
        '소모', '유지', '발견', '준비', '관통 피해', '촉수 피해', '영지 각성',
        '영감', '여파', '포식', '배아 융합', '초차원 공간',
        '명계', '공명', '인지 착란', '제의', '의식', '초거리', '허무', '워프', '은유'
    ].forEach(keyword => {
        keywordIcons[keyword] = ['special.png', '#c79374'];
    });

    keywordIcons['공허'] = ['void.png', '#ac9a76'];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderKeywordTrigger(keyword, tooltipKeyword = keyword) {
        const icon = keywordIcons[tooltipKeyword];
        const iconMarkup = icon
            ? `<img class="keyword-icon" src="${keywordIconBasePath}${icon[0]}" alt="" aria-hidden="true">`
            : '';
        const iconClass = icon ? ' keyword-iconized' : '';
        const colorStyle = icon ? ` style="--keyword-color:${icon[1]}"` : '';
        return `<strong class="tooltip-trigger${iconClass}" data-keyword="${escapeHtml(tooltipKeyword)}" tabindex="0"${colorStyle}>${iconMarkup}<span>${escapeHtml(keyword)}</span></strong>`;
    }

    function renderCost(cost) {
        if (!cost) return '';
        return `<span class="character-effect-cost">${escapeHtml(cost.type)} ${escapeHtml(cost.value)}</span>`;
    }

    function renderRichText(value) {
        const text = String(value ?? '');
        const tooltipAliases = {
            '고정 중독': '중독',
            '고정 반격': '반격',
            '고정 힘': '힘'
        };
        const activeAliases = Object.fromEntries(
            Object.entries(tooltipAliases).filter(([, tooltipKeyword]) => tooltipDictionary[tooltipKeyword])
        );
        const keywords = [...Object.keys(tooltipDictionary), ...Object.keys(activeAliases)]
            .sort((left, right) => right.length - left.length || left.localeCompare(right, 'ko'));
        const keywordPattern = keywords.length
            ? new RegExp(keywords.map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
            : null;

        function contextualTooltipKeyword(keyword, followingText) {
            if (keyword === '힘' && /^\s*(?:을|이)\s*[^,.!?\n]{0,120}?감소/.test(followingText)) {
                return '힘 감소';
            }
            return activeAliases[keyword] || keyword;
        }

        function isPlainUsage(keyword, precedingText, followingText) {
            if (keyword === '소모') {
                const isCardKeyword = /^\s*(?:$|[,.]|가\s*부여된|와\s*공허(?:가|\s+가)?\s*부여된)/.test(followingText);
                if (!isCardKeyword || followingText.startsWith('할 때마다')) return true;
                if (/(?:행동력|산출력|광기|은열쇠)\s*$/.test(precedingText)) return true;
            }
            if (keyword === '고유' && /(?:팀|파티)\s*$/.test(precedingText)) return true;
            if (keyword === '침식' && (/침식\s*$/.test(precedingText) || /(?:과 감염|하는 색채|\s*·\s*로탄)/.test(followingText))) return true;
            if (keyword === '침식' && /잠재의식의\s*$/.test(precedingText)) return true;
            if (keyword === '경계' && /^(?:를 베는 검|\s+너머의 목소리)/.test(followingText)) return true;
            if (keyword === '준비' && /출전\s*$/.test(precedingText) && /^\s*완료/.test(followingText)) return true;
            if (keyword === '허무' && /^의 종언/.test(followingText)) return true;
            if (keyword === '소멸' && /마땅한 고통의\s*$/.test(precedingText)) return true;
            if (keyword === '회귀' && (/고대 근원으로의\s*$/.test(precedingText) || /^\s*·\s*라모나/.test(followingText))) return true;
            if (keyword === '힘' && (/(?:해연의|동료의|보호의)\s*$/.test(precedingText) || /^이 곧 정의/.test(followingText))) return true;
            if (keyword === '반격' && /깊은 잠의\s*$/.test(precedingText)) return true;
            if (keyword === '장벽' && /부정형\s*$/.test(precedingText)) return true;
            if (keyword === '잔해' && /부패된\s*$/.test(precedingText)) return true;
            if (keyword === '사냥' && (/(?:끝없는|영혼)\s*$/.test(precedingText) || /^(?:의 건트|\s+선언)/.test(followingText))) return true;
            if (keyword === '메아리' && /(?:과거의|잠결의|원초의|호숫가의)\s*$/.test(precedingText)) return true;
            return keyword === '광상' && (followingText.startsWith('곡') || followingText.startsWith('의 시편'));
        }

        function numericSuffix(followingText) {
            return followingText.match(/^\d+/)?.[0] || '';
        }

        function hasNumericSuffix(followingText) {
            return /^\d/.test(followingText);
        }

        function renderBareText(segment) {
            if (!keywordPattern) return escapeHtml(segment);

            const parts = [];
            let lastIndex = 0;
            segment.replace(keywordPattern, (keyword, offset) => {
                const before = segment[offset - 1] || '';
                const after = segment[offset + keyword.length] || '';
                const followingText = segment.slice(offset + keyword.length);
                if (/[가-힣A-Za-z0-9]/.test(before) || (/[A-Za-z0-9]/.test(after) && !hasNumericSuffix(followingText))) return keyword;
                if (isPlainUsage(keyword, segment.slice(0, offset), followingText)) return keyword;

                const precedingSegment = segment.slice(lastIndex, offset);
                const matchedPrefix = precedingSegment.match(/(임시|영구|고정)\s*$/);
                const prefixMatch = matchedPrefix?.[1] === '임시' && keyword === '특이점 프리즘'
                    ? null
                    : matchedPrefix;
                const suffix = numericSuffix(followingText);
                const displayKeyword = `${prefixMatch ? `${prefixMatch[1]} ` : ''}${keyword}${suffix}`;
                const plainTextEnd = prefixMatch ? precedingSegment.length - prefixMatch[0].length : precedingSegment.length;
                parts.push(escapeHtml(precedingSegment.slice(0, plainTextEnd)));
                parts.push(renderKeywordTrigger(displayKeyword, contextualTooltipKeyword(keyword, followingText)));
                lastIndex = offset + keyword.length + suffix.length;
                return keyword;
            });
            parts.push(escapeHtml(segment.slice(lastIndex)));
            return parts.join('');
        }

        const parts = [];
        let lastIndex = 0;
        text.replace(/\[([^\]]+)\]/g, (match, keyword, offset) => {
            parts.push(renderBareText(text.slice(lastIndex, offset)));
            const followingText = text.slice(offset + match.length);
            const numericBaseKeyword = keywords.find(baseKeyword =>
                keyword.startsWith(baseKeyword) && /^\s*\d+$/.test(keyword.slice(baseKeyword.length))
            );
            const numericKeywordSuffix = numericBaseKeyword ? keyword.slice(numericBaseKeyword.length) : '';
            const plainUsageKeyword = numericBaseKeyword || keyword;
            if (isPlainUsage(plainUsageKeyword, text.slice(0, offset), followingText)) {
                parts.push(escapeHtml(keyword));
            } else if (numericBaseKeyword) {
                const tooltipKeyword = activeAliases[numericBaseKeyword] || numericBaseKeyword;
                parts.push(/^\d/.test(numericKeywordSuffix)
                    ? renderKeywordTrigger(keyword, tooltipKeyword)
                    : `${renderKeywordTrigger(numericBaseKeyword, tooltipKeyword)}${escapeHtml(numericKeywordSuffix)}`);
            } else {
                const prefixMatch = keyword.match(/^(임시|영구|고정)\s+(.+)$/);
                const baseKeyword = prefixMatch?.[2];
                const tooltipKeyword = activeAliases[keyword] || (baseKeyword && tooltipDictionary[baseKeyword] ? baseKeyword : keyword);
                const keepTemporaryPlain = prefixMatch?.[1] === '임시' && baseKeyword === '특이점 프리즘';
                parts.push(tooltipDictionary[tooltipKeyword]
                    ? keepTemporaryPlain
                        ? `${escapeHtml(`${prefixMatch[1]} `)}${renderKeywordTrigger(baseKeyword, tooltipKeyword)}`
                        : renderKeywordTrigger(keyword, contextualTooltipKeyword(tooltipKeyword, followingText))
                    : `<strong>${escapeHtml(keyword)}</strong>`);
            }
            lastIndex = offset + match.length;
            return match;
        });
        parts.push(renderBareText(text.slice(lastIndex)));

        const lines = parts.join('').split('\n');
        let html = '';
        let listOpen = false;

        lines.forEach((line, index) => {
            const listItem = line.match(/^-\s+(.*)$/);
            if (listItem) {
                if (!listOpen) {
                    html += '<ul class="character-effect-rich-list">';
                    listOpen = true;
                }
                html += `<li>${listItem[1]}</li>`;
                return;
            }

            if (listOpen) {
                html += '</ul>';
                listOpen = false;
            }
            html += line;
            if (index < lines.length - 1 && !lines[index + 1].match(/^-\s+/)) html += '<br>';
        });

        if (listOpen) html += '</ul>';
        return html;
    }

    function getDefaultLevel(levels) {
        return levels?.length ? levels[levels.length - 1].level : '';
    }

    function getBreakthroughVariant(effect, selectedBreakthrough = 0) {
        const variants = (effect.breakthroughs || [])
            .filter(variant => Number(variant.stage) <= Number(selectedBreakthrough))
            .sort((left, right) => Number(left.stage) - Number(right.stage));

        return variants.reduce((current, variant) => {
            const nextEffect = variant.effect || current.effect;
            const mergedLevels = variant.levels
                ? variant.levels.map((level, index) => ({
                    ...(current.levels?.find(currentLevel => String(currentLevel.level) === String(level.level)) || current.levels?.[index] || {}),
                    ...level
                }))
                : current.levels;
            return {
                ...current,
                ...variant,
                effect: variant.append ? `${nextEffect} ${variant.append}` : nextEffect,
                levels: mergedLevels
            };
        }, effect);
    }

    function renderLevelSelect(levels, selectedLevel = getDefaultLevel(levels)) {
        if (!levels?.length) return '';

        const options = levels.map(level => `
            <option value="${level.level}"${String(level.level) === String(selectedLevel) ? ' selected' : ''}>Lv.${level.level}</option>
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

        text = text.replace(/\*n%?|(?<!\*)\b[lmn]%?/g, match => {
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
            .replace(/[^\S\r\n]+/g, ' ')
            .replace(/ *\n */g, '\n')
            .replace(/\s+([,.])/g, '$1')
            .trim();
    }

    function renderEffectBody(effect, selectedBreakthrough = 0) {
        const displayedEffect = getBreakthroughVariant(effect, selectedBreakthrough);
        const levels = displayedEffect.levels || effect.levels;
        const defaultLevel = getDefaultLevel(levels);
        const interpolatedEffect = sanitizeDisplayedEffect(
            interpolateEffect(displayedEffect.effect, levels, defaultLevel)
        );

        return `
            <div class="character-effect-description" data-effect-template="${escapeHtml(displayedEffect.effect)}">${renderRichText(interpolatedEffect)}</div>
        `;
    }

    function renderBreakthroughBadges(effect, selectedBreakthrough = 0) {
        return (effect.breakthroughs || []).map(variant => `
            <button type="button" class="character-effect-breakthrough-badge${Number(variant.stage) <= Number(selectedBreakthrough) ? ' active' : ''}"
                data-breakthrough-stage="${escapeHtml(variant.stage)}" aria-pressed="${Number(variant.stage) <= Number(selectedBreakthrough)}"
                aria-label="${escapeHtml(variant.stage)}돌 효과 보기">${escapeHtml(variant.stage)}돌</button>
        `).join('');
    }

    function renderHeaderControls(effect, selectedBreakthrough = 0) {
        const displayedEffect = getBreakthroughVariant(effect, selectedBreakthrough);
        return `
            <span class="character-effect-header-controls">
                ${renderBreakthroughBadges(effect, selectedBreakthrough)}
                ${renderCost(effect.cost)}
                ${renderLevelSelect(displayedEffect.levels || effect.levels)}
            </span>
        `;
    }

    function renderSkill(skill, index, selectedBreakthrough = 0) {
        let body;
        if (skill.variants?.length) {
            body = `
                <div class="character-effect-variants">
                    ${skill.variants.map(variant => `
                        <section class="character-effect-variant" data-selected-breakthrough="${selectedBreakthrough}"
                            data-effect-definition="${escapeHtml(JSON.stringify(variant))}">
                            <div class="character-effect-variant-header">
                                ${variant.condition ? `<span class="character-effect-condition">${escapeHtml(variant.condition)}</span>` : ''}
                                <strong>${escapeHtml(variant.name)}</strong>
                                ${renderHeaderControls(variant, selectedBreakthrough)}
                            </div>
                            ${renderEffectBody(variant, selectedBreakthrough)}
                        </section>
                    `).join('')}
                </div>
            `;
        } else {
            body = renderEffectBody(skill, selectedBreakthrough);
        }

        return `
            <details class="character-effect-card" data-effect-name="${escapeHtml(skill.name)}"
                data-selected-breakthrough="${selectedBreakthrough}" data-effect-definition="${escapeHtml(JSON.stringify(skill))}" open>
                <summary>
                    <span class="character-effect-type">${escapeHtml(skill.type)}</span>
                    <strong>${escapeHtml(skill.name)}</strong>
                    ${renderHeaderControls(skill, selectedBreakthrough)}
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
                                <div class="character-effect-rich-text">${renderRichText(sanitizeDisplayedEffect(
                                    interpolateEffect(item.effect, item.levels, getDefaultLevel(item.levels))
                                ))}</div>
                            </article>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
            ${skills.length ? `
                <section class="character-enlighten-section">
                    <div class="character-effect-list">
                        ${skills.map((skill, index) => renderSkill(skill, index)).join('')}
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
                        <div class="character-effect-rich-text">${renderRichText(sanitizeDisplayedEffect(item.effect))}</div>
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
                <div class="character-effect-rich-text">${renderRichText(sanitizeDisplayedEffect(item.effect))}</div>
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
            tooltipBox.setAttribute('role', 'tooltip');
            document.body.appendChild(tooltipBox);
        }
        let tooltipPinned = false;

        function showTooltip(trigger, pinned = false) {
            const description = tooltipDictionary[trigger.dataset.keyword];
            if (!description) return;

            tooltipPinned = pinned;
            tooltipBox.replaceChildren();
            const lines = String(description).split('\n');
            const hasListItems = lines.some(line => /^\s*-\s+/.test(line));

            if (hasListItems) {
                const list = document.createElement('ul');
                list.className = 'character-effect-tooltip-list';
                let parentItem = null;

                lines.forEach(line => {
                    const itemMatch = line.match(/^(\s*)-\s+(.+)$/);
                    if (!itemMatch) return;

                    const [, indentation, content] = itemMatch;
                    const item = document.createElement('li');
                    item.textContent = content;

                    if (indentation.length && parentItem) {
                        let nestedList = parentItem.querySelector(':scope > ul');
                        if (!nestedList) {
                            nestedList = document.createElement('ul');
                            parentItem.appendChild(nestedList);
                        }
                        nestedList.appendChild(item);
                    } else {
                        list.appendChild(item);
                        parentItem = item;
                    }
                });

                tooltipBox.appendChild(list);
            } else {
                String(description).split(/\n{2,}/).forEach(paragraph => {
                    const paragraphElement = document.createElement('p');
                    paragraphElement.textContent = paragraph;
                    tooltipBox.appendChild(paragraphElement);
                });
            }
            tooltipBox.classList.add('visible');

            const rect = trigger.getBoundingClientRect();
            const margin = 10;
            const gap = 7;
            const belowSpace = window.innerHeight - rect.bottom - gap - margin;
            const aboveSpace = rect.top - gap - margin;
            // Keep tooltips below their trigger whenever there is a usable reading area.
            const placeBelow = belowSpace >= 180 || belowSpace >= aboveSpace;
            const availableHeight = placeBelow ? belowSpace : aboveSpace;
            tooltipBox.style.maxHeight = `${Math.max(0, availableHeight)}px`;

            const boxRect = tooltipBox.getBoundingClientRect();
            const left = Math.min(
                window.innerWidth - boxRect.width / 2 - margin,
                Math.max(boxRect.width / 2 + margin, rect.left + rect.width / 2)
            );
            const preferredTop = placeBelow
                ? rect.bottom + gap
                : rect.top - boxRect.height - gap;
            const top = Math.min(
                window.innerHeight - boxRect.height - margin,
                Math.max(margin, preferredTop)
            );

            tooltipBox.style.left = `${left}px`;
            tooltipBox.style.top = `${top}px`;
        }

        function hideTooltip(force = false) {
            if (tooltipPinned && !force) return;
            tooltipPinned = false;
            tooltipBox.classList.remove('visible');
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
            if (trigger && container.contains(trigger)) showTooltip(trigger);
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
                event.stopPropagation();
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
        tooltipBox.addEventListener('mouseleave', () => hideTooltip());
        window.addEventListener('resize', () => hideTooltip(true));
        window.addEventListener('scroll', () => hideTooltip(), { passive: true });
    }

    function bindEvents(container) {
        if (container.dataset.characterEffectEventsBound === 'true') return;
        container.dataset.characterEffectEventsBound = 'true';

        container.addEventListener('click', event => {
            const breakthroughButton = event.target.closest('[data-breakthrough-stage]');
            if (breakthroughButton && container.contains(breakthroughButton)) {
                event.preventDefault();
                event.stopPropagation();
                const clickedStage = Number(breakthroughButton.dataset.breakthroughStage);
                const scope = breakthroughButton.closest('.character-effect-variant, .character-effect-card');
                if (!scope) return;
                const effect = JSON.parse(scope.dataset.effectDefinition || '{}');
                const currentStage = Number(scope.dataset.selectedBreakthrough || 0);
                const nextStage = currentStage === clickedStage ? 0 : clickedStage;
                const displayedEffect = getBreakthroughVariant(effect, nextStage);
                const levels = displayedEffect.levels || effect.levels || [];
                const levelSelect = scope.querySelector('.character-effect-level-select');
                const requestedLevel = levelSelect?.value || getDefaultLevel(levels);
                const selectedLevel = levels.some(level => String(level.level) === String(requestedLevel))
                    ? requestedLevel
                    : getDefaultLevel(levels);
                const description = scope.querySelector('.character-effect-description');

                scope.dataset.selectedBreakthrough = String(nextStage);
                scope.querySelectorAll('.character-effect-breakthrough-badge').forEach(button => {
                    const active = Number(button.dataset.breakthroughStage) <= nextStage;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-pressed', String(active));
                });
                if (levelSelect) {
                    levelSelect.innerHTML = levels.map(level => `
                        <option value="${escapeHtml(level.level)}"${String(level.level) === String(selectedLevel) ? ' selected' : ''}>Lv.${escapeHtml(level.level)}</option>
                    `).join('');
                    levelSelect.dataset.levels = JSON.stringify(levels);
                }
                if (description) {
                    description.dataset.effectTemplate = displayedEffect.effect;
                    description.innerHTML = renderRichText(sanitizeDisplayedEffect(
                        interpolateEffect(displayedEffect.effect, levels, selectedLevel)
                    ));
                }
                return;
            }

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

    function classifyCharacterEffects(character) {
        const allSkills = character.skills || [];
        const enlightenTypes = new Set(['초월 폭발', '최종 법칙']);
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
        const skills = [
            ...allSkills.filter(skill => !enlightenTypes.has(skill.type)),
            ...enlightenSkills.filter(skill => skill.type === '초월 폭발')
        ];

        return { skills, enlighten, enlightenSkills };
    }

    function render(container, character, characterName, tooltips = {}) {
        if (!container) return;
        tooltipDictionary = tooltips;
        if (!character) {
            container.innerHTML = renderEmpty('등록된 캐릭터 정보가 없습니다.');
            return;
        }

        const { skills, enlighten, enlightenSkills } = classifyCharacterEffects(character);
        const traits = character.traits || [];

        container.innerHTML = `
            <div class="character-effects-switch" role="tablist" aria-label="스킬, 계령, 특성, 차원영상">
                <button type="button" class="active" data-effect-panel="skills" role="tab" aria-selected="true">스킬</button>
                <button type="button" data-effect-panel="enlighten" role="tab" aria-selected="false">계령</button>
                <button type="button" data-effect-panel="traits" role="tab" aria-selected="false">특성</button>
                <button type="button" data-effect-panel="dimensional-image" role="tab" aria-selected="false">차원영상</button>
            </div>
            <div class="character-effect-panel active" data-effect-content="skills" role="tabpanel">
                ${skills.length ? `
                    <div class="character-effect-list">
                        ${skills.map((skill, index) => renderSkill(skill, index)).join('')}
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
            <div class="character-effect-panel" data-effect-content="enlighten" role="tabpanel">
                ${renderEnlighten(enlighten, enlightenSkills)}
            </div>
            <div class="character-effect-panel" data-effect-content="traits" role="tabpanel">
                ${renderTraits(traits)}
            </div>
            <div class="character-effect-panel" data-effect-content="dimensional-image" role="tabpanel">
                ${renderDimensionalImage(character.dimensionalImage, characterName)}
            </div>
        `;

        bindEvents(container);
        setupTooltips(container);
    }

    window.CharacterEffects = {
        configureTooltips(tooltips = {}) {
            tooltipDictionary = tooltips;
        },
        renderRichText(value, tooltips) {
            if (tooltips) tooltipDictionary = tooltips;
            return renderRichText(value);
        },
        renderKeyword: renderKeywordTrigger,
        setupTooltips,
        classifyCharacterEffects,
        getBreakthroughVariant,
        interpolateEffect,
        sanitizeDisplayedEffect,
        renderBreakthroughBadges,
        render
    };
})();
