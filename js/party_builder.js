/* js/party_builder.js 전체 코드 */

const MAX_TEAMS = 10;
const ROMAN_NUMS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const EXCLUSIVE_GROUPS = [["ramona", "ramona_timeworn"]];

// [필터 변수]
let activeCharFilters = {
    domain: new Set(),
    class: new Set()
};

const ALL_KEY_TAGS = [ "산출력", "산출력 획득", "은열쇠 에너지", "은열쇠 게이지", "방어막 획득", "체력 회복", "힘", "힘 증가", "피해 증폭", "치명타 확률", "치명타 확률 증가", "치명타 피해", "치명타 피해 증가", "영역 숙련", "카드 추가", "드로우", "카드 뽑기", "코스트 감소", "계산 비용", "복사본", "영감", "광기", "광기 부여", "약화", "취약", "중독", "중독 부여", "힘 훔침", "힘 감소", "반격", "소멸", "경계", "희생", "터치월", "터치 손상", "출생 의식", "스칼렛 용광로", "초월 턴", "시편", "주사위" ];
let activeKeyTags = new Set();

const ALL_SEARCH_TAGS = [ "은열쇠 충전", "피해 증폭", "영역 숙련", "죽음 저항", "광기 회복", "검은 인장 드롭율", "크리티컬 확률", "크리티컬 피해", "기본 피해 증가", "최종 피해 증가", "능동 피해 증가", "힘", "임시 힘", "반격", "방어막", "HP 회복", "광기 획득", "은열쇠 에너지", "산출력", "손패 상한", "카드 뽑기", "중독", "취약", "허약", "전투 시작 시", "턴 시작 시", "광기 폭발", "은열쇠 발동", "명령 카드", "타격", "방어", "적 처치", "피격", "혈육", "심해", "초차원", "배아", "촉수", "핏빛 용광로", "심장의 불", "빙설", "학자 인격", "광대 인격", "고요한 바다", "몰아치는 파도", "저주받은 유물", "증상 카드" ];
let activeWheelTags = new Set();

let teams = Array.from({ length: MAX_TEAMS }, (_, i) => ({
    name: `TEAM ${ROMAN_NUMS[i]}`,
    chars: [null, null, null, null],
    wheels: [ [null, null], [null, null], [null, null], [null, null] ],
    key: null
}));
let currentTeamIdx = 0;
let DB = { chars: [], wheels: [], keys: [] };
let tempChars = [];
let editingCharIdx = -1;
let selectedWheelSlotIdx = 0;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Party Builder JS Loaded!"); // [디버그] 파일 로드 확인용 로그
    await loadExternalData();
    assignTagsToWheels();
    assignTagsToKeys();
    loadFromLocalStorage();
    renderAll();

    // 버그 신고 모달 닫기 이벤트 연결
    const reportModal = document.getElementById('report-modal');
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) {
                reportModal.classList.remove('show');
            }
        });
    }
});

function goBackToMenu() {
    if (document.referrer && document.referrer.includes('links.html')) {
        history.back();
    } else {
        location.href = 'links.html?category=weapon';
    }
}

function resetCurrentTeam() {
    openSystemConfirm(
        "팀 초기화",
        `[${teams[currentTeamIdx].name}] 팀 설정을 정말 초기화하시겠습니까?`,
        () => {
            teams[currentTeamIdx].chars = [null, null, null, null];
            teams[currentTeamIdx].wheels = [ [null, null], [null, null], [null, null], [null, null] ];
            teams[currentTeamIdx].key = null;
            renderAll();
            saveAllData(true);
        }
    );
}

function assignTagsToKeys() {
    if(!DB.keys) return;
    DB.keys.forEach(key => {
        const jsonTags = key.tags || [];
        const combinedTags = new Set(jsonTags);
        const text = (key.description + " " + key.korean_name).replace(/\s+/g, '');
        ALL_KEY_TAGS.forEach(keyword => {
            const cleanKeyword = keyword.replace(/\s+/g, '');
            if (text.includes(cleanKeyword)) combinedTags.add(keyword);
        });
        if(key.korean_name === "쥐의 지혜") combinedTags.add("산출력");
        key.tags = Array.from(combinedTags);
    });
}

