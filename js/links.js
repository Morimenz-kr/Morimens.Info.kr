'use strict';

import {
    encodeTooltipMainStats,
    getDictionaryFilterMeta,
    uniqueSortedValues
} from './links/domain.js?v=v1.4.0-site-quality-20260713-r4';
import { createExternalLinkRenderer } from './links/external-links.js?v=v1.4.0-site-quality-20260713-r4';
import { createTooltipController } from './links/tooltip.js?v=v1.4.0-site-quality-20260713-r4';
import { createRuntimeDataLoader, settleRuntimeShard } from './links/runtime-index.js?v=v1.4.0-site-quality-20260713-r4';

const LINKS_FALLBACK_IMAGE = 'images/smile_Ramona.webp';
const runtimeState = {
    wheelMap: Object.create(null),
    covenantMap: Object.create(null),
    characterNames: new Set(),
    currentSettings: Object.freeze({})
};
const externalLinkRenderer = createExternalLinkRenderer({
    document,
    baseUrl: document.baseURI,
    fallbackImage: LINKS_FALLBACK_IMAGE
});
const tooltipController = createTooltipController({
    document,
    window,
    lookupItem(kind, id) {
        const map = kind === 'wheel' ? runtimeState.wheelMap : runtimeState.covenantMap;
        return map?.[id];
    }
});
const setSafeImage = (image, source, fallback) => externalLinkRenderer.setSafeImage(image, source, fallback);

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
}

