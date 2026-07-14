import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    createSafeImageUrl,
    decodeTooltipMainStats,
    encodeTooltipMainStats,
    formatTooltipMainStats,
    getDictionaryFilterMeta,
    normalizeDictionaryFilterValue,
    requiresImageProxy,
    resolveSafeHttpUrl,
    uniqueSortedValues
} from '../js/links/domain.js';
import { createItemTooltipController } from '../js/ui/item-tooltip.js';
import {
    createRuntimeDataLoader,
    getRuntimeShardPath,
    settleRuntimeShard,
    validateRuntimeIndex,
    validateRuntimeShard
} from '../js/links/runtime-index.js';
import {
    createKeyboardEvent,
    createMinimalWindow,
    MinimalDocument
} from './helpers/minimal-dom.mjs';

test('tooltip main stats round-trip without retaining malformed input', () => {
    const stats = ['공격력 10%', '방어력 8%', '치명타 6%', '속도 4', '체력 12%', '효율 5%'];
    const encoded = encodeTooltipMainStats(stats);

    assert.deepEqual(decodeTooltipMainStats(encoded), stats);
    assert.equal(formatTooltipMainStats(stats), [
        'Ⅰ 공격력 10%',
        'Ⅱ 방어력 8%',
        'Ⅲ 치명타 6%',
        'Ⅳ 속도 4',
        'Ⅴ 체력 12%',
        'Ⅵ 효율 5%'
    ].join('\n'));
    assert.deepEqual(decodeTooltipMainStats('%not-json'), []);
    assert.equal(encodeTooltipMainStats([]), '');
});

test('dictionary values normalize source spelling variants into stable filters', () => {
    assert.equal(normalizeDictionaryFilterValue('영역숙련 12%', 'mainStat'), '영역 숙련');
    assert.equal(normalizeDictionaryFilterValue('검은 인장 드롭율 3', 'mainStat'), '검은 인장 드롭');
    assert.equal(normalizeDictionaryFilterValue(' 광기 획득량 증가 ', 'effect'), '광기');
    assert.equal(normalizeDictionaryFilterValue('최종피해증가', 'effect'), '최종 피해 증가');
    assert.equal(normalizeDictionaryFilterValue('', 'effect'), '');
});

test('dictionary metadata excludes character-name tags only from silver-key effects', () => {
    const item = {
        korean_name: '표본',
        english_name: 'Sample',
        description: '검색 가능한 설명',
        grade: 'SSR',
        main_stat: '영역숙련 12%',
        tags: ['타윌', '최종피해증가', '최종 피해 증가']
    };
    const characterNames = new Set(['타윌']);

    const silverKey = getDictionaryFilterMeta(item, 'silverkey', characterNames);
    assert.deepEqual(silverKey.effectFilters, ['최종 피해 증가', '최종 피해 증가']);
    assert.match(silverKey.nameText, /표본 sample/);
    assert.match(silverKey.text, /검색 가능한 설명/);

    const wheel = getDictionaryFilterMeta(item, 'myeongryun', characterNames);
    assert.equal(wheel.grade, 'SSR');
    assert.equal(wheel.mainStat, '영역 숙련');
    assert.deepEqual(wheel.effectFilters, []);
});

test('filter option values are trimmed, deduplicated, and Korean-sorted', () => {
    assert.deepEqual(uniqueSortedValues([' 힘 ', '', '광기', '힘', null]), ['광기', '힘']);
});

test('URL contract resolves relative HTTP links and rejects active or local protocols', () => {
    const baseUrl = 'https://morimenz-kr.github.io/Morimens.Info.kr/links.html';

    assert.equal(
        resolveSafeHttpUrl(' images/card.webp ', baseUrl),
        'https://morimenz-kr.github.io/Morimens.Info.kr/images/card.webp'
    );
    assert.equal(resolveSafeHttpUrl('//cdn.example.com/card.webp', baseUrl), 'https://cdn.example.com/card.webp');
    assert.equal(resolveSafeHttpUrl('http://example.com/path', baseUrl), 'http://example.com/path');
    assert.equal(resolveSafeHttpUrl('javascript:alert(1)', baseUrl), '');
    assert.equal(resolveSafeHttpUrl('data:text/html,unsafe', baseUrl, 'fallback'), 'fallback');
    assert.equal(resolveSafeHttpUrl('file:///private/data', baseUrl), '');
    assert.equal(resolveSafeHttpUrl('https://[invalid', baseUrl, 'fallback'), 'fallback');
});