async function loadExternalData() {
    try {
        const ts = new Date().getTime();
        const [resChars, resWheels, resKeys] = await Promise.all([
            fetch(`data/character_manifest.json?t=${ts}`),
            fetch(`data/wheel_list.json?t=${ts}`),
            fetch(`data/silverkey_list.json?t=${ts}`)
        ]);
        if (!resChars.ok || !resWheels.ok || !resKeys.ok) throw new Error("파일 로드 실패");
        DB.chars = await resChars.json();
        DB.wheels = await resWheels.json();
        DB.keys = await resKeys.json();
        DB.chars.forEach(c => c.id = String(c.id));
    } catch (error) { console.error(error); alert("데이터 로드 실패"); }
}

function assignTagsToWheels() {
    DB.wheels.forEach(wheel => {
        wheel.tags = [];
        const text = (wheel.description + " " + wheel.main_stat).replace(/\s+/g, '');
        ALL_SEARCH_TAGS.forEach(keyword => {
            const cleanKeyword = keyword.replace(/\s+/g, '');
            if (text.includes(cleanKeyword)) wheel.tags.push(keyword);
        });
    });
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('morimens_v2');
    if(saved) {
        try {
            const loadedTeams = JSON.parse(saved);
            teams = loadedTeams.map((t, i) => ({ ...teams[i], ...t }));
        } catch(e) {}
    }
}

function saveAllData(silent = false) {
    localStorage.setItem('morimens_v2', JSON.stringify(teams));
    if (!silent) {
        openSystemAlert("저장 완료", "모든 팀 설정이 저장되었습니다.");
    }
}

function renderAll() { renderSidebar(); renderMain(); }

function renderSidebar() {
    const c = document.getElementById('sidebar-tabs'); c.innerHTML = '';
    teams.forEach((t, i) => {
        const d = document.createElement('div');
        d.className = `team-tab ${i === currentTeamIdx ? 'active' : ''} ${t.chars.some(x=>x)?'filled':''}`;
        d.textContent = ROMAN_NUMS[i];
        d.onclick = () => { currentTeamIdx = i; renderAll(); };
        c.appendChild(d);
    });
}

function renderMain() {
    const team = teams[currentTeamIdx];
    document.getElementById('team-title-text').textContent = team.name;
    renderTeamDomainImage(team);
    const sBox = document.getElementById('team-slots'); sBox.innerHTML = '';

    const domSet = getActiveDomains(team);
    const isDomainConflict = (domSet.size > 2);

    for(let i=0; i<4; i++) {
        const cid = team.chars[i];
        const div = document.createElement('div');
        div.className = 'char-card';

        if(cid) {
            const info = DB.chars.find(x => String(x.id) === cid);

            // 1. 현재 캐릭터의 그룹 찾기
            const charGroup = EXCLUSIVE_GROUPS.find(g => g.includes(String(cid)));
            // 2. 다른 슬롯에 같은 그룹의 캐릭터가 있는지 체크
            const isAlterConflict = charGroup && team.chars.some((otherId, otherIdx) =>
                i !== otherIdx && otherId && charGroup.includes(String(otherId))
            );

            // 3. 출력할 텍스트를 결정 (여기가 핵심입니다)
            let conflictText = "";
            if (isAlterConflict) {
                conflictText = "출전할 수 없음";
            } else if (isDomainConflict) {
                conflictText = "영역 충돌";
            }

            // 4. 결정된 텍스트로 오버레이 생성 (직접 "영역 충돌"을 쓰지 않습니다)
            let conflictHTML = conflictText
                ? `<div class="card-conflict-overlay"><div class="conflict-bar">${conflictText}</div></div>`
                : '';

            const w1 = team.wheels[i][0]; const w2 = team.wheels[i][1];
            const w1Info = DB.wheels.find(x => x.english_name === w1);
            const w2Info = DB.wheels.find(x => x.english_name === w2);
            const charImg = info ? `images/${info.id}_tide.webp` : 'images/smile_Ramona.webp';
            const thumbImg = info ? info.image_thumb : '';
            let topInfoHTML = info ? `<div class="char-top-info"><img src="images/character_${info.relems}.png" class="char-top-icon"><span class="char-top-name">${info.name}</span></div>` : '';

            div.innerHTML = `<img src="${charImg}" class="char-tide-img" onerror="this.src='${thumbImg}'">${conflictHTML}${topInfoHTML}<div class="card-bottom-overlay"><div class="covenant-wrapper"><div class="slot-covenant"></div></div><div class="wheels-wrapper"><div class="slot-wheel" onclick="openWheelModal(${i},0,event)">${w1Info ? `<img src="${w1Info.image_path}">` : '+'}</div><div class="slot-wheel" onclick="openWheelModal(${i},1,event)">${w2Info ? `<img src="${w2Info.image_path}">` : '+'}</div></div></div>`;
            div.onclick = (e) => { if(e.target.closest('.slot-wheel') || e.target.closest('.slot-covenant')) return; openQuickSetup(); };
        } else {
            div.className += ' empty'; div.innerHTML = `<div class="empty-cross"></div><div class="empty-text">배치할 각성체 선택</div>`;
            div.onclick = openQuickSetup;
        }
        sBox.appendChild(div);
    }

    const kid = team.key; const kInfo = DB.keys.find(x => x.english_name === kid);
    const kIcon = document.getElementById('key-icon'); const kName = document.getElementById('key-name');
    if(kInfo) { kIcon.innerHTML = `<img src="${kInfo.image_path}">`; kName.textContent = kInfo.korean_name; kName.style.color = '#fff'; }
    else { kIcon.innerHTML = '+'; kName.textContent = '선택 안 함'; kName.style.color = '#777'; }
}

