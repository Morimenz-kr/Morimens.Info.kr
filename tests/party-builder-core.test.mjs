import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    createStorageAdapter,
    createVersionedStateStore,
    normalizeStringArray,
    parseJson
} from '../js/party-builder/storage.js';
import { createValidator } from '../js/party-builder/validation.js';
import {
    createKeywordMatcher,
    matchesByQueryType,
    normalizeDedicatedTarget,
    normalizeWheelMainStat
} from '../js/party-builder/search.js';
import {
    applyCharacterSelection,
    applySupport,
    createPartyStateFactory,
    moveTeam,
    removeSupportFromPage,
    replaceTeamComposition,
    resolvePageIndexAfterDeletion,
    resetTeam
} from '../js/party-builder/team-state.js';
import {
    createTeamSharePayload,
    parseAndSanitizeTeamShare,
    serializeTeamShare
} from '../js/party-builder/share.js';
import {
    bootstrapPartyBuilder,
    loadRequiredPartyBuilderData,
    validatePartyBuilderData
} from '../js/party-builder/bootstrap.js';
import {
    collectEquippedKeyIds,
    collectEquippedWheelIds,
    createKeyOptionModels,
    createWheelOptionModels,
    findDedicatedKey,
    findDedicatedWheel,
    withEquippedKey,
    withEquippedWheel
} from '../js/party-builder/equipment.js';

const stateFactory = createPartyStateFactory({ maxTeams: 2, romanNumerals: ['I', 'II'] });
const { createEmptyTeam, createEmptyPage } = stateFactory;

function createTestValidator() {
    return createValidator({
        characters: ['a', 'b', 'c', 'support'].map(id => ({ id })),
        wheels: ['wheel-a', 'wheel-b', 'wheel-c', 'wheel-support'].map(english_name => ({ english_name })),
        keys: [{ english_name: 'key-a' }],
        maxTeams: 2,
        maxPages: 2,
        createEmptyTeam,
        createEmptyPage
    });
}

function createMemoryStorage(initialValues = {}) {
    const values = new Map(Object.entries(initialValues));
    return {
        values,
        backend: {
            getItem: key => values.has(key) ? values.get(key) : null,
            setItem: (key, value) => values.set(key, String(value)),
            removeItem: key => values.delete(key)
        }
    };
}

function createRequiredPartyData() {
    return {
        characters: [{ id: 'character-a' }],
        wheels: [{ english_name: 'wheel-a' }],
        keys: [{ english_name: 'key-a' }],
        rules: {
            exclusive_groups: [['character-a', 'character-b']],
            character_tags: {},
            tag_aliases: {},
            dedicated_wheel_aliases: {}
        }
    };
}

function createPartyDataFetch(data, options = {}) {
    const { failingPath = '' } = options;
    const payloadByPath = new Map([
        ['data/character_manifest.json', data.characters],
        ['data/wheel_list.json', data.wheels],
        ['data/silverkey_list.json', data.keys],
        ['data/party_builder_rules.json', data.rules]
    ]);
    const urls = [];
    return {
        urls,
        async fetch(url) {
            urls.push(url);
            const path = String(url).split('?')[0];
            if (path === failingPath) return { ok: false, status: 503, async json() { return null; } };
            return {
                ok: payloadByPath.has(path),
                status: payloadByPath.has(path) ? 200 : 404,
                async json() {
                    return JSON.parse(JSON.stringify(payloadByPath.get(path)));
                }
            };
        }
    };
}

test('empty-state factories create isolated teams and complete pages', () => {
    const page = createEmptyPage('PAGE 1');
    assert.equal(page.teams.length, 2);
    assert.equal(page.teams[0].name, 'TEAM I');
    assert.equal(page.teams[1].name, 'TEAM II');

    page.teams[0].wheels[0][0] = 'wheel-a';
    assert.equal(page.teams[1].wheels[0][0], null, 'teams must not share nested wheel arrays');
});

