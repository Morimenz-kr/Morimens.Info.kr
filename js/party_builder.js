/* js/party_builder.js - Party Builder browser controller */

import { createStorageAdapter, createVersionedStateStore, parseJson } from './party-builder/storage.js?v=v1.4.0-site-quality-20260713-r4';
import { createValidator } from './party-builder/validation.js?v=v1.4.0-site-quality-20260713-r4';
import * as Search from './party-builder/search.js?v=v1.4.0-site-quality-20260713-r4';
import {
    collectEquippedKeyIds,
    collectEquippedWheelIds,
    createKeyOptionModels,
    createWheelOptionModels,
    findDedicatedKey,
    findDedicatedWheel,
    withEquippedKey,
    withEquippedWheel
} from './party-builder/equipment.js?v=v1.4.0-site-quality-20260713-r4';
import {
    applyCharacterSelection,
    applySupport,
    createPartyStateFactory,
    moveTeam,
    removeSupportFromPage,
    replaceTeamComposition,
    resolvePageIndexAfterDeletion,
    resetTeam
} from './party-builder/team-state.js?v=v1.4.0-site-quality-20260713-r4';
import { parseAndSanitizeTeamShare, serializeTeamShare } from './party-builder/share.js?v=v1.4.0-site-quality-20260713-r4';
import { createPartyModalController } from './party-builder/modal-controller.js?v=v1.4.0-site-quality-20260713-r4';
import { bootstrapPartyBuilder, loadRequiredPartyBuilderData } from './party-builder/bootstrap.js?v=v1.4.0-site-quality-20260713-r4';
import { createItemTooltipController } from './ui/item-tooltip.js?v=v1.4.0-site-quality-20260713-r4';

const Storage = Object.freeze({
    ...createStorageAdapter(() => window.localStorage),
    parseJson
});
const partyTooltipController = createItemTooltipController({
    document,
    window,
    tooltipElement: document.getElementById('global-tooltip'),
    visibleClass: 'show',
    positionTooltip: positionPartyTooltip
});
const normalizeWheelMainStat = Search.normalizeWheelMainStat;
const normalizeDedicatedTarget = Search.normalizeDedicatedTarget;

// [1] 상수 및 설정 데이터
const MAX_TEAMS = 10;
const MAX_PAGES = 5;
const INVENTORY_STORAGE_KEY = 'morimens_inventory_checker_v2';
const PARTY_STORAGE_KEY = 'morimens_v2_pages';
const LEGACY_PARTY_STORAGE_KEY = 'morimens_v2';
const RECENT_KEYS_STORAGE_KEY = 'morimens_recent_keys';
const PARTY_STORAGE_VERSION = 3;
const TEAM_TAB_DESKTOP_QUERY = '(min-width: 56.25rem)';
const ROMAN_NUMS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const { createEmptyTeam, createEmptyPage } = createPartyStateFactory({
    maxTeams: MAX_TEAMS,
    romanNumerals: ROMAN_NUMS
});
const DEFAULT_PARTY_BUILDER_RULES = {
    exclusive_groups: [["ramona", "ramona_timeworn"]],
    character_tags: {},
    tag_aliases: {},
    dedicated_wheel_aliases: {}
};
let draggedIdx = -1;
let lastHoverIdx = -1;
let teamTabTouchState = null;
let skipNextTeamTabClick = false;
let stateValidator = null;
let stateStore = null;
let staticControlsBound = false;
let initializationPromise = null;
let saveErrorPortalReturn = null;

// 최근 사용한 은열쇠 식별자 저장소 (로컬 스토리지 연동)
let recentKeys = [];

// [3] 전역 상태 관리
let allPages = [createEmptyPage("PAGE 1")];
let currentPageIdx = 0;
let currentTeamIdx = 0;
const partyModalController = createPartyModalController({
    document,
    window,
    getFallbackSelector: getPartyModalFallbackSelector,
    onClose: handlePartyModalClose
});
const openModal = partyModalController.open;
const closeModal = partyModalController.close;

let DB = { chars: [], wheels: [], keys: [] };
let PARTY_BUILDER_RULES = { ...DEFAULT_PARTY_BUILDER_RULES };

// 필터 및 검색 관련 변수
let activeCharFilters = { domain: new Set(), class: new Set() };
let activeCharSearchTags = new Set();
let activeWheelTags = new Set();
let activeWheelMainStats = new Set();
let tempChars = [];
let isSupportSelectionMode = false;
let editingCharIdx = -1;
let selectedWheelSlotIdx = 0;
let ownedOnlyFilters = { characters: false, wheels: false };

function readOwnedInventory() {
    try {
        const saved = Storage.parseJson(Storage.getRaw(INVENTORY_STORAGE_KEY), {});
        return {
            characters: new Set(Array.isArray(saved?.characters) ? saved.characters.map(String) : []),
            wheels: new Set(Array.isArray(saved?.wheels) ? saved.wheels.filter(value => typeof value === 'string') : [])
        };
    } catch (error) {
        console.warn('보유량 체크 상태를 읽지 못했습니다.', error);
        return { characters: new Set(), wheels: new Set() };
    }
}

function toggleOwnedOnly(type) {
    ownedOnlyFilters[type] = !ownedOnlyFilters[type];
    updateOwnedOnlyToggle(type);
    if (type === 'characters') renderCharGrid();
    else renderWheelList();
}

function updateOwnedOnlyToggle(type) {
    const button = document.getElementById(type === 'characters' ? 'owned-char-toggle' : 'owned-wheel-toggle');
    if (!button) return;
    const enabled = ownedOnlyFilters[type];
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-checked', String(enabled));
}

function renderOwnedInventoryEmpty(container, type) {
    const subject = type === 'characters' ? '각성체가' : '명륜이';
    container.innerHTML = `
        <div class="owned-inventory-empty">
            <strong>보유 ${subject} 등록되어 있지 않습니다.</strong>
            <span>보유량 체크에서 가진 항목을 먼저 선택해 주세요.</span>
            <a href="inventory_checker.html">보유량 체크로 이동</a>
        </div>`;
}

function renderNoResults(container, message) {
    const empty = document.createElement('p');
    empty.className = 'no-result-message';
    empty.textContent = message;
    container.appendChild(empty);
}

// [4] 태그 및 메타데이터 정의
const ALL_KEY_TAGS = Search.KEY_TAGS;
const ALL_SEARCH_TAGS = Search.WHEEL_TAGS;
const wheelKeywordMatcher = Search.createKeywordMatcher(ALL_SEARCH_TAGS);
const keyKeywordMatcher = Search.createKeywordMatcher(ALL_KEY_TAGS);

const CHAR_TAG_MAP = {};
const TAG_ALIASES = {};
function getCharacterTagMap() {
    return Object.keys(PARTY_BUILDER_RULES.character_tags || {}).length > 0
        ? PARTY_BUILDER_RULES.character_tags
        : CHAR_TAG_MAP;
}

function getTagAliases() {
    return Object.keys(PARTY_BUILDER_RULES.tag_aliases || {}).length > 0
        ? PARTY_BUILDER_RULES.tag_aliases
        : TAG_ALIASES;
}

function getAllCharTagNames() {
    return Object.keys(getCharacterTagMap());
}

// [5] 커스텀 입력을 위한 시스템 모달 통합 (Prompt 대체)
function openPageInputModal(mode) {
    const wrapper = document.getElementById('sys-input-wrapper');
    const input = document.getElementById('sys-modal-input');
    const countDisplay = document.getElementById('sys-modal-char-count');

    wrapper.hidden = false;
    input.maxLength = 15;
    const editPageIndex = targetRenameIndex !== -1 ? targetRenameIndex : currentPageIdx;

    // 초기값 세팅: 수정 모드일 경우 타겟 인덱스 또는 현재 인덱스 사용
    if (mode === 'new') {
        input.value = `PAGE ${allPages.length + 1}`;
    } else if (mode === 'team') {
        input.value = allPages[currentPageIdx].teams[currentTeamIdx].name;
    } else {
        input.value = allPages[editPageIndex].pageName;
    }

    if (countDisplay) countDisplay.textContent = `${input.value.length} / 15`;

    input.oninput = () => {
        if (countDisplay) countDisplay.textContent = `${input.value.length} / 15`;
    };

    openSystemConfirm(mode === 'new' ? "새 페이지 추가" : "이름 변경", "이름을 입력해주세요. (최대 15자)", () => {
        const val = input.value.trim();
        if (!val) return;

        if (mode === 'new') {
            allPages.push(createEmptyPage(val));
            currentPageIdx = allPages.length - 1;
            currentTeamIdx = 0;
        } else if (mode === 'team') {
            allPages[currentPageIdx].teams[currentTeamIdx].name = val;
        } else {
            allPages[editPageIndex].pageName = val;
        }

        targetRenameIndex = -1; // 인덱스 초기화
        wrapper.hidden = true;
        renderAll();
        saveAllData(true);
    }, { initialFocus: '#sys-modal-input' });

    document.getElementById('sys-btn-no').onclick = () => {
        targetRenameIndex = -1; // 인덱스 초기화
        wrapper.hidden = true;
        closeModal('modal-system');
    };
}