function editTeamName() {
    const newName = prompt("팀 이름 입력:", teams[currentTeamIdx].name);
    if (newName && newName.trim()) { teams[currentTeamIdx].name = newName.trim(); renderMain(); }
}

function getActiveDomains(team) {
    const domSet = new Set();
    team.chars.forEach(cid => { if(!cid) return; const ch = DB.chars.find(x => String(x.id) === cid); if(ch) domSet.add(ch.relems); });
    return domSet;
}

function renderTeamDomainImage(team) {
    const container = document.getElementById('team-domain-container'); container.innerHTML = '';
    const domSet = getActiveDomains(team); const domArr = Array.from(domSet);
    if (domArr.length === 0) {
        const emptyDiv = document.createElement('div'); emptyDiv.className = 'team-domain-circle'; emptyDiv.style.opacity = '0.3'; emptyDiv.innerText = '-'; emptyDiv.style.color = '#555'; container.appendChild(emptyDiv); return;
    }
    const circleDiv = document.createElement('div'); circleDiv.className = 'team-domain-circle';
    if (domArr.length > 2) { container.innerHTML = `<span style="color:#e74c3c; font-weight:bold; font-size:0.8em; text-align:center;">⚠<br>충돌</span>`; return; }
    const sortOrder = ['chaos', 'aequor', 'caro', 'ultra']; domArr.sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));
    let fileName = domArr.length === 1 ? `pure_${domArr[0]}.png` : `${domArr[0]}_${domArr[1]}.png`;
    const img = document.createElement('img'); img.src = `images/${fileName}`; img.className = 'team-domain-img';
    img.onerror = () => { img.style.display='none'; circleDiv.textContent='?'; };
    circleDiv.appendChild(img); container.appendChild(circleDiv);
    const textSpan = document.createElement('span'); textSpan.className = 'domain-active-text'; textSpan.innerText = '활성화됨'; container.appendChild(textSpan);
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function openQuickSetup() {
    tempChars = teams[currentTeamIdx].chars.filter(x => x);
    activeCharFilters.domain.clear();
    activeCharFilters.class.clear();
    updateCharFilterUI();
    renderCharGrid();
    document.getElementById('modal-char').classList.add('show');
}

function toggleCharFilter(type, value) {
    if (activeCharFilters[type].has(value)) {
        activeCharFilters[type].delete(value);
    } else {
        activeCharFilters[type].add(value);
    }
    updateCharFilterUI();
    renderCharGrid();
}

function updateCharFilterUI() {
    document.querySelectorAll('.filter-chip').forEach(el => {
        const onclickText = el.getAttribute('onclick');
        if (onclickText) {
            const match = onclickText.match(/'(\w+)',\s*'(\w+)'/);
            if (match) {
                const type = match[1];
                const value = match[2];
                if (activeCharFilters[type].has(value)) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            }
        }
    });
}