test('team reordering tracks the selected team without mutating the source array', () => {
    const teams = [createEmptyTeam(0), createEmptyTeam(1), { ...createEmptyTeam(1), name: 'TEAM III' }];
    const result = moveTeam(teams, 0, 2, 1);

    assert.equal(result.changed, true);
    assert.deepEqual(result.teams.map(team => team.name), ['TEAM II', 'TEAM III', 'TEAM I']);
    assert.equal(result.currentTeamIndex, 0);
    assert.deepEqual(teams.map(team => team.name), ['TEAM I', 'TEAM II', 'TEAM III']);
    assert.equal(moveTeam(teams, -1, 1, 0).changed, false);
});

test('page deletion preserves the active logical page and chooses the previous page when deleting it', () => {
    assert.equal(resolvePageIndexAfterDeletion(2, 0, 3), 1, 'deleting an earlier page must follow the same active page');
    assert.equal(resolvePageIndexAfterDeletion(2, 2, 3), 1, 'deleting the active page must select its predecessor');
    assert.equal(resolvePageIndexAfterDeletion(0, 0, 3), 0, 'deleting the first active page must select the new first page');
    assert.equal(resolvePageIndexAfterDeletion(1, 3, 3), 1, 'deleting a later page must preserve the current index');
    assert.equal(resolvePageIndexAfterDeletion(3, 3, 3), 2, 'the result must remain within the surviving page range');
});

test('equipment option models centralize ownership, filters, and recent-key ordering without mutating catalogs', () => {
    const page = createEmptyPage('PAGE 1');
    page.teams[0].wheels[0] = ['wheel-a', null];
    page.teams[1].wheels[0] = ['wheel-b', null];
    page.teams[0].key = 'key-a';
    page.teams[1].key = 'key-b';
    const wheels = [
        { english_name: 'wheel-a', tags: ['힘'], main_stat: '공격 10%' },
        { english_name: 'wheel-b', tags: ['힘', '치명'], main_stat: '공격 12%' },
        { english_name: 'wheel-c', tags: ['치명'], main_stat: '치명 5%' }
    ];
    const keys = [
        { english_name: 'key-a', korean_name: '가' },
        { english_name: 'key-b', korean_name: '나' },
        { english_name: 'key-c', korean_name: '다' }
    ];

    const wheelModels = createWheelOptionModels(wheels, {
        currentWheelId: 'wheel-a',
        usedWheelIds: collectEquippedWheelIds(page),
        ownedOnly: true,
        ownedWheelIds: new Set(['wheel-b']),
        activeTags: new Set(['힘']),
        activeMainStats: new Set(['공격']),
        normalizeMainStat: value => value.split(' ')[0]
    });
    assert.deepEqual(wheelModels.map(model => [model.item.english_name, model.isSelected, model.isUsed]), [
        ['wheel-a', true, false],
        ['wheel-b', false, true]
    ]);

    const keyModels = createKeyOptionModels(keys, {
        currentKeyId: 'key-a',
        usedKeyIds: collectEquippedKeyIds(page, 0),
        recentKeyIds: ['key-c', 'key-a']
    });
    assert.deepEqual(keyModels.map(model => [model.item.english_name, model.isSelected, model.isUsed]), [
        ['key-c', false, false],
        ['key-a', true, false],
        ['key-b', false, true]
    ]);
    assert.deepEqual(keys.map(key => key.english_name), ['key-a', 'key-b', 'key-c']);
});

