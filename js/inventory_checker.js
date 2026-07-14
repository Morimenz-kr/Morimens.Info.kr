import {
    STORAGE_SCHEMA_VERSION,
    GROUP_LABELS,
    CLASS_LABELS,
    RELEMS_LABELS,
    calculateShareCanvasScale,
    createInventoryCatalog,
    createInventorySnapshot,
    filterCharacters,
    filterSelectedCharacters,
    filterSelectedWheels,
    filterShareWheels,
    filterWheels,
    getBreakthroughLabel,
    getCharacterBreakthrough as calculateCharacterBreakthrough,
    getCharacterGroups as findCharacterGroups,
    getVisibleInventoryIds,
    getWheelBreakthrough as calculateWheelBreakthrough,
    groupCharactersByRelems,
    matchesInventorySearch as matchesSearchText,
    normalizeGrade,
    normalizeInventorySnapshot,
    reconcileCharacterBreakthroughs,
    reconcileWheelState,
    setCharacterBreakthrough as updateLinkedCharacterBreakthrough,
    stepBreakthrough
} from './inventory-checker/domain.js?v=v1.4.0-site-quality-20260713-r4';
import {
    INVENTORY_STORAGE_KEYS,
    createInventoryStorage
} from './inventory-checker/storage.js?v=v1.4.0-site-quality-20260713-r4';