function renderCharGrid() {
    const box = document.getElementById('grid-char'); box.innerHTML = '';
    const curSet = new Set();
    tempChars.forEach(id => {
        const c = DB.chars.find(x => String(x.id) === id);
        if(c) curSet.add(c.relems);
    });

    const usedMap = new Set();
    teams.forEach((t, i) => { if(i!==currentTeamIdx) t.chars.forEach(id => { if(id) usedMap.add(id); }); });

    const filteredChars = DB.chars.filter(c => {
        const domainPass = (activeCharFilters.domain.size === 0) || activeCharFilters.domain.has(c.relems);
        const classPass = (activeCharFilters.class.size === 0) || activeCharFilters.class.has(c.class);
        return domainPass && classPass;
    });

    filteredChars.forEach(c => {
        const id = String(c.id);
        const isSel = tempChars.includes(id);
        const isUsed = usedMap.has(id);

        // Alter 중복 체크
        const charGroup = EXCLUSIVE_GROUPS.find(g => g.includes(id));
        const isAlterConflict = !isSel && charGroup && tempChars.some(tid => charGroup.includes(String(tid)));

        // 영역 중복 체크
        const isDomainConflict = !isSel && curSet.size >= 2 && !curSet.has(c.relems);
        const isConflict = isAlterConflict || isDomainConflict;

        const el = document.createElement('div');
        el.className = `grid-item ${isSel?'selected':''} ${isUsed?'disabled':''} ${isConflict?'conflict':''}`;
        el.innerHTML = `<img src="${c.image_thumb}">`;
        el.onclick = () => {
            if(isUsed) return;
            if(isSel) {
                tempChars = tempChars.filter(x => x !== id);
            } else {
                if(isConflict) {
                    // 알림 메시지 분기
                    if(isAlterConflict) alert("동일한 캐릭터의 다른 버전은 함께 배치할 수 없습니다.");
                    else alert("세 개 이상의 영역을 한 팀에 배치할 수 없습니다.");
                    return;
                }
                if(tempChars.length >= 4) return alert("최대 4명까지 선택 가능합니다.");
                tempChars.push(id);
            }
            renderCharGrid();
        };
        box.appendChild(el);
    });
    document.getElementById('char-count').textContent = `${tempChars.length} / 4 선택됨`;
}

function confirmQuickSetup() {
    const newArr = [null,null,null,null];
    tempChars.forEach((id, i) => { if(i<4) newArr[i] = id; });
    for(let i=0; i<4; i++) { if(teams[currentTeamIdx].chars[i] !== newArr[i]) teams[currentTeamIdx].wheels[i] = [null,null]; }
    teams[currentTeamIdx].chars = newArr;
    closeModal('modal-char');
    renderAll();
}

function openWheelModal(charIdx, slotIdx, e) {
    if(!teams[currentTeamIdx].chars[charIdx]) return alert("먼저 캐릭터를 배치해주세요.");
    editingCharIdx = charIdx; selectedWheelSlotIdx = slotIdx; if(e) e.stopPropagation();
    activeWheelTags.clear(); document.getElementById('wheel-search-input').value = '';
    renderActiveTags(); setupSearchEvents(); renderWheelModalUI(); document.getElementById('modal-wheel').classList.add('show');
}

function selectWheelSlot(slotIdx) { selectedWheelSlotIdx = slotIdx; renderWheelModalUI(); }

function renderWheelModalUI() {
    const wheels = teams[currentTeamIdx].wheels[editingCharIdx];
    for(let i=0; i<2; i++) {
        const slotEl = document.getElementById(`equip-slot-${i}`); const wId = wheels[i];
        if(i === selectedWheelSlotIdx) slotEl.classList.add('active'); else slotEl.classList.remove('active');
        if(wId) {
            const wInfo = DB.wheels.find(w => w.english_name === wId); slotEl.innerHTML = `<img src="${wInfo.image_path}">`;
            if(i === selectedWheelSlotIdx) document.getElementById('equip-slot-desc').textContent = wInfo.korean_name;
        } else {
            slotEl.innerHTML = `<div class="slot-placeholder">+</div>`;
            if(i === selectedWheelSlotIdx) document.getElementById('equip-slot-desc').textContent = "장착할 아이템을 선택하세요";
        }
    }
    renderWheelList();
}