test('dedicated equipment resolution and updates are normalized, immutable domain operations', () => {
    const keys = [
        { english_name: 'key-other', tags: ['다른 각성체'] },
        { english_name: 'key-dedicated', Tag: ['라모나'] }
    ];
    const wheels = [
        { english_name: 'wheel-sr', grade: 'SR', optimized_for: ['RAMONA'] },
        { english_name: 'wheel-ssr', grade: 'SSR', optimized_for: ['「 Timeworn Ramona 」'] }
    ];
    const normalizeTarget = value => String(value || '').replace(/[「」]/g, '').trim().toLowerCase();

    assert.equal(findDedicatedKey(keys, '라모나')?.english_name, 'key-dedicated');
    assert.equal(findDedicatedWheel(wheels, {
        characterId: 'ramona_timeworn',
        character: { id: 'ramona_timeworn', name: '시간에 바랜 라모나' },
        aliases: ['Timeworn Ramona'],
        grade: 'SSR',
        normalizeTarget
    })?.english_name, 'wheel-ssr');

    const source = createEmptyTeam(0);
    const withWheel = withEquippedWheel(source, 1, 0, 'wheel-ssr');
    const withKey = withEquippedKey(withWheel, 'key-dedicated');
    assert.equal(source.wheels[1][0], null);
    assert.equal(source.key, null);
    assert.equal(withKey.wheels[1][0], 'wheel-ssr');
    assert.equal(withKey.key, 'key-dedicated');
    assert.notEqual(withKey.wheels, source.wheels);
});

test('quick character selection preserves equipment by character ID and keeps slot-three support', () => {
    const team = {
        name: 'CUSTOM',
        chars: ['a', 'b', 'c', 'support'],
        wheels: [
            ['wheel-a', null],
            ['wheel-b', null],
            ['wheel-c', null],
            ['wheel-support', null]
        ],
        key: 'key-a',
        supportIdx: 3
    };

    const selected = applyCharacterSelection(team, ['c', 'a', 'b']);
    assert.deepEqual(selected.chars, ['c', 'a', 'b', 'support']);
    assert.deepEqual(selected.wheels, [
        ['wheel-c', null],
        ['wheel-a', null],
        ['wheel-b', null],
        ['wheel-support', null]
    ]);
    assert.deepEqual(team.chars, ['a', 'b', 'c', 'support'], 'selection must not mutate the previous state');
});

test('support movement is page-wide, preserves its equipment, and remains immutable', () => {
    const page = createEmptyPage('PAGE 1');
    page.teams[0].chars[0] = 'a';
    page.teams[0].wheels[0] = ['wheel-a', null];
    page.teams[1].chars[3] = 'support';
    page.teams[1].wheels[3] = ['wheel-support', null];
    page.teams[1].supportIdx = 3;

    const moved = applySupport(page, 'a', 1);
    assert.equal(moved.teams[0].chars[0], null);
    assert.equal(moved.teams[1].chars[3], 'a');
    assert.deepEqual(moved.teams[1].wheels[3], ['wheel-a', null]);
    assert.equal(moved.teams[1].supportIdx, 3);
    assert.equal(page.teams[0].chars[0], 'a', 'support movement must not mutate the prior page');
    assert.equal(page.teams[1].chars[3], 'support');

    const cleared = removeSupportFromPage(moved);
    assert.equal(cleared.teams[1].chars[3], null);
    assert.equal(cleared.teams[1].supportIdx, -1);
    assert.equal(moved.teams[1].chars[3], 'a');
});

test('reset and composition replacement retain team identity while isolating nested arrays', () => {
    const team = {
        name: 'KEEP NAME',
        chars: ['a', null, null, null],
        wheels: [['wheel-a', null], [null, null], [null, null], [null, null]],
        key: 'key-a',
        supportIdx: -1
    };
    assert.deepEqual(resetTeam(team), {
        name: 'KEEP NAME',
        chars: [null, null, null, null],
        wheels: [[null, null], [null, null], [null, null], [null, null]],
        key: null,
        supportIdx: -1
    });

    const replacement = replaceTeamComposition(team, {
        chars: ['b', null, null, null],
        wheels: [['wheel-b', null], [null, null], [null, null], [null, null]],
        key: null,
        supportIdx: -1
    });
    replacement.wheels[0][0] = null;
    assert.equal(team.wheels[0][0], 'wheel-a');
    assert.equal(replacement.name, 'KEEP NAME');
});

