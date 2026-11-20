import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..'), output = path.join(root, '.generated/account-browser');
await fs.mkdir(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/Morimens\.Info\.kr\//, '/');
        const relative = pathname.replace(/^\//, '') || 'index.html', filename = path.resolve(root, relative);
        if (!filename.startsWith(root + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.')) || !(relative.endsWith('.html') && !relative.includes('/') || /^(config|css|data|images|js)\//.test(relative)) || /\.test\.|\.cjs$/.test(relative)) throw Error('not public');
        const bytes = await fs.readFile(filename); response.writeHead(200, { 'Content-Type': (mime[path.extname(filename)] || 'application/octet-stream') + (/\.(html|m?js|css|json|svg)$/.test(filename) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' }); response.end(bytes);
    } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(9357, '127.0.0.1', resolve));
if (process.argv.includes('--serve')) {
    console.log('Local preview: http://127.0.0.1:9357/inventory_checker.html?accountEmulator=1');
} else {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const failures = [], checks = [], contexts = [];
    let workerRequests = 0;
    const base = 'http://127.0.0.1:9357/Morimens.Info.kr';
    const guest = { version: 1, characters: { '24': { owned: true, potency: 0, level: 42, talents: {}, skills: {} } }, wheels: {}, presets: [] };
    const parties = [{ id: 'guest-page', pageName: '내 파티', teams: [{ id: 'guest-team', name: '내 파티', chars: ['24', null, null, null], wheels: Array.from({ length: 4 }, () => [null, null]), key: null, supportIdx: -1 }] }];
    const email = `browser-${Date.now()}@example.test`, password = 'local-browser-test';
    async function device(width) {
        const context = await browser.newContext({ viewport: { width, height: 900 } }); contexts.push(context);
        await context.route('**/*.workers.dev/**', route => { workerRequests++; return route.abort(); });
        const page = await context.newPage(); page.on('pageerror', e => failures.push(e.message));
        return { page, context };
    }
    async function login(page, create = false) {
        await expect(page.locator('[data-account-open]')).toBeEnabled({ timeout: 30000 });
        await page.locator('[data-account-open]').click();
        await page.locator('[data-account-test] [name=email]').fill(email);
        await page.locator('[data-account-test] [name=password]').fill(password);
        await page.locator(`[data-account-test] button[value=${create ? 'create' : 'login'}]`).click();
        await expect(page.locator('[data-account-status]')).toHaveText('동기화 완료', { timeout: 30000 });
        await expect(page.locator('[data-account-profile] button')).toBeEnabled();
    }
    const read = (page, kind = 'roster') => page.evaluate(kind => window.MorimensAccountStore.store.read(kind), kind);
    const level = async (page, value) => page.evaluate(value => { const s = window.MorimensAccountStore.store, data = s.read('roster'); data.characters['24'].level = value; s.write('roster', data); }, value);
    const save = async page => { await page.locator('[data-account-save]').click(); await expect(page.locator('[data-account-status]')).toHaveText('동기화 완료', { timeout: 20000 }); };
    async function layout(page, name) {
        const metrics = await page.evaluate(() => {
            const dialog = document.querySelector('.account-dialog'), area = dialog?.open ? dialog : document.querySelector('[data-account-panel]');
            const rect = area.getBoundingClientRect();
            const buttons = [...area.querySelectorAll('button')].filter(el => el.getClientRects().length).map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
            return { viewport: innerWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth, componentOverflow: area.scrollWidth - area.clientWidth, left: rect.left, right: rect.right, buttons };
        });
        assert.ok(metrics.pageOverflow <= 1, `${name}: page overflow ${JSON.stringify(metrics)}`);
        assert.ok(metrics.componentOverflow <= 1, `${name}: component overflow`);
        assert.ok(metrics.left >= -1 && metrics.right <= metrics.viewport + 1, `${name}: component clipped`);
        assert.ok(metrics.buttons.every(b => b.height >= 43), `${name}: touch targets`);
        checks.push({ name, ...metrics });
    }
    try {
        const a = await device(390); await a.context.addInitScript(({ guest, parties }) => {
            if (!localStorage.getItem('browser-seed')) { localStorage.setItem('morimens_roster_preview_v1', JSON.stringify(guest)); localStorage.setItem('morimens_v2_pages', JSON.stringify(parties)); localStorage.setItem('morimens-roster-tour-v1', 'done'); localStorage.setItem('browser-seed', 'done'); }
        }, { guest, parties });
        await a.page.goto(`${base}/inventory_checker.html?accountEmulator=1`); await login(a.page, true);
        await expect(a.page.locator('[data-account-import-options]')).toBeVisible();
        await a.page.setViewportSize({ width: 320, height: 900 }); await layout(a.page, 'import-320');
        await a.page.locator('[data-import-mode=replace]').click();
        await expect(a.page.locator('[data-account-import-options]')).toBeHidden({ timeout: 20000 });
        assert.equal((await read(a.page)).characters['24'].level, 42);
        assert.equal((await read(a.page, 'parties'))[0].pageName, '내 파티');
        assert.equal(await a.page.evaluate(() => JSON.parse(localStorage.getItem('morimens_roster_preview_v1')).characters['24'].level), 42);
        await a.page.locator('#account-game-uid').fill('optional-uid-123'); await a.page.locator('[data-account-profile] button').click();
        await expect(a.page.locator('[data-account-message]')).toHaveText('프로필을 저장했습니다.');
        const b = await device(1280); await b.page.goto(`${base}/inventory_checker.html?accountEmulator=1`); await login(b.page);
        assert.equal((await read(b.page)).characters['24'].level, 42); await expect(b.page.locator('#account-game-uid')).toHaveValue('optional-uid-123');
        await level(a.page, 43); await save(a.page);
        await level(b.page, 44); await b.page.locator('[data-account-save]').click();
        await expect(b.page.locator('[data-account-conflict]')).toBeVisible();
        await b.page.setViewportSize({ width: 320, height: 900 }); await layout(b.page, 'conflict-320');
        await expect(b.page.locator('[data-account-profile] button')).toBeEnabled();
        await b.page.locator('[data-conflict=remote]').click(); await expect(b.page.locator('[data-account-conflict]')).toBeHidden();
        assert.equal((await read(b.page)).characters['24'].level, 43);
        await b.page.evaluate(() => { const s = window.MorimensAccountStore.store, r = s.read('roster'); r.characters['24'].owned = false; s.write('roster', r); }); await save(b.page);
        await level(a.page, 45); await save(a.page);
        assert.equal((await read(a.page)).characters['24'].owned, false);
        await b.page.locator('[data-account-refresh]').click(); await expect(b.page.locator('[data-account-status]')).toHaveText('동기화 완료');
        assert.equal((await read(b.page)).characters['24'].level, 45);
        await b.context.setOffline(true); await level(b.page, 46);
        assert.equal((await read(b.page)).characters['24'].level, 46);
        await b.context.setOffline(false); await b.page.reload();
        await expect(b.page.locator('[data-account-open]')).toHaveText('내 계정', { timeout: 30000 }); await b.page.locator('[data-account-open]').click();
        await expect(b.page.locator('[data-account-save]')).toBeEnabled(); await save(b.page);
        assert.equal((await read(b.page)).characters['24'].level, 46);
        await a.page.locator('[data-account-logout]').click(); await expect(a.page.locator('[data-account-status]')).toHaveText('기기에 저장');
        assert.equal((await read(a.page)).characters['24'].level, 42);
        await a.page.goto(`${base}/party_builder.html?accountEmulator=1`); await login(a.page);
        assert.equal((await read(a.page, 'parties'))[0].pageName, '내 파티');
        await a.page.locator('.account-dialog-header button').click();
        await expect(a.page.locator('#team-title-text')).toHaveText('내 파티');
        for (const width of [320, 390, 767, 768, 769, 1024, 1280]) {
            await a.page.setViewportSize({ width, height: 900 }); await layout(a.page, `party-${width}`);
            await a.page.locator('[data-account-open]').click(); await layout(a.page, `dialog-${width}`);
            if ([320, 390, 1280].includes(width)) await a.page.screenshot({ path: path.join(output, `account-${width}.png`) });
            await a.page.keyboard.press('Escape'); await expect(a.page.locator('[data-account-open]')).toBeFocused();
        }
        for (const width of [320, 390, 1280]) {
            await a.page.setViewportSize({ width, height: 900 }); await a.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
            await a.page.locator('[data-account-open]').click(); await layout(a.page, `zoom200-${width}`); await a.page.keyboard.press('Escape');
            await a.page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        }
        await a.page.setViewportSize({ width: 844, height: 390 }); await a.page.locator('[data-account-open]').click(); await layout(a.page, 'landscape-844x390');
        await a.page.screenshot({ path: path.join(output, 'account-landscape.png') });
        await a.page.keyboard.press('Escape');
        await a.page.goto(`${base}/inventory_checker.html?accountEmulator=1`);
        await expect(a.page.locator('[data-account-open]')).toHaveText('내 계정');
        for (const width of [320, 390, 767, 768, 769, 1024, 1280]) {
            await a.page.setViewportSize({ width, height: 900 }); await layout(a.page, `inventory-${width}`);
            await a.page.locator('[data-account-open]').click(); await layout(a.page, `inventory-dialog-${width}`);
            if ([320, 1280].includes(width)) await a.page.screenshot({ path: path.join(output, `inventory-account-${width}.png`) });
            await a.page.keyboard.press('Escape');
        }
        for (const width of [320, 390, 1280]) {
            await a.page.setViewportSize({ width, height: 900 }); await a.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
            await a.page.locator('[data-account-open]').click(); await layout(a.page, `inventory-zoom200-${width}`); await a.page.keyboard.press('Escape');
            await a.page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        }
        await a.page.setViewportSize({ width: 844, height: 390 }); await a.page.locator('[data-account-open]').click(); await layout(a.page, 'inventory-landscape');
        b.page.on('dialog', prompt => prompt.accept(password));
        await b.page.locator('[data-account-member] details summary').click();
        await b.page.locator('[data-account-delete-check]').check(); await b.page.locator('[data-account-delete]').click();
        await expect(b.page.locator('[data-account-status]')).toHaveText('기기에 저장', { timeout: 20000 });
        assert.equal(await b.page.evaluate(() => window.MorimensAccountStore.store.uid), null);
        const google = await device(390); await google.page.goto(`${base}/inventory_checker.html?accountEmulator=1`);
        await expect(google.page.locator('[data-account-open]')).toBeEnabled(); await google.page.locator('[data-account-open]').click();
        const popupPromise = google.page.waitForEvent('popup'); await google.page.locator('[data-account-google]').click();
        const popup = await popupPromise; await popup.waitForLoadState('load'); await popup.getByText('Add new account').click();
        await popup.locator('#email-input').fill(`google-${Date.now()}@example.test`);
        await popup.locator('#display-name-input').fill('로컬 Google 테스트');
        await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
        await expect(google.page.locator('[data-account-status]')).toHaveText('동기화 완료', { timeout: 20000 });
        await expect(google.page.locator('[data-account-name]')).toHaveText('로컬 Google 테스트');
        assert.equal(workerRequests, 0, 'account flows must not call the existing Worker');
        assert.deepEqual(failures, [], 'browser runtime errors');
        await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: true, checks, workerRequests, errors: failures }, null, 2));
        console.log(JSON.stringify({ passed: true, checks: checks.length, workerRequests, output }));
    } catch (error) {
        await fs.writeFile(path.join(output, 'failure.txt'), error.stack || error.message);
        for (let i = 0; i < contexts.length; i++) { const p = contexts[i].pages()[0]; if (p) await p.screenshot({ path: path.join(output, `failure-${i}.png`) }).catch(() => {}); }
        throw error;
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
