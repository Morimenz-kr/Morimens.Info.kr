import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
    CHARACTER_CLASS_LABELS,
    CHARACTER_CLASS_ORDER,
    RELEMS_LABELS,
    RELEMS_ORDER
} from '../js/domain/character-taxonomy.js';
import {
    ROOT,
    assertExactCaseProjectFile,
    assertSafeProjectPath,
    readJson
} from './helpers/site-fixture.mjs';

const RELICS = new Set(RELEMS_ORDER);
const CLASSES = new Set(CHARACTER_CLASS_ORDER);
const GRADES = new Set(['ssr', 'sr']);

function assertUnique(values, label) {
    const seen = new Set();
    for (const value of values) {
        assert.ok(!seen.has(value), `${label} contains a duplicate: ${value}`);
        seen.add(value);
    }
}

function compareVersionParts(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        const difference = (left[index] || 0) - (right[index] || 0);
        if (difference !== 0) return difference;
    }
    return 0;
}

async function assertExistingImage(imagePath, label) {
    assertSafeProjectPath(assert, imagePath, label);
    assert.ok(imagePath.startsWith('images/'), `${label} must be under images/: ${imagePath}`);
    assert.equal(path.posix.extname(imagePath).toLowerCase(), '.webp', `${label} must use WebP: ${imagePath}`);
    await assert.doesNotReject(access(path.join(ROOT, imagePath)), `${label} does not exist: ${imagePath}`);
    assert.ok((await stat(path.join(ROOT, imagePath))).size > 0, `${label} is empty: ${imagePath}`);
}

test('character registry has one canonical ID set and valid presentation fields', async () => {
    const [manifest, settings, effects] = await Promise.all([
        readJson('data/character_manifest.json'),
        readJson('data/character_settings.json'),
        readJson('data/character_effects.json')
    ]);

    assert.ok(Array.isArray(manifest) && manifest.length > 0, 'character manifest must be a non-empty array');
    const ids = manifest.map(character => character.id);
    assertUnique(ids, 'character ids');
    assertUnique(ids.map(id => String(id).toLowerCase()), 'case-insensitive character ids');
    assert.deepEqual(Object.keys(settings).sort(), [...ids].sort(), 'settings keys must exactly match manifest ids');
    assert.deepEqual(Object.keys(effects).sort(), [...ids].sort(), 'effects keys must exactly match manifest ids');

    for (const character of manifest) {
        assert.match(character.id, /^[A-Za-z0-9_-]+$/, `invalid character id: ${character.id}`);
        assert.ok(String(character.name || '').trim(), `${character.id} must have a display name`);
        assert.ok(RELICS.has(character.relems), `${character.id} has invalid relems: ${character.relems}`);
        assert.ok(CLASSES.has(character.class), `${character.id} has invalid class: ${character.class}`);
        assert.ok(GRADES.has(character.grade), `${character.id} has invalid grade: ${character.grade}`);
        await assertExistingImage(character.image_thumb, `${character.id}.image_thumb`);
        await assertExistingImage(`images/${character.id}_tide.webp`, `${character.id} tide image`);
    }
});

test('character taxonomy is canonical across list, inventory, and party controls', async () => {
    assert.deepEqual(RELEMS_LABELS, {
        chaos: '혼돈',
        aequor: '심해',
        caro: '혈육',
        ultra: '초차원'
    });
    assert.deepEqual(CHARACTER_CLASS_LABELS, {
        assault: '공격형',
        warden: '방어형',
        chorus: '보조형'
    });

    const pageContracts = await Promise.all([
        ['list.html', 'value'],
        ['inventory_checker.html', 'data-character-class-filter'],
        ['party_builder.html', 'data-filter-value']
    ].map(async ([relativePath, attribute]) => ({
        relativePath,
        attribute,
        source: await readFile(path.join(ROOT, relativePath), 'utf8')
    })));

    for (const [id, label] of Object.entries(CHARACTER_CLASS_LABELS)) {
        for (const { relativePath, attribute, source } of pageContracts) {
            assert.ok(
                source.includes(`${attribute}="${id}"`) && source.includes(`>${label}<`),
                `${relativePath} must use the canonical ${id} label ${label}`
            );
        }
    }
    assert.ok(
        pageContracts.every(({ source }) => !source.includes('데미지형')),
        'deprecated class label must not reappear'
    );
});

