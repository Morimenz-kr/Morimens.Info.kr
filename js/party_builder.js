/* js/party_builder.js - Full Version (Multi-Page Integrated) */

// [1] 상수 및 설정 데이터
const MAX_TEAMS = 10;
const MAX_PAGES = 5;
const ROMAN_NUMS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const DEFAULT_PARTY_BUILDER_RULES = {
    exclusive_groups: [["ramona", "ramona_timeworn"]],
    character_tags: {},
    tag_aliases: {}
};
let draggedIdx = -1;
let lastHoverIdx = -1;

// 최근 사용한 은열쇠 식별자 저장소 (로컬 스토리지 연동)
let recentKeys = JSON.parse(localStorage.getItem('morimens_recent_keys')) || [];

// [2] 데이터 생성 팩토리 함수
function createEmptyTeam(index) {
    return {
        name: `TEAM ${ROMAN_NUMS[index]}`,
        chars: [null, null, null, null],
        wheels: [ [null, null], [null, null], [null, null], [null, null] ],
        key: null,
        supportIdx: -1
    };
}

function createEmptyPage(name) {
    return {
        pageName: name,
        teams: Array.from({ length: MAX_TEAMS }, (_, i) => createEmptyTeam(i))
    };
}

// [3] 전역 상태 관리
let allPages = [createEmptyPage("PAGE 1")];
let currentPageIdx = 0;
let currentTeamIdx = 0;

let DB = { chars: [], wheels: [], keys: [] };
let PARTY_BUILDER_RULES = { ...DEFAULT_PARTY_BUILDER_RULES };

// 필터 및 검색 관련 변수
let activeCharFilters = { domain: new Set(), class: new Set() };
let activeCharSearchTags = new Set();
let activeWheelTags = new Set();
let activeKeyTags = new Set();
let tempChars = [];
let isSupportSelectionMode = false;
let editingCharIdx = -1;
let selectedWheelSlotIdx = 0;

// [4] 태그 및 메타데이터 정의
const ALL_KEY_TAGS = [ "산출력", "산출력 획득", "은열쇠 에너지", "은열쇠 게이지", "방어막 획득", "체력 회복", "힘", "힘 증가", "피해 증폭", "치명타 확률", "치명타 확률 증가", "치명타 피해", "치명타 피해 증가", "영역 숙련", "카드 추가", "드로우", "카드 뽑기", "코스트 감소", "계산 비용", "복사본", "영감", "광기", "광기 부여", "약화", "취약", "중독", "중독 부여", "힘 훔침", "힘 감소", "반격", "소멸", "경계", "희생", "터치월", "터치 손상", "출생 의식", "스칼렛 용광로", "초월 턴", "시편", "주사위" ];
const ALL_SEARCH_TAGS = [ "은열쇠 충전", "피해 증폭", "영역 숙련", "죽음 저항", "광기 회복", "검은 인장 드롭율", "크리티컬 확률", "크리티컬 피해", "기본 피해 증가", "최종 피해 증가", "능동 피해 증가", "힘", "임시 힘", "반격", "방어막", "HP 회복", "광기 획득", "은열쇠 에너지", "산출력", "손패 상한", "카드 뽑기", "중독", "취약", "허약", "전투 시작 시", "턴 시작 시", "광기 폭발", "은열쇠 발동", "명령 카드", "타격", "방어", "적 처치", "피격", "혈육", "심해", "초차원", "배아", "촉수", "핏빛 용광로", "심장의 불", "빙설", "학자 인격", "광대 인격", "고요한 바다", "몰아치는 파도", "저주받은 유물", "증상 카드" ];

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

    wrapper.style.display = 'block';
    input.maxLength = 15;

    // 초기값 세팅: 수정 모드일 경우 타겟 인덱스 또는 현재 인덱스 사용
    if (mode === 'new') {
        input.value = `PAGE ${allPages.length + 1}`;
    } else if (mode === 'team') {
        input.value = allPages[currentPageIdx].teams[currentTeamIdx].name;
    } else {
        const idx = (targetRenameIndex !== -1) ? targetRenameIndex : currentPageIdx;
        input.value = allPages[idx].pageName;
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
            // 타겟 인덱스를 우선하여 이름 변경
            const idx = (targetRenameIndex !== -1) ? targetRenameIndex : currentPageIdx;
            allPages[idx].pageName = val;
        }

        targetRenameIndex = -1; // 인덱스 초기화
        wrapper.style.display = 'none';
        renderAll();
        saveAllData(true);
    });

    document.getElementById('sys-btn-no').onclick = () => {
        targetRenameIndex = -1; // 인덱스 초기화
        wrapper.style.display = 'none';
        closeModal('modal-system');
    };
}

// [6] 초기화 및 데이터 로드 로직
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Party Builder JS (Full Version) Loaded!");
    updateBackButtonLabel();
    await loadExternalData();
    assignTagsToWheels();
    assignTagsToKeys();
    loadFromLocalStorage();
    renderAll();

    const reportModal = document.getElementById('report-modal');
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) reportModal.classList.remove('show');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const open = document.querySelector('.modal-overlay.show, .modal-overlay[style*="flex"]');
        if (open) closeModal(open.id);
    });

    ['modal-char', 'modal-wheel', 'modal-key'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { if (e.target === el) closeModal(id); });
    });

    document.addEventListener('touchstart', hideTooltip, { passive: true });
});