test('image URL contract proxies only exact configured hosts and their subdomains', () => {
    const baseUrl = 'https://morimenz-kr.github.io/Morimens.Info.kr/links.html';
    assert.equal(requiresImageProxy('https://arca.live/image.png', baseUrl), true);
    assert.equal(requiresImageProxy('https://image.dcinside.com/image.png', baseUrl), true);
    assert.equal(requiresImageProxy('https://notarca.live/image.png', baseUrl), false);

    const proxied = new URL(createSafeImageUrl('https://namu.la/image.png', { baseUrl }));
    assert.equal(proxied.origin, 'https://images.weserv.nl');
    assert.equal(proxied.searchParams.get('url'), 'https://namu.la/image.png');
    assert.equal(proxied.searchParams.get('w'), '400');
    assert.equal(proxied.searchParams.get('output'), 'webp');

    assert.equal(
        createSafeImageUrl('javascript:alert(1)', { baseUrl, fallback: 'images/smile_Ramona.webp' }),
        'https://morimenz-kr.github.io/Morimens.Info.kr/images/smile_Ramona.webp'
    );
    assert.equal(
        createSafeImageUrl('https://example.com/image.png', { baseUrl, fallback: 'images/smile_Ramona.webp' }),
        'https://example.com/image.png'
    );
});

test('runtime index loads only the current versioned route shards and never canonical aggregates', async () => {
    const index = {
        schemaVersion: 1,
        resourceLinks: {
            categories: { code: 'data/resource-links/categories/code.json' },
            characters: { tawil: 'data/resource-links/characters/tawil.json' }
        },
        characterEffects: { tawil: 'data/character-effects/tawil.json' }
    };
    const payloads = new Map([
        ['data/runtime-index.json?v=release%201', index],
        ['data/resource-links/categories/code.json?v=release%201', { title: '교환 코드', links: [] }],
        ['data/resource-links/characters/tawil.json?v=release%201', []],
        ['data/character-effects/tawil.json?v=release%201', { skills: [] }]
    ]);
    const urls = [];
    const loader = createRuntimeDataLoader({
        version: 'release 1',
        async fetchJson(url) {
            urls.push(url);
            if (!payloads.has(url)) throw new Error(`Unexpected fetch: ${url}`);
            return payloads.get(url);
        }
    });
    const loadedIndex = await loader.loadIndex();
    await loader.loadShard(loadedIndex, 'category', 'code');
    await loader.loadShard(loadedIndex, 'characterLinks', 'tawil');
    await loader.loadShard(loadedIndex, 'characterEffects', 'tawil');

    assert.deepEqual(urls, [
        'data/runtime-index.json?v=release%201',
        'data/resource-links/categories/code.json?v=release%201',
        'data/resource-links/characters/tawil.json?v=release%201',
        'data/character-effects/tawil.json?v=release%201'
    ]);
    assert.equal(urls.some(url => /resource_links\.json|character_effects\.json/.test(url)), false);
    assert.equal(getRuntimeShardPath(index, 'category', 'code'), 'data/resource-links/categories/code.json');
});

test('runtime index, route, and shard shapes fail closed', () => {
    const validIndex = {
        schemaVersion: 1,
        resourceLinks: {
            categories: { code: 'data/resource-links/categories/code.json' },
            characters: {}
        },
        characterEffects: {}
    };
    assert.equal(validateRuntimeIndex(validIndex), validIndex);
    assert.throws(
        () => validateRuntimeIndex({ ...validIndex, schemaVersion: 2 }),
        /Unsupported runtime index schema version/
    );
    assert.throws(
        () => validateRuntimeIndex({
            ...validIndex,
            resourceLinks: {
                ...validIndex.resourceLinks,
                categories: { code: 'https://example.com/code.json' }
            }
        }),
        /unsafe shard route/
    );
    assert.throws(() => getRuntimeShardPath(validIndex, 'category', 'missing'), /route is missing/);
    assert.throws(() => validateRuntimeShard('category', { title: '', links: [] }), /invalid shape/);
    assert.throws(() => validateRuntimeShard('characterLinks', {}), /must be an array/);
    assert.throws(() => validateRuntimeShard('characterEffects', []), /must be an object/);
});

test('a character-effect shard failure settles locally instead of rejecting the route', async () => {
    const failure = new Error('effect unavailable');
    const result = await settleRuntimeShard({
        async loadShard() {
            throw failure;
        }
    }, {}, 'characterEffects', 'tawil');
    assert.equal(result.data, null);
    assert.equal(result.error, failure);
});

