(() => {
    const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
    let relics = [];
    let selectedChapter = 'all';
    let selectedTier = 'all';
    let researchLevel = 81;
    let openRelicId = null;
    let dialogTrigger = null;
    const selectedVariants = new Map();
    const tierOrder = ['silver', 'gold', 'cursed', 'blessed', 'sinful', 'other'];
    const otherTiers = new Set(['special', 'base', 'upgraded', 'pendulum', 'sinful']);

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    }

    function percent(value) {
        return number.format(Math.round(value * 100) / 100);
    }

    function parameterDisplay(parameter, depth) {
        if (parameter.kind === 'fixed') return { text: number.format(parameter.fixedValue), note: '' };
        const expression = String(parameter.expression || '');
        const variables = {
            'PlayerRole.GetStateLayer(71005)': 0,
            'PlayerRole.GetStateLayer(71006)': 0,
            'PlayerRole.GetStateLayer(129876)': 0,
            'PlayerRole.GetStateLayer(20020)': 0,
            'PlayerRole.basic_damage_per': 0,
            'Archivenotch()': 0
        };
        const value = window.ResearchDepth.evaluate(expression, depth, variables);
        if (value !== null) {
            const note = expression.includes('GetStateLayer(20020)') || expression.includes('PlayerRole.basic_damage_per')
                ? '표시 수치는 팀 피해 증폭 0%, 이번 전투 은열쇠 사용 0회 기준이며 실제 수치는 두 조건에 따라 증가합니다.'
                : expression.includes('GetStateLayer(71005)')
                ? '표시 수치는 전투 시작 기준이며, 전투 중 중독 증가 효과에 따라 함께 증가합니다.'
                : expression.includes('GetStateLayer(71006)')
                    ? '표시 수치는 전투 시작 기준이며, 전투 중 반격 증가 효과에 따라 함께 증가합니다.'
                    : '';
            return { text: number.format(value), note };
        }

        const missingHpRange = expression.match(/math\.ceil\((\d+(?:\.\d+)?)\+\(\(PlayerRole\.max_hp-PlayerRole\.hp\)\/PlayerRole\.max_hp\)\*(\d+(?:\.\d+)?)\)/);
        if (missingHpRange) {
            const minimum = Number(missingHpRange[1]);
            return { text: `${number.format(minimum)}~${number.format(minimum + Number(missingHpRange[2]))}`, note: '현재 HP가 낮을수록 수치가 증가합니다.' };
        }
        const maxHpWithDepth = expression.match(/PlayerRole\.max_hp\*(\d+(?:\.\d+)?)\*SpiritResearchDepthMultiplier/);
        if (maxHpWithDepth) {
            return { text: `최대 HP의 ${percent(Number(maxHpWithDepth[1]) * depth.spiritRate)}%`, note: '' };
        }
        const maxHp = expression.match(/PlayerRole\.max_hp\*(\d+(?:\.\d+)?)/);
        if (maxHp) return { text: `최대 HP의 ${percent(Number(maxHp[1]) * 100)}%`, note: '' };
        const stagePower = expression.match(/GetStagePower\(\)\*(\d+(?:\.\d+)?)/);
        if (stagePower) return { text: `스테이지 전투력의 ${percent(Number(stagePower[1]) * 100)}%`, note: '' };
        if (expression.includes('PlayerRole.GetStateLayer(3717)+1')) {
            return { text: '전투 진행에 따라 증가하는 수량', note: '' };
        }
        return { text: '확인되지 않은 수치', note: '게임 데이터만으로 확정할 수 없는 수치입니다.' };
    }

    function resolvedDescription(relic, depth) {
        const parameters = new Map((relic.parameters || []).map(parameter => [parameter.index, parameter]));
        const notes = new Set();
        const description = String(relic.battleDescription || relic.description || '효과 설명이 없습니다.')
            .replace(/\[(?:[A-Za-z]+:)?Arg\s?(\d+)\]/g, (match, index) => {
                const parameter = parameters.get(Number(index));
                if (!parameter) return '';
                const display = parameterDisplay(parameter, depth);
                if (display.note) notes.add(display.note);
                return `@@VALUE:${display.text}@@`;
            })
            .replace(/HP가 25%\(최대 HP의 25%\) 미만/g, 'HP가 최대 HP의 25% 미만')
            .replace(/(최대 HP의 [\d,.]+%) 포인트/g, '$1만큼')
            .replace(/한 번에 (최대 HP의 [\d,.]+%) 이상의 HP를/g, '한 번에 $1 이상을');
        return `${description}${notes.size ? ` (${[...notes].join(' ')})` : ''}`;
    }

    function filterTier(variant) {
        return otherTiers.has(variant.tier) ? 'other' : variant.tier;
    }

    function variantsFor(relic) {
        return relic.variants.filter(variant => (
            (selectedChapter === 'all' || variant.chapter === selectedChapter)
            && (selectedTier === 'all' || filterTier(variant) === selectedTier)
        ));
    }

    function renderTierFilters() {
        const labels = new Map([['other', '기타']]);
        relics.flatMap(relic => relic.variants).forEach(variant => {
            const tier = filterTier(variant);
            if (!labels.has(tier)) labels.set(tier, variant.tierLabel || variant.tier);
        });
        const tiers = [...labels.keys()].sort((left, right) => {
            const leftIndex = tierOrder.indexOf(left);
            const rightIndex = tierOrder.indexOf(right);
            return (leftIndex === -1 ? tierOrder.length : leftIndex) - (rightIndex === -1 ? tierOrder.length : rightIndex);
        });
        document.getElementById('relic-tier-filter').innerHTML = `<button type="button" data-tier-filter="all" aria-pressed="true">전체</button>${tiers.map(tier => `<button type="button" data-tier-filter="${escapeHtml(tier)}" aria-pressed="false">${escapeHtml(labels.get(tier))}</button>`).join('')}`;
    }

    function variantLabel(variant) {
        if (variant.source === 'pickman') {
            return `${variant.sourceLabel || '픽맨 생성'} · ${variant.tierLabel}`;
        }
        return variant.chapter === 'special'
            ? variant.tierLabel
            : `${variant.chapterLabel} · ${variant.tierLabel}`;
    }

    function relicImage(relic, size = 72) {
        return relic.image
            ? `<img src="${escapeHtml(relic.image)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`
            : '<span aria-hidden="true">◆</span>';
    }

    function selectorMarkup(relic, variants, selected) {
        const groupTotals = variants.reduce((totals, variant) => {
            const key = `${variant.chapter}:${variant.tier}`;
            totals.set(key, (totals.get(key) || 0) + 1);
            return totals;
        }, new Map());
        const labelCounts = new Map();
        const selectorOptions = variants.map(variant => {
            const key = `${variant.chapter}:${variant.tier}`;
            const baseLabel = variantLabel(variant);
            const detailedLabel = groupTotals.get(key) > 1 ? `${baseLabel} · ${variant.name}` : baseLabel;
            const duplicateIndex = labelCounts.get(detailedLabel) || 0;
            labelCounts.set(detailedLabel, duplicateIndex + 1);
            return { variant, label: duplicateIndex ? `${detailedLabel} ${duplicateIndex + 1}` : detailedLabel };
        });
        return variants.length > 8
            ? `<label class="catalog-relic-variant-select"><span>효과 변형</span><select data-relic-id="${relic.id}" data-tier="${escapeHtml(selected.tier)}">${selectorOptions.map(({ variant, label }) => `<option value="${variant.id}"${variant.id === selected.id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`
            : `<div class="catalog-relic-variants" role="group" aria-label="${escapeHtml(relic.name)} 효과 변형">${selectorOptions.map(({ variant, label }) => `<button type="button" data-relic-id="${relic.id}" data-variant-id="${variant.id}" data-tier="${escapeHtml(variant.tier)}" aria-pressed="${variant.id === selected.id}">${escapeHtml(label)}</button>`).join('')}</div>`;
    }

    function renderCard(relic) {
        return `<button type="button" class="catalog-relic-card" data-open-relic="${relic.id}" aria-haspopup="dialog" aria-label="${escapeHtml(relic.name)} 상세 정보 열기">
            <span class="catalog-relic-image">${relicImage(relic)}</span>
            <span class="catalog-relic-name">${escapeHtml(relic.name)}</span>
        </button>`;
    }

    function renderDialog(relic) {
        const variants = variantsFor(relic);
        if (!variants.length) return;
        const selected = variants.find(variant => variant.id === selectedVariants.get(relic.id)) || variants[0];
        selectedVariants.set(relic.id, selected.id);
        const depth = window.ResearchDepth.depthAt(researchLevel);
        const image = relic.image
            ? `<img src="${escapeHtml(relic.image)}" alt="" width="104" height="104" decoding="async">`
            : '<span aria-hidden="true">◆</span>';
        const resolved = resolvedDescription(selected, depth);
        const effect = (window.CharacterEffects?.renderRichText(resolved) || escapeHtml(resolved))
            .replace(/@@VALUE:([^@]+)@@/g, '<span class="dynamic-value">$1</span>');
        document.getElementById('relic-dialog-title').textContent = relic.name;
        document.getElementById('relic-dialog-image').innerHTML = image;
        document.getElementById('relic-dialog-variant-label').textContent = variantLabel(selected);
        document.getElementById('relic-dialog-variants').innerHTML = selectorMarkup(relic, variants, selected);
        document.getElementById('relic-dialog-effect').innerHTML = effect;
        window.CharacterEffects?.setupTooltips(document.getElementById('relic-detail-dialog'));
    }

    function openDialog(relicId) {
        const relic = relics.find(item => item.id === relicId);
        if (!relic) return;
        dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        openRelicId = relicId;
        renderDialog(relic);
        const dialog = document.getElementById('relic-detail-dialog');
        if (!dialog.open) dialog.showModal();
    }

    function refreshOpenDialog() {
        if (openRelicId === null) return;
        const relic = relics.find(item => item.id === openRelicId);
        if (!relic || !variantsFor(relic).length) {
            document.getElementById('relic-detail-dialog').close();
            return;
        }
        renderDialog(relic);
    }

    function render() {
        const query = document.getElementById('relic-search').value.trim().toLocaleLowerCase('ko');
        const filtered = relics.filter(relic => {
            const matchingVariants = variantsFor(relic);
            if (!matchingVariants.length) return false;
            if (!query) return true;
            return `${relic.name} ${matchingVariants.map(variant => `${variant.name} ${variant.description} ${variant.battleDescription}`).join(' ')}`.toLocaleLowerCase('ko').includes(query);
        });
        document.getElementById('relic-result-summary').textContent = `${number.format(filtered.length)}개의 유물을 표시하고 있습니다.`;
        document.getElementById('relic-list').innerHTML = filtered.length
            ? filtered.map(renderCard).join('')
            : '<div class="relic-empty">조건에 맞는 유물이 없습니다.</div>';
        refreshOpenDialog();
    }

    async function initialize() {
        try {
            const [catalogResponse, tooltipResponse] = await Promise.all([
                fetch(`data/relic_catalog.json?t=${Date.now()}`),
                fetch(`data/db_tooltips.json?t=${Date.now()}`).catch(() => null),
                window.ResearchDepth.load()
            ]);
            if (!catalogResponse.ok) throw new Error(`HTTP ${catalogResponse.status}`);
            relics = (await catalogResponse.json()).relics || [];
            renderTierFilters();
            if (tooltipResponse?.ok) window.CharacterEffects?.configureTooltips(await tooltipResponse.json());
            researchLevel = window.ResearchDepth.selectedLevel();
            const levelInput = document.getElementById('relic-research-level');
            levelInput.value = researchLevel;
            levelInput.addEventListener('input', () => {
                researchLevel = window.ResearchDepth.selectLevel(levelInput.value);
                levelInput.value = researchLevel;
                render();
            });
            document.getElementById('relic-search').addEventListener('input', render);
            document.getElementById('relic-chapter-filter').addEventListener('click', event => {
                const button = event.target.closest('[data-chapter]');
                if (!button) return;
                selectedChapter = button.dataset.chapter;
                document.querySelectorAll('[data-chapter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
                render();
            });
            document.getElementById('relic-tier-filter').addEventListener('click', event => {
                const button = event.target.closest('[data-tier-filter]');
                if (!button) return;
                selectedTier = button.dataset.tierFilter;
                document.querySelectorAll('[data-tier-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
                render();
            });
            document.getElementById('relic-list').addEventListener('click', event => {
                const button = event.target.closest('[data-open-relic]');
                if (!button) return;
                openDialog(Number(button.dataset.openRelic));
            });
            const dialog = document.getElementById('relic-detail-dialog');
            document.getElementById('relic-dialog-close').addEventListener('click', () => dialog.close());
            document.getElementById('relic-dialog-variants').addEventListener('click', event => {
                const button = event.target.closest('[data-variant-id]');
                if (!button) return;
                selectedVariants.set(Number(button.dataset.relicId), Number(button.dataset.variantId));
                refreshOpenDialog();
            });
            document.getElementById('relic-dialog-variants').addEventListener('change', event => {
                const select = event.target.closest('select[data-relic-id]');
                if (!select) return;
                selectedVariants.set(Number(select.dataset.relicId), Number(select.value));
                refreshOpenDialog();
            });
            dialog.addEventListener('click', event => {
                if (event.target !== dialog) return;
                const bounds = dialog.getBoundingClientRect();
                const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
                    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
                if (!inside) dialog.close();
            });
            dialog.addEventListener('keydown', event => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                dialog.close();
            });
            dialog.addEventListener('close', () => {
                openRelicId = null;
                if (dialogTrigger?.isConnected) dialogTrigger.focus();
                dialogTrigger = null;
            });
            render();
        } catch (error) {
            console.error('유물 정보 로드 실패:', error);
            document.getElementById('relic-list').innerHTML = '<div class="relic-empty">유물 정보를 불러오지 못했습니다.</div>';
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