(function () {
    'use strict';

    const FALLBACK_IMAGE = 'images/smile_Ramona.webp';
    const SHARE_IMAGE_TYPE = 'image/jpeg';
    const SHARE_IMAGE_QUALITY = 0.9;
    const SHARE_IMAGE_BLOB_TIMEOUT_MS = 20000;
    const MAX_SHARE_CANVAS_PIXELS = 16000000;
    const MAX_SHARE_CANVAS_DIMENSION = 8192;
    const inventoryStorage = createInventoryStorage(() => window.localStorage);

    const state = {
        tab: 'characters',
        characterFilter: 'all',
        characterClassFilter: 'all',
        wheelFilter: 'all',
        search: '',
        characters: [],
        wheels: [],
        groupByCharacterId: {},
        selectedCharacters: new Set(),
        selectedWheels: new Set(),
        characterBreakthroughs: {},
        wheelBreakthroughs: {}
    };

    const els = {};

    document.addEventListener('DOMContentLoaded', initialize);

    async function initialize() {
        cacheElements();
        window.SiteDialog?.setup(els.previewModal, {
            initialFocus: '#close-preview-modal',
            onClose: releasePreviewImage
        });
        setInventoryControlsEnabled(false);
        els.characterGrid.setAttribute('aria-busy', 'true');
        els.wheelGrid.setAttribute('aria-busy', 'true');

        try {
            const [characters, wheels, gachatype] = await Promise.all([
                fetchJson('data/character_manifest.json'),
                fetchJson('data/wheel_list.json'),
                fetchJson('data/gachatype.json')
            ]);

            const catalog = createInventoryCatalog({ characters, wheels, gachatype });
            state.characters = catalog.characters;
            state.wheels = catalog.wheels;
            state.groupByCharacterId = catalog.groupByCharacterId;
            loadSavedState();
            removeUnavailableCharacterBreakthroughs();
            removeUnavailableWheelSelections();

            bindEvents();
            renderAll();
            setInventoryControlsEnabled(true);
        } catch (error) {
            console.error('보유량 체크 데이터 로드 실패:', error);
            renderLoadError();
        } finally {
            els.characterGrid.setAttribute('aria-busy', 'false');
            els.wheelGrid.setAttribute('aria-busy', 'false');
        }
    }

    async function fetchJson(path) {
        const response = await fetch(path, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        return response.json();
    }

    function renderLoadError() {
        const wrapper = document.createElement('div');
        wrapper.className = 'error-state';
        const message = document.createElement('p');
        message.textContent = '보유 현황 데이터를 불러오지 못했습니다.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'ghost-action';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', () => window.location.reload());
        wrapper.append(message, retry);
        els.characterGrid.replaceChildren(wrapper);
        setStatus('보유 현황 데이터를 불러오지 못했습니다. 저장된 선택은 변경하지 않았습니다.', 'error');
    }

    function setInventoryControlsEnabled(enabled) {
        document.querySelectorAll('.inventory-shell button, .inventory-shell input, .inventory-shell select')
            .forEach(control => {
                control.disabled = !enabled;
            });
    }

    function cacheElements() {
        els.tabButtons = document.querySelectorAll('[data-tab-button]');
        els.characterFilters = document.querySelectorAll('[data-character-filter]');
        els.characterClassFilters = document.querySelectorAll('[data-character-class-filter]');
        els.wheelFilters = document.querySelectorAll('[data-wheel-filter]');
        els.search = document.getElementById('inventory-search');
        els.characterGrid = document.getElementById('character-grid');
        els.wheelGrid = document.getElementById('wheel-grid');
        els.characterFiltersBox = document.getElementById('character-filters');
        els.characterClassFiltersBox = document.getElementById('character-class-filters');
        els.wheelFiltersBox = document.getElementById('wheel-filters');
        els.characterCount = document.getElementById('character-count');
        els.wheelCount = document.getElementById('wheel-count');
        els.copyBtn = document.getElementById('copy-image-btn');
        els.previewBtn = document.getElementById('preview-image-btn');
        els.clearBtn = document.getElementById('clear-selection-btn');
        els.selectVisibleBtn = document.getElementById('select-visible-btn');
        els.deselectVisibleBtn = document.getElementById('deselect-visible-btn');
        els.copyStatus = document.getElementById('copy-status');
        els.previewModal = document.getElementById('preview-modal');
        els.previewImage = document.getElementById('preview-image');
        els.closePreviewModal = document.getElementById('close-preview-modal');
    }

    function bindEvents() {
        els.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                activateTab(button.dataset.tabButton);
            });
            button.addEventListener('keydown', handleTabKeydown);
        });

        els.characterFilters.forEach(button => {
            button.addEventListener('click', () => {
                state.characterFilter = button.dataset.characterFilter;
                renderAll();
            });
        });

        els.characterClassFilters.forEach(button => {
            button.addEventListener('click', () => {
                state.characterClassFilter = button.dataset.characterClassFilter;
                renderAll();
            });
        });

        els.wheelFilters.forEach(button => {
            button.addEventListener('click', () => {
                state.wheelFilter = button.dataset.wheelFilter;
                renderAll();
            });
        });

        els.search.addEventListener('input', event => {
            state.search = event.target.value.trim();
            renderAll();
        });

        els.characterGrid.addEventListener('click', event => {
            const toggle = event.target.closest('[data-character-toggle]');
            if (toggle) toggleCharacter(toggle.dataset.characterId);
        });
        els.characterGrid.addEventListener('click', event => {
            const control = event.target.closest('[data-breakthrough-control]');
            if (control) updateBreakthrough(control.dataset.breakthroughType, control.dataset.breakthroughId, control.dataset.breakthroughDirection);
        });
        els.wheelGrid.addEventListener('click', event => {
            const control = event.target.closest('[data-breakthrough-control]');
            if (control) {
                updateBreakthrough(control.dataset.breakthroughType, control.dataset.breakthroughId, control.dataset.breakthroughDirection);
                return;
            }
            const toggle = event.target.closest('[data-wheel-toggle]');
            if (toggle) toggleWheel(toggle.dataset.wheelId);
        });
        [els.characterGrid, els.wheelGrid].forEach(grid => {
            grid.addEventListener('error', handleImageError, true);
        });
        els.copyBtn.addEventListener('click', copySelectionImage);
        els.previewBtn.addEventListener('click', openPreviewModal);
        els.clearBtn.addEventListener('click', clearSelection);
        els.selectVisibleBtn.addEventListener('click', selectVisibleItems);
        els.deselectVisibleBtn.addEventListener('click', deselectVisibleItems);
        els.closePreviewModal.addEventListener('click', closePreviewModal);
    }

    function activateTab(tab) {
        if (!['characters', 'wheels'].includes(tab)) return;
        state.tab = tab;
        state.search = '';
        els.search.value = '';
        renderAll();
    }

    function handleTabKeydown(event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(els.tabButtons);
        const currentIndex = tabs.indexOf(event.currentTarget);
        let nextIndex = currentIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else {
            const direction = event.key === 'ArrowRight' ? 1 : -1;
            nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        }
        tabs[nextIndex].focus();
        activateTab(tabs[nextIndex].dataset.tabButton);
    }

    function handleImageError(event) {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === 'true') return;
        image.dataset.fallbackApplied = 'true';
        image.src = FALLBACK_IMAGE;
    }

    function loadSavedState() {
        const result = inventoryStorage.readLatest();
        if (!result.ok) {
            console.warn('저장된 보유량 체크 상태를 읽지 못했습니다.', result.error);
            if (result.sourceKey) inventoryStorage.remove(result.sourceKey);
            setStatus(
                '저장된 보유 현황을 읽지 못했습니다. 현재 변경은 새로고침 후 유지되지 않을 수 있습니다.',
                'error'
            );
            return;
        }
        if (!result.found) return;

        const saved = normalizeInventorySnapshot(result.value);
        if (!saved) {
            console.warn('저장된 보유량 체크 상태를 읽지 못했습니다.', new TypeError('저장 데이터 형식이 올바르지 않습니다.'));
            inventoryStorage.remove(result.sourceKey);
            setStatus('저장 데이터 형식이 올바르지 않아 기본 상태로 시작했습니다.', 'error');
            return;
        }

        state.selectedCharacters = new Set(saved.characters);
        state.selectedWheels = new Set(saved.wheels);
        state.characterBreakthroughs = saved.characterBreakthroughs;
        state.wheelBreakthroughs = saved.wheelBreakthroughs;

        if (result.sourceKey !== INVENTORY_STORAGE_KEYS.current
            || saved.schemaVersion !== STORAGE_SCHEMA_VERSION) {
            if (saveState()) {
                const cleanup = inventoryStorage.removeLegacy();
                if (!cleanup.ok) console.warn('이전 보유량 저장 데이터를 정리하지 못했습니다.', cleanup.error);
            }
        }
    }

    function saveState() {
        const result = inventoryStorage.write(createInventorySnapshot(state));
        if (result.ok) return true;
        console.warn('보유 현황을 브라우저에 저장하지 못했습니다.', result.error);
        setStatus('변경은 적용됐지만 저장하지 못했습니다. 새로고침하면 되돌아갈 수 있습니다.', 'error');
        return false;
    }

    function renderAll() {
        renderTabs();
        renderFilters();
        renderCharacters();
        renderWheels();
        renderSelection();
    }

    function renderTabs() {
        els.tabButtons.forEach(button => {
            const active = button.dataset.tabButton === state.tab;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        const charactersActive = state.tab === 'characters';
        els.characterGrid.classList.toggle('hidden', !charactersActive);
        els.characterGrid.hidden = !charactersActive;
        els.wheelGrid.classList.toggle('hidden', charactersActive);
        els.wheelGrid.hidden = charactersActive;
        els.characterFiltersBox.classList.toggle('hidden', state.tab !== 'characters');
        els.characterClassFiltersBox.classList.toggle('hidden', state.tab !== 'characters');
        els.wheelFiltersBox.classList.toggle('hidden', state.tab !== 'wheels');
    }

    function renderFilters() {
        els.characterFilters.forEach(button => {
            const active = button.dataset.characterFilter === state.characterFilter;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        els.characterClassFilters.forEach(button => {
            const active = button.dataset.characterClassFilter === state.characterClassFilter;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        els.wheelFilters.forEach(button => {
            const active = button.dataset.wheelFilter === state.wheelFilter;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function renderCharacters() {
        const filtered = filterCharacters({
            characters: state.characters,
            groupByCharacterId: state.groupByCharacterId,
            groupFilter: state.characterFilter,
            classFilter: state.characterClassFilter,
            search: state.search,
            matchesSearch: matchesInventorySearch
        });
        const grouped = groupCharactersByRelems(filtered);

        els.characterGrid.innerHTML = grouped.map(group => `
            <section class="relems-section ${escapeAttribute(group.relems)}" aria-label="${escapeAttribute(RELEMS_LABELS[group.relems] || group.relems)}">
                <h3 class="relems-section-title">${escapeHtml(RELEMS_LABELS[group.relems] || group.relems)}</h3>
                <div class="relems-character-grid">
                    ${group.characters.map(character => renderCharacterCard(character)).join('')}
                </div>
            </section>
        `).join('');
    }

    function renderCharacterCard(character) {
            const selected = state.selectedCharacters.has(character.id);
            const groups = getCharacterGroups(character.id);
            const group = groups[0];
            const groupLabel = groups.map(item => GROUP_LABELS[item] || item).join(', ');
            const className = CLASS_LABELS[character.class] || character.class || '역할 미상';
            const breakthrough = getCharacterBreakthrough(character.id);
            return `
                <article class="inventory-card character-inventory-card ${selected ? 'selected' : ''}">
                    <button type="button" class="inventory-select-toggle"
                            data-character-toggle data-character-id="${escapeAttribute(character.id)}"
                            aria-pressed="${selected}"
                            title="${escapeAttribute(character.name)} (${groupLabel || GROUP_LABELS[group] || '통상'} / ${className})">
                        <span class="check-mark" aria-hidden="true">✓</span>
                        <img src="${escapeAttribute(character.image_thumb)}"
                             alt="" width="180" height="180" loading="lazy" decoding="async">
                        <span class="inventory-card-name">${escapeHtml(character.name)}</span>
                    </button>
                    ${selected ? renderBreakthroughStepper('character', character.id, breakthrough) : ''}
                </article>
            `;
    }

    function renderBreakthroughStepper(type, id, value) {
        const label = getBreakthroughLabel(value);

        return `
            <span class="breakthrough-stepper" data-breakthrough-stepper>
                <button type="button"
                        class="breakthrough-stepper-btn"
                        data-breakthrough-control
                        data-breakthrough-type="${escapeAttribute(type)}"
                        data-breakthrough-id="${escapeAttribute(id)}"
                        data-breakthrough-direction="-1"
                        aria-label="돌파 단계 낮추기">&lt;</button>
                <span class="breakthrough-stepper-label">${escapeHtml(label)}</span>
                <button type="button"
                        class="breakthrough-stepper-btn"
                        data-breakthrough-control
                        data-breakthrough-type="${escapeAttribute(type)}"
                        data-breakthrough-id="${escapeAttribute(id)}"
                        data-breakthrough-direction="1"
                        aria-label="돌파 단계 올리기">&gt;</button>
            </span>
        `;
    }

    function renderWheels() {
        const filtered = filterWheels({
            wheels: state.wheels,
            gradeFilter: state.wheelFilter,
            search: state.search,
            matchesSearch: matchesInventorySearch
        });

        els.wheelGrid.innerHTML = filtered.map(wheel => {
            const selected = state.selectedWheels.has(wheel.english_name);
            const breakthrough = getWheelBreakthrough(wheel.english_name);
            return `
                <article class="inventory-card wheel-inventory-card ${selected ? 'selected' : ''}"
                         data-wheel-grade="${escapeAttribute(normalizeGrade(wheel.grade))}">
                    <button type="button" class="inventory-select-toggle"
                            data-wheel-toggle data-wheel-id="${escapeAttribute(wheel.english_name)}"
                            aria-pressed="${selected}"
                            title="${escapeAttribute(wheel.korean_name || wheel.english_name)}">
                        <span class="check-mark" aria-hidden="true">✓</span>
                        <img src="${escapeAttribute(wheel.image_path)}" alt=""
                             width="225" height="456" loading="lazy" decoding="async">
                        <span class="inventory-card-name">${escapeHtml(wheel.korean_name || wheel.english_name)}</span>
                    </button>
                    ${selected ? renderBreakthroughStepper('wheel', wheel.english_name, breakthrough) : ''}
                </article>
            `;
        }).join('');
    }

    function toggleCharacter(id) {
        if (state.selectedCharacters.has(id)) {
            state.selectedCharacters.delete(id);
            delete state.characterBreakthroughs[id];
        } else {
            state.selectedCharacters.add(id);
            setCharacterBreakthrough(id, getCharacterBreakthrough(id));
        }
        saveState();
        renderAll();
        restoreToggleFocus('character', id);
    }

    function toggleWheel(id) {
        if (state.selectedWheels.has(id)) {
            state.selectedWheels.delete(id);
            delete state.wheelBreakthroughs[id];
        } else {
            state.selectedWheels.add(id);
            state.wheelBreakthroughs[id] = getWheelBreakthrough(id);
        }
        saveState();
        renderAll();
        restoreToggleFocus('wheel', id);
    }

    function updateBreakthrough(type, id, direction) {
        if (type === 'character') {
            if (!state.selectedCharacters.has(id)) return;
            setCharacterBreakthrough(id, stepBreakthrough(getCharacterBreakthrough(id), direction));
        }
        if (type === 'wheel') {
            if (!state.selectedWheels.has(id)) return;
            state.wheelBreakthroughs[id] = stepBreakthrough(getWheelBreakthrough(id), direction);
        }
        saveState();
        renderAll();
        restoreStepperFocus(type, id, String(direction));
    }

    function restoreToggleFocus(type, id) {
        window.requestAnimationFrame(() => {
            const selector = type === 'character' ? '[data-character-toggle]' : '[data-wheel-toggle]';
            const key = type === 'character' ? 'characterId' : 'wheelId';
            Array.from(document.querySelectorAll(selector))
                .find(element => element.dataset[key] === id)
                ?.focus();
        });
    }

    function restoreStepperFocus(type, id, direction) {
        window.requestAnimationFrame(() => {
            Array.from(document.querySelectorAll('[data-breakthrough-control]'))
                .find(element =>
                    element.dataset.breakthroughType === type
                    && element.dataset.breakthroughId === id
                    && element.dataset.breakthroughDirection === direction
                )
                ?.focus();
        });
    }

    function getCharacterBreakthrough(id) {
        return calculateCharacterBreakthrough(state.characterBreakthroughs, id);
    }

    function setCharacterBreakthrough(id, value) {
        state.characterBreakthroughs = updateLinkedCharacterBreakthrough(
            state.characterBreakthroughs,
            state.selectedCharacters,
            id,
            value
        );
    }

    function getWheelBreakthrough(id) {
        return calculateWheelBreakthrough(state.wheelBreakthroughs, id);
    }

    function renderSelection() {
        const characters = state.characters.filter(character => state.selectedCharacters.has(character.id));
        const wheels = state.wheels.filter(wheel => state.selectedWheels.has(wheel.english_name));

        els.characterCount.textContent = characters.length;
        els.wheelCount.textContent = wheels.length;

    }

    function clearSelection() {
        state.selectedCharacters.clear();
        state.selectedWheels.clear();
        state.characterBreakthroughs = {};
        state.wheelBreakthroughs = {};
        const persisted = saveState();
        setStatus(
            persisted
                ? '선택을 초기화했습니다.'
                : '선택은 초기화했지만 저장하지 못했습니다. 새로고침하면 되돌아갈 수 있습니다.',
            persisted ? 'success' : 'error'
        );
        renderAll();
    }

    function selectVisibleItems() {
        const ids = getVisibleIds();
        if (ids.length === 0) {
            setStatus('현재 목록에 선택할 항목이 없습니다.', 'error');
            return;
        }
        if (state.tab === 'characters') {
            ids.forEach(id => {
                state.selectedCharacters.add(id);
                setCharacterBreakthrough(id, getCharacterBreakthrough(id));
            });
        } else {
            ids.forEach(id => {
                state.selectedWheels.add(id);
                state.wheelBreakthroughs[id] = getWheelBreakthrough(id);
            });
        }
        const persisted = saveState();
        setStatus(
            persisted
                ? '현재 목록을 모두 선택했습니다.'
                : '현재 목록은 선택했지만 저장하지 못했습니다. 새로고침하면 되돌아갈 수 있습니다.',
            persisted ? 'success' : 'error'
        );
        renderAll();
    }

    function deselectVisibleItems() {
        const ids = getVisibleIds();
        if (ids.length === 0) {
            setStatus('현재 목록에 해제할 항목이 없습니다.', 'error');
            return;
        }
        if (state.tab === 'characters') {
            ids.forEach(id => {
                state.selectedCharacters.delete(id);
                delete state.characterBreakthroughs[id];
            });
        } else {
            ids.forEach(id => {
                state.selectedWheels.delete(id);
                delete state.wheelBreakthroughs[id];
            });
        }
        const persisted = saveState();
        setStatus(
            persisted
                ? '현재 목록을 모두 해제했습니다.'
                : '현재 목록은 해제했지만 저장하지 못했습니다. 새로고침하면 되돌아갈 수 있습니다.',
            persisted ? 'success' : 'error'
        );
        renderAll();
    }

    function getVisibleIds() {
        return getVisibleInventoryIds({
            ...state,
            matchesSearch: matchesInventorySearch
        });
    }

    async function copySelectionImage() {
        const selectedCharacters = getFilteredSelectedCharacters();
        const selectedWheels = getFilteredSelectedWheels();

        if (selectedCharacters.length + selectedWheels.length === 0) {
            setStatus('현재 필터에 표시되는 선택 항목이 없습니다.', 'error');
            return;
        }

        setStatus('공유 이미지를 압축하는 중입니다...', '');
        els.copyBtn.disabled = true;

        try {
            if (!navigator.clipboard || !window.ClipboardItem) {
                throw new Error('클립보드 이미지 복사를 지원하지 않는 브라우저입니다.');
            }

            const canvas = await createShareCanvas(selectedCharacters, filterShareWheels(selectedWheels));
            const imageType = getClipboardImageType();
            const blob = await createImageBlobWithTimeout(canvas, imageType);
            await navigator.clipboard.write([new ClipboardItem({ [imageType]: blob })]);
            const label = imageType === SHARE_IMAGE_TYPE ? '압축 이미지' : 'PNG 이미지';
            setStatus(`${label}를 클립보드에 복사했습니다.`, 'success');
        } catch (error) {
            console.error('이미지 복사 실패:', error);
            setStatus(error.message || '이미지 복사에 실패했습니다. 클립보드 권한을 확인해 주세요.', 'error');
        } finally {
            els.copyBtn.disabled = false;
        }
    }

    async function openPreviewModal() {
        const selectedCharacters = getFilteredSelectedCharacters();
        const selectedWheels = getFilteredSelectedWheels();

        if (selectedCharacters.length + selectedWheels.length === 0) {
            setStatus('현재 필터에 표시되는 선택 항목이 없습니다.', 'error');
            return;
        }

        setStatus('미리보기를 준비하는 중입니다...', '');
        els.previewBtn.disabled = true;

        try {
            const canvas = await createShareCanvas(selectedCharacters, filterShareWheels(selectedWheels));
            const blob = await createImageBlobWithTimeout(canvas, SHARE_IMAGE_TYPE);
            if (!blob) throw new Error('이미지 변환 실패');
            releasePreviewImage();
            const url = URL.createObjectURL(blob);
            els.previewImage.src = url;
            els.previewImage.dataset.objectUrl = url;
            if (window.SiteDialog) window.SiteDialog.open(els.previewModal, els.previewBtn);
            else els.previewModal.classList.add('show');
            setStatus('', '');
        } catch (error) {
            console.error('이미지 미리보기 실패:', error);
            setStatus('미리보기를 만들지 못했습니다.', 'error');
        } finally {
            els.previewBtn.disabled = false;
        }
    }

    function closePreviewModal() {
        if (window.SiteDialog) {
            window.SiteDialog.close(els.previewModal);
        } else {
            els.previewModal.classList.remove('show');
            releasePreviewImage();
        }
    }

    function releasePreviewImage() {
        const url = els.previewImage.dataset.objectUrl;
        if (url) {
            URL.revokeObjectURL(url);
            delete els.previewImage.dataset.objectUrl;
        }
        els.previewImage.removeAttribute('src');
    }

    function getClipboardImageType() {
        if (typeof ClipboardItem.supports === 'function' && ClipboardItem.supports(SHARE_IMAGE_TYPE)) {
            return SHARE_IMAGE_TYPE;
        }
        return 'image/png';
    }

    function createImageBlob(canvas, type) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('이미지 변환 실패'));
                }
            }, type, type === SHARE_IMAGE_TYPE ? SHARE_IMAGE_QUALITY : undefined);
        });
    }

    function createImageBlobWithTimeout(canvas, type) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error('이미지 압축 시간이 초과되었습니다.'));
            }, SHARE_IMAGE_BLOB_TIMEOUT_MS);

            createImageBlob(canvas, type).then(blob => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                resolve(blob);
            }).catch(error => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    async function createShareCanvas(characters, wheels) {
        const visibleWheels = filterShareWheels(wheels);
        const imageSources = [...new Set([
            ...characters.map(item => item.image_thumb),
            ...visibleWheels.map(item => item.image_path)
        ].filter(Boolean))];
        const loadedImages = new Map(await Promise.all(
            imageSources.map(async source => [source, await loadImage(source)])
        ));
        const padding = 28;
        const gap = 12;
        const titleHeight = 0;
        const sectionHeader = 34;
        const characterCard = { width: 116, height: 176, imageHeight: 116 };
        const wheelCard = { width: 103, height: 255, imageHeight: 209 };
        const characterCols = 9;
        const wheelCols = 10;
        const characterGridWidth = characterCols * characterCard.width + (characterCols - 1) * gap;
        const wheelGridWidth = wheelCols * wheelCard.width + (wheelCols - 1) * gap;
        const sectionWidth = Math.max(characterGridWidth, wheelGridWidth);
        const width = sectionWidth + padding * 2;
        const characterRows = Math.max(1, Math.ceil(characters.length / characterCols));
        const wheelRows = Math.max(1, Math.ceil(visibleWheels.length / wheelCols));
        const height = padding + titleHeight + sectionHeader + (characterRows * characterCard.height) + ((characterRows - 1) * gap)
            + 24 + sectionHeader + (wheelRows * wheelCard.height) + ((wheelRows - 1) * gap) + padding;

        const canvas = document.createElement('canvas');
        const scale = calculateShareCanvasScale(width, height, window.devicePixelRatio, {
            maxPixels: MAX_SHARE_CANVAS_PIXELS,
            maxDimension: MAX_SHARE_CANVAS_DIMENSION
        });
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#202024';
        ctx.fillRect(0, 0, width, height);

        let y = padding + titleHeight;
        y = await drawSection(ctx, '각성체', characters, {
            x: padding,
            y,
            cols: characterCols,
            card: characterCard,
            gap,
            sectionWidth,
            drawName: true,
            showName: false,
            getImage: item => item.image_thumb,
            loadedImages,
            getName: item => item.name,
            getBadge: item => getBreakthroughLabel(getCharacterBreakthrough(item.id))
        });

        y += 24;
        await drawSection(ctx, '명륜', visibleWheels, {
            x: padding,
            y,
            cols: wheelCols,
            card: wheelCard,
            gap,
            sectionWidth,
            drawName: false,
            getImage: item => item.image_path,
            loadedImages,
            getName: item => item.korean_name || item.english_name,
            getBadge: item => getBreakthroughLabel(getWheelBreakthrough(item.english_name))
        });

        return canvas;
    }

    async function drawSection(ctx, title, items, options) {
        const { x, cols, card, gap, drawName, getImage, getName, getBadge } = options;
        const showName = options.showName !== false;
        let y = options.y;
        const contentWidth = options.sectionWidth || (cols * card.width + (cols - 1) * gap);
        const gridWidth = cols * card.width + (cols - 1) * gap;
        const gridOffsetX = Math.max(0, (contentWidth - gridWidth) / 2);

        ctx.fillStyle = '#2a2a2e';
        roundRect(ctx, x - 10, y, contentWidth + 20, 30, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 16px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, x + contentWidth / 2, y + 21);
        ctx.textAlign = 'left';
        y += 42;

        if (items.length === 0) {
            ctx.strokeStyle = '#444444';
            ctx.setLineDash([5, 5]);
            roundRect(ctx, x, y, contentWidth, card.height, 6);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#777777';
            ctx.font = '700 14px Pretendard, sans-serif';
            ctx.fillText(`선택된 ${title} 없음`, x + 18, y + 34);
            return y + card.height;
        }

        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cardX = x + gridOffsetX + col * (card.width + gap);
            const cardY = y + row * (card.height + gap);

            ctx.fillStyle = '#2a2a2a';
            roundRect(ctx, cardX, cardY, card.width, card.height, 6);
            ctx.fill();

            const imageSource = getImage(item);
            const image = options.loadedImages?.get(imageSource) || await loadImage(imageSource);
            const imgWidth = drawName ? card.width - 10 : card.width;
            const imgHeight = card.imageHeight;
            const imgX = cardX + (card.width - imgWidth) / 2;
            const imgY = cardY + 5;
            drawImageCover(ctx, image, imgX, imgY, imgWidth, imgHeight);

            if (drawName && showName) {
                ctx.fillStyle = '#dddddd';
                ctx.font = '700 11px Pretendard, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(truncateText(ctx, getName(item), card.width - 8), cardX + card.width / 2, cardY + card.imageHeight + 23);
                if (getBadge) {
                    drawBreakthroughBadge(ctx, getBadge(item), cardX + card.width / 2, cardY + card.imageHeight + 34);
                }
                ctx.textAlign = 'left';
            } else if (drawName && getBadge) {
                drawBreakthroughBadge(ctx, getBadge(item), cardX + card.width / 2, cardY + card.imageHeight + 18, {
                    fontSize: 17,
                    minWidth: 54,
                    paddingX: 24,
                    height: 30
                });
            } else if (getBadge) {
                drawBreakthroughBadge(ctx, getBadge(item), cardX + card.width / 2, cardY + card.imageHeight + 11, {
                    fontSize: 17,
                    minWidth: 54,
                    paddingX: 24,
                    height: 30
                });
            }
        }

        return y + Math.ceil(items.length / cols) * card.height + (Math.ceil(items.length / cols) - 1) * gap;
    }

    function loadImage(src, timeoutMs = 10000) {
        return new Promise(resolve => {
            const image = new Image();
            let settled = false;
            const finish = result => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                resolve(result);
            };
            const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
            image.crossOrigin = 'anonymous';
            image.onload = () => finish(image);
            image.onerror = () => {
                if (src !== FALLBACK_IMAGE) {
                    loadImage(FALLBACK_IMAGE, timeoutMs).then(finish);
                } else {
                    finish(null);
                }
            };
            image.src = src || FALLBACK_IMAGE;
        });
    }

    function drawImageCover(ctx, image, x, y, width, height) {
        ctx.save();
        roundRect(ctx, x, y, width, height, 5);
        ctx.clip();
        ctx.fillStyle = '#111111';
        ctx.fillRect(x, y, width, height);
        if (image) {
            const scale = Math.max(width / image.width, height / image.height);
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
        }
        ctx.restore();
        ctx.strokeStyle = '#4a4a4a';
        roundRect(ctx, x, y, width, height, 5);
        ctx.stroke();
    }

    function drawBreakthroughBadge(ctx, label, centerX, y, options = {}) {
        ctx.save();
        const fontSize = options.fontSize || 12;
        const height = options.height || 20;
        ctx.font = `700 ${fontSize}px Pretendard, sans-serif`;
        const width = Math.max(options.minWidth || 38, ctx.measureText(label).width + (options.paddingX || 16));
        const x = centerX - width / 2;

        ctx.fillStyle = 'rgba(10, 10, 10, 0.78)';
        roundRect(ctx, x, y, width, height, height / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(label, centerX, y + Math.round(height / 2 + fontSize * 0.35));
        ctx.textAlign = 'left';
        ctx.restore();
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function truncateText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let value = text;
        while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
            value = value.slice(0, -1);
        }
        return `${value}…`;
    }

    function getCharacterGroups(id) {
        return findCharacterGroups(state.groupByCharacterId, id);
    }

    function getFilteredSelectedCharacters() {
        return filterSelectedCharacters({
            characters: state.characters,
            selectedCharacters: state.selectedCharacters,
            groupByCharacterId: state.groupByCharacterId,
            groupFilter: state.characterFilter,
            classFilter: state.characterClassFilter,
            search: state.search,
            matchesSearch: matchesInventorySearch
        });
    }

    function getFilteredSelectedWheels() {
        return filterSelectedWheels({
            wheels: state.wheels,
            selectedWheels: state.selectedWheels,
            gradeFilter: state.wheelFilter,
            search: state.search,
            matchesSearch: matchesInventorySearch
        });
    }

    function matchesInventorySearch(text, query) {
        const matcher = window.SearchUtils?.matchesSearchText;
        return matchesSearchText(text, query, matcher);
    }

    function removeUnavailableWheelSelections() {
        const reconciled = reconcileWheelState(
            state.wheels,
            state.selectedWheels,
            state.wheelBreakthroughs
        );
        state.selectedWheels = reconciled.selectedWheels;
        state.wheelBreakthroughs = reconciled.wheelBreakthroughs;
        if (reconciled.changed) saveState();
    }

    function removeUnavailableCharacterBreakthroughs() {
        const reconciled = reconcileCharacterBreakthroughs(
            state.characters,
            state.selectedCharacters,
            state.characterBreakthroughs
        );
        state.characterBreakthroughs = reconciled.characterBreakthroughs;
        if (reconciled.changed) saveState();
    }

    function setStatus(message, type) {
        els.copyStatus.setAttribute('role', type === 'error' ? 'alert' : 'status');
        els.copyStatus.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        els.copyStatus.className = `copy-status ${type || ''}`.trim();
        els.copyStatus.textContent = message || '';
        if (!message) return;

        const existing = document.querySelector('.inventory-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `inventory-toast ${type || ''}`.trim();
        toast.textContent = message;
        toast.setAttribute('aria-hidden', 'true');
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 2600);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }
})();
