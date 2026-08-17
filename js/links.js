// --- 뒤로가기 ---
function goBack() {
    const ref = document.referrer;
    const isFromParent = ref && (ref.includes('index.html') || ref.includes('list.html'));
    if (isFromParent) {
        history.back();
    } else {
        const category = new URLSearchParams(location.search).get('category');
        location.href = (category === 'character') ? 'list.html' : 'index.html';
    }
}

// --- 기능 로직 ---
// 1. 닫기 버튼을 눌렀을 때 실행되는 함수
// 2. 모달 바깥(어두운 오버레이)을 클릭했을 때 창을 닫는 로직
function copyCodeWithSelection(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.inset = '0 auto auto 0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    try {
        return document.execCommand('copy');
    } finally {
        textarea.remove();
    }
}

// 클릭 순간 실행 가능한 복사 방식을 먼저 사용하고, 실패하면 Clipboard API로 보완한다.
async function copyCodeToClipboard(code, element) {
    const text = String(code || '').trim();
    if (!text) return;

    try {
        let copied = copyCodeWithSelection(text);
        if (!copied && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            copied = true;
        }
        if (!copied) throw new Error('No clipboard method succeeded');

        element.classList.add('copied');
        const originalText = element.textContent;
        element.textContent = '복사 완료';
        setTimeout(() => {
            element.classList.remove('copied');
            element.textContent = originalText;
        }, 800);
    } catch (error) {
        console.error('클립보드 복사 실패:', error);
        alert('복사하지 못했습니다. 교환 코드를 길게 눌러 직접 복사해주세요.');
    }
}

function openSubModal(type) {
    const modal = document.getElementById('substitute-modal');
    const contentBox = modal.querySelector('.modal-content');
    const title = document.getElementById('sub-modal-title');
    const body = document.getElementById('sub-modal-body');

    contentBox.classList.remove('modal-myeongryun', 'modal-covenant');

    let content = '';
    const placeholderImg = 'images/smile_Ramona.webp';

    if (type === 'ssr' || type === 'sr') {
        contentBox.classList.add('modal-myeongryun');
        title.textContent = type === 'ssr' ? 'SSR 명륜 대체' : 'SR 명륜 대체';

        // 명륜용 2열 그리드 (이미지 아래 이름)
        content = '<div class="substitute-grid cols-2">';
        content += `
        <div class="sub-item-vertical">
            <img src="${placeholderImg}" class="sub-img-myeongryun">
            <div class="sub-item-name">대체 명륜 A</div>
        </div>
        <div class="sub-item-vertical">
            <img src="${placeholderImg}" class="sub-img-myeongryun">
            <div class="sub-item-name">대체 명륜 B</div>
        </div>
    `;
        content += '</div>';
    } else {
        contentBox.classList.add('modal-covenant');
        title.textContent = '비밀계약 대체';

        // 비밀계약용 3열 그리드 (이미지 아래 이름)
        content = '<div class="substitute-grid cols-3">';
        content += `
        <div class="sub-item-vertical">
            <img src="${placeholderImg}" class="sub-img-covenant">
            <div class="sub-item-name">대체 계약 A</div>
        </div>
        <div class="sub-item-vertical">
            <img src="${placeholderImg}" class="sub-img-covenant">
            <div class="sub-item-name">대체 계약 B</div>
        </div>
        <div class="sub-item-vertical">
            <img src="${placeholderImg}" class="sub-img-covenant">
            <div class="sub-item-name">대체 계약 C</div>
        </div>
    `;
        content += '</div>';
    }

    body.innerHTML = content;
    modal.classList.add('show');
}

function closeSubModal() {
    const modal = document.getElementById('substitute-modal');
    if (modal) modal.classList.remove('show');
}

// 탭 전환 로직
function switchTab(tabName) {
    document.querySelectorAll('.chrome-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

    const tab = document.querySelector(`.chrome-tab[data-tab-target="${tabName}"]`);
    const content = document.getElementById(`tab-content-${tabName}`);
    if (tab && content) {
        tab.classList.add('active');
        content.classList.add('active');
    }
}

// 전역 툴팁 엘리먼트 동적 생성
const tooltipEl = document.createElement('div');
tooltipEl.id = 'global-tooltip';
tooltipEl.className = 'item-tooltip';
tooltipEl.innerHTML = `
<div class="tooltip-title" id="tt-title"></div>
<div class="tooltip-desc" id="tt-desc"></div>
<div class="tooltip-tags" id="tt-tags"></div>
`;
document.body.appendChild(tooltipEl);
let itemTooltipPinned = false;

function fitTooltipWidth() {
    if (window.matchMedia('(max-width: 768px)').matches) {
        tooltipEl.style.width = '';
        return;
    }

    const maxWidth = Math.min(300, Math.max(0, window.innerWidth - 32));
    const minWidth = Math.min(180, maxWidth);
    tooltipEl.style.width = `${maxWidth}px`;
    const targetHeight = tooltipEl.offsetHeight;

    let low = minWidth;
    let high = maxWidth;
    let fittedWidth = maxWidth;
    while (high - low > 1) {
        const candidate = Math.floor((low + high) / 2);
        tooltipEl.style.width = `${candidate}px`;
        if (tooltipEl.offsetHeight <= targetHeight) {
            fittedWidth = candidate;
            high = candidate;
        } else {
            low = candidate;
        }
    }

    tooltipEl.style.width = `${fittedWidth}px`;
}

function renderDictionaryRichText(value) {
    if (!window.CharacterEffects) return String(value || '');
    return window.CharacterEffects.renderRichText(value);
}

// 툴팁 화면 표시 및 데이터 주입 로직 (명륜/은열쇠/비밀계약 완벽 호환 + 파밍처 추가) ㅁㄴㅇ
function showTooltip(item, e, mainStats = [], subStats = [], pinned = false) {
    if (itemTooltipPinned && !pinned) return;
    const ttTitle = document.getElementById('tt-title');
    const ttDesc = document.getElementById('tt-desc');
    const ttTags = document.getElementById('tt-tags');

    ttTitle.textContent = item.korean_name;
    itemTooltipPinned = pinned;
    let contentHtml = '';

    // 명륜 전용 주옵션
    if (item.main_stat) {
        contentHtml += `<div class="tooltip-main-stat">주옵션: ${item.main_stat}</div>`;
    }
    // 공통 설명 (은열쇠 등)
    if (item.description) {
        contentHtml += `<div class="tooltip-effect-desc">${renderDictionaryRichText(item.description)}</div>`;
    }

    // 비밀계약 전용 세트 효과
    if (item.set_effect_3) {
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-heading">[3세트 효과]</div>`;
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-body">${renderDictionaryRichText(item.set_effect_3)}</div>`;
    }
    if (item.set_effect_6) {
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-heading">[6세트 효과]</div>`;
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-body">${renderDictionaryRichText(item.set_effect_6)}</div>`;
    }

    // [추가된 부분] 획득처(파밍처) 정보가 JSON에 존재할 경우 출력
    if (item.source) {
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-heading tooltip-effect-heading-large">[획득처]</div>`;
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-body tooltip-effect-muted">${item.source}</div>`;
    }
    if (mainStats.length > 0) {
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-heading tooltip-effect-heading-large">[추천 주옵]</div>`;
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-body tooltip-effect-muted">${formatTooltipMainStats(mainStats)}</div>`;
    }
    if (subStats.length > 0) {
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-body tooltip-effect-muted"><strong>[추천 부옵]</strong> ${subStats.join(', ')}</div>`;
    }

    ttDesc.innerHTML = contentHtml;
    if (window.CharacterEffects) {
        window.CharacterEffects.setupTooltips(ttDesc);
    }
    ttTags.innerHTML = '';

    // 비밀계약/은열쇠(tags) 또는 명륜(optimized_for) 배열을 감지하여 태그 뱃지 생성
    const tagArray = (item.tags || item.optimized_for || [])
        .map(tag => String(tag || '').trim())
        .filter(Boolean);
    tagArray.forEach(tag => {
        const s = document.createElement('span');
        s.className = 'tooltip-tag';
        s.textContent = tag;
        ttTags.appendChild(s);
    });

    tooltipEl.style.display = 'block';
    fitTooltipWidth();
    moveTooltip(e);
}

// 툴팁 위치 실시간 추적 및 화면 이탈 방어 로직
function moveTooltip(e) {
    if (!tooltipEl || tooltipEl.style.display === 'none') return;

    let x = e.clientX + 15;
    let y = e.clientY + 15;

    const rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
        x = e.clientX - rect.width - 15;
    }
    if (y + rect.height > window.innerHeight) {
        y = e.clientY - rect.height - 15;
    }

    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
}

