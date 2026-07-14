(function() {
    const STORAGE_KEY = 'morimens_covenant_simulator_state_v1';
    const PRESET_STORAGE_KEY = 'morimens_covenant_simulator_presets_v1';
    const TARGET_PRESET_STORAGE_KEY = 'morimens_covenant_target_presets_v1';
    const ROMANS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
    const TARGET_PART_ORDER = [3, 0, 4, 1, 5, 2];
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
        manualResult: null,
        targetResult: null,
        totals: createEmptyTotals(),
        presets: [],
        targetPresets: [],
        pendingContractName: '',
        hasUnsavedPresetChanges: false,
        isSimulating: false,
        targetParts: [0, 1, 2, 3, 4, 5],
        parts: Array.from({ length: 6 }, (_, index) => createDefaultPart(index)),
        targetSimParts: Array.from({ length: 6 }, (_, index) => createDefaultPart(index))
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
            'manual-part-title', 'manual-before-completion', 'manual-after-completion', 'manual-main-option', 'manual-main-level',
            'manual-cost', 'manual-status', 'manual-result', 'manual-reroll-btn', 'manual-apply-btn',
            'manual-focus-image', 'manual-focus-name', 'manual-total-completion', 'manual-current-result',
            'target-scope-buttons', 'target-lock-cost', 'target-current-parts', 'target-parts',
            'run-target-btn', 'result-summary', 'result-status',
            'target-preset-name-input', 'target-preset-select', 'save-target-preset-btn', 'load-target-preset-btn', 'delete-target-preset-btn',
            'preset-name-input', 'preset-select', 'save-preset-btn', 'load-preset-btn', 'delete-preset-btn',
            'contract-change-modal', 'confirm-contract-change-btn', 'cancel-contract-change-btn',
            'reset-sim-btn'
        ].forEach(id => {
            els[toCamel(id)] = document.getElementById(id);
        });
        els.contractChangeMessage = document.querySelector('.contract-change-message');
        els.modeTabs = Array.from(document.querySelectorAll('[data-mode-tab]'));
    }

    function bindEvents() {
        els.modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                state.mode = tab.dataset.modeTab;
                renderMode();
                saveCurrentState();
            });
        });
        els.manualMainOption.addEventListener('change', () => {
            getSelectedPart().mainOption = els.manualMainOption.value;
            renderParts();
            renderManual();
            markSettingsChanged();
        });
        els.manualMainLevel.addEventListener('change', () => {
            getSelectedPart().mainLevel = Number(els.manualMainLevel.value);
            renderParts();
            renderManual();
            markSettingsChanged();
        });
        document.querySelectorAll('input[name="manual-lock-cost"]').forEach(input => {
            input.addEventListener('change', () => {
                renderManual();
                markSettingsChanged();
            });
        });
        els.targetLockCost.addEventListener('change', markTargetSettingsChanged);
        els.manualRerollBtn.addEventListener('click', manualReroll);
        els.manualApplyBtn.addEventListener('click', applyManualPreview);
        els.runTargetBtn.addEventListener('click', runTargetSimulation);
        els.savePresetBtn.addEventListener('click', savePreset);
        els.loadPresetBtn.addEventListener('click', loadSelectedPreset);
        els.deletePresetBtn.addEventListener('click', deleteSelectedPreset);
        els.saveTargetPresetBtn.addEventListener('click', saveTargetPreset);
        els.loadTargetPresetBtn.addEventListener('click', loadSelectedTargetPreset);
        els.deleteTargetPresetBtn.addEventListener('click', deleteSelectedTargetPreset);
        els.confirmContractChangeBtn.addEventListener('click', confirmContractChange);
        els.cancelContractChangeBtn.addEventListener('click', closeContractChangeModal);
        els.contractChangeModal.addEventListener('click', event => {
            if (event.target === els.contractChangeModal) closeContractChangeModal();
        });
        els.resetSimBtn.addEventListener('click', resetSimulation);
    }

    async function loadContracts() {
        const response = await fetch('data/covenant_list.json');
        if (!response.ok) throw new Error('비밀계약 데이터를 불러오지 못했습니다.');
        state.contracts = await response.json();
        state.selectedContract = state.contracts[0];
        loadPresets();
        loadTargetPresets();
        loadSavedState();
    }

    function renderAll() {
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderTargetCurrentParts();
        renderTargetParts();
        renderPresetControls();
        renderTargetPresetControls();
        renderTotals();
        showResultMessage('전사 시뮬레이션 결과가 여기에 표시됩니다.');
    }

    function renderTargetScopeButtons() {
        els.targetScopeButtons.innerHTML = TARGET_PART_ORDER.map(index => `
            <button type="button" class="target-scope-btn ${state.targetParts.includes(index) ? 'active' : ''}" data-target-scope-index="${index}">
                ${ROMANS[index]}
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
                renderTargetCurrentParts();
                renderTargetParts();
                markTargetSettingsChanged();
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
        if (els.manualFocusName) {
            els.manualFocusName.textContent = state.selectedContract.korean_name;
        }
        els.contractGrid.innerHTML = state.contracts.map(contract => `
            <button type="button" class="contract-card ${contract.english_name === state.selectedContract.english_name ? 'active' : ''}" data-contract="${escapeHtml(contract.english_name)}">
                <img src="${escapeHtml(contract.image_path)}" alt="">
                <span class="contract-card-name">${escapeHtml(contract.korean_name)}</span>
            </button>
        `).join('');
        els.contractGrid.querySelectorAll('[data-contract]').forEach(button => {
            button.addEventListener('click', () => {
                requestContractChange(button.dataset.contract);
            });
        });
    }

    function requestContractChange(contractName) {
        if (!state.selectedContract || contractName === state.selectedContract.english_name) return;
        const nextContract = state.contracts.find(contract => contract.english_name === contractName);
        if (!nextContract) return;
        state.pendingContractName = contractName;
        if (shouldConfirmContractChange()) {
            openContractChangeModal();
            return;
        }
        applyContractChange(contractName);
    }

    function shouldConfirmContractChange() {
        return state.hasUnsavedPresetChanges || hasConfiguredSettings();
    }

    function hasConfiguredSettings() {
        const defaultTargetParts = [0, 1, 2, 3, 4, 5];
        const targetPartsChanged = state.targetParts.length !== defaultTargetParts.length
            || state.targetParts.some((partIndex, index) => partIndex !== defaultTargetParts[index]);
        const manualLockChanged = getManualLockCostMode() !== 'fragment';
        const targetLockChanged = els.targetLockCost && els.targetLockCost.value !== 'fragment';
        return targetPartsChanged
            || manualLockChanged
            || targetLockChanged
            || state.parts.some((part, index) => isPartConfigured(part, index))
            || state.targetSimParts.some((part, index) => isPartConfigured(part, index));
    }

    function isPartConfigured(part, index) {
        const base = createDefaultPart(index);
        if (part.mainOption !== base.mainOption || part.mainLevel !== base.mainLevel || part.lastTouched) return true;
        const substatsChanged = part.substats.some((substat, substatIndex) => {
            const baseSubstat = base.substats[substatIndex];
            return substat.option !== baseSubstat.option
                || substat.level !== baseSubstat.level
                || substat.locked !== baseSubstat.locked;
        });
        if (substatsChanged) return true;
        return part.goals.some((goal, goalIndex) => {
            const baseGoal = base.goals[goalIndex];
            return goal.option !== baseGoal.option
                || goal.level !== baseGoal.level
                || goal.enabled !== baseGoal.enabled;
        });
    }

    function openContractChangeModal() {
        if (els.contractChangeMessage) {
            els.contractChangeMessage.textContent = state.hasUnsavedPresetChanges
                ? '현재 세팅이 프리셋으로 저장되지 않았습니다. 저장하지 않고 비밀계약을 변경할까요?'
                : '현재 세팅이 초기화됩니다. 비밀계약을 변경할까요?';
        }
        els.contractChangeModal.classList.add('show');
    }

    function closeContractChangeModal() {
        state.pendingContractName = '';
        els.contractChangeModal.classList.remove('show');
    }

    function confirmContractChange() {
        const contractName = state.pendingContractName;
        closeContractChangeModal();
        if (contractName) applyContractChange(contractName);
    }

    function applyContractChange(contractName) {
        const nextContract = state.contracts.find(contract => contract.english_name === contractName);
        if (!nextContract) return;
        state.selectedContract = nextContract;
        resetSettingsForContract();
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderTargetParts();
        renderTotals();
        saveCurrentState();
        showResultMessage('비밀계약을 변경하고 세팅을 초기화했습니다.');
    }

    function resetSettingsForContract() {
        state.selectedPart = 0;
        state.mode = 'manual';
        state.targetParts = [0, 1, 2, 3, 4, 5];
        state.parts = Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
        state.targetSimParts = Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
        state.manualPreview = null;
        state.manualResult = null;
        state.targetResult = null;
        state.totals = createEmptyTotals();
        state.hasUnsavedPresetChanges = false;
        const manualLockInput = document.querySelector('input[name="manual-lock-cost"][value="fragment"]');
        if (manualLockInput) manualLockInput.checked = true;
        if (els.targetLockCost) els.targetLockCost.value = 'fragment';
    }

    function renderParts() {
        const renderButtons = indexes => indexes.map(index => {
            const part = state.parts[index];
            return `
            <button type="button" class="part-button ${index === state.selectedPart ? 'active' : ''} ${part.lastTouched ? 'has-result' : ''}" data-part-index="${index}">
                <span class="part-roman">${ROMANS[index]}</span>
                <span class="part-main part-completion">완성도 ${formatNumber(getPartCompletion(part), 1)}%</span>
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
        els.modeTabs.forEach(tab => {
            const isActive = tab.dataset.modeTab === state.mode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            applyModeTabVisualState(tab, isActive);
        });
        els.manualPanel.classList.toggle('hidden', state.mode !== 'manual');
        els.targetPanel.classList.toggle('hidden', state.mode !== 'target');
        if (state.mode === 'manual') renderManual();
        if (state.mode === 'target') {
            renderTargetCurrentParts();
            renderTargetParts();
        }
        renderResultSummary();
    }

    function applyModeTabVisualState(tab, isActive) {
        tab.style.setProperty('background-color', isActive ? '#2a2a2e' : '#3f3f46', 'important');
        tab.style.setProperty('border-color', isActive ? '#55555e' : '#444', 'important');
        tab.style.setProperty('border-bottom-color', isActive ? '#2a2a2e' : '#444', 'important');
        tab.style.setProperty('color', isActive ? '#ffc107' : '#9a9a9f', 'important');
        tab.style.setProperty('font-weight', isActive ? '800' : '600', 'important');
    }

    function renderManual() {
        const part = getSelectedPart();
        els.manualPartTitle.textContent = getContractPartName(state.selectedPart);
        els.manualFocusName.textContent = state.selectedContract ? state.selectedContract.korean_name : '비밀계약';
        els.manualTotalCompletion.textContent = `전체 완성도 ${formatTotalCompletion(getTotalCompletion())}%`;
        if (state.selectedContract) {
            els.manualFocusImage.src = state.selectedContract.image_path;
            els.manualFocusImage.alt = state.selectedContract.korean_name;
        }
        els.manualBeforeCompletion.textContent = `${formatNumber(getPartCompletion(part), 1)}%`;
        els.manualAfterCompletion.textContent = state.manualPreview
            ? `${formatNumber(getPartCompletion(part, state.manualPreview), 1)}%`
            : '-';
        renderManualMainOption();
        els.manualCost.textContent = formatCost(getRerollCost(countLocked(part.substats), getManualLockCostMode()));
        renderManualCurrentResult(part);
        renderManualPreview();
        renderResultSummary();
    }

    function renderManualCurrentResult(part) {
        els.manualCurrentResult.innerHTML = part.substats.map((substat, index) => `
            <div class="substat-row current-stat-row" data-substat-index="${index}">
                <button type="button" class="lock-toggle ${substat.locked ? 'active' : ''}" aria-label="${index + 1}번 부옵 잠금">${substat.locked ? '🔒' : '🔓'}</button>
                <select class="sim-select substat-option">
                    ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === substat.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                </select>
                <select class="sim-select substat-level">
                    ${range(1, 8).map(level => `<option value="${level}" ${level === substat.level ? 'selected' : ''}>Lv ${level}</option>`).join('')}
                </select>
            </div>
        `).join('');
        els.manualCurrentResult.querySelectorAll('[data-substat-index]').forEach(row => {
            const index = Number(row.dataset.substatIndex);
            row.querySelector('.lock-toggle').addEventListener('click', () => toggleManualLock(index));
            row.querySelector('.substat-option').addEventListener('change', event => {
                part.substats[index].option = event.target.value;
                state.manualPreview = null;
                renderParts();
                renderManual();
                markSettingsChanged();
            });
            row.querySelector('.substat-level').addEventListener('change', event => {
                part.substats[index].level = Number(event.target.value);
                state.manualPreview = null;
                renderParts();
                renderManual();
                markSettingsChanged();
            });
        });
    }

    function renderManualMainOption() {
        if (!els.manualMainOption) return;
        const part = getSelectedPart();
        els.manualMainOption.innerHTML = MAIN_OPTIONS[state.selectedPart]
            .map(optionId => `<option value="${optionId}">${escapeHtml(getOptionName(optionId))}</option>`)
            .join('');
        els.manualMainOption.value = part.mainOption;
        if (els.manualMainLevel) {
            els.manualMainLevel.innerHTML = MAIN_COMPLETION
                .map((_, level) => `<option value="${level}">+ ${level}</option>`)
                .join('');
            els.manualMainLevel.value = String(part.mainLevel);
        }
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
            const part = state.targetSimParts[index];
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

    function renderTargetCurrentParts() {
        const indexes = getTargetPartIndexes();
        els.targetCurrentParts.innerHTML = indexes.map(index => {
            const part = state.targetSimParts[index];
            return `
                <section class="target-part-card" data-target-current-part="${index}">
                    <div class="target-part-header">
                        <div class="target-part-title">${escapeHtml(getContractPartName(index))}</div>
                        <div class="muted-text target-current-caption">현재 부옵</div>
                    </div>
                    <div class="target-goals">
                        ${part.substats.map((substat, substatIndex) => `
                            <div class="target-current-row" data-substat-index="${substatIndex}">
                                <select class="sim-select target-current-option">
                                    ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === substat.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                                </select>
                                <select class="sim-select target-current-level">
                                    ${range(1, 8).map(level => `<option value="${level}" ${level === substat.level ? 'selected' : ''}>Lv ${level}</option>`).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        }).join('');
        els.targetCurrentParts.querySelectorAll('[data-target-current-part]').forEach(card => bindTargetCurrentCard(card));
    }

    function bindTargetCurrentCard(card) {
        const partIndex = Number(card.dataset.targetCurrentPart);
        const part = state.targetSimParts[partIndex];
        card.querySelectorAll('[data-substat-index]').forEach(row => {
            const substatIndex = Number(row.dataset.substatIndex);
            row.querySelector('.target-current-option').addEventListener('change', event => {
                part.substats[substatIndex].option = event.target.value;
                markTargetSettingsChanged();
            });
            row.querySelector('.target-current-level').addEventListener('change', event => {
                part.substats[substatIndex].level = Number(event.target.value);
                markTargetSettingsChanged();
            });
        });
    }

    function bindTargetCard(card) {
        const partIndex = Number(card.dataset.targetPart);
        const part = state.targetSimParts[partIndex];
        card.querySelector('.target-main-option').addEventListener('change', event => {
            part.mainOption = event.target.value;
            markTargetSettingsChanged();
        });
        card.querySelectorAll('[data-goal-index]').forEach(row => {
            const goalIndex = Number(row.dataset.goalIndex);
            row.querySelector('.target-goal-option').addEventListener('change', event => {
                part.goals[goalIndex].option = event.target.value;
                markTargetSettingsChanged();
            });
            row.querySelector('.target-goal-level').addEventListener('change', event => {
                part.goals[goalIndex].level = Number(event.target.value);
                markTargetSettingsChanged();
            });
            row.querySelector('.goal-enabled').addEventListener('change', event => {
                part.goals[goalIndex].enabled = event.target.checked;
                markTargetSettingsChanged();
            });
        });
    }

    function manualReroll() {
        const part = getSelectedPart();
        const cost = getRerollCost(countLocked(part.substats), getManualLockCostMode());
        state.manualPreview = rerollSubstats(part.substats);
        addTotals(state.totals, cost);
        state.totals.rerolls += 1;
        state.manualResult = {
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
        saveCurrentState();
    }

    function applyManualPreview() {
        if (!state.manualPreview) return;
        getSelectedPart().substats = cloneSubstats(state.manualPreview);
        getSelectedPart().lastTouched = true;
        if (state.manualResult) {
            state.manualResult.finalSubstats = cloneSubstats(state.manualPreview);
            state.manualResult.allParts = getAllPartSnapshots();
        }
        state.manualPreview = null;
        renderParts();
        renderManual();
        renderResultSummary('전사 결과를 현재 부옵으로 교체했습니다.');
        markSettingsChanged();
    }

    async function runTargetSimulation() {
        if (state.isSimulating) return;
        const config = getTargetConfig();
        if (!config.targets.length) {
            setStatus('목표로 사용할 부옵을 하나 이상 선택해주세요.', 'error');
            return;
        }
        const startMessage = '이번 실행 기준: 현재 세팅에 입력된 부옵 상태에서 시작했습니다.';
        await executeTargetSimulation(config, startMessage);
    }

    async function executeTargetSimulation(config, startMessage) {
        setSimulationBusy(true, '목표 시뮬레이션을 계산 중입니다...');
        try {
            const result = await simulateUntilTargets(config);
            result.startMessage = startMessage;
            state.targetResult = result;
            state.targetResult.allParts = getTargetResultPartSnapshots(result);
            renderTargetParts();
            renderResultSummary('목표까지 시뮬레이션을 완료했습니다.');
        } finally {
            setSimulationBusy(false);
        }
    }

    async function simulateUntilTargets(config, shouldYield = true) {
        const totalCost = createEmptyTotals();
        const partResults = [];
        let attempts = 0;
        for (const targetPart of config.targetsByPart) {
            let current = cloneSubstats(state.targetSimParts[targetPart.partIndex].substats);
            let safetySteps = 0;
            while (!matchesGoals(current, targetPart.goals)) {
                if (safetySteps >= 8) {
                    current = forceCompleteGoals(current, targetPart.goals);
                    break;
                }
                const step = advanceTowardGoals(current, targetPart.goals, config);
                current = step.substats;
                addScaledTotals(totalCost, step.cost, step.attempts);
                attempts += step.attempts;
                safetySteps += 1;
            }
            partResults.push({
                partIndex: targetPart.partIndex,
                goals: targetPart.goals,
                finalSubstats: current.map(substat => ({ ...substat, locked: false }))
            });
            if (shouldYield) await yieldToBrowser();
        }
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
            const goals = state.targetSimParts[partIndex].goals
                .filter(goal => goal.enabled)
                .map(goal => ({ option: goal.option, level: goal.level }));
            return { partIndex, goals };
        }).filter(item => item.goals.length > 0);
        return {
            targetsByPart,
            targets: targetsByPart.flatMap(item => item.goals),
            scopeLabel: state.targetParts.length === 6 ? '전체' : state.targetParts.map(index => ROMANS[index]).join(', '),
            lockStrategy: 'two',
            lockCostMode: els.targetLockCost.value
        };
    }

    function getTargetPartIndexes() {
        return TARGET_PART_ORDER.filter(index => state.targetParts.includes(index));
    }

    function getStrategyLockedIndexes(substats, goals, strategy) {
        if (strategy === 'none') return [];
        const matches = [];
        const usedGoals = new Set();
        substats.forEach((substat, index) => {
            const goalIndex = goals.findIndex((goal, index) => {
                return !usedGoals.has(index) && substat.option === goal.option && substat.level >= goal.level;
            });
            if (goalIndex !== -1) {
                usedGoals.add(goalIndex);
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

    function advanceTowardGoals(current, goals, config) {
        const locked = getStrategyLockedIndexes(current, goals, config.lockStrategy);
        const unlocked = [0, 1, 2].filter(index => !locked.includes(index));
        const missingGoals = getMissingGoals(current, goals, locked);
        const targetGoal = pickWeightedGoal(missingGoals);
        const chance = getAnyGoalHitProbability(missingGoals, unlocked.length);
        const attempts = sampleGeometric(chance);
        const next = current.map((substat, index) => {
            if (locked.includes(index)) return { ...substat, locked: true };
            return { option: randomOptionId(), level: randomInt(1, 8), locked: false };
        });
        if (targetGoal && unlocked.length) {
            const targetSlot = unlocked[randomInt(0, unlocked.length - 1)];
            next[targetSlot] = createSubstatForGoal(targetGoal);
        }
        return {
            attempts,
            cost: getRerollCost(locked.length, config.lockCostMode),
            substats: next.map(substat => ({ ...substat, locked: false }))
        };
    }

    function getMissingGoals(substats, goals, lockedIndexes) {
        const matchedGoals = new Set();
        lockedIndexes.forEach(substatIndex => {
            const substat = substats[substatIndex];
            const goalIndex = goals.findIndex((goal, index) => {
                return !matchedGoals.has(index) && substat.option === goal.option && substat.level >= goal.level;
            });
            if (goalIndex !== -1) matchedGoals.add(goalIndex);
        });
        return goals.filter((_, index) => !matchedGoals.has(index));
    }

    function pickWeightedGoal(goals) {
        if (!goals.length) return null;
        const totalWeight = goals.reduce((sum, goal) => sum + getGoalHitProbability(goal), 0);
        let cursor = Math.random() * totalWeight;
        for (const goal of goals) {
            cursor -= getGoalHitProbability(goal);
            if (cursor <= 0) return goal;
        }
        return goals[goals.length - 1];
    }

    function getAnyGoalHitProbability(goals, slotCount) {
        if (!goals.length || slotCount <= 0) return 1;
        const uniqueGoals = new Map();
        goals.forEach(goal => {
            uniqueGoals.set(`${goal.option}:${goal.level}`, goal);
        });
        const slotChance = Array.from(uniqueGoals.values())
            .reduce((sum, goal) => sum + getGoalHitProbability(goal), 0);
        return Math.max(0.000001, Math.min(1, 1 - Math.pow(1 - slotChance, slotCount)));
    }

    function getGoalHitProbability(goal) {
        return (9 - goal.level) / 64;
    }

    function sampleGeometric(successChance) {
        if (successChance >= 1) return 1;
        const chance = Math.max(0.000001, Math.min(0.999999, successChance));
        return Math.max(1, Math.ceil(Math.log(1 - Math.random()) / Math.log(1 - chance)));
    }

    function createSubstatForGoal(goal) {
        return {
            option: goal.option,
            level: randomInt(goal.level, 8),
            locked: false
        };
    }

    function forceCompleteGoals(current, goals) {
        const next = current.map(substat => ({ ...substat, locked: false }));
        const usedSlots = new Set();
        goals.slice(0, 3).forEach(goal => {
            let slot = next.findIndex((substat, index) => {
                return !usedSlots.has(index) && substat.option === goal.option && substat.level >= goal.level;
            });
            if (slot === -1) {
                slot = [0, 1, 2].find(index => !usedSlots.has(index));
                if (slot !== undefined) next[slot] = createSubstatForGoal(goal);
            }
            if (slot !== -1 && slot !== undefined) usedSlots.add(slot);
        });
        return next;
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
            setManualStatus('부옵 잠금은 최대 2개까지 가능합니다.', 'error');
            return;
        }
        substats[index].locked = !substats[index].locked;
        setManualStatus('', '');
        state.manualPreview = null;
        renderParts();
        renderManual();
        markSettingsChanged();
    }

    function renderTotals() {
        return;
    }

    function renderResultSummary(message) {
        const result = getActiveResult();
        const statGrid = renderCovenantStatGrid(getActiveStatParts(result));
        if (!result) {
            els.resultSummary.innerHTML = `
                ${statGrid}
                <p class="muted-text">${escapeHtml(message || '전사 시뮬레이션 결과가 여기에 표시됩니다.')}</p>
            `;
            setStatus('', '');
            return;
        }
        const cost = result.cost;
        const attempts = formatInteger(result.attempts);
        const resultMessage = message || result.startMessage || '';
        els.resultSummary.innerHTML = `
            ${resultMessage ? `<p class="muted-text">${escapeHtml(resultMessage)}</p>` : ''}
            ${result.startMessage && resultMessage !== result.startMessage ? `<p class="muted-text">${escapeHtml(result.startMessage)}</p>` : ''}
            ${statGrid}
            <div class="summary-grid">
                <div class="summary-item"><span class="summary-label">전사 횟수</span><span class="summary-value">${attempts}회</span></div>
                <div class="summary-item"><span class="summary-label">소모한 금권</span><span class="summary-value">${formatNumber(cost.gold, 1)}</span></div>
                <div class="summary-item"><span class="summary-label">소모한 천면인장</span><span class="summary-value">${formatNumber(cost.seals, 1)}</span></div>
                <div class="summary-item"><span class="summary-label">소모한 비밀 계약 잔본</span><span class="summary-value">${formatNumber(cost.fragments, 1)}</span></div>
                <div class="summary-item"><span class="summary-label">소모한 깃펜</span><span class="summary-value">${formatNumber(cost.quills, 1)}</span></div>
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
            return renderAllPartResults(result.allParts || getAllTargetPartSnapshots());
        }
        return '';
    }

    function getActiveResult() {
        return state.mode === 'target' ? state.targetResult : state.manualResult;
    }

    function getActiveStatParts(result) {
        if (result && result.type === 'target') return result.allParts || getAllTargetPartSnapshots();
        if (result && result.type === 'manual') return result.allParts || getAllPartSnapshots();
        return state.mode === 'target' ? getAllTargetPartSnapshots() : getAllPartSnapshots();
    }

    function renderAllPartResults(parts) {
        return `<div class="part-result-grid">${parts.map(part => `
            <div class="part-result-card">
                <h4>${escapeHtml(ROMANS[part.partIndex])}</h4>
                <div class="part-main-label">${escapeHtml(getOptionName(part.mainOption))}</div>
                ${part.substats.map(renderCompactStatLine).join('')}
            </div>
        `).join('')}</div>`;
    }

    function renderCovenantStatGrid(parts = getAllPartSnapshots()) {
        const totals = getCovenantStatTotals(parts);
        const rows = range(0, 3).map(rowIndex => {
            const left = totals[rowIndex * 2];
            const right = totals[rowIndex * 2 + 1];
            return `
                <tr>
                    <th scope="row">${escapeHtml(left.name)}</th>
                    <td>${escapeHtml(formatStatValue(left.value, left.unit))}</td>
                    <th scope="row">${escapeHtml(right.name)}</th>
                    <td>${escapeHtml(formatStatValue(right.value, right.unit))}</td>
                </tr>
            `;
        }).join('');
        return `
            <div class="covenant-stat-summary">
                <div class="stat-table-title">현재 비밀계약 스탯</div>
                <table class="covenant-stat-table">
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    function getCovenantStatTotals(parts = getAllPartSnapshots()) {
        const totals = Object.fromEntries(OPTIONS.map(option => [option.id, {
            name: option.name,
            unit: option.unit,
            value: 0
        }]));
        parts.forEach(part => {
            const mainOption = optionById[part.mainOption];
            if (mainOption) totals[part.mainOption].value += mainOption.step * (part.mainLevel || 0);
            part.substats.forEach(substat => {
                const option = optionById[substat.option];
                if (option) totals[substat.option].value += option.step * substat.level;
            });
        });
        return OPTIONS.map(option => totals[option.id]);
    }

    function showResultMessage(message) {
        renderResultSummary(message);
    }

    function setStatus(message, type) {
        els.resultStatus.textContent = message;
        els.resultStatus.className = `result-status ${type || ''}`.trim();
    }

    function setSimulationBusy(isBusy, message = '') {
        state.isSimulating = isBusy;
        if (els.runTargetBtn) els.runTargetBtn.disabled = isBusy;
        if (message) setStatus(message, '');
    }

    function yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function setManualStatus(message, type) {
        if (!els.manualStatus) return;
        els.manualStatus.textContent = message;
        els.manualStatus.className = `manual-status ${type || ''}`.trim();
    }

    function markSettingsChanged() {
        state.hasUnsavedPresetChanges = true;
        saveCurrentState();
    }

    function markTargetSettingsChanged() {
        state.targetResult = null;
        if (state.mode === 'target') renderResultSummary('목표 설정이 변경되었습니다. 목표까지 시뮬레이션을 다시 실행해주세요.');
        markSettingsChanged();
    }

    function saveCurrentState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(createStateSnapshot()));
        } catch (error) {
            console.warn('비밀계약 시뮬레이터 상태 저장에 실패했습니다.', error);
        }
    }

    function loadSavedState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved) applyStateSnapshot(saved);
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    function createStateSnapshot() {
        return {
            version: 1,
            selectedContract: state.selectedContract ? state.selectedContract.english_name : '',
            selectedPart: state.selectedPart,
            mode: state.mode,
            manualLockCostMode: getManualLockCostMode(),
            targetLockCostMode: els.targetLockCost ? els.targetLockCost.value : 'fragment',
            hasUnsavedPresetChanges: state.hasUnsavedPresetChanges,
            targetParts: [...state.targetParts],
            parts: state.parts.map(part => ({
                mainOption: part.mainOption,
                mainLevel: part.mainLevel,
                substats: part.substats.map(substat => ({ ...substat })),
                goals: part.goals.map(goal => ({ ...goal })),
                lastTouched: !!part.lastTouched
            })),
            targetSimParts: state.targetSimParts.map(part => ({
                mainOption: part.mainOption,
                mainLevel: part.mainLevel,
                substats: part.substats.map(substat => ({ ...substat })),
                goals: part.goals.map(goal => ({ ...goal })),
                lastTouched: !!part.lastTouched
            }))
        };
    }

    function applyStateSnapshot(snapshot) {
        const contract = state.contracts.find(item => item.english_name === snapshot.selectedContract);
        if (contract) state.selectedContract = contract;
        state.selectedPart = clampIndex(snapshot.selectedPart, 0, 5, 0);
        state.mode = snapshot.mode === 'target' ? 'target' : 'manual';
        state.targetParts = normalizeTargetParts(snapshot.targetParts);
        state.parts = Array.from({ length: 6 }, (_, index) => normalizePartSnapshot(snapshot.parts && snapshot.parts[index], index));
        const storedTargetParts = snapshot.targetSimParts || snapshot.parts;
        state.targetSimParts = Array.from({ length: 6 }, (_, index) => normalizePartSnapshot(storedTargetParts && storedTargetParts[index], index));
        state.hasUnsavedPresetChanges = !!snapshot.hasUnsavedPresetChanges;
        state.manualPreview = null;
        state.manualResult = null;
        state.targetResult = null;
        state.totals = createEmptyTotals();
        applyStoredControlValues(snapshot);
    }

    function loadPresets() {
        try {
            const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY));
            state.presets = Array.isArray(presets) ? presets.filter(preset => preset && preset.id && preset.snapshot) : [];
        } catch (error) {
            state.presets = [];
            localStorage.removeItem(PRESET_STORAGE_KEY);
        }
    }

    function loadTargetPresets() {
        try {
            const presets = JSON.parse(localStorage.getItem(TARGET_PRESET_STORAGE_KEY));
            state.targetPresets = Array.isArray(presets) ? presets.filter(preset => preset && preset.id && preset.snapshot) : [];
        } catch (error) {
            state.targetPresets = [];
            localStorage.removeItem(TARGET_PRESET_STORAGE_KEY);
        }
    }

    function persistPresets() {
        localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(state.presets));
    }

    function persistTargetPresets() {
        localStorage.setItem(TARGET_PRESET_STORAGE_KEY, JSON.stringify(state.targetPresets));
    }

    function renderPresetControls() {
        if (!els.presetSelect) return;
        const selectedId = els.presetSelect.value;
        els.presetSelect.innerHTML = [
            '<option value="">프리셋 선택</option>',
            ...state.presets.map(preset => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`)
        ].join('');
        if (state.presets.some(preset => preset.id === selectedId)) {
            els.presetSelect.value = selectedId;
        }
    }

    function renderTargetPresetControls() {
        if (!els.targetPresetSelect) return;
        const selectedId = els.targetPresetSelect.value;
        els.targetPresetSelect.innerHTML = [
            '<option value="">목표 프리셋 선택</option>',
            ...state.targetPresets.map(preset => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`)
        ].join('');
        if (state.targetPresets.some(preset => preset.id === selectedId)) {
            els.targetPresetSelect.value = selectedId;
        }
    }

    function savePreset() {
        const selectedId = els.presetSelect.value;
        const existing = state.presets.find(preset => preset.id === selectedId);
        const inputName = els.presetNameInput.value.trim();
        const name = inputName || (existing ? existing.name : getDefaultPresetName());
        if (!name) return;
        const now = new Date().toISOString();
        let activePresetId = selectedId;
        state.hasUnsavedPresetChanges = false;
        if (existing) {
            existing.name = name;
            existing.snapshot = createStateSnapshot();
            existing.updatedAt = now;
            setManualStatus(`프리셋 "${existing.name}"을 저장했습니다.`, '');
        } else {
            const preset = {
                id: `preset-${Date.now()}`,
                name,
                createdAt: now,
                updatedAt: now,
                snapshot: createStateSnapshot()
            };
            state.presets.push(preset);
            activePresetId = preset.id;
            setManualStatus(`프리셋 "${name}"을 저장했습니다.`, '');
        }
        els.presetNameInput.value = '';
        persistPresets();
        renderPresetControls();
        els.presetSelect.value = activePresetId;
        saveCurrentState();
    }

    function loadSelectedPreset() {
        const preset = state.presets.find(item => item.id === els.presetSelect.value);
        if (!preset) {
            setManualStatus('불러올 프리셋을 선택해주세요.', 'error');
            return;
        }
        applyStateSnapshot(preset.snapshot);
        state.hasUnsavedPresetChanges = false;
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderTargetParts();
        renderPresetControls();
        renderTotals();
        saveCurrentState();
        showResultMessage(`프리셋 "${preset.name}"을 불러왔습니다.`);
    }

    function deleteSelectedPreset() {
        const preset = state.presets.find(item => item.id === els.presetSelect.value);
        if (!preset) {
            setManualStatus('삭제할 프리셋을 선택해주세요.', 'error');
            return;
        }
        state.presets = state.presets.filter(item => item.id !== preset.id);
        persistPresets();
        els.presetSelect.value = '';
        renderPresetControls();
        setManualStatus(`프리셋 "${preset.name}"을 삭제했습니다.`, '');
    }

    function saveTargetPreset() {
        const selectedId = els.targetPresetSelect.value;
        const existing = state.targetPresets.find(preset => preset.id === selectedId);
        const inputName = els.targetPresetNameInput.value.trim();
        const name = inputName || (existing ? existing.name : getDefaultTargetPresetName());
        if (!name) return;
        const now = new Date().toISOString();
        let activePresetId = selectedId;
        const snapshot = createTargetPresetSnapshot();
        if (existing) {
            existing.name = name;
            existing.snapshot = snapshot;
            existing.updatedAt = now;
            setStatus(`목표 프리셋 "${existing.name}"을 저장했습니다.`, '');
        } else {
            const preset = {
                id: `target-preset-${Date.now()}`,
                name,
                createdAt: now,
                updatedAt: now,
                snapshot
            };
            state.targetPresets.push(preset);
            activePresetId = preset.id;
            setStatus(`목표 프리셋 "${name}"을 저장했습니다.`, '');
        }
        els.targetPresetNameInput.value = '';
        persistTargetPresets();
        renderTargetPresetControls();
        els.targetPresetSelect.value = activePresetId;
    }

    function loadSelectedTargetPreset() {
        const preset = state.targetPresets.find(item => item.id === els.targetPresetSelect.value);
        if (!preset) {
            setStatus('불러올 목표 프리셋을 선택해주세요.', 'error');
            return;
        }
        applyTargetPresetSnapshot(preset.snapshot);
        renderTargetScopeButtons();
        renderTargetCurrentParts();
        renderTargetParts();
        renderTargetPresetControls();
        els.targetPresetSelect.value = preset.id;
        markTargetSettingsChanged();
        renderResultSummary(`목표 프리셋 "${preset.name}"을 불러왔습니다.`);
    }

    function deleteSelectedTargetPreset() {
        const preset = state.targetPresets.find(item => item.id === els.targetPresetSelect.value);
        if (!preset) {
            setStatus('삭제할 목표 프리셋을 선택해주세요.', 'error');
            return;
        }
        state.targetPresets = state.targetPresets.filter(item => item.id !== preset.id);
        persistTargetPresets();
        els.targetPresetSelect.value = '';
        renderTargetPresetControls();
        setStatus(`목표 프리셋 "${preset.name}"을 삭제했습니다.`, '');
    }

    function getDefaultPresetName() {
        const contractName = state.selectedContract ? state.selectedContract.korean_name : '비밀계약';
        return `${contractName} ${formatTotalCompletion(getTotalCompletion())}%`;
    }

    function getDefaultTargetPresetName() {
        const contractName = state.selectedContract ? state.selectedContract.korean_name : '비밀계약';
        return `${contractName} 목표 ${state.targetParts.map(index => ROMANS[index]).join('')}`;
    }

    function createTargetPresetSnapshot() {
        return {
            version: 1,
            targetParts: [...state.targetParts],
            targetLockCostMode: els.targetLockCost ? els.targetLockCost.value : 'fragment',
            targets: state.targetSimParts.map(part => ({
                mainOption: part.mainOption,
                goals: part.goals.map(goal => ({ ...goal }))
            }))
        };
    }

    function applyTargetPresetSnapshot(snapshot) {
        state.targetParts = normalizeTargetParts(snapshot.targetParts);
        if (els.targetLockCost) {
            els.targetLockCost.value = snapshot.targetLockCostMode === 'quill' ? 'quill' : 'fragment';
        }
        state.targetSimParts = state.targetSimParts.map((part, index) => {
            const target = snapshot.targets && snapshot.targets[index];
            if (!target || typeof target !== 'object') return part;
            return {
                ...part,
                mainOption: MAIN_OPTIONS[index].includes(target.mainOption) ? target.mainOption : part.mainOption,
                goals: Array.from({ length: 3 }, (_, goalIndex) => normalizeGoal(target.goals && target.goals[goalIndex], part.goals[goalIndex])),
                lastTouched: false
            };
        });
        state.targetResult = null;
    }


    function normalizePartSnapshot(part, index) {
        const base = createDefaultPart(index);
        if (!part || typeof part !== 'object') return base;
        const substats = Array.from({ length: 3 }, (_, substatIndex) => normalizeSubstat(part.substats && part.substats[substatIndex], base.substats[substatIndex]));
        const goals = Array.from({ length: 3 }, (_, goalIndex) => normalizeGoal(part.goals && part.goals[goalIndex], base.goals[goalIndex]));
        return {
            mainOption: MAIN_OPTIONS[index].includes(part.mainOption) ? part.mainOption : base.mainOption,
            mainLevel: clampIndex(part.mainLevel, 0, MAIN_COMPLETION.length - 1, base.mainLevel),
            substats,
            goals,
            lastTouched: !!part.lastTouched
        };
    }

    function normalizeSubstat(substat, fallback) {
        if (!substat || typeof substat !== 'object') return { ...fallback };
        return {
            option: optionById[substat.option] ? substat.option : fallback.option,
            level: clampIndex(substat.level, 1, 8, fallback.level),
            locked: !!substat.locked
        };
    }

    function normalizeGoal(goal, fallback) {
        if (!goal || typeof goal !== 'object') return { ...fallback };
        return {
            option: optionById[goal.option] ? goal.option : fallback.option,
            level: clampIndex(goal.level, 1, 8, fallback.level),
            enabled: typeof goal.enabled === 'boolean' ? goal.enabled : fallback.enabled
        };
    }

    function normalizeTargetParts(targetParts) {
        const unique = Array.from(new Set((Array.isArray(targetParts) ? targetParts : [0, 1, 2, 3, 4, 5])
            .map(value => Number(value))
            .filter(value => Number.isInteger(value) && value >= 0 && value <= 5)));
        return unique.length ? unique.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5];
    }

    function applyStoredControlValues(snapshot) {
        const manualLockCostMode = snapshot.manualLockCostMode === 'quill' ? 'quill' : 'fragment';
        const manualLockInput = document.querySelector(`input[name="manual-lock-cost"][value="${manualLockCostMode}"]`);
        if (manualLockInput) manualLockInput.checked = true;
        if (els.targetLockCost) {
            els.targetLockCost.value = snapshot.targetLockCostMode === 'quill' ? 'quill' : 'fragment';
        }
    }

    function clampIndex(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isInteger(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    }

    function resetSimulation() {
        state.parts = Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
        state.targetSimParts = Array.from({ length: 6 }, (_, index) => createDefaultPart(index));
        state.selectedPart = 0;
        state.targetParts = [0, 1, 2, 3, 4, 5];
        state.manualPreview = null;
        state.manualResult = null;
        state.targetResult = null;
        state.totals = createEmptyTotals();
        state.hasUnsavedPresetChanges = false;
        renderParts();
        renderTargetScopeButtons();
        renderManual();
        renderTargetCurrentParts();
        renderTargetParts();
        renderTotals();
        showResultMessage('초기화했습니다.');
        saveCurrentState();
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
            mainLevel: part.mainLevel,
            substats: cloneSubstats(index === previewPartIndex && previewSubstats ? previewSubstats : part.substats)
        }));
    }

    function getAllTargetPartSnapshots() {
        return state.targetSimParts.map((part, index) => ({
            partIndex: index,
            mainOption: part.mainOption,
            mainLevel: part.mainLevel,
            substats: cloneSubstats(part.substats)
        }));
    }

    function getTargetResultPartSnapshots(result) {
        const resultByPart = new Map(result.partResults.map(partResult => [partResult.partIndex, partResult]));
        return state.targetSimParts.map((part, index) => {
            const partResult = resultByPart.get(index);
            return {
                partIndex: index,
                mainOption: part.mainOption,
                mainLevel: part.mainLevel,
                substats: cloneSubstats(partResult ? partResult.finalSubstats : part.substats)
            };
        });
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

    function getPartCompletion(part, substats = part.substats) {
        const totalLevel = substats.reduce((sum, substat) => sum + substat.level, 0);
        return MAIN_COMPLETION[part.mainLevel] + SUB_COMPLETION[totalLevel];
    }

    function getTotalCompletion() {
        return state.parts.reduce((sum, part) => sum + getPartCompletion(part), 0);
    }

    function formatTotalCompletion(value) {
        return value >= 99.5 ? '100' : formatNumber(value, 1);
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

    function addScaledTotals(target, source, multiplier) {
        target.gold += (source.gold || 0) * multiplier;
        target.seals += (source.seals || 0) * multiplier;
        target.fragments += (source.fragments || 0) * multiplier;
        target.quills += (source.quills || 0) * multiplier;
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

    function renderCompactStatLine(substat) {
        const optionName = getOptionName(substat.option);
        return `<div class="compact-stat-line"><span class="stat-name">${escapeHtml(optionName)}</span><span class="stat-value">${escapeHtml(getSubstatText(substat).replace(`${optionName} `, ''))}</span></div>`;
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

    function formatStatValue(value, unit) {
        return `${formatNumber(value, 2)}${unit}`;
    }

    function range(start, end) {
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function toCamel(id) {
        return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
})();
