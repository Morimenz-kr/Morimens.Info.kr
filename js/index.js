document.addEventListener('DOMContentLoaded', async () => {
    const ui = window.CharacterCatalogUI;
    const grid = document.getElementById('character-grid');
    const search = document.getElementById('search-bar');
    const count = document.getElementById('catalog-count');
    const filters = { grade: 'all', relems: 'all', class: 'all', search: '' };
    let characters = [], classification;
    const options = {
        grade: [['all', '전체 등급'], ['ssr', 'SSR'], ['상시 SSR', '상시 SSR'], ['한정 SSR', '한정 SSR'], ['sr', 'SR']],
        relems: [['all', '전체 계역'], ...ui.RELEMS_ORDER.map(id => [id, ui.RELEMS_LABELS[id]])],
        class: ui.CLASS_OPTIONS
    };
    function render() {
        if (!classification) return;
        const visible = characters.filter(character => {
            const release = classification.characterGrade(character);
            const text = [character.name, ...(character.name_aliases || [])].join(' ');
            return (filters.grade === 'all' || character.grade === filters.grade || release === filters.grade)
                && (filters.relems === 'all' || character.relems === filters.relems)
                && (filters.class === 'all' || character.class === filters.class)
                && (!filters.search || window.SearchUtils.matchesSearchText(text, filters.search));
        });
        grid.innerHTML = visible.length ? ui.renderGroups(visible, character => ui.renderCharacterCard(character, {
            href: 'links.html?category=character&id=' + encodeURIComponent(character.id)
        })) : '<p class="empty-selection">검색 조건에 맞는 각성체가 없습니다.</p>';
        count.textContent = visible.length + ' / ' + characters.length;
    }
    for (const [key, values] of Object.entries(options)) {
        const container = document.getElementById(key + '-filters');
        const attribute = 'data-' + key + '-filter';
        container.innerHTML = ui.renderFilterOptions(values, attribute);
        ui.bindFilterGroup(container, attribute, value => { filters[key] = value; render(); });
    }
    search.addEventListener('input', event => { filters.search = event.target.value.trim(); render(); });
    try {
        const [manifest, groups] = await Promise.all(['character_manifest', 'gachatype'].map(async name => {
            const response = await fetch('data/' + name + '.json?t=' + Date.now(), { cache: 'no-store' });
            if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
            return response.json();
        }));
        characters = manifest;
        classification = window.SummonClassification.create(groups);
        render();
    } catch (error) {
        console.error('캐릭터 목록 로드 실패:', error);
        grid.innerHTML = '<p class="empty-selection">캐릭터 목록을 불러오는 데 실패했습니다.</p>';
    }
});
