import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const site = path.resolve(fileURLToPath(new URL('../.generated/scarecrow/site/', import.meta.url)));
const port = Number(process.env.PORT || 4185);
const types = { '.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.gz':'application/octet-stream' };
http.createServer(async (request, response) => {
    try {
        let relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
        let full = path.resolve(site, relative);
        if (!full.startsWith(site + path.sep) && full !== site) throw new Error('Invalid path');
        if ((await stat(full)).isDirectory()) full = path.join(full, 'index.html');
        response.setHeader('Content-Type', types[path.extname(full)] || 'application/octet-stream');
        response.setHeader('Cache-Control','no-cache'); response.end(await readFile(full));
    } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`허수아비: http://127.0.0.1:${port}`));
