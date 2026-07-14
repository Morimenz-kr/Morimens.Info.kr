import {
    MAX_PRESETS,
    MAX_PRESET_NAME_LENGTH,
    ROMANS,
    TARGET_PART_ORDER,
    OPTIONS,
    MAIN_OPTIONS,
    MAIN_COMPLETION,
    OPTION_BY_ID,
    addTotals,
    clampIndex,
    cloneSubstats,
    countLocked,
    createDefaultPart,
    createEmptyTotals,
    createStateSnapshot as buildStateSnapshot,
    createTargetPresetSnapshot as buildTargetPresetSnapshot,
    getPartCompletion,
    getRerollCost,
    getTotalCompletion as calculateTotalCompletion,
    isPlainObject,
    isStateSnapshot,
    normalizePartSnapshot,
    normalizePresetList,
    normalizeStoredText,
    normalizeTargetParts,
    normalizeTargetPreset,
    rerollSubstats,
    simulateUntilTargets
} from './covenant-simulator/domain.js?v=v1.4.0-site-quality-20260713-r4';
import {
    STORAGE_KEYS,
    createJsonStorage
} from './covenant-simulator/storage.js?v=v1.4.0-site-quality-20260713-r4';
import { createRetryableInitializer } from './covenant-simulator/bootstrap.js?v=v1.4.0-site-quality-20260713-r4';