function hideTooltip(force = false) {
    if (itemTooltipPinned && !force) return;
    itemTooltipPinned = false;
    if (tooltipEl) {
        tooltipEl.style.display = 'none';
    }
}

function bindDynamicTooltips(root) {
    if (!root) return;
    root.querySelectorAll('[data-tooltip-kind][data-tooltip-id]').forEach(el => {
        const map = el.dataset.tooltipKind === 'wheel' ? window.wheelMap : window.covMap;
        const item = map && map[el.dataset.tooltipId];
        if (!item) return;
        const mainStats = decodeTooltipMainStats(el.dataset.tooltipMainStats);
        const subStats = decodeTooltipMainStats(el.dataset.tooltipSubStats);
        const pinTooltip = event => {
            event.preventDefault();
            event.stopPropagation();
            const rect = el.getBoundingClientRect();
            const position = Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
                ? event
                : { clientX: rect.left + (rect.width / 2), clientY: rect.top + (rect.height / 2) };
            showTooltip(item, position, mainStats, subStats, true);
        };
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${item.korean_name} 상세 정보`);
        el.onmouseenter = e => showTooltip(item, e, mainStats, subStats);
        el.onmousemove = moveTooltip;
        el.onmouseleave = () => hideTooltip();
        el.onpointerup = event => {
            if (event.pointerType !== 'mouse') pinTooltip(event);
        };
        el.onclick = pinTooltip;
        el.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') pinTooltip(event);
        };
    });
}

function encodeTooltipMainStats(stats) {
    if (!Array.isArray(stats) || stats.length === 0) return '';
    return encodeURIComponent(JSON.stringify(stats));
}

function decodeTooltipMainStats(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(decodeURIComponent(value));
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function formatTooltipMainStats(stats) {
    const partLabels = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
    if (stats.length !== partLabels.length) return stats.join(', ');
    return stats.map((stat, index) => `${partLabels[index]} ${stat}`).join('<br>');
}

tooltipEl.addEventListener('click', event => event.stopPropagation());
tooltipEl.addEventListener('mouseleave', () => hideTooltip());
document.addEventListener('click', event => {
    if (tooltipEl.contains(event.target)) return;
    hideTooltip(true);
});

function getDictionaryFilterMeta(item, category) {
    const tags = (item.tags || item.optimized_for || [])
        .map(tag => String(tag || '').trim())
        .filter(Boolean);
    const mainStatFilter = category === 'myeongryun' ? normalizeDictionaryFilterValue(item.main_stat, 'mainStat') : '';
    const effectFilters = category === 'myeongryun'
        ? []
        : tags
            .filter(tag => !isExcludedDictionaryEffect(tag, category))
            .map(tag => normalizeDictionaryFilterValue(tag, 'effect'))
            .filter(Boolean);
    return {
        nameText: [
            item.korean_name,
            item.english_name
        ].filter(Boolean).join(' ').toLowerCase(),
        text: [
            item.korean_name,
            item.english_name,
            item.description,
            item.set_effect_3,
            item.set_effect_6,
            item.main_stat,
            tags.join(' ')
        ].filter(Boolean).join(' ').toLowerCase(),
        grade: category === 'myeongryun' ? String(item.grade || '').trim() : '',
        mainStat: mainStatFilter,
        effectFilters
    };
}

function isExcludedDictionaryEffect(tag, category) {
    return category === 'silverkey' && window.characterNameSet?.has(String(tag || '').trim());
}

function normalizeDictionaryFilterValue(value, type) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let normalized = raw
        .replace(/\s+/g, ' ')
        .replace(/드롭율/g, '드롭')
        .replace(/겅은 인장/g, '검은 인장')
        .trim();

    if (type === 'mainStat') {
        return normalized
            .replace(/^영역숙련/, '영역 숙련')
            .replace(/검은 인장 드롭\s*(\d)/, '검은 인장 드롭 $1')
            .replace(/\s+\d+(?:\.\d+)?%?$/, '');
    }

    const compact = normalized.replace(/\s+/g, '');
    if (/^광기(회복|획득|부여|획득량증가)$/.test(compact)) return '광기';
    if (/^HP회복(량증가)?$/.test(compact)) return 'HP 회복';
    if (/^은열쇠게이지(획득)?$/.test(compact)) return '은열쇠 게이지';
    if (/^배아융합(증가)?$/.test(compact)) return '배아 융합';
    if (/^죽음저항(제거)?$/.test(compact)) return '죽음 저항';
    if (/^검은인장드롭$/.test(compact)) return '검은 인장 드롭';
    if (/^방어막증가$/.test(compact)) return '방어막';

    const effectAliases = {
        광기소모량증가: '광기 소모량 증가',
        은열쇠소모량증가: '은열쇠 소모량 증가',
        은열쇠에너지회복: '은열쇠 에너지 회복',
        최대광기증가: '최대 광기 증가',
        최대은열쇠에너지증가: '최대 은열쇠 에너지 증가',
        최종피해증가: '최종 피해 증가',
        산출력획득: '산출력',
        힘획득: '힘',
        방어추가: '방어 추가',
        타격추가: '타격 추가',
        명령카드복제: '명령 카드 복제',
        크리티컬피해: '크리티컬 피해',
        크리티컬확률: '크리티컬 확률',
        피해증폭: '피해 증폭'
    };

    return effectAliases[compact] || raw;
}

function uniqueSortedValues(values) {
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'ko'));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildFilterCheckboxes(name, values) {
    return values.map(value => `
        <label class="dictionary-filter-option">
            <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}">
            <span>${escapeHtml(value)}</span>
        </label>
    `).join('');
}

function getCheckedFilterValues(panel, name) {
    return [...panel.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
}

function renderDictionaryFilters(data, category, onFilterChange) {
    const panel = document.getElementById('dictionary-filter-panel');
    if (!panel) return;

    const metaByItem = new Map(data.map(item => [item, getDictionaryFilterMeta(item, category)]));
    const mainStats = uniqueSortedValues([...metaByItem.values()].map(meta => meta.mainStat));
    const effects = uniqueSortedValues([...metaByItem.values()].flatMap(meta => meta.effectFilters));
    const isMyeongryun = category === 'myeongryun';
    const grades = uniqueSortedValues([...metaByItem.values()].map(meta => meta.grade));
    const optionFieldHtml = isMyeongryun ? `
        <div class="dictionary-filter-field">
            <span class="dictionary-filter-section-title">등급</span>
            <div class="dictionary-filter-options">
                ${buildFilterCheckboxes('dictionary-grade-filter', grades)}
            </div>
        </div>
        <div class="dictionary-filter-field">
            <span class="dictionary-filter-section-title">주옵션</span>
            <div class="dictionary-filter-options">
                ${buildFilterCheckboxes('dictionary-main-filter', mainStats)}
            </div>
        </div>
    ` : `
        <div class="dictionary-filter-field">
            <span class="dictionary-filter-section-title">효과</span>
            <div class="dictionary-filter-options">
                ${buildFilterCheckboxes('dictionary-effect-filter', effects)}
            </div>
        </div>
    `;

    panel.classList.add('show');
    panel.innerHTML = `
        <div class="dictionary-filter-top">
            <div class="dictionary-filter-field">
                <label for="dictionary-search">검색</label>
                <input id="dictionary-search" type="search" placeholder="이름, 설명, 효과 검색">
            </div>
            <div class="dictionary-filter-footer">
                <div id="dictionary-filter-summary" class="dictionary-filter-summary"></div>
                <button type="button" id="dictionary-filter-reset" class="dictionary-filter-reset">필터 초기화</button>
            </div>
        </div>
        ${optionFieldHtml}
    `;

    const searchUtils = window.SearchUtils;
    const controls = {
        search: panel.querySelector('#dictionary-search'),
        reset: panel.querySelector('#dictionary-filter-reset'),
        summary: panel.querySelector('#dictionary-filter-summary')
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
    grid.innerHTML = '';
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
        card.setAttribute('aria-label', `${item.korean_name} 상세 정보`);

        const img = document.createElement('img');
        img.src = item.image_path;
        img.alt = item.korean_name;
        img.loading = 'lazy';
        img.className = 'dictionary-item-image';

        // 은열쇠와 비밀계약은 1:1, 명륜은 인게임 비율 적용
        if (category === 'silverkey' || category === 'covenant') {
            img.style.aspectRatio = '1/1';
        } else {
            img.style.aspectRatio = '225/456';
        }

        const name = document.createElement('span');
        name.className = 'dictionary-item-name';
        name.textContent = item.korean_name;

        card.onmouseenter = (e) => {
            card.classList.add('active');
            showTooltip(item, e);
        };
        card.onmousemove = moveTooltip;
        card.onmouseleave = () => {
            card.classList.remove('active');
            hideTooltip();
        };
        const pinTooltip = (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add('active');
            showTooltip(item, e, [], [], true);
        };
        // 모바일 브라우저가 이미지 터치 뒤 click 이벤트를 만들지 않는 경우에도
        // 툴팁을 열 수 있도록 실제 터치 종료 이벤트를 함께 처리한다.
        card.onpointerup = (e) => {
            if (e.pointerType !== 'mouse') pinTooltip(e);
        };
        card.onclick = pinTooltip;

        card.append(img, name);
        grid.appendChild(card);
    });

    if (data.length === 0) {
        grid.innerHTML = '<div class="dictionary-empty">조건에 맞는 항목이 없습니다.</div>';
    }
}

function renderDictionary(data, category) {
    renderDictionaryFilters(data, category, filtered => renderDictionaryItems(filtered, category));
}

function setLinksDocumentTitle(pageName) {
    document.title = `${pageName} | 미사그 대학 한국 캠퍼스`;
}

function trackLinksPageView() {
    if (typeof window.sendGoogleAnalyticsPageView === 'function') {
        window.sendGoogleAnalyticsPageView();
    }
}

const initializeLinksPage = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const charId = urlParams.get('id');
    const titleEl = document.getElementById('page-title');
    const listEl = document.getElementById('links-list');
    const tabsContainer = document.querySelector('.chrome-tabs-container');
    const linkContainer = document.querySelector('.link-container');
    const partySlot = document.getElementById('party-link-slot');

    setLinksDocumentTitle('정보 모음');

    document.getElementById('links-back-link')?.addEventListener('click', (event) => {
        event.preventDefault();
        goBack();
    });

    document.querySelectorAll('[data-tab-target]').forEach((tab) => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tabTarget));
    });

    document.getElementById('open-report-modal')?.addEventListener('click', openReportModal);
    document.getElementById('close-sub-modal')?.addEventListener('click', closeSubModal);

    const isCharacterPage = (category === 'character');
    const isDictionaryPage = (category === 'myeongryun' || category === 'silverkey' || category === 'covenant');
    if (linkContainer) {
        linkContainer.classList.toggle('dictionary-wide', isDictionaryPage);
    }

    // 1. 탭 표시 설정 및 명칭 수정
    if (tabsContainer) {
        tabsContainer.style.display = (isDictionaryPage || isCharacterPage) ? 'flex' : 'none';
        const dictionaryTab = document.querySelector('[data-tab-target="dictionary"]');
        const effectsTab = document.querySelector('[data-tab-target="character-effects"]');
        const linksTab = document.querySelector('[data-tab-target="links"]');
        if (effectsTab) effectsTab.hidden = !isCharacterPage;
        if (isCharacterPage) {
            if (effectsTab && dictionaryTab) {
                tabsContainer.insertBefore(effectsTab, dictionaryTab);
            }
            if (dictionaryTab) dictionaryTab.textContent = '추천 세팅';
            if (linksTab) linksTab.textContent = '채널 정보글 리스트';
        } else if (isDictionaryPage) {
            if (category === 'myeongryun' && dictionaryTab) dictionaryTab.textContent = '명륜 리스트';
            else if (category === 'silverkey' && dictionaryTab) dictionaryTab.textContent = '은열쇠 리스트';
            else if (category === 'covenant' && dictionaryTab) dictionaryTab.textContent = '비밀계약 리스트';
            if (linksTab) linksTab.textContent = '채널 정보글 리스트';
        }
    }

    try {
        const ts = new Date().getTime();
        const [manifest, linksDB, wheelList, covList, settingsDB, keyList, characterEffectsDB, tooltipDB, wheelRecommendationsDB] = await Promise.all([
            fetch(`data/character_manifest.json?t=${ts}`).then(res => res.json()),
            fetch(`data/resource_links.json?t=${ts}`).then(res => res.json()),
            fetch(`data/wheel_list.json?t=${ts}`).then(res => res.json()),
            fetch(`data/covenant_list.json?t=${ts}`).then(res => res.json()),
            fetch(`data/character_settings.json?t=${ts}`).then(res => res.json()),
            fetch(`data/silverkey_list.json?t=${ts}`).then(res => res.json()).catch(() => []),
            fetch(`data/character_effects.json?t=${ts}`).then(res => res.json()).catch(() => ({})),
            fetch(`data/db_tooltips.json?t=${ts}`).then(res => res.json()).catch(() => ({})),
            fetch(`data/latest_wheel_recommendations.json?t=${ts}`).then(res => res.json()).catch(() => ({ records: [] }))
        ]);

        window.wheelMap = {};
        wheelList.forEach(w => {
            window.wheelMap[w.english_name] = w;
            window.wheelMap[w.korean_name] = w;
        });
        window.covMap = {};
        covList.forEach(c => {
            window.covMap[c.english_name] = c;
            window.covMap[c.korean_name] = c;
        });
        window.characterNameSet = new Set(manifest.map(character => character.name).filter(Boolean));
        if (window.CharacterEffects) {
            window.CharacterEffects.configureTooltips(tooltipDB);
        }
        window.currentSettings = settingsDB;
        window.wheelRecommendationLookup = createWheelRecommendationLookup(wheelRecommendationsDB.records || []);

        const charData = manifest.find(c => c.id === charId);
        let targetItems = [];

        // 융재금구(weapon) 카테고리 진입 시 내부 시뮬레이터 버튼 노출
        if (partySlot) {
            if (category === 'weapon') {
                partySlot.innerHTML = `<a href="party_builder.html?from=weapon" class="party-link-btn">융재 금구 파티 시뮬레이터 실행 (Beta)</a>`;
            } else {
                partySlot.innerHTML = '';
            }
        }

        // 1. 캐릭터 공략 페이지
        if (isCharacterPage && charData) {
            titleEl.innerHTML = `<img src="${charData.image_thumb}" class="title-thumb"> ${charData.name} 공략 모음`;
            setLinksDocumentTitle(`${charData.name} 공략 모음`);
            targetItems = linksDB.characters[charId] || [];
            if (window.CharacterEffects) {
                window.CharacterEffects.render(
                    document.getElementById('character-effects-root'),
                    characterEffectsDB[charId],
                    charData.name,
                    tooltipDB
                );
            }
            // (생략: 추천 세팅 렌더링 로직은 기존과 동일)
            const gridContainer = document.getElementById('dictionary-grid');
            const filterPanel = document.getElementById('dictionary-filter-panel');
            const settings = settingsDB[charId] || settingsDB[charData.name];
            if (filterPanel) {
                filterPanel.classList.remove('show');
                filterPanel.innerHTML = '';
            }
            if (gridContainer) {
                gridContainer.className = '';
                gridContainer.innerHTML = '';
                if (settings) {
                    const settingsList = Array.isArray(settings) ? settings : [settings];
                    settingsList.forEach((setInfo, idx) => {
                        const getWheel = (id) => window.wheelMap[id] || { korean_name: "정보 없음", image_path: "images/placeholder.png" };
                        const getCov = (id) => window.covMap[id] || { korean_name: "정보 없음", image_path: "images/placeholder.png" };
                        const ssrWheelId = setInfo.myeongryun_ssr?.main_id;
                        const srWheelId = setInfo.myeongryun_sr?.main_id;
                        const ssrWheel = getWheel(ssrWheelId);
                        const srWheel = getWheel(srWheelId);
                        const covenantMainId = setInfo.covenant?.main_id;
                        const mainCov = getCov(covenantMainId);
                        const mainCovStats = encodeTooltipMainStats(setInfo.covenant?.main_stats);
                        const covenantSubStats = encodeTooltipMainStats(setInfo.covenant?.sub_stats);
                        const renderSubLink = (type, list, charId, idx) => {
                            const label = type === 'covenant' ? '대체 비밀계약' : '대체 명륜';
                            if (list && list.length > 0) return `<div class="sub-link" data-sub-modal-type="${type}" data-character-id="${charId}" data-setting-index="${idx}">${label}</div>`;
                            return `<div class="sub-link disabled">대체 정보 없음</div>`;
                        };
                        const wheelRecommendation = findWheelRecommendation(charId, setInfo);
                        const wheelDisplay = wheelRecommendation
                            ? buildWheelDisplayItems(wheelRecommendation)
                            : null;
                        const wheelPairClass = wheelDisplay?.length === 1
                            ? 'wheel-pair wheel-pair-single'
                            : 'wheel-pair';
                        const secondWheelSlotClass = wheelDisplay && !wheelDisplay[1]
                            ? 'equip-slot equip-slot-empty'
                            : 'equip-slot';
                        const renderWheelDisplay = (item, position) => {
                            if (!item) return '';
                            const label = item.tier === 'substitute' ? '대체' : '';
                            const labelMarkup = label
                                ? `<div class="equip-label">${label}</div>`
                                : '<div class="equip-label equip-label-spacer" aria-hidden="true">추천 명륜</div>';
                            const action = '<div class="sub-link sub-link-spacer" aria-hidden="true">보기</div>';
                            if (item.kind === 'stat') {
                                return `
                                    ${labelMarkup}
                                    <div class="equip-stat-card">
                                        <span class="equip-stat-value">${item.value}</span>
                                    </div>
                                    <div class="equip-name-label">${item.value}</div>
                                    ${action}`;
                            }
                            const wheel = getWheel(item.value);
                            return `
                                ${labelMarkup}
                                <img src="${wheel.image_path}" class="equip-img-myeongryun" data-tooltip-kind="wheel" data-tooltip-id="${item.value}" onerror="this.src='images/placeholder.png';">
                                <div class="equip-name-label">${wheel.korean_name}</div>
                                ${action}`;
                        };
                        gridContainer.innerHTML += `
                            <div class="recommend-box">
                                <div class="recommend-left">
                                    <img src="${charData.image_thumb}" class="recommend-thumb" onerror="this.src='images/smile_Ramona.webp';">
                                    <div class="recommend-role">${setInfo.settingName} 세팅</div>
                                    <div class="recommend-step">${setInfo.recommendStep} 추천</div>
                                </div>
                                <div class="recommend-right">
                                    <div class="${wheelPairClass}">
                                        <div class="wheel-pair-heading">추천 명륜</div>
                                        <div class="equip-slot">
                                            ${wheelDisplay ? renderWheelDisplay(wheelDisplay[0], 0) : `
                                                <div class="equip-label equip-label-spacer" aria-hidden="true">추천 명륜</div>
                                                <img src="${ssrWheel.image_path}" class="equip-img-myeongryun" data-tooltip-kind="wheel" data-tooltip-id="${ssrWheelId}" onerror="this.src='images/placeholder.png';">
                                                <div class="equip-name-label">${ssrWheel.korean_name}</div>
                                                <div class="sub-link sub-link-spacer" aria-hidden="true">보기</div>
                                            `}
                                        </div>
                                        <div class="${secondWheelSlotClass}">
                                            ${wheelDisplay ? renderWheelDisplay(wheelDisplay[1], 1) : `
                                                <div class="equip-label equip-label-spacer" aria-hidden="true">추천 명륜</div>
                                                <img src="${srWheel.image_path}" class="equip-img-myeongryun" data-tooltip-kind="wheel" data-tooltip-id="${srWheelId}" onerror="this.src='images/placeholder.png';">
                                                <div class="equip-name-label">${srWheel.korean_name}</div>
                                                <div class="sub-link sub-link-spacer" aria-hidden="true">보기</div>
                                            `}
                                        </div>
                                        <button type="button" class="wheel-options-link" data-sub-modal-type="wheel-options" data-character-id="${charId}" data-setting-index="${idx}">명륜 선택지 보기</button>
                                    </div>
                                    <div class="equip-slot">
                                        <div class="equip-label">추천 비밀계약</div>
                                        ${covenantMainId ? `
                                            <img src="${mainCov.image_path}" class="equip-img-covenant" data-tooltip-kind="covenant" data-tooltip-id="${covenantMainId}" data-tooltip-main-stats="${mainCovStats}" data-tooltip-sub-stats="${covenantSubStats}" onerror="this.src='images/placeholder.png';">
                                            <div class="equip-name-label">${mainCov.korean_name}</div>
                                            ${renderSubLink('covenant', setInfo.covenant.substitutes, charId, idx)}
                                        ` : `
                                            <div class="equip-covenant-free">자유</div>
                                            <div class="equip-name-label">자유 선택</div>
                                            <div class="sub-link" data-sub-modal-type="covenant-free" data-character-id="${charId}" data-setting-index="${idx}">선택 조건 보기</div>
                                        `}
                                    </div>
                                </div>
                            </div>`;
                    });
                    gridContainer.querySelectorAll('.wheel-options-link').forEach(link => {
                        link.textContent = '\uBA85\uB95C \uC120\uD0DD\uC9C0';
                    });
                    gridContainer.querySelectorAll('.wheel-pair-heading').forEach(heading => {
                        heading.textContent = '\uCD94\uCC9C \uBA85\uB95C';
                    });
                    gridContainer.querySelectorAll('.wheel-pair .equip-label').forEach(label => {
                        if (label.textContent.trim() === '\uB300\uCCB4') {
                            label.textContent = '';
                            label.setAttribute('aria-hidden', 'true');
                        }
                    });
                    bindDynamicTooltips(gridContainer);
                } else {
                    gridContainer.innerHTML = `<div class="no-setting-notice"><div class="no-setting-icon">📝</div><div>아직 추천 세팅 정보가 등록되지 않았습니다.</div></div>`;
                }
            }
            switchTab('character-effects');
        }

        // 2. 도감 페이지 (명륜/비밀계약/은열쇠)
        else if (isDictionaryPage) {
            if (category && linksDB.categories[category]) {
                titleEl.textContent = linksDB.categories[category].title;
                setLinksDocumentTitle(linksDB.categories[category].title);
                targetItems = linksDB.categories[category].links || [];
            }
            let dictData = (category === 'myeongryun') ? wheelList : (category === 'covenant') ? covList : keyList;
            if (dictData && dictData.length > 0) renderDictionary(dictData, category);
            switchTab('dictionary');
        }

        // 3. 교환 코드(code) 전용 처리
        else if (category === 'code') {
            if (linksDB.categories[category]) {
                titleEl.textContent = linksDB.categories[category].title;
                setLinksDocumentTitle(linksDB.categories[category].title);
                const codes = linksDB.categories[category].links || [];
                renderCodeLinks(codes, listEl); // 전용 렌더러 호출
                switchTab('links');
                trackLinksPageView();
                return; // 공통 렌더링 로직을 타지 않도록 종료
            }
        }

        // 4. 일반 페이지 (기타 카테고리)
        else if (category && linksDB.categories[category]) {
            titleEl.textContent = linksDB.categories[category].title;
            setLinksDocumentTitle(linksDB.categories[category].title);
            targetItems = linksDB.categories[category].links || [];
            switchTab('links');
        }

        // 공통: 리스트 카드 출력 (교환 코드가 아닌 일반 링크용)
        listEl.innerHTML = '';
        if (targetItems.length === 0) {
            listEl.innerHTML = `<div class="no-data"><p>📭</p><p>아직 등록된 정보가 없습니다.</p></div>`;
        } else {
            targetItems.forEach(item => {
                if (typeof item === 'string') createLinkCardInstant({ url: item }, listEl);
                else createLinkCardInstant(item, listEl);
            });
        }

        trackLinksPageView();

    } catch (error) {
        console.error("데이터 로드 오류:", error);
        trackLinksPageView();
    }

    const subModal = document.getElementById('substitute-modal');
    if (subModal) {
        subModal.addEventListener('click', (e) => { if (e.target === subModal) closeSubModal(); });
    }

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-sub-modal-type]');
        if (!trigger) return;
        openDynamicSubModal(
            trigger.dataset.subModalType,
            trigger.dataset.characterId,
            Number(trigger.dataset.settingIndex || 0)
        );
    });

};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLinksPage, { once: true });
} else {
    initializeLinksPage();
}

function createWheelRecommendationLookup(records) {
    const exact = new Map();
    const byCharacterAndSetting = new Map();
    const byCharacter = new Map();

    records.forEach(record => {
        exact.set(`${record.character_id}|${record.source_key}|${record.setting_name}`, record);
        byCharacter.set(record.character_id, [
            ...(byCharacter.get(record.character_id) || []),
            record
        ]);
        const fallbackKey = `${record.character_id}|${record.setting_name}`;
        if (!byCharacterAndSetting.has(fallbackKey)) {
            byCharacterAndSetting.set(fallbackKey, record);
        } else {
            byCharacterAndSetting.set(fallbackKey, null);
        }
    });

    return { exact, byCharacterAndSetting, byCharacter };
}

function findWheelRecommendation(charId, setInfo) {
    if (!setInfo) return null;
    if (setInfo.myeongryun) return setInfo.myeongryun;

    const lookup = window.wheelRecommendationLookup;
    if (!lookup) return null;

    const exactKey = `${charId}|${setInfo.settings_source || ''}|${setInfo.settingName || ''}`;
    const fallbackKey = `${charId}|${setInfo.settingName || ''}`;
    const directMatch = lookup.exact.get(exactKey) || lookup.byCharacterAndSetting.get(fallbackKey);
    if (directMatch) return directMatch;

    const characterRecommendations = lookup.byCharacter.get(charId) || [];
    const screenSettings = window.currentSettings?.[charId];
    const screenSettingCount = Array.isArray(screenSettings) ? screenSettings.length : screenSettings ? 1 : 0;
    return characterRecommendations.length === 1 && screenSettingCount === 1
        ? characterRecommendations[0]
        : null;
}

function buildWheelDisplayItems(record) {
    if (record.display_values?.length > 0) {
        return record.display_values
            .slice(0, record.selection_count || 2)
            .map(value => ({ kind: 'stat', tier: 'recommended', value }));
    }
    const recommended = [
        ...(record.recommended_ids || []).map(value => ({ kind: 'wheel', tier: 'recommended', value })),
        ...(record.recommended_stats || []).map(value => ({ kind: 'stat', tier: 'recommended', value }))
    ];
    const substitutes = [
        ...(record.substitute_ids || []).map(value => ({ kind: 'wheel', tier: 'substitute', value })),
        ...(record.substitute_stats || []).map(value => ({ kind: 'stat', tier: 'substitute', value }))
    ];
    return [...recommended, ...substitutes].slice(0, record.selection_count || 2);
}

function openDynamicSubModal(type, charId, idx = 0) {
    if (!window.currentSettings || !window.currentSettings[charId]) return;

    const settings = window.currentSettings[charId];
    // 배열 여부 확인 후 해당 인덱스의 세팅 추출
    const setInfo = Array.isArray(settings) ? settings[idx] : settings;

    const modal = document.getElementById('substitute-modal');
    const title = document.getElementById('sub-modal-title');
    const body = document.getElementById('sub-modal-body');
    modal.classList.remove('stat-only');

    let ids = [];
    let stats = [];
    let isWheel = true;

    if (type === 'wheel-options') {
        const recommendation = findWheelRecommendation(charId, setInfo);
        const recommendedIds = recommendation?.recommended_ids || [
            setInfo.myeongryun_ssr.main_id,
            setInfo.myeongryun_sr.main_id
        ].filter(Boolean);
        const substituteIds = recommendation?.substitute_ids || [
            ...(setInfo.myeongryun_ssr.substitutes || []),
            ...(setInfo.myeongryun_sr.substitutes || [])
        ];
        const mainStats = recommendation?.recommended_stats || [];
        const substituteStats = recommendation?.substitute_stats || [];
        const isStatOnly = recommendedIds.length === 0
            && substituteIds.length === 0
            && mainStats.length + substituteStats.length > 0;
        modal.classList.toggle('stat-only', isStatOnly);
        title.textContent = '명륜 선택지';
        body.innerHTML = renderWheelOptionsModal(
            recommendedIds,
            substituteIds,
            [...mainStats, ...substituteStats]
        );
        bindDynamicTooltips(body);
        modal.classList.add('show');
        return;
    } else if (type === 'covenant-free') {
        const optionIds = setInfo.covenant?.options || [];
        const optionStats = setInfo.covenant?.recommended_stats || [];
        title.textContent = '비밀계약 선택 조건';
        body.innerHTML = renderCovenantFreeModal(optionIds, optionStats);
        bindDynamicTooltips(body);
        modal.classList.add('show');
        return;
    } else if (type === 'recommended-wheel' || type === 'substitute-wheel') {
        const recommendation = findWheelRecommendation(charId, setInfo);
        if (!recommendation) return;
        const isRecommended = type === 'recommended-wheel';
        title.textContent = isRecommended ? '추천 명륜 · 2개 선택' : '대체 명륜';
        ids = isRecommended ? recommendation.recommended_ids || [] : recommendation.substitute_ids || [];
        stats = isRecommended ? recommendation.recommended_stats || [] : recommendation.substitute_stats || [];
    } else if (type === 'ssr') {
        title.textContent = '대체할 SSR 명륜';
        ids = setInfo.myeongryun_ssr.substitutes || [];
    } else if (type === 'sr') {
        title.textContent = '대체할 SR 명륜';
        ids = setInfo.myeongryun_sr.substitutes || [];
    } else {
        title.textContent = '대체할 비밀계약';
        ids = setInfo.covenant.substitutes || [];
        isWheel = false;
    }

    const itemCount = ids.length;
    const gridCols = Math.min(Math.max(itemCount, 1), 4);

    let html = `<div class="substitute-grid cols-${gridCols}">`;

    if (itemCount === 0 && stats.length === 0) {
        html = '<div class="sub-modal-empty">등록된 대체 정보가 없습니다.</div>';
    } else {
        ids.forEach(id => {
            const data = isWheel ? window.wheelMap[id] : window.covMap[id];
            if (data) {
                const mainStats = !isWheel ? encodeTooltipMainStats(setInfo.covenant.substitute_main_stats?.[id]) : '';
                html += `
                <div class="sub-item-vertical">
                    <img src="${data.image_path || data.image_thumb || 'images/placeholder.png'}"
                         alt=""
                         class="${isWheel ? 'sub-img-myeongryun' : 'sub-img-covenant'}"
                         data-tooltip-kind="${isWheel ? 'wheel' : 'covenant'}"
                         data-tooltip-id="${id}"
                         data-tooltip-main-stats="${mainStats}"
                         onerror="this.src='images/placeholder.png';">
                    <div class="sub-item-name">${data.korean_name}</div>
                </div>`;
            }
        });
        html += '</div>';
        if (stats.length > 0) {
            html += `
                <div class="stat-recommendation-section">
                    <div class="stat-chip-list">
                        ${stats.map(stat => `<span class="stat-chip">${stat}</span>`).join('')}
                    </div>
                </div>`;
        }
    }

    body.innerHTML = html;
    bindDynamicTooltips(body);
    modal.classList.add('show');
}

function renderWheelOptionsModal(recommendedIds, substituteIds, stats) {
    const unique = values => [...new Set(values.filter(Boolean))];
    const columnCount = values => Math.min(Math.max(unique(values).length, 1), 3);
    const columnWidth = values => {
        const columns = columnCount(values);
        return 40 + (columns * 102) + ((columns - 1) * 10);
    };
    const renderWheels = ids => {
        const items = unique(ids);
        if (items.length === 0) return '<div class="wheel-option-empty">없음</div>';
        return `<div class="wheel-option-items">${items.map(id => {
            const wheel = window.wheelMap[id];
            if (!wheel) return '';
            return `
                <div class="sub-item-vertical">
                    <img src="${wheel.image_path || 'images/placeholder.png'}"
                         alt=""
                         class="sub-img-myeongryun"
                         data-tooltip-kind="wheel"
                         data-tooltip-id="${id}"
                         onerror="this.src='images/placeholder.png';">
                    <div class="sub-item-name">${wheel.korean_name}</div>
                </div>`;
        }).join('')}</div>`;
    };
    const uniqueStats = unique(stats);
    const hasRecommended = unique(recommendedIds).length > 0;
    const hasSubstitutes = unique(substituteIds).length > 0;
    const hasStats = uniqueStats.length > 0;
    const statGuide = hasRecommended || hasSubstitutes
        ? `${hasSubstitutes ? '추천·대체' : '추천'} 명륜을 보유하지 않았을 때, 아래 주옵을 가진 명륜을 사용하는 것을 추천합니다.`
        : '아래 주옵을 가진 명륜을 사용하는 것을 추천합니다.';
    const sections = [
        hasRecommended ? {
            className: 'wheel-option-recommended',
            title: '추천 명륜',
            content: renderWheels(recommendedIds),
            width: columnWidth(recommendedIds)
        } : null,
        hasSubstitutes ? {
            className: 'wheel-option-substitute',
            title: '대체 명륜',
            content: renderWheels(substituteIds),
            width: columnWidth(substituteIds)
        } : null,
        hasStats ? {
            className: 'wheel-option-stats',
            title: hasRecommended || hasSubstitutes ? '대체 주옵' : '추천 주옵',
            content: `
                <div class="wheel-option-stat-content">
                    <p class="wheel-option-stat-guide">${statGuide}</p>
                    <div class="stat-chip-list">${uniqueStats.map(stat => `<span class="stat-chip">${stat}</span>`).join('')}</div>
                </div>`,
            width: 220
        } : null
    ].filter(Boolean);

    const substituteSection = sections.find(section => section.className === 'wheel-option-substitute');
    if (substituteSection) substituteSection.title = '\uB300\uCCB4 \uBA85\uB95C';

    if (sections.length === 0) {
        return '<div class="sub-modal-empty">등록된 선택지가 없습니다.</div>';
    }

    return `
        <div class="wheel-options-layout sections-${sections.length}" style="--wheel-options-columns: ${sections.map(section => `${section.width}px`).join(' ')}; --recommended-columns: ${columnCount(recommendedIds)}; --substitute-columns: ${columnCount(substituteIds)};">
            ${sections.map(section => `
                <section class="wheel-option-column ${section.className}">
                    <h3>${section.title}</h3>
                    ${section.content}
                </section>
            `).join('')}
        </div>`;
}

function renderCovenantFreeModal(optionIds, stats) {
    const unique = values => [...new Set(values.filter(Boolean))];
    const ids = unique(optionIds);
    const statValues = unique(stats);
    let html = '';

    if (ids.length > 0) {
        html += `<div class="covenant-free-options">${ids.map(id => {
            const covenant = window.covMap[id];
            if (!covenant) return '';
            return `
                <div class="sub-item-vertical">
                    <img src="${covenant.image_path || 'images/placeholder.png'}"
                         alt=""
                         class="sub-img-covenant"
                         data-tooltip-kind="covenant"
                         data-tooltip-id="${id}"
                         onerror="this.src='images/placeholder.png';">
                    <div class="sub-item-name">${covenant.korean_name}</div>
                </div>`;
        }).join('')}</div>`;
    }

    if (statValues.length > 0) {
        html += `<div class="covenant-free-stats">
            ${statValues.map(stat => `<span class="stat-chip">${stat}</span>`).join('')}
        </div>`;
    }

    return html || '<div class="sub-modal-empty">필요한 옵션을 자유롭게 선택합니다.</div>';
}

// --- 유틸리티 함수 ---
function getProxyImage(url) {
    if (!url) return 'images/smile_Ramona.webp';
    url = url.trim();
    if (url.startsWith('//')) { url = 'https:' + url; }
    if (url.includes('namu.la') || url.includes('arca.live') || url.includes('dcinside')) {
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp&n=-1`;
    }
    return url;
}

