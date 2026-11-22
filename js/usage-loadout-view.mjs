import { escapeUsage as esc } from './character-usage-view.mjs';

const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
const statLine = stat => `<span class="usage-stat-name">${esc(stat.label)}</span> <span class="usage-stat-value">${stat.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${esc(stat.unit)}</span>`;
export const potentialText = value => value == null ? '잠재력 미확인' : `잠재력 ${value}`;

// Every value belongs to one observed loadout. No averaged or synthesized options.
export function loadoutDetails(member, { wheelMap, covMap, wheelName, covName, compare = null, optionsControl = '' }) {
    const equipment = (id, kind, level) => {
        const item = kind === 'wheel' ? wheelMap[id] : covMap[id];
        const name = kind === 'wheel' ? wheelName(id) : covName(id);
        return `<button type="button" class="usage-loadout-art" data-equipment="${esc(id)}" data-kind="${kind}" ${item ? '' : 'disabled'}>${item ? `<img src="${esc(item.image_path)}" alt="" width="120" height="160" loading="lazy">` : ''}<span>${esc(name)}</span>${level == null ? '' : `<small>Lv.${level}</small>`}</button>`;
    };
    const sets = new Map();
    for (const part of member.covenant?.parts || []) sets.set(part.setId, (sets.get(part.setId) || 0) + 1);
    const mixed = sets.size > 1;
    return `<div class="usage-loadout-gear"><div class="usage-loadout-wheels">${member.wheels === null ? '<p class="usage-muted">명륜 비공개</p>' : member.wheels.length ? member.wheels.map(w => equipment(w.id, 'wheel', w.level)).join('') : '<p class="usage-muted">명륜 미장착</p>'}</div><div class="usage-loadout-contracts">${[...sets].map(([id,count]) => `<div>${equipment(id,'covenant')}${mixed ? `<small>${count}부위</small>` : ''}</div>`).join('') || '<p class="usage-muted">비밀계약 비공개</p>'}</div></div>
        ${optionsControl}${member.covenant ? `<div class="usage-loadout-options">${member.covenant.parts.map(part => {
            const other = compare?.covenant?.parts.find(p => p.slot === part.slot);
            const differs = other && JSON.stringify([part.setId, part.main, part.subs]) !== JSON.stringify([other.setId, other.main, other.subs]);
            return `<section class="usage-loadout-part${differs ? ' is-different' : ''}" data-slot="${part.slot}" data-covenant-id="${esc(part.setId)}"><h5>${roman[part.slot - 1]}${mixed ? ` <span>${esc(covName(part.setId))}</span>` : ''}${differs ? '<small>다름</small>' : ''}</h5><p class="usage-loadout-main"><span class="usage-option-label">주옵</span><strong data-example-main>${statLine(part.main)}</strong></p><div class="usage-loadout-subs"><span class="usage-option-label">부옵</span><ul>${part.subs.map(stat => `<li>${statLine(stat)}</li>`).join('') || '<li>없음</li>'}</ul></div></section>`;
        }).join('')}</div>` : ''}`;
}
