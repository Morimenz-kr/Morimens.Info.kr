import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
    ROOT,
    readJson,
    relativeTo,
    walkFiles
} from './helpers/site-fixture.mjs';
import {
    compareCodeUnits,
    serializeDeterministicJson
} from '../shared/runtime-data-shards.js';
import {
    RESOURCE_CATEGORY_IDS,
    RESOURCE_CATEGORY_TITLES
} from '../shared/resource-categories.js';

const SAFE_ROUTE_KEY = /^[A-Za-z0-9_-]{1,80}$/;

function buildRouteMap(keys, directory) {
    return Object.fromEntries(
        [...keys]
            .sort(compareCodeUnits)
            .map(key => [key, `${directory}/${key}.json`])
    );
}

async function assertDeterministicJson(relative) {
    const bytes = await readFile(path.join(ROOT, ...relative.split('/')));
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!source.startsWith('\uFEFF'), `${relative} must not contain a UTF-8 BOM`);
    assert.ok(source.endsWith('\n'), `${relative} must end with a newline`);
    assert.equal(
        source,
        serializeDeterministicJson(JSON.parse(source)),
        `${relative} is not deterministically sorted and formatted`
    );
}

test('runtime index maps every safe canonical key to one deterministic shard', async () => {
    const [index, manifest, resources] = await Promise.all([
        readJson('data/runtime-index.json'),
        readJson('data/character_manifest.json'),
        readJson('data/resource_links.json')
    ]);
    const characterIds = manifest.map(character => character.id);
    const categoryIds = Object.keys(resources.categories);

    assert.deepEqual(categoryIds, [...RESOURCE_CATEGORY_IDS], 'canonical categories must match the shared Worker taxonomy');
    for (const categoryId of categoryIds) {
        assert.equal(
            resources.categories[categoryId].title,
            RESOURCE_CATEGORY_TITLES[categoryId],
            `category title contract drifted: ${categoryId}`
        );
    }

    for (const id of [...characterIds, ...categoryIds]) {
        assert.match(id, SAFE_ROUTE_KEY, `unsafe runtime shard key: ${id}`);
    }
    assert.equal(
        new Set(characterIds.map(id => id.toLowerCase())).size,
        characterIds.length,
        'character ids must not collide on case-insensitive filesystems'
    );
    assert.equal(
        new Set(categoryIds.map(id => id.toLowerCase())).size,
        categoryIds.length,
        'category ids must not collide on case-insensitive filesystems'
    );

    const expectedIndex = {
        schemaVersion: 1,
        resourceLinks: {
            categories: buildRouteMap(categoryIds, 'data/resource-links/categories'),
            characters: buildRouteMap(characterIds, 'data/resource-links/characters')
        },
        characterEffects: buildRouteMap(characterIds, 'data/character-effects')
    };
    assert.deepEqual(index, expectedIndex);
    await assertDeterministicJson('data/runtime-index.json');

    const indexedRoutes = [
        ...Object.values(index.resourceLinks.categories),
        ...Object.values(index.resourceLinks.characters),
        ...Object.values(index.characterEffects)
    ];
    assert.equal(new Set(indexedRoutes).size, indexedRoutes.length, 'runtime shard routes must be unique');

    const actualRoutes = [
        ...await walkFiles(path.join(ROOT, 'data', 'resource-links')),
        ...await walkFiles(path.join(ROOT, 'data', 'character-effects'))
    ].map(file => relativeTo(ROOT, file)).sort(compareCodeUnits);
    assert.deepEqual(actualRoutes, indexedRoutes.sort(compareCodeUnits), 'generated shard directories contain missing or stale files');
});

test('runtime shards preserve their canonical resource-link and character-effect subtrees', async () => {
    const [index, resources, effects] = await Promise.all([
        readJson('data/runtime-index.json'),
        readJson('data/resource_links.json'),
        readJson('data/character_effects.json')
    ]);

    for (const [categoryId, route] of Object.entries(index.resourceLinks.categories)) {
        assert.deepEqual(await readJson(route), resources.categories[categoryId], `${route} differs from its canonical category`);
        await assertDeterministicJson(route);
    }
    for (const [characterId, route] of Object.entries(index.resourceLinks.characters)) {
        assert.deepEqual(await readJson(route), resources.characters[characterId], `${route} differs from its canonical character links`);
        await assertDeterministicJson(route);
    }
    for (const [characterId, route] of Object.entries(index.characterEffects)) {
        assert.deepEqual(await readJson(route), effects[characterId], `${route} differs from its canonical character effects`);
        await assertDeterministicJson(route);
    }
});