function renderWheelList() {
    const box = document.getElementById('grid-wheel'); box.innerHTML = '';
    const used = new Set(); teams.forEach(t => t.wheels.forEach(row => row.forEach(w => { if(w) used.add(w); })));
    const currentEquippedId = teams[currentTeamIdx].wheels[editingCharIdx][selectedWheelSlotIdx];
    const searchText = document.getElementById('wheel-search-input').value.trim().toLowerCase();
    const filteredList = DB.wheels.filter(w => {
        if (activeWheelTags.size > 0) {
            const wTags = w.tags || [];
            const hasAllTags = Array.from(activeWheelTags).every(tag => wTags.includes(tag));
            if(!hasAllTags) return false;
        }

        if (searchText.length > 0) {
            // [개선된 검색 조건] 이름, 설명, 혹은 추천 캐릭터 목록에 검색어가 포함되는지 확인
            const nameMatch = w.korean_name.includes(searchText);
            const descMatch = w.description.includes(searchText);
            const charMatch = w.optimized_for && w.optimized_for.some(charName => charName.includes(searchText));

            return nameMatch || descMatch || charMatch;
        }
        return true;
    });
    filteredList.forEach(w => {
        const id = w.english_name; const isSel = (id === currentEquippedId); const isUsed = used.has(id) && !isSel;
        const el = document.createElement('div'); el.className = `grid-item grid-item-wheel ${isSel?'selected':''} ${isUsed?'disabled':''}`;
        el.innerHTML = `<img src="${w.image_path}">`;
        el.onmouseenter = (e) => showTooltip(w, e); el.onmousemove = (e) => moveTooltip(e); el.onmouseleave = () => hideTooltip();
        el.onclick = () => { if(isUsed) return; teams[currentTeamIdx].wheels[editingCharIdx][selectedWheelSlotIdx] = id; renderWheelModalUI(); renderAll(); };
        box.appendChild(el);
    });
    if(filteredList.length === 0) box.innerHTML = `<div class="no-result-message">검색 결과가 없습니다.</div>`;
}

function setupSearchEvents() {
    const input = document.getElementById('wheel-search-input'); const suggestBox = document.getElementById('search-suggestions');
    input.oninput = (e) => {
        const val = e.target.value.trim();
        if(val.length < 1) { suggestBox.style.display = 'none'; renderWheelList(); return; }
        const matches = ALL_SEARCH_TAGS.filter(tag => tag.includes(val) && !activeWheelTags.has(tag));
        if(matches.length > 0) {
            suggestBox.innerHTML = '';
            matches.forEach(tag => {
                const div = document.createElement('div'); div.className = 'suggestion-item';
                const regex = new RegExp(`(${val})`, 'gi'); div.innerHTML = tag.replace(regex, `<span class="suggestion-match">$1</span>`);
                div.onclick = () => { addActiveTag(tag); input.value = ''; suggestBox.style.display = 'none'; };
                suggestBox.appendChild(div);
            }); suggestBox.style.display = 'block';
        } else { suggestBox.style.display = 'none'; }
        renderWheelList();
    };
    input.onkeydown = (e) => { if(e.key === 'Enter') { suggestBox.style.display = 'none'; renderWheelList(); } };
}

function addActiveTag(tag) { activeWheelTags.add(tag); renderActiveTags(); renderWheelList(); }
function removeActiveTag(tag) { activeWheelTags.delete(tag); renderActiveTags(); renderWheelList(); }
function renderActiveTags() {
    const container = document.getElementById('active-tags-area'); container.innerHTML = '';
    activeWheelTags.forEach(tag => {
        const chip = document.createElement('div'); chip.className = 'active-tag-chip'; chip.textContent = tag;
        chip.onclick = () => removeActiveTag(tag); container.appendChild(chip);
    });
}
function unequipSelectedWheel() { teams[currentTeamIdx].wheels[editingCharIdx][selectedWheelSlotIdx] = null; renderWheelModalUI(); renderAll(); }

function openKeyModal() {
    activeKeyTags.clear(); document.getElementById('key-search-input').value = '';
    renderActiveKeyTags(); setupKeySearchEvents(); renderKeyGrid(); document.getElementById('modal-key').classList.add('show');
}

