(function (root) {
    'use strict';
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    // Only generator-issued reference keys receive tooltips. Ordinary Korean words
    // (e.g. HP 소모, 방어막 보유) are never matched against the global card glossary.
    function render(source, glossary, transformText = value => value) {
        const wrapped = String(source).match(/^<game-text:([\s\S]*)>$/);
        if (!wrapped) return escapeHtml(transformText(source));
        function renderNodes(text, depth = 0) {
            if (depth > 32) throw new Error('Generated game text nesting is too deep');
            let output = '', cursor = 0;
            const regex = /<(kw_[a-f0-9]{16}|fmt_[a-f0-9]{6}):/g;
            for (let match; (match = regex.exec(text));) {
                output += escapeHtml(transformText(text.slice(cursor, match.index)));
                let end = regex.lastIndex, balance = 1;
                for (; end < text.length && balance; end++) {
                    if (text[end] === '<') balance++;
                    if (text[end] === '>') balance--;
                }
                if (balance) return output + escapeHtml(transformText(text.slice(match.index)));
                const label = renderNodes(text.slice(regex.lastIndex, end - 1), depth + 1);
                if (match[1].startsWith('fmt_')) {
                    const color = `#${match[1].slice(4)}`;
                    output += `<span class="game-text-color" data-game-color="${color}" style="color:${color}">${label}</span>`;
                } else {
                    const item = glossary?.[match[1]];
                    if (!item) throw new Error(`Missing generated tooltip ${match[1]}`);
                    const icon = /^(?:images\/keyword-icons\/(?:inline|original)\/[a-z0-9_]+\.png|images\/dzone\/cards\/[a-z0-9_-]+\.png)$/.test(item.icon || '')
                        ? `<img class="keyword-icon" src="${escapeHtml(item.icon)}" alt="" aria-hidden="true">` : '';
                    const color = /^#[a-f0-9]{6}$/i.test(item.color || '') ? ` style="color:${item.color}"` : '';
                    output += `<strong class="tooltip-trigger${icon ? ' keyword-iconized' : ''}" data-keyword="${match[1]}" tabindex="0"${color}>${icon}<span>${label}</span></strong>`;
                }
                cursor = end;
                regex.lastIndex = end;
            }
            return output + escapeHtml(transformText(text.slice(cursor)));
        }
        return renderNodes(wrapped[1]);
    }
    const api = { render };
    if (typeof module !== 'undefined') module.exports = api;
    else root.DzoneRichText = api;
})(typeof window === 'undefined' ? globalThis : window);
