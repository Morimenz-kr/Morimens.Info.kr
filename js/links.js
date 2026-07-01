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
// 🚩 전역 복사 함수
function copyCodeToClipboard(text, element) {
    if (!navigator.clipboard) {
        alert("⚠️ 이 브라우저는 클립보드 복사를 지원하지 않습니다.");
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        element.classList.add('copied');
        const originalText = element.innerHTML;
        element.innerHTML = '✅ 복사 완료!';
        setTimeout(() => {
            element.classList.remove('copied');
            element.innerHTML = originalText;
        }, 800);
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        alert('복사 실패! 콘솔을 확인해주세요.');
    });
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

// 툴팁 화면 표시 및 데이터 주입 로직 (명륜/은열쇠/비밀계약 완벽 호환 + 파밍처 추가) ㅁㄴㅇ
function showTooltip(item, e, mainStats = []) {
    const ttTitle = document.getElementById('tt-title');
    const ttDesc = document.getElementById('tt-desc');
    const ttTags = document.getElementById('tt-tags');

    ttTitle.textContent = item.korean_name;
    let contentHtml = '';

    // 명륜 전용 주옵션
    if (item.main_stat) {
        contentHtml += `<div class="tooltip-main-stat">주옵션: ${item.main_stat}</div>`;
    }
    // 공통 설명 (은열쇠 등)
    if (item.description) {
        contentHtml += `<div class="tooltip-effect-desc">${item.description}</div>`;
    }

    // 비밀계약 전용 세트 효과
    if (item.set_effect_3) {
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-heading">[3세트 효과]</div>`;
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-body">${item.set_effect_3}</div>`;
    }
    if (item.set_effect_6) {
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-heading">[6세트 효과]</div>`;
        contentHtml += `<div class="tooltip-effect-desc tooltip-effect-body">${item.set_effect_6}</div>`;
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

    ttDesc.innerHTML = contentHtml;
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

function hideTooltip() {
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
        el.onmouseenter = e => showTooltip(item, e, mainStats);
        el.onmousemove = moveTooltip;
        el.onmouseleave = hideTooltip;
        el.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            showTooltip(item, e, mainStats);
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

document.addEventListener('click', hideTooltip);

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

    const controls = {
        search: panel.querySelector('#dictionary-search'),
        reset: panel.querySelector('#dictionary-filter-reset'),
        summary: panel.querySelector('#dictionary-filter-summary')
    };

    const applyFilters = () => {
        const query = controls.search.value.trim().toLowerCase();
        const grades = getCheckedFilterValues(panel, 'dictionary-grade-filter');
        const mainStats = getCheckedFilterValues(panel, 'dictionary-main-filter');
        const effects = getCheckedFilterValues(panel, 'dictionary-effect-filter');
        const filtered = data.filter(item => {
            const meta = metaByItem.get(item);
            if (query && !meta.text.includes(query)) return false;
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
        card.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add('active');
            showTooltip(item, e);
        };

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

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    const charId = urlParams.get('id');
    const titleEl = document.getElementById('page-title');
    const listEl = document.getElementById('links-list');
    const tabsContainer = document.querySelector('.chrome-tabs-container');
    const linkContainer = document.querySelector('.link-container');
    const partySlot = document.getElementById('party-link-slot');

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
        const [manifest, linksDB, wheelList, covList, settingsDB, keyList, characterEffectsDB, tooltipDB] = await Promise.all([
            fetch(`data/character_manifest.json?t=${ts}`).then(res => res.json()),
            fetch(`data/resource_links.json?t=${ts}`).then(res => res.json()),
            fetch(`data/wheel_list.json?t=${ts}`).then(res => res.json()),
            fetch(`data/covenant_list.json?t=${ts}`).then(res => res.json()),
            fetch(`data/character_settings.json?t=${ts}`).then(res => res.json()),
            fetch(`data/silverkey_list.json?t=${ts}`).then(res => res.json()).catch(() => []),
            fetch(`data/character_effects.json?t=${ts}`).then(res => res.json()).catch(() => ({})),
            fetch(`data/db_tooltips.json?t=${ts}`).then(res => res.json()).catch(() => ({}))
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
        window.currentSettings = settingsDB;

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
                        const ssrWheelId = setInfo.myeongryun_ssr.main_id;
                        const srWheelId = setInfo.myeongryun_sr.main_id;
                        const ssrWheel = getWheel(ssrWheelId);
                        const srWheel = getWheel(srWheelId);
                        const mainCov = getCov(setInfo.covenant.main_id);
                        const mainCovStats = encodeTooltipMainStats(setInfo.covenant.main_stats);
                        const renderSubLink = (type, list, charId, idx) => {
                            const label = type === 'covenant' ? '대체 비밀계약' : '대체 명륜';
                            if (list && list.length > 0) return `<div class="sub-link" data-sub-modal-type="${type}" data-character-id="${charId}" data-setting-index="${idx}">${label}</div>`;
                            return `<div class="sub-link disabled">대체 정보 없음</div>`;
                        };
                        gridContainer.innerHTML += `
                            <div class="recommend-box">
                                <div class="recommend-left">
                                    <img src="${charData.image_thumb}" class="recommend-thumb" onerror="this.src='images/smile_Ramona.webp';">
                                    <div class="recommend-role">${setInfo.settingName} 세팅</div>
                                    <div class="recommend-step">${setInfo.recommendStep} 추천</div>
                                </div>
                                <div class="recommend-right">
                                    <div class="equip-slot">
                                        <div class="equip-label">추천 SSR 명륜</div>
                                        <img src="${ssrWheel.image_path}" class="equip-img-myeongryun" data-tooltip-kind="wheel" data-tooltip-id="${ssrWheelId}" onerror="this.src='images/placeholder.png';">
                                        <div class="equip-name-label">${ssrWheel.korean_name}</div>
                                        ${renderSubLink('ssr', setInfo.myeongryun_ssr.substitutes, charId, idx)}
                                    </div>
                                    <div class="equip-slot">
                                        <div class="equip-label">추천 SR 명륜</div>
                                        <img src="${srWheel.image_path}" class="equip-img-myeongryun" data-tooltip-kind="wheel" data-tooltip-id="${srWheelId}" onerror="this.src='images/placeholder.png';">
                                        <div class="equip-name-label">${srWheel.korean_name}</div>
                                        ${renderSubLink('sr', setInfo.myeongryun_sr.substitutes, charId, idx)}
                                    </div>
                                    <div class="equip-slot">
                                        <div class="equip-label">추천 비밀계약</div>
                                        <img src="${mainCov.image_path}" class="equip-img-covenant" data-tooltip-kind="covenant" data-tooltip-id="${setInfo.covenant.main_id}" data-tooltip-main-stats="${mainCovStats}" onerror="this.src='images/placeholder.png';">
                                        <div class="equip-name-label">${mainCov.korean_name}</div>
                                        ${renderSubLink('covenant', setInfo.covenant.substitutes, charId, idx)}
                                    </div>
                                </div>
                            </div>`;
                    });
                    bindDynamicTooltips(gridContainer);
                } else {
                    gridContainer.innerHTML = `<div class="no-setting-notice"><div class="no-setting-icon">📝</div><div>아직 추천 세팅 정보가 등록되지 않았습니다.</div></div>`;
                }
            }
            switchTab('dictionary');
        }

        // 2. 도감 페이지 (명륜/비밀계약/은열쇠)
        else if (isDictionaryPage) {
            if (category && linksDB.categories[category]) {
                titleEl.textContent = linksDB.categories[category].title;
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
                const codes = linksDB.categories[category].links || [];
                renderCodeLinks(codes, listEl); // 전용 렌더러 호출
                switchTab('links');
                return; // 공통 렌더링 로직을 타지 않도록 종료
            }
        }

        // 4. 일반 페이지 (기타 카테고리)
        else if (category && linksDB.categories[category]) {
            titleEl.textContent = linksDB.categories[category].title;
            targetItems = linksDB.categories[category].links || [];
            switchTab('links');
        }

        // 공통: 리스트 카드 출력 (교환 코드가 아닌 일반 링크용)
        listEl.innerHTML = '';
        if (targetItems.length === 0) {
            listEl.innerHTML = `<div class="no-data"><p>📭</p><p>아직 등록된 정보가 없습니다.</p></div>`;
        } else {
            targetItems.forEach(item => {
                if (typeof item === 'string') createLinkCardFromAPI(item, listEl);
                else createLinkCardInstant(item, listEl);
            });
        }

    } catch (error) {
        console.error("데이터 로드 오류:", error);
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

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-copy-code]');
        if (!trigger) return;
        copyCodeToClipboard(trigger.dataset.copyCode, trigger);
    });
});