// [6] 초기화 및 데이터 로드 로직
document.addEventListener('DOMContentLoaded', async () => {
    partyModalController.setup();
    updateBackButtonLabel();
    document.getElementById('party-init-retry')?.addEventListener('click', initializePartyBuilder);
    await initializePartyBuilder();
});

function bindStaticControls() {
    if (staticControlsBound) return;
    staticControlsBound = true;
    const bindings = [
        ['add-page-btn', addNewPage],
        ['edit-team-name-btn', editTeamName],
        ['copy-team-btn', copyTeamToClipboard],
        ['paste-team-btn', pasteTeamFromClipboard],
        ['reset-team-btn', resetCurrentTeam],
        ['open-key-modal-btn', openKeyModal],
        ['quick-setup-btn', openQuickSetup],
        ['save-party-btn', () => saveAllData()],
        ['btn-remove-support', removeSupport],
        ['confirm-quick-setup-btn', confirmQuickSetup],
        ['unequip-wheel-btn', unequipSelectedWheel],
        ['unequip-key-btn', unequipKey],
        ['btn-equip-ssr', () => equipDedicatedWheel('SSR')],
        ['btn-equip-sr', () => equipDedicatedWheel('SR')],
        ['btn-equip-key', equipDedicatedKey]
    ];

    bindings.forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener('click', handler);
    });

    document.querySelectorAll('[data-close-modal]').forEach(button => {
        button.addEventListener('click', () => closeModal(button.dataset.closeModal));
    });

    document.querySelectorAll('.filter-chip[data-filter-type][data-filter-value]').forEach(button => {
        button.addEventListener('click', () => toggleCharFilter(button.dataset.filterType, button.dataset.filterValue));
    });

    document.getElementById('owned-char-toggle')?.addEventListener('click', () => toggleOwnedOnly('characters'));
    document.getElementById('owned-wheel-toggle')?.addEventListener('click', () => toggleOwnedOnly('wheels'));
    document.getElementById('key-sort-select')?.addEventListener('change', renderKeyGrid);
    document.getElementById('sys-modal-input')?.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        document.getElementById('sys-btn-yes')?.click();
    });
    document.querySelectorAll('[data-wheel-slot]').forEach(button => {
        button.addEventListener('click', () => selectWheelSlot(Number(button.dataset.wheelSlot)));
    });

    const layoutQuery = window.matchMedia(TEAM_TAB_DESKTOP_QUERY);
    const handleLayoutChange = () => renderSidebar();
    if (typeof layoutQuery.addEventListener === 'function') layoutQuery.addEventListener('change', handleLayoutChange);
    else if (typeof layoutQuery.addListener === 'function') layoutQuery.addListener(handleLayoutChange);
}

async function loadExternalData() {
    const version = new URL(import.meta.url).searchParams.get('v') || 'party-builder';
    return loadRequiredPartyBuilderData({
        fetchImpl: window.fetch.bind(window),
        version
    });
}

async function initializePartyBuilder() {
    if (initializationPromise) return initializationPromise;
    const retryButton = document.getElementById('party-init-retry');
    if (retryButton) retryButton.disabled = true;
    setPartyBuilderInteractive(false);

    initializationPromise = bootstrapPartyBuilder({
        loadData: loadExternalData,
        onDataReady(data) {
            DB = {
                chars: data.characters,
                wheels: data.wheels,
                keys: data.keys
            };
            PARTY_BUILDER_RULES = data.rules;
            stateValidator = createValidator({
                characters: DB.chars,
                wheels: DB.wheels,
                keys: DB.keys,
                maxTeams: MAX_TEAMS,
                maxPages: MAX_PAGES,
                createEmptyTeam,
                createEmptyPage
            });
            stateStore = createVersionedStateStore({
                storage: Storage,
                key: PARTY_STORAGE_KEY,
                legacyKey: LEGACY_PARTY_STORAGE_KEY,
                version: PARTY_STORAGE_VERSION,
                maxTeams: MAX_TEAMS,
                validator: stateValidator
            });
            recentKeys = Storage.readStringArray(RECENT_KEYS_STORAGE_KEY, 20);
            assignTagsToWheels();
            assignTagsToKeys();
            loadFromLocalStorage();
            renderAll();
            bindStaticControls();
        }
    }).then(() => {
        setPartyInitializationError('');
        setPartyBuilderInteractive(true);
    }).catch(error => {
        console.error('Party builder initialization failed:', error);
        stateValidator = null;
        stateStore = null;
        setPartyInitializationError(
            '필수 데이터를 불러오지 못해 편집과 저장을 잠갔습니다. 기존 저장 데이터는 변경하지 않았습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.'
        );
        requestAnimationFrame(() => retryButton?.focus({ preventScroll: true }));
    }).finally(() => {
        initializationPromise = null;
        if (retryButton) retryButton.disabled = false;
    });

    return initializationPromise;
}

function setPartyBuilderInteractive(interactive) {
    const main = document.getElementById('party-builder-main');
    const skipLink = document.querySelector('.skip-link');
    const reportButton = document.querySelector('.floating-report-btn');
    if (main) {
        main.inert = !interactive;
        main.setAttribute('aria-busy', String(!interactive));
    }
    [skipLink, reportButton].forEach(element => {
        if (!element) return;
        element.inert = !interactive;
        element.setAttribute('aria-disabled', String(!interactive));
    });
}

function setPartyInitializationError(message) {
    const panel = document.getElementById('party-init-error');
    const text = document.getElementById('party-init-error-message');
    if (!panel || !text) return;
    text.textContent = message || '';
    panel.hidden = !message;
}

function assignTagsToWheels() {
    DB.wheels.forEach(wheel => {
        wheel.tags = wheelKeywordMatcher.find(`${wheel.description || ''} ${wheel.main_stat || ''}`);
    });
}

function assignTagsToKeys() {
    if(!DB.keys) return;
    DB.keys.forEach(key => {
        const combinedTags = new Set([
            ...(Array.isArray(key.tags) ? key.tags : []),
            ...keyKeywordMatcher.find(`${key.description || ''} ${key.korean_name || ''}`)
        ]);
        key.tags = Array.from(combinedTags);
    });
}

function loadFromLocalStorage() {
    const loaded = stateStore.load(allPages);
    allPages = loaded.pages;
    currentPageIdx = loaded.currentPageIdx;
    currentTeamIdx = loaded.currentTeamIdx;

    if (loaded.recoveredCorruption) {
        showToast('손상된 저장 데이터를 복구해 새 편성으로 시작합니다.');
    }
    if (loaded.needsRewrite && saveAllData(true) && loaded.usedLegacy) stateStore.clearLegacy();
}

function saveAllData(silent = false) {
    if (!stateStore) {
        const message = '데이터가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.';
        setPersistentSaveError(message);
        showToast(message, 'error');
        return false;
    }
    const saved = stateStore.save({
        currentPageIdx,
        currentTeamIdx,
        pages: allPages
    });
    if (!saved) {
        const message = '저장하지 못했습니다. 이 상태에서 새로고침하면 변경 내용이 사라질 수 있습니다. 브라우저 저장 공간과 권한을 확인한 뒤 다시 저장해 주세요.';
        setPersistentSaveError(message);
        showToast(message, 'error');
        return false;
    }
    setPersistentSaveError('');
    if (!silent) showToast('저장됨 ✓');
    return true;
}

function setPersistentSaveError(message) {
    const alert = document.getElementById('party-save-error');
    if (!alert) return;
    if (message) movePersistentSaveErrorToActiveDialog(alert);
    alert.textContent = message || '';
    alert.hidden = !message;
    if (!message) restorePersistentSaveErrorPortal(alert);
}

function movePersistentSaveErrorToActiveDialog(alert) {
    const topOverlay = document.getElementById(partyModalController.getTopId());
    const dialog = partyModalController.getDialog(topOverlay);
    if (!dialog || dialog === alert.parentNode) return;
    restorePersistentSaveErrorPortal(alert);
    saveErrorPortalReturn = {
        parent: alert.parentNode,
        nextSibling: alert.nextSibling
    };
    dialog.append(alert);
    alert.inert = false;
    alert.dataset.modalPortal = 'true';
}

function restorePersistentSaveErrorPortal(alert = document.getElementById('party-save-error')) {
    if (!alert || !saveErrorPortalReturn) return;
    const { parent, nextSibling } = saveErrorPortalReturn;
    saveErrorPortalReturn = null;
    delete alert.dataset.modalPortal;
    if (!parent?.isConnected) return;
    if (nextSibling?.parentNode === parent) parent.insertBefore(alert, nextSibling);
    else parent.append(alert);
}

