import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createPreviewServer } from './serve-dzone-preview.mjs';
import { normalizeUsage, sampleCount, wheelKey, covenantKey, targetMember } from '../js/character-usage-model.mjs';

const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, '.generated/recommendations-check');
await fs.mkdir(out, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/character_manifest.json'), 'utf8'));
const server = createPreviewServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser, page;
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    let workerRequests = 0; const errors = [], checked = [], layouts = [];
    await context.route('**/*.workers.dev/**', route => { workerRequests++; return route.abort(); });
    await context.route('**/*google-analytics.com/**', route => route.abort());
    await context.route('**/*googletagmanager.com/**', route => route.abort());
    page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const url = id => `${base}/links.html?category=character&id=${encodeURIComponent(id)}#usage`;
    for (const character of process.argv.includes('--flow-only') ? [] : manifest) {
        const response = await fetch(`${base}/data/dzone-meta/73/characters/${character.id}.json`);
        assert.equal(response.status, 200, character.id);
        const data = normalizeUsage((await response.json()).data);
        const joint = data.rows.filter(row => wheelKey(targetMember(row, character.id)) && covenantKey(targetMember(row, character.id)));
        await page.goto(url(character.id));
        await expect(page.locator('.usage-featured-build')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('#page-title')).toContainText(character.name);
        checked.push({ id: character.id, name: character.name, clears: sampleCount(data.rows), joint: sampleCount(joint), builds: Math.max(1, await page.locator('[data-choose-party]').count()) });
        if (checked.length % 10 === 0) console.log(`추천 세팅 화면 ${checked.length}/${manifest.length} 확인`);
    }
    if (checked.length) await fs.writeFile(path.join(out, 'characters.json'), JSON.stringify(checked, null, 2));
    await page.goto(url('doll_inferno')); await expect(page.locator('#usage-recommended-record')).toBeVisible({ timeout: 30000 });
    async function layout(name) {
        const metrics = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, clipped: [...document.querySelectorAll('.usage-recommendations button')].filter(el => el.getClientRects().length).some(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.height < (el.classList.contains('usage-zone') ? 27 : 43); }) }));
        assert.ok(metrics.overflow <= 1 && !metrics.clipped, name + JSON.stringify(metrics)); layouts.push({ name, ...metrics });
    }
    for (const width of [320, 390, 479, 480, 481, 639, 640, 641, 767, 768, 769, 899, 900, 901, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 }); await layout(`settings-${width}`);
        if ([320, 390, 1280].includes(width)) await page.screenshot({ path: path.join(out, `settings-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await layout('settings-zoom200');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 844, height: 390 }); await layout('settings-landscape');
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator('#usage-recommended-record').scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.locator('#usage-recommended-record').click(); await expect(page.locator('#usage-record-dialog')).toBeVisible();
    await expect(page.locator('#usage-statistics')).not.toHaveAttribute('open');
    for (const width of [320,390,479,480,481,639,640,641,768,899,900,901,1024,1280]) {
        await page.setViewportSize({width,height:900});
        const metrics = await page.locator('#usage-record-dialog').evaluate(el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, bottom:r.bottom, height:innerHeight, width:innerWidth, overflow:el.scrollWidth-el.clientWidth }; });
        assert.ok(metrics.left >= 0 && metrics.right <= width + 1 && metrics.bottom <= metrics.height + 1 && metrics.overflow <= 1, JSON.stringify(metrics));
    }
    for (const width of [320,390,1280]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        const metrics = await page.locator('#usage-record-dialog').evaluate(el => ({overflow:el.scrollWidth-el.clientWidth, bodyOverflow:el.querySelector('.usage-preview-body').scrollWidth-el.querySelector('.usage-preview-body').clientWidth}));
        assert.ok(metrics.overflow <= 1 && metrics.bodyOverflow <= 1, 'dialog zoom '+width+JSON.stringify(metrics));
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.setViewportSize({width:390,height:900});
    if (await page.locator('#usage-preview-next').isEnabled()) { await page.locator('#usage-preview-next').click(); await expect(page.locator('.usage-preview-header p')).toContainText('2 /'); await page.locator('#usage-preview-prev').click(); }
    await page.keyboard.press('Escape'); await expect(page.locator('#usage-record-dialog')).toHaveCount(0);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 2, 'closing preserves page scroll');
    await expect(page.locator('#usage-recommended-record')).toBeFocused();
    await page.locator('#usage-recommended-record').click();
    await page.locator('#usage-record-dialog [data-save-record]:enabled').click();
    await expect(page.locator('#usage-record-dialog [role=status]')).toContainText('담았습니다');
    await page.locator('#usage-preview-close').click();
    const builder = page.locator('#usage-plan a[href*="party_builder"]'); await expect(builder).toBeVisible();
    await page.goto(new URL(await builder.getAttribute('href'), base).href);
    await expect(page.locator('#usage-plan-source > details > summary')).toBeVisible({ timeout: 30000 });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('morimens_v2_pages')));
    assert.ok(saved.some(p => p.usagePeriod === 73 && p.teams.some(t => t.usageSource && t.id && t.wheels.every(pair => pair.length === 2))));
    await page.reload(); await expect(page.locator('#usage-plan-source > details > summary')).toBeVisible({ timeout: 30000 });
    assert.equal(workerRequests, 0); assert.deepEqual(errors, []);
    const result = { passed: true, checked, layouts, workerRequests, errors };
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: true, characters: checked.length, layouts: layouts.length, workerRequests }));
} catch (error) {
    if (page) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); await fs.writeFile(path.join(out, 'failure.txt'), error.stack + '\n' + await page.locator('body').innerText().catch(() => '')); }
    throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