test('gacha and party rules reference only registered characters', async () => {
    const [manifest, gachatype, rules] = await Promise.all([
        readJson('data/character_manifest.json'),
        readJson('data/gachatype.json'),
        readJson('data/party_builder_rules.json')
    ]);
    const ids = new Set(manifest.map(character => character.id));
    const gachaIds = Object.values(gachatype).flat();

    for (const id of gachaIds) assert.ok(ids.has(id), `gachatype references unknown character: ${id}`);
    for (const id of ids) assert.ok(gachaIds.includes(id), `gachatype omits character: ${id}`);
    for (const [group, characterIds] of Object.entries(gachatype)) {
        assert.ok(Array.isArray(characterIds) && characterIds.length > 0, `gachatype.${group} must not be empty`);
        assertUnique(characterIds, `gachatype.${group}`);
    }

    for (const [index, group] of rules.exclusive_groups.entries()) {
        assert.ok(Array.isArray(group) && group.length >= 2, `exclusive_groups[${index}] must contain at least two ids`);
        assertUnique(group, `exclusive_groups[${index}]`);
        for (const id of group) assert.ok(ids.has(id), `exclusive_groups[${index}] references unknown character: ${id}`);
    }
    for (const [tag, characterIds] of Object.entries(rules.character_tags)) {
        assert.ok(Array.isArray(characterIds) && characterIds.length > 0, `character_tags.${tag} must not be empty`);
        assertUnique(characterIds, `character_tags.${tag}`);
        for (const id of characterIds) assert.ok(ids.has(id), `character_tags.${tag} references unknown character: ${id}`);
    }
    for (const tag of Object.keys(rules.tag_aliases || {})) {
        assert.ok(Object.hasOwn(rules.character_tags, tag), `tag_aliases references unknown tag: ${tag}`);
    }
    for (const [tag, aliases] of Object.entries(rules.tag_aliases || {})) {
        assert.ok(Array.isArray(aliases) && aliases.length > 0, `tag_aliases.${tag} must not be empty`);
        assertUnique(aliases, `tag_aliases.${tag}`);
        assert.ok(aliases.every(alias => String(alias).trim()), `tag_aliases.${tag} contains an empty alias`);
    }
    for (const [characterId, aliases] of Object.entries(rules.dedicated_wheel_aliases || {})) {
        assert.ok(ids.has(characterId), `dedicated_wheel_aliases references unknown character: ${characterId}`);
        assert.ok(Array.isArray(aliases) && aliases.length > 0, `dedicated_wheel_aliases.${characterId} must not be empty`);
        assertUnique(aliases, `dedicated_wheel_aliases.${characterId}`);
        assert.ok(aliases.every(alias => String(alias).trim()), `dedicated_wheel_aliases.${characterId} contains an empty alias`);
    }
});