function showToast(msg, tone = 'success') {
    const existing = document.querySelector('.save-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = `save-toast save-toast-${tone}`;
    t.setAttribute('aria-hidden', 'true');
    t.textContent = msg;
    document.body.appendChild(t);
    const liveRegion = document.getElementById('party-live-region');
    if (liveRegion && tone !== 'error') {
        liveRegion.textContent = '';
        requestAnimationFrame(() => { liveRegion.textContent = msg; });
    }
    setTimeout(() => { if (t.parentNode) t.remove(); }, 2000);
}

// [7] 페이지 및 팀 관리 기능
function addNewPage() {
    if (allPages.length >= MAX_PAGES) {
        openSystemAlert('추가 불가', `세트는 최대 ${MAX_PAGES}개까지 만들 수 있습니다.`);
        return;
    }
    openPageInputModal('new');
}
function renameCurrentPage() { openPageInputModal('rename'); }
function editTeamName() { openPageInputModal('team'); }

// [8] 렌더링 엔진 (Tabs, Sidebar, Main)
function renderAll() {
    renderPageTabs();
    renderSidebar();
    renderMain();
}

function renderPageTabs() {
    const container = document.getElementById('page-tabs');
    if (!container) return;
    container.innerHTML = '';

    allPages.forEach((page, i) => {
        const shell = document.createElement('div');
        shell.className = `page-tab-shell${i === currentPageIdx ? ' active' : ''}`;

        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'page-tab';
        tab.id = `page-tab-${i}`;
        tab.dataset.pageIndex = i;
        tab.setAttribute('aria-pressed', String(i === currentPageIdx));
        tab.setAttribute('aria-label', `${page.pageName} 세트 선택`);
        tab.tabIndex = i === currentPageIdx ? 0 : -1;
        const tabName = document.createElement('span');
        tabName.className = 'tab-name-text';
        tabName.textContent = page.pageName;
        tab.appendChild(tabName);

        const activatePage = () => {
            currentPageIdx = i;
            currentTeamIdx = 0;
            renderAll();
            saveAllData(true);
            requestAnimationFrame(() => {
                document.getElementById(`page-tab-${currentPageIdx}`)?.focus({ preventScroll: true });
            });
        };
        tab.addEventListener('click', activatePage);
        tab.addEventListener('keydown', event => handleSelectionKeydown(event, container, i, allPages.length, activatePage));

        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.className = 'page-tab-action edit-page-tab';
        renameButton.dataset.pageIndex = i;
        renameButton.setAttribute('aria-label', `${page.pageName} 이름 변경`);
        renameButton.title = '이름 변경';
        renameButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z"/></svg>';
        renameButton.addEventListener('click', () => renamePage(i));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'page-tab-action delete-page-tab';
        deleteButton.dataset.pageIndex = i;
        deleteButton.setAttribute('aria-label', `${page.pageName} 삭제`);
        deleteButton.title = '페이지 삭제';
        deleteButton.textContent = '×';
        deleteButton.disabled = allPages.length <= 1;
        deleteButton.addEventListener('click', () => deletePage(i));

        shell.append(tab, renameButton, deleteButton);
        container.appendChild(shell);
    });

    const addButton = document.getElementById('add-page-btn');
    if (addButton) addButton.disabled = allPages.length >= MAX_PAGES;
}

function handleSelectionKeydown(event, container, currentIndex, itemCount, activateCurrent) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = itemCount - 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + itemCount) % itemCount;
    else nextIndex = (currentIndex + 1) % itemCount;

    const tabs = [...container.querySelectorAll('button[aria-pressed]')];
    if (nextIndex === currentIndex) {
        activateCurrent();
        return;
    }
    tabs[nextIndex]?.click();
    requestAnimationFrame(() => {
        const updatedTabs = [...container.querySelectorAll('button[aria-pressed]')];
        updatedTabs[nextIndex]?.focus({ preventScroll: true });
    });
}

let targetRenameIndex = -1; // 수정 대상을 추적하기 위한 전역 변수
function renamePage(index) {
    targetRenameIndex = index;
    openPageInputModal('rename');
}

function deletePage(index) {
    if (allPages.length <= 1) {
        openSystemAlert("경고", "최소 하나 이상의 페이지는 유지되어야 합니다.");
        return;
    }

    const targetName = allPages[index].pageName;
    openSystemConfirm("페이지 삭제", `[${targetName}] 페이지 전체를 삭제하시겠습니까?`, () => {
        allPages.splice(index, 1);
        currentPageIdx = resolvePageIndexAfterDeletion(currentPageIdx, index, allPages.length);
        currentTeamIdx = 0;
        renderAll();
        saveAllData(true);
    }, {
        resolveSuccessFocus: () => document.getElementById(`page-tab-${currentPageIdx}`)
    });
}

function renderSidebar() {
    const container = document.getElementById('sidebar-tabs');
    if (!container) return;
    container.innerHTML = '';
    const currentTeams = allPages[currentPageIdx].teams;
    const isVertical = window.matchMedia(TEAM_TAB_DESKTOP_QUERY).matches;

    currentTeams.forEach((t, i) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `team-tab ${i === currentTeamIdx ? 'active' : ''} ${t.chars.some(x => x) ? 'filled' : ''}`;
        tab.textContent = ROMAN_NUMS[i];
        tab.dataset.index = i;
        tab.draggable = isVertical;
        tab.id = `team-tab-${i}`;
        tab.setAttribute('aria-pressed', String(i === currentTeamIdx));
        tab.setAttribute('aria-label', `${t.name} 선택${t.chars.some(Boolean) ? ', 편성 있음' : ', 빈 편성'}`);
        tab.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight');
        tab.title = '선택: Enter 또는 Space · 순서 이동: Alt+방향키';
        tab.tabIndex = i === currentTeamIdx ? 0 : -1;

        const handleStart = (idx) => {
            draggedIdx = idx;
            lastHoverIdx = idx;
            tab.classList.add('dragging');
            tab.setAttribute('aria-grabbed', 'true');
        };

        const handleMove = (hoverIdx) => {
            if (draggedIdx === -1) return;
            lastHoverIdx = hoverIdx;
            container.querySelectorAll('.team-tab').forEach(element => {
                element.classList.toggle('drop-target', Number(element.dataset.index) === hoverIdx && hoverIdx !== draggedIdx);
            });
        };

        const handleEnd = (commit = true) => {
            tab.classList.remove('dragging');
            tab.removeAttribute('aria-grabbed');
            container.querySelectorAll('.team-tab').forEach(element => {
                element.classList.remove('drop-target');
                element.style.pointerEvents = '';
            });

            const from = draggedIdx;
            const to = lastHoverIdx;
            draggedIdx = -1;
            lastHoverIdx = -1;

            if (commit && from !== -1 && to !== -1 && from !== to) executeSwap(from, to);
        };

        tab.ondragstart = (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.setData("text/plain", i);
                e.dataTransfer.effectAllowed = "move";
            }
            handleStart(i);
        };
        tab.ondragover = (e) => {
            e.preventDefault();
            handleMove(i);
        };
        tab.ondrop = (e) => {
            e.preventDefault();
            handleEnd();
        };
        tab.ondragend = () => handleEnd();

        tab.addEventListener('pointerdown', event => {
            if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
            window.clearTimeout(teamTabTouchState && teamTabTouchState.timer);
            teamTabTouchState = {
                index: i,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                dragging: false,
                moved: false,
                timer: window.setTimeout(() => {
                    if (!teamTabTouchState || teamTabTouchState.index !== i || teamTabTouchState.moved) return;
                    teamTabTouchState.dragging = true;
                    tab.setPointerCapture?.(event.pointerId);
                    handleStart(i);
                    if (navigator.vibrate) navigator.vibrate(10);
                }, 420)
            };
        });

        tab.addEventListener('pointermove', event => {
            if (!teamTabTouchState || teamTabTouchState.index !== i) return;
            const deltaX = event.clientX - teamTabTouchState.startX;
            const deltaY = event.clientY - teamTabTouchState.startY;
            const movedEnough = Math.hypot(deltaX, deltaY) > 8;

            if (!teamTabTouchState.dragging) {
                if (movedEnough) {
                    teamTabTouchState.moved = true;
                    window.clearTimeout(teamTabTouchState.timer);
                }
                return;
            }

            event.preventDefault();

            tab.style.pointerEvents = 'none';
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.team-tab');
            tab.style.pointerEvents = '';

            if (target) handleMove(Number(target.dataset.index));
        }, { passive: false });

        const finishPointerInteraction = (event, cancelled = false) => {
            if (!teamTabTouchState || teamTabTouchState.index !== i) return;

            window.clearTimeout(teamTabTouchState.timer);
            const wasDragging = teamTabTouchState.dragging;
            const wasMoved = teamTabTouchState.moved;
            teamTabTouchState = null;

            if (wasDragging) {
                event.preventDefault();
                skipNextTeamTabClick = true;
                window.setTimeout(() => { skipNextTeamTabClick = false; }, 350);
                handleEnd(!cancelled);
            } else if (wasMoved) {
                skipNextTeamTabClick = true;
                window.setTimeout(() => { skipNextTeamTabClick = false; }, 350);
            }
        };
        tab.addEventListener('pointerup', event => finishPointerInteraction(event));
        tab.addEventListener('pointercancel', event => finishPointerInteraction(event, true));

        tab.addEventListener('click', () => {
            if (skipNextTeamTabClick) return;
            currentTeamIdx = i;
            renderAll();
            saveAllData(true);
            requestAnimationFrame(() => {
                document.getElementById(`team-tab-${currentTeamIdx}`)?.focus({ preventScroll: true });
            });
        });

        tab.addEventListener('keydown', event => {
            const reorderKey = isVertical
                ? (event.key === 'ArrowUp' || event.key === 'ArrowDown')
                : (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
            if (event.altKey && reorderKey) {
                event.preventDefault();
                const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
                const targetIndex = Math.max(0, Math.min(MAX_TEAMS - 1, i + offset));
                if (targetIndex !== i) {
                    executeSwap(i, targetIndex);
                    requestAnimationFrame(() => document.getElementById(`team-tab-${targetIndex}`)?.focus({ preventScroll: true }));
                }
                return;
            }
            handleSelectionKeydown(event, container, i, currentTeams.length, () => tab.click());
        });

        container.appendChild(tab);
    });
}

