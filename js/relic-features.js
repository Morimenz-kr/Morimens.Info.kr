/* Pure relic search/resolution. Unknown game context stays unknown, never zero. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.RelicFeatures = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    function expressionValue(expression, variables = {}) {
        if (typeof expression !== 'string' || expression.length > 2048) return null;
        let source = expression;
        // Exact game tokens only. No eval/Function, property access or general calls.
        for (const token of Object.keys(variables).sort((a, b) => b.length - a.length)) {
            if (!Number.isFinite(variables[token])) return null;
            source = source.split(token).join(`(${variables[token]})`);
        }
        source = source.replace(/math\.(ceil|floor|min|max)/g, '$1');
        const tokens = source.match(/\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+|ceil|floor|min|max|[()+\-*/^,]|\S/g) || [];
        let position = 0, depth = 0;
        const peek = () => tokens[position];
        function atom() {
            if (++depth > 100) throw new Error('Expression too deep');
            let result;
            const token = tokens[position++];
            if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token || '')) result = Number(token);
            else if (token === '(') {
                result = sum(); if (tokens[position++] !== ')') throw new Error('Missing bracket');
            } else if (['ceil', 'floor', 'min', 'max'].includes(token)) {
                if (tokens[position++] !== '(') throw new Error('Missing function bracket');
                const args = [sum()];
                while (peek() === ',') { position++; args.push(sum()); }
                if (tokens[position++] !== ')' || ['ceil', 'floor'].includes(token) && args.length !== 1) throw new Error('Invalid function arguments');
                result = Math[token](...args);
            } else throw new Error('Unknown context');
            depth--; return result;
        }
        function power() { let value = atom(); if (peek() === '^') { position++; value **= unary(); } return value; }
        function unary() {
            if (++depth > 100) throw new Error('Expression too deep');
            let value;
            if (peek() === '+' || peek() === '-') { const negative = tokens[position++] === '-'; value = (negative ? -1 : 1) * unary(); }
            else value = power();
            depth--; return value;
        }
        function product() {
            let value = unary();
            while (peek() === '*' || peek() === '/') { const operator = tokens[position++], right = unary(); value = operator === '*' ? value * right : value / right; }
            return value;
        }
        function sum() {
            let value = product();
            while (peek() === '+' || peek() === '-') { const operator = tokens[position++], right = product(); value = operator === '+' ? value + right : value - right; }
            return value;
        }
        try { const value = sum(); return position === tokens.length && Number.isFinite(value) ? value : null; } catch { return null; }
    }
    function variablesAt(depth, context = {}) {
        if (!depth || !Number.isFinite(depth.spirit) || !Number.isFinite(depth.material) || !Number.isFinite(depth.spiritRate)) throw new Error('Missing research depth');
        const variables = { InsightResearchDepth: depth.spirit, PlayerGrowth: depth.material,
            'GetAccountStageGrow()': depth.material, SpiritResearchDepthMultiplier: depth.spiritRate / 100 };
        for (const [key, token] of Object.entries({ maxHp: 'PlayerRole.max_hp', hp: 'PlayerRole.hp', basicDamagePct: 'PlayerRole.basic_damage_per',
            archiveNotch: 'Archivenotch()', stagePower: 'GetStagePower()' })) {
            if (context[key] !== undefined) {
                if (!Number.isFinite(context[key]) || context[key] < 0) throw new Error('Invalid relic context');
                variables[token] = context[key];
            }
        }
        for (const [tid, layers] of Object.entries(context.stateLayers || {})) {
            if (!/^[1-9][0-9]{0,8}$/.test(tid) || !Number.isFinite(layers) || layers < 0) throw new Error('Invalid state layers');
            variables[`PlayerRole.GetStateLayer(${tid})`] = layers;
        }
        if (context.maxHp !== undefined && context.hp !== undefined && context.hp > context.maxHp) throw new Error('HP exceeds maximum');
        return variables;
    }
    function resolveVariant(variant, depth, context = {}) {
        const variables = variablesAt(depth, context), values = {}, unresolved = [];
        for (const parameter of variant.parameters || []) {
            if (!Number.isSafeInteger(parameter.index) || parameter.index < 1) throw new Error('Invalid parameter index');
            const value = parameter.kind === 'fixed' && Number.isFinite(parameter.fixedValue) ? parameter.fixedValue : expressionValue(parameter.expression, variables);
            if (value === null) unresolved.push(parameter.index); else values[parameter.index] = value;
        }
        const format = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });
        const template = String(variant.battleDescription || variant.description || '');
        const description = template.replace(/\[(?:[A-Za-z]+:\s*)?Arg(\d+)\]/g, (token, index) => {
            if (values[index] !== undefined) return format.format(values[index]);
            if (!unresolved.includes(Number(index))) unresolved.push(Number(index));
            return token;
        });
        return { ...variant, description, values, unresolved: unresolved.sort((a, b) => a - b), resolved: unresolved.length === 0,
            context: { level: depth.level, ...context }, formulaSource: 'client-export' };
    }
    const MECHANICS = Object.freeze({
        arithmetica: ['계산', '산출력', 'Arithmetica'], draw: ['드로우', '손패', '덱', '카드 뽑', 'Draw'],
        aliemus: ['광기', 'Aliemus'], exalt: ['광기 폭발', '영혼 부름', 'Exalt', 'Rouse'],
        offense: ['힘', '피해', '공격', 'STR', 'DMG'], shield: ['실드', '가드', 'Shield', 'Guard'],
        healing: ['회복', 'HP', 'Healing'], debuff: ['중독', '반격', '허약', '손상', '취약', 'Poison', 'Counter']
    });
    function mechanics(variant) {
        const text = `${variant.description || ''} ${variant.battleDescription || ''}`.toLowerCase();
        return Object.entries(MECHANICS).filter(([, words]) => words.some(word => text.includes(word.toLowerCase()))).map(([key]) => key);
    }
    function search(catalog, options = {}) {
        if (!Array.isArray(catalog.relics)) throw new Error('Invalid relic catalog');
        if (options.mechanic && !Object.hasOwn(MECHANICS, options.mechanic)) throw new Error('Invalid mechanic');
        const query = String(options.query || '').trim().toLocaleLowerCase('ko');
        const entries = catalog.relics.map(relic => ({ ...relic, variants: relic.variants.filter(variant => {
            if (options.chapter && variant.chapter !== options.chapter || options.tier && variant.tier !== options.tier
                || options.source && variant.source !== options.source || options.origin && variant.origin !== options.origin
                || options.mechanic && !(Array.isArray(relic.mechanics) ? relic.mechanics : mechanics(variant)).includes(options.mechanic)) return false;
            return !query || `${relic.name} ${variant.name} ${variant.description} ${variant.battleDescription} ${mechanics(variant).join(' ')}`.toLocaleLowerCase('ko').includes(query);
        }) })).filter(relic => relic.variants.length);
        return { relics: entries, itemCount: entries.length, canonicalCount: catalog.grouping === 'variant-id-not-canonical' ? null : entries.length,
            variantCount: entries.reduce((n, relic) => n + relic.variants.length, 0),
            scope: catalog.scope, grouping: catalog.grouping ?? 'site-catalog', groupingSource: catalog.groupingSource ?? null,
            mechanicClassification: catalog.mechanicClassification ?? 'text-derived-search-tags-not-game-effect-ids' };
    }
    function detail(catalog, variantId, depth, context = {}) {
        for (const relic of catalog.relics) {
            const variant = relic.variants.find(row => row.id === variantId);
            if (variant) return { canonicalId: relic.id, canonicalName: relic.name, image: relic.image,
                variant: resolveVariant(variant, depth, context), availableVariantIds: relic.variants.map(row => row.id) };
        }
        return null;
    }
    function compareInventory(local, remoteIndex) {
        const icon = value => String(value || '').split('/').at(-1).replace(/\.(png|webp)$/i, '').toLowerCase();
        const byIcon = new Map();
        for (const relic of local.relics) {
            const key = icon(relic.iconSource); if (!byIcon.has(key)) byIcon.set(key, []);
            byIcon.get(key).push(relic.id);
        }
        return { localCanonicalCount: local.relics.length, localVariantCount: local.relics.reduce((n, row) => n + row.variants.length, 0),
            remoteCanonicalCount: remoteIndex.length, remoteVariantCount: remoteIndex.reduce((n, row) => n + row.variantCount, 0),
            candidates: remoteIndex.map(row => ({ sourceName: row.name, icon: icon(row.icon), variantCount: row.variantCount,
                localCanonicalIds: byIcon.get(icon(row.icon)) || [], match: 'icon-candidate-only' })),
            warning: '아이콘은 식별자가 아닙니다. 같은 아이콘을 공유하는 테스트·이벤트·차원 영상은 ID별 확인이 필요합니다.' };
    }
    return { expressionValue, variablesAt, resolveVariant, mechanics, search, detail, compareInventory };
});