function renderKeyGrid() {
    const box = document.getElementById('grid-key'); box.innerHTML = '';
    const used = new Set(); teams.forEach((t, i) => { if(i !== currentTeamIdx && t.key) used.add(t.key); });
    const curK = teams[currentTeamIdx].key;
    const searchText = document.getElementById('key-search-input').value.trim().toLowerCase();
    const filteredKeys = DB.keys.filter(k => {
        if (activeKeyTags.size > 0) {
            const kTags = k.tags || [];
            const hasAllTags = Array.from(activeKeyTags).every(tag => kTags.includes(tag));
            if(!hasAllTags) return false;
        }

        if (searchText.length > 0) {
            // [개선된 검색 조건]
            const nameMatch = k.korean_name.includes(searchText);
            const descMatch = k.description.includes(searchText);
            const charMatch = k.optimized_for && k.optimized_for.some(charName => charName.includes(searchText));

            return nameMatch || descMatch || charMatch;
        }
        return true;
    });
    if (filteredKeys.length === 0) { box.innerHTML = `<div class="no-result-message">검색 결과가 없습니다.</div>`; return; }
    filteredKeys.forEach(k => {
        const id = k.english_name; const isSel = (id === curK); const isUsed = used.has(id);
        const el = document.createElement('div'); el.className = `grid-item ${isSel?'selected':''} ${isUsed?'disabled':''}`; el.style.borderRadius = "50%";
        el.innerHTML = `<img src="${k.image_path}" style="border-radius:50%;">`;
        el.onmouseenter = (e) => showTooltip(k, e); el.onmousemove = (e) => moveTooltip(e); el.onmouseleave = () => hideTooltip();
        el.onclick = () => { if(isUsed) return; teams[currentTeamIdx].key = id; closeModal('modal-key'); renderAll(); };
        box.appendChild(el);
    });
}
function unequipKey() { teams[currentTeamIdx].key = null; closeModal('modal-key'); renderAll(); }

const tooltipEl = document.getElementById('global-tooltip');
const ttTitle = document.getElementById('tt-title'); const ttDesc = document.getElementById('tt-desc'); const ttTags = document.getElementById('tt-tags');
function showTooltip(item, e) {
    ttTitle.textContent = item.korean_name; ttDesc.textContent = item.description; ttTags.innerHTML = '';
    if(item.tags && item.tags.length > 0) {
        item.tags.forEach(tag => { const span = document.createElement('span'); span.className = 'tooltip-tag'; span.textContent = tag; ttTags.appendChild(span); });
    }
    tooltipEl.style.display = 'block'; moveTooltip(e);
}
function moveTooltip(e) {
    const offset = 15; let left = e.clientX + offset; let top = e.clientY + offset;
    if (left + 320 > window.innerWidth) left = e.clientX - 320;
    if (top + 150 > window.innerHeight) top = e.clientY - 150;
    tooltipEl.style.left = left + 'px'; tooltipEl.style.top = top + 'px';
}
function hideTooltip() { tooltipEl.style.display = 'none'; }

function setupKeySearchEvents() {
    const input = document.getElementById('key-search-input'); const suggestBox = document.getElementById('key-search-suggestions');
    input.oninput = (e) => {
        const val = e.target.value.trim();
        if(val.length < 1) { suggestBox.style.display = 'none'; renderKeyGrid(); return; }
        const matches = ALL_KEY_TAGS.filter(tag => tag.includes(val) && !activeKeyTags.has(tag));
        if(matches.length > 0) {
            suggestBox.innerHTML = '';
            matches.forEach(tag => {
                const div = document.createElement('div'); div.className = 'suggestion-item';
                const regex = new RegExp(`(${val})`, 'gi'); div.innerHTML = tag.replace(regex, `<span class="suggestion-match">$1</span>`);
                div.onclick = () => { addActiveKeyTag(tag); input.value = ''; suggestBox.style.display = 'none'; };
                suggestBox.appendChild(div);
            }); suggestBox.style.display = 'block';
        } else { suggestBox.style.display = 'none'; }
        renderKeyGrid();
    };
    input.onkeydown = (e) => { if(e.key === 'Enter') { suggestBox.style.display = 'none'; renderKeyGrid(); } };
}
function addActiveKeyTag(tag) { activeKeyTags.add(tag); renderActiveKeyTags(); renderKeyGrid(); }
function removeActiveKeyTag(tag) { activeKeyTags.delete(tag); renderActiveKeyTags(); renderKeyGrid(); }
function renderActiveKeyTags() {
    const container = document.getElementById('active-key-tags-area'); container.innerHTML = '';
    activeKeyTags.forEach(tag => {
        const chip = document.createElement('div'); chip.className = 'active-tag-chip'; chip.textContent = tag;
        chip.onclick = () => removeActiveKeyTag(tag); container.appendChild(chip);
    });
}

