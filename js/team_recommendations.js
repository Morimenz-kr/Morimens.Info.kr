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
    const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
    const state = {
        characters: [], wheels: [], covenants: [], teams: [],
        characterMap: new Map(), wheelMap: new Map(), covenantMap: new Map(),
        inventory: { registered: false, characters: new Set(), wheels: new Set(), characterBreakthroughs: {} }
    };

    async function initialize() {
        const list = document.getElementById('team-list');
        if (!list) return;
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
            renderTeams();
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
        const missingCharacters = unique(team.members.map(member => member.character_id).filter(id => !inventory.characters.has(String(id))));
        const missingWheels = unique(team.members.flatMap(member => member.wheel_ids || []).filter(id => !inventory.wheels.has(String(id))));
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
            return (!query || names.includes(query)) && (!ownedOnly || getTeamAvailability(team).state === 'complete');
        });
        summary.textContent = `전체 ${state.teams.length}개 중 ${filtered.length}개 조합`;
        list.innerHTML = filtered.length
            ? filtered.map((team, index) => renderTeamCard(team, index)).join('')
            : '<div class="community-team-empty">조건에 맞는 조합이 없습니다.</div>';
    }

    function renderTeamCard(team, index) {
        return `<article class="community-team-card">
            <header class="community-team-heading"><h2>추천 조합 ${index + 1}</h2>${renderAvailability(getTeamAvailability(team))}</header>
            <div class="community-team-members">${team.members.map(renderMemberCard).join('')}</div>
        </article>`;
    }

    function renderAvailability(availability) {
        if (availability.state === 'complete') return '<p class="team-availability complete">지금 보유 현황으로 구성 가능</p>';
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
        return `<section class="community-member-card">
            <a class="community-member-identity" href="links.html?category=character&id=${encodeURIComponent(character.id)}">
                <img src="${character.image_thumb}" alt="" width="68" height="68" loading="lazy" onerror="this.src='images/smile_Ramona.webp';">
                <div><strong>${character.name}</strong><span>${member.breakthrough}</span></div>
            </a>
            <div class="community-member-equipment">
                ${wheels.map((wheel, index) => renderEquipment(wheel, `명륜 ${index + 1}`, false)).join('')}
                ${covenant ? renderEquipment(covenant, '비밀계약', true) : ''}
            </div>
            ${renderMainStats(member.main_stats)}${renderSubStats(member.sub_stats)}
        </section>`;
    }

    function renderEquipment(item, label, covenant) {
        return `<div class="community-equipment-item${covenant ? ' covenant' : ''}"><small>${label}</small>
            <img src="${item.image_path}" alt="" width="${covenant ? 68 : 54}" height="68" loading="lazy" onerror="this.src='images/placeholder.png';">
            <strong>${item.korean_name}</strong></div>`;
    }

    function renderMainStats(stats) {
        return `<div class="community-stat-block"><h3>비밀계약 주옵</h3><div class="community-main-stats">${(stats || []).map((stat, index) =>
            `<div class="community-main-stat"><small>${ROMAN[index] || index + 1}</small><span>${stat}</span></div>`).join('')}</div></div>`;
    }

    function renderSubStats(stats) {
        return `<div class="community-stat-block"><h3>비밀계약 부옵</h3><div class="community-sub-stats">${(stats || []).map(stat => `<span>${stat}</span>`).join('')}</div></div>`;
    }

    function unique(values) { return [...new Set(values)]; }

    return { initialize, normalizeTeamCollection, readInventory, getTeamAvailability, getRequiredBreakthroughLevel };
});
