import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeUsage, compactUsage } from '../js/character-usage-model.mjs';
import { normalizeClearIndex } from '../js/dzone-clear-model.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// Expose only schema-validated anonymous snapshots, never the review archive or diagnostics.
export function publicSnapshot(payload, period, characterId) {
    const data = characterId ? normalizeUsage(payload.data) : normalizeClearIndex(payload.data);
    if (data.period !== Number(period) || (characterId && data.characterId !== characterId)) throw Error('Snapshot identity mismatch');
    return JSON.stringify({ data: characterId ? compactUsage(data) : data, periods: [data.period] });
}

export function createPreviewServer(root = ROOT) {
    const cache = new Map();
    return http.createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/Morimens\.Info\.kr\//, '/');
            const relative = pathname.replace(/^\//, '') || 'index.html';
            if (relative.split(/[\\/]/).some(p => p.startsWith('.')) || !(relative.endsWith('.html') && !relative.includes('/') || /^(config|css|data|images|js)\//.test(relative)) || /\.test\.|\.cjs$/.test(relative)) throw Error('not public');
            const snapshot = /^data\/dzone-meta\/([1-9]\d{0,3})\/(teams\.json|characters\/([A-Za-z0-9_-]{1,80})\.json)$/.exec(relative);
            let bytes;
            if (snapshot) {
                const file = path.join(root, '.generated/dzone-recommendations', snapshot[1], snapshot[2]);
                const modified = (await fs.stat(file)).mtimeMs, cached = cache.get(file);
                if (cached?.modified === modified) bytes = cached.bytes;
                else {
                    bytes = publicSnapshot(JSON.parse(await fs.readFile(file, 'utf8')), snapshot[1], snapshot[3]);
                    cache.set(file, { modified, bytes });
                    if (cache.size > 4) cache.delete(cache.keys().next().value);
                }
            } else {
                if (relative.startsWith('data/dzone-meta/')) throw Error('not public');
                const filename = path.resolve(root, relative);
                if (!filename.startsWith(root + path.sep)) throw Error('not public');
                bytes = await fs.readFile(filename);
            }
            response.writeHead(200, { 'Content-Type': (mime[path.extname(relative)] || 'application/octet-stream') + (/\.(html|m?js|css|json|svg)$/.test(relative) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' }); response.end(bytes);
        } catch { response.writeHead(404); response.end('Not found'); }
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const server = createPreviewServer();
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(9357, '127.0.0.1', () => console.log('융재 추천 세팅: http://127.0.0.1:9357/dzone_clears.html?period=73'));
}