function renderCodeLinks(items, container) {
    container.innerHTML = ''; // 초기화

    // 1. 데이터 분류
    const permanent = items.filter(item => !item.expiry);
    const temporary = items.filter(item => item.expiry && new Date(item.expiry) >= new Date().setHours(0,0,0,0));

    // D-Day 계산 함수
    const getDDay = (dateStr) => {
        const diff = new Date(dateStr) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days === 0 ? "오늘 만료" : `${days}일 남음`;
    };

    // 코드 문자열을 버튼 속성에서 다시 읽지 않고, 생성 시점에 직접 묶는다.
    const createCard = (item, isTemp) => {
        const card = document.createElement('div');
        card.className = 'code-card';

        const details = document.createElement('div');
        details.className = 'code-details';

        const title = document.createElement('span');
        title.className = 'code-title';
        title.textContent = String(item.title || '');

        const reward = document.createElement('span');
        reward.className = 'code-reward';
        reward.textContent = item.desc || '보상 정보 없음';

        details.append(title, reward);
        if (isTemp) {
            const timer = document.createElement('div');
            timer.className = 'code-timer';
            timer.textContent = `⏳ ${getDDay(item.expiry)}`;
            details.appendChild(timer);
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'code-copy-btn';
        button.textContent = '복사';
        button.addEventListener('click', () => copyCodeToClipboard(item.title, button));

        card.append(details, button);
        return card;
    };

    // 2. 기간 한정 코드 렌더링
    if (temporary.length > 0) {
        container.insertAdjacentHTML('beforeend', '<div class="section-label">📅 기간 한정 코드</div>');
        const tempGroup = document.createElement('div');
        tempGroup.className = 'code-card-container';
        temporary.forEach(item => tempGroup.appendChild(createCard(item, true)));
        container.appendChild(tempGroup);
    }

    // 3. 상시 코드 렌더링
    if (permanent.length > 0) {
        container.insertAdjacentHTML('beforeend', '<div class="section-label">♾️ 상시 코드</div>');
        const permGroup = document.createElement('div');
        permGroup.className = 'code-card-container';
        permanent.forEach(item => permGroup.appendChild(createCard(item, false)));
        container.appendChild(permGroup);
    }
}

function createLinkCardInstant(data, container) {
    try {
        let domain = 'link';
        try { if(data.url) domain = new URL(data.url).hostname; } catch(e) {}
        const safeImage = 'images/smile_Ramona.webp';

        const html = `
            <a href="${data.url}" target="_blank" class="notion-bookmark">
                <div class="bookmark-content">
                    <div>
                        <div class="bookmark-title">${data.title || '제목 없음'}</div>
                    </div>
                    <div class="bookmark-url">
                        <img src="https://www.google.com/s2/favicons?domain=${domain}" width="14" height="14" class="bookmark-favicon">
                        ${domain}
                    </div>
                </div>
                <div class="bookmark-image">
                    <img src="${safeImage}" alt="" loading="lazy"
                         onerror="this.onerror=null; this.src='images/smile_Ramona.webp';">
                </div>
            </a>`;
        container.insertAdjacentHTML('beforeend', html);
    } catch (e) { console.error("카드 생성 에러:", e); }
}

async function createLinkCardFromAPI(url, container) {
    createLinkCardInstant({ url }, container);
    return;
    /*
    const cardWrap = document.createElement('div');
    cardWrap.className = 'skeleton skeleton-card';
    cardWrap.innerHTML = `<div class="skeleton-content"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-desc"></div></div><div class="skeleton skeleton-img"></div>`;
    container.appendChild(cardWrap);
    try {
        const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        const json = await res.json();

        if (json.status === 'success') {
            const data = json.data;
            const safeImage = getProxyImage(data.image?.url);

            cardWrap.className = 'notion-bookmark';
            cardWrap.innerHTML = '';

            const linkEl = document.createElement('a');
            linkEl.href = url;
            linkEl.target = "_blank";
            linkEl.className = "notion-bookmark notion-bookmark-full";

            linkEl.innerHTML = `
                <div class="bookmark-content">
                    <div>
                        <div class="bookmark-title">${data.title || url}</div>
                        <div class="bookmark-desc">${data.description || '설명이 없습니다.'}</div>
                    </div>
                    <div class="bookmark-url">🔗 ${data.publisher || 'Link'}</div>
                </div>
                <div class="bookmark-image">
                    <img src="${safeImage}" alt="" loading="lazy" onerror="this.onerror=null; this.src='images/smile_Ramona.webp';">
                </div>`;

            container.replaceChild(linkEl, cardWrap);
        } else { throw new Error("API Fail"); }
    } catch (e) {
        cardWrap.className = 'notion-bookmark';
        cardWrap.innerHTML = `<a href="${url}" target="_blank" class="notion-bookmark-fallback"><div class="notion-bookmark-fallback-title">${url}</div><div class="notion-bookmark-fallback-desc">(미리보기 로드 실패)</div></a>`;
    }
    */
}
