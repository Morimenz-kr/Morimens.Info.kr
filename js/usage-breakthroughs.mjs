const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sources = { chaos: '혼돈편', aequor: '심해편', caro: '혈육편', ultra: '초차원편' };

// Preserve each guide's setting scope and wording. Usage frequency is never an input.
export function guideBreakthroughs(settings) {
    const groups = new Map();
    for (const row of Array.isArray(settings) ? settings : settings ? [settings] : []) {
        const step = typeof row.recommendStep === 'string' ? row.recommendStep.trim() : '';
        if (!step || /^(?:-|미정|미등록)$/.test(step)) continue;
        const source = sources[row.settings_source] || '';
        const key = JSON.stringify([step, source]);
        if (!groups.has(key)) groups.set(key, { step, source, settings: [] });
        const name = row.settingName?.trim() || '기존 세팅';
        if (!groups.get(key).settings.includes(name)) groups.get(key).settings.push(name);
    }
    return [...groups.values()];
}

export function renderGuideBreakthroughs(settings) {
    const rows = guideBreakthroughs(settings);
    if (!rows.length) return '';
    return `<section class="usage-breakthroughs" aria-label="추천 돌파">
        <header><h4>추천 돌파</h4><span>기존 공략 세팅 기준</span></header>
        <dl>${rows.map(row => `<div><dt>${esc(row.settings.join(' · '))}</dt><dd><strong>${esc(row.step)}</strong>${row.source ? `<span>${esc(row.source)} 세팅</span>` : ''}</dd></div>`).join('')}</dl>
    </section>`;
}
