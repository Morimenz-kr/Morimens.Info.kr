import { enlightenmentLabel } from './character-usage-model.mjs';
export const escapeUsage = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
export const statText = s => `${escapeUsage(s.label)} ${n(s.value)}${escapeUsage(s.unit)}`;
export function optionTotals(parts) {
    const sums = new Map();
    parts.flatMap(p => [p.main, ...p.subs]).forEach(s => { const key = `${s.id}:${s.unit}`; const v = sums.get(key) || { ...s, value: 0 }; v.value += s.value; sums.set(key, v); });
    return [...sums.values()].map(statText).join(' · ');
}
// Shared by character usage records and the existing party builder.
export function memberDetails(m, { name, covName, equipment, open = false }) {
    const esc = escapeUsage;
    return `<details class="site-disclosure" ${open ? 'open' : ''}><summary>${esc(name(m.characterId))} · ${enlightenmentLabel(m.enlightenment)}${m.borrowed ? ' · 지원' : ''}</summary><div class="usage-equipment-pair">${m.wheels?.length === 0 ? '<p>장착한 명륜 없음</p>' : m.wheels ? m.wheels.map(w => `<div>${equipment(w.id, 'wheel')}<p>${w.level === null ? '강화 미수집' : `강화 ${w.level}`} · 돌파 미수집</p></div>`).join('') : '<p>명륜 미수집</p>'}</div>${m.covenant ? `<p>비밀계약 완성도 ${m.covenant.completion === null ? '미수집' : `${n(m.covenant.completion)}%`}</p><div class="usage-option-grid">${m.covenant.parts.map(p => `<section><h5>${roman[p.slot - 1]} · ${esc(covName(p.setId))}</h5><p>주옵: ${statText(p.main)}</p><p>부옵: ${p.subs.map(statText).join(' · ') || '없음'}</p></section>`).join('')}</div><p class="usage-muted">옵션 합계: ${optionTotals(m.covenant.parts)}</p>` : '<p class="usage-muted">비밀계약 옵션 미수집</p>'}</details>`;
}