test('v3 state storage migrates legacy data, clamps indexes, and recovers corrupt payloads', () => {
    const validator = createTestValidator();
    const memory = createMemoryStorage();
    const storage = createStorageAdapter(memory.backend, { warn() {} });
    const store = createVersionedStateStore({
        storage,
        key: 'party-v3',
        legacyKey: 'party-v2',
        version: 3,
        maxTeams: 2,
        validator
    });
    const defaults = [createEmptyPage('PAGE 1')];

    memory.values.set('party-v3', JSON.stringify({
        version: 2,
        currentPageIdx: 99,
        currentTeamIdx: 99,
        pages: [{
            pageName: ' imported ',
            teams: [{
                name: ' team ',
                chars: ['a', 'unknown', null, null],
                wheels: [['wheel-a', 'unknown'], [null, null], [null, null], [null, null]],
                key: 'unknown',
                supportIdx: 1
            }]
        }]
    }));
    const upgraded = store.load(defaults);
    assert.equal(upgraded.needsRewrite, true);
    assert.equal(upgraded.currentPageIdx, 0);
    assert.equal(upgraded.currentTeamIdx, 1);
    assert.deepEqual(upgraded.pages[0].teams[0].chars, ['a', null, null, null]);
    assert.deepEqual(upgraded.pages[0].teams[0].wheels[0], ['wheel-a', null]);
    assert.equal(upgraded.pages[0].teams[0].supportIdx, -1);
    assert.ok(store.save(upgraded));
    assert.equal(JSON.parse(memory.values.get('party-v3')).version, 3);

    memory.values.delete('party-v3');
    memory.values.set('party-v2', JSON.stringify([{
        ...createEmptyTeam(0),
        chars: ['b', null, null, null]
    }]));
    const migrated = store.load(defaults);
    assert.equal(migrated.usedLegacy, true);
    assert.equal(migrated.pages[0].teams[0].chars[0], 'b');
    assert.ok(store.clearLegacy());
    assert.equal(memory.values.has('party-v2'), false);

    memory.values.set('party-v3', '{broken');
    const recovered = store.load(defaults);
    assert.equal(recovered.recoveredCorruption, true);
    assert.equal(recovered.pages[0].teams.length, 2);
});

test('storage primitives normalize history and fail safely when storage is denied', () => {
    assert.equal(parseJson('{broken', 'fallback'), 'fallback');
    assert.deepEqual(normalizeStringArray([' a ', '', 'a', 3, 'b'], 2), ['a', 'b']);

    const denied = createStorageAdapter(() => {
        throw new Error('denied');
    }, { warn() {} });
    assert.equal(denied.getRaw('key'), null);
    assert.equal(denied.setRaw('key', 'value'), false);
    assert.equal(denied.remove('key'), false);
});

test('required party data is strictly validated and fetched through versioned URLs', async () => {
    const source = createRequiredPartyData();
    assert.equal(validatePartyBuilderData(source).characters[0].id, 'character-a');
    assert.throws(() => validatePartyBuilderData({ ...source, rules: {} }), /exclusive_groups/);

    const network = createPartyDataFetch(source);
    let readyCalls = 0;
    const result = await bootstrapPartyBuilder({
        loadData: () => loadRequiredPartyBuilderData({ fetchImpl: network.fetch, version: 'release 1' }),
        onDataReady(data) {
            readyCalls += 1;
            return data.characters[0].id;
        }
    });

    assert.equal(result, 'character-a');
    assert.equal(readyCalls, 1);
    assert.deepEqual(network.urls, [
        'data/character_manifest.json?v=release%201',
        'data/wheel_list.json?v=release%201',
        'data/silverkey_list.json?v=release%201',
        'data/party_builder_rules.json?v=release%201'
    ]);
});

