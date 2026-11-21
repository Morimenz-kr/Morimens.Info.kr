import { escapeUsage as esc } from './character-usage-view.mjs';

const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
const number = value => Number(value || 0).toLocaleString('ko-KR');
const percent = value => `${(Math.max(0, Math.min(1, Number(value) || 0)) * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
const optionKey = option => `${option.id}:${option.unit || ''}`;

/** Contract-conditioned adoption rates; exact rolls belong in the record detail. */
export function renderStatisticalSettings({ groups = [], selectedKeys = [], compare = false, wheelMap = {}, covMap = {}, wheelName = id => id, covName = id => id }) {
    if (!groups.length) return '<section class="usage-stat-empty"><p>조건에 맞는 비밀계약 기록이 없습니다.</p></section>';
    const first = groups.find(group => group.key === selectedKeys[0]) || groups[0];
    const second = groups.find(group => group.key === selectedKeys[1] && group !== first) || groups.find(group => group !== first);
    const selected = compare && second ? [first, second] : [first];
    const comparing = selected.length === 2;
    const contractName = group => group.sets.map(set => `${covName(set.id)} ${set.count}세트`).join(' + ');
    const imageButton = (id, kind, caption = true) => {
        const item = kind === 'wheel' ? wheelMap[id] : covMap[id];
        const name = kind === 'wheel' ? wheelName(id) : covName(id);
        return `<button type="button" class="usage-stat-art" data-equipment="${esc(id)}" data-kind="${kind}" aria-label="${esc(name)} 상세" ${item ? '' : 'disabled'}>${item ? `<picture class="usage-stat-art-frame"><img src="${esc(item.image_path)}" alt="" width="128" height="192" loading="lazy"></picture>` : '<span class="usage-stat-missing-art">이미지 없음</span>'}${caption ? `<span>${esc(name)}</span>` : ''}</button>`;
    };
    const columns = selected.map((group, column) => `<section class="usage-stat-equipment" data-stat-group="${esc(group.key)}"><header class="usage-stat-equipment-heading"><label for="usage-stat-contract-${column}"><span>${comparing ? `세팅 ${column + 1}` : '비밀계약'}</span><select id="usage-stat-contract-${column}" data-stat-setting-column="${column}">${groups.map(candidate => `<option value="${esc(candidate.key)}" ${candidate === group ? 'selected' : ''}>${esc(contractName(candidate))}</option>`).join('')}</select></label>${column === 0 && second ? `<button type="button" id="usage-stat-compare" class="usage-stat-text-button" data-stat-compare aria-pressed="${comparing}" aria-controls="usage-stat-distributions">${comparing ? '비교 닫기' : '비교'}</button>` : ''}</header><div class="usage-stat-artwork"><div class="usage-stat-wheel-pair">${group.wheels?.length ? group.wheels.map(id => imageButton(id, 'wheel')).join('') : `<p class="usage-stat-unavailable">${group.wheelPairs?.[0]?.key === '__unequipped__' ? '명륜 미장착' : '명륜 미확인'}</p>`}</div><div class="usage-stat-contract-art">${group.sets.map(set => `<div>${imageButton(set.id, 'covenant', group.sets.length > 1)}${group.sets.length > 1 ? `<small>${set.count}세트</small>` : ''}</div>`).join('')}<p class="usage-stat-adoption">채용 <strong>${percent(group.rate)}</strong></p></div></div></section>`).join('');

    // Use a shared list in comparison mode so option labels never repeat across columns.
    const rates = (lists, denominators, { limit = Infinity, slot = '' } = {}) => {
        const maps = lists.map(list => new Map(list.map(option => [optionKey(option), option])));
        const peaks = lists.map(list => Math.max(0,...list.map(option=>option.rate)));
        const union = new Map();
        lists.flat().forEach(option => union.set(optionKey(option), option));
        const ordered = [...union].sort(([a], [b]) => Math.max(...maps.map(map => map.get(b)?.rate || 0)) - Math.max(...maps.map(map => map.get(a)?.rate || 0)) || a.localeCompare(b));
        if (!ordered.length) return '<p class="usage-stat-no-options">집계할 옵션이 없습니다.</p>';
        const rows = ordered.map(([key, option]) => `<li data-stat-option="${esc(key)}"><span class="usage-stat-option-name">${esc(option.label)}</span>${maps.map((map, column) => `<span class="usage-stat-rate${peaks[column] > 0 && (map.get(key)?.rate || 0) === peaks[column] ? ' is-leading' : ''}" ${comparing ? `aria-label="세팅 ${column + 1} ${denominators[column] ? percent(map.get(key)?.rate || 0) : '자료 없음'}"` : ''}>${denominators[column] ? percent(map.get(key)?.rate || 0) : '<span title="집계 자료 없음">-</span>'}</span>`).join('')}</li>`);
        const headings = comparing ? '<div class="usage-stat-rate-labels" aria-hidden="true"><span>옵션</span><span>세팅 1</span><span>세팅 2</span></div>' : '';
        const more = rows.length > limit ? `<details class="usage-stat-more"><summary>${rows.length - limit}개 더 보기</summary><ul class="usage-stat-rates">${rows.slice(limit).join('')}</ul></details>` : '';
        return `${headings}<ul class="usage-stat-rates" ${slot ? `aria-label="${slot} 채용률"` : ''}>${rows.slice(0, limit).join('')}</ul>${more}`;
    };
    const totals = selected.map(group => group.options?.total || 0);
    const slotCards = kind => roman.map((label, index) => {
        const lists = selected.map(group => group.options?.slots.find(slot => slot.slot === index + 1)?.[kind] || []);
        return `<section class="usage-stat-slot" data-stat-slot="${index + 1}"><h6>${label}</h6>${rates(lists, totals, { limit: Infinity, slot: `${label} 부위 ${kind === 'main' ? '주옵' : '부옵'}` })}</section>`;
    }).join('');
    const hasOptions = totals.some(total => total > 0);
    const criteria = comparing
        ? `완성도 90% 이상: 세팅 1 ${number(totals[0])}건 · 세팅 2 ${number(totals[1])}건`
        : `완성도 90% 이상 ${number(totals[0])}건`;
    return `<section class="usage-stat-settings ${comparing ? 'is-comparing' : ''}" aria-label="비밀계약별 세팅 통계"><div class="usage-stat-equipment-grid">${columns}</div><div id="usage-stat-distributions" class="usage-stat-distributions">${hasOptions ? `<section class="usage-stat-section"><h5>주옵 채용률</h5><div class="usage-stat-main-grid">${slotCards('main')}</div></section><section class="usage-stat-section usage-stat-substats"><h5>부옵 채용률</h5>${rates(selected.map(group => group.options?.subs || []), totals)}</section><details class="usage-stat-slot-details"><summary>부위별 부옵</summary><div class="usage-stat-main-grid">${slotCards('subs')}</div></details>` : '<p class="usage-stat-empty">완성도 90% 이상인 비밀계약 기록이 없어 옵션 채용률을 집계할 수 없습니다.</p>'}<p class="usage-stat-basis">계약 채용률: 비밀계약 확인 ${number(first.knownCount || groups.reduce((sum, group) => sum + group.count, 0))}건 기준<br>${criteria}<br>부옵은 6부위 중 한 번 이상 채용한 비율입니다.</p></div></section>`;
}