function executeSwap(fromIdx, toIdx) {
    const currentPage = allPages[currentPageIdx];
    const result = moveTeam(currentPage.teams, fromIdx, toIdx, currentTeamIdx);
    if (!result.changed) return;

    allPages[currentPageIdx] = { ...currentPage, teams: result.teams };
    currentTeamIdx = result.currentTeamIndex;

    renderAll();
    saveAllData(true);
}

function renderMain() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    document.getElementById('team-title-text').textContent = team.name;
    renderTeamDomainImage(team);
    const sBox = document.getElementById('team-slots');
    sBox.innerHTML = '';

    const localUsedMap = new Set();
    allPages[currentPageIdx].teams.forEach((t, tIdx) => {
        if (tIdx === currentTeamIdx) return;
        t.chars.forEach((c, sIdx) => { if(c && t.supportIdx !== sIdx) localUsedMap.add(c); });
    });

    for(let i=0; i<4; i++) {
        const cid = team.chars[i];
        const isSupport = (team.supportIdx === i);
        const slotWrapper = document.createElement('div');
        slotWrapper.className = 'slot-wrapper';
        const card = document.createElement('article');
        card.className = 'char-card';
        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'char-select-action';
        selectButton.dataset.charSlot = i;

        if(cid) {
            const info = DB.chars.find(x => String(x.id) === cid);
            const charGroup = PARTY_BUILDER_RULES.exclusive_groups.find(g => g.includes(String(cid)));
            const isAlterConflict = charGroup && team.chars.some((tid, idx) => i !== idx && tid && charGroup.includes(String(tid)));
            const isGlobalDuplicate = !isSupport && localUsedMap.has(cid);

            const conflictText = isAlterConflict ? "출전 불가" : (isGlobalDuplicate ? "사용중" : "");
            const displayName = info ? info.name : '알 수 없는 각성체';

            const w1 = team.wheels[i][0]; const w2 = team.wheels[i][1];
            const w1Info = DB.wheels.find(x => x.english_name === w1);
            const w2Info = DB.wheels.find(x => x.english_name === w2);
            const charImg = info ? `images/${info.id}_tide.webp` : 'images/smile_Ramona.webp';
            selectButton.setAttribute('aria-label', `${i + 1}번 슬롯 ${displayName}${isSupport ? ', 조력자' : ''}${conflictText ? `, ${conflictText}` : ''}. 각성체 편집`);

            const portrait = document.createElement('img');
            portrait.src = charImg;
            portrait.alt = '';
            portrait.className = 'char-tide-img';
            portrait.loading = 'lazy';
            portrait.addEventListener('error', () => {
                const fallback = info?.image_thumb || 'images/smile_Ramona.webp';
                if (portrait.src.endsWith(fallback)) return;
                portrait.src = fallback;
            }, { once: true });
            selectButton.appendChild(portrait);

            if (info) {
                const topInfo = document.createElement('span');
                topInfo.className = 'char-top-info';
                const domainIcon = document.createElement('img');
                domainIcon.src = `images/character_${info.relems}.webp`;
                domainIcon.alt = '';
                domainIcon.className = 'char-top-icon';
                const name = document.createElement('span');
                name.className = 'char-top-name';
                name.textContent = displayName;
                topInfo.append(domainIcon, name);
                selectButton.appendChild(topInfo);
            }

            if (isSupport) {
                const supportBadge = document.createElement('span');
                supportBadge.className = 'char-top-support';
                supportBadge.textContent = '조력';
                selectButton.appendChild(supportBadge);
            }

            if (conflictText) {
                const overlay = document.createElement('span');
                overlay.className = 'card-conflict-overlay';
                const conflict = document.createElement('span');
                conflict.className = 'conflict-bar';
                conflict.textContent = conflictText;
                overlay.appendChild(conflict);
                selectButton.appendChild(overlay);
            }

            selectButton.addEventListener('click', openQuickSetup);
            card.appendChild(selectButton);

            const bottomOverlay = document.createElement('div');
            bottomOverlay.className = 'card-bottom-overlay';
            bottomOverlay.setAttribute('aria-hidden', 'true');
            card.appendChild(bottomOverlay);

            const wheelsWrapper = document.createElement('div');
            wheelsWrapper.className = 'wheels-wrapper';
            [w1Info, w2Info].forEach((wheelInfo, slotIdx) => {
                const slotButton = document.createElement('button');
                slotButton.type = 'button';
                slotButton.className = 'slot-wheel';
                slotButton.dataset.charSlot = i;
                slotButton.dataset.wheelSlotIndex = slotIdx;
                slotButton.setAttribute('aria-label', `${displayName} ${slotIdx + 1}번 명륜 슬롯${wheelInfo ? `, ${wheelInfo.korean_name} 장착됨` : ', 비어 있음'}`);
                if (wheelInfo) {
                    const wheelImage = document.createElement('img');
                    wheelImage.src = wheelInfo.image_path;
                    wheelImage.alt = '';
                    wheelImage.loading = 'lazy';
                    slotButton.appendChild(wheelImage);
                    bindTooltipEvents(slotButton, wheelInfo);
                } else {
                    slotButton.textContent = '+';
                }
                slotButton.addEventListener('click', event => openWheelModal(i, slotIdx, event));
                wheelsWrapper.appendChild(slotButton);
            });
            card.appendChild(wheelsWrapper);
        } else {
            card.classList.add('empty');
            selectButton.setAttribute('aria-label', `${i + 1}번 빈 슬롯, 각성체 선택`);
            const cross = document.createElement('span');
            cross.className = 'empty-cross';
            cross.setAttribute('aria-hidden', 'true');
            const emptyText = document.createElement('span');
            emptyText.className = 'empty-text';
            emptyText.textContent = '각성체 선택';
            selectButton.append(cross, emptyText);
            selectButton.addEventListener('click', openQuickSetup);
            card.appendChild(selectButton);
        }

        slotWrapper.appendChild(card);
        if (i === 3) {
            const supportButton = document.createElement('button');
            supportButton.type = 'button';
            supportButton.className = 'support-setup-btn';
            supportButton.setAttribute('aria-label', '조력자 설정');
            supportButton.innerHTML = '<span class="support-label-full">조력 설정</span><span class="support-label-short" aria-hidden="true">조력</span>';
            supportButton.addEventListener('click', openSupportSelector);
            slotWrapper.appendChild(supportButton);
        }
        sBox.appendChild(slotWrapper);
    }

    const kInfo = DB.keys.find(x => x.english_name === team.key);
    const keyIcon = document.getElementById('key-icon');
    keyIcon.replaceChildren();
    if (kInfo) {
        const image = document.createElement('img');
        image.src = kInfo.image_path;
        image.alt = '';
        keyIcon.appendChild(image);
    } else {
        keyIcon.textContent = '+';
    }
    const keyName = document.getElementById('key-name');
    keyName.textContent = kInfo ? kInfo.korean_name : '장착 안 함';
    keyName.classList.toggle('is-empty', !kInfo);
    document.getElementById('open-key-modal-btn')?.setAttribute('aria-label', kInfo ? `은열쇠 변경, 현재 ${kInfo.korean_name}` : '은열쇠 선택, 현재 장착 안 함');
}

function getActiveDomains(team) {
    const domSet = new Set();
    team.chars.forEach(cid => { if(cid) { const ch = DB.chars.find(x => String(x.id) === cid); if(ch) domSet.add(ch.relems); } });
    return domSet;
}