async function fetchJson(url, optionalFallback) {
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.url}`);
        return await response.json();
    } catch (error) {
        if (optionalFallback !== undefined) return optionalFallback;
        throw error;
    }
}

function initializeModalAccessibility() {
    window.SiteDialog.setup('#substitute-modal', { initialFocus: '#close-sub-modal' });
}

// --- 뒤로가기 ---
function goBack() {
    const category = new URLSearchParams(location.search).get('category');
    location.assign(category === 'character' ? 'list.html' : 'index.html');
}

// --- 기능 로직 ---
// 1. 닫기 버튼을 눌렀을 때 실행되는 함수
// 2. 모달 바깥(어두운 오버레이)을 클릭했을 때 창을 닫는 로직
async function copyCodeToClipboard(text, element) {
    if (!navigator.clipboard) {
        showLinksStatus('이 브라우저에서는 자동 복사를 사용할 수 없습니다. 코드를 직접 선택해 주세요.', true);
        element.focus();
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        element.classList.add('copied');
        const originalText = element.textContent;
        element.textContent = '복사 완료';
        showLinksStatus('교환 코드를 클립보드에 복사했습니다.');
        setTimeout(() => {
            element.classList.remove('copied');
            element.textContent = originalText;
        }, 800);
    } catch (error) {
        console.error('클립보드 복사 실패:', error);
        showLinksStatus('복사 권한을 확인하지 못했습니다. 코드를 직접 선택해 주세요.', true);
        element.focus();
    }
}

// 탭 전환 로직
function switchTab(tabName) {
    const tab = document.querySelector(`.chrome-tab[data-tab-target="${tabName}"]`);
    const content = document.getElementById(`tab-content-${tabName}`);
    if (!tab || !content || tab.hidden) return;
    document.querySelectorAll('.chrome-tab').forEach(element => {
        const selected = element === tab;
        element.classList.toggle('active', selected);
        element.setAttribute('aria-selected', String(selected));
        element.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.link-container > .tab-content').forEach(element => {
        const selected = element === content;
        element.classList.toggle('active', selected);
        element.hidden = !selected;
    });
}

function getCheckedFilterValues(panel, name) {
    return [...panel.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
}

function renderDictionaryFilters(data, category, onFilterChange) {
    const panel = document.getElementById('dictionary-filter-panel');
    if (!panel) return;

    const metaByItem = new Map(data.map(item => [
        item,
        getDictionaryFilterMeta(item, category, runtimeState.characterNames)
    ]));
    const mainStats = uniqueSortedValues([...metaByItem.values()].map(meta => meta.mainStat));
    const effects = uniqueSortedValues([...metaByItem.values()].flatMap(meta => meta.effectFilters));
    const isMyeongryun = category === 'myeongryun';
    const grades = uniqueSortedValues([...metaByItem.values()].map(meta => meta.grade));
    panel.classList.add('show');
    panel.replaceChildren();

    const searchField = createElement('div', 'dictionary-filter-field');
    const searchLabel = createElement('label', '', '검색');
    searchLabel.htmlFor = 'dictionary-search';
    const search = createElement('input');
    search.id = 'dictionary-search';
    search.type = 'search';
    search.placeholder = '이름, 설명, 효과 검색';
    searchField.append(searchLabel, search);

    const footer = createElement('div', 'dictionary-filter-footer');
    const summary = createElement('div', 'dictionary-filter-summary');
    summary.id = 'dictionary-filter-summary';
    summary.setAttribute('aria-live', 'polite');
    const reset = createElement('button', 'dictionary-filter-reset', '필터 초기화');
    reset.id = 'dictionary-filter-reset';
    reset.type = 'button';
    footer.append(summary, reset);

    const top = createElement('div', 'dictionary-filter-top');
    top.append(searchField, footer);
    panel.append(top);

    const appendFilterGroup = (titleText, name, values) => {
        if (values.length === 0) return;
        const field = createElement('fieldset', 'dictionary-filter-field');
        const legend = createElement('legend', 'dictionary-filter-section-title', titleText);
        const options = createElement('div', 'dictionary-filter-options');
        values.forEach(value => {
            const label = createElement('label', 'dictionary-filter-option');
            const checkbox = createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = name;
            checkbox.value = value;
            label.append(checkbox, createElement('span', '', value));
            options.append(label);
        });
        field.append(legend, options);
        panel.append(field);
    };

    if (isMyeongryun) {
        appendFilterGroup('등급', 'dictionary-grade-filter', grades);
        appendFilterGroup('주옵션', 'dictionary-main-filter', mainStats);
    } else {
        appendFilterGroup('효과', 'dictionary-effect-filter', effects);
    }

    const searchUtils = window.SearchUtils;
    const controls = {
        search,
        reset,
        summary
    };

    const applyFilters = () => {
        const query = controls.search.value.trim();
        const grades = getCheckedFilterValues(panel, 'dictionary-grade-filter');
        const mainStats = getCheckedFilterValues(panel, 'dictionary-main-filter');
        const effects = getCheckedFilterValues(panel, 'dictionary-effect-filter');
        const filtered = data.filter(item => {
            const meta = metaByItem.get(item);
            if (query) {
                const searchText = searchUtils && searchUtils.isChoseongQuery(query)
                    ? meta.nameText
                    : meta.text;
                const matches = searchUtils
                    ? searchUtils.matchesSearchText(searchText, query)
                    : searchText.includes(query.toLowerCase());
                if (!matches) return false;
            }
            if (grades.length > 0 && !grades.includes(meta.grade)) return false;
            if (mainStats.length > 0 && !mainStats.includes(meta.mainStat)) return false;
            if (effects.length > 0 && !effects.some(effect => meta.effectFilters.includes(effect))) return false;
            return true;
        });
        controls.summary.textContent = `${filtered.length} / ${data.length}개 표시`;
        onFilterChange(filtered);
    };

    controls.search.addEventListener('input', applyFilters);
    panel.querySelectorAll('input[type="checkbox"]').forEach(control => {
        control.addEventListener('change', applyFilters);
    });
    controls.reset.addEventListener('click', () => {
        controls.search.value = '';
        panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = false;
        });
        applyFilters();
    });

    applyFilters();
}

// 아이콘 리스트 렌더링 로직 (비율 및 크기 분기 처리)
function renderDictionaryItems(data, category) {
    const grid = document.getElementById('dictionary-grid');
    grid.replaceChildren();
    grid.dataset.category = category;

    // 카테고리에 따라 그리드의 기본 크기를 다르게 할당하여 비밀계약 아이콘을 크게 만듦
    if (category === 'covenant') {
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(130px, 1fr))';
    } else {
        grid.style.removeProperty('grid-template-columns');
    }

    data.forEach(item => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'dictionary-item';
        card.setAttribute('aria-label', `${item.korean_name || '이름 없는 항목'} 상세 정보`);
        card.setAttribute('aria-describedby', 'global-tooltip');

        const img = document.createElement('img');
        setSafeImage(img, item.image_path);
        img.alt = item.korean_name || '도감 이미지';
        img.loading = 'lazy';
        img.className = 'dictionary-item-image';

        // 은열쇠와 비밀계약은 1:1, 명륜은 인게임 비율 적용
        if (category === 'silverkey' || category === 'covenant') {
            img.style.aspectRatio = '1/1';
            img.width = 160;
            img.height = 160;
        } else {
            img.style.aspectRatio = '225/456';
            img.width = 225;
            img.height = 456;
        }

        const name = document.createElement('span');
        name.className = 'dictionary-item-name';
        name.textContent = item.korean_name;

        tooltipController.bindTrigger(card, item, [], { toggleActive: true });

        card.append(img, name);
        grid.appendChild(card);
    });

    if (data.length === 0) {
        const empty = createElement('div', 'dictionary-empty', '조건에 맞는 항목이 없습니다.');
        empty.setAttribute('role', 'status');
        grid.append(empty);
    }
}

function renderDictionary(data, category) {
    renderDictionaryFilters(data, category, filtered => renderDictionaryItems(filtered, category));
}

function createSubstituteControl(type, substitutes, characterId, settingIndex) {
    if (!Array.isArray(substitutes) || substitutes.length === 0) {
        return createElement('span', 'sub-link disabled', '대체 정보 없음');
    }
    const label = type === 'covenant' ? '대체 비밀계약' : '대체 명륜';
    const button = createElement('button', 'sub-link', label);
    button.type = 'button';
    button.dataset.subModalType = type;
    button.dataset.characterId = characterId;
    button.dataset.settingIndex = String(settingIndex);
    button.setAttribute('aria-haspopup', 'dialog');
    return button;
}

function createEquipmentSlot(label, item, kind, itemId, mainStats, substitutes, characterId, settingIndex, substituteType) {
    const slot = createElement('div', 'equip-slot');
    slot.append(createElement('div', 'equip-label', label));

    const hasDetails = Boolean(itemId && item?.korean_name);
    const tooltipButton = createElement(hasDetails ? 'button' : 'span', `equipment-tooltip-button${hasDetails ? '' : ' is-unavailable'}`);
    if (hasDetails) {
        tooltipButton.type = 'button';
        tooltipButton.dataset.tooltipKind = kind;
        tooltipButton.dataset.tooltipId = itemId;
        tooltipButton.dataset.tooltipMainStats = mainStats || '';
        tooltipButton.setAttribute('aria-label', `${item.korean_name} 상세 정보`);
        tooltipButton.setAttribute('aria-describedby', 'global-tooltip');
    } else {
        tooltipButton.setAttribute('aria-hidden', 'true');
    }

    const image = createElement('img', kind === 'wheel' ? 'equip-img-myeongryun' : 'equip-img-covenant');
    image.alt = '';
    image.loading = 'lazy';
    if (kind === 'wheel') {
        image.width = 90;
        image.height = 182;
    } else {
        image.width = 110;
        image.height = 110;
    }
    setSafeImage(image, item?.image_path || item?.image_thumb);
    tooltipButton.append(image);

    slot.append(
        tooltipButton,
        createElement('div', 'equip-name-label', item?.korean_name || '정보 없음'),
        createSubstituteControl(substituteType, substitutes, characterId, settingIndex)
    );
    return slot;
}

function renderCharacterSettings(container, settings, character, characterId) {
    container.className = '';
    container.replaceChildren();
    const renderNotice = (message, iconText = '📝') => {
        const notice = createElement('div', 'no-setting-notice');
        notice.setAttribute('role', 'status');
        const icon = createElement('span', 'no-setting-icon', iconText);
        icon.setAttribute('aria-hidden', 'true');
        notice.append(icon, createElement('span', '', message));
        container.append(notice);
    };

    if (!settings) {
        renderNotice('아직 추천 세팅 정보가 등록되지 않았습니다.');
        return;
    }

    const rawSettings = Array.isArray(settings) ? settings : [settings];
    const settingsList = rawSettings.filter(setting => setting && setting.status !== 'pending');
    if (settingsList.length === 0 && rawSettings.some(setting => setting?.status === 'pending')) {
        renderNotice('추천 세팅 검수 중입니다. 검수가 끝나면 공개됩니다.', '⏳');
        return;
    }
    if (settingsList.length === 0) {
        renderNotice('아직 추천 세팅 정보가 등록되지 않았습니다.');
        return;
    }

    settingsList.forEach((setting, index) => {
        const ssrData = setting?.myeongryun_ssr || {};
        const srData = setting?.myeongryun_sr || {};
        const covenantData = setting?.covenant || {};
        const ssrWheel = runtimeState.wheelMap[ssrData.main_id] || {};
        const srWheel = runtimeState.wheelMap[srData.main_id] || {};
        const covenant = runtimeState.covenantMap[covenantData.main_id] || {};

        const box = createElement('section', 'recommend-box');
        const left = createElement('div', 'recommend-left');
        const portrait = createElement('img', 'recommend-thumb');
        portrait.alt = `${character.name || '각성체'} 썸네일`;
        portrait.loading = 'lazy';
        portrait.width = 96;
        portrait.height = 96;
        setSafeImage(portrait, character.image_thumb);
        left.append(
            portrait,
            createElement('span', 'recommend-role', `${setting?.settingName || '추천'} 세팅`),
            createElement('span', 'recommend-step', `${setting?.recommendStep || '범용'} 추천`)
        );

        const right = createElement('div', 'recommend-right');
        right.append(
            createEquipmentSlot('추천 SSR 명륜', ssrWheel, 'wheel', ssrData.main_id, '', ssrData.substitutes, characterId, index, 'ssr'),
            createEquipmentSlot('추천 SR 명륜', srWheel, 'wheel', srData.main_id, '', srData.substitutes, characterId, index, 'sr'),
            createEquipmentSlot(
                '추천 비밀계약',
                covenant,
                'covenant',
                covenantData.main_id,
                encodeTooltipMainStats(covenantData.main_stats),
                covenantData.substitutes,
                characterId,
                index,
                'covenant'
            )
        );
        box.append(left, right);
        container.append(box);
    });
    tooltipController.bind(container);
}

function showLinksStatus(message, isError = false) {
    const status = document.getElementById('links-status');
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || '';
    status.classList.toggle('is-error', isError);
    status.setAttribute('role', isError ? 'alert' : 'status');
}

function renderExternalLinkItems(items, container) {
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
        const empty = createElement('div', 'no-data');
        empty.setAttribute('role', 'status');
        const icon = createElement('span', 'no-data-icon', '📭');
        icon.setAttribute('aria-hidden', 'true');
        empty.append(icon, createElement('p', '', '아직 등록된 정보가 없습니다.'));
        container.append(empty);
        return;
    }
    items.forEach(item => externalLinkRenderer.append(item, container));
}

function focusLinksRecoveryTarget(preferredTab = '') {
    requestAnimationFrame(() => {
        const preferred = preferredTab
            ? document.querySelector(`[data-tab-target="${preferredTab}"]:not([hidden])`)
            : null;
        const selected = document.querySelector('.chrome-tab[aria-selected="true"]:not([hidden])');
        const firstTab = document.querySelector('.chrome-tab:not([hidden])');
        const title = document.getElementById('page-title');
        const candidates = preferredTab
            ? [preferred, selected, firstTab, title]
            : [title, selected, firstTab];
        const target = candidates.find(candidate => (
            candidate && !candidate.closest('[hidden], [inert], [aria-hidden="true"]')
        ));
        if (target === title) title.tabIndex = -1;
        target?.focus({ preventScroll: true });
    });
}

function renderResourceLinksLoadError(container, retry) {
    if (!container) return;
    container.replaceChildren();
    const errorState = createElement('div', 'no-data resource-links-load-error');
    errorState.setAttribute('role', 'alert');
    const message = createElement('p', '', '채널 정보글을 불러오지 못했습니다. 다른 자료는 계속 확인할 수 있습니다.');
    const retryButton = createElement('button', 'dictionary-filter-reset', '정보글 다시 불러오기');
    retryButton.type = 'button';
    retryButton.addEventListener('click', async () => {
        retryButton.disabled = true;
        errorState.setAttribute('aria-busy', 'true');
        try {
            renderExternalLinkItems(await retry(), container);
            focusLinksRecoveryTarget('links');
        } catch (error) {
            console.warn('Resource-link shard retry failed:', error);
            message.textContent = '채널 정보글을 다시 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
            retryButton.disabled = false;
            errorState.setAttribute('aria-busy', 'false');
        }
    });
    errorState.append(message, retryButton);
    container.append(errorState);
}

function renderLinksRouteError(container, retry) {
    if (!container) return;
    container.replaceChildren();
    const errorState = createElement('div', 'no-data links-route-error');
    const message = createElement('p', '', '요청한 자료를 표시할 수 없습니다.');
    message.setAttribute('aria-hidden', 'true');
    const retryButton = createElement('button', 'dictionary-filter-reset', '자료 다시 불러오기');
    retryButton.type = 'button';
    retryButton.addEventListener('click', async () => {
        retryButton.disabled = true;
        await retry();
    });
    errorState.append(message, retryButton);
    container.append(errorState);
}

function renderCharacterEffectLoadError(container, retry) {
    if (!container) return;
    container.replaceChildren();
    const errorState = createElement('div', 'character-effect-load-error');
    errorState.setAttribute('role', 'alert');
    const message = createElement('p', '', '각성체 효과 정보를 불러오지 못했습니다. 다른 공략과 추천 세팅은 계속 확인할 수 있습니다.');
    const retryButton = createElement('button', 'dictionary-filter-reset', '효과 정보 다시 불러오기');
    retryButton.type = 'button';
    retryButton.addEventListener('click', async () => {
        retryButton.disabled = true;
        errorState.setAttribute('aria-busy', 'true');
        try {
            await retry();
            focusLinksRecoveryTarget('character-effects');
        } catch (error) {
            console.warn('Character-effect shard retry failed:', error);
            message.textContent = '각성체 효과 정보를 다시 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
            retryButton.disabled = false;
            errorState.setAttribute('aria-busy', 'false');
        }
    });
    errorState.append(message, retryButton);
    container.append(errorState);
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const charId = urlParams.get('id');
    const titleEl = document.getElementById('page-title');
    const listEl = document.getElementById('links-list');
    const tabsContainer = document.querySelector('.chrome-tabs-container');
    const linkContainer = document.querySelector('.link-container');
    const partySlot = document.getElementById('party-link-slot');
    const backLink = document.getElementById('links-back-link');

    initializeModalAccessibility();

    if (backLink) {
        const isCharacterBack = category === 'character';
        backLink.href = isCharacterBack ? 'list.html' : 'index.html';
        backLink.textContent = isCharacterBack ? '각성체 목록으로 돌아가기' : '홈으로 돌아가기';
    }
    backLink?.addEventListener('click', (event) => {
        event.preventDefault();
        goBack();
    });

    document.querySelectorAll('[data-tab-target]').forEach((tab) => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tabTarget));
    });
    tabsContainer?.addEventListener('keydown', event => {
        const currentTab = event.target.closest('[role="tab"]');
        if (!currentTab) return;
        const tabs = [...tabsContainer.querySelectorAll('[role="tab"]:not([hidden])')];
        const currentIndex = tabs.indexOf(currentTab);
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        const nextTab = tabs[nextIndex];
        switchTab(nextTab.dataset.tabTarget);
        nextTab.focus();
    });

    const isCharacterPage = (category === 'character');
    const isDictionaryPage = (category === 'myeongryun' || category === 'silverkey' || category === 'covenant');
    if (linkContainer) {
        linkContainer.classList.toggle('dictionary-wide', isDictionaryPage);
    }

    // 1. 탭 표시 설정 및 명칭 수정
    if (tabsContainer) {
        tabsContainer.hidden = !(isDictionaryPage || isCharacterPage);
        const dictionaryTab = document.querySelector('[data-tab-target="dictionary"]');
        const effectsTab = document.querySelector('[data-tab-target="character-effects"]');
        const linksTab = document.querySelector('[data-tab-target="links"]');
        if (effectsTab) effectsTab.hidden = !isCharacterPage;
        if (isCharacterPage) {
            if (dictionaryTab) dictionaryTab.textContent = '추천 세팅';
            if (linksTab) linksTab.textContent = '채널 정보글';
        } else if (isDictionaryPage) {
            if (category === 'myeongryun' && dictionaryTab) dictionaryTab.textContent = '명륜 목록';
            else if (category === 'silverkey' && dictionaryTab) dictionaryTab.textContent = '은열쇠 목록';
            else if (category === 'covenant' && dictionaryTab) dictionaryTab.textContent = '비밀계약 목록';
            if (linksTab) linksTab.textContent = '채널 정보글';
        }
    }

    const loadCurrentRoute = async ({ restoreFocus = false } = {}) => {
        let succeeded = false;
        linkContainer?.setAttribute('aria-busy', 'true');
        showLinksStatus('자료를 불러오는 중입니다.');
        listEl?.replaceChildren();

        try {
        const version = typeof CONFIG !== 'undefined' ? CONFIG.VERSION : 'current';
        const runtimeLoader = createRuntimeDataLoader({ fetchJson, version });
        const runtimeIndex = await runtimeLoader.loadIndex();
        let manifest = [];
        let wheelList = [];
        let covList = [];
        let settingsDB = {};
        let keyList = [];
        let characterEffectResult = { data: {}, error: null };
        let tooltipDB = {};
        let resourceCategory = null;
        let resourceCategoryError = null;
        let characterLinksResult = { data: [], error: null };
        const versioned = path => `${path}?v=${encodeURIComponent(String(version || 'current'))}`;

        if (isCharacterPage) {
            [manifest, wheelList, covList, settingsDB, characterLinksResult, characterEffectResult, tooltipDB] = await Promise.all([
                fetchJson(versioned('data/character_manifest.json')),
                fetchJson(versioned('data/wheel_list.json')),
                fetchJson(versioned('data/covenant_list.json')),
                fetchJson(versioned('data/character_settings.json')),
                settleRuntimeShard(runtimeLoader, runtimeIndex, 'characterLinks', charId),
                settleRuntimeShard(runtimeLoader, runtimeIndex, 'characterEffects', charId),
                fetchJson(versioned('data/db_tooltips.json'), {})
            ]);
            if (!Array.isArray(manifest) || !Array.isArray(wheelList) || !Array.isArray(covList)) {
                throw new Error('각성체 자료 형식이 올바르지 않습니다.');
            }
        } else if (category === 'myeongryun') {
            const [resourceResult, loadedWheels] = await Promise.all([
                settleRuntimeShard(runtimeLoader, runtimeIndex, 'category', category),
                fetchJson(versioned('data/wheel_list.json'))
            ]);
            resourceCategory = resourceResult.data;
            resourceCategoryError = resourceResult.error;
            wheelList = loadedWheels;
            if (!Array.isArray(wheelList)) throw new Error('명륜 자료 형식이 올바르지 않습니다.');
        } else if (category === 'covenant') {
            const [resourceResult, loadedCovenants] = await Promise.all([
                settleRuntimeShard(runtimeLoader, runtimeIndex, 'category', category),
                fetchJson(versioned('data/covenant_list.json'))
            ]);
            resourceCategory = resourceResult.data;
            resourceCategoryError = resourceResult.error;
            covList = loadedCovenants;
            if (!Array.isArray(covList)) throw new Error('비밀계약 자료 형식이 올바르지 않습니다.');
        } else if (category === 'silverkey') {
            const [resourceResult, loadedManifest, loadedKeys] = await Promise.all([
                settleRuntimeShard(runtimeLoader, runtimeIndex, 'category', category),
                fetchJson(versioned('data/character_manifest.json')),
                fetchJson(versioned('data/silverkey_list.json'))
            ]);
            resourceCategory = resourceResult.data;
            resourceCategoryError = resourceResult.error;
            manifest = loadedManifest;
            keyList = loadedKeys;
            if (!Array.isArray(manifest) || !Array.isArray(keyList)) {
                throw new Error('은열쇠 자료 형식이 올바르지 않습니다.');
            }
        } else {
            resourceCategory = await runtimeLoader.loadShard(runtimeIndex, 'category', category);
        }

        runtimeState.wheelMap = Object.create(null);
        wheelList.forEach(w => {
            if (w?.english_name) runtimeState.wheelMap[w.english_name] = w;
            if (w?.korean_name) runtimeState.wheelMap[w.korean_name] = w;
        });
        runtimeState.covenantMap = Object.create(null);
        covList.forEach(c => {
            if (c?.english_name) runtimeState.covenantMap[c.english_name] = c;
            if (c?.korean_name) runtimeState.covenantMap[c.korean_name] = c;
        });
        runtimeState.characterNames = new Set(manifest.map(character => character.name).filter(Boolean));
        runtimeState.currentSettings = settingsDB && typeof settingsDB === 'object' ? settingsDB : Object.freeze({});

        const charData = manifest.find(c => c.id === charId);
        let targetItems = [];
        let commonLinksRendered = false;

        // 융재금구(weapon) 카테고리 진입 시 내부 시뮬레이터 버튼 노출
        if (partySlot) {
            partySlot.replaceChildren();
            if (category === 'weapon') {
                const simulatorLink = createElement('a', 'party-link-btn', '융재금구 파티 시뮬레이터 실행 (베타)');
                simulatorLink.href = 'party_builder.html?from=weapon';
                partySlot.append(simulatorLink);
            }
        }

        // 1. 캐릭터 공략 페이지
        if (isCharacterPage && charData) {
            titleEl.replaceChildren();
            const titleImage = createElement('img', 'title-thumb');
            titleImage.alt = '';
            titleImage.width = 50;
            titleImage.height = 50;
            setSafeImage(titleImage, charData.image_thumb);
            titleEl.append(titleImage, document.createTextNode(`${charData.name || '각성체'} 공략 모음`));
            if (characterLinksResult.error) {
                console.warn('Character resource-link shard load failed:', characterLinksResult.error);
                commonLinksRendered = true;
                renderResourceLinksLoadError(listEl, () => (
                    runtimeLoader.loadShard(runtimeIndex, 'characterLinks', charId)
                ));
            } else {
                targetItems = characterLinksResult.data;
            }
            if (window.CharacterEffects) {
                const effectRoot = document.getElementById('character-effects-root');
                if (characterEffectResult.error) {
                    console.warn('Character-effect shard load failed:', characterEffectResult.error);
                    renderCharacterEffectLoadError(effectRoot, async () => {
                        const effectData = await runtimeLoader.loadShard(runtimeIndex, 'characterEffects', charId);
                        window.CharacterEffects.render(effectRoot, effectData, charData.name, tooltipDB);
                    });
                } else {
                    window.CharacterEffects.render(
                        effectRoot,
                        characterEffectResult.data,
                        charData.name,
                        tooltipDB
                    );
                }
            }
            const gridContainer = document.getElementById('dictionary-grid');
            const filterPanel = document.getElementById('dictionary-filter-panel');
            const settings = settingsDB?.[charId] || settingsDB?.[charData.name];
            if (filterPanel) {
                filterPanel.classList.remove('show');
                filterPanel.replaceChildren();
            }
            if (gridContainer) renderCharacterSettings(gridContainer, settings, charData, charId);
            switchTab('dictionary');
        } else if (isCharacterPage) {
            throw new Error('요청한 각성체를 찾을 수 없습니다.');
        }

        // 2. 도감 페이지 (명륜/비밀계약/은열쇠)
        else if (isDictionaryPage) {
            const dictionaryTitles = { myeongryun: '명륜 목록', covenant: '비밀계약 목록', silverkey: '은열쇠 목록' };
            titleEl.textContent = resourceCategory?.title || dictionaryTitles[category];
            if (resourceCategoryError) {
                console.warn('Dictionary resource-link shard load failed:', resourceCategoryError);
                commonLinksRendered = true;
                renderResourceLinksLoadError(listEl, async () => {
                    const loadedCategory = await runtimeLoader.loadShard(runtimeIndex, 'category', category);
                    titleEl.textContent = loadedCategory.title;
                    return loadedCategory.links;
                });
            } else {
                targetItems = resourceCategory.links;
            }
            const dictData = (category === 'myeongryun') ? wheelList : (category === 'covenant') ? covList : keyList;
            renderDictionary(Array.isArray(dictData) ? dictData : [], category);
            switchTab('dictionary');
        }

        // 3. 교환 코드(code) 전용 처리
        else if (category === 'code') {
            titleEl.textContent = resourceCategory.title;
            renderCodeLinks(resourceCategory.links, listEl);
            switchTab('links');
            commonLinksRendered = true;
        }

        // 4. 일반 페이지 (기타 카테고리)
        else if (resourceCategory) {
            titleEl.textContent = resourceCategory.title;
            targetItems = resourceCategory.links;
            switchTab('links');
        } else {
            throw new Error('요청한 자료 분류를 찾을 수 없습니다.');
        }

        // 공통: 리스트 카드 출력 (교환 코드가 아닌 일반 링크용)
        if (!commonLinksRendered) {
            renderExternalLinkItems(targetItems, listEl);
        }
        showLinksStatus('');
        succeeded = true;

        } catch (error) {
            console.error("데이터 로드 오류:", error);
            titleEl.textContent = '자료를 불러올 수 없습니다';
            showLinksStatus('자료를 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.', true);
            renderLinksRouteError(listEl, () => loadCurrentRoute({ restoreFocus: true }));
        } finally {
            linkContainer?.setAttribute('aria-busy', 'false');
        }
        if (restoreFocus) {
            if (succeeded) {
                focusLinksRecoveryTarget();
            } else {
                requestAnimationFrame(() => {
                    listEl?.querySelector('.links-route-error button')?.focus({ preventScroll: true });
                });
            }
        }
        return succeeded;
    };

    await loadCurrentRoute();


    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-sub-modal-type]');
        if (!trigger) return;
        openDynamicSubModal(
            trigger.dataset.subModalType,
            trigger.dataset.characterId,
            Number(trigger.dataset.settingIndex || 0),
            trigger
        );
    });

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-copy-code]');
        if (!trigger) return;
        copyCodeToClipboard(trigger.dataset.copyCode, trigger);
    });
});

function openDynamicSubModal(type, charId, idx = 0, trigger = document.activeElement) {
    if (!['ssr', 'sr', 'covenant'].includes(type)) return;
    if (!runtimeState.currentSettings[charId]) return;

    const settings = runtimeState.currentSettings[charId];
    // 배열 여부 확인 후 해당 인덱스의 세팅 추출
    const setInfo = Array.isArray(settings) ? settings[idx] : settings;

    const modal = document.getElementById('substitute-modal');
    const title = document.getElementById('sub-modal-title');
    const body = document.getElementById('sub-modal-body');
    const content = modal?.querySelector('.modal-content');
    if (!modal || !title || !body || !content || !setInfo) return;
    content.classList.remove('modal-myeongryun', 'modal-covenant');

    let ids = [];
    let isWheel = true;

    if (type === 'ssr') {
        title.textContent = '대체할 SSR 명륜';
        ids = setInfo.myeongryun_ssr?.substitutes || [];
        content.classList.add('modal-myeongryun');
    } else if (type === 'sr') {
        title.textContent = '대체할 SR 명륜';
        ids = setInfo.myeongryun_sr?.substitutes || [];
        content.classList.add('modal-myeongryun');
    } else {
        title.textContent = '대체할 비밀계약';
        ids = setInfo.covenant?.substitutes || [];
        isWheel = false;
        content.classList.add('modal-covenant');
    }

    const items = (Array.isArray(ids) ? ids : [])
        .map(id => ({ id, data: isWheel ? runtimeState.wheelMap[id] : runtimeState.covenantMap[id] }))
        .filter(item => item.data);
    const itemCount = items.length;
    const gridCols = Math.min(Math.max(itemCount, 1), 4);
    body.replaceChildren();
    if (itemCount === 0) {
        const empty = createElement('div', 'sub-modal-empty', '등록된 대체 정보가 없습니다.');
        empty.setAttribute('role', 'status');
        body.append(empty);
    } else {
        const grid = createElement('div', `substitute-grid cols-${gridCols}`);
        items.forEach(({ id, data }) => {
            const item = createElement('article', 'sub-item-vertical');
            const tooltipButton = createElement('button', 'equipment-tooltip-button');
            tooltipButton.type = 'button';
            tooltipButton.dataset.tooltipKind = isWheel ? 'wheel' : 'covenant';
            tooltipButton.dataset.tooltipId = id;
            tooltipButton.dataset.tooltipMainStats = !isWheel
                ? encodeTooltipMainStats(setInfo.covenant?.substitute_main_stats?.[id])
                : '';
            tooltipButton.setAttribute('aria-label', `${data.korean_name || '장비'} 상세 정보`);
            tooltipButton.setAttribute('aria-describedby', 'global-tooltip');

            const image = createElement('img', isWheel ? 'sub-img-myeongryun' : 'sub-img-covenant');
            image.alt = '';
            image.loading = 'lazy';
            if (isWheel) {
                image.width = 90;
                image.height = 182;
            } else {
                image.width = 110;
                image.height = 110;
            }
            setSafeImage(image, data.image_path || data.image_thumb);
            tooltipButton.append(image);
            item.append(tooltipButton, createElement('div', 'sub-item-name', data.korean_name || '정보 없음'));
            grid.append(item);
        });
        body.append(grid);
    }

    tooltipController.bind(body);
    window.SiteDialog.open(modal, trigger);
}

function renderCodeLinks(items, container) {
    container.replaceChildren();
    const sourceItems = Array.isArray(items) ? items : [];

    // 1. 데이터 분류
    const permanent = sourceItems.filter(item => !item?.expiry);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const temporary = sourceItems.filter(item => {
        if (!item?.expiry) return false;
        const expiry = new Date(item.expiry);
        return !Number.isNaN(expiry.getTime()) && expiry >= startOfToday;
    });

    // D-Day 계산 함수
    const getDDay = (dateStr) => {
        const diff = new Date(dateStr).getTime() - Date.now();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days === 0 ? "오늘 만료" : `${days}일 남음`;
    };

    const createCard = (item, isTemporary) => {
        const card = createElement('article', 'code-card');
        const details = createElement('div', 'code-details');
        details.append(
            createElement('span', 'code-title', item?.title || '코드 정보 없음'),
            createElement('span', 'code-reward', item?.desc || '보상 정보 없음')
        );
        if (isTemporary) details.append(createElement('div', 'code-timer', `⏳ ${getDDay(item.expiry)}`));
        const copy = createElement('button', 'code-copy-btn', '복사');
        copy.type = 'button';
        copy.dataset.copyCode = String(item?.title || '');
        copy.setAttribute('aria-label', `${item?.title || '교환 코드'} 복사`);
        card.append(details, copy);
        return card;
    };

    const appendSection = (label, entries, isTemporary) => {
        if (entries.length === 0) return;
        container.append(createElement('h2', 'section-label', label));
        const group = createElement('div', 'code-card-container');
        entries.forEach(item => group.append(createCard(item, isTemporary)));
        container.append(group);
    };

    appendSection('기간 한정 코드', temporary, true);
    appendSection('상시 코드', permanent, false);
    if (temporary.length === 0 && permanent.length === 0) {
        const empty = createElement('div', 'no-data', '현재 사용할 수 있는 교환 코드가 없습니다.');
        empty.setAttribute('role', 'status');
        container.append(empty);
    }
}