test('failed required-data bootstrap cannot read, write, remove, or rewrite saved party bytes', async () => {
    const existingBytes = '{"version":2,"pages":[{"private":"unchanged"}]}';
    let storedBytes = existingBytes;
    const operations = { read: 0, write: 0, remove: 0 };
    const storage = {
        getItem() {
            operations.read += 1;
            return storedBytes;
        },
        setItem(_key, value) {
            operations.write += 1;
            storedBytes = String(value);
        },
        removeItem() {
            operations.remove += 1;
            storedBytes = null;
        }
    };
    const network = createPartyDataFetch(createRequiredPartyData(), { failingPath: 'data/wheel_list.json' });
    let readyCalls = 0;

    await assert.rejects(
        bootstrapPartyBuilder({
            loadData: () => loadRequiredPartyBuilderData({ fetchImpl: network.fetch, version: 'failure-test' }),
            onDataReady() {
                readyCalls += 1;
                storage.getItem('party');
                storage.setItem('party', 'rewritten');
                storage.removeItem('legacy');
            }
        }),
        /wheels request failed/
    );

    assert.equal(readyCalls, 0);
    assert.deepEqual(operations, { read: 0, write: 0, remove: 0 });
    assert.equal(storedBytes, existingBytes);
});

test('team share serialization excludes the name and sanitizes external references', () => {
    const validator = createTestValidator();
    const team = {
        name: 'PRIVATE NAME',
        chars: ['a', 'unknown', null, null],
        wheels: [['wheel-a', null], ['unknown', null], [null, null], [null, null]],
        key: 'key-a',
        supportIdx: -1
    };
    const payload = createTeamSharePayload(team);
    assert.equal('name' in payload, false);
    payload.wheels[0][0] = null;
    assert.equal(team.wheels[0][0], 'wheel-a');

    const serialized = serializeTeamShare(team);
    const parsed = parseAndSanitizeTeamShare(serialized, {
        validator,
        teamName: 'DESTINATION',
        teamIndex: 0
    });
    assert.equal(parsed.name, 'DESTINATION');
    assert.deepEqual(parsed.chars, ['a', null, null, null]);
    assert.deepEqual(parsed.wheels[0], ['wheel-a', null]);
    assert.throws(() => parseAndSanitizeTeamShare('{}', { validator, teamName: 'X', teamIndex: 0 }));
});

test('search helpers normalize tags, stats, dedicated targets, and choseong routing', () => {
    const matcher = createKeywordMatcher(['치명타 피해', '공격']);
    assert.deepEqual(matcher.find('치명타피해 증가'), ['치명타 피해']);
    assert.equal(normalizeWheelMainStat(' 영역숙련 12.5% '), '영역 숙련');
    assert.equal(normalizeDedicatedTarget('「 RAMONA 」'), 'ramona');

    const fakeSearchUtils = {
        isChoseongQuery: query => query === 'ㄹㅁㄴ',
        matchesSearchText: (text, query) => text === '라모나' && query === 'ㄹㅁㄴ'
    };
    assert.equal(matchesByQueryType('라모나', '라모나 RAMONA', 'ㄹㅁㄴ', fakeSearchUtils), true);
});