function getDomainsWithSupportCandidate(team, candidateId) {
    const domSet = new Set();
    team.chars.forEach((cid, idx) => {
        if (!cid || idx === team.supportIdx || cid === candidateId) return;
        const ch = DB.chars.find(x => String(x.id) === cid);
        if (ch) domSet.add(ch.relems);
    });

    const candidate = DB.chars.find(x => String(x.id) === String(candidateId));
    if (candidate) domSet.add(candidate.relems);
    return domSet;
}

function renderTeamDomainImage(team) {
    const container = document.getElementById('team-domain-container');
    container.innerHTML = '';
    const domArr = Array.from(getActiveDomains(team));
    container.removeAttribute('aria-label');
    if (domArr.length === 0) return;

    if (domArr.length > 2) {
        container.setAttribute('aria-label', '계역 충돌: 세 개 이상의 계역이 편성되었습니다.');
        return;
    }

    const circleDiv = document.createElement('div');
    circleDiv.className = 'team-domain-circle';
    const sortOrder = ['chaos', 'aequor', 'caro', 'ultra'];
    domArr.sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));
    const fileName = domArr.length === 1 ? `pure_${domArr[0]}.webp` : `${domArr[0]}_${domArr[1]}.webp`;
    const image = document.createElement('img');
    image.src = `images/${fileName}`;
    image.className = 'team-domain-img';
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    circleDiv.appendChild(image);
    container.appendChild(circleDiv);
    container.setAttribute('aria-label', `현재 계역: ${domArr.join(', ')}`);
}

function resetCurrentTeam() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    const charNames = team.chars
        .filter(id => id)
        .map(id => { const c = DB.chars.find(x => x.id === id); return c ? c.name : id; });
    const preview = charNames.length ? `\n현재 편성: ${charNames.join(', ')}` : '';
    openSystemConfirm("팀 초기화", `[${team.name}] 팀 설정을 초기화합니다.${preview}\n\n되돌릴 수 없습니다.`, () => {
        allPages[currentPageIdx].teams[currentTeamIdx] = resetTeam(team);
        renderAll(); saveAllData(true);
    });
}

// [9] 캐릭터 편성 로직
function openQuickSetup() {
    isSupportSelectionMode = false;
    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    tempChars = team.supportIdx === 3 ? team.chars.slice(0, 3).filter(x => x) : team.chars.filter(x => x);
    initCharModal();
}

function openSupportSelector(e) {
    if(e) e.stopPropagation();
    isSupportSelectionMode = true;
    tempChars = [];

    // 조력자 선택 모드일 때만 해제 버튼 표시
    const removeBtn = document.getElementById('btn-remove-support');
    if (removeBtn) removeBtn.hidden = false;

    initCharModal();
}

function applySupportToCurrentTeam(charId) {
    allPages[currentPageIdx] = applySupport(allPages[currentPageIdx], charId, currentTeamIdx);
}

function removeSupport() {
    allPages[currentPageIdx] = removeSupportFromPage(allPages[currentPageIdx]);

    closeModal('modal-char');
    renderAll();
    saveAllData(true);
}

function initCharModal() {
    activeCharFilters.domain.clear();
    activeCharFilters.class.clear();
    activeCharSearchTags.clear();
    const input = document.getElementById('char-search-input');
    if (input) input.value = '';
    renderActiveCharTags();
    syncCharFilterControls();
    updateOwnedOnlyToggle('characters');
    setupCharSearchEvents();
    renderCharGrid();

    const header = document.getElementById('char-modal-title');
    if (header) header.textContent = isSupportSelectionMode ? '조력자 선택 (1명)' : '배치할 각성체 선택 (최대 4명)';
    openModal('modal-char', '#char-search-input');
}

function toggleCharFilter(type, value) {
    if (activeCharFilters[type].has(value)) activeCharFilters[type].delete(value);
    else activeCharFilters[type].add(value);
    syncCharFilterControls();
    renderCharGrid();
}

function syncCharFilterControls() {
    document.querySelectorAll('.filter-chip[data-filter-type][data-filter-value]').forEach(button => {
        const selected = activeCharFilters[button.dataset.filterType]?.has(button.dataset.filterValue) || false;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
}

function renderCharGrid() {
    const box = document.getElementById('grid-char');
    if (!box) return;
    box.innerHTML = '';

    const currentPage = allPages[currentPageIdx];
    const team = currentPage.teams[currentTeamIdx];
    const searchText = document.getElementById('char-search-input').value.trim();
    const ownedInventory = readOwnedInventory();

    // 1. 현재 세트 전체에서 조력자 정보 추출 (세트 내 1인 조력자 규칙 유지용)
    let supportInPage = null;
    currentPage.teams.forEach((t, idx) => {
        if (t.supportIdx !== -1 && t.chars[t.supportIdx]) {
            supportInPage = { teamIdx: idx, charId: t.chars[t.supportIdx] };
        }
    });

    // 2. 계역 충돌 계산 (현재 팀 기반)
    const activeDomains = new Set();
    if (!isSupportSelectionMode && team.supportIdx !== -1 && team.chars[team.supportIdx]) {
        const sup = DB.chars.find(x => x.id === team.chars[team.supportIdx]);
        if (sup) activeDomains.add(sup.relems);
    }
    tempChars.forEach(cid => {
        const c = DB.chars.find(x => x.id === cid);
        if (c) activeDomains.add(c.relems);
    });

    // 3. 다른 팀에서 "일반 대원"으로 사용 중인 캐릭터 체크
    const usedInOtherTeamsNormal = new Set();
    currentPage.teams.forEach((t, i) => {
        if (i !== currentTeamIdx) {
            t.chars.forEach((id, sIdx) => {
                if (id && sIdx !== t.supportIdx) usedInOtherTeamsNormal.add(id);
            });
        }
    });

    DB.chars.filter(c => {
        const keepCurrent = tempChars.includes(c.id) || team.chars[team.supportIdx] === c.id;
        if (ownedOnlyFilters.characters && !ownedInventory.characters.has(c.id) && !keepCurrent) return false;
        const dPass = !activeCharFilters.domain.size || activeCharFilters.domain.has(c.relems);
        const cPass = !activeCharFilters.class.size || activeCharFilters.class.has(c.class);
        if(!dPass || !cPass) return false;
        if(searchText && !matchesBuilderSearch(c.name, searchText)) return false;
        return true;
    }).forEach(c => {
        const id = c.id;
        let conflictReason = "";

        if (isSupportSelectionMode) {
            // [조력자 선택 모드]
            if (tempChars.includes(id)) conflictReason = "파티 내 중복";
            else if (getDomainsWithSupportCandidate(team, id).size > 2) conflictReason = "계역 충돌";
        } else {
            // [일반 대원 편성 모드]
            if (usedInOtherTeamsNormal.has(id)) {
                conflictReason = "사용중";
            } else if (team.supportIdx !== -1 && team.chars[team.supportIdx] === id) {
                conflictReason = "조력자로 사용 중";
            } else if (!tempChars.includes(id) && activeDomains.size >= 2 && !activeDomains.has(c.relems)) {
                conflictReason = "계역 충돌";
            }
        }

        const isSelected = tempChars.includes(id) || (isSupportSelectionMode && team.supportIdx !== -1 && team.chars[team.supportIdx] === id);

        const el = document.createElement('button');
        el.type = 'button';
        el.className = `grid-item grid-item-character has-label ${isSelected ? 'selected' : ''} ${conflictReason ? 'conflict' : ''}`;
        el.dataset.characterId = id;
        el.setAttribute('aria-pressed', String(isSelected));
        el.setAttribute('aria-label', `${c.name}${isSelected ? ', 선택됨' : ''}${conflictReason ? `, ${conflictReason}` : ''}`);
        if (conflictReason && !isSelected) el.setAttribute('aria-disabled', 'true');

        const thumb = document.createElement('span');
        thumb.className = 'grid-item-thumb';
        const image = document.createElement('img');
        image.src = c.image_thumb;
        image.alt = '';
        image.loading = 'lazy';
        thumb.appendChild(image);
        const label = document.createElement('span');
        label.className = 'grid-item-label';
        label.textContent = c.name;
        el.append(thumb, label);

        if (conflictReason) {
            const overlay = document.createElement('div');
            overlay.className = 'conflict-tag' + (conflictReason === "계역 충돌" ? " domain-conflict-label" : "");
            overlay.innerText = conflictReason;
            el.appendChild(overlay);
        }

        el.addEventListener('click', () => {
            // [버그 수정] 이미 선택된 캐릭터(isSelected)라면 충돌 경고를 띄우지 않고 해제 로직으로 진행함
            if (conflictReason && !isSelected) {
                openSystemAlert("편성 불가", `[${c.name}] 각성체는 ${conflictReason} 상태입니다.`);
                return;
            }

            if (isSupportSelectionMode) {
                const applySupport = () => {
                    applySupportToCurrentTeam(id);
                    closeModal('modal-char');
                    renderAll();
                    saveAllData(true);
                };

                if (supportInPage && supportInPage.teamIdx !== currentTeamIdx) {
                    openSystemConfirm("조력자 변경", "이미 다른 파티에 조력자가 있습니다. 현재 파티로 옮기시겠습니까?", applySupport);
                } else {
                    applySupport();
                }
            } else {
                if (isSelected) {
                    // 이미 선택된 캐릭터를 다시 누르면 중복 여부와 상관없이 목록에서 제외(Deselect)
                    tempChars = tempChars.filter(x => x !== id);
                } else {
                    if (tempChars.length < 4) tempChars.push(id);
                    else {
                        openSystemAlert('선택 한도', '각성체는 최대 4명까지 선택할 수 있습니다.');
                        return;
                    }
                }
                renderCharGrid();
                requestAnimationFrame(() => restoreCharacterGridFocus(id));
            }
        });
        box.appendChild(el);
    });

    if (!box.children.length && ownedOnlyFilters.characters && ownedInventory.characters.size === 0) {
        renderOwnedInventoryEmpty(box, 'characters');
    } else if (!box.children.length) {
        renderNoResults(box, '조건에 맞는 각성체가 없습니다.');
    }

    document.getElementById('char-count').textContent = isSupportSelectionMode ? `조력자 선택` : `${tempChars.length} / 4 선택됨`;
}

function restoreCharacterGridFocus(characterId) {
    const target = [...document.querySelectorAll('#grid-char [data-character-id]')]
        .find(button => button.dataset.characterId === characterId);
    (target || document.getElementById('char-search-input'))?.focus({ preventScroll: true });
}

function setupCharSearchEvents() {
    const input = document.getElementById('char-search-input');
    const suggest = document.getElementById('char-search-suggestions');
    const status = document.getElementById('char-search-status');
    if(!input) return;
    input.oninput = (e) => {
        const val = e.target.value.trim();
        if(!val || (window.SearchUtils && !window.SearchUtils.isSearchQueryActive(val))) {
            suggest.replaceChildren();
            suggest.classList.remove('show');
            if (status) status.textContent = '';
            renderCharGrid();
            return;
        }
        const tagAliases = getTagAliases();
        const matches = getAllCharTagNames().filter(t => (matchesBuilderSearch(t, val) || (tagAliases[t]||[]).some(a=>matchesBuilderSearch(a, val))) && !activeCharSearchTags.has(t));
        suggest.replaceChildren();
        matches.forEach(match => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'suggestion-item';
            option.textContent = match;
            option.addEventListener('click', () => addCharTag(match));
            suggest.appendChild(option);
        });
        suggest.classList.toggle('show', matches.length > 0);
        if (status) status.textContent = matches.length > 0
            ? `${matches.length}개의 특성 추천이 있습니다. 아래 추천 버튼으로 이동할 수 있습니다.`
            : '일치하는 특성 추천이 없습니다.';
        renderCharGrid();
    };
    input.onkeydown = event => {
        if (event.key === 'ArrowDown' && suggest.classList.contains('show')) {
            event.preventDefault();
            suggest.querySelector('.suggestion-item')?.focus();
        } else if (event.key === 'Escape' && suggest.classList.contains('show')) {
            event.stopPropagation();
            suggest.classList.remove('show');
            if (status) status.textContent = '';
        }
    };
}
function addCharTag(tag) {
    activeCharSearchTags.add(tag);
    renderActiveCharTags();
    const input = document.getElementById('char-search-input');
    input.value = '';
    const status = document.getElementById('char-search-status');
    if (status) status.textContent = '';
    const suggestions = document.getElementById('char-search-suggestions');
    suggestions.classList.remove('show');
    suggestions.replaceChildren();
    input.focus();
    renderCharGrid();
}
function renderActiveCharTags() {
    const cont = document.getElementById('active-char-search-tags');
    if(!cont) return;
    cont.replaceChildren();
    activeCharSearchTags.forEach(tag => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'active-tag-chip';
        button.setAttribute('aria-label', `${tag} 특성 필터 제거`);
        button.textContent = tag;
        button.addEventListener('click', () => removeCharTag(tag));
        cont.appendChild(button);
    });
}
function removeCharTag(tag) { activeCharSearchTags.delete(tag); renderActiveCharTags(); renderCharGrid(); }

