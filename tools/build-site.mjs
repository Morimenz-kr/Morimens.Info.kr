import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'dist');
const SOCIAL_PREVIEW = path.join(ROOT, 'images', 'background.png');
const SITE_DIRECTORIES = ['config', 'css', 'data', 'images', 'js'];
const CANONICAL_DATA_SOURCES = new Set([
    path.join(ROOT, 'data', 'character_effects.json'),
    path.join(ROOT, 'data', 'resource_links.json')
].map(file => path.resolve(file)));
const EXCLUDED_EXTENSIONS = new Set(['.zip', '.psd', '.ai', '.jpg', '.jpeg', '.gif', '.map']);
const EXCLUDED_NAMES = new Set(['Thumbs.db', '.DS_Store']);

function isInsideRoot(candidate, parent) {
    const relative = path.relative(parent, candidate);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function copyDirectory(source, destination) {
    await cp(source, destination, {
        recursive: true,
        filter: (entry) => {
            if (CANONICAL_DATA_SOURCES.has(path.resolve(entry))) return false;
            const name = path.basename(entry);
            if (EXCLUDED_NAMES.has(name)) return false;
            if (path.extname(name).toLowerCase() === '.png') return path.resolve(entry) === SOCIAL_PREVIEW;
            return !EXCLUDED_EXTENSIONS.has(path.extname(name).toLowerCase());
        }
    });
}

async function collectFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await collectFiles(absolute));
        else if (entry.isFile()) files.push(absolute);
    }
    return files;
}

async function build() {
    if (!isInsideRoot(OUTPUT, ROOT)) {
        throw new Error(`Refusing to clean output outside repository: ${OUTPUT}`);
    }
    await rm(OUTPUT, { recursive: true, force: true });
    await mkdir(OUTPUT, { recursive: true });

    const rootEntries = await readdir(ROOT, { withFileTypes: true });
    const htmlFiles = rootEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
        .map((entry) => entry.name);

    await Promise.all([
        ...htmlFiles.map((name) => cp(path.join(ROOT, name), path.join(OUTPUT, name))),
        ...SITE_DIRECTORIES.map((name) => copyDirectory(path.join(ROOT, name), path.join(OUTPUT, name)))
    ]);

    await writeFile(path.join(OUTPUT, '.nojekyll'), '', 'utf8');
    const files = await collectFiles(OUTPUT);
    const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
    const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
    const largestBytes = Math.max(...sizes, 0);

    if (largestBytes > 2 * 1024 * 1024) {
        throw new Error(`Build contains an asset larger than 2 MiB (${largestBytes} bytes).`);
    }
    if (totalBytes > 25 * 1024 * 1024) {
        throw new Error(`Build exceeds the 25 MiB artifact budget (${totalBytes} bytes).`);
    }

    console.log(`Built ${files.length} files in dist (${(totalBytes / 1024 / 1024).toFixed(2)} MiB).`);
}

await build();
