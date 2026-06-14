(function() {
    const ROMANS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
    const SHARE_IMAGE_TYPE = 'image/jpeg';
    const SHARE_IMAGE_QUALITY = 0.88;
    const AVERAGE_RUNS = 300;
    const OPTIONS = [
        { id: 'critRate', name: '크리티컬 확률', step: 0.2, unit: '%' },
        { id: 'critDamage', name: '크리티컬 피해', step: 0.3, unit: '%' },
        { id: 'domainMastery', name: '영역 숙련', step: 0.5, unit: '' },
        { id: 'damageAmp', name: '피해 증폭', step: 0.2, unit: '%' },
        { id: 'madnessRegen', name: '광기 회복', step: 0.1, unit: '' },
        { id: 'silverCharge', name: '은열쇠 충전', step: 0.3, unit: '' },
        { id: 'blackSealDrop', name: '검은 인장 드롭율', step: 0.15, unit: '%' },
        { id: 'deathResist', name: '죽음 저항', step: 0.7, unit: '%' }
    ];
    const MAIN_OPTIONS = [
        ['critRate', 'critDamage', 'madnessRegen', 'silverCharge'],
        ['critRate', 'critDamage', 'domainMastery', 'blackSealDrop'],
        ['critRate', 'critDamage', 'damageAmp', 'deathResist'],
        ['domainMastery', 'madnessRegen', 'silverCharge', 'blackSealDrop'],
        ['damageAmp', 'madnessRegen', 'silverCharge', 'deathResist'],
        ['domainMastery', 'damageAmp', 'blackSealDrop', 'deathResist']
    ];
    const MAIN_COMPLETION = [3, 3.4, 3.7, 4.1, 4.5, 4.9, 5.3, 5.6, 6, 6.4, 6.8, 7.2, 7.5];
    const SUB_COMPLETION = {
        3: 1.1, 4: 1.5, 5: 1.9, 6: 2.3, 7: 2.6, 8: 3, 9: 3.4, 10: 3.8, 11: 4.1,
        12: 4.5, 13: 4.9, 14: 5.3, 15: 5.7, 16: 6, 17: 6.4, 18: 6.8, 19: 7.2,
        20: 7.6, 21: 7.9, 22: 8.3, 23: 8.7, 24: 9.1
    };
    const optionById = Object.fromEntries(OPTIONS.map(option => [option.id, option]));
    const els = {};
    const state = {
        contracts: [],
        selectedContract: null,
        selectedPart: 0,
        mode: 'manual',
        manualPreview: null,
        result: null,
        totals: createEmptyTotals(),
        targetParts: [0, 1, 2, 3, 4, 5],
        parts: Array.from({ length: 6 }, (_, index) => createDefaultPart(index))
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        cacheElements();
        bindEvents();
        await loadContracts();
        renderAll();
    }

    function cacheElements() {
        [
            'contract-grid', 'selected-contract-name', 'left-part-grid', 'right-part-grid', 'manual-panel', 'target-panel',
            'manual-part-title', 'manual-completion', 'manual-main-option', 'manual-substats',
            'manual-cost', 'manual-result', 'manual-reroll-btn', 'manual-apply-btn',
            'manual-focus-image', 'manual-focus-name', 'manual-current-result',
            'target-scope-buttons', 'target-lock-strategy', 'target-lock-cost', 'target-parts',
            'run-target-btn', 'run-average-btn', 'result-summary', 'result-status',
            'copy-result-btn', 'preview-result-btn', 'reset-sim-btn', 'preview-modal',
            'preview-image', 'close-preview-modal', 'summary-rerolls', 'summary-gold',
            'summary-seals', 'summary-fragments', 'summary-quills'
        ].forEach(id => {
            els[toCamel(id)] = document.getElementById(id);
        });
        els.modeTabs = Array.from(document.querySelectorAll('[data-mode-tab]'));
    }

    function bindEvents() {
        els.modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                state.mode = tab.dataset.modeTab;
                renderMode();
            });
        });
        els.manualMainOption.addEventListener('change', () => {
            getSelectedPart().mainOption = els.manualMainOption.value;
            renderParts();
        });
        els.manualRerollBtn.addEventListener('click', manualReroll);
        els.manualApplyBtn.addEventListener('click', applyManualPreview);
        els.runTargetBtn.addEventListener('click', runTargetSimulation);
        els.runAverageBtn.addEventListener('click', runAverageSimulation);
        els.resetSimBtn.addEventListener('click', resetSimulation);
        els.copyResultBtn.addEventListener('click', copyResultImage);
        els.previewResultBtn.addEventListener('click', previewResultImage);
        els.closePreviewModal.addEventListener('click', closePreviewModal);
        els.previewModal.addEventListener('click', event => {
            if (event.target === els.previewModal) closePreviewModal();
        });
    }

    async function loadContracts() {
        const response = await fetch('data/covenant_list.json');
        if (!response.ok) throw new Error('비밀계약 데이터를 불러오지 못했습니다.');
        state.contracts = await response.json();
        state.selectedContract = state.contracts[0];
    }

    function renderAll() {
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderTargetParts();
        renderTotals();
        showResultMessage('전사 시뮬레이션 결과가 여기에 표시됩니다.');
    }

    function renderTargetScopeButtons() {
        els.targetScopeButtons.innerHTML = ROMANS.map((roman, index) => `
            <button type="button" class="target-scope-btn ${state.targetParts.includes(index) ? 'active' : ''}" data-target-scope-index="${index}">
                ${roman}
            </button>
        `).join('');
        els.targetScopeButtons.querySelectorAll('[data-target-scope-index]').forEach(button => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.targetScopeIndex);
                if (state.targetParts.includes(index)) {
                    if (state.targetParts.length === 1) {
                        setStatus('대상 파츠는 하나 이상 선택해야 합니다.', 'error');
                        return;
                    }
                    state.targetParts = state.targetParts.filter(partIndex => partIndex !== index);
                } else {
                    state.targetParts = [...state.targetParts, index].sort((a, b) => a - b);
                }
                renderTargetScopeButtons();
                renderTargetParts();
            });
        });
    }

    function renderContract() {
        if (!state.selectedContract) return;
        els.selectedContractName.textContent = state.selectedContract.korean_name;
        if (els.manualFocusImage) {
            els.manualFocusImage.src = state.selectedContract.image_path;
            els.manualFocusImage.alt = state.selectedContract.korean_name;
        }
        els.contractGrid.innerHTML = state.contracts.map(contract => `
            <button type="button" class="contract-card ${contract.english_name === state.selectedContract.english_name ? 'active' : ''}" data-contract="${escapeHtml(contract.english_name)}">
                <img src="${escapeHtml(contract.image_path)}" alt="">
                <span class="contract-card-name">${escapeHtml(contract.korean_name)}</span>
            </button>
        `).join('');
        els.contractGrid.querySelectorAll('[data-contract]').forEach(button => {
            button.addEventListener('click', () => {
                state.selectedContract = state.contracts.find(contract => contract.english_name === button.dataset.contract);
                renderContract();
                showResultMessage('계약을 변경했습니다.');
            });
        });
    }

    function renderParts() {
        const renderButtons = indexes => indexes.map(index => {
            const part = state.parts[index];
            return `
            <button type="button" class="part-button ${index === state.selectedPart ? 'active' : ''} ${part.lastTouched ? 'has-result' : ''}" data-part-index="${index}">
                <span class="part-roman">${ROMANS[index]}</span>
                <span class="part-main">${escapeHtml(getOptionName(part.mainOption))}</span>
            </button>
        `;
        }).join('');
        els.leftPartGrid.innerHTML = renderButtons([3, 4, 5]);
        els.rightPartGrid.innerHTML = renderButtons([0, 1, 2]);
        document.querySelectorAll('[data-part-index]').forEach(button => {
            button.addEventListener('click', () => {
                state.selectedPart = Number(button.dataset.partIndex);
                state.manualPreview = null;
                renderParts();
                renderManual();
            });
        });
        renderManualMainOption();
    }

    function renderMode() {
        els.modeTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.modeTab === state.mode));
        els.manualPanel.classList.toggle('hidden', state.mode !== 'manual');
        els.targetPanel.classList.toggle('hidden', state.mode !== 'target');
        if (state.mode === 'manual') renderManual();
        if (state.mode === 'target') renderTargetParts();
    }

    function renderManual() {
        const part = getSelectedPart();
        els.manualPartTitle.textContent = getContractPartName(state.selectedPart);
        els.manualFocusName.textContent = getContractPartName(state.selectedPart);
        if (state.selectedContract) {
            els.manualFocusImage.src = state.selectedContract.image_path;
            els.manualFocusImage.alt = state.selectedContract.korean_name;
        }
        els.manualCompletion.textContent = `${formatNumber(getPartCompletion(part), 1)}%`;
        renderManualMainOption();
        els.manualSubstats.innerHTML = part.substats.map((substat, index) => `
            <div class="substat-row" data-substat-index="${index}">
                <button type="button" class="lock-toggle ${substat.locked ? 'active' : ''}" aria-label="${index + 1}번 부옵 잠금">${substat.locked ? '🔒' : '🔓'}</button>
                <select class="sim-select substat-option">
                    ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === substat.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                </select>
                <select class="sim-select substat-level">
                    ${range(1, 8).map(level => `<option value="${level}" ${level === substat.level ? 'selected' : ''}>Lv ${level}</option>`).join('')}
                </select>
            </div>
        `).join('');
        els.manualSubstats.querySelectorAll('[data-substat-index]').forEach(row => {
            const index = Number(row.dataset.substatIndex);
            row.querySelector('.lock-toggle').addEventListener('click', () => toggleManualLock(index));
            row.querySelector('.substat-option').addEventListener('change', event => {
                part.substats[index].option = event.target.value;
                state.manualPreview = null;
                renderManual();
            });
            row.querySelector('.substat-level').addEventListener('change', event => {
                part.substats[index].level = Number(event.target.value);
                state.manualPreview = null;
                renderManual();
            });
        });
        els.manualCost.textContent = formatCost(getRerollCost(countLocked(part.substats), getManualLockCostMode()));
        els.manualCurrentResult.innerHTML = part.substats.map(renderStatLine).join('');
        renderManualPreview();
    }

    function renderManualMainOption() {
        if (!els.manualMainOption) return;
        const part = getSelectedPart();
        els.manualMainOption.innerHTML = MAIN_OPTIONS[state.selectedPart]
            .map(optionId => `<option value="${optionId}">${escapeHtml(getOptionName(optionId))}</option>`)
            .join('');
        els.manualMainOption.value = part.mainOption;
    }

    function renderManualPreview() {
        if (!state.manualPreview) {
            els.manualResult.className = 'result-list empty-result';
            els.manualResult.textContent = '전사 결과가 여기에 표시됩니다.';
            els.manualApplyBtn.disabled = true;
            return;
        }
        els.manualResult.className = 'result-list';
        els.manualResult.innerHTML = state.manualPreview.map(renderStatLine).join('');
        els.manualApplyBtn.disabled = false;
    }

    function renderTargetParts() {
        const indexes = getTargetPartIndexes();
        els.targetParts.innerHTML = indexes.map(index => {
            const part = state.parts[index];
            return `
                <section class="target-part-card" data-target-part="${index}">
                    <div class="target-part-header">
                        <div class="target-part-title">${escapeHtml(getContractPartName(index))}</div>
                        <div class="contract-picker">
                            <label class="field-label">주옵</label>
                            <select class="sim-select target-main-option">
                                ${MAIN_OPTIONS[index].map(optionId => `<option value="${optionId}" ${optionId === part.mainOption ? 'selected' : ''}>${escapeHtml(getOptionName(optionId))}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="target-goals">
                        ${range(0, 2).map(goalIndex => {
                            const goal = part.goals[goalIndex];
                            return `
                                <div class="target-goal-row" data-goal-index="${goalIndex}">
                                    <select class="sim-select target-goal-option">
                                        ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === goal.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                                    </select>
                                    <select class="sim-select target-goal-level">
                                        ${range(1, 8).map(level => `<option value="${level}" ${level === goal.level ? 'selected' : ''}>Lv ${level} 이상</option>`).join('')}
                                    </select>
                                    <input type="checkbox" class="goal-enabled" ${goal.enabled ? 'checked' : ''} aria-label="목표 사용">
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }).join('');
        els.targetParts.querySelectorAll('[data-target-part]').forEach(card => bindTargetCard(card));
    }

    function bindTargetCard(card) {
        const partIndex = Number(card.dataset.targetPart);
        const part = state.parts[partIndex];
        card.querySelector('.target-main-option').addEventListener('change', event => {
            part.mainOption = event.target.value;
            renderParts();
        });
        card.querySelectorAll('[data-goal-index]').forEach(row => {
            const goalIndex = Number(row.dataset.goalIndex);
            row.querySelector('.target-goal-option').addEventListener('change', event => {
                part.goals[goalIndex].option = event.target.value;
            });
            row.querySelector('.target-goal-level').addEventListener('change', event => {
                part.goals[goalIndex].level = Number(event.target.value);
            });
            row.querySelector('.goal-enabled').addEventListener('change', event => {
                part.goals[goalIndex].enabled = event.target.checked;
            });
        });
    }

    function manualReroll() {
        const part = getSelectedPart();
        const cost = getRerollCost(countLocked(part.substats), getManualLockCostMode());
        state.manualPreview = rerollSubstats(part.substats);
        addTotals(state.totals, cost);
        state.totals.rerolls += 1;
        state.result = {
            type: 'manual',
            contract: state.selectedContract.korean_name,
            part: getContractPartName(state.selectedPart),
            attempts: state.totals.rerolls,
            cost: { ...state.totals },
            finalSubstats: cloneSubstats(state.manualPreview),
            allParts: getAllPartSnapshots(state.selectedPart, state.manualPreview)
        };
        renderManual();
        renderTotals();
        renderResultSummary('전사 결과가 생성되었습니다. 교체 버튼으로 현재 부옵에 반영할 수 있습니다.');
    }

    function applyManualPreview() {
        if (!state.manualPreview) return;
        getSelectedPart().substats = cloneSubstats(state.manualPreview);
        getSelectedPart().lastTouched = true;
        if (state.result && state.result.type === 'manual') {
            state.result.finalSubstats = cloneSubstats(state.manualPreview);
            state.result.allParts = getAllPartSnapshots();
        }
        state.manualPreview = null;
        renderManual();
        renderResultSummary('전사 결과를 현재 부옵으로 교체했습니다.');
    }

    function runTargetSimulation() {
        const config = getTargetConfig();
        if (!config.targets.length) {
            setStatus('목표로 사용할 부옵을 하나 이상 선택해주세요.', 'error');
            return;
        }
        const result = simulateUntilTargets(config);
        state.result = result;
        addTotals(state.totals, result.cost);
        state.totals.rerolls += result.attempts;
        result.partResults.forEach(partResult => {
            state.parts[partResult.partIndex].substats = cloneSubstats(partResult.finalSubstats);
            state.parts[partResult.partIndex].lastTouched = true;
        });
        renderManual();
        renderParts();
        renderTargetParts();
        renderTotals();
        renderResultSummary('목표까지 시뮬레이션을 완료했습니다.');
    }

    function runAverageSimulation() {
        const config = getTargetConfig();
        if (!config.targets.length) {
            setStatus('목표로 사용할 부옵을 하나 이상 선택해주세요.', 'error');
            return;
        }
        const totalCost = createEmptyTotals();
        let totalAttempts = 0;
        for (let i = 0; i < AVERAGE_RUNS; i += 1) {
            const result = simulateUntilTargets(config);
            addTotals(totalCost, result.cost);
            totalAttempts += result.attempts;
        }
        state.result = {
            type: 'average',
            contract: state.selectedContract.korean_name,
            scope: config.scopeLabel,
            runs: AVERAGE_RUNS,
            attempts: totalAttempts / AVERAGE_RUNS,
            cost: divideTotals(totalCost, AVERAGE_RUNS)
        };
        renderResultSummary('몬테카를로 방식으로 여러 번 반복한 평균값입니다.');
    }

    function simulateUntilTargets(config) {
        const totalCost = createEmptyTotals();
        const partResults = [];
        let attempts = 0;
        config.targetsByPart.forEach(targetPart => {
            let current = cloneSubstats(state.parts[targetPart.partIndex].substats);
            while (!matchesGoals(current, targetPart.goals)) {
                const locked = getStrategyLockedIndexes(current, targetPart.goals, config.lockStrategy);
                const cost = getRerollCost(locked.length, config.lockCostMode);
                current = rerollSubstats(current.map((substat, index) => ({ ...substat, locked: locked.includes(index) })));
                addTotals(totalCost, cost);
                attempts += 1;
            }
            partResults.push({
                partIndex: targetPart.partIndex,
                goals: targetPart.goals,
                finalSubstats: current.map(substat => ({ ...substat, locked: false }))
            });
        });
        return {
            type: 'target',
            contract: state.selectedContract.korean_name,
            scope: config.scopeLabel,
            attempts,
            cost: totalCost,
            partResults
        };
    }

    function getTargetConfig() {
        const targetsByPart = getTargetPartIndexes().map(partIndex => {
            const goals = state.parts[partIndex].goals
                .filter(goal => goal.enabled)
                .map(goal => ({ option: goal.option, level: goal.level }));
            return { partIndex, goals };
        }).filter(item => item.goals.length > 0);
        return {
            targetsByPart,
            targets: targetsByPart.flatMap(item => item.goals),
            scopeLabel: state.targetParts.length === 6 ? '전체' : state.targetParts.map(index => ROMANS[index]).join(', '),
            lockStrategy: els.targetLockStrategy.value,
            lockCostMode: els.targetLockCost.value
        };
    }

    function getTargetPartIndexes() {
        return state.targetParts;
    }

    function getStrategyLockedIndexes(substats, goals, strategy) {
        if (strategy === 'none') return [];
        const matches = [];
        substats.forEach((substat, index) => {
            if (goals.some(goal => substat.option === goal.option && substat.level >= goal.level)) {
                matches.push(index);
            }
        });
        return matches.slice(0, strategy === 'one' ? 1 : 2);
    }

    function matchesGoals(substats, goals) {
        const used = new Set();
        return goals.every(goal => {
            const foundIndex = substats.findIndex((substat, index) => {
                return !used.has(index) && substat.option === goal.option && substat.level >= goal.level;
            });
            if (foundIndex === -1) return false;
            used.add(foundIndex);
            return true;
        });
    }

    function rerollSubstats(substats) {
        return substats.map(substat => {
            if (substat.locked) return { ...substat };
            return { option: randomOptionId(), level: randomInt(1, 8), locked: false };
        });
    }

    function toggleManualLock(index) {
        const substats = getSelectedPart().substats;
        if (!substats[index].locked && countLocked(substats) >= 2) {
            setStatus('부옵 잠금은 최대 2개까지 가능합니다.', 'error');
            return;
        }
        substats[index].locked = !substats[index].locked;
        state.manualPreview = null;
        renderManual();
    }

    function renderTotals() {
        els.summaryRerolls.textContent = formatInteger(state.totals.rerolls);
        els.summaryGold.textContent = formatInteger(state.totals.gold);
        els.summarySeals.textContent = formatInteger(state.totals.seals);
        els.summaryFragments.textContent = formatInteger(state.totals.fragments);
        els.summaryQuills.textContent = formatInteger(state.totals.quills);
    }

    function renderResultSummary(message) {
        if (!state.result) {
            els.resultSummary.innerHTML = '<p class="muted-text">전사 시뮬레이션 결과가 여기에 표시됩니다.</p>';
            setStatus(message || '', '');
            return;
        }
        const result = state.result;
        const cost = result.cost;
        const attempts = result.type === 'average' ? formatNumber(result.attempts, 1) : formatInteger(result.attempts);
        els.resultSummary.innerHTML = `
            ${message ? `<p class="muted-text">${escapeHtml(message)}</p>` : ''}
            <div class="summary-grid">
                <div class="summary-item"><span class="summary-label">계약</span><span class="summary-value">${escapeHtml(result.contract)}</span></div>
                <div class="summary-item"><span class="summary-label">대상</span><span class="summary-value">${escapeHtml(result.part || result.scope || '-')}</span></div>
                <div class="summary-item"><span class="summary-label">전사</span><span class="summary-value">${attempts}회</span></div>
                <div class="summary-item"><span class="summary-label">금권</span><span class="summary-value">${formatNumber(cost.gold, 1)}</span></div>
                <div class="summary-item"><span class="summary-label">천면 인장</span><span class="summary-value">${formatNumber(cost.seals, 1)}</span></div>
                <div class="summary-item"><span class="summary-label">잔본</span><span class="summary-value">${formatNumber(cost.fragments, 1)}</span></div>
                <div class="summary-item"><span class="summary-label">깃펜</span><span class="summary-value">${formatNumber(cost.quills, 1)}</span></div>
            </div>
            ${renderResultDetails(result)}
        `;
        setStatus('', '');
    }

    function renderResultDetails(result) {
        if (result.type === 'manual') {
            return renderAllPartResults(result.allParts || getAllPartSnapshots());
        }
        if (result.type === 'target') {
            return renderAllPartResults(getAllPartSnapshots());
        }
        return '';
    }

    function renderAllPartResults(parts) {
        return `<div class="part-result-grid">${parts.map(part => `
            <div class="part-result-card">
                <h4>${escapeHtml(getContractPartName(part.partIndex))}</h4>
                <div class="part-main-label">${escapeHtml(getOptionName(part.mainOption))}</div>
                ${part.substats.map(renderStatLine).join('')}
            </div>
        `).join('')}</div>`;
    }

    function showResultMessage(message) {
        renderResultSummary(message);
    }

    function setStatus(message, type) {
        els.resultStatus.textContent = message;
        els.resultStatus.className = `copy-status ${type || ''}`.trim();
    }

    async function copyResultImage() {
        if (!state.result) {
            setStatus('복사할 결과가 없습니다.', 'error');
            return;
        }
        try {
            if (!navigator.clipboard || !window.ClipboardItem) throw new Error('이미지 클립보드 미지원');
            const canvas = await createResultCanvas();
            const imageType = getClipboardImageType();
            const blob = await createImageBlob(canvas, imageType);
            await navigator.clipboard.write([new ClipboardItem({ [imageType]: blob })]);
            setStatus('결과 이미지를 클립보드에 복사했습니다.', 'success');
        } catch (error) {
            console.error('결과 이미지 복사 실패:', error);
            setStatus('이미지 복사에 실패했습니다. 클립보드 권한을 확인해주세요.', 'error');
        }
    }

    async function previewResultImage() {
        if (!state.result) {
            setStatus('미리볼 결과가 없습니다.', 'error');
            return;
        }
        try {
            const canvas = await createResultCanvas();
            const blob = await createImageBlob(canvas, SHARE_IMAGE_TYPE);
            closePreviewModal();
            const url = URL.createObjectURL(blob);
            els.previewImage.src = url;
            els.previewImage.dataset.objectUrl = url;
            els.previewModal.classList.add('show');
        } catch (error) {
            console.error('결과 이미지 미리보기 실패:', error);
            setStatus('미리보기를 만들지 못했습니다.', 'error');
        }
    }

    function closePreviewModal() {
        const url = els.previewImage.dataset.objectUrl;
        if (url) URL.revokeObjectURL(url);
        delete els.previewImage.dataset.objectUrl;
        els.previewImage.removeAttribute('src');
        els.previewModal.classList.remove('show');
    }

    async function createResultCanvas() {
        const result = state.result;
        const detailLines = getCanvasDetailLines(result);
        const width = 920;
        const padding = 30;
        const height = 250 + detailLines.length * 28;
        const canvas = document.createElement('canvas');
        const scale = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#202024';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#2a2a2e';
        roundRect(ctx, padding, padding, width - padding * 2, height - padding * 2, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '800 28px Pretendard, sans-serif';
        ctx.fillText('비밀계약 시뮬레이터 결과', padding + 24, padding + 44);
        ctx.fillStyle = '#ffc107';
        ctx.font = '700 22px Pretendard, sans-serif';
        ctx.fillText(result.contract, padding + 24, padding + 82);
        try {
            const image = await loadImage(state.selectedContract.image_path);
            ctx.drawImage(image, width - padding - 172, padding + 18, 138, 107);
        } catch (error) {
            ctx.fillStyle = '#38383e';
            roundRect(ctx, width - padding - 172, padding + 18, 138, 107, 6);
            ctx.fill();
            ctx.fillStyle = '#888';
            ctx.font = '700 14px Pretendard, sans-serif';
            ctx.fillText('이미지 없음', width - padding - 142, padding + 76);
        }
        drawMetric(ctx, padding + 24, padding + 116, '대상', result.part || result.scope || '-');
        drawMetric(ctx, padding + 190, padding + 116, '전사', `${formatNumber(result.attempts, result.type === 'average' ? 1 : 0)}회`);
        drawMetric(ctx, padding + 356, padding + 116, '금권', formatNumber(result.cost.gold, 1));
        drawMetric(ctx, padding + 522, padding + 116, '천면 인장', formatNumber(result.cost.seals, 1));
        let y = padding + 172;
        ctx.fillStyle = '#ccc';
        ctx.font = '700 17px Pretendard, sans-serif';
        detailLines.forEach(line => {
            ctx.fillText(line, padding + 24, y);
            y += 28;
        });
        return canvas;
    }

    function getCanvasDetailLines(result) {
        const lines = [`잔본 ${formatNumber(result.cost.fragments, 1)} / 깃펜 ${formatNumber(result.cost.quills, 1)}`];
        if (result.type === 'average') {
            lines.push(`평균 비용 계산: ${result.runs}회 반복`);
            return lines;
        }
        if (result.type === 'manual') {
            result.finalSubstats.forEach((substat, index) => lines.push(`${index + 1}. ${getSubstatText(substat)}`));
            return lines;
        }
        const parts = result.type === 'target' ? getAllPartSnapshots() : (result.allParts || getAllPartSnapshots());
        parts.forEach(part => lines.push(`${getContractPartName(part.partIndex)}: ${part.substats.map(getSubstatText).join(' / ')}`));
        return lines;
    }

    function drawMetric(ctx, x, y, label, value) {
        ctx.fillStyle = '#888';
        ctx.font = '700 13px Pretendard, sans-serif';
        ctx.fillText(label, x, y);
        ctx.fillStyle = '#fff';
        ctx.font = '800 21px Pretendard, sans-serif';
        ctx.fillText(value, x, y + 28);
    }

    function resetSimulation() {
        state.parts = Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
        state.selectedPart = 0;
        state.targetParts = [0, 1, 2, 3, 4, 5];
        state.manualPreview = null;
        state.result = null;
        state.totals = createEmptyTotals();
        renderParts();
        renderTargetScopeButtons();
        renderManual();
        renderTargetParts();
        renderTotals();
        showResultMessage('초기화했습니다.');
    }

    function createDefaultPart(index) {
        return {
            mainOption: MAIN_OPTIONS[index][0],
            mainLevel: 0,
            substats: [
                { option: 'critRate', level: 1, locked: false },
                { option: 'critDamage', level: 1, locked: false },
                { option: 'domainMastery', level: 1, locked: false }
            ],
            goals: [
                { option: 'critRate', level: 4, enabled: true },
                { option: 'critDamage', level: 4, enabled: false },
                { option: 'damageAmp', level: 4, enabled: false }
            ],
            lastTouched: false
        };
    }

    function getAllPartSnapshots(previewPartIndex, previewSubstats) {
        return state.parts.map((part, index) => ({
            partIndex: index,
            mainOption: part.mainOption,
            substats: cloneSubstats(index === previewPartIndex && previewSubstats ? previewSubstats : part.substats)
        }));
    }

    function getRerollCost(lockedCount, lockCostMode) {
        const cost = { gold: 7500, seals: 3, fragments: 0, quills: 0 };
        if (lockedCount === 1) {
            if (lockCostMode === 'quill') cost.quills = 1;
            else cost.fragments = 20;
        }
        if (lockedCount >= 2) cost.quills = 10;
        return cost;
    }

    function getPartCompletion(part) {
        const totalLevel = part.substats.reduce((sum, substat) => sum + substat.level, 0);
        return MAIN_COMPLETION[part.mainLevel] + SUB_COMPLETION[totalLevel];
    }

    function getSelectedPart() {
        return state.parts[state.selectedPart];
    }

    function getManualLockCostMode() {
        const checked = document.querySelector('input[name="manual-lock-cost"]:checked');
        return checked ? checked.value : 'fragment';
    }

    function countLocked(substats) {
        return substats.filter(substat => substat.locked).length;
    }

    function randomOptionId() {
        return OPTIONS[randomInt(0, OPTIONS.length - 1)].id;
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function createEmptyTotals() {
        return { rerolls: 0, gold: 0, seals: 0, fragments: 0, quills: 0 };
    }

    function addTotals(target, source) {
        target.gold += source.gold || 0;
        target.seals += source.seals || 0;
        target.fragments += source.fragments || 0;
        target.quills += source.quills || 0;
    }

    function divideTotals(totals, divisor) {
        return { gold: totals.gold / divisor, seals: totals.seals / divisor, fragments: totals.fragments / divisor, quills: totals.quills / divisor };
    }

    function cloneSubstats(substats) {
        return substats.map(substat => ({ ...substat }));
    }

    function getOptionName(optionId) {
        return optionById[optionId] ? optionById[optionId].name : optionId;
    }

    function getContractPartName(partIndex) {
        const contractName = state.selectedContract ? state.selectedContract.korean_name : '비밀계약';
        return `${contractName} ${ROMANS[partIndex]}`;
    }

    function getSubstatText(substat) {
        const option = optionById[substat.option];
        return `${option.name} ${formatNumber(option.step * substat.level, 2)}${option.unit} (Lv ${substat.level})`;
    }

    function renderStatLine(substat) {
        const optionName = getOptionName(substat.option);
        return `<div class="stat-line"><span class="stat-name">${escapeHtml(optionName)}</span><span class="stat-value">${escapeHtml(getSubstatText(substat).replace(`${optionName} `, ''))}</span></div>`;
    }

    function formatCost(cost) {
        const parts = [`금권 ${formatInteger(cost.gold)}`, `천면 인장 ${formatInteger(cost.seals)}`];
        if (cost.fragments) parts.push(`잔본 ${formatInteger(cost.fragments)}`);
        if (cost.quills) parts.push(`깃펜 ${formatInteger(cost.quills)}`);
        return parts.join(' / ');
    }

    function formatInteger(value) {
        return Math.round(value).toLocaleString('ko-KR');
    }

    function formatNumber(value, digits) {
        if (Number.isInteger(value)) return value.toLocaleString('ko-KR');
        return Number(value).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
    }

    function range(start, end) {
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function getClipboardImageType() {
        if (typeof ClipboardItem.supports === 'function' && ClipboardItem.supports(SHARE_IMAGE_TYPE)) return SHARE_IMAGE_TYPE;
        return 'image/png';
    }

    function createImageBlob(canvas, type) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 변환 실패')), type, type === SHARE_IMAGE_TYPE ? SHARE_IMAGE_QUALITY : undefined);
        });
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = src;
        });
    }

    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function toCamel(id) {
        return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
})();