function confirmQuickSetup() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    const currentSupportId = team.supportIdx !== -1 ? team.chars[team.supportIdx] : null;

    // 일반 슬롯에 조력자가 포함된 경우 차단
    if (currentSupportId && tempChars.includes(currentSupportId)) {
        openSystemAlert("편성 오류", "조력자로 설정된 각성체는 일반 슬롯에 중복 배치할 수 없습니다.");
        return;
    }

    allPages[currentPageIdx].teams[currentTeamIdx] = applyCharacterSelection(team, tempChars);

    closeModal('modal-char');
    renderAll();
    saveAllData(true);
}

// [10] 명륜 및 은열쇠 선택 로직
function openWheelModal(charIdx, slotIdx, e) {
    if(!allPages[currentPageIdx].teams[currentTeamIdx].chars[charIdx]) return openSystemAlert("알림", "캐릭터를 먼저 배치하세요.");
    editingCharIdx = charIdx;
    selectedWheelSlotIdx = slotIdx;
    if(e) e.stopPropagation();
    activeWheelTags.clear();
    activeWheelMainStats.clear();

    const input = document.getElementById('wheel-search-input');
    if (input) {
        input.value = '';
        setupWheelSearchEvents(); // 검색 이벤트 바인딩 호출 추가
    }

    // 명륜 모달을 열 때 전용 장착 버튼을 보이게 처리 및 클릭 이벤트 바인딩
    const btnSsr = document.getElementById('btn-equip-ssr');
    const btnSr = document.getElementById('btn-equip-sr');
    if (btnSsr) btnSsr.hidden = false;
    if (btnSr) btnSr.hidden = false;

    renderWheelModalUI();
    ensureWheelDoneButton();
    openModal('modal-wheel', `#equip-slot-${selectedWheelSlotIdx}`);
}