async function loadExternalData() {
    try {
        const ts = new Date().getTime();
        const [resChars, resWheels, resKeys, resRules] = await Promise.all([
            fetch(`data/character_manifest.json?t=${ts}`),
            fetch(`data/wheel_list.json?t=${ts}`),
            fetch(`data/silverkey_list.json?t=${ts}`),
            fetch(`data/party_builder_rules.json?t=${ts}`).catch(() => null)
        ]);
        if (!resChars.ok || !resWheels.ok || !resKeys.ok) throw new Error("파일 로드 실패");
        DB.chars = await resChars.json();
        DB.wheels = await resWheels.json();
        DB.keys = await resKeys.json();
        PARTY_BUILDER_RULES = await loadPartyBuilderRules(resRules);
        DB.chars.forEach(c => c.id = String(c.id));
    } catch (error) {
        console.error(error);
        openSystemAlert("오류", "데이터 로드 실패");
    }
}

// 사전 계산된 정규화 키워드 캐시
async function loadPartyBuilderRules(response) {
    if (!response || !response.ok) return { ...DEFAULT_PARTY_BUILDER_RULES };

    try {
        const rules = await response.json();
        return {
            exclusive_groups: Array.isArray(rules.exclusive_groups)
                ? rules.exclusive_groups
                : DEFAULT_PARTY_BUILDER_RULES.exclusive_groups,
            character_tags: rules.character_tags && typeof rules.character_tags === 'object'
                ? rules.character_tags
                : DEFAULT_PARTY_BUILDER_RULES.character_tags,
            tag_aliases: rules.tag_aliases && typeof rules.tag_aliases === 'object'
                ? rules.tag_aliases
                : DEFAULT_PARTY_BUILDER_RULES.tag_aliases
        };
    } catch (error) {
        console.warn("Party builder rules load failed:", error);
        return { ...DEFAULT_PARTY_BUILDER_RULES };
    }
}

const _cleanSearchTags = {};
const _cleanKeyTags = {};

function assignTagsToWheels() {
    // 키워드 정규화 캐시 (한 번만 계산)
    if (Object.keys(_cleanSearchTags).length === 0) {
        ALL_SEARCH_TAGS.forEach(keyword => {
            _cleanSearchTags[keyword] = keyword.replace(/\s+/g, '');
        });
    }
    DB.wheels.forEach(wheel => {
        wheel.tags = [];
        const text = (wheel.description + " " + wheel.main_stat).replace(/\s+/g, '');
        ALL_SEARCH_TAGS.forEach(keyword => {
            if (text.includes(_cleanSearchTags[keyword])) wheel.tags.push(keyword);
        });
    });
}

function assignTagsToKeys() {
    if(!DB.keys) return;
    // 키워드 정규화 캐시 (한 번만 계산)
    if (Object.keys(_cleanKeyTags).length === 0) {
        ALL_KEY_TAGS.forEach(keyword => {
            _cleanKeyTags[keyword] = keyword.replace(/\s+/g, '');
        });
    }
    DB.keys.forEach(key => {
        const combinedTags = new Set(key.tags || []);
        const text = (key.description + " " + key.korean_name).replace(/\s+/g, '');
        ALL_KEY_TAGS.forEach(keyword => {
            if (text.includes(_cleanKeyTags[keyword])) combinedTags.add(keyword);
        });
        key.tags = Array.from(combinedTags);
    });
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('morimens_v2_pages');
    if (saved) {
        try {
            allPages = JSON.parse(saved);
            allPages.forEach(p => p.teams.forEach(t => { if (t.supportIdx === undefined) t.supportIdx = -1; }));
        } catch (e) { console.error("Load Error", e); }
    } else {
        const legacy = localStorage.getItem('morimens_v2');
        if (legacy) {
            try {
                const legacyTeams = JSON.parse(legacy);
                allPages[0].teams = legacyTeams.map((t, i) => ({ ...createEmptyTeam(i), ...t }));
                saveAllData(true);
                localStorage.removeItem('morimens_v2');
            } catch (e) {}
        }
    }
}

function saveAllData(silent = false) {
    localStorage.setItem('morimens_v2_pages', JSON.stringify(allPages));
    if (!silent) showToast('저장됨 ✓');
}

function showToast(msg) {
    const existing = document.querySelector('.save-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'save-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 2000);
}

// [7] 페이지 및 팀 관리 기능
function addNewPage() { openPageInputModal('new'); }
function renameCurrentPage() { openPageInputModal('rename'); }
function editTeamName() { openPageInputModal('team'); }

function deleteCurrentPage() {
    if (allPages.length <= 1) {
        openSystemAlert("경고", "최소 하나 이상의 페이지는 유지되어야 합니다.");
        return;
    }
    openSystemConfirm("페이지 삭제", `[${allPages[currentPageIdx].pageName}] 페이지 전체를 삭제하시겠습니까?`, () => {
        allPages.splice(currentPageIdx, 1);
        currentPageIdx = 0;
        currentTeamIdx = 0;
        renderAll();
        saveAllData(true);
    });
}

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
        const tab = document.createElement('div');
        tab.className = `page-tab ${i === currentPageIdx ? 'active' : ''}`;

        // 이름 영역과 수정 아이콘, 삭제 아이콘 구성
        tab.innerHTML = `
            <span class="tab-name-text">${page.pageName}</span>
            <svg class="edit-icon-tab" title="이름 변경" onclick="event.stopPropagation(); renamePage(${i})" viewBox="0 0 24 24" fill="none">
                <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" fill="currentColor"/>
            </svg>
            <span class="btn-close-tab" title=페이지 삭제" onclick="event.stopPropagation(); deletePage(${i})">&times;</span>
        `;

        // 더블클릭 시에도 수정 모달 오픈
        tab.ondblclick = (e) => { e.stopPropagation(); renamePage(i); };

        tab.onclick = () => {
            currentPageIdx = i;
            currentTeamIdx = 0;
            renderAll();
        };
        container.appendChild(tab);
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
        // 삭제 후 현재 인덱스 조정
        if (currentPageIdx >= allPages.length) {
            currentPageIdx = allPages.length - 1;
        } else if (currentPageIdx === index && currentPageIdx > 0) {
            currentPageIdx--;
        }
        currentTeamIdx = 0;
        renderAll();
        saveAllData(true);
    });
}

