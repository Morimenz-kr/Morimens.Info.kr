(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CharacterIdentity = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const normalize = value => String(value || '').normalize('NFKC').replace(/[\s·「」｢｣]/g, '').toLowerCase();
    const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const displayFields = new Set(['description', 'effect', 'effectFormula', 'note', 'text', 'condition', 'characterName', 'character_name', 'settingName']);
    const preserved = /^(raw|source|original|research|provenance)/i;

    function create(manifest) {
        const byId = new Map(manifest.map(character => [String(character.id), character]));
        const aliases = new Map();
        const literals = new Map();
        for (const character of manifest) {
            for (const alias of [character.id, character.name, ...(character.name_aliases || [])]) {
                const key = normalize(alias);
                if (!key) continue;
                if (aliases.has(key) && aliases.get(key) !== character.id) throw new Error(`각성체 별칭 중복: ${alias}`);
                aliases.set(key, character.id);
            }
            for (const alias of [character.name, ...(character.name_aliases || [])]) {
                for (const literal of [alias, alias.replace(/\s*·\s*/g, '·'), alias.replace(/\s*·\s*/g, ' '), alias.replace(/[\s·]/g, '')]) {
                    if (literal) literals.set(literal, character.id);
                }
            }
        }
        const pattern = new RegExp([...literals.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|') || '(?!)', 'gu');
        const resolveId = value => byId.has(String(value)) ? String(value) : aliases.get(normalize(value)) || null;
        const name = id => byId.get(String(id))?.name || String(id);
        const replaceNames = (value, renderName) => String(value || '').replace(pattern, (literal, offset, text) => {
                // 한 글자 이름을 산출력·돌파·서포터 같은 일반 단어 안에서 치환하지 않는다.
                if ([...literal].length === 1) {
                    if (offset && /[\p{L}\p{N}]/u.test(text[offset - 1])) return literal;
                    const tail = text.slice(offset + literal.length);
                    if (tail && /^[\p{L}\p{N}]/u.test(tail) && !/^(?:에게|한테|으로|에서|은|는|이|가|을|를|의|와|과|도|만|로)(?=$|[\s\p{P}])/u.test(tail)) return literal;
                }
                return renderName(literals.get(literal));
            });
        const format = value => replaceNames(value, name).replace(/\{character:([^{}]+)\}/g, (token, id) => byId.has(id) ? name(id) : token);
        const template = value => replaceNames(value, id => `{character:${id}}`);
        const names = ids => [...new Set((ids || []).map(id => name(id)))];
        function hydrate(value, allStrings = false) {
            if (value && typeof value === 'object' && Object.isFrozen(value)) value = Array.isArray(value) ? [...value] : { ...value };
            if (Array.isArray(value)) { value.forEach((child, index) => { value[index] = hydrate(child, allStrings); }); return value; }
            if (!value || typeof value !== 'object') return value;
            for (const [key, child] of Object.entries(value)) {
                if (preserved.test(key) || key === 'name_aliases') continue;
                if (typeof child === 'string' && (allStrings || displayFields.has(key))) value[key] = format(child);
                else if (child && typeof child === 'object') value[key] = hydrate(child, allStrings);
            }
            if (value.recommended_character_ids) value.optimized_for = [...names(value.recommended_character_ids), ...(value.optimized_for || []).filter(tag => !resolveId(tag))];
            if (value.related_character_ids) value.tags = [...names(value.related_character_ids), ...(value.tags || []).filter(tag => !resolveId(tag))];
            return value;
        }
        return { byId, resolveId, name, format, hydrate, template, searchText: character => [character.name, ...(character.name_aliases || [])].join(' '), isOwner: (item, id) => (item.owner_character_ids || []).includes(String(id)) };
    }
    return { create, normalize };
});