function ensureWheelDoneButton() {
    const container = document.getElementById('modal-action-buttons');
    if (!container || document.getElementById('btn-wheel-done')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'btn-wheel-done';
    button.className = 'btn btn-modal btn-wheel-done';
    button.textContent = '완료';
    button.addEventListener('click', () => closeModal('modal-wheel'));
    container.appendChild(button);
}

function setupWheelSearchEvents() {
    const input = document.getElementById('wheel-search-input');
    if (!input) return;

    input.oninput = () => {
        renderWheelList(); // 입력 시마다 리스트를 다시 필터링하여 렌더링
    };
}
function renderWheelMainStatFilters() {
    const container = document.getElementById('wheel-main-stat-filters');
    if (!container) return;

    const options = [...new Set(DB.wheels
        .map(wheel => normalizeWheelMainStat(wheel.main_stat))
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ko'));

    container.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'wheel-filter-label';
    label.textContent = '주옵';
    container.appendChild(label);

    options.forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `wheel-filter-chip${activeWheelMainStats.has(option) ? ' active' : ''}`;
        button.textContent = option;
        button.setAttribute('aria-pressed', String(activeWheelMainStats.has(option)));
        button.onclick = () => {
            if (activeWheelMainStats.has(option)) {
                activeWheelMainStats.delete(option);
            } else {
                activeWheelMainStats.add(option);
            }
            renderWheelMainStatFilters();
            renderWheelList();
        };
        container.appendChild(button);
    });
}
function selectWheelSlot(idx) { selectedWheelSlotIdx = idx; renderWheelModalUI(); }
function renderWheelModalUI() {
    const wheels = allPages[currentPageIdx].teams[currentTeamIdx].wheels[editingCharIdx];
    for(let i=0; i<2; i++) {
        const el = document.getElementById(`equip-slot-${i}`);
        el.classList.toggle('active', i === selectedWheelSlotIdx);
        el.setAttribute('aria-pressed', String(i === selectedWheelSlotIdx));
        const wInfo = DB.wheels.find(w => w.english_name === wheels[i]);
        el.replaceChildren();
        if (wInfo) {
            const image = document.createElement('img');
            image.src = wInfo.image_path;
            image.alt = '';
            el.appendChild(image);
        } else {
            const placeholder = document.createElement('span');
            placeholder.className = 'slot-placeholder';
            placeholder.textContent = '+';
            el.appendChild(placeholder);
        }
        el.setAttribute('aria-label', `${i + 1}번 명륜 슬롯${wInfo ? `, ${wInfo.korean_name} 장착됨` : ', 비어 있음'}`);
        if(i === selectedWheelSlotIdx) document.getElementById('equip-slot-desc').textContent = wInfo ? wInfo.korean_name : "명륜을 선택하세요";
    }
    renderWheelMainStatFilters();
    updateOwnedOnlyToggle('wheels');
    renderWheelList();
}
function renderWheelList() {
    partyTooltipController.hide({ force: true });
    const box = document.getElementById('grid-wheel');
    if (!box) return;
    box.innerHTML = '';

    const currentPage = allPages[currentPageIdx];
    const currentTeam = currentPage.teams[currentTeamIdx];
    const currentW = currentTeam.wheels[editingCharIdx][selectedWheelSlotIdx];
    const searchInput = document.getElementById('wheel-search-input');
    const search = searchInput ? searchInput.value.trim() : "";
    const ownedInventory = readOwnedInventory();

    const wheelOptions = createWheelOptionModels(DB.wheels, {
        currentWheelId: currentW,
        usedWheelIds: collectEquippedWheelIds(currentPage),
        ownedOnly: ownedOnlyFilters.wheels,
        ownedWheelIds: ownedInventory.wheels,
        activeTags: activeWheelTags,
        activeMainStats: activeWheelMainStats,
        normalizeMainStat,
        matchesSearch: wheel => !search || matchesBuilderSearchByQueryType(
                wheel.korean_name || '',
                `${wheel.korean_name || ''} ${wheel.description || ''} ${wheel.main_stat || ''}`,
                search
            )
    });

    wheelOptions.forEach(({ item: w, isSelected: isSel, isUsed }) => {

        const el = document.createElement('button');
        el.type = 'button';
        el.className = `grid-item grid-item-wheel has-label ${isSel ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`;
        el.dataset.wheelId = w.english_name;
        el.setAttribute('aria-pressed', String(isSel));
        el.setAttribute('aria-label', `${w.korean_name}${isSel ? ', 현재 장착됨' : ''}${isUsed ? ', 다른 슬롯에서 사용 중' : ''}`);
        el.disabled = isUsed;

        const image = document.createElement('img');
        image.src = w.image_path;
        image.alt = '';
        image.loading = 'lazy';
        const label = document.createElement('span');
        label.className = 'grid-item-label';
        label.textContent = w.korean_name;
        el.append(image, label);

        bindTooltipEvents(el, w);

        el.addEventListener('click', (e) => {
            allPages[currentPageIdx].teams[currentTeamIdx] = withEquippedWheel(
                allPages[currentPageIdx].teams[currentTeamIdx],
                editingCharIdx,
                selectedWheelSlotIdx,
                w.english_name
            );
            renderWheelModalUI();
            renderAll();
            saveAllData(true);
            requestAnimationFrame(() => {
                [...document.querySelectorAll('#grid-wheel [data-wheel-id]')]
                    .find(button => button.dataset.wheelId === w.english_name)?.focus({ preventScroll: true });
            });
        });

        box.appendChild(el);
    });

    if (!box.children.length && ownedOnlyFilters.wheels && ownedInventory.wheels.size === 0) {
        renderOwnedInventoryEmpty(box, 'wheels');
    } else if (!box.children.length) {
        renderNoResults(box, '조건에 맞는 명륜이 없습니다.');
    }
}

function unequipSelectedWheel() {
    if (editingCharIdx < 0) return;
    allPages[currentPageIdx].teams[currentTeamIdx] = withEquippedWheel(
        allPages[currentPageIdx].teams[currentTeamIdx],
        editingCharIdx,
        selectedWheelSlotIdx,
        null
    );
    renderWheelModalUI();
    renderAll();
    saveAllData(true);
}

function openKeyModal(e) {
    // [수정] 은열쇠는 항상 1번 슬롯(리더) 캐릭터를 기준으로 처리하도록 강제 설정
    editingCharIdx = 0;

    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    if(!team.chars[editingCharIdx]) {
        return openSystemAlert("알림", "1번 슬롯에 캐릭터를 먼저 배치하세요.");
    }

    if(e) e.stopPropagation();

    const searchInput = document.getElementById('key-search-input');
    if (searchInput) {
        searchInput.value = '';
        setupKeySearchEvents();
    }

    // 전용 은열쇠 장착 버튼 노출 및 클릭 이벤트 연결
    const btnKey = document.getElementById('btn-equip-key');
    if (btnKey) btnKey.hidden = false;

    renderKeyGrid();
    openModal('modal-key', '#key-search-input');
}

// =========================================
// 전용 은열쇠 자동 장착 로직 (리더 슬롯 고정형)
// =========================================
function equipDedicatedKey() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];

    // 무조건 1번 슬롯(index 0) 캐릭터를 기준으로 탐색
    const leaderCharId = team.chars[0];

    if (!leaderCharId) {
        openSystemAlert("알림", "1번 슬롯에 캐릭터를 먼저 배치해주세요.");
        return;
    }

    const charInfo = DB.chars.find(x => String(x.id) === leaderCharId);
    if (!charInfo) return;

    // 캐릭터 이름에 맞는 전용 은열쇠 찾기
    const targetKey = findDedicatedKey(DB.keys, charInfo.name);

    if (!targetKey) {
        openSystemAlert("알림", charInfo.name + "의 전용 은열쇠를 찾을 수 없습니다.");
        return;
    }

    allPages[currentPageIdx].teams[currentTeamIdx] = withEquippedKey(team, targetKey.english_name);

    renderAll();
    saveAllData(true);
    closeModal('modal-key');
}

function setupKeySearchEvents() {
    const input = document.getElementById('key-search-input');
    if (!input) return;

    input.oninput = (e) => {
        renderKeyGrid(); // 입력 시마다 그리드 갱신
    };
}
function renderKeyGrid() {
    const box = document.getElementById('grid-key');
    if (!box) return;
    box.innerHTML = '';

    const currentPage = allPages[currentPageIdx];
    const currentK = currentPage.teams[currentTeamIdx].key;
    const searchInput = document.getElementById('key-search-input');
    const search = searchInput ? searchInput.value.trim() : '';

    // 현재 선택된 정렬 기준 확인
    const sortSelect = document.getElementById('key-sort-select');
    const sortByRecent = sortSelect ? sortSelect.value === 'recent' : true;

    const keyOptions = createKeyOptionModels(DB.keys, {
        currentKeyId: currentK,
        usedKeyIds: collectEquippedKeyIds(currentPage, currentTeamIdx),
        recentKeyIds: sortByRecent ? recentKeys : null,
        matchesSearch: key => !search || matchesBuilderSearchByQueryType(
            key.korean_name || '',
            `${key.korean_name || ''} ${(key.tags || []).join(' ')}`,
            search
        )
    });

    keyOptions.forEach(({ item: k, isSelected: isSel, isUsed }) => {

        const el = document.createElement('button');
        el.type = 'button';
        el.className = `grid-item grid-item-key has-label ${isSel ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`;
        el.setAttribute('aria-pressed', String(isSel));
        el.setAttribute('aria-label', `${k.korean_name}${isSel ? ', 현재 장착됨' : ''}${isUsed ? ', 다른 팀에서 사용 중' : ''}`);
        el.disabled = isUsed;
        const image = document.createElement('img');
        image.src = k.image_path;
        image.alt = '';
        image.loading = 'lazy';
        const label = document.createElement('span');
        label.className = 'grid-item-label';
        label.textContent = k.korean_name;
        el.append(image, label);

        bindTooltipEvents(el, k);

        el.addEventListener('click', () => {
            allPages[currentPageIdx].teams[currentTeamIdx] = withEquippedKey(
                allPages[currentPageIdx].teams[currentTeamIdx],
                k.english_name
            );

            // --- [추가 로직] 장착 시 최근 사용 기록 업데이트 ---
            recentKeys = recentKeys.filter(name => name !== k.english_name); // 기존 중복 제거
            recentKeys.unshift(k.english_name); // 배열의 맨 앞에 삽입
            if (recentKeys.length > 20) recentKeys.pop(); // 최대 20개까지만 보관

            // 브라우저 캐시에 저장
            Storage.setRaw(RECENT_KEYS_STORAGE_KEY, JSON.stringify(recentKeys));
            // ------------------------------------------------

            closeModal('modal-key');
            renderAll();
            saveAllData(true);
        });
        box.appendChild(el);
    });

    if (!box.children.length) renderNoResults(box, '조건에 맞는 은열쇠가 없습니다.');
}

function matchesBuilderSearch(text, query) {
    return Search.matches(text, query, window.SearchUtils);
}

function matchesBuilderSearchByQueryType(primaryText, fullText, query) {
    return Search.matchesByQueryType(primaryText, fullText, query, window.SearchUtils);
}
function unequipKey() {
    allPages[currentPageIdx].teams[currentTeamIdx] = withEquippedKey(
        allPages[currentPageIdx].teams[currentTeamIdx],
        null
    );
    closeModal('modal-key');
    renderAll();
    saveAllData(true);
}

