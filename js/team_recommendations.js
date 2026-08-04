(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.TeamRecommendations = api;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => api.initialize(), { once: true });
        } else {
            api.initialize();
        }
    }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    'use strict';

    const INVENTORY_STORAGE_KEY = 'morimens_inventory_checker_v2';
    const BREAKTHROUGHS = ['명함', '1돌', '2돌', '3돌', '초한'];
    const STAT_OPTIONS = [
        '은열쇠 충전', '영역 숙련', '검은 인장 획득', '피해 증폭',
        '크리티컬 피해', '크리티컬 확률', '죽음 저항', '광기 회복'
    ];
    const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
    const state = {
        characters: [], wheels: [], covenants: [], teams: [],
        characterMap: new Map(), wheelMap: new Map(), covenantMap: new Map(),
        inventory: { registered: false, characters: new Set(), wheels: new Set(), characterBreakthroughs: {} }
    };

    async function initialize() {
        const list = document.getElementById('team-list');
        if (!list) return;
        bindTabs();
        list.innerHTML = '<div class="community-team-empty">조합 데이터를 불러오는 중입니다.</div>';
        try {
            const ts = Date.now();
            const [characters, wheels, covenants, teamData] = await Promise.all([
                fetch(`data/character_manifest.json?t=${ts}`).then(assertResponse).then(response => response.json()),
                fetch(`data/wheel_list.json?t=${ts}`).then(assertResponse).then(response => response.json()),
                fetch(`data/covenant_list.json?t=${ts}`).then(assertResponse).then(response => response.json()),
                fetch(`data/recommended_teams.json?t=${ts}`).then(assertResponse).then(response => response.json())
            ]);
            state.characters = characters;
            state.wheels = wheels;
            state.covenants = covenants;
            state.teams = normalizeTeamCollection(teamData);
            state.characterMap = new Map(characters.map(item => [item.id, item]));
            state.wheelMap = new Map(wheels.map(item => [item.english_name, item]));
            state.covenantMap = new Map(covenants.map(item => [item.english_name, item]));
            state.inventory = readInventory();
            bindBrowseFilters();
            renderEditor();
            renderTeams();
            document.getElementById('team-create-form')?.addEventListener('submit', submitTeam);
        } catch (error) {
            console.error('조합 추천 데이터 로드 실패:', error);
            list.innerHTML = '<div class="community-team-empty">조합 데이터를 불러오지 못했습니다.</div>';
        }
    }

    function assertResponse(response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    }

    function normalizeTeamCollection(data) {
        if (Array.isArray(data)) return data;
        return Array.isArray(data?.teams) ? data.teams : [];
    }

    function bindTabs() {
        document.querySelectorAll('[data-team-tab]').forEach(button => {
            button.addEventListener('click', () => {
                const target = button.dataset.teamTab;
                document.querySelectorAll('[data-team-tab]').forEach(tab => {
                    const selected = tab === button;
                    tab.classList.toggle('active', selected);
                    tab.setAttribute('aria-selected', String(selected));
                });
                const browse = document.getElementById('team-browse-panel');
                const create = document.getElementById('team-create-panel');
                browse.classList.toggle('active', target === 'browse');
                create.classList.toggle('active', target === 'create');
                browse.hidden = target !== 'browse';
                create.hidden = target !== 'create';
            });
        });
    }

    function bindBrowseFilters() {
        document.getElementById('team-search-input')?.addEventListener('input', renderTeams);
        document.getElementById('team-owned-only')?.addEventListener('change', renderTeams);
    }

    function readInventory(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
        try {
            const raw = storage?.getItem(INVENTORY_STORAGE_KEY);
            if (!raw) return { registered: false, characters: new Set(), wheels: new Set(), characterBreakthroughs: {} };
            const saved = JSON.parse(raw);
            const characters = new Set(Array.isArray(saved?.characters) ? saved.characters.map(String) : []);
            const wheels = new Set(Array.isArray(saved?.wheels) ? saved.wheels.map(String) : []);
            return {
                registered: characters.size > 0 || wheels.size > 0,
                characters,
                wheels,
                characterBreakthroughs: saved?.characterBreakthroughs || {}
            };
        } catch (error) {
            return { registered: false, characters: new Set(), wheels: new Set(), characterBreakthroughs: {} };
        }
    }

    function getTeamAvailability(team, inventory = state.inventory) {
        if (!inventory.registered) return { state: 'unregistered', missingCharacters: [], missingWheels: [], missingBreakthroughs: [] };
        const missingCharacters = unique(team.members
            .map(member => member.character_id)
            .filter(id => !inventory.characters.has(String(id))));
        const missingWheels = unique(team.members
            .flatMap(member => member.wheel_ids || [])
            .filter(id => !inventory.wheels.has(String(id))));
        const missingBreakthroughs = team.members.filter(member => {
            if (!inventory.characters.has(String(member.character_id))) return false;
            const owned = Number.parseInt(inventory.characterBreakthroughs?.[member.character_id], 10) || 0;
            return owned < getRequiredBreakthroughLevel(member.breakthrough);
        }).map(member => member.character_id);
        return {
            state: missingCharacters.length === 0 && missingWheels.length === 0 && missingBreakthroughs.length === 0 ? 'complete' : 'missing',
            missingCharacters,
            missingWheels,
            missingBreakthroughs
        };
    }

    function getRequiredBreakthroughLevel(label) {
        if (label === '초한') return 7;
        const match = String(label || '').match(/(\d+)돌/);
        return match ? Number.parseInt(match[1], 10) : 0;
    }

    function renderTeams() {
        const list = document.getElementById('team-list');
        const summary = document.getElementById('team-result-summary');
        const query = String(document.getElementById('team-search-input')?.value || '').trim().toLowerCase();
        const ownedOnly = Boolean(document.getElementById('team-owned-only')?.checked);
        const filtered = state.teams.filter(team => {
            const names = team.members.map(member => state.characterMap.get(member.character_id)?.name || '').join(' ').toLowerCase();
            const searchMatch = !query || names.includes(query);
            const availability = getTeamAvailability(team);
            return searchMatch && (!ownedOnly || availability.state === 'complete');
        });
        summary.textContent = `전체 ${state.teams.length}개 중 ${filtered.length}개 조합`;
        if (filtered.length === 0) {
            list.innerHTML = '<div class="community-team-empty">조건에 맞는 조합이 없습니다.</div>';
            return;
        }
        list.innerHTML = filtered.map((team, index) => renderTeamCard(team, index)).join('');
    }

    function renderTeamCard(team, index) {
        const availability = getTeamAvailability(team);
        const availabilityMarkup = renderAvailability(availability);
        return `<article class="community-team-card">
            <header class="community-team-heading">
                <h2>추천 조합 ${index + 1}</h2>
                ${availabilityMarkup}
            </header>
            <div class="community-team-members">${team.members.map(renderMemberCard).join('')}</div>
        </article>`;
    }

    function renderAvailability(availability) {
        if (availability.state === 'complete') return '<p class="team-availability complete">보유 각성체·돌파·명륜으로 구성 가능</p>';
        if (availability.state === 'missing') {
            const parts = [];
            if (availability.missingCharacters.length) parts.push(`각성체 ${availability.missingCharacters.length}명`);
            if (availability.missingBreakthroughs.length) parts.push(`돌파 ${availability.missingBreakthroughs.length}명`);
            if (availability.missingWheels.length) parts.push(`명륜 ${availability.missingWheels.length}개`);
            return `<p class="team-availability missing">부족: ${parts.join(' · ')}</p>`;
        }
        return '<p class="team-availability"><a href="inventory_checker.html">보유 현황 등록 후 구성 여부 확인</a></p>';
    }

    function renderMemberCard(member) {
        const character = state.characterMap.get(member.character_id);
        if (!character) return '';
        const wheels = (member.wheel_ids || []).map(id => state.wheelMap.get(id)).filter(Boolean);
        const covenant = state.covenantMap.get(member.covenant_id);
        const equipment = [
            ...wheels.map((wheel, index) => `<div class="community-equipment-item">
                <small>명륜 ${index + 1}</small>
                <img src="${wheel.image_path}" alt="" width="54" height="108" loading="lazy" onerror="this.src='images/placeholder.png';">
                <strong>${wheel.korean_name}</strong>
            </div>`),
            covenant ? `<div class="community-equipment-item covenant">
                <small>비밀계약</small>
                <img src="${covenant.image_path}" alt="" width="68" height="68" loading="lazy" onerror="this.src='images/placeholder.png';">
                <strong>${covenant.korean_name}</strong>
            </div>` : ''
        ].join('');
        return `<section class="community-member-card">
            <a class="community-member-identity" href="links.html?category=character&id=${encodeURIComponent(character.id)}">
                <img src="${character.image_thumb}" alt="" width="68" height="68" loading="lazy" onerror="this.src='images/smile_Ramona.webp';">
                <div><strong>${character.name}</strong><span>${member.breakthrough}</span></div>
            </a>
            <div class="community-member-equipment">${equipment}</div>
            ${renderMainStats(member.main_stats)}
            ${renderSubStats(member.sub_stats)}
        </section>`;
    }

    function renderMainStats(stats) {
        return `<div class="community-stat-block">
            <h3>비밀계약 주옵</h3>
            <div class="community-main-stats">${(stats || []).map((stat, index) => `
                <div class="community-main-stat"><small>${ROMAN[index] || index + 1}</small><span>${stat}</span></div>`).join('')}</div>
        </div>`;
    }

    function renderSubStats(stats) {
        return `<div class="community-stat-block">
            <h3>비밀계약 부옵</h3>
            <div class="community-sub-stats">${(stats || []).map(stat => `<span>${stat}</span>`).join('')}</div>
        </div>`;
    }

    function renderEditor() {
        const root = document.getElementById('team-editor-members');
        root.innerHTML = Array.from({ length: 4 }, (_, index) => renderEditorMember(index)).join('');
        root.addEventListener('change', event => {
            const member = event.target.closest('[data-editor-member]');
            if (member) updateEditorPreview(member);
            updateEditorProgress(root);
        });
        root.querySelectorAll('[data-editor-member]').forEach(updateEditorPreview);
        updateEditorProgress(root);
    }

    function optionList(items, valueKey, labelKey, placeholder) {
        return `<option value="">${placeholder}</option>${items.map(item => `<option value="${item[valueKey]}">${item[labelKey]}</option>`).join('')}`;
    }

    function statOptions(placeholder = '옵션 선택') {
        return `<option value="">${placeholder}</option>${STAT_OPTIONS.map(stat => `<option value="${stat}">${stat}</option>`).join('')}`;
    }

    function renderEditorMember(index) {
        return `<section class="team-editor-member" data-editor-member="${index}">
            <div class="team-editor-member-heading">
                <img class="team-editor-character-preview" data-character-preview alt="" src="images/placeholder.png" width="62" height="62">
                <div><h3>각성체 ${index + 1}</h3>
                    <label class="team-editor-field"><span>각성체</span><select required data-field="character_id">${optionList(state.characters, 'id', 'name', '각성체 선택')}</select></label>
                </div>
            </div>
            <div class="team-editor-grid">
                <label class="team-editor-field"><span>추천 돌파</span><select required data-field="breakthrough">${BREAKTHROUGHS.map(value => `<option value="${value}">${value}</option>`).join('')}</select></label>
                <label class="team-editor-field"><span>명륜 1</span><select required data-field="wheel_1">${optionList(state.wheels, 'english_name', 'korean_name', '명륜 선택')}</select></label>
                <label class="team-editor-field"><span>명륜 2</span><select required data-field="wheel_2">${optionList(state.wheels, 'english_name', 'korean_name', '명륜 선택')}</select></label>
                <label class="team-editor-field"><span>비밀계약</span><select required data-field="covenant_id">${optionList(state.covenants, 'english_name', 'korean_name', '비밀계약 선택')}</select></label>
                <div class="team-editor-equipment-preview wide" aria-label="선택한 장비 미리보기">
                    ${['wheel_1', 'wheel_2', 'covenant_id'].map((field, previewIndex) => `<div><small>${previewIndex < 2 ? `명륜 ${previewIndex + 1}` : '비밀계약'}</small><img data-equipment-preview="${field}" src="images/placeholder.png" alt="" width="54" height="68"><span data-equipment-name="${field}">선택 전</span></div>`).join('')}
                </div>
                <fieldset class="team-main-stats-fieldset"><legend>비밀계약 주옵</legend>
                    <div class="team-main-stats">${ROMAN.map((roman, statIndex) => `<label>${roman}<select required data-main-stat="${statIndex}">${statOptions()}</select></label>`).join('')}</div>
                </fieldset>
                <fieldset class="team-sub-stats-fieldset"><legend>비밀계약 부옵 · 복수 선택</legend>
                    <div class="team-sub-stats">${STAT_OPTIONS.map(stat => `<label class="team-sub-stat"><input type="checkbox" value="${stat}" data-sub-stat><span>${stat}</span></label>`).join('')}</div>
                </fieldset>
            </div>
        </section>`;
    }

    function updateEditorPreview(memberElement) {
        const characterId = memberElement.querySelector('[data-field="character_id"]')?.value;
        const character = state.characterMap.get(characterId);
        const preview = memberElement.querySelector('[data-character-preview]');
        preview.src = character?.image_thumb || 'images/placeholder.png';
        preview.alt = character ? `${character.name} 미리보기` : '';
        ['wheel_1', 'wheel_2'].forEach(field => {
            const id = memberElement.querySelector(`[data-field="${field}"]`)?.value;
            const item = state.wheelMap.get(id);
            updateEquipmentPreview(memberElement, field, item);
        });
        const covenantId = memberElement.querySelector('[data-field="covenant_id"]')?.value;
        updateEquipmentPreview(memberElement, 'covenant_id', state.covenantMap.get(covenantId));
    }

    function updateEquipmentPreview(memberElement, field, item) {
        const image = memberElement.querySelector(`[data-equipment-preview="${field}"]`);
        const name = memberElement.querySelector(`[data-equipment-name="${field}"]`);
        if (!image || !name) return;
        image.src = item?.image_path || 'images/placeholder.png';
        image.alt = item ? `${item.korean_name} 미리보기` : '';
        name.textContent = item?.korean_name || '선택 전';
    }

    function updateEditorProgress(root = document.getElementById('team-editor-members')) {
        const progress = document.getElementById('team-editor-progress');
        if (!root || !progress) return;
        const completed = [...root.querySelectorAll('[data-editor-member]')].filter(element => {
            const requiredSelects = [...element.querySelectorAll('select[required]')];
            return requiredSelects.every(select => Boolean(select.value))
                && element.querySelectorAll('[data-sub-stat]:checked').length > 0;
        }).length;
        progress.textContent = `입력 완료 ${completed}/4`;
    }

    function collectEditorTeam(root = document.getElementById('team-editor-members')) {
        const members = [...root.querySelectorAll('[data-editor-member]')].map(element => ({
            character_id: element.querySelector('[data-field="character_id"]').value,
            breakthrough: element.querySelector('[data-field="breakthrough"]').value,
            wheel_ids: [
                element.querySelector('[data-field="wheel_1"]').value,
                element.querySelector('[data-field="wheel_2"]').value
            ],
            covenant_id: element.querySelector('[data-field="covenant_id"]').value,
            main_stats: [...element.querySelectorAll('[data-main-stat]')].map(select => select.value),
            sub_stats: [...element.querySelectorAll('[data-sub-stat]:checked')].map(input => input.value)
        }));
        return { members };
    }

    function validateTeamPayload(payload, catalogs = {}) {
        const errors = [];
        const members = Array.isArray(payload?.members) ? payload.members : [];
        if (members.length !== 4) errors.push('각성체 4명을 모두 선택해 주세요.');
        const characterIds = members.map(member => member.character_id).filter(Boolean);
        if (new Set(characterIds).size !== characterIds.length) errors.push('같은 각성체를 중복해서 선택할 수 없습니다.');
        members.forEach((member, index) => {
            const label = `각성체 ${index + 1}`;
            if (!member.character_id) errors.push(`${label}을 선택해 주세요.`);
            if (catalogs.characters && !catalogs.characters.has(member.character_id)) errors.push(`${label} 정보가 올바르지 않습니다.`);
            if (!BREAKTHROUGHS.includes(member.breakthrough)) errors.push(`${label}의 추천 돌파를 확인해 주세요.`);
            if (!Array.isArray(member.wheel_ids) || member.wheel_ids.length !== 2 || member.wheel_ids.some(id => !id)) errors.push(`${label}의 명륜 2개를 선택해 주세요.`);
            if (new Set(member.wheel_ids || []).size !== (member.wheel_ids || []).length) errors.push(`${label}의 명륜이 중복되었습니다.`);
            if (catalogs.wheels && (member.wheel_ids || []).some(id => !catalogs.wheels.has(id))) errors.push(`${label}의 명륜 정보가 올바르지 않습니다.`);
            if (!member.covenant_id || (catalogs.covenants && !catalogs.covenants.has(member.covenant_id))) errors.push(`${label}의 비밀계약을 확인해 주세요.`);
            if (!Array.isArray(member.main_stats) || member.main_stats.length !== 6 || member.main_stats.some(stat => !STAT_OPTIONS.includes(stat))) errors.push(`${label}의 주옵 6개를 모두 선택해 주세요.`);
            if (!Array.isArray(member.sub_stats) || member.sub_stats.length === 0 || member.sub_stats.some(stat => !STAT_OPTIONS.includes(stat))) errors.push(`${label}의 부옵을 하나 이상 선택해 주세요.`);
        });
        return unique(errors);
    }

    async function submitTeam(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('[type="submit"]');
        const status = document.getElementById('team-submit-status');
        const payload = collectEditorTeam();
        const errors = validateTeamPayload(payload, {
            characters: new Set(state.characterMap.keys()),
            wheels: new Set(state.wheelMap.keys()),
            covenants: new Set(state.covenantMap.keys())
        });
        if (errors.length) {
            status.textContent = errors[0];
            status.style.color = '#e0a0a0';
            return;
        }
        button.disabled = true;
        status.textContent = '조합을 등록하는 중입니다.';
        status.style.color = '#ffc107';
        try {
            const endpoint = `${String(CONFIG.FEEDBACK_ENDPOINT_URL || '').replace(/\/$/, '')}/team-compositions`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
            status.textContent = result.duplicate
                ? '이미 등록된 조합입니다.'
                : '등록되었습니다. 정적 사이트 반영까지 잠시 걸릴 수 있습니다.';
            status.style.color = result.duplicate ? '#ffd36a' : '#8bd4a2';
            if (!result.duplicate) form.reset();
            document.querySelectorAll('[data-editor-member]').forEach(updateEditorPreview);
            updateEditorProgress();
        } catch (error) {
            status.textContent = `등록 실패: ${error.message}`;
            status.style.color = '#e0a0a0';
        } finally {
            button.disabled = false;
        }
    }

    function unique(values) { return [...new Set(values)]; }

    return {
        initialize,
        BREAKTHROUGHS,
        STAT_OPTIONS,
        normalizeTeamCollection,
        readInventory,
        getTeamAvailability,
        getRequiredBreakthroughLevel,
        validateTeamPayload
    };
});