function renderSidebar() {
    const container = document.getElementById('sidebar-tabs');
    if (!container) return;
    container.innerHTML = '';
    const currentTeams = allPages[currentPageIdx].teams;

    const isVertical = window.innerWidth > 768;
    // 간격 계산 (PC: 69px, 모바일: 가로 배치이므로 약 52px)
    const shiftDistance = isVertical ? 69 : 52;

    currentTeams.forEach((t, i) => {
        const tab = document.createElement('div');
        tab.className = `team-tab ${i === currentTeamIdx ? 'active' : ''} ${t.chars.some(x => x) ? 'filled' : ''}`;
        tab.textContent = ROMAN_NUMS[i];
        tab.dataset.index = i;
        tab.draggable = true;

        // 드래그 시작 공통 로직
        const handleStart = (idx) => {
            draggedIdx = idx;
            tab.classList.add('dragging');
        };

        // 주변 슬롯 밀어내기 (애니메이션 로직 동기화)
        const handleMove = (hoverIdx) => {
            if (draggedIdx === -1 || draggedIdx === hoverIdx) {
                document.querySelectorAll('.team-tab').forEach(el => el.style.transform = '');
                return;
            }

            lastHoverIdx = hoverIdx;
            const allTabs = document.querySelectorAll('.team-tab');

            allTabs.forEach((el, idx) => {
                if (idx === draggedIdx) return;
                const moveValue = isVertical ? `translateY` : `translateX`;

                if (draggedIdx < hoverIdx) {
                    if (idx > draggedIdx && idx <= hoverIdx) el.style.transform = `${moveValue}(-${shiftDistance}px)`;
                    else el.style.transform = '';
                } else {
                    if (idx < draggedIdx && idx >= hoverIdx) el.style.transform = `${moveValue}(${shiftDistance}px)`;
                    else el.style.transform = '';
                }
            });
        };

        // 드래그 종료 및 데이터 Swap 실행
        const handleEnd = () => {
            tab.classList.remove('dragging');
            document.querySelectorAll('.team-tab').forEach(el => {
                el.style.transform = '';
                el.style.pointerEvents = 'auto'; // 레이캐스트 복구
            });

            const from = draggedIdx;
            const to = lastHoverIdx;

            if (from !== -1 && to !== -1 && from !== to) {
                executeSwap(from, to);
            }

            draggedIdx = -1;
            lastHoverIdx = -1;
        };

        // --- PC: Drag and Drop API ---
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

        // --- 모바일: Touch API ---
        tab.ontouchstart = (e) => {
            // e.preventDefault(); // 클릭을 막을 수 있으므로 주의해서 사용
            handleStart(i);
        };

        tab.ontouchmove = (e) => {
            const touch = e.touches[0];

            // [중요] 내 엘리먼트가 elementFromPoint를 가리지 않도록 일시적으로 레이캐스트 제외
            tab.style.pointerEvents = 'none';
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            tab.style.pointerEvents = 'auto';

            if (target && target.classList.contains('team-tab')) {
                const hIdx = parseInt(target.dataset.index);
                handleMove(hIdx);
            }
        };

        tab.ontouchend = (e) => {
            handleEnd();
        };

        // 탭 클릭 기능
        tab.onclick = () => {
            currentTeamIdx = i;
            renderAll();
        };

        container.appendChild(tab);
    });
}

function executeSwap(fromIdx, toIdx) {
    // 인덱스 유효성 검사 보강
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx || isNaN(fromIdx)) return;

    const teams = allPages[currentPageIdx].teams;
    const [draggedItem] = teams.splice(fromIdx, 1);
    teams.splice(toIdx, 0, draggedItem);

    // 인덱스 트래킹
    if (currentTeamIdx === fromIdx) {
        currentTeamIdx = toIdx;
    } else if (fromIdx < currentTeamIdx && toIdx >= currentTeamIdx) {
        currentTeamIdx--;
    } else if (fromIdx > currentTeamIdx && toIdx <= currentTeamIdx) {
        currentTeamIdx++;
    }

    renderAll();
    saveAllData(true);
}