function openDynamicSubModal(type, charId, idx = 0) {
    if (!window.currentSettings || !window.currentSettings[charId]) return;

    const settings = window.currentSettings[charId];
    // 배열 여부 확인 후 해당 인덱스의 세팅 추출
    const setInfo = Array.isArray(settings) ? settings[idx] : settings;

    const modal = document.getElementById('substitute-modal');
    const title = document.getElementById('sub-modal-title');
    const body = document.getElementById('sub-modal-body');

    let ids = [];
    let isWheel = true;

    if (type === 'ssr') {
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

    if (itemCount === 0) {
        html = '<div class="sub-modal-empty">등록된 대체 정보가 없습니다.</div>';
    } else {
        ids.forEach(id => {
            const data = isWheel ? window.wheelMap[id] : window.covMap[id];
            if (data) {
                const mainStats = !isWheel ? encodeTooltipMainStats(setInfo.covenant.substitute_main_stats?.[id]) : '';
                html += `
                <div class="sub-item-vertical">
                    <img src="${data.image_path || data.image_thumb || 'images/placeholder.png'}"
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
    }

    body.innerHTML = html;
    bindDynamicTooltips(body);
    modal.classList.add('show');
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

    // 카드 생성 도우미
    const createCard = (item, isTemp) => `
    <div class="code-card">
        <div class="code-details">
            <span class="code-title">${item.title}</span>
            <span class="code-reward">${item.desc || '보상 정보 없음'}</span>
            ${isTemp ? `<div class="code-timer">⏳ ${getDDay(item.expiry)}</div>` : ''}
        </div>
        <button class="code-copy-btn" data-copy-code="${escapeHtml(item.title)}">복사</button>
    </div>
`;

    // 2. 기간 한정 코드 렌더링
    if (temporary.length > 0) {
        container.insertAdjacentHTML('beforeend', '<div class="section-label">📅 기간 한정 코드</div>');
        const tempGroup = document.createElement('div');
        tempGroup.className = 'code-card-container';
        temporary.forEach(item => tempGroup.insertAdjacentHTML('beforeend', createCard(item, true)));
        container.appendChild(tempGroup);
    }

    // 3. 상시 코드 렌더링
    if (permanent.length > 0) {
        container.insertAdjacentHTML('beforeend', '<div class="section-label">♾️ 상시 코드</div>');
        const permGroup = document.createElement('div');
        permGroup.className = 'code-card-container';
        permanent.forEach(item => permGroup.insertAdjacentHTML('beforeend', createCard(item, false)));
        container.appendChild(permGroup);
    }
}

function createLinkCardInstant(data, container) {
    try {
        let domain = 'link';
        try { if(data.url) domain = new URL(data.url).hostname; } catch(e) {}
        const safeImage = getProxyImage(data.image);

        const html = `
            <a href="${data.url}" target="_blank" class="notion-bookmark">
                <div class="bookmark-content">
                    <div>
                        <div class="bookmark-title">${data.title || '제목 없음'}</div>
                        <div class="bookmark-desc">${data.desc || ''}</div>
                    </div>
                    <div class="bookmark-url">
                        <img src="https://www.google.com/s2/favicons?domain=${domain}" width="14" height="14" class="bookmark-favicon">
                        ${domain}
                    </div>
                </div>
                <div class="bookmark-image">
                    <img src="${safeImage}" alt="썸네일" loading="lazy" 
                         onerror="this.onerror=null; this.src='images/smile_Ramona.webp';">
                </div>
            </a>`;
        container.insertAdjacentHTML('beforeend', html);
    } catch (e) { console.error("카드 생성 에러:", e); }
}

async function createLinkCardFromAPI(url, container) {
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
                    <img src="${safeImage}" alt="썸네일" loading="lazy" onerror="this.onerror=null; this.src='images/smile_Ramona.webp';">
                </div>`;

            container.replaceChild(linkEl, cardWrap);
        } else { throw new Error("API Fail"); }
    } catch (e) {
        cardWrap.className = 'notion-bookmark';
        cardWrap.innerHTML = `<a href="${url}" target="_blank" class="notion-bookmark-fallback"><div class="notion-bookmark-fallback-title">${url}</div><div class="notion-bookmark-fallback-desc">(미리보기 로드 실패)</div></a>`;
    }
}