test('party builder uses one ES-module entry and no legacy core global bridge', async () => {
    const [html, controller, storage, validation, search, equipment, modalController, sharedTooltip, styles] = await Promise.all([
        readFile(new URL('../party_builder.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/party_builder.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/party-builder/storage.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/party-builder/validation.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/party-builder/search.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/party-builder/equipment.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/party-builder/modal-controller.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/ui/item-tooltip.js', import.meta.url), 'utf8'),
        readFile(new URL('../css/party_builder.css', import.meta.url), 'utf8')
    ]);

    assert.equal((html.match(/<script\s+type="module"/g) || []).length, 1);
    assert.match(html, /<script\s+type="module"\s+defer\s+src="js\/party_builder\.js\?v=/);
    assert.doesNotMatch(`${controller}\n${storage}\n${validation}\n${search}`, /MorimensPartyBuilderCore/);
    assert.doesNotMatch(`${storage}\n${validation}\n${search}\n${equipment}`, /\b(?:window|document)\b/);
    assert.match(controller, /from '\.\/party-builder\/equipment\.js\?v=/);
    assert.match(controller, /createPartyModalController/);
    assert.doesNotMatch(controller, /\bfunction\s+(?:openModal|closeModal|setupModalAccessibility)\b|\bmodalStack\b/);

    assert.match(modalController, /\[\.\.\.document\.body\.children\]/);
    assert.match(modalController, /document\.addEventListener\('focusin',[\s\S]*?, true\)/);
    assert.match(modalController, /!dialog\.contains\(document\.activeElement\)/);
    assert.match(modalController, /new window\.MutationObserver/);
    assert.match(modalController, /observe\(document\.body, \{ childList: true \}\)/);

    assert.match(html, /id="party-save-error"[^>]*role="alert"[^>]*hidden/);
    assert.match(controller, /if \(!saved\)[\s\S]*setPersistentSaveError\(message\)[\s\S]*return false;[\s\S]*setPersistentSaveError\(''\)/);
    assert.match(controller, /t\.setAttribute\('aria-hidden', 'true'\)/);
    assert.match(controller, /liveRegion && tone !== 'error'/);
    assert.doesNotMatch(controller, /t\.setAttribute\('role'/);
    assert.match(controller, /movePersistentSaveErrorToActiveDialog/);
    assert.match(controller, /alert\.dataset\.modalPortal = 'true'/);
    assert.match(styles, /\.party-save-error\[data-modal-portal="true"\]/);
    assert.match(html, /id="party-init-error"[^>]*role="alert"[^>]*hidden/);
    assert.match(html, /id="party-builder-main"[^>]*inert[^>]*aria-busy="true"/);
    assert.match(controller, /bootstrapPartyBuilder/);
    assert.doesNotMatch(controller, /party_builder_rules\.json[^\n]*\.catch|loadPartyBuilderRules/);

    assert.match(controller, /createItemTooltipController/);
    assert.match(controller, /pinOnLongPress:\s*true[\s\S]*pinWithAltArrow:\s*true/);
    assert.match(sharedTooltip, /setAttribute\('role', pinned \? 'dialog' : 'tooltip'\)/);
    assert.match(sharedTooltip, /hide\(\{ force: true, restoreFocus: true \}\)/);
    assert.match(styles, /\.item-tooltip[\s\S]*max-block-size:[\s\S]*overflow-y:\s*auto/);
    assert.match(styles, /\.item-tooltip\[data-pinned="true"\][\s\S]*pointer-events:\s*auto/);
    assert.match(controller, /el\.dataset\.characterId = id/);
    assert.match(controller, /renderCharGrid\(\);\s*requestAnimationFrame\(\(\) => restoreCharacterGridFocus\(id\)\)/);
    assert.match(controller, /page-tab-\$\{currentPageIdx\}`\)\?\.focus/);
    assert.match(controller, /currentPageIdx = resolvePageIndexAfterDeletion\(currentPageIdx, index, allPages\.length\)/);
    assert.match(controller, /resolveSuccessFocus: \(\) => document\.getElementById\(`page-tab-\$\{currentPageIdx\}`\)/);
    assert.match(controller, /const returnTarget = explicitTarget \|\| partyModalController\.resolveReturnFocusRecord\(returnRecord\)/);
    const deletePageBlock = controller.slice(
        controller.indexOf('function deletePage(index)'),
        controller.indexOf('function renderSidebar', controller.indexOf('function deletePage(index)'))
    );
    assert.doesNotMatch(deletePageBlock, /requestAnimationFrame/);

    const compactWheelStart = styles.indexOf('@media (max-height: 37.5rem)');
    const compactWheelEnd = styles.indexOf('@media (prefers-reduced-motion', compactWheelStart);
    const compactWheelBlock = styles.slice(compactWheelStart, compactWheelEnd);
    assert.match(compactWheelBlock, /\.wheel-equip-panel h3\s*\{\s*display:\s*none/);
    assert.doesNotMatch(compactWheelBlock, /\.equip-info-text\s*\{\s*display:\s*none/);
    assert.match(compactWheelBlock, /\.equip-info-text[\s\S]*overflow-y:\s*auto/);

    assert.match(html, /<title>융재금구 파티 시뮬레이터/);
    assert.match(html, /id="domain-filter-label">계역</);
    assert.doesNotMatch(`${html}\n${controller}`, /영역 충돌|현재 영역|융재금지구역|융재 금구/);
});