function renderMain() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    document.getElementById('team-title-text').textContent = team.name;
    renderTeamDomainImage(team);
    const sBox = document.getElementById('team-slots');
    sBox.innerHTML = '';

    const domSet = getActiveDomains(team);
    const isDomainConflict = (domSet.size > 2);

    const localUsedMap = new Set();
    allPages[currentPageIdx].teams.forEach((t, tIdx) => {
        if (tIdx === currentTeamIdx) return;
        t.chars.forEach((c, sIdx) => { if(c && t.supportIdx !== sIdx) localUsedMap.add(c); });
    });

    for(let i=0; i<4; i++) {
        const cid = team.chars[i];
        const isSupport = (team.supportIdx === i);
        let container = i === 3 ? document.createElement('div') : document.createDocumentFragment();
        if(i === 3) { container.className = 'slot-wrapper'; container.style.position = 'relative'; }

        const div = document.createElement('div');
        div.className = 'char-card';

        if(cid) {
            const info = DB.chars.find(x => String(x.id) === cid);
            const charGroup = PARTY_BUILDER_RULES.exclusive_groups.find(g => g.includes(String(cid)));
            const isAlterConflict = charGroup && team.chars.some((tid, idx) => i !== idx && tid && charGroup.includes(String(tid)));
            const isGlobalDuplicate = !isSupport && localUsedMap.has(cid);

            // [수정] 메인 화면 카드에서 "영역 충돌" 문구 표시 제거 (isDomainConflict 체크 제외)
            let conflictText = isAlterConflict ? "출전 불가" : (isGlobalDuplicate ? "사용중" : "");
            let conflictHTML = conflictText ? `<div class="card-conflict-overlay"><div class="conflict-bar">${conflictText}</div></div>` : '';
            let displayName = info ? info.name : '';
            if (isSupport) displayName += ' <span style="color:#3498db; font-size:0.8em; font-weight:bold;">(조력)</span>';

            const w1 = team.wheels[i][0]; const w2 = team.wheels[i][1];
            const w1Info = DB.wheels.find(x => x.english_name === w1);
            const w2Info = DB.wheels.find(x => x.english_name === w2);
            const charImg = info ? `images/${info.id}_tide.webp` : 'images/smile_Ramona.webp';
            let topInfoHTML = info ? `<div class="char-top-info"><img src="images/character_${info.relems}.png" class="char-top-icon"><span class="char-top-name">${displayName}</span></div>` : '';

            div.innerHTML = `<img src="${charImg}" class="char-tide-img" onerror="this.src='${info?.image_thumb}'">${conflictHTML}${topInfoHTML}<div class="card-bottom-overlay"><div class="wheels-wrapper"><div class="slot-wheel" onclick="openWheelModal(${i},0,event)">${w1Info ? `<img src="${w1Info.image_path}">` : '+'}</div><div class="slot-wheel" onclick="openWheelModal(${i},1,event)">${w2Info ? `<img src="${w2Info.image_path}">` : '+'}</div></div></div>`;
            [w1Info, w2Info].forEach((wheelInfo, slotIdx) => {
                if (!wheelInfo) return;
                const slotEl = div.querySelectorAll('.slot-wheel')[slotIdx];
                slotEl.onmouseenter = (e) => showTooltip(wheelInfo, e);
                slotEl.onmousemove = moveTooltip;
                slotEl.onmouseleave = hideTooltip;
            });
            div.onclick = (e) => { if(!e.target.closest('.slot-wheel')) openQuickSetup(); };
        } else {
            div.className += ' empty';
            div.innerHTML = `<div class="empty-cross"></div><div class="empty-text">탭하여 각성체 선택</div>`;
            div.onclick = () => openQuickSetup();
        }

        if (i === 3) {
            container.appendChild(div);
            const btn = document.createElement('div');
            btn.className = 'support-setup-btn'; btn.innerHTML = '조력 설정';
            btn.onclick = (e) => { e.stopPropagation(); openSupportSelector(e); };
            container.appendChild(btn);
            sBox.appendChild(container);
        } else { sBox.appendChild(div); }
    }

    const kInfo = DB.keys.find(x => x.english_name === team.key);
    document.getElementById('key-icon').innerHTML = kInfo ? `<img src="${kInfo.image_path}">` : '+';
    document.getElementById('key-name').textContent = kInfo ? kInfo.korean_name : '장착 안 함';
    document.getElementById('key-name').style.color = kInfo ? '#fff' : '#777';
}

function getActiveDomains(team) {
    const domSet = new Set();
    team.chars.forEach(cid => { if(cid) { const ch = DB.chars.find(x => String(x.id) === cid); if(ch) domSet.add(ch.relems); } });
    return domSet;
}

function renderTeamDomainImage(team) {
    const container = document.getElementById('team-domain-container');
    container.innerHTML = '';
    const domArr = Array.from(getActiveDomains(team));
    if (domArr.length === 0) return;

    // [수정] 헤더에서 "⚠영역충돌" 빨간 텍스트 표시 로직 삭제
    if (domArr.length > 2) return;

    const circleDiv = document.createElement('div');
    circleDiv.className = 'team-domain-circle';
    const sortOrder = ['chaos', 'aequor', 'caro', 'ultra'];
    domArr.sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));
    let fileName = domArr.length === 1 ? `pure_${domArr[0]}.png` : `${domArr[0]}_${domArr[1]}.png`;
    circleDiv.innerHTML = `<img src="images/${fileName}" class="team-domain-img" onerror="this.style.display='none'">`;
    container.appendChild(circleDiv);
}

