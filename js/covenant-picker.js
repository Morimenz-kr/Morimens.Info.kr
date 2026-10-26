/* Shared by the covenant simulator and calculator; keep one contract renderer. */
(() => {
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    function render({grid, contracts, selected, onSelect}) {
        grid.innerHTML = contracts.map(contract => `
            <button type="button" class="contract-card ${contract.english_name === selected ? 'active' : ''}" data-contract="${escapeHtml(contract.english_name)}" aria-pressed="${contract.english_name === selected}">
                <img src="${escapeHtml(contract.image_path)}" alt="">
                <span class="contract-card-name">${escapeHtml(contract.korean_name)}</span>
            </button>
        `).join('');
        grid.querySelectorAll('[data-contract]').forEach(button => {
            button.addEventListener('click', () => onSelect(button.dataset.contract));
        });
    }
    window.CovenantPicker = {render};
})();