(function() {
    'use strict';

    const storage = createJsonStorage(() => window.localStorage);
    const STORAGE_KEY = STORAGE_KEYS.state;
    const PRESET_STORAGE_KEY = STORAGE_KEYS.presets;
    const TARGET_PRESET_STORAGE_KEY = STORAGE_KEYS.targetPresets;
    const optionById = OPTION_BY_ID;
    const els = {};
    let initializer = null;
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
        storageWarning: '',
        targetParts: [0, 1, 2, 3, 4, 5],
        parts: Array.from({ length: 6 }, (_, index) => createDefaultPart(index)),
        targetSimParts: Array.from({ length: 6 }, (_, index) => createDefaultPart(index))
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        cacheElements();
        setupContractChangeDialog();
        bindEvents();
        initializer = createRetryableInitializer({
            load: loadContracts,
            onLoading: renderInitializationLoading,
            onReady: (_value, context) => {
                setSimulatorControlsEnabled(true);
                renderAll();
                setInitializationBusy(false);
                if (context.fromRetry) focusSelectedContract();
            },
            onError: (error) => {
                console.error('비밀계약 시뮬레이터 초기화에 실패했습니다.', error);
                const message = error instanceof Error ? error.message : '비밀계약 데이터를 불러오지 못했습니다.';
                renderLoadFailure(message);
            }
        });
        await initializer.run();
    }

    function cacheElements() {
        [
            'contract-grid', 'selected-contract-name', 'left-part-grid', 'right-part-grid', 'manual-panel', 'target-panel',
            'manual-part-title', 'manual-before-completion', 'manual-after-completion', 'manual-main-option', 'manual-main-level',
            'manual-cost', 'manual-status', 'manual-result', 'manual-reroll-btn', 'manual-apply-btn',
            'manual-focus-image', 'manual-focus-name', 'manual-total-completion', 'manual-current-result',
            'target-scope-buttons', 'target-lock-cost', 'target-current-parts', 'target-parts',
            'run-target-btn', 'result-summary', 'result-status', 'simulator-live-region',
            'target-preset-name-input', 'target-preset-select', 'save-target-preset-btn', 'load-target-preset-btn', 'delete-target-preset-btn',
            'preset-name-input', 'preset-select', 'save-preset-btn', 'load-preset-btn', 'delete-preset-btn',
            'contract-change-modal', 'confirm-contract-change-btn', 'reset-sim-btn'
        ].forEach(id => {
            els[toCamel(id)] = document.getElementById(id);
        });
        els.contractChangeMessage = document.querySelector('.contract-change-message');
        els.modeTabs = Array.from(document.querySelectorAll('[data-mode-tab]'));
    }

    function setupContractChangeDialog() {
        if (!window.SiteDialog || !els.contractChangeModal) {
            console.error('SiteDialog를 불러오지 못해 비밀계약 변경 확인창을 초기화할 수 없습니다.');
            return;
        }
        window.SiteDialog.setup(els.contractChangeModal, {
            initialFocus: '#cancel-contract-change-btn',
            onClose: () => {
                state.pendingContractName = '';
            }
        });
    }

    function bindEvents() {
        els.modeTabs.forEach(tab => {
            tab.addEventListener('click', () => selectModeTab(tab));
            tab.addEventListener('keydown', handleModeTabKeydown);
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
        els.resetSimBtn.addEventListener('click', resetSimulation);
    }

    function selectModeTab(tab, { focus = false } = {}) {
        if (!tab || !['manual', 'target'].includes(tab.dataset.modeTab)) return;
        state.mode = tab.dataset.modeTab;
        renderMode();
        saveCurrentState();
        if (focus) tab.focus();
    }

    function handleModeTabKeydown(event) {
        const currentIndex = els.modeTabs.indexOf(event.currentTarget);
        if (currentIndex < 0) return;
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % els.modeTabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + els.modeTabs.length) % els.modeTabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = els.modeTabs.length - 1;
        else return;
        event.preventDefault();
        selectModeTab(els.modeTabs[nextIndex], { focus: true });
    }

    async function loadContracts() {
        const response = await fetch('data/covenant_list.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('비밀계약 데이터를 불러오지 못했습니다.');
        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error('비밀계약 데이터 형식이 올바르지 않습니다.');
        state.contracts = payload.map(normalizeContract).filter(Boolean);
        if (state.contracts.length === 0) throw new Error('표시할 비밀계약 데이터가 없습니다.');
        state.selectedContract = state.contracts[0];
        loadPresets();
        loadTargetPresets();
        loadSavedState();
    }

    function normalizeContract(contract) {
        if (!isPlainObject(contract)) return null;
        const englishName = normalizeStoredText(contract.english_name, 80);
        const koreanName = normalizeStoredText(contract.korean_name, 80);
        const imagePath = normalizeLocalImagePath(contract.image_path);
        if (!englishName || !koreanName || !imagePath) return null;
        return Object.freeze({
            english_name: englishName,
            korean_name: koreanName,
            image_path: imagePath
        });
    }

    function normalizeLocalImagePath(value) {
        const path = normalizeStoredText(value, 500);
        if (!path) return '';
        try {
            const url = new URL(path, document.baseURI);
            return url.origin === window.location.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function setInitializationBusy(isBusy) {
        document.querySelector('.covenant-shell')?.setAttribute('aria-busy', String(isBusy));
        els.contractGrid?.setAttribute('aria-busy', String(isBusy));
    }

    function setSimulatorControlsEnabled(enabled) {
        document.querySelectorAll('.simulator-panel button, .simulator-panel input, .simulator-panel select')
            .forEach(control => { control.disabled = !enabled; });
    }

    function renderInitializationLoading(context = {}) {
        setInitializationBusy(true);
        setSimulatorControlsEnabled(false);
        const loadingMessage = '비밀계약 데이터를 불러오는 중입니다.';
        const status = els.contractGrid.querySelector('#contract-load-status')
            || createStatusElement(loadingMessage);
        status.id = 'contract-load-status';
        status.classList.add('contract-load-state');
        status.setAttribute('role', 'status');
        if (status.textContent !== loadingMessage) status.textContent = loadingMessage;
        if (context.fromRetry) status.tabIndex = -1;
        if (status.parentNode !== els.contractGrid) els.contractGrid.replaceChildren(status);
        els.selectedContractName.textContent = '';
        els.resultSummary.replaceChildren(createStatusElement('데이터를 불러오면 시뮬레이터를 사용할 수 있습니다.'));
        setStatus('', '');
        if (context.fromRetry) {
            requestAnimationFrame(() => status.focus({ preventScroll: true }));
        }
    }

    function renderLoadFailure(message) {
        setInitializationBusy(false);
        setSimulatorControlsEnabled(false);
        const wrapper = document.createElement('div');
        wrapper.className = 'error-state contract-load-state';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.id = 'retry-contract-load';
        retry.className = 'ghost-action';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', () => initializer?.run({ fromRetry: true }));
        wrapper.append(createStatusElement(message, 'contract-load-message'), retry);
        els.contractGrid.replaceChildren(wrapper);
        els.selectedContractName.textContent = '';
        els.resultSummary.replaceChildren(createStatusElement('데이터를 불러온 뒤 시뮬레이터를 사용할 수 있습니다.', 'error-state'));
        setStatus(`${message} 다시 시도 버튼으로 데이터를 불러와 주세요.`, 'error');
        requestAnimationFrame(() => retry.focus({ preventScroll: true }));
    }

    function focusSelectedContract() {
        requestAnimationFrame(() => {
            const buttons = [...els.contractGrid.querySelectorAll('[data-contract]')];
            const selected = buttons.find(button => button.dataset.contract === state.selectedContract?.english_name);
            (selected || buttons[0])?.focus({ preventScroll: true });
        });
    }

    function createStatusElement(message, className = 'status-message') {
        const element = document.createElement('p');
        element.className = className;
        element.textContent = message;
        return element;
    }

    function renderAll() {
        renderContract();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        renderPresetControls();
        renderTargetPresetControls();
        showResultMessage('전사 시뮬레이션 결과가 여기에 표시됩니다.');
        if (state.storageWarning) {
            setStatus(state.storageWarning, 'error');
            setManualStatus(state.storageWarning, 'error', { announce: false });
        }
    }

    function renderTargetScopeButtons() {
        const fragment = document.createDocumentFragment();
        TARGET_PART_ORDER.forEach(index => {
            const isActive = state.targetParts.includes(index);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `target-scope-btn ${isActive ? 'active' : ''}`.trim();
            button.dataset.targetScopeIndex = String(index);
            button.setAttribute('aria-pressed', String(isActive));
            button.setAttribute('aria-label', `${ROMANS[index]} 파츠 대상 ${isActive ? '포함됨' : '제외됨'}`);
            button.textContent = ROMANS[index];
            fragment.append(button);
        });
        els.targetScopeButtons.replaceChildren(fragment);
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
                focusWithoutScroll(els.targetScopeButtons.querySelector(`[data-target-scope-index="${index}"]`));
            });
        });
    }

    function renderContract() {
        if (!state.selectedContract) return;
        els.selectedContractName.textContent = state.selectedContract.korean_name;
        if (els.manualFocusImage) {
            els.manualFocusImage.src = state.selectedContract.image_path;
            els.manualFocusImage.alt = '';
        }
        if (els.manualFocusName) {
            els.manualFocusName.textContent = state.selectedContract.korean_name;
        }
        const fragment = document.createDocumentFragment();
        state.contracts.forEach(contract => {
            const isActive = contract.english_name === state.selectedContract.english_name;
            const button = document.createElement('button');
            const image = document.createElement('img');
            const name = document.createElement('span');
            button.type = 'button';
            button.className = `contract-card ${isActive ? 'active' : ''}`.trim();
            button.dataset.contract = contract.english_name;
            button.setAttribute('aria-pressed', String(isActive));
            button.setAttribute('aria-label', `${contract.korean_name} ${isActive ? '선택됨' : '선택'}`);
            image.src = contract.image_path;
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            name.className = 'contract-card-name';
            name.textContent = contract.korean_name;
            button.append(image, name);
            fragment.append(button);
        });
        els.contractGrid.replaceChildren(fragment);
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
        if (!window.SiteDialog) {
            state.pendingContractName = '';
            setStatus('확인 창을 열 수 없습니다. 페이지를 새로고침해주세요.', 'error');
            return;
        }
        window.SiteDialog.open(els.contractChangeModal);
    }

    function closeContractChangeModal() {
        if (window.SiteDialog) window.SiteDialog.close(els.contractChangeModal);
        else state.pendingContractName = '';
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
        saveCurrentState();
        showResultMessage('비밀계약을 변경하고 세팅을 초기화했습니다.');
        const selectedButton = Array.from(els.contractGrid.querySelectorAll('[data-contract]'))
            .find(button => button.dataset.contract === contractName);
        focusWithoutScroll(selectedButton);
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
        resetLockCostControls();
    }

    function resetLockCostControls() {
        const manualLockInput = document.querySelector('input[name="manual-lock-cost"][value="fragment"]');
        if (manualLockInput) manualLockInput.checked = true;
        if (els.targetLockCost) els.targetLockCost.value = 'fragment';
    }

    function renderParts() {
        const renderButtons = (container, indexes) => {
            const fragment = document.createDocumentFragment();
            indexes.forEach(index => {
                const part = state.parts[index];
                const isActive = index === state.selectedPart;
                const completion = formatNumber(getPartCompletion(part), 1);
                const button = document.createElement('button');
                const roman = document.createElement('span');
                const detail = document.createElement('span');
                button.type = 'button';
                button.className = `part-button ${isActive ? 'active' : ''} ${part.lastTouched ? 'has-result' : ''}`.trim();
                button.dataset.partIndex = String(index);
                button.setAttribute('aria-pressed', String(isActive));
                button.setAttribute('aria-label', `${ROMANS[index]} 파츠, 완성도 ${completion}%${isActive ? ', 선택됨' : ''}`);
                roman.className = 'part-roman';
                roman.textContent = ROMANS[index];
                detail.className = 'part-main part-completion';
                detail.textContent = `완성도 ${completion}%`;
                button.append(roman, detail);
                fragment.append(button);
            });
            container.replaceChildren(fragment);
        };
        renderButtons(els.leftPartGrid, [3, 4, 5]);
        renderButtons(els.rightPartGrid, [0, 1, 2]);
        [els.leftPartGrid, els.rightPartGrid].forEach(container => {
            container.querySelectorAll('[data-part-index]').forEach(button => {
                button.addEventListener('click', () => {
                    const partIndex = Number(button.dataset.partIndex);
                    state.selectedPart = partIndex;
                    state.manualPreview = null;
                    renderParts();
                    renderManual();
                    focusWithoutScroll(document.querySelector(`[data-part-index="${partIndex}"]`));
                });
            });
        });
    }

    function renderMode() {
        els.modeTabs.forEach(tab => {
            const isActive = tab.dataset.modeTab === state.mode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });
        const manualHidden = state.mode !== 'manual';
        const targetHidden = state.mode !== 'target';
        els.manualPanel.classList.toggle('hidden', manualHidden);
        els.manualPanel.hidden = manualHidden;
        els.targetPanel.classList.toggle('hidden', targetHidden);
        els.targetPanel.hidden = targetHidden;
        if (state.mode === 'manual') renderManual();
        if (state.mode === 'target') {
            renderTargetCurrentParts();
            renderTargetParts();
        }
        renderResultSummary();
    }

    function renderManual() {
        const part = getSelectedPart();
        els.manualPartTitle.textContent = getContractPartName(state.selectedPart);
        els.manualFocusName.textContent = getContractPartName(state.selectedPart);
        els.manualTotalCompletion.textContent = `전체 완성도 ${formatTotalCompletion(getTotalCompletion())}%`;
        if (state.selectedContract) {
            els.manualFocusImage.src = state.selectedContract.image_path;
            els.manualFocusImage.alt = '';
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
                <button type="button" class="lock-toggle ${substat.locked ? 'active' : ''}"
                        aria-pressed="${substat.locked}" aria-label="${index + 1}번 부옵 ${substat.locked ? '잠금 해제' : '잠금'}">${substat.locked ? '🔒' : '🔓'}</button>
                <label class="visually-hidden" for="manual-substat-option-${index}">${index + 1}번 부옵 종류</label>
                <select id="manual-substat-option-${index}" class="sim-select substat-option">
                    ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === substat.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                </select>
                <label class="visually-hidden" for="manual-substat-level-${index}">${index + 1}번 부옵 레벨</label>
                <select id="manual-substat-level-${index}" class="sim-select substat-level">
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
                focusWithoutScroll(document.getElementById(`manual-substat-option-${index}`));
            });
            row.querySelector('.substat-level').addEventListener('change', event => {
                part.substats[index].level = Number(event.target.value);
                state.manualPreview = null;
                renderParts();
                renderManual();
                markSettingsChanged();
                focusWithoutScroll(document.getElementById(`manual-substat-level-${index}`));
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
                <section class="target-part-card" data-target-part="${index}" aria-labelledby="target-part-title-${index}">
                    <div class="target-part-header">
                        <h3 id="target-part-title-${index}" class="target-part-title">${escapeHtml(getContractPartName(index))}</h3>
                        <div class="contract-picker">
                            <label class="field-label" for="target-main-option-${index}">주옵</label>
                            <select id="target-main-option-${index}" class="sim-select target-main-option">
                                ${MAIN_OPTIONS[index].map(optionId => `<option value="${optionId}" ${optionId === part.mainOption ? 'selected' : ''}>${escapeHtml(getOptionName(optionId))}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="target-goals">
                        ${range(0, 2).map(goalIndex => {
                            const goal = part.goals[goalIndex];
                            return `
                                <div class="target-goal-row" data-goal-index="${goalIndex}">
                                    <label class="visually-hidden" for="target-goal-option-${index}-${goalIndex}">${ROMANS[index]} 파츠 목표 ${goalIndex + 1} 부옵</label>
                                    <select id="target-goal-option-${index}-${goalIndex}" class="sim-select target-goal-option">
                                        ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === goal.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                                    </select>
                                    <label class="visually-hidden" for="target-goal-level-${index}-${goalIndex}">${ROMANS[index]} 파츠 목표 ${goalIndex + 1} 최소 레벨</label>
                                    <select id="target-goal-level-${index}-${goalIndex}" class="sim-select target-goal-level">
                                        ${range(1, 8).map(level => `<option value="${level}" ${level === goal.level ? 'selected' : ''}>Lv ${level} 이상</option>`).join('')}
                                    </select>
                                    <label class="goal-enabled-control" for="target-goal-enabled-${index}-${goalIndex}">
                                        <input id="target-goal-enabled-${index}-${goalIndex}" type="checkbox" class="goal-enabled" ${goal.enabled ? 'checked' : ''}>
                                        <span>사용</span>
                                    </label>
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
                <section class="target-part-card" data-target-current-part="${index}" aria-labelledby="target-current-title-${index}">
                    <div class="target-part-header">
                        <h3 id="target-current-title-${index}" class="target-part-title">${escapeHtml(getContractPartName(index))}</h3>
                        <div class="muted-text target-current-caption">현재 부옵</div>
                    </div>
                    <div class="target-goals">
                        ${part.substats.map((substat, substatIndex) => `
                            <div class="target-current-row" data-substat-index="${substatIndex}">
                                <label class="visually-hidden" for="target-current-option-${index}-${substatIndex}">${ROMANS[index]} 파츠 현재 부옵 ${substatIndex + 1} 종류</label>
                                <select id="target-current-option-${index}-${substatIndex}" class="sim-select target-current-option">
                                    ${OPTIONS.map(option => `<option value="${option.id}" ${option.id === substat.option ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}
                                </select>
                                <label class="visually-hidden" for="target-current-level-${index}-${substatIndex}">${ROMANS[index]} 파츠 현재 부옵 ${substatIndex + 1} 레벨</label>
                                <select id="target-current-level-${index}-${substatIndex}" class="sim-select target-current-level">
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
        state.totals = addTotals(state.totals, { ...cost, rerolls: 1 });
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
            await yieldToBrowser();
            const result = simulateUntilTargets({
                ...config,
                targetSimParts: state.targetSimParts,
                contractName: state.selectedContract.korean_name
            });
            result.startMessage = startMessage;
            state.targetResult = result;
            state.targetResult.allParts = getTargetResultPartSnapshots(result);
            renderTargetParts();
            renderResultSummary('목표까지 시뮬레이션을 완료했습니다.');
        } catch (error) {
            console.error('목표 시뮬레이션 실행에 실패했습니다.', error);
            state.targetResult = null;
            renderResultSummary('시뮬레이션을 완료하지 못했습니다. 입력값을 확인한 뒤 다시 시도해주세요.');
            setStatus('목표 시뮬레이션 중 오류가 발생했습니다.', 'error');
        } finally {
            setSimulationBusy(false);
        }
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
        const lockButton = els.manualCurrentResult
            .querySelector(`[data-substat-index="${index}"] .lock-toggle`);
        focusWithoutScroll(lockButton);
    }

    function renderResultSummary(message) {
        const result = getActiveResult();
        const statGrid = renderCovenantStatGrid(getActiveStatParts(result));
        if (!result) {
            els.resultSummary.innerHTML = `
                ${statGrid}
                <p class="muted-text">${escapeHtml(message || '전사 시뮬레이션 결과가 여기에 표시됩니다.')}</p>
            `;
            setStatus(message || '', '');
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
        setStatus(message || '', message ? 'success' : '');
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
                <h3>${escapeHtml(ROMANS[part.partIndex])}</h3>
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
            <div class="covenant-stat-summary" role="region" aria-label="현재 비밀계약 스탯 표" tabindex="0">
                <h3 class="stat-table-title">현재 비밀계약 스탯</h3>
                <table class="covenant-stat-table">
                    <caption class="visually-hidden">현재 비밀계약의 능력치 합계</caption>
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
        announceSimulatorStatus(message, type);
    }

    function setSimulationBusy(isBusy, message = '') {
        state.isSimulating = isBusy;
        if (els.runTargetBtn) els.runTargetBtn.disabled = isBusy;
        if (message) setStatus(message, '');
    }

    function yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function setManualStatus(message, type, options = {}) {
        if (!els.manualStatus) return;
        els.manualStatus.textContent = message;
        els.manualStatus.className = `manual-status ${type || ''}`.trim();
        if (options.announce !== false) announceSimulatorStatus(message, type);
    }

    function announceSimulatorStatus(message, type) {
        if (!els.simulatorLiveRegion) return;
        els.simulatorLiveRegion.setAttribute('role', type === 'error' ? 'alert' : 'status');
        els.simulatorLiveRegion.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        els.simulatorLiveRegion.textContent = message || '';
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

    function readStoredJson(key) {
        const result = storage.read(key);
        if (result.ok) return result.value;
        if (result.reason === 'parse') {
            discardStoredData(key, '저장된 데이터가 손상되어 해당 항목을 초기화했습니다.', result.error);
        } else {
            reportStorageIssue('브라우저 저장 공간에 접근할 수 없어 설정을 불러오지 못했습니다.', result.error);
        }
        return undefined;
    }

    function writeStoredJson(key, value) {
        const result = storage.write(key, value);
        if (result.ok) return true;
        reportStorageIssue('브라우저 저장 공간이 부족하거나 차단되어 변경사항을 저장하지 못했습니다.', result.error);
        return false;
    }

    function discardStoredData(key, message, cause) {
        const result = storage.remove(key);
        if (!result.ok) {
            reportStorageIssue('손상된 저장 데이터를 정리할 수 없습니다. 브라우저 저장소 설정을 확인해주세요.', result.error);
            return;
        }
        reportStorageIssue(message, cause);
    }

    function reportStorageIssue(message, error) {
        state.storageWarning = message;
        console.warn(message, error || '');
        if (els.resultStatus) setStatus(message, 'error');
        if (els.manualStatus) setManualStatus(message, 'error', { announce: false });
    }

    function saveCurrentState() {
        writeStoredJson(STORAGE_KEY, createStateSnapshot());
    }

    function loadSavedState() {
        const saved = readStoredJson(STORAGE_KEY);
        if (saved === undefined) return;
        if (!isStateSnapshot(saved)) {
            discardStoredData(STORAGE_KEY, '저장된 시뮬레이터 설정 형식이 올바르지 않아 초기화했습니다.');
            return;
        }
        applyStateSnapshot(saved);
    }

    function createStateSnapshot() {
        return buildStateSnapshot(state, {
            manualLockCostMode: getManualLockCostMode(),
            targetLockCostMode: els.targetLockCost?.value
        });
    }

    function applyStateSnapshot(snapshot) {
        if (!isStateSnapshot(snapshot)) return false;
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
        return true;
    }

    function loadPresets() {
        const stored = readStoredJson(PRESET_STORAGE_KEY);
        if (stored === undefined) return;
        if (!Array.isArray(stored)) {
            discardStoredData(PRESET_STORAGE_KEY, '저장된 프리셋 형식이 올바르지 않아 초기화했습니다.');
            return;
        }
        state.presets = normalizePresetList(stored, false);
    }

    function loadTargetPresets() {
        const stored = readStoredJson(TARGET_PRESET_STORAGE_KEY);
        if (stored === undefined) return;
        if (!Array.isArray(stored)) {
            discardStoredData(TARGET_PRESET_STORAGE_KEY, '저장된 목표 프리셋 형식이 올바르지 않아 초기화했습니다.');
            return;
        }
        state.targetPresets = normalizePresetList(stored, true);
    }

    function persistPresets(presets = state.presets) {
        return writeStoredJson(PRESET_STORAGE_KEY, presets);
    }

    function persistTargetPresets(presets = state.targetPresets) {
        return writeStoredJson(TARGET_PRESET_STORAGE_KEY, presets);
    }

    function renderPresetControls() {
        if (!els.presetSelect) return;
        const selectedId = els.presetSelect.value;
        replacePresetOptions(els.presetSelect, state.presets, '프리셋 선택');
        if (state.presets.some(preset => preset.id === selectedId)) {
            els.presetSelect.value = selectedId;
        }
    }

    function renderTargetPresetControls() {
        if (!els.targetPresetSelect) return;
        const selectedId = els.targetPresetSelect.value;
        replacePresetOptions(els.targetPresetSelect, state.targetPresets, '목표 프리셋 선택');
        if (state.targetPresets.some(preset => preset.id === selectedId)) {
            els.targetPresetSelect.value = selectedId;
        }
    }

    function replacePresetOptions(select, presets, placeholder) {
        const fragment = document.createDocumentFragment();
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = placeholder;
        fragment.append(emptyOption);
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            fragment.append(option);
        });
        select.replaceChildren(fragment);
    }

    function savePreset() {
        const selectedId = els.presetSelect.value;
        const existing = state.presets.find(preset => preset.id === selectedId);
        const inputName = els.presetNameInput.value.trim();
        if (inputName.length > MAX_PRESET_NAME_LENGTH) {
            setManualStatus(`프리셋 이름은 ${MAX_PRESET_NAME_LENGTH}자 이하로 입력해주세요.`, 'error');
            return;
        }
        if (!existing && state.presets.length >= MAX_PRESETS) {
            setManualStatus(`프리셋은 최대 ${MAX_PRESETS}개까지 저장할 수 있습니다.`, 'error');
            return;
        }
        const name = normalizeStoredText(inputName || (existing ? existing.name : getDefaultPresetName()), MAX_PRESET_NAME_LENGTH);
        if (!name) return;
        const now = new Date().toISOString();
        let activePresetId = selectedId;
        const snapshot = { ...createStateSnapshot(), hasUnsavedPresetChanges: false };
        let nextPresets;
        if (existing) {
            nextPresets = state.presets.map(preset => preset.id === existing.id
                ? { ...preset, name, snapshot, updatedAt: now }
                : preset);
        } else {
            const preset = {
                id: createPresetId('preset'),
                name,
                createdAt: now,
                updatedAt: now,
                snapshot
            };
            nextPresets = [...state.presets, preset];
            activePresetId = preset.id;
        }
        if (!persistPresets(nextPresets)) return;
        state.presets = nextPresets;
        state.hasUnsavedPresetChanges = false;
        els.presetNameInput.value = '';
        renderPresetControls();
        els.presetSelect.value = activePresetId;
        setManualStatus(`프리셋 "${name}"을 저장했습니다.`, '');
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
        renderPresetControls();
        saveCurrentState();
        showResultMessage(`프리셋 "${preset.name}"을 불러왔습니다.`);
    }

    function deleteSelectedPreset() {
        const preset = state.presets.find(item => item.id === els.presetSelect.value);
        if (!preset) {
            setManualStatus('삭제할 프리셋을 선택해주세요.', 'error');
            return;
        }
        const nextPresets = state.presets.filter(item => item.id !== preset.id);
        if (!persistPresets(nextPresets)) return;
        state.presets = nextPresets;
        els.presetSelect.value = '';
        renderPresetControls();
        setManualStatus(`프리셋 "${preset.name}"을 삭제했습니다.`, '');
    }

    function saveTargetPreset() {
        const selectedId = els.targetPresetSelect.value;
        const existing = state.targetPresets.find(preset => preset.id === selectedId);
        const inputName = els.targetPresetNameInput.value.trim();
        if (inputName.length > MAX_PRESET_NAME_LENGTH) {
            setStatus(`목표 프리셋 이름은 ${MAX_PRESET_NAME_LENGTH}자 이하로 입력해주세요.`, 'error');
            return;
        }
        if (!existing && state.targetPresets.length >= MAX_PRESETS) {
            setStatus(`목표 프리셋은 최대 ${MAX_PRESETS}개까지 저장할 수 있습니다.`, 'error');
            return;
        }
        const name = normalizeStoredText(inputName || (existing ? existing.name : getDefaultTargetPresetName()), MAX_PRESET_NAME_LENGTH);
        if (!name) return;
        const now = new Date().toISOString();
        let activePresetId = selectedId;
        const snapshot = createTargetPresetSnapshot();
        let nextPresets;
        if (existing) {
            nextPresets = state.targetPresets.map(preset => preset.id === existing.id
                ? { ...preset, name, snapshot, updatedAt: now }
                : preset);
        } else {
            const preset = {
                id: createPresetId('target-preset'),
                name,
                createdAt: now,
                updatedAt: now,
                snapshot
            };
            nextPresets = [...state.targetPresets, preset];
            activePresetId = preset.id;
        }
        if (!persistTargetPresets(nextPresets)) return;
        state.targetPresets = nextPresets;
        els.targetPresetNameInput.value = '';
        renderTargetPresetControls();
        els.targetPresetSelect.value = activePresetId;
        setStatus(`목표 프리셋 "${name}"을 저장했습니다.`, '');
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
        const nextPresets = state.targetPresets.filter(item => item.id !== preset.id);
        if (!persistTargetPresets(nextPresets)) return;
        state.targetPresets = nextPresets;
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
        return buildTargetPresetSnapshot(state, els.targetLockCost?.value);
    }

    function applyTargetPresetSnapshot(snapshot) {
        const normalized = normalizeTargetPreset(snapshot, state.targetSimParts);
        if (!normalized) return false;
        state.targetParts = normalized.targetParts;
        if (els.targetLockCost) els.targetLockCost.value = normalized.targetLockCostMode;
        state.targetSimParts = normalized.targetSimParts;
        state.targetResult = null;
        return true;
    }

    function createPresetId(prefix) {
        const uuid = window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        return `${prefix}-${uuid}`;
    }
    function applyStoredControlValues(snapshot) {
        const manualLockCostMode = snapshot.manualLockCostMode === 'quill' ? 'quill' : 'fragment';
        const manualLockInput = document.querySelector(`input[name="manual-lock-cost"][value="${manualLockCostMode}"]`);
        if (manualLockInput) manualLockInput.checked = true;
        if (els.targetLockCost) {
            els.targetLockCost.value = snapshot.targetLockCostMode === 'quill' ? 'quill' : 'fragment';
        }
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
        resetLockCostControls();
        renderParts();
        renderTargetScopeButtons();
        renderMode();
        showResultMessage('초기화했습니다.');
        saveCurrentState();
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

    function getTotalCompletion() {
        return calculateTotalCompletion(state.parts);
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

    function focusWithoutScroll(element) {
        if (element instanceof HTMLElement) element.focus({ preventScroll: true });
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function toCamel(id) {
        return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
})();