function resetCurrentTeam() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    const charNames = team.chars
        .filter(id => id)
        .map(id => { const c = DB.chars.find(x => x.id === id); return c ? c.name : id; });
    const preview = charNames.length ? `\n현재 편성: ${charNames.join(', ')}` : '';
    openSystemConfirm("팀 초기화", `[${team.name}] 팀 설정을 초기화합니다.${preview}\n\n되돌릴 수 없습니다.`, () => {
        team.chars = [null, null, null, null];
        team.wheels = [[null,null],[null,null],[null,null],[null,null]];
        team.key = null; team.supportIdx = -1;
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
    if (removeBtn) removeBtn.style.display = 'inline-block';

    initCharModal();
}

function removeSupport() {
    const currentPage = allPages[currentPageIdx];
    const team = currentPage.teams[currentTeamIdx];

    // 현재 세트 내 모든 팀의 조력자 정보 초기화 (1세트 1조력자 규칙 준수)
    currentPage.teams.forEach(t => {
        t.supportIdx = -1;
    });

    team.chars[3] = null; // 4번 슬롯 비움
    team.wheels[3] = [null, null]; // 장비 비움

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
    setupCharSearchEvents();
    renderCharGrid();

    document.getElementById('modal-char').classList.add('show');

    const header = document.querySelector('#modal-char .modal-header h3');
    if (header) header.textContent = isSupportSelectionMode ? '조력자 선택 (1명)' : '배치할 각성체 선택 (최대 4명)';

    // [기존 오타 수정] 조력자 모드에서도 푸터가 보이도록 'block'으로 고정
    document.querySelector('#modal-char .modal-footer').style.display = 'block';
}

function toggleCharFilter(type, value) {
    if (activeCharFilters[type].has(value)) activeCharFilters[type].delete(value);
    else activeCharFilters[type].add(value);
    renderCharGrid();
}

function renderCharGrid() {
    const box = document.getElementById('grid-char');
    if (!box) return;
    box.innerHTML = '';

    const currentPage = allPages[currentPageIdx];
    const team = currentPage.teams[currentTeamIdx];
    const searchText = document.getElementById('char-search-input').value.trim().toLowerCase();

    // 1. 현재 세트 전체에서 조력자 정보 추출 (세트 내 1인 조력자 규칙 유지용)
    let supportInPage = null;
    currentPage.teams.forEach((t, idx) => {
        if (t.supportIdx !== -1 && t.chars[t.supportIdx]) {
            supportInPage = { teamIdx: idx, charId: t.chars[t.supportIdx] };
        }
    });

    // 2. 영역 충돌 계산 (현재 팀 기반)
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
        const dPass = !activeCharFilters.domain.size || activeCharFilters.domain.has(c.relems);
        const cPass = !activeCharFilters.class.size || activeCharFilters.class.has(c.class);
        if(!dPass || !cPass) return false;
        if(searchText && !c.name.toLowerCase().includes(searchText)) return false;
        return true;
    }).forEach(c => {
        const id = c.id;
        let conflictReason = "";

        if (isSupportSelectionMode) {
            // [조력자 선택 모드]
            if (tempChars.includes(id)) conflictReason = "파티 내 중복";
            else if (usedInOtherTeamsNormal.has(id)) conflictReason = "사용중";
            else if (activeDomains.size >= 2 && !activeDomains.has(c.relems)) conflictReason = "영역 충돌";
        } else {
            // [일반 대원 편성 모드]
            if (usedInOtherTeamsNormal.has(id)) {
                conflictReason = "사용중";
            } else if (team.supportIdx !== -1 && team.chars[team.supportIdx] === id) {
                conflictReason = "조력자로 사용 중";
            } else if (!tempChars.includes(id) && activeDomains.size >= 2 && !activeDomains.has(c.relems)) {
                conflictReason = "영역 충돌";
            }
        }

        const isSelected = tempChars.includes(id) || (isSupportSelectionMode && team.supportIdx !== -1 && team.chars[team.supportIdx] === id);

        const el = document.createElement('div');
        el.className = `grid-item ${isSelected ? 'selected' : ''} ${conflictReason ? 'conflict' : ''}`;
        el.innerHTML = `<img src="${c.image_thumb}">`;

        if (conflictReason) {
            const overlay = document.createElement('div');
            overlay.className = 'conflict-tag' + (conflictReason === "영역 충돌" ? " domain-conflict-label" : "");
            overlay.innerText = conflictReason;
            el.appendChild(overlay);
        }

        el.onclick = () => {
            // [버그 수정] 이미 선택된 캐릭터(isSelected)라면 충돌 경고를 띄우지 않고 해제 로직으로 진행함
            if (conflictReason && !isSelected) {
                openSystemAlert("편성 불가", `[${c.name}] 각성체는 ${conflictReason} 상태입니다.`);
                return;
            }

            if (isSupportSelectionMode) {
                const applySupport = () => {
                    currentPage.teams.forEach(t => { t.supportIdx = -1; });
                    team.chars[3] = id;
                    team.supportIdx = 3;
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
                }
                renderCharGrid();
            }
        };
        box.appendChild(el);
    });

    document.getElementById('char-count').textContent = isSupportSelectionMode ? `조력자 선택` : `${tempChars.length} / 4 선택됨`;
}

function setupCharSearchEvents() {
    const input = document.getElementById('char-search-input');
    const suggest = document.getElementById('char-search-suggestions');
    if(!input) return;
    input.oninput = (e) => {
        const val = e.target.value.trim().toLowerCase();
        if(!val) { suggest.style.display = 'none'; renderCharGrid(); return; }
        const tagAliases = getTagAliases();
        const matches = getAllCharTagNames().filter(t => (t.includes(val) || (tagAliases[t]||[]).some(a=>a.includes(val))) && !activeCharSearchTags.has(t));
        suggest.innerHTML = matches.map(m => `<div class="suggestion-item" onclick="addCharTag('${m}')">${m}</div>`).join('');
        suggest.style.display = matches.length ? 'block' : 'none';
        renderCharGrid();
    };
}
function addCharTag(tag) { activeCharSearchTags.add(tag); renderActiveCharTags(); document.getElementById('char-search-input').value = ''; document.getElementById('char-search-suggestions').style.display='none'; renderCharGrid(); }
function renderActiveCharTags() {
    const cont = document.getElementById('active-char-search-tags');
    if(!cont) return;
    cont.innerHTML = Array.from(activeCharSearchTags).map(t => `<div class="active-tag-chip" onclick="removeCharTag('${t}')">${t}</div>`).join('');
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

    // --- [수정 시작]: 장비(명륜) 데이터 보존 로직 ---

    // 1. 현재 파티에 장착된 명륜 데이터를 캐릭터 ID 기준으로 맵핑(캐싱)
    // 식별자 기반으로 데이터를 임시 저장하여 순서 변경 시에도 대응할 수 있게 함
    const wheelCache = {};
    for (let i = 0; i < 4; i++) {
        const charId = team.chars[i];
        if (charId) {
            // 해당 캐릭터가 끼고 있던 명륜 배열([null, null] 포함)을 저장
            wheelCache[charId] = [...team.wheels[i]];
        }
    }

    // 2. 새로운 파티 배열 생성
    const newArr = [null, null, null, null];
    const limit = team.supportIdx === 3 ? 3 : 4;
    tempChars.forEach((id, i) => {
        if (i < limit) newArr[i] = id;
    });

    // 조력자 위치 유지 (3번 슬롯이 조력자인 경우)
    if (team.supportIdx === 3) {
        newArr[3] = team.chars[3];
    }

    // 3. 캐릭터 ID를 기준으로 명륜 재배치
    const newWheels = [
        [null, null], [null, null], [null, null], [null, null]
    ];

    for (let i = 0; i < 4; i++) {
        const newCharId = newArr[i];
        if (newCharId) {
            if (wheelCache[newCharId]) {
                // 이전에 파티에 있던 캐릭터라면 캐시된 장비를 그대로 가져옴
                newWheels[i] = wheelCache[newCharId];
            } else {
                // 아예 새로 들어온 캐릭터라면 빈 슬롯으로 유지
                newWheels[i] = [null, null];
            }
        }
    }

    // 4. 팀 데이터 최종 업데이트
    team.chars = newArr;
    team.wheels = newWheels;

    // --- [수정 완료] ---

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

    const input = document.getElementById('wheel-search-input');
    if (input) {
        input.value = '';
        setupWheelSearchEvents(); // 검색 이벤트 바인딩 호출 추가
    }

    // 명륜 모달을 열 때 전용 장착 버튼을 보이게 처리 및 클릭 이벤트 바인딩
    const btnSsr = document.getElementById('btn-equip-ssr');
    const btnSr = document.getElementById('btn-equip-sr');
    if (btnSsr) {
        btnSsr.style.display = 'block';
        btnSsr.onclick = () => equipDedicatedWheel('SSR');
    }
    if (btnSr) {
        btnSr.style.display = 'block';
        btnSr.onclick = () => equipDedicatedWheel('SR');
    }

    renderWheelModalUI();
    document.getElementById('modal-wheel').classList.add('show');
}

