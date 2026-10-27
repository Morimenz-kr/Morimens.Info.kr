(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CharacterCatalogUI = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    const RELEMS_LABELS = { chaos: '혼돈', aequor: '심해', caro: '혈육', ultra: '초차원' };
    const RELEMS_ORDER = ['chaos', 'aequor', 'caro', 'ultra'];
    const CLASS_OPTIONS = [['all', '전체 역할'], ['assault', '공격형'], ['warden', '방어형'], ['chorus', '보조형']];
    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function renderCharacterCard(character, { href, selected = false, title = character.name, extraMarkup = '' } = {}) {
        const tag = href ? 'a' : 'div';
        const action = href ? `href="${escapeHtml(href)}"` : `role="button" tabindex="0" aria-pressed="${selected}"`;
        return `<${tag} ${action} class="inventory-card character-inventory-card ${selected ? 'selected' : ''}"
                data-character-id="${escapeHtml(character.id)}" title="${escapeHtml(title)}">
            ${href ? '' : '<span class="check-mark">✓</span>'}
            <img src="${escapeHtml(character.image_thumb)}" alt="${escapeHtml(character.name)}" loading="lazy" onerror="this.src='images/smile_Ramona.webp'">
            <span class="inventory-card-name">${escapeHtml(character.name)}</span>
            ${extraMarkup}
        </${tag}>`;
    }
    function renderGroups(characters, renderCard = renderCharacterCard) {
        return RELEMS_ORDER.map(relems => ({ relems, characters: characters.filter(character => character.relems === relems) }))
            .filter(group => group.characters.length).map(group => `
                <section class="relems-section ${escapeHtml(group.relems)}" aria-label="${escapeHtml(RELEMS_LABELS[group.relems])}">
                    <div class="relems-section-title">${escapeHtml(RELEMS_LABELS[group.relems])}</div>
                    <div class="relems-character-grid">${group.characters.map(character => renderCard(character)).join('')}</div>
                </section>`).join('');
    }
    function renderFilterOptions(options, attribute, selected = 'all') {
        return options.map(([value, label]) => `<button type="button" class="filter-pill${value === selected ? ' active' : ''}" ${attribute}="${escapeHtml(value)}" aria-pressed="${value === selected}">${escapeHtml(label)}</button>`).join('');
    }
    function setActiveFilter(container, attribute, value) {
        container.querySelectorAll(`[${attribute}]`).forEach(button => {
            const active = button.getAttribute(attribute) === value;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }
    function bindFilterGroup(container, attribute, onChange) {
        container.addEventListener('click', event => {
            const button = event.target.closest(`[${attribute}]`);
            if (button && container.contains(button)) {
                setActiveFilter(container, attribute, button.getAttribute(attribute));
                onChange(button.getAttribute(attribute));
            }
        });
    }
    return { RELEMS_LABELS, RELEMS_ORDER, CLASS_OPTIONS, renderCharacterCard, renderGroups, renderFilterOptions, setActiveFilter, bindFilterGroup };
});