test('long tooltip content has an operable pinned-dialog path on every affected screen', async () => {
    const [sharedTooltip, characterEffects, linksStyles, characterStyles, siteDialog] = await Promise.all([
        readFile(new URL('../js/ui/item-tooltip.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/character-effects.js', import.meta.url), 'utf8'),
        readFile(new URL('../css/pages/links.css', import.meta.url), 'utf8'),
        readFile(new URL('../css/character-effects.css', import.meta.url), 'utf8'),
        readFile(new URL('../js/ui/dialog.js', import.meta.url), 'utf8')
    ]);

    assert.match(sharedTooltip, /aria-controls/);
    assert.match(sharedTooltip, /aria-expanded/);
    assert.match(sharedTooltip, /setAttribute\('role', pinned \? 'dialog' : 'tooltip'\)/);
    assert.match(sharedTooltip, /event\.key !== 'Escape'[\s\S]*restoreFocus:\s*true/);
    assert.match(sharedTooltip, /context\.append\(tooltip\)[\s\S]*tooltip\.inert = false/);
    assert.match(sharedTooltip, /tooltip\.inert = wasInert/);
    assert.match(siteDialog, /new MutationObserver[\s\S]*isolateBackgroundFor/);
    assert.match(siteDialog, /function resetBackgroundIsolation[\s\S]*function restoreBackgroundIsolation/);

    assert.match(characterEffects, /aria-controls="character-effect-tooltip-box"/);
    assert.match(characterEffects, /tooltipBox\.setAttribute\('role', pinned \? 'dialog' : 'tooltip'\)/);
    assert.match(characterEffects, /event\.key !== 'Escape'[\s\S]*hideTooltip\(true, true\)/);

    for (const styles of [linksStyles, characterStyles]) {
        assert.match(styles, /max-block-size:\s*calc\(100dvh/);
        assert.match(styles, /overflow-y:\s*auto/);
        assert.match(styles, /pointer-events:\s*auto/);
        assert.match(styles, /touch-action:\s*pan-y/);
    }
});

test('links runtime entry does not fetch excluded canonical aggregate data', async () => {
    const controller = await readFile(new URL('../js/links.js', import.meta.url), 'utf8');
    assert.match(controller, /createRuntimeDataLoader/);
    assert.match(controller, /settleRuntimeShard\(runtimeLoader, runtimeIndex, 'characterEffects', charId\)/);
    assert.match(controller, /settleRuntimeShard\(runtimeLoader, runtimeIndex, 'characterLinks', charId\)/);
    assert.match(controller, /settleRuntimeShard\(runtimeLoader, runtimeIndex, 'category', category\)/);
    assert.match(controller, /renderCharacterEffectLoadError[\s\S]*runtimeLoader\.loadShard\(runtimeIndex, 'characterEffects', charId\)/);
    assert.match(controller, /renderResourceLinksLoadError[\s\S]*runtimeLoader\.loadShard\(runtimeIndex, 'characterLinks', charId\)/);
    assert.match(controller, /renderLinksRouteError\(listEl, \(\) => loadCurrentRoute\(\{ restoreFocus: true \}\)\)/);
    assert.match(controller, /focusLinksRecoveryTarget\('links'\)/);
    assert.match(controller, /focusLinksRecoveryTarget\('character-effects'\)/);
    assert.match(controller, /listEl\?\.querySelector\('\.links-route-error button'\)\?\.focus\(\{ preventScroll: true \}\)/);
    assert.match(controller, /const candidates = preferredTab[\s\S]*\[title, selected, firstTab\]/);
    assert.doesNotMatch(controller, /data\/resource_links\.json|data\/character_effects\.json/);
    assert.doesNotMatch(controller, /element\.setAttribute\('aria-live'/);
    assert.match(controller, /copy\.setAttribute\('aria-label', `\$\{item\?\.title \|\| '교환 코드'\} 복사`\)/);
});

test('a pinned modal tooltip joins the active dialog, focuses, and restores its isolated portal on Escape', () => {
    const document = new MinimalDocument();
    const window = createMinimalWindow(document);
    const tooltip = document.createElement('div');
    tooltip.id = 'global-tooltip';
    const title = document.createElement('div');
    title.id = 'tt-title';
    const description = document.createElement('div');
    description.id = 'tt-desc';
    const tags = document.createElement('div');
    tags.id = 'tt-tags';
    tooltip.append(title, description, tags);
    tooltip.inert = true;
    const portalSentinel = document.createElement('div');
    document.body.append(tooltip, portalSentinel);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    const dialog = document.createElement('section');
    dialog.setAttribute('role', 'dialog');
    const trigger = document.createElement('button');
    dialog.append(trigger);
    overlay.append(dialog);
    document.body.append(overlay);

    const controller = createItemTooltipController({ document, window, tooltipElement: tooltip });
    controller.bindTrigger(trigger, { korean_name: '장문 설명 항목' }, [], {
        pinOnClick: false,
        pinWithAltArrow: true
    });
    let modalEscapeCount = 0;
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') modalEscapeCount += 1;
    }, true);
    trigger.dispatchEvent(createKeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));

    assert.equal(tooltip.parentNode, dialog);
    assert.equal(tooltip.inert, false);
    assert.equal(tooltip.getAttribute('role'), 'dialog');
    assert.equal(tooltip.tabIndex, 0);
    assert.equal(document.activeElement, tooltip);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');

    document.dispatchEvent(createKeyboardEvent('keydown', { key: 'Escape' }));

    assert.equal(tooltip.parentNode, document.body);
    assert.equal(tooltip.nextSibling, portalSentinel);
    assert.equal(tooltip.inert, true);
    assert.equal(tooltip.getAttribute('aria-hidden'), 'true');
    assert.equal(tooltip.tabIndex, -1);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, trigger);
    assert.equal(modalEscapeCount, 0, 'the first Escape must be owned by the pinned tooltip');

    document.dispatchEvent(createKeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(modalEscapeCount, 1, 'the next Escape can reach the parent modal layer');
});
