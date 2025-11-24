document.addEventListener('DOMContentLoaded', () => {
    // "번역기" (매핑 테이블)
    const RELEMS_MAP = { "chaos": "혼돈", "aequor": "심해", "caro": "혈육", "ultra": "초차원" };
    const CLASS_MAP = { "assault": "데미지형", "warden": "방어형", "chorus": "보조형" };

    // DOM 요소 캐시 (GetComponent 캐싱)
    const searchBar = document.getElementById('search-bar');
    const relemsFilter = document.getElementById('relems-filter');
    const gradeFilter = document.getElementById('grade-filter');
    const classFilter = document.getElementById('class-filter');
    const characterGrid = document.getElementById('character-grid');

    let allCardLinks = []; // 필터링 최적화를 위한 오브젝트 풀링 역할
    let currentFilters = { relems: 'all', grade: 'all', class: 'all', search: '' };

    // --- 1. JSON에서 캐릭터 카드를 생성하는 함수 (Instantiate) ---
    async function buildCharacterGrid() {
        try {
            const response = await fetch('data/character_manifest.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const characters = await response.json();

            let gridHTML = '';
            for (const char of characters) {
                const relemName = RELEMS_MAP[char.relems] || char.relems;
                const className = CLASS_MAP[char.class] || char.class;

                // [핵심 변경] detail.html 대신 links.html로 이동하며 카테고리와 ID를 전달함
                gridHTML += `
                    <a href="links.html?category=character&id=${char.id}" class="card-link">
                        <div class="character-card ${char.relems} ${char.grade} ${char.class}">
                            <img src="${char.image_thumb}" alt="${char.name}">
                            <span class="relems-tag ${char.relems}">${relemName}</span>
                            <h3>${char.name}</h3>
                            <p>${className}</p>
                        </div>
                    </a>
                `;
            }

            characterGrid.innerHTML = gridHTML;
            // 생성된 모든 <a> 태그를 배열에 저장 (참조 유지)
            allCardLinks = characterGrid.querySelectorAll('a.card-link');

        } catch (error) {
            console.error("캐릭터 목록 로드 실패:", error);
            characterGrid.innerHTML = "<p>캐릭터 목록을 불러오는 데 실패했습니다.</p>";
        }
    }

    // --- 2. 필터를 적용하는 함수 (Active/Deactive) ---
    function applyFilters() {
        const searchTerm = currentFilters.search;

        allCardLinks.forEach(link => {
            const card = link.querySelector('.character-card');

            // 필터 조건 검사
            const relemsMatch = currentFilters.relems === 'all' || card.classList.contains(currentFilters.relems);
            const gradeMatch = currentFilters.grade === 'all' || card.classList.contains(currentFilters.grade);
            const classMatch = currentFilters.class === 'all' || card.classList.contains(currentFilters.class);

            // 검색어 검사
            const name = card.querySelector('h3').textContent.toLowerCase();
            const searchMatch = name.includes(searchTerm);

            // 모든 조건이 맞으면 보이게, 아니면 숨김
            if (relemsMatch && gradeMatch && classMatch && searchMatch) {
                link.classList.remove('hidden');
            } else {
                link.classList.add('hidden');
            }
        });
    }

    // --- 3. 이벤트 리스너 설정 및 초기화 (Awake/Start) ---
    async function initialize() {
        // 1. 그리드 생성
        await buildCharacterGrid();

        // 2. 필터 이벤트 리스너 등록
        relemsFilter.addEventListener('change', (e) => {
            currentFilters.relems = e.target.value;
            applyFilters();
        });
        gradeFilter.addEventListener('change', (e) => {
            currentFilters.grade = e.target.value;
            applyFilters();
        });
        classFilter.addEventListener('change', (e) => {
            currentFilters.class = e.target.value;
            applyFilters();
        });
        searchBar.addEventListener('input', (e) => {
            currentFilters.search = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    initialize();
});