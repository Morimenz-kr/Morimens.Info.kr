import {
    lstat,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    writeFile
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
    SAFE_RUNTIME_ROUTE_KEY,
    compareCodeUnits,
    isPlainObject,
    serializeDeterministicJson
} from '../shared/runtime-data-shards.js';
import {
    RESOURCE_CATEGORY_IDS,
    RESOURCE_CATEGORY_TITLES
} from '../shared/resource-categories.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.join(ROOT, 'data');
const RESOURCE_LINKS_PATH = path.join(DATA_ROOT, 'resource_links.json');
const CHARACTER_EFFECTS_PATH = path.join(DATA_ROOT, 'character_effects.json');
const CHARACTER_MANIFEST_PATH = path.join(DATA_ROOT, 'character_manifest.json');
const RUNTIME_INDEX_PATH = 'data/runtime-index.json';
const MANAGED_DIRECTORIES = [
    'data/resource-links',
    'data/character-effects'
];
const SAFE_ROUTE_KEY = SAFE_RUNTIME_ROUTE_KEY;

const argumentsList = process.argv.slice(2);
const checkOnly = argumentsList.length === 1 && argumentsList[0] === '--check';
if (argumentsList.length > 0 && !checkOnly) {
    throw new Error('Usage: node tools/generate-data-shards.mjs [--check]');
}

function requirePlainObject(value, label) {
    if (!isPlainObject(value)) throw new Error(`${label} must be a JSON object`);
    return value;
}

function validateRouteKeys(keys, label) {
    const caseInsensitive = new Map();
    for (const key of keys) {
        if (typeof key !== 'string' || !SAFE_ROUTE_KEY.test(key)) {
            throw new Error(`${label} contains an unsafe route key: ${JSON.stringify(key)}`);
        }
        const folded = key.toLowerCase();
        const previous = caseInsensitive.get(folded);
        if (previous && previous !== key) {
            throw new Error(`${label} contains a case-insensitive filename collision: ${previous}, ${key}`);
        }
        caseInsensitive.set(folded, key);
    }
}

function assertExactKeySet(actualKeys, expectedKeys, label) {
    const actual = [...actualKeys].sort(compareCodeUnits);
    const expected = [...expectedKeys].sort(compareCodeUnits);
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
        const expectedSet = new Set(expected);
        const actualSet = new Set(actual);
        const missing = expected.filter(key => !actualSet.has(key));
        const extra = actual.filter(key => !expectedSet.has(key));
        throw new Error(`${label} keys must match character_manifest.json (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`);
    }
}

function serializeJson(value) {
    return Buffer.from(serializeDeterministicJson(value), 'utf8');
}

async function readJson(file, label) {
    let source;
    try {
        source = await readFile(file, 'utf8');
    } catch (error) {
        throw new Error(`Cannot read ${label}: ${error.message}`);
    }

    try {
        return JSON.parse(source);
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error.message}`);
    }
}

function toProjectPath(...segments) {
    return segments.join('/');
}

function toAbsolute(projectPath) {
    const absolute = path.resolve(ROOT, ...projectPath.split('/'));
    const relative = path.relative(DATA_ROOT, absolute);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Generated path escapes data/: ${projectPath}`);
    }
    return absolute;
}

async function buildDesiredFiles() {
    const [resourceLinks, characterEffects, manifest] = await Promise.all([
        readJson(RESOURCE_LINKS_PATH, 'data/resource_links.json'),
        readJson(CHARACTER_EFFECTS_PATH, 'data/character_effects.json'),
        readJson(CHARACTER_MANIFEST_PATH, 'data/character_manifest.json')
    ]);

    requirePlainObject(resourceLinks, 'data/resource_links.json');
    const categories = requirePlainObject(resourceLinks.categories, 'resource_links.categories');
    const resourceCharacters = requirePlainObject(resourceLinks.characters, 'resource_links.characters');
    requirePlainObject(characterEffects, 'data/character_effects.json');
    if (!Array.isArray(manifest) || manifest.length === 0) {
        throw new Error('data/character_manifest.json must be a non-empty array');
    }

    const manifestIds = manifest.map((character, index) => {
        requirePlainObject(character, `character_manifest[${index}]`);
        if (typeof character.id !== 'string' || character.id !== character.id.trim()) {
            throw new Error(`character_manifest[${index}].id must be a trimmed string`);
        }
        return character.id;
    });
    const categoryIds = Object.keys(categories);
    const resourceCharacterIds = Object.keys(resourceCharacters);
    const effectCharacterIds = Object.keys(characterEffects);

    validateRouteKeys(manifestIds, 'character_manifest');
    validateRouteKeys(categoryIds, 'resource_links.categories');
    validateRouteKeys(resourceCharacterIds, 'resource_links.characters');
    validateRouteKeys(effectCharacterIds, 'character_effects');
    if (new Set(manifestIds).size !== manifestIds.length) {
        throw new Error('character_manifest contains duplicate ids');
    }
    assertExactKeySet(resourceCharacterIds, manifestIds, 'resource_links.characters');
    assertExactKeySet(effectCharacterIds, manifestIds, 'character_effects');
    assertExactKeySet(categoryIds, RESOURCE_CATEGORY_IDS, 'resource_links.categories');

    for (const categoryId of categoryIds) {
        const category = requirePlainObject(categories[categoryId], `resource_links.categories.${categoryId}`);
        if (category.title !== RESOURCE_CATEGORY_TITLES[categoryId]) {
            throw new Error(`resource_links.categories.${categoryId}.title must equal ${JSON.stringify(RESOURCE_CATEGORY_TITLES[categoryId])}`);
        }
        if (!Array.isArray(category.links)) {
            throw new Error(`resource_links.categories.${categoryId}.links must be an array`);
        }
    }
    for (const characterId of manifestIds) {
        if (!Array.isArray(resourceCharacters[characterId])) {
            throw new Error(`resource_links.characters.${characterId} must be an array`);
        }
        requirePlainObject(characterEffects[characterId], `character_effects.${characterId}`);
    }

    const index = {
        schemaVersion: 1,
        resourceLinks: {
            categories: {},
            characters: {}
        },
        characterEffects: {}
    };
    const desired = new Map();

    for (const categoryId of [...categoryIds].sort(compareCodeUnits)) {
        const route = toProjectPath('data', 'resource-links', 'categories', `${categoryId}.json`);
        index.resourceLinks.categories[categoryId] = route;
        desired.set(route, serializeJson(categories[categoryId]));
    }
    for (const characterId of [...manifestIds].sort(compareCodeUnits)) {
        const resourceRoute = toProjectPath('data', 'resource-links', 'characters', `${characterId}.json`);
        const effectsRoute = toProjectPath('data', 'character-effects', `${characterId}.json`);
        index.resourceLinks.characters[characterId] = resourceRoute;
        index.characterEffects[characterId] = effectsRoute;
        desired.set(resourceRoute, serializeJson(resourceCharacters[characterId]));
        desired.set(effectsRoute, serializeJson(characterEffects[characterId]));
    }
    desired.set(RUNTIME_INDEX_PATH, serializeJson(index));

    return {
        desired,
        counts: {
            categories: categoryIds.length,
            characters: manifestIds.length,
            effects: manifestIds.length
        }
    };
}