function openSystemAlert(title, msg) {
    document.getElementById('sys-modal-title').innerText = title;
    document.getElementById('sys-modal-msg').innerText = msg;
    document.getElementById('sys-btn-no').style.display = 'none';
    const yesBtn = document.getElementById('sys-btn-yes');
    yesBtn.innerText = "확인";
    yesBtn.onclick = () => closeModal('modal-system');
    document.getElementById('modal-system').classList.add('show');
}

function openSystemConfirm(title, msg, yesCallback) {
    document.getElementById('sys-modal-title').innerText = title;
    document.getElementById('sys-modal-msg').innerText = msg;
    const noBtn = document.getElementById('sys-btn-no');
    noBtn.style.display = 'inline-block';
    noBtn.onclick = () => closeModal('modal-system');
    const yesBtn = document.getElementById('sys-btn-yes');
    yesBtn.innerText = "네";
    yesBtn.onclick = () => {
        yesCallback();
        closeModal('modal-system');
    };
    document.getElementById('modal-system').classList.add('show');
}

async function sendToDiscord(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const modalStatus = document.getElementById('modal-form-status');
    const modal = document.getElementById('report-modal');

    if (modalStatus) {
        modalStatus.style.display = 'block';
        modalStatus.textContent = '제보를 전송 중입니다...';
        modalStatus.style.color = '#ffc107';
    }

    const reporterEmail = formData.get('_replyto') || '익명(Anonymous)';
    const message = formData.get('message');
    const sourceUrl = formData.get('report_source_url') || window.location.href;

    const payload = {
        username: "Morimens Wiki Bot",
        embeds: [{
            title: "📩 새로운 제보가 도착했습니다!",
            description: "위키에서 유저 피드백/버그 제보가 접수되었습니다.",
            color: 0xFF9F43,
            fields: [
                { name: "👤 제보자", value: `\`${reporterEmail}\``, inline: true },
                { name: "📍 발생 페이지", value: `[바로가기(Click)](${sourceUrl})`, inline: true },
                { name: "📝 상세 내용", value: `>>> ${message}`, inline: false }
            ],
            footer: { text: "Morimens Wiki Report System" },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const webhookUrl = (typeof CONFIG !== 'undefined') ? CONFIG.DISCORD_WEBHOOK_URL : '';
        if(!webhookUrl) throw new Error("Config Error");

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (modalStatus) {
            modalStatus.textContent = "✅ 전송 완료! 감사합니다.";
            modalStatus.style.color = "#2ecc71";
        }
        form.reset();
        setTimeout(() => {
            modal.classList.remove('show');
            if (modalStatus) {
                modalStatus.style.display = 'none';
                modalStatus.textContent = '전송 중...';
            }
        }, 1500);
    } catch (error) {
        console.error(error);
        if (modalStatus) {
            modalStatus.textContent = '❌ 설정 오류 또는 네트워크 오류입니다.';
            modalStatus.style.color = "#e74c3c";
        }
    }
}

// [누락되었던 핵심 함수 복구]
function openReportModal() {
    const modal = document.getElementById('report-modal');
    const sourceUrlInput = document.getElementById('report-source-url');
    const modalStatus = document.getElementById('modal-form-status');

    if (modalStatus) {
        modalStatus.style.display = 'none';
        modalStatus.textContent = '제보를 전송 중입니다...';
        modalStatus.style.color = '#ffc107';
    }
    if (sourceUrlInput) { sourceUrlInput.value = window.location.href; }
    modal.classList.add('show');
}