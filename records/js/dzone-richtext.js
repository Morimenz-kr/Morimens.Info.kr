(function (root) {
    'use strict';
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    // Only generator-issued reference keys receive tooltips. Ordinary Korean words
    // (e.g. HP 소모, 방어막 보유) are never matched against the global card glossary.
    function render(source, glossary, transformText = value => value) {
        const wrapped = String(source).match(/^<game-text:([\s\S]*)>$/);
        if (!wrapped) return escapeHtml(transformText(source));
        let output = '', cursor = 0;
        const regex = /<(kw_[a-f0-9]{16}):([^<>]*)>/g;
        for (const match of wrapped[1].matchAll(regex)) {
            output += escapeHtml(transformText(wrapped[1].slice(cursor, match.index)));
            const item = glossary?.[match[1]];
            const label = escapeHtml(match[2]);
            if (!item) throw new Error(`Missing generated tooltip ${match[1]}`);
            const icon = /^images\/keyword-icons\/inline\/[a-z0-9_]+\.png$/.test(item.icon || '')
                ? `<img class="keyword-icon" src="${escapeHtml(item.icon)}" alt="" aria-hidden="true">` : '';
            const color = /^#[a-f0-9]{6}$/i.test(item.color || '') ? ` style="color:${item.color}"` : '';
            output += `<strong class="tooltip-trigger${icon ? ' keyword-iconized' : ''}" data-keyword="${match[1]}" tabindex="0"${color}>${icon}<span>${label}</span></strong>`;
            cursor = match.index + match[0].length;
        }
        return output + escapeHtml(transformText(wrapped[1].slice(cursor)));
    }
    const api = { render };
    if (typeof module !== 'undefined') module.exports = api;
    else root.DzoneRichText = api;
})(typeof window === 'undefined' ? globalThis : window);