test('equipment catalogs have stable unique IDs, local WebP images, and valid owners', async () => {
    const [manifest, wheels, silverkeys, covenants] = await Promise.all([
        readJson('data/character_manifest.json'),
        readJson('data/wheel_list.json'),
        readJson('data/silverkey_list.json'),
        readJson('data/covenant_list.json')
    ]);
    const characterIds = new Set(manifest.map(character => character.id));

    for (const [catalogName, items] of Object.entries({ wheels, silverkeys, covenants })) {
        assert.ok(Array.isArray(items) && items.length > 0, `${catalogName} must be a non-empty array`);
        assertUnique(items.map(item => item.english_name), `${catalogName} english_name`);
        assertUnique(items.map(item => item.english_name.toLowerCase()), `${catalogName} case-insensitive english_name`);
        for (const item of items) {
            assert.match(item.english_name, /^[A-Za-z0-9_-]+$/, `${catalogName} has invalid id: ${item.english_name}`);
            assert.ok(String(item.korean_name || '').trim(), `${catalogName}.${item.english_name} must have a display name`);
            await assertExistingImage(item.image_path, `${catalogName}.${item.english_name}.image_path`);
            for (const ownerId of item.owner_character_ids || []) {
                assert.ok(characterIds.has(ownerId), `${catalogName}.${item.english_name} has unknown owner: ${ownerId}`);
            }
        }
    }

    for (const wheel of wheels) {
        assert.ok(new Set(['SSR', 'SR', 'R']).has(wheel.grade), `${wheel.english_name} has invalid wheel grade: ${wheel.grade}`);
    }
});

test('character settings reference existing equipment IDs or declare an explicit pending state', async () => {
    const [settings, wheels, covenants] = await Promise.all([
        readJson('data/character_settings.json'),
        readJson('data/wheel_list.json'),
        readJson('data/covenant_list.json')
    ]);
    const wheelById = new Map(wheels.map(item => [item.english_name, item]));
    const wheelIds = new Set(wheelById.keys());
    const covenantIds = new Set(covenants.map(item => item.english_name));

    function settingBlocks(value) {
        return Array.isArray(value) ? value : [value];
    }

    function referencedIds(block) {
        return [block?.main_id, ...(Array.isArray(block?.substitutes) ? block.substitutes : [])].filter(Boolean);
    }

    for (const [characterId, value] of Object.entries(settings)) {
        if (!Array.isArray(value) && value?.status === 'pending') {
            assert.ok(String(value.message || '').trim(), `${characterId} pending settings need a user-facing message`);
            continue;
        }

        for (const [index, setting] of settingBlocks(value).entries()) {
            const label = `${characterId}[${index}]`;
            assert.ok(setting && typeof setting === 'object', `${label} must be an object`);
            const ssrIds = referencedIds(setting.myeongryun_ssr);
            const srIds = referencedIds(setting.myeongryun_sr);
            const covenantSettingIds = referencedIds(setting.covenant);
            assertUnique(ssrIds, `${label}.myeongryun_ssr`);
            assertUnique(srIds, `${label}.myeongryun_sr`);
            assertUnique(covenantSettingIds, `${label}.covenant`);
            for (const id of ssrIds) {
                assert.ok(wheelIds.has(id), `${label} references unknown SSR wheel: ${id}`);
                assert.equal(wheelById.get(id)?.grade, 'SSR', `${label} uses a non-SSR wheel in the SSR slot: ${id}`);
            }
            for (const id of srIds) {
                assert.ok(wheelIds.has(id), `${label} references unknown SR wheel: ${id}`);
                assert.equal(wheelById.get(id)?.grade, 'SR', `${label} uses a non-SR wheel in the SR slot: ${id}`);
            }
            for (const id of covenantSettingIds) {
                assert.ok(covenantIds.has(id), `${label} references unknown covenant: ${id}`);
            }
        }
    }
});