function setupWheelSearchEvents() {
    const input = document.getElementById('wheel-search-input');
    if (!input) return;

    input.oninput = () => {
        renderWheelList(); // 입력 시마다 리스트를 다시 필터링하여 렌더링
    };
}
function selectWheelSlot(idx) { selectedWheelSlotIdx = idx; renderWheelModalUI(); }
function renderWheelModalUI() {
    const wheels = allPages[currentPageIdx].teams[currentTeamIdx].wheels[editingCharIdx];
    for(let i=0; i<2; i++) {
        const el = document.getElementById(`equip-slot-${i}`);
        el.classList.toggle('active', i === selectedWheelSlotIdx);
        const wInfo = DB.wheels.find(w => w.english_name === wheels[i]);
        el.innerHTML = wInfo ? `<img src="${wInfo.image_path}">` : `<div class="slot-placeholder">+</div>`;
        if(i === selectedWheelSlotIdx) document.getElementById('equip-slot-desc').textContent = wInfo ? wInfo.korean_name : "명륜을 선택하세요";
    }
    renderWheelList();
}
function renderWheelList() {
    hideTooltip();
    const box = document.getElementById('grid-wheel');
    if (!box) return;
    box.innerHTML = '';

    // 1. 중복 장착 확인을 위한 Set 생성 (기존 로직 유지)
    const used = new Set();
    allPages[currentPageIdx].teams.forEach(t =>
        t.wheels.forEach(row =>
            row.forEach(w => { if(w) used.add(w); })
        )
    );

    const currentW = allPages[currentPageIdx].teams[currentTeamIdx].wheels[editingCharIdx][selectedWheelSlotIdx];
    const searchInput = document.getElementById('wheel-search-input');
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const searchClean = search.replace(/\s+/g, ''); // 공백 제거 검색어

    // 2. 필터링 로직 확장 (이름 + 설명 + 주옵션)
    DB.wheels.filter(w => {
        // 태그 필터
        if(activeWheelTags.size && !Array.from(activeWheelTags).every(t => (w.tags || []).includes(t))) return false;

        // 검색어 필터 (주옵션인 main_stat 추가)
        if(search) {
            const name = (w.korean_name || "").toLowerCase();
            const desc = (w.description || "").toLowerCase();
            const mainStat = (w.main_stat || "").toLowerCase(); // 주옵션 필드

            const matches = name.includes(search) ||
                desc.includes(search) ||
                mainStat.includes(search) ||
                name.replace(/\s+/g, '').includes(searchClean) ||
                mainStat.replace(/\s+/g, '').includes(searchClean);

            if(!matches) return false;
        }
        return true;
    }).forEach(w => {
        // 3. 렌더링 로직 (기존 그리드 스타일 유지)
        const isSel = w.english_name === currentW;
        const isUsed = used.has(w.english_name) && !isSel;

        const el = document.createElement('div');
        el.className = `grid-item grid-item-wheel ${isSel ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`;

        // 원본과 동일하게 이미지 삽입
        el.innerHTML = `<img src="${w.image_path}">`;

        // 툴팁 이벤트
        el.onmouseenter = (e) => showTooltip(w, e);
        el.onmouseleave = hideTooltip;
        el.onmousemove = moveTooltip; // 툴팁 따라다니게 추가

        // 클릭 이벤트 (데이터 업데이트)
        el.onclick = () => {
            if(isUsed) return;
            allPages[currentPageIdx].teams[currentTeamIdx].wheels[editingCharIdx][selectedWheelSlotIdx] = w.english_name;
            renderWheelModalUI();
            renderAll();
            // 데이터 변경 후 저장 (필요 시)
            if (typeof saveAllData === 'function') saveAllData(true);
        };

        box.appendChild(el);
    });
}
function unequipSelectedWheel() { allPages[currentPageIdx].teams[currentTeamIdx].wheels[editingCharIdx][selectedWheelSlotIdx] = null; renderWheelModalUI(); renderAll(); }

