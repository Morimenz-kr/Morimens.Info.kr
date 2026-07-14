export const RELEMS_LABELS = Object.freeze({
    chaos: '혼돈',
    aequor: '심해',
    caro: '혈육',
    ultra: '초차원'
});

export const RELEMS_ORDER = Object.freeze(Object.keys(RELEMS_LABELS));

export const CHARACTER_CLASS_LABELS = Object.freeze({
    assault: '공격형',
    warden: '방어형',
    chorus: '보조형'
});

export const CHARACTER_CLASS_ORDER = Object.freeze(Object.keys(CHARACTER_CLASS_LABELS));

export function getTaxonomyLabel(labels, id, fallback = '') {
    const key = String(id || '').trim();
    return labels[key] || fallback || key;
}
