(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CharacterFilterUI = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    const CLASS_OPTIONS = [['all', '전체 역할'], ['assault', '공격형'], ['warden', '방어형'], ['chorus', '보조형']];
    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    return { CLASS_OPTIONS, renderFilterOptions, setActiveFilter, bindFilterGroup };
});