async function collectFiles(projectDirectory) {
    const root = toAbsolute(projectDirectory);
    const files = [];

    async function visit(directory) {
        let entries;
        try {
            entries = await readdir(directory, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
        }

        for (const entry of entries) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(absolute);
                continue;
            }
            if (!entry.isFile() && !entry.isSymbolicLink()) {
                throw new Error(`Unsupported entry in generated data directory: ${absolute}`);
            }
            files.push(path.relative(ROOT, absolute).replaceAll(path.sep, '/'));
        }
    }

    await visit(root);
    return files;
}

async function inspectSynchronization(desired) {
    const actual = new Set();
    for (const directory of MANAGED_DIRECTORIES) {
        for (const file of await collectFiles(directory)) actual.add(file);
    }
    try {
        const metadata = await lstat(toAbsolute(RUNTIME_INDEX_PATH));
        if (metadata.isFile()) actual.add(RUNTIME_INDEX_PATH);
        else actual.add(`${RUNTIME_INDEX_PATH} (not a file)`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    const issues = [];
    for (const [projectPath, expected] of desired) {
        let actualBytes;
        try {
            actualBytes = await readFile(toAbsolute(projectPath));
        } catch (error) {
            if (error.code === 'ENOENT') {
                issues.push(`missing ${projectPath}`);
                continue;
            }
            throw error;
        }
        if (!actualBytes.equals(expected)) issues.push(`changed ${projectPath}`);
    }
    for (const projectPath of actual) {
        if (!desired.has(projectPath)) issues.push(`unexpected ${projectPath}`);
    }
    return issues.sort(compareCodeUnits);
}

async function writeDesiredFiles(desired) {
    const expectedPaths = new Set(desired.keys());
    for (const directory of MANAGED_DIRECTORIES) {
        for (const projectPath of await collectFiles(directory)) {
            if (!expectedPaths.has(projectPath)) {
                await rm(toAbsolute(projectPath), { force: true });
            }
        }
    }

    let written = 0;
    for (const [projectPath, content] of [...desired].sort(([left], [right]) => compareCodeUnits(left, right))) {
        const destination = toAbsolute(projectPath);
        let current = null;
        try {
            current = await readFile(destination);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        if (current?.equals(content)) continue;

        await mkdir(path.dirname(destination), { recursive: true });
        const temporary = `${destination}.tmp-${process.pid}`;
        await writeFile(temporary, content);
        await rename(temporary, destination);
        written += 1;
    }
    return written;
}

const { desired, counts } = await buildDesiredFiles();
if (checkOnly) {
    const issues = await inspectSynchronization(desired);
    if (issues.length > 0) {
        console.error('Runtime data shards are out of sync with their canonical sources:');
        for (const issue of issues.slice(0, 20)) console.error(`- ${issue}`);
        if (issues.length > 20) console.error(`- ... and ${issues.length - 20} more`);
        console.error('Run: node tools/generate-data-shards.mjs');
        process.exitCode = 1;
    } else {
        console.log(`Runtime data shards are synchronized (${counts.categories} categories, ${counts.characters} resource-link characters, ${counts.effects} character effects).`);
    }
} else {
    const written = await writeDesiredFiles(desired);
    const issues = await inspectSynchronization(desired);
    if (issues.length > 0) {
        throw new Error(`Generated runtime data failed verification: ${issues.join('; ')}`);
    }
    console.log(`Generated ${desired.size} runtime data files (${written} written; ${counts.categories} categories, ${counts.characters} resource-link characters, ${counts.effects} character effects).`);
}