function openKeyModal(e) {
    // [수정] 은열쇠는 항상 1번 슬롯(리더) 캐릭터를 기준으로 처리하도록 강제 설정
    editingCharIdx = 0;

    const team = allPages[currentPageIdx].teams[currentTeamIdx];
    if(!team.chars[editingCharIdx]) {
        return openSystemAlert("알림", "1번 슬롯에 캐릭터를 먼저 배치하세요.");
    }

    if(e) e.stopPropagation();

    activeKeyTags.clear();
    const searchInput = document.getElementById('key-search-input');
    if (searchInput) {
        searchInput.value = '';
        setupKeySearchEvents();
    }

    // 전용 은열쇠 장착 버튼 노출 및 클릭 이벤트 연결
    const btnKey = document.getElementById('btn-equip-key');
    if (btnKey) {
        btnKey.style.display = 'block';
        btnKey.onclick = () => equipDedicatedKey();
    }

    renderKeyGrid();
    document.getElementById('modal-key').classList.add('show');
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
    const targetKey = DB.keys.find(function(key) {
        const tagArray = key.Tag || key.tags;
        return Array.isArray(tagArray) && tagArray[0] === charInfo.name;
    });

    if (!targetKey) {
        openSystemAlert("알림", charInfo.name + "의 전용 은열쇠를 찾을 수 없습니다.");
        return;
    }

    // [중요] 프로젝트 데이터 구조에 맞춰 파티의 은열쇠 슬롯에 저장
    // 만약 캐릭터별 배열 형태라면 team.keys[0]에 저장합니다.
    if (Array.isArray(team.keys)) {
        team.keys[0] = targetKey.english_name;
    } else {
        team.key = targetKey.english_name;
    }

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

    const used = new Set();
    allPages[currentPageIdx].teams.forEach((t, i) => {
        if (i !== currentTeamIdx && t.key) used.add(t.key);
    });

    const currentK = allPages[currentPageIdx].teams[currentTeamIdx].key;
    const searchInput = document.getElementById('key-search-input');
    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // 현재 선택된 정렬 기준 확인
    const sortSelect = document.getElementById('key-sort-select');
    const sortByRecent = sortSelect ? sortSelect.value === 'recent' : true;

    // 1단계: 검색어 필터링
    let filteredKeys = DB.keys.filter(k => {
        if (search && !k.korean_name.toLowerCase().includes(search) &&
            !(k.tags || []).some(t => t.toLowerCase().includes(search))) {
            return false;
        }
        return true;
    });

    // 2단계: 정렬 적용
    if (sortByRecent) { 
        filteredKeys.sort((a, b) => {
            let indexA = recentKeys.indexOf(a.english_name);
            let indexB = recentKeys.indexOf(b.english_name);

            // 최근 기록에 없으면 가중치를 999로 주어 최하단으로 밀어냄
            if (indexA === -1) indexA = 999;
            if (indexB === -1) indexB = 999;

            return indexA - indexB;
        });
    }

    // 3단계: 화면 렌더링
    filteredKeys.forEach(k => {
        const isSel = k.english_name === currentK;
        const isUsed = used.has(k.english_name);

        const el = document.createElement('div');
        el.className = `grid-item ${isSel ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`;
        el.style.borderRadius = "50%";
        el.innerHTML = `<img src="${k.image_path}" style="border-radius:50%;">`;

        el.onmouseenter = (e) => showTooltip(k, e);
        el.onmouseleave = hideTooltip;

        el.onclick = () => {
            if (isUsed) return;
            allPages[currentPageIdx].teams[currentTeamIdx].key = k.english_name;

            // --- [추가 로직] 장착 시 최근 사용 기록 업데이트 ---
            recentKeys = recentKeys.filter(name => name !== k.english_name); // 기존 중복 제거
            recentKeys.unshift(k.english_name); // 배열의 맨 앞에 삽입
            if (recentKeys.length > 20) recentKeys.pop(); // 최대 20개까지만 보관

            // 브라우저 캐시에 저장
            localStorage.setItem('morimens_recent_keys', JSON.stringify(recentKeys));
            // ------------------------------------------------

            closeModal('modal-key');
            renderAll();
        };
        box.appendChild(el);
    });
}
function unequipKey() { allPages[currentPageIdx].teams[currentTeamIdx].key = null; closeModal('modal-key'); renderAll(); }

// [11] 시스템 유틸리티 및 모달 기능
const tooltipEl = document.getElementById('global-tooltip');
function showTooltip(item, e) {
    document.getElementById('tt-title').textContent = item.korean_name;

    const descCont = document.getElementById('tt-desc');
    let contentHtml = '';

    if (item.main_stat) {
        contentHtml += `<div class="tooltip-main-stat">주옵션: ${item.main_stat}</div>`;
    }

    if (item.description) {
        contentHtml += `<div class="tooltip-effect-desc">${item.description}</div>`;
    }

    if (item.set_effect_3) {
        contentHtml += `<div class="tooltip-effect-desc" style="color: #d9d9d9; margin-top: 10px; font-weight: bold;">[3세트 효과]</div>`;
        contentHtml += `<div class="tooltip-effect-desc" style="margin-top: 2px;">${item.set_effect_3}</div>`;
    }
    if (item.set_effect_6) {
        contentHtml += `<div class="tooltip-effect-desc" style="color: #d9d9d9; margin-top: 10px; font-weight: bold;">[6세트 효과]</div>`;
        contentHtml += `<div class="tooltip-effect-desc" style="margin-top: 2px;">${item.set_effect_6}</div>`;
    }

    if (item.source) {
        contentHtml += `<div class="tooltip-effect-desc" style="color: #d9d9d9; margin-top: 15px; font-weight: bold;">[획득처]</div>`;
        contentHtml += `<div class="tooltip-effect-desc" style="margin-top: 2px; color: #d9d9d9;">${item.source}</div>`;
    }

    descCont.innerHTML = contentHtml;

    const tagsCont = document.getElementById('tt-tags');
    tagsCont.innerHTML = '';
    (item.tags || item.optimized_for || [])
        .map(t => String(t || '').trim())
        .filter(Boolean)
        .forEach(t => {
            const s = document.createElement('span');
            s.className = 'tooltip-tag';
            s.textContent = t;
            tagsCont.appendChild(s);
        });

    tooltipEl.style.display = 'block';
    moveTooltip(e);
}
function moveTooltip(e) {
    if (!tooltipEl || tooltipEl.style.display === 'none') return;

    const gap = 15;
    const margin = 10;
    const rect = tooltipEl.getBoundingClientRect();
    let x = e.clientX + gap;
    let y = e.clientY + gap;

    if (x + rect.width > window.innerWidth - margin) {
        x = e.clientX - rect.width - gap;
    }
    if (y + rect.height > window.innerHeight - margin) {
        y = e.clientY - rect.height - gap;
    }

    x = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin));
    y = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));

    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
}
function hideTooltip() { tooltipEl.style.display = 'none'; }

