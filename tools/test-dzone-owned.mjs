import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createPreviewServer } from './serve-dzone-preview.mjs';
import { normalizeClearIndex, findClearTeams, findClearAlternatives, indexUsageTeams } from '../js/dzone-clear-model.mjs';
import { normalizeUsage, selectRows, covenantKey, wheelKey, targetMember } from '../js/character-usage-model.mjs';
import { covenantStatistics, equipmentStatistics } from '../js/usage-recommendations.mjs';

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
    const primaryRows = selectRows(usage, {...stage,owned});
    const partyIndex = indexUsageTeams(primaryRows);
    await page.goto(primaryUrl); await expect(page.locator('.usage-stat-equipment')).toBeVisible({timeout:30000});
    await page.locator('#usage-party-picker-summary').click();
    await expect(page.locator('#usage-owned-only')).toBeChecked();
    await expect(page.locator('#usage-statistics')).not.toHaveAttribute('open');
    await expect(page.locator('.usage-clear-party')).toHaveAttribute('data-selected-party','');
    // Find an actual visible owned party whose same-stage alternatives are known.
    let example;
    async function selectEquipment(pair,contract) {
        if(await page.locator('#usage-stat-wheel').inputValue() !== pair) {
            await page.locator('.usage-equipment-catalogue > summary').click();
            await page.locator('#usage-stat-wheel').selectOption(pair);
        }
        if(await page.locator('#usage-stat-contract-0').inputValue() !== contract) {
            if(!await page.locator('#usage-stat-contract-0').isVisible()) await page.locator('.usage-stat-other-contracts > summary').click();
            await page.locator('#usage-stat-contract-0').selectOption(contract);
        }
    }
    const observedPairs = [...new Set(primaryRows.filter(row=>targetMember(row,primaryId).wheels?.length===2).map(row=>wheelKey(targetMember(row,primaryId))))];
    const initialPair = await page.locator('#usage-stat-wheel').inputValue();
    observedPairs.sort((a,b)=>Number(b===initialPair)-Number(a===initialPair));
    for (const pair of observedPairs) {
        const contracts = [...new Set(primaryRows.filter(row=>wheelKey(targetMember(row,primaryId))===pair && targetMember(row,primaryId).covenant).map(row=>covenantKey(targetMember(row,primaryId))))];
        for(const contract of contracts) {
            await selectEquipment(pair,contract);
            const keys = await page.locator('[data-choose-party]').evaluateAll(es=>es.map(e=>e.dataset.chooseParty));
            for (const key of keys) {
                const base = findClearTeams(partyIndex).teams.find(team=>team.key===key);
                const alternatives = findClearAlternatives(partyIndex,base,{include:[primaryId]});
                if(alternatives.length) {example={key,alternatives};break;}
            }
            if(example) break;
        }
        if(example) break;
    }
    assert.ok(example,'actual owned party supplies replacements');
    const primaryAlternatives = example.alternatives;
    for(const key of await page.locator('[data-choose-party]').evaluateAll(es=>es.map(e=>e.dataset.chooseParty))) assert.ok(key.split('|').every(id=>owned.has(id)));
    await page.locator(`[data-choose-party="${example.key}"]`).click();
    await expect(page.locator('.usage-clear-party')).toHaveAttribute('data-selected-party',example.key);
    const cohort = primaryRows.filter(row=>row.members.map(m=>m.characterId).sort().join('|')===example.key);
    const selectedPair = await page.locator('#usage-stat-wheel').inputValue();
    const expectedStats = covenantStatistics(cohort.filter(row=>wheelKey(targetMember(row,primaryId))===selectedPair),primaryId);
    const selectedKey = await page.locator('#usage-stat-contract-0').inputValue();
    const selectedStats = expectedStats.find(group=>group.key===selectedKey);
    assert.ok(selectedStats);
    if(selectedStats.options.total) await page.locator('#usage-stat-sub-options > summary').click();
    for(const stat of selectedStats.options.subs) await expect(page.locator(`.usage-stat-substats > .usage-stat-rates [data-stat-option="${stat.id}:${stat.unit}"] .usage-stat-rate`)).toHaveText((stat.rate*100).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%');
    const primaryCard = page.locator('.usage-clear-party');
    await primaryCard.locator('.usage-team-alternatives > summary').click();
    await expect(primaryCard.locator('[data-usage-alternative]')).toHaveCount(Math.min(5,primaryAlternatives.length));
    const replacement = JSON.parse(await primaryCard.locator('[data-usage-alternative]').first().getAttribute('data-usage-alternative'));
    assert.equal(replacement[0],primaryAlternatives[0].key);
    async function characterLayout(name) {
        const metrics = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,
            clipped:[...document.querySelectorAll('.character-usage button,.character-usage select,.character-usage summary')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1;}).map(e=>e.outerHTML.slice(0,100))}));
        assert.ok(metrics.overflow<=1 && !metrics.clipped.length,name+JSON.stringify(metrics));layouts.push({name,...metrics});
    }
    for(const width of [320,390,479,480,481,639,640,641,767,768,769,899,900,901,1023,1024,1025,1280]) {
        await page.setViewportSize({width,height:900});await characterLayout('awakener-'+width);
        if([390,1280].includes(width)) await page.screenshot({path:path.join(out,`visual-${width}.png`),fullPage:true});
    }
    for(const width of [320,390,1280]) {
        await page.setViewportSize({width,height:900});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await characterLayout('awakener-zoom200-'+width);
        await page.evaluate(()=>document.documentElement.style.fontSize='');
    }
    await page.setViewportSize({width:844,height:390});await characterLayout('awakener-landscape');
    await primaryCard.locator('[data-usage-alternative]').first().click();await expect(page.locator('#usage-record-dialog')).toBeVisible();
    const names = await page.locator('.usage-preview-members').innerText();for(const id of primaryAlternatives[0].members) assert.ok(names.includes(chars.get(id).name));
    await page.keyboard.press('Escape');await expect(primaryCard.locator('[data-usage-alternative]').first()).toBeFocused();
    const zoneUrl = new URL(primaryUrl);zoneUrl.searchParams.delete('wave');zoneUrl.searchParams.delete('difficulty');
    await page.goto(zoneUrl.href);await expect(page.locator('.usage-stat-equipment')).toBeVisible({timeout:30000});
    for(const wave of [1,2]) {
        if(await page.locator('#usage-statistics').getAttribute('open')===null) await page.locator('#usage-statistics-summary').click();
        await page.locator(`[data-stage-filter="wave"][data-stage-value="${wave}"]`).click();
        await expect(page.locator('[data-preview-wave]')).toHaveCount(0);
        const observed = equipmentStatistics(selectRows(usage,{wave:String(wave)}),primaryId);
        assert.ok(observed.optionGroup,'actual zone supplies a joint loadout to inspect');
        await selectEquipment(observed.selectedWheelKey,observed.selectedCovenantKey);
        await page.locator('#usage-stat-records').click();await expect(page.locator('#usage-record-dialog')).toBeVisible();
        assert.ok((await page.locator('#usage-preview-select option').allTextContents()).every(text=>text.includes(`${wave}구역`)));
        await page.keyboard.press('Escape');await expect(page.locator('#usage-stat-records')).toBeFocused();
    }
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