test('resource link destinations use safe public or local protocols', async () => {
    const [resources, manifest] = await Promise.all([
        readJson('data/resource_links.json'),
        readJson('data/character_manifest.json')
    ]);
    const characterIds = new Set(manifest.map(character => character.id));
    for (const characterId of Object.keys(resources.characters)) {
        assert.ok(characterIds.has(characterId), `resource links reference unknown character: ${characterId}`);
    }
    const links = [
        ...Object.entries(resources.categories).flatMap(([categoryId, category]) =>
            (category.links || []).map(link => ({ categoryId, link }))),
        ...Object.entries(resources.characters).flatMap(([characterId, characterLinks]) =>
            characterLinks.map(link => ({ categoryId: `character:${characterId}`, link })))
    ];

    assert.ok(links.length > 0, 'resource link catalog must not be empty');
    for (const [index, { categoryId, link }] of links.entries()) {
        assert.ok(String(link.title || '').trim(), `resource link ${index} has no title`);
        const value = String(link.url || '').trim();
        if (!value) {
            assert.equal(categoryId, 'code', `only exchange-code entries may omit a URL (entry ${index})`);
            if (link.expiry !== null && link.expiry !== undefined) {
                assert.match(link.expiry, /^\d{4}-\d{2}-\d{2}$/, `exchange-code entry ${index} has an invalid expiry`);
                const expiryTime = Date.parse(`${link.expiry}T00:00:00Z`);
                assert.equal(new Date(expiryTime).toISOString().slice(0, 10), link.expiry, `exchange-code entry ${index} has an impossible expiry`);
            }
            continue;
        }
        assert.ok(!/[\u0000-\u001F\u007F]/.test(value), `resource link ${index} contains a control character`);
        if (/^https?:\/\//i.test(value)) {
            const url = new URL(value);
            assert.equal(url.protocol, 'https:', `resource link ${index} must use HTTPS`);
            assert.ok(url.hostname, `resource link ${index} has no hostname`);
            assert.equal(url.username, '', `resource link ${index} must not embed credentials`);
            assert.equal(url.password, '', `resource link ${index} must not embed credentials`);
        } else {
            assertSafeProjectPath(assert, value, `resource link ${index}`);
            assert.equal(path.posix.extname(value.split(/[?#]/, 1)[0]), '.html', `local resource link ${index} must target a page`);
        }

        const imageValue = String(link.image || '').trim();
        assert.ok(imageValue, `non-code resource link ${index} has no image`);
        if (/^https?:\/\//i.test(imageValue)) {
            const imageUrl = new URL(imageValue);
            assert.equal(imageUrl.protocol, 'https:', `resource image ${index} must use HTTPS`);
            assert.ok(imageUrl.hostname, `resource image ${index} has no hostname`);
            assert.equal(imageUrl.username, '', `resource image ${index} must not embed credentials`);
            assert.equal(imageUrl.password, '', `resource image ${index} must not embed credentials`);
        } else {
            assertSafeProjectPath(assert, imageValue, `resource image ${index}`);
            assert.ok(imageValue.startsWith('images/'), `local resource image ${index} must be under images/: ${imageValue}`);
            assert.equal(path.posix.extname(imageValue.split(/[?#]/, 1)[0]).toLowerCase(), '.webp', `local resource image ${index} must use WebP`);
            await assertExactCaseProjectFile(assert, imageValue, `resource image ${index}`);
        }
    }
});

test('patch notes are unique and reverse chronological', async () => {
    const notes = await readJson('data/patch_notes.json');
    assert.ok(Array.isArray(notes) && notes.length > 0, 'patch notes must be a non-empty array');
    assertUnique(notes.map(note => note.version), 'patch note versions');

    let previousTime = Number.POSITIVE_INFINITY;
    let previousVersion = null;
    for (const note of notes) {
        assert.match(note.version, /^v\d+\.\d+\.\d+$/, `invalid patch version: ${note.version}`);
        assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/, `invalid patch date: ${note.date}`);
        const timestamp = Date.parse(`${note.date}T00:00:00Z`);
        assert.ok(Number.isFinite(timestamp), `invalid patch date: ${note.date}`);
        assert.equal(new Date(timestamp).toISOString().slice(0, 10), note.date, `impossible patch date: ${note.date}`);
        assert.ok(timestamp <= previousTime, `patch notes are not reverse chronological at ${note.version}`);
        assert.ok(Array.isArray(note.changes) && note.changes.length > 0, `${note.version} has no changes`);
        const version = note.version.slice(1).split('.').map(Number);
        if (previousVersion) {
            assert.ok(compareVersionParts(previousVersion, version) > 0, `patch versions are not strictly descending at ${note.version}`);
        }
        previousTime = timestamp;
        previousVersion = version;
    }
});