// [11] 시스템 유틸리티 및 모달 기능
function bindTooltipEvents(element, item) {
    element.setAttribute('aria-describedby', 'global-tooltip party-tooltip-instructions');
    element.setAttribute('aria-keyshortcuts', 'Alt+ArrowDown');
    partyTooltipController.bindTrigger(element, item, [], {
        pinOnClick: false,
        pinOnLongPress: true,
        pinWithAltArrow: true
    });
}

function positionPartyTooltip({ event: e, tooltip, window: viewport }) {
    if (viewport.matchMedia('(max-width: 56.249rem)').matches) {
        tooltip.style.removeProperty('left');
        tooltip.style.removeProperty('top');
        return;
    }

    const gap = 15;
    const margin = 10;
    const rect = tooltip.getBoundingClientRect();
    const source = e?.currentTarget instanceof viewport.Element ? e.currentTarget.getBoundingClientRect() : null;
    const clientX = Number.isFinite(e?.clientX) && e.clientX > 0 ? e.clientX : (source?.right || margin);
    const clientY = Number.isFinite(e?.clientY) && e.clientY > 0 ? e.clientY : (source?.top || margin);
    let x = clientX + gap;
    let y = clientY + gap;

    if (x + rect.width > viewport.innerWidth - margin) {
        x = clientX - rect.width - gap;
    }
    if (y + rect.height > viewport.innerHeight - margin) {
        y = clientY - rect.height - gap;
    }

    x = Math.max(margin, Math.min(x, viewport.innerWidth - rect.width - margin));
    y = Math.max(margin, Math.min(y, viewport.innerHeight - rect.height - margin));

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function openSystemAlert(t, m) {
    document.getElementById('sys-modal-title').innerText = t;
    document.getElementById('sys-modal-msg').innerText = m;
    document.getElementById('sys-input-wrapper').hidden = true;
    document.getElementById('sys-btn-no').hidden = true;
    document.getElementById('sys-btn-yes').onclick = () => closeModal('modal-system');
    openModal('modal-system', '#sys-btn-yes');
}
function openSystemConfirm(t, m, yes, options = {}) {
    const {
        initialFocus = '#sys-btn-yes',
        resolveSuccessFocus = null
    } = options;
    document.getElementById('sys-modal-title').innerText = t;
    document.getElementById('sys-modal-msg').innerText = m;
    document.getElementById('sys-btn-no').hidden = false;

    document.getElementById('sys-btn-yes').onclick = () => {
        const returnRecord = partyModalController.getReturnRecord('modal-system');
        closeModal('modal-system', { restoreFocus: false });
        yes();
        if (partyModalController.getTopId() !== 'modal-system') {
            partyModalController.clearDeferredReturn();
            requestAnimationFrame(() => {
                const explicitTarget = typeof resolveSuccessFocus === 'function'
                    ? resolveSuccessFocus()
                    : null;
                const returnTarget = explicitTarget || partyModalController.resolveReturnFocusRecord(returnRecord);
                if (returnTarget) {
                    returnTarget.focus({ preventScroll: true });
                    return;
                }
                const topDialog = partyModalController.getDialog(document.getElementById(partyModalController.getTopId()));
                (partyModalController.getFocusable(topDialog)[0] || topDialog)?.focus({ preventScroll: true });
            });
        }
    };

    document.getElementById('sys-btn-no').onclick = () => {
        closeModal('modal-system');
    };

    openModal('modal-system', initialFocus);
}

function getPartyModalFallbackSelector(element) {
    let fallbackSelector = '';
    if (element?.id) fallbackSelector = `#${element.id}`;
    else if (element?.classList.contains('team-tab')) fallbackSelector = `#team-tab-${currentTeamIdx}`;
    else if (element?.dataset?.pageIndex !== undefined) fallbackSelector = `#page-tab-${element.dataset.pageIndex}`;
    else if (element?.dataset?.charSlot !== undefined && element?.dataset?.wheelSlotIndex !== undefined) {
        fallbackSelector = `.slot-wheel[data-char-slot="${element.dataset.charSlot}"][data-wheel-slot-index="${element.dataset.wheelSlotIndex}"]`;
    } else if (element?.dataset?.charSlot !== undefined) {
        fallbackSelector = `.char-select-action[data-char-slot="${element.dataset.charSlot}"]`;
    } else if (element?.classList.contains('support-setup-btn')) fallbackSelector = '.support-setup-btn';
    return fallbackSelector;
}

function handlePartyModalClose(id) {
    restorePersistentSaveErrorPortal();
    const saveError = document.getElementById('party-save-error');
    if (saveError && !saveError.hidden) movePersistentSaveErrorToActiveDialog(saveError);
    if (id === 'modal-char') {
        const removeBtn = document.getElementById('btn-remove-support');
        if (removeBtn) removeBtn.hidden = true;
        document.getElementById('char-search-suggestions')?.classList.remove('show');
    }
    if (id === 'modal-system') {
        document.getElementById('sys-input-wrapper').hidden = true;
        document.getElementById('sys-btn-no').hidden = true;
        targetRenameIndex = -1;
    }
}
function goBackToMenu() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'weapon') {
        location.href = 'links.html?category=weapon';
    } else {
        location.href = 'index.html';
    }
}

function updateBackButtonLabel() {
    const backButton = document.querySelector('.back-btn');
    if (!backButton) return;

    const params = new URLSearchParams(window.location.search);
    const fromWeapon = params.get('from') === 'weapon';
    backButton.textContent = fromWeapon ? '← 융재금구 메뉴로 돌아가기' : '← 홈으로 돌아가기';
    backButton.href = fromWeapon ? 'links.html?category=weapon' : 'index.html';
}

async function copyTeamToClipboard() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];

    try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
        await navigator.clipboard.writeText(serializeTeamShare(team));
        openSystemAlert("복사 완료", "현재 팀 구성 정보가 클립보드에 저장되었습니다.");
    } catch (error) {
        console.warn('팀 복사 실패', error);
        openSystemAlert('복사 실패', '클립보드 권한을 확인한 뒤 다시 시도해 주세요. 브라우저가 이 기능을 차단했을 수 있습니다.');
    }
}

async function pasteTeamFromClipboard() {
    try {
        if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable');
        const text = await navigator.clipboard.readText();
        const currentTeam = allPages[currentPageIdx].teams[currentTeamIdx];
        const sanitized = parseAndSanitizeTeamShare(text, {
            validator: stateValidator,
            teamName: currentTeam.name,
            teamIndex: currentTeamIdx
        });

        openSystemConfirm("팀 붙여넣기", "현재 팀 정보를 클립보드 데이터로 덮어쓰시겠습니까?", () => {
            allPages[currentPageIdx].teams[currentTeamIdx] = replaceTeamComposition(currentTeam, sanitized);

            renderAll();
            saveAllData(true);
            openSystemAlert("완료", "팀 정보를 성공적으로 붙여넣었습니다.");
        });
    } catch (e) {
        openSystemAlert("오류", "클립보드에 유효한 팀 데이터가 없거나 형식이 잘못되었습니다.");
    }
}

// =========================================
// 전용 명륜 자동 장착 및 포커스 이동 로직
// =========================================

function equipDedicatedWheel(grade) {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    const charId = team.chars[editingCharIdx];

    // 1. 캐릭터 배치 확인
    if (!charId) {
        openSystemAlert("알림", "캐릭터를 먼저 배치해주세요.");
        return;
    }

    // 2. 캐릭터 정보 가져오기
    const charInfo = DB.chars.find(x => String(x.id) === charId);
    if (!charInfo) return;

    // 3. 해당 등급의 전용 명륜 찾기
    const targetWheel = findDedicatedWheel(DB.wheels, {
        characterId: charId,
        character: charInfo,
        aliases: (PARTY_BUILDER_RULES.dedicated_wheel_aliases || {})[charId] || [],
        grade,
        normalizeTarget: normalizeDedicatedTarget
    });

    if (!targetWheel) {
        openSystemAlert("알림", `${charInfo.name}의 전용 ${grade} 명륜을 찾을 수 없습니다.`);
        return;
    }

    // 4. 슬롯 인덱스 결정 (SSR=0, SR=1) 및 포커스 이동
    const slotIdx = (grade === 'SSR') ? 0 : 1;
    selectedWheelSlotIdx = slotIdx; // 장착하는 슬롯으로 즉시 포커스 이동

    // 5. 데이터 적용
    allPages[currentPageIdx].teams[currentTeamIdx] = withEquippedWheel(
        team,
        editingCharIdx,
        slotIdx,
        targetWheel.english_name
    );

    // 6. UI 전체 및 모달 내부 갱신 (핵심: 어떤 등급이든 즉시 리렌더링)
    renderAll();
    renderWheelModalUI(); // 이 함수가 호출되어야 슬롯 이미지가 즉시 바뀝니다.
    saveAllData(true);

}
