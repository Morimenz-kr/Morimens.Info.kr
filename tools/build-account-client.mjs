import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export async function buildAccountClient(root, output) {
    const entry = path.join(root, 'js/account-sdk-entry.mjs');
    if (!await fs.access(entry).then(() => true, () => false)) return false;
    await fs.mkdir(path.dirname(output), { recursive: true });
    await build({ entryPoints: [entry], outfile: output, bundle: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: true, legalComments: 'eof', logLevel: 'silent' });
    return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const root = path.resolve(import.meta.dirname, '..');
    await buildAccountClient(root, path.join(root, 'js/firebase-sdk.generated.mjs'));
    console.log('계정용 Firebase SDK bundle을 생성했습니다.');
}
