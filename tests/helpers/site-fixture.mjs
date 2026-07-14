import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = path.join(ROOT, 'dist');

export async function readJson(relativePath) {
    return JSON.parse(await readFile(path.join(ROOT, relativePath), 'utf8'));
}

export async function walkFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await walkFiles(absolute));
        else if (entry.isFile()) files.push(absolute);
    }
    return files;
}

export function relativeTo(base, file) {
    return path.relative(base, file).replaceAll(path.sep, '/');
}

export function assertSafeProjectPath(assert, value, label) {
    assert.equal(typeof value, 'string', `${label} must be a string`);
    assert.ok(value.length > 0, `${label} must not be empty`);
    assert.ok(!value.includes('\\'), `${label} must use URL separators: ${value}`);
    assert.ok(!/^[a-z][a-z\d+.-]*:/i.test(value), `${label} must not use a URL scheme: ${value}`);

    let decodedPath;
    try {
        decodedPath = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    } catch {
        assert.fail(`${label} contains invalid URL encoding: ${value}`);
    }

    assert.ok(!path.isAbsolute(decodedPath), `${label} must be relative: ${value}`);
    assert.ok(!decodedPath.split('/').includes('..'), `${label} must not contain parent traversal: ${value}`);
    const normalized = path.posix.normalize(decodedPath);
    assert.ok(normalized !== '..' && !normalized.startsWith('../'), `${label} escapes the repository: ${value}`);
}

export async function assertExactCaseProjectFile(assert, value, label) {
    assertSafeProjectPath(assert, value, label);
    const decodedPath = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    let current = ROOT;

    for (const segment of decodedPath.split('/').filter(Boolean)) {
        const names = await readdir(current);
        if (!names.includes(segment)) {
            const caseInsensitiveMatch = names.find(name => name.toLowerCase() === segment.toLowerCase());
            assert.fail(caseInsensitiveMatch
                ? `${label} has incorrect filename case: ${segment} (actual: ${caseInsensitiveMatch})`
                : `${label} does not exist: ${value}`);
        }
        current = path.join(current, segment);
    }

    const metadata = await stat(current);
    assert.ok(metadata.isFile(), `${label} must resolve to a file: ${value}`);
    assert.ok(metadata.size > 0, `${label} is empty: ${value}`);
    return current;
}

export async function fileSize(file) {
    return (await stat(file)).size;
}
