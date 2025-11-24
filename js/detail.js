/**
 * detail.js
 * (스크롤링 텍스트, 스마트 툴팁, 모든 버그가 수정된 최종본)
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 글로벌 변수 및 엘리먼트 캐싱 ---

    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');
    const charGrade = urlParams.get('grade');

    const elements = {
        charImage: document.getElementById('char-image'),
        charName: document.getElementById('char-name'),
        charTags: document.getElementById('char-tags'),
        charLore: document.getElementById('char-lore'),
        statsContainer: document.getElementById('stats-table-container'),
        tabsContainer: document.getElementById('data-tabs'),
        skillTab: document.getElementById('tab-skills'),
        covenantTab: document.getElementById('tab-covenant'),
        myeongryunTab: document.getElementById('tab-myeongryun'),
        teamTab: document.getElementById('tab-team'),
        growthTab: document.getElementById('tab-growth'),
        breakthroughContent: document.getElementById('breakthrough-content'),
        talentsContent: document.getElementById('talents-content'),
        modal: document.getElementById('derived-modal'),
        modalSlide: document.getElementById('modal-skill-slide'),
        modalPrev: document.getElementById('modal-prev'),
        modalNext: document.getElementById('modal-next'),
    };

    // 데이터 저장소
    let ALL_CARDS_DB = {};
    let ALL_STATS_DB = {};
    let ALL_COVENANTS_DB = {};
    let ALL_WHEELS_DB = {};
    let ALL_CHARACTERS_MANIFEST = {};
    let TOOLTIP_DICTIONARY = {};
    let characterFullImage = "";

    // 모달 상태 관리 변수
    let currentSkillCards = [];
    let currentSkillIndex = 0;
    let currentModalCards = [];
    let currentModalIndex = 0;

    const RELEMS_MAP = { "chaos": "혼돈", "aequor": "심해", "caro": "혈육", "ultra": "초차원" };
    const CLASS_MAP = { "assault": "데미지형", "warden": "방어형", "chorus": "보조형" };

    // --- 2. 메인 실행 함수 ---

    async function main() {
        if (!charId) {
            document.body.innerHTML = "<h1>캐릭터 ID가 없습니다.</h1><a href='index.html'>목록으로 돌아가기</a>";
            return;
        }

        try {
            // --- 데이터 로딩 (툴팁 DB 포함) ---
            const [
                awakenerData, cardsDB, statsDB, covenantsDB, wheelsDB, manifestData, tooltipsDB
            ] = await Promise.all([
                fetch(`data/awakener/${charId}.json`).then(res => res.json()),
                fetch(`data/db_cards.json`).then(res => res.json()),
                fetch(`data/db_awakener_stats.json`).then(res => res.json()),
                fetch(`data/covenant.json`).then(res => res.json()),
                fetch(`data/wheels.json`).then(res => res.json()),
                fetch(`data/character_manifest.json`).then(res => res.json()),
                fetch(`data/db_tooltips.json`).then(res => res.json())
            ]);

            // DB 데이터 캐싱
            ALL_CARDS_DB = cardsDB.cards.reduce((acc, card) => { acc[card.id] = card; return acc; }, {});
            ALL_STATS_DB = statsDB;
            ALL_COVENANTS_DB = covenantsDB;
            ALL_WHEELS_DB = wheelsDB;
            ALL_CHARACTERS_MANIFEST = manifestData.reduce((acc, char) => { acc[char.id] = char; return acc; }, {});
            TOOLTIP_DICTIONARY = tooltipsDB;

            const fullCharacterData = {
                ...awakenerData,
                stats: ALL_STATS_DB[awakenerData.stats_id] || {},
                skill_kit: {
                    command_cards: awakenerData.skill_kit_ids.command_cards.map(id => ALL_CARDS_DB[id]).filter(Boolean),
                    rouse_skill: ALL_CARDS_DB[awakenerData.skill_kit_ids.rouse_skill],
                    exalt: ALL_CARDS_DB[awakenerData.skill_kit_ids.exalt],
                    overexalt: ALL_CARDS_DB[awakenerData.skill_kit_ids.overexalt]
                },
                guide: {
                    ...awakenerData.guide,
                    recommended_wheel: ALL_WHEELS_DB[awakenerData.guide.recommended_wheel_id],
                    recommended_covenants_data: awakenerData.guide.recommended_covenants.map(guide => ({
                        ...guide,
                        synergy: ALL_COVENANTS_DB[guide.synergy_id]
                    })),
                    recommended_team_data: awakenerData.guide.recommended_team_ids.map(id => ALL_CHARACTERS_MANIFEST[id]).filter(Boolean)
                }
            };

            // --- 페이지 렌더링 ---
            document.title = `${fullCharacterData.name} (${charGrade ? charGrade.toUpperCase() : ''}) - 망각전야 (MORIMENS)`;

            elements.skillTab.innerHTML = '';
            elements.covenantTab.innerHTML = '';
            elements.myeongryunTab.innerHTML = '';
            elements.teamTab.innerHTML = '';
            elements.breakthroughContent.innerHTML = '';
            elements.talentsContent.innerHTML = '';

            populateProfile(fullCharacterData);
            populateStats(fullCharacterData.stats);
            populateSkills(fullCharacterData.skill_kit, fullCharacterData.images.full);
            populateCovenant(fullCharacterData.guide.recommended_covenants_data);
            populateMyeongryun(fullCharacterData.guide.recommended_wheel);
            populateTeam(fullCharacterData, fullCharacterData.guide.recommended_team_data);
            populateGrowth(fullCharacterData.stats);

            setupEventListeners();
            setupTooltipListeners();


        } catch (error) {
            console.error('데이터 처리 실패:', error);
            document.body.innerHTML = "<h1>데이터를 처리하는 중 오류가 발생했습니다.</h1><p>콘솔(F12)을 확인해주세요.</p>";
        }
    }

    // 🚩🚩🚩 툴팁 HTML 변환 헬퍼 함수 🚩🚩🚩
    function applyTooltipsToDescription(description) {
        if (!description) return '';

        // 1. [키워드]를 툴팁용 <span>으로 변환
        const tooltipApplied = description.replace(/\[([^\]]+)\]/g, (match, keyword) => {
            if (TOOLTIP_DICTIONARY[keyword]) {
                return `<span class="tooltip-trigger" data-keyword="${keyword}">[${keyword}]</span>`;
            }
            return `<b>[${keyword}]</b>`;
        });

        // 2. <link> 태그 처리
        const linkedDesc = tooltipApplied.replace(
            /<link id="([^"]+)">([^<]+)<\/link>/g,
            (match, id, text) => `<a href="#" class="derived-link" data-id="${id}">${text}</a>`
        );

        return linkedDesc.replace(/▲/g, '\n▲');
    }
    // 🚩🚩🚩 ------------------------------- 🚩🚩🚩


    // --- 3. 렌더링 함수들 (툴팁 적용) ---

    function populateProfile(data) {
        characterFullImage = data.images.full;
        elements.charImage.src = data.images.full || 'https://via.placeholder.com/400x600?text=Loading...';
        elements.charName.textContent = data.name;
        elements.charLore.textContent = data.info.story;

        elements.charTags.innerHTML = '';
        if (charGrade) elements.charTags.insertAdjacentHTML('beforeend', `<span class="tag ${charGrade}">${charGrade.toUpperCase()}</span>`);
        const relemVar = data.info.relems;
        const relemName = RELEMS_MAP[relemVar] || relemVar;
        elements.charTags.insertAdjacentHTML('beforeend', `<span class="tag ${relemVar}">${relemName}</span>`);
        const classVar = data.info.class;
        const className = CLASS_MAP[classVar] || classVar;
        elements.charTags.insertAdjacentHTML('beforeend', `<span class="tag ${classVar}">${className}</span>`);
    }

    function populateStats(statsData) {
        let html = `<ul>`;
        if (statsData.base_stats) {
            statsData.base_stats.forEach(stat => {
                html += `<li>${stat.stat}<b>${stat.value}</b></li>`;
            });
        }
        html += `</ul>`;
        elements.statsContainer.innerHTML = html;
    }

    function populateSkills(skillKit, charImg) {
        let html = '';
        currentSkillCards = [];
        const cardsToShow = [...skillKit.command_cards, skillKit.rouse_skill].filter(Boolean);
        cardsToShow.forEach(card => {
            if (card) currentSkillCards.push(card);
        });

        html += `
            <div class="skill-carousel-container">
                <button class="main-carousel-arrow left" id="skill-prev">&lt;</button>
                <div class="skill-card-builder" id="main-skill-slide">
                    <img class="card-layer card-ui-bg" id="main-card-ui-bg" src="" alt="카드 UI">
                    <img class="card-layer card-illustration" id="main-card-illustration" src="" alt="캐릭터 일러스트">
                    <div class="card-layer card-cost" id="main-card-cost"></div>
                    <div class="card-layer card-name" id="main-card-name"></div>
                    <div class="card-layer card-desc" id="main-card-desc"></div>
                </div>
                <button class="main-carousel-arrow right" id="skill-next">&gt;</button>
            </div>`;

        if (skillKit.exalt) {
            html += `
                <div class="special-skill-card" id="exalt-card">
                    <h4>${skillKit.exalt.name} (광기 소모: ${skillKit.exalt.cost_energy})</h4>
                    <p>${applyTooltipsToDescription(skillKit.exalt.description)}</p>
                </div>`;
        }
        if (skillKit.overexalt) {
            html += `
                <div class="special-skill-card" id="overexalt-card">
                    <h4>${skillKit.overexalt.name} (광기 소모: ${skillKit.overexalt.cost_energy})</h4>
                    <p>${applyTooltipsToDescription(skillKit.overexalt.description)}</p>
                </div>`;
        }

        elements.skillTab.innerHTML = html;

        if (currentSkillCards.length > 0) {
            updateMainSkillView(0);
        }
    }

    // 🟩 updateMainSkillView 함수 (스크롤링 텍스트 로직 추가) 🟩
    function updateMainSkillView(index) {
        const card = currentSkillCards[index];
        if (!card) return;

        const mainSlide = document.getElementById('main-skill-slide');
        const mainCardUiBg = document.getElementById('main-card-ui-bg');
        const mainCardIllu = document.getElementById('main-card-illustration');
        const mainCardCost = document.getElementById('main-card-cost');
        const mainCardName = document.getElementById('main-card-name');
        const mainCardDesc = document.getElementById('main-card-desc');
        const nextButton = document.getElementById('skill-next');
        const prevButton = document.getElementById('skill-prev');

        const finalDesc = applyTooltipsToDescription(card.description);

        mainSlide.classList.add('fading');
        setTimeout(() => {
            const uiName = card.ui_type === 'rouse' ? 'Rouse_Blank_UI' : 'Basic_Blank_UI';
            mainCardUiBg.src = `images/${uiName}.webp`;
            mainCardIllu.src = characterFullImage;

            if (card.cost === null) { mainCardCost.textContent = ''; }
            else { mainCardCost.textContent = card.cost; }

            // 🚩🚩🚩 스크롤링 텍스트 로직 🚩🚩🚩
            mainCardName.textContent = card.name; // 텍스트만 먼저 설정 (길이 측정용)

            // 텍스트 너비 측정을 위해 잠시 visibility를 켜야 함 (DOM 계산 필요)
            mainCardName.style.visibility = 'hidden';

            // DOM이 텍스트를 계산할 시간을 줌
            setTimeout(() => {
                const containerWidth = mainCardName.clientWidth;
                const textWidth = mainCardName.scrollWidth;

                mainCardName.style.visibility = 'visible'; // 다시 보이게 설정

                // 이름이 컨테이너 너비보다 길다면 스크롤링 시작
                if (textWidth > containerWidth) {
                    // 내부 <span>으로 텍스트를 감싸고 애니메이션 적용
                    mainCardName.innerHTML = `<span class="card-name-inner">${card.name}</span>`;

                    // 애니메이션 속도 설정 (텍스트 길이에 비례)
                    const duration = textWidth / 30; // 글자 30px 당 1초 (속도 조절 가능)
                    mainCardName.style.setProperty('--marquee-duration', `${duration}s`);

                    // CSS에서 정의된 'scrolling' 클래스 추가
                    mainCardName.classList.add('scrolling');
                } else {
                    // 짧은 이름은 일반 텍스트로 유지
                    mainCardName.classList.remove('scrolling');
                    mainCardName.textContent = card.name; // 텍스트가 이미 설정되었지만 안전하게 재설정
                }
            }, 50); // 짧은 지연 시간 후 텍스트 너비 측정

            // 텍스트 설명 및 기타 정보 설정
            mainCardDesc.innerHTML = finalDesc;

            if (card.ui_type === 'rouse') {
                mainCardCost.style.color = '#000';
                mainCardName.style.color = '#000';
            } else {
                mainCardCost.style.color = '#fff';
                mainCardName.style.color = '#fff';
            }

            prevButton.classList.toggle('hidden', index === 0);
            nextButton.classList.toggle('hidden', index === currentSkillCards.length - 1);
            mainSlide.classList.remove('fading');
        }, 150);
    }

    function populateCovenant(covenantGuidesData) {
        let html = '';
        if (!covenantGuidesData || covenantGuidesData.length === 0) {
            elements.covenantTab.innerHTML = "<p>추천 비밀계약 정보가 없습니다.</p>";
            return;
        }

        covenantGuidesData.forEach((guide, index) => {
            const setNum = index + 1;
            const title = guide.title.replace('추천', `${index + 1}순위 추천`);

            html += `
                <h4>${title}</h4> 
                <div class="covenant-layout-container">
                    <div class="covenant-hexagon-layout">
                        ${[1,2,3,4,5,6].map(i => `<div class="covenant-piece-tri pos-${i}" id="covenant-piece-${i}-set${setNum}"></div>`).join('')}
                    </div>
                    <div class="synergies-container">
                        <h5>${guide.synergy ? guide.synergy.name : '시너지 효과'}</h5>
                        <p><b>2세트:</b> <span id="covenant-synergy2-set${setNum}">${applyTooltipsToDescription(guide.synergy ? guide.synergy.synergy_2 : '...')}</span></p>
                        <p><b>4세트:</b> <span id="covenant-synergy4-set${setNum}">${applyTooltipsToDescription(guide.synergy ? guide.synergy.synergy_4 : '...')}</span></p>
                        <p><b>6세트:</b> <span id="covenant-synergy6-set${setNum}">${applyTooltipsToDescription(guide.synergy ? guide.synergy.synergy_6 : '...')}</span></p>
                    </div>
                </div>`;
        });

        elements.covenantTab.innerHTML = html;
    }

    function populateMyeongryun(wheelData) {
        let html = '';
        if (wheelData) {
            html = `
                <div class="myeongryun-layout">
                    <div class="myeongryun-unique">
                        <h5>
                            <img id="wheel-icon" src="${wheelData.image || ''}" alt="명륜 아이콘">
                            <span id="wheel-name">${wheelData.name}</span>
                        </h5>
                        <p>${applyTooltipsToDescription(wheelData.effect)}</p>
                    </div>
                </div>`;
        } else {
            elements.myeongryunTab.innerHTML = "<p>추천 명륜 정보가 없습니다.</p>";
            return;
        }
        elements.myeongryunTab.innerHTML = html;
    }

    function populateTeam(mainChar, teamData) {
        let teamHtml = '';
        teamHtml += `<h4 class="team-title-folder">추천 조합 (1팀)</h4>`;
        teamHtml += `<div class="team-cards-wrapper">`;
        teamHtml += createTeamCard(mainChar.name, mainChar.images.thumb, true);
        if (teamData && teamData.length > 0) {
            teamData.forEach(member => {
                teamHtml += createTeamCard(member.name, member.image_thumb);
            });
        }
        const remainingSlots = 4 - 1 - (teamData ? teamData.length : 0);
        for(let i = 0; i < remainingSlots; i++) {
            teamHtml += createTeamCard('...', null);
        }
        teamHtml += `</div>`;
        elements.teamTab.innerHTML = teamHtml;
    }

    function populateGrowth(statsData) {
        elements.breakthroughContent.innerHTML = '';
        elements.talentsContent.innerHTML = '';

        let breakthroughHtml = '';
        if (statsData.breakthroughs) {
            statsData.breakthroughs.forEach(b => {
                breakthroughHtml += `
                    <div class="special-skill-card" style="border-left-color: #007bff;">
                        <h4>${b.name}</h4>
                        <p>${applyTooltipsToDescription(b.description)}</p>
                    </div>`;
            });
        }
        elements.breakthroughContent.innerHTML = breakthroughHtml;

        let talentsHtml = '';
        if (statsData.talents) {
            statsData.talents.forEach(t => {
                talentsHtml += `
                    <div class="special-skill-card" style="border-left-color: #28a745;">
                        <h4>${t.name} (${t.level_range})</h4>
                        <p style="white-space: pre-line;">${applyTooltipsToDescription(t.description)}</p>
                    </div>`;
            });
        }
        elements.talentsContent.innerHTML = talentsHtml;
    }

    function updateModalSkillView(index) {
        const card = currentModalCards[index];
        if (!card) return;

        elements.modalSlide.classList.add('fading');

        const linkedDesc = applyTooltipsToDescription(card.description);

        const cardHtml = `
            <div class="derived-card-image">
                <img id="modal-skill-image" src="${card.image || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${card.name}">
            </div>
            <div class="derived-card-desc">
                <h6 id="modal-skill-name-cost">${card.name} <span class="cost">${card.cost !== null ? card.cost : '0'}</span></h6>
                <p id="modal-skill-desc">${linkedDesc}</p>
            </div>
        `;

        setTimeout(() => {
            elements.modalSlide.innerHTML = cardHtml;

            elements.modalPrev.classList.toggle('hidden', index === 0);
            elements.modalNext.classList.toggle('hidden', currentModalCards.length <= 1 || index === currentModalCards.length - 1);
            elements.modalSlide.classList.remove('fading');
        }, 150);
    }

    function createTeamCard(name, imageUrl, isMain = false) {
        const style = isMain ? 'style="border: 2px solid #ffc107;"' : '';
        return `
            <div class="team-member-card" ${style}>
                <img src="${imageUrl || 'https://via.placeholder.com/200x200?text=No+Image'}" alt="${name}">
                <h5>${name}</h5>
            </div>`;
    }

    function collectAllDerivedCards(cardId, collectedIds = new Set()) {
        const card = ALL_CARDS_DB[cardId];
        if (!card) {
            return collectedIds;
        }

        if (card.derives_cards && card.derives_cards.length > 0) {
            card.derives_cards.forEach(derivedId => {
                if (!collectedIds.has(derivedId)) {
                    collectedIds.add(derivedId);
                    collectAllDerivedCards(derivedId, collectedIds);
                }
            });
        }
        return collectedIds;
    }
    
    function setupTooltipListeners() {
        // 툴팁 박스가 없으면 생성하여 body에 추가
        let tooltipBox = document.getElementById('global-tooltip-box');
        if (!tooltipBox) {
            tooltipBox = document.createElement('div');
            tooltipBox.id = 'global-tooltip-box';
            tooltipBox.classList.add('tooltip-box');
            document.body.appendChild(tooltipBox);
        }

        // 마우스 오버 이벤트 위임
        document.addEventListener('mouseover', (e) => {
            if (e.target.matches('.tooltip-trigger')) {
                const keyword = e.target.dataset.keyword;
                const description = TOOLTIP_DICTIONARY[keyword];
                if (description) {

                    tooltipBox.innerHTML = description;

                    // 위치 계산 (DOM 계산을 위해 잠시 표시)
                    tooltipBox.style.visibility = 'visible';
                    tooltipBox.style.opacity = '1';

                    const rect = e.target.getBoundingClientRect();
                    const tooltipHeight = tooltipBox.offsetHeight;
                    const tooltipWidth = tooltipBox.offsetWidth;
                    const viewportHeight = window.innerHeight;

                    let topPos, leftPos;

                    // 1. 세로 위치 결정 (스마트 포지셔닝)
                    // 요소의 아래쪽(rect.bottom) + 여백(5px)이 뷰포트를 벗어나는 경우 (하단 공간 부족)
                    if (rect.bottom + tooltipHeight + 5 > viewportHeight) {
                        // 툴팁을 요소 위에 띄움 (요소 위쪽 - 툴팁 높이 - 여백)
                        topPos = rect.top - tooltipHeight - 5;
                    } else {
                        // 툴팁을 요소 아래에 띄움
                        topPos = rect.bottom + 5;
                    }

                    // 2. 가로 위치 결정 (화면 좌/우측 이탈 방지)
                    const centerX = rect.left + rect.width / 2;
                    // 기본: 요소 중앙 정렬
                    leftPos = centerX;

                    // 좌측 경계 검사
                    if (centerX - tooltipWidth / 2 < 0) {
                        leftPos = tooltipWidth / 2 + 10; // 좌측에서 10px 여백
                    }
                    // 우측 경계 검사
                    if (centerX + tooltipWidth / 2 > window.innerWidth) {
                        leftPos = window.innerWidth - tooltipWidth / 2 - 10; // 우측에서 10px 여백
                    }

                    // CSS 위치 적용 (fixed position 기준)
                    tooltipBox.style.top = `${topPos}px`;
                    tooltipBox.style.left = `${leftPos}px`;
                    tooltipBox.style.transform = 'translateX(-50%)';
                }
            }
        });

        // 마우스 아웃 이벤트 위임
        document.addEventListener('mouseout', (e) => {
            if (e.target.matches('.tooltip-trigger')) {
                // 툴팁 숨기기
                const tooltipBox = document.getElementById('global-tooltip-box');
                if (tooltipBox) {
                    tooltipBox.style.visibility = 'hidden';
                    tooltipBox.style.opacity = '0';
                }
            }
        });
    }

    function setupEventListeners() {
        // 탭 기능
        elements.tabsContainer.addEventListener('click', (e) => {
            if (!e.target.matches('button.tab-link')) return;
            const clickedTab = e.target;
            const targetTabContentId = clickedTab.dataset.tab;
            elements.tabsContainer.querySelectorAll('.tab-link').forEach(button => button.classList.remove('active'));
            clickedTab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(targetTabContentId).classList.add('active');
        });

        // 스킬/모달 이벤트 리스너: 화살표와 파생 카드 클릭 통합 처리 (메인 스킬 탭)
        elements.skillTab.addEventListener('click', (e) => {

            // 1. 캐러셀 화살표 로직 (이동)
            if (e.target.id === 'skill-next') {
                e.stopPropagation();
                if (currentSkillIndex < currentSkillCards.length - 1) {
                    currentSkillIndex++;
                    updateMainSkillView(currentSkillIndex);
                }
            }
            else if (e.target.id === 'skill-prev') {
                e.stopPropagation();
                if (currentSkillIndex > 0) {
                    currentSkillIndex--;
                    updateMainSkillView(currentSkillIndex);
                }
            }

            // 2. 메인 뷰에서 파생 카드 링크 클릭 시 모달 오픈 로직
            else if (e.target.matches('.derived-link')) {
                e.preventDefault();
                e.stopPropagation();

                const clickedCardId = e.target.dataset.id;

                const mainCard = currentSkillCards[currentSkillIndex];
                if (!mainCard) return;

                // 해당 카드 ID에서 파생되는 모든 카드 ID(10개)를 재귀적으로 수집
                const derivedIds = collectAllDerivedCards(mainCard.id);

                currentModalCards = Array.from(derivedIds).map(id => ALL_CARDS_DB[id]).filter(Boolean);

                if (currentModalCards.length > 0) {
                    const startIndex = currentModalCards.findIndex(card => card.id === clickedCardId);
                    currentModalIndex = startIndex !== -1 ? startIndex : 0;

                    updateModalSkillView(currentModalIndex);
                    elements.modal.classList.add('show');
                }
            }
        });

        // 모달 닫기 및 탐색
        elements.modal.addEventListener('click', (e) => {
            // 모달 외부 (오버레이)를 클릭했을 때 닫기
            if (e.target === elements.modal) {
                elements.modal.classList.remove('show');
                return;
            }

            // 모달 내부의 파생 카드 링크 클릭 시 (인덱스 점프)
            if (e.target.matches('.derived-link')) {
                e.preventDefault();
                e.stopPropagation();
                const clickedCardId = e.target.dataset.id;

                const newIndex = currentModalCards.findIndex(card => card.id === clickedCardId);

                if (newIndex !== -1) {
                    currentModalIndex = newIndex;
                    updateModalSkillView(currentModalIndex);
                }
            }

            // 모달 좌우 화살표 탐색
            else if (e.target.matches('#modal-prev')) {
                e.stopPropagation();
                if (currentModalIndex > 0) {
                    currentModalIndex--;
                    updateModalSkillView(currentModalIndex);
                }
            } else if (e.target.matches('#modal-next')) {
                e.stopPropagation();
                if (currentModalIndex < currentModalCards.length - 1) {
                    currentModalIndex++;
                    updateModalSkillView(currentModalIndex);
                }
            }
        });
    }

    // --- 6. 프로그램 시작 ---
    main();

});