import { escapeUsage as esc } from './character-usage-view.mjs';

const roman = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'];
const number = value => Number(value || 0).toLocaleString('ko-KR');
const percent = value => `${(Math.max(0,Math.min(1,Number(value)||0))*100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
const optionKey = option => `${option.id}:${option.unit || ''}`;
// Same attribute IDs and original assets as covenant-editor.mjs / covenant_simulator.js.
const iconIds = {18159:'008',18105:'007',18126:'002',18142:'004',22207:'003',18139:'005',18155:'001',18151:'006'};
const statIcon = option => iconIds[option.id] ? `<img class="usage-stat-option-icon" src="images/keyword-icons/original/ui_battle_white_buff_${iconIds[option.id]}.png" width="14" height="14" alt="" aria-hidden="true">` : '';

/** The displayed contract's options cover all wheel pairs. Each ranking has its own selection. */
export function renderStatisticalSettings({ contractGroups, wheelGroups, equipmentSelection, wheelMap, covMap, wheelName, covName }) {
    const wheelRanks = wheelGroups.slice(0, 5);
    const contractRanks = contractGroups.slice(0, 3);
    const contract = contractRanks.find(group => group.key === equipmentSelection.covenant) || contractRanks[0];
    const wheelPair = wheelRanks.find(group => group.key === equipmentSelection.wheel) || wheelRanks[0];
    const contractName = group => group.sets.map(({ id, count }) =>
        group.sets.length > 1 ? `${covName(id)} ${count}부위` : covName(id)).join(' + ');

    const equipmentArt = (id, kind) => {
        const isWheel = kind === 'wheel';
        const item = isWheel ? wheelMap[id] : covMap[id];
        const name = isWheel ? wheelName(id) : covName(id);
        const image = item ? `<img src="${esc(item.image_path)}" alt="" width="${isWheel ? 128 : 500}" height="${isWheel ? 192 : 400}">` : '';
        const art = isWheel ? image : `<span class="usage-stat-covenant-surface">${image}</span>`;
        return `<button type="button" class="usage-stat-art" data-equipment="${esc(id)}" data-kind="${kind}" aria-label="${esc(name)} 상세" ${item ? '' : 'disabled'}>${item ? `<span class="usage-stat-art-frame">${art}</span>` : '<span class="usage-stat-missing-art">이미지 없음</span>'}<span>${esc(name)}</span></button>`;
    };
    const ranking = (groups, label, name, kind, selected) => `<ol class="usage-equipment-ranks" aria-label="${label}">${groups.map((group, index) =>
        `<li><button type="button" id="usage-rank-${kind}-${index}" data-rank-key="${esc(group.key)}" data-rank-kind="${kind}" aria-pressed="${group === selected}"><span class="usage-equipment-rank" aria-hidden="true">${index + 1}</span><span>${esc(name(group))}</span><b>${percent(group.rate)}</b></button></li>`).join('')}</ol>`;

    return `<section class="usage-stat-settings" aria-label="장비별 세팅 통계">
        <div class="usage-equipment-sections">
            <section class="usage-equipment-section" data-equipment-section="wheels">
                <header><h4>명륜 Top 5</h4></header>
                ${wheelPair ? `<div class="usage-equipment-content">
                    <div class="usage-stat-wheel-pair">${wheelPair.ids.map(id => equipmentArt(id, 'wheel')).join('')}</div>
                    ${ranking(wheelRanks, '명륜 조합 채용 순위', group => group.ids.map(wheelName).join(' + '), 'wheel', wheelPair)}
                </div>` : '<p class="usage-stat-empty">명륜 두 장이 확인된 기록이 없습니다.</p>'}
            </section>
            <section class="usage-equipment-section usage-stat-equipment" data-equipment-section="covenants">
                <header><h4>비밀계약 Top 3</h4></header>
                ${contract ? `<div class="usage-equipment-content">
                    <div class="usage-stat-contract-art">${contract.sets.map(({ id, count }) => `<div>${equipmentArt(id, 'covenant')}${contract.sets.length > 1 ? `<small>${count}부위</small>` : ''}</div>`).join('')}</div>
                    ${ranking(contractRanks, '비밀계약 채용 순위', contractName, 'covenant', contract)}
                </div>
                <section class="usage-stat-distributions" aria-label="${esc(contractName(contract))} 옵션 채용률">${renderOptions(contract.options)}</section>` : '<p class="usage-stat-empty">비밀계약 기록이 없습니다.</p>'}
            </section>
        </div>
    </section>`;
}

function renderOptions({ slots, subs, total }) {
    if (!total) return '<p class="usage-stat-empty">이 비밀계약에 완성도 90% 이상인 기록이 없습니다.</p>';

    const rates = options => {
        if (!options.length) return '<p class="usage-stat-no-options">집계할 옵션이 없습니다.</p>';
        const ordered = [...options].sort((a, b) => b.rate - a.rate || optionKey(a).localeCompare(optionKey(b)));
        return `<ul class="usage-stat-rates">${ordered.map(option => `<li data-stat-option="${esc(optionKey(option))}"><span class="usage-stat-option-name">${statIcon(option)}<span>${esc(option.label)}</span></span><span class="usage-stat-rate${option.rate === ordered[0].rate ? ' is-leading' : ''}">${percent((option.percentTenths ?? option.rate * 1000) / 1000)}</span></li>`).join('')}</ul>`;
    };
    const slotRates = (slot, kind) => slots.find(entry => entry.slot === slot)?.[kind] || [];
    const slotRows = kind => `<ol class="usage-stat-main-rows">${roman.map((label, index) => `<li class="usage-stat-main-row" data-stat-slot="${index + 1}"><h6>${label}</h6>${rates(slotRates(index + 1, kind))}</li>`).join('')}</ol>`;
    const optionSection = (kind, title, preview, content) => `<section class="usage-stat-section"><details class="usage-stat-option-disclosure" id="usage-stat-${kind}-options"><summary aria-label="${title} 자세히 보기"><h5><span>${title}</span></h5><span class="usage-stat-option-action">자세히 보기<span class="usage-stat-chevron" aria-hidden="true"></span></span></summary><div class="usage-stat-${kind}stats">${content}</div></details><div class="usage-stat-option-preview">${preview}</div></section>`;
    const mainPreview = `<ol class="usage-stat-leading-slots">${roman.map((label, index) => {
        const top = slotRates(index + 1, 'main').slice(0, 1);
        return `<li data-leading-slot="${index + 1}"><span class="usage-stat-leading-slot">${label}</span><div>${rates(top)}</div></li>`;
    }).join('')}</ol>`;
    const subShown = subs.slice(0, 3);
    const subPreview = `<div class="usage-stat-leading-sub">${rates(subShown)}</div>`;
    const slotSubs = `<details class="usage-stat-slot-details"><summary>부위별 부옵션</summary>${slotRows('subs')}</details>`;
    return `<div class="usage-stat-overview usage-stat-summary">
        ${optionSection('main', '주옵션 채용률', mainPreview, slotRows('main'))}
        ${optionSection('sub', '부옵션 채용률', subPreview, rates(subs) + slotSubs)}
    </div><p class="usage-stat-basis usage-stat-details-basis">비밀계약 완성도 90% 이상 ${number(total)}건 기준 · 부옵션 비중은 기록된 전체 부옵션 줄 기준</p>`;
}