function openSystemAlert(t, m) {
    document.getElementById('sys-modal-title').innerText = t;
    document.getElementById('sys-modal-msg').innerText = m;
    document.getElementById('sys-btn-no').style.display = 'none';
    document.getElementById('sys-btn-yes').onclick = () => closeModal('modal-system');
    document.getElementById('modal-system').classList.add('show');
}
function openSystemConfirm(t, m, yes) {
    document.getElementById('sys-modal-title').innerText = t;
    document.getElementById('sys-modal-msg').innerText = m;
    document.getElementById('sys-btn-no').style.display = 'inline-block';

    // 확인 버튼 이벤트
    document.getElementById('sys-btn-yes').onclick = () => {
        yes();
        closeModal('modal-system');
    };

    // [버그 수정] 취소 버튼 누를 때 모달 닫기 기능 강제 부여
    document.getElementById('sys-btn-no').onclick = () => {
        closeModal('modal-system');
    };

    document.getElementById('modal-system').classList.add('show');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
    if (id === 'modal-char') {
        const removeBtn = document.getElementById('btn-remove-support');
        if (removeBtn) removeBtn.style.display = 'none';
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
    backButton.textContent = params.get('from') === 'weapon'
        ? '⬅ 융재 금구 메뉴로 돌아가기'
        : '⬅ 홈으로 돌아가기';
}

function copyTeamToClipboard() {
    const team = allPages[currentPageIdx].teams[currentTeamIdx];

    // 슬롯 번호와 이름은 제외하고 순수 데이터 구성만 복사
    const teamData = {
        chars: team.chars,
        wheels: team.wheels,
        key: team.key,
        supportIdx: team.supportIdx
    };

    navigator.clipboard.writeText(JSON.stringify(teamData)).then(() => {
        openSystemAlert("복사 완료", "현재 팀 구성 정보가 클립보드에 저장되었습니다.");
    });
}

async function pasteTeamFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);

        // 필수 데이터 필드 검증 (무결성 체크)
        if (!data.chars || !data.wheels || data.supportIdx === undefined) {
            throw new Error("Invalid team data");
        }

        openSystemConfirm("팀 붙여넣기", "현재 팀 정보를 클립보드 데이터로 덮어쓰시겠습니까?", () => {
            const team = allPages[currentPageIdx].teams[currentTeamIdx];

            // 데이터 할당 (깊은 복사 적용)
            team.chars = [...data.chars];
            team.wheels = JSON.parse(JSON.stringify(data.wheels));
            team.key = data.key;
            team.supportIdx = data.supportIdx;

            renderAll();
            saveAllData(true);
            openSystemAlert("완료", "팀 정보를 성공적으로 붙여넣었습니다.");
        });
    } catch (e) {
        openSystemAlert("오류", "클립보드에 유효한 팀 데이터가 없거나 형식이 잘못되었습니다.");
    }
}

// [12] 제보 시스템
/* js/party_builder.js - [12] 제보 시스템 수정본 */

async function sendToDiscord(event) {
    return sendFeedbackToWorker(event);
}
function openReportModal() {
    document.getElementById('report-source-url').value = window.location.href;
    document.getElementById('report-modal').classList.add('show');
}
// =========================================
// 전용 명륜 자동 장착 및 포커스 이동 로직
// =========================================

// 버튼 클릭 이벤트 리스너 (중복 방지를 위해 초기화 후 등록)
const btnSsr = document.getElementById('btn-equip-ssr');
const btnSr = document.getElementById('btn-equip-sr');

if (btnSsr) {
    btnSsr.onclick = () => equipDedicatedWheel('SSR');
}
if (btnSr) {
    btnSr.onclick = () => equipDedicatedWheel('SR');
}

function normalizeDedicatedTarget(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[「」｢｣]/g, '')
        .trim()
        .toLowerCase();
}

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
    const charTargets = new Set([
        normalizeDedicatedTarget(charId),
        normalizeDedicatedTarget(charInfo.id),
        normalizeDedicatedTarget(charInfo.name)
    ]);
    const targetWheel = DB.wheels.find(function(wheel) {
        const optFor = wheel.optimized_for;
        return wheel.grade === grade
            && Array.isArray(optFor)
            && optFor.some(target => charTargets.has(normalizeDedicatedTarget(target)));
    });

    if (!targetWheel) {
        openSystemAlert("알림", `${charInfo.name}의 전용 ${grade} 명륜을 찾을 수 없습니다.`);
        return;
    }

    // 4. 슬롯 인덱스 결정 (SSR=0, SR=1) 및 포커스 이동
    const slotIdx = (grade === 'SSR') ? 0 : 1;
    selectedWheelSlotIdx = slotIdx; // 장착하는 슬롯으로 즉시 포커스 이동

    // 5. 데이터 적용
    team.wheels[editingCharIdx][slotIdx] = targetWheel.english_name;

    // 6. UI 전체 및 모달 내부 갱신 (핵심: 어떤 등급이든 즉시 리렌더링)
    renderAll();
    renderWheelModalUI(); // 이 함수가 호출되어야 슬롯 이미지가 즉시 바뀝니다.
    saveAllData(true);

}
