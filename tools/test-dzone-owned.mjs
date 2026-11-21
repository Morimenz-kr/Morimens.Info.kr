import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createPreviewServer } from './serve-dzone-preview.mjs';
import { normalizeClearIndex, findClearTeams, findClearAlternatives, indexUsageTeams } from '../js/dzone-clear-model.mjs';
import { normalizeUsage, selectRows } from '../js/character-usage-model.mjs';
import { recommendBuilds } from '../js/usage-recommendations.mjs';

const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, '.generated/clear-ui');
await fs.mkdir(out, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/character_manifest.json'), 'utf8'));
const chars = new Map(manifest.map(c => [c.id, c]));
const data = normalizeClearIndex(JSON.parse(await fs.readFile(path.join(root, '.generated/dzone-recommendations/73/teams.json'), 'utf8')).data);
const reference = findClearTeams(data).teams[0];
const bucket = [...reference.buckets].sort((a, b) => b.count - a.count)[0];
const stage = { wave: String(bucket.wave), difficulty: bucket.difficulty };
const baseTeam = findClearTeams(data, stage).teams.find(t => t.key === reference.key);
const alternative = findClearAlternatives(data, baseTeam, stage)[0];
assert.ok(alternative, 'actual season snapshot must supply a replacement example');
const owned = new Set([...baseTeam.members, ...alternative.members]);
const roster = { version: 1, characters: Object.fromEntries([...owned].map(id => [id, { owned: true, potency: 0, talents: {}, skills: {} }])), wheels: {}, presets: [] };
const server = createPreviewServer(); await new Promise(resolve => server.listen(9361, '127.0.0.1', resolve));
const host = 'http://127.0.0.1:9361', url = `${host}/dzone_clears.html?period=73&wave=${stage.wave}&difficulty=${stage.difficulty}`;
let browser, page; const layouts = [], errors = [];
try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('**/*googletagmanager.com/**', r => r.abort());
    await context.route('**/*google-analytics.com/**', r => r.abort());
    await context.addInitScript(roster => { if (!localStorage.getItem('clear-test-seed')) { localStorage.setItem('morimens_roster_preview_v1', JSON.stringify(roster)); localStorage.setItem('clear-test-seed', '1'); } }, roster);
    page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await expect(page.locator('.clear-team').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#clear-owned-note')).toContainText(`보유 ${owned.size}명`);
    const allAlternatives = findClearAlternatives(data, baseTeam, stage);
    if (allAlternatives.length > 5) {
        const panel = page.locator(`.clear-team[data-team="${baseTeam.key}"] .clear-alternatives`);
        await panel.locator('summary').click(); await expect(panel.locator('li')).toHaveCount(5);
        await panel.locator('[data-alt-more]').click(); await expect(panel.locator('li')).toHaveCount(Math.min(10, allAlternatives.length));
    }
    await page.locator('[name=ownedOnly]').check();
    const expected = findClearTeams(data, { ...stage, owned });
    assert.equal(await page.locator('.clear-team').count(), expected.teams.length);
    for (const key of await page.locator('.clear-team').evaluateAll(es => es.map(e => e.dataset.team))) assert.ok(key.split('|').every(id => owned.has(id)));
    const card = page.locator(`.clear-team[data-team="${baseTeam.key}"]`), detail = card.locator('.clear-alternatives');
    await detail.locator('summary').click();
    const expectedAlt = findClearAlternatives(data, baseTeam, { ...stage, owned });
    await expect(detail.locator('li')).toHaveCount(Math.min(5, expectedAlt.length));
    await expect(detail.locator('.clear-swap strong').first()).toHaveText(chars.get(expectedAlt[0].added).name);
    const link = detail.locator('li > a').first(), href = await link.getAttribute('href');
    const params = new URL(href, host).searchParams;
    assert.equal(params.get('team'), expectedAlt[0].key); assert.equal(params.get('wave'), stage.wave); assert.equal(params.get('difficulty'), stage.difficulty);
    await page.goto(new URL(href, host).href);
    await expect(page.locator('.usage-record').first()).toBeVisible({ timeout: 30000 });
    const recordNames = await page.locator('.usage-record').first().locator('.usage-members').innerText();
    for (const id of expectedAlt[0].members) assert.ok(recordNames.includes(chars.get(id).name));
    // Primary entry: Awakener -> recommended settings -> owned parties -> replacement -> exact build.
    const primaryId = alternative.members.find(id => baseTeam.members.includes(id));
    const primaryUrl = `${host}/links.html?category=character&id=${primaryId}&period=73&wave=${stage.wave}&difficulty=${stage.difficulty}#usage`;
    const usage = normalizeUsage(JSON.parse(await fs.readFile(path.join(root, `.generated/dzone-recommendations/73/characters/${primaryId}.json`), 'utf8')).data);
    const builds = recommendBuilds(selectRows(usage, stage), primaryId, owned);
    const candidates = builds.flatMap((build, buildIndex) => { const index = indexUsageTeams(build.ownedRows); return findClearTeams(index).teams.map(base => ({ build, buildIndex, base, alternatives: findClearAlternatives(index, base, { include: [primaryId] }) })); });
    const example = candidates.find(candidate => candidate.alternatives.length);
    assert.ok(example, 'an actual recommended build supplies an owned replacement example');
    const primaryAlternatives = example.alternatives;
    await page.goto(primaryUrl); await expect(page.locator('.usage-featured-build')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#usage-statistics')).not.toHaveAttribute('open');
    const order = await page.evaluate(() => [...document.querySelectorAll('.usage-recommendations,.usage-my-parties,.usage-statistics')].map(e => e.className));
    assert.ok(order.indexOf('usage-recommendations') < order.indexOf('usage-my-parties'));
    assert.ok(order.indexOf('usage-my-parties') < order.findIndex(c => c.includes('usage-statistics')));
    assert.equal(await page.locator('.usage-recommendations .usage-frequency,.usage-my-parties .usage-frequency').count(), 0);
    await expect(page.locator('.usage-featured-build')).toHaveAttribute('data-selected-build', builds[0].key);
    if (example.buildIndex) await page.locator('[data-choose-build]').nth(example.buildIndex).click();
    await expect(page.locator('.usage-featured-build')).toHaveAttribute('data-selected-build', example.build.key);
    for (const key of await page.locator('[data-owned-team]').evaluateAll(es => es.map(e => e.dataset.ownedTeam))) assert.ok(key.split('|').every(id => owned.has(id)));
    await page.locator('#usage-example-toggle').click();
    const actualOptions = await page.locator('.usage-example-main [data-example-main]').allTextContents();
    assert.equal(actualOptions.length, 6);
    example.build.member.covenant.parts.forEach((part, i) => assert.ok(actualOptions[i].includes(part.main.label)));
    await page.locator('#usage-example-toggle').click();
    const primaryCard = page.locator(`[data-owned-team="${example.base.key}"]`);
    for (const width of [390,1280]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(() => scrollTo(0,0));
        await page.screenshot({path:path.join(out,`visual-${width}.png`),fullPage:true});
    }
    await page.setViewportSize({width:1280,height:900});
    await expect.poll(() => page.locator('.usage-featured-equipment img,.usage-choice-art img,.usage-owned-team img').evaluateAll(es => es.every(el => el.complete && el.naturalWidth > 0))).toBe(true);
    const scale = await page.evaluate(() => {
        const portrait = document.querySelector('.usage-owned-team .usage-member img');
        const equipment = document.querySelector('.usage-featured-equipment .usage-equipment img');
        const name = document.querySelector('.usage-owned-team .usage-member');
        return {portrait:portrait.getBoundingClientRect().width,equipment:equipment.getBoundingClientRect().height,text:parseFloat(getComputedStyle(name).fontSize)};
    });
    assert.ok(scale.portrait >= 48 && scale.equipment >= 72 && scale.text >= 14, JSON.stringify(scale));
    await primaryCard.locator('.usage-team-alternatives > summary').click();
    await expect(primaryCard.locator('[data-usage-alternative]')).toHaveCount(Math.min(5, primaryAlternatives.length));
    const primaryValue = JSON.parse(await primaryCard.locator('[data-usage-alternative]').first().getAttribute('data-usage-alternative'));
    assert.equal(primaryValue[0], primaryAlternatives[0].key); assert.ok(primaryValue[0].split('|').includes(primaryId));
    async function characterLayout(name) {
        const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth,
            clipped: [...document.querySelectorAll('.character-usage button,.character-usage a,.character-usage input,.character-usage select,.character-usage summary')].filter(e => e.getClientRects().length).filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.outerHTML.slice(0,100)),
            textOverflow: [...document.querySelectorAll('.usage-example-main p,.usage-featured-build')].filter(e => e.getClientRects().length).some(e => e.scrollWidth > e.clientWidth + 1) }));
        assert.ok(metrics.overflow <= 1 && !metrics.clipped.length && !metrics.textOverflow, name + JSON.stringify(metrics)); layouts.push({ name, ...metrics });
    }
    for (const width of [320,390,479,480,481,639,640,641,767,768,769,899,900,901,1023,1024,1025,1280]) {
        await page.setViewportSize({ width, height: 900 }); await characterLayout(`awakener-${width}`);
        if ([390,1280].includes(width)) await page.screenshot({ path: path.join(out, `awakener-owned-${width}.png`), fullPage: true });
    }
    for (const width of [320,390,1280]) {
        await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await characterLayout(`awakener-zoom200-${width}`);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.setViewportSize({ width: 844, height: 390 }); await characterLayout('awakener-landscape');
    await page.locator('#usage-example-toggle').click();
    for (const width of [320,390,1280]) {
        await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await characterLayout(`example-zoom200-${width}`);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.locator('#usage-example-toggle').click();
    await primaryCard.locator('[data-usage-alternative]').first().click();
    await expect(page.locator('#usage-record-dialog')).toBeVisible();
    await expect(page.locator('#usage-statistics')).not.toHaveAttribute('open');
    const replacementNames = await page.locator('#usage-record-dialog .usage-members').innerText();
    for (const id of primaryAlternatives[0].members) assert.ok(replacementNames.includes(chars.get(id).name));
    await page.keyboard.press('Escape');
    await expect(page.locator('#usage-record-dialog')).toHaveCount(0);
    await expect(primaryCard.locator('.usage-team-alternatives')).toHaveAttribute('open');
    await expect(primaryCard.locator('[data-usage-alternative]').first()).toBeFocused();
    await primaryCard.locator('.usage-team-alternatives > summary').click();
    await page.setViewportSize({width:1280,height:900});
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({path:path.join(out,'compact-desktop.png')});
    await page.goto(url + '&owned=1'); await expect(page.locator('.clear-team').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-open-picker]').first().click();
    for (const id of baseTeam.members) { await page.locator('#clear-character-search').fill(chars.get(id).name); await page.locator(`[data-pick="${id}"]`).click(); }
    await expect(page.locator('#clear-pick-count')).toHaveText('4 / 4');
    assert.equal(await page.locator('.clear-team').count(), 1);
    await page.locator('#clear-character-search').fill('');
    assert.equal(await page.locator('#clear-character-grid button:enabled').count(), 4);
    await page.locator('[data-pick-mode=exclude]').click(); await page.locator(`[data-pick="${baseTeam.members[0]}"]`).click();
    await expect(page.locator('#clear-pick-count')).toHaveText('3 / 4');
    await expect(page.locator('#clear-excluded button')).toHaveCount(1);
    await page.locator('#clear-reset').click(); await expect(page.locator('[name=ownedOnly]')).not.toBeChecked();
    await page.locator('[name=ownedOnly]').check();
    await page.locator('.clear-alternatives').first().locator('summary').click();
    async function layout(name) {
        const metrics = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth,
            clipped: [...document.querySelectorAll('.clear-shell button,.clear-shell input,.clear-shell select,.clear-members a')].filter(e => e.getClientRects().length).filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.outerHTML.slice(0,100)),
            short: [...document.querySelectorAll('.clear-team a,.clear-team summary,.clear-character-grid button')].filter(e => e.getClientRects().length).some(e => e.getBoundingClientRect().height < 43) }));
        assert.ok(metrics.overflow <= 1 && !metrics.clipped.length && !metrics.short, name + JSON.stringify(metrics)); layouts.push({ name, ...metrics });
    }
    for (const width of [320,390,479,480,481,639,640,641,767,768,769,899,900,901,1023,1024,1025,1280]) {
        await page.setViewportSize({ width, height: 900 }); await layout(`clears-${width}`);
        if ([320,390,1280].includes(width)) await page.screenshot({ path: path.join(out, `owned-${width}.png`), fullPage: true });
    }
    if (await page.locator('#clear-picker').getAttribute('open') === null) await page.locator('#clear-picker > summary').click();
    await page.setViewportSize({ width: 390, height: 900 }); await layout('picker-390');
    await page.screenshot({ path: path.join(out, 'picker-390.png'), fullPage: true });
    for (const width of [320,390,1280]) {
        await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await layout(`zoom200-${width}`);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.setViewportSize({ width: 844, height: 390 }); await layout('landscape-844');
    await page.locator('#clear-picker > summary').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#clear-picker')).not.toHaveAttribute('open');
    // A second browser tab edits guest ownership; the search must update without a reload.
    const peer = await context.newPage(); await peer.goto(`${host}/inventory_checker.html`);
    await peer.evaluate(() => { localStorage.setItem('morimens_roster_preview_v1', JSON.stringify({ version: 1, characters: {}, wheels: {}, presets: [] })); });
    await expect(page.locator('#clear-owned-note')).toContainText('보유 0명');
    await expect(page.locator('#clear-results')).toContainText('먼저 보유한 각성체를 등록해주세요');
    if (process.argv.includes('--with-account')) {
        await peer.evaluate(roster => localStorage.setItem('morimens_roster_preview_v1', JSON.stringify(roster)), roster);
        await page.goto(url + '&owned=1&accountEmulator=1');
        await expect(page.locator('#clear-owned-note')).toContainText(`보유 ${owned.size}명`);
        await page.locator('.clear-account > summary').click();
        await expect(page.locator('[data-account-open]')).toBeEnabled({ timeout: 30000 }); await page.locator('[data-account-open]').click();
        await page.locator('[data-account-test] [name=email]').fill(`clear-owned-${Date.now()}@example.test`);
        await page.locator('[data-account-test] [name=password]').fill('local-clear-test');
        await page.locator('[data-account-test] button[value=create]').click();
        await expect(page.locator('[data-account-import-options]')).toBeVisible({ timeout: 30000 });
        await page.locator('[data-import-mode=replace]').click();
        await expect(page.locator('[data-account-import-options]')).toBeHidden({ timeout: 30000 });
        await expect(page.locator('#clear-owned-note')).toContainText(`계정 기록 · 보유 ${owned.size}명`);
        assert.equal(await page.locator('.clear-team').count(), expected.teams.length);
        await page.goto(primaryUrl.replace('#usage', '&accountEmulator=1#usage'));
        await expect(page.locator('.usage-my-source')).toContainText(`계정 · 보유 ${owned.size}명`, { timeout: 30000 });
        await page.locator('.usage-account > summary').click(); await page.locator('[data-account-open]').click();
        await page.locator('[data-account-logout]').click();
        await expect(page.locator('.usage-my-source')).toContainText(`이 브라우저 · 보유 ${owned.size}명`);
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(out, 'owned-results.json'), JSON.stringify({ passed: true, accountEmulatorTested: process.argv.includes('--with-account'), expectedTeams: expected.teams.length, alternative: { removed: expectedAlt[0].removed, added: expectedAlt[0].added, count: expectedAlt[0].count }, layouts, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, layouts: layouts.length, expectedTeams: expected.teams.length }));
} catch (error) { if (page) { await page.screenshot({ path: path.join(out, 'owned-failure.png'), fullPage: true }).catch(() => {}); await fs.writeFile(path.join(out, 'owned-failure.txt'), error.stack); } throw error; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
