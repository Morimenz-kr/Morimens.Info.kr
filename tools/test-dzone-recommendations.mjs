import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createPreviewServer } from './serve-dzone-preview.mjs';
import { normalizeUsage, sampleCount, wheelKey, covenantKey, targetMember, teamKey } from '../js/character-usage-model.mjs';

import { covenantStatistics } from '../js/usage-recommendations.mjs';

const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, '.generated/recommendations-check');
await fs.mkdir(out, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/character_manifest.json'), 'utf8'));
const server = createPreviewServer(); await new Promise(resolve => server.listen(9382, '127.0.0.1', resolve));
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
        await expect(page.locator('.usage-stat-equipment')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('#page-title')).toContainText(character.name);
        checked.push({ id: character.id, name: character.name, clears: sampleCount(data.rows), joint: sampleCount(joint), builds: Math.max(1, await page.locator('[data-choose-party]').count()) });
        if (checked.length % 10 === 0) console.log(`추천 세팅 화면 ${checked.length}/${manifest.length} 확인`);
    }
    if (checked.length) await fs.writeFile(path.join(out, 'characters.json'), JSON.stringify(checked, null, 2));
    await page.goto(url('doll_inferno')); await expect(page.locator('#usage-stat-records')).toBeVisible({ timeout:30000 });
    const source = normalizeUsage((await (await fetch(`${base}/data/dzone-meta/73/characters/doll_inferno.json`)).json()).data);
    const expectedGroups = covenantStatistics(source.rows,'doll_inferno');
    const rate = value => `${(value*100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
    async function assertRates(groups) {
        const more=page.locator('.usage-stat-more');
        await expect(more).not.toHaveAttribute('open');
        await expect(page.locator('[data-leading-slot]')).toHaveCount(6);
        for(const slot of groups[0].options.slots) {
            const top=slot.main[0];
            if(top) await expect(page.locator(`[data-leading-slot="${slot.slot}"] .usage-stat-rate`).first()).toHaveText(rate(top.rate));
        }
        await more.locator('summary').first().click();
        for(const option of groups[0].options.subs) {
            const element = page.locator(`.usage-stat-substats [data-stat-option="${option.id}:${option.unit}"] .usage-stat-rate`).first();
            await expect(element).toBeVisible();
            await expect(element).toHaveText(rate(option.rate));
        }
        await more.locator('summary').first().click();
    }
    await expect(page.locator('.usage-stat-equipment').first()).toHaveAttribute('data-stat-group',expectedGroups[0].key);
    await assertRates(expectedGroups);
    // The full catalogue is secondary, but remains keyboard-accessible and restores clear focus.
    await expect(page.locator('#usage-stat-contract-0')).not.toBeVisible();
    await page.locator('.usage-stat-other-contracts > summary').click();
    await page.locator('#usage-stat-contract-0').selectOption(expectedGroups[3].key);
    await expect(page.locator('#usage-stat-current')).toBeFocused();
    await expect(page.locator('.usage-stat-other-contracts')).not.toHaveAttribute('open');
    await page.locator('[data-stat-preset]').first().click();await assertRates(expectedGroups);
    await page.locator('#usage-wave-1').click();
    await expect(page.locator('#usage-wave-1')).toHaveAttribute('aria-pressed','true');
    const waveGroups=covenantStatistics(source.rows.filter(row=>row.wave===1),'doll_inferno');
    const waveSelected=await page.locator('#usage-stat-contract-0').inputValue();
    await assertRates([waveGroups.find(group=>group.key===waveSelected)]);
    await page.locator('#usage-difficulty-1').click();
    const jointGroups=covenantStatistics(source.rows.filter(row=>row.wave===1 && String(row.difficulty)==='1'),'doll_inferno');
    const jointSelected=await page.locator('#usage-stat-contract-0').inputValue();
    await assertRates([jointGroups.find(group=>group.key===jointSelected)]);
    await expect(page.locator('.usage-stat-leading-sub .usage-stat-rates > li')).toHaveCount(1);
    await expect(page.locator('.usage-stat-leading-sub .usage-stat-joint')).toContainText('공동 1순위');
    await page.locator('#usage-difficulty-all').click();
    await page.locator('#usage-wave-all').click();
    await page.locator('[data-stat-preset]').first().click();await assertRates(expectedGroups);
    await expect(page.locator('.usage-recommendations .usage-loadout-part,#usage-example-toggle,[data-preview-wave],.usage-my-source,.usage-party-equipment-heading')).toHaveCount(0);
    // Owning companions changes party suggestions, never the character's equipment statistics.
    await page.locator('#usage-party-picker-summary').click();
    await page.locator('#usage-owned-only').check();await assertRates(expectedGroups);
    await page.locator('#usage-owned-only').uncheck();
    const party = await page.locator('[data-choose-party]').first().getAttribute('data-choose-party');
    await page.locator('[data-choose-party]').first().click();
    const cohort = source.rows.filter(row=>teamKey(row)===party);
    const cohortGroups = covenantStatistics(cohort,'doll_inferno');
    const selected = await page.locator('#usage-stat-contract-0').inputValue();
    await assertRates([cohortGroups.find(g=>g.key===selected)]);
    await page.locator('[data-clear-party]').click();await assertRates(expectedGroups);
    await page.locator('#usage-stat-compare').click();
    await expect(page.locator('[data-stat-group]')).toHaveCount(2);
    await expect(page.locator('.usage-stat-substats [data-stat-option]').first().locator('.usage-stat-rate')).toHaveCount(2);
    await page.locator('#usage-stat-contract-1').selectOption(expectedGroups[1].key);
    await page.setViewportSize({width:390,height:900});
    const nameLines = await page.locator('.usage-stat-comparison-table th[scope=row] .usage-stat-option-name > span').evaluateAll(cells => cells.filter(cell=>['광기 충전 레벨','크리티컬 피해','검은 인장 드롭율'].includes(cell.textContent)).map(cell=>{const range=document.createRange();range.selectNodeContents(cell);return {text:cell.textContent,lines:range.getClientRects().length};}));
    assert.ok(nameLines.length && nameLines.every(cell=>cell.lines===1),'Korean labels remain readable as complete names: '+JSON.stringify(nameLines));
    async function layout(name) {
        const panels = await page.locator('.usage-stat-summary > section').evaluateAll(sections => sections.map(section => {
            const heading=section.querySelector('h5').getBoundingClientRect(), list=section.lastElementChild.getBoundingClientRect();
            return {headingTop:heading.top, top:list.top, bottom:list.bottom};
        }));
        if (panels.length===2 && Math.abs(panels[0].headingTop-panels[1].headingTop)<1) {
            assert.ok(Math.abs(panels[0].top-panels[1].top)<1 && Math.abs(panels[0].bottom-panels[1].bottom)<1, name+' paired statistic panels align '+JSON.stringify(panels));
        }
        const metrics = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, textOverflow: [...document.querySelectorAll('.usage-stat-rates li,.usage-stat-art > span:not(.usage-stat-art-frame)')].filter(el => el.getClientRects().length).some(el => el.scrollWidth > el.clientWidth + 1), clipped: [...document.querySelectorAll('.usage-recommendations button')].filter(el => el.getClientRects().length).some(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.height < (el.classList.contains('usage-zone') ? 27 : 43); }) }));
        assert.ok(metrics.overflow <= 1 && !metrics.clipped && !metrics.textOverflow, name + JSON.stringify(metrics)); layouts.push({ name, ...metrics });
    }
    for (const width of [320, 389, 390, 391, 479, 480, 481, 639, 640, 641, 767, 768, 769, 779, 780, 781, 899, 900, 901, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 }); await layout(`settings-${width}`);
        if ([320, 390, 1280].includes(width)) await page.screenshot({ path: path.join(out, `settings-${width}.png`), fullPage: true });
    }
    for (const width of [320,390,1280]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await layout('compare-zoom200-'+width);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.locator('#usage-stat-compare').click();
    for (const width of [320,389,390,391,639,640,641,768,1024,1280]) {
        await page.setViewportSize({width,height:900});await layout('single-'+width);
        if ([390,1280].includes(width)) await page.screenshot({path:path.join(out,`single-${width}.png`),fullPage:true});
    }
    // Different contracts have different option counts; both panels must still align.
    for (const width of [390,640,768,1024,1280]) {
        await page.setViewportSize({width,height:900});
        for (const preset of [0,1,2]) {
            await page.locator('[data-stat-preset]').nth(preset).click(); await layout(`balanced-${width}-${preset}`);
        }
        if ([390,1280].includes(width)) await page.locator('.usage-stat-summary').screenshot({path:path.join(out,`balanced-${width}.png`)});
    }
    await page.locator('[data-stat-preset]').first().click();
    let below=640,above=1024;
    while(above-below>1) {
        const width=Math.floor((below+above)/2);await page.setViewportSize({width,height:900});
        const inlineWidth=await page.locator('.usage-stat-settings').evaluate(el=>el.getBoundingClientRect().width);
        if(inlineWidth>=640) above=width;else below=width;
    }
    for(const width of [above-1,above,above+1]) {await page.setViewportSize({width,height:900});await layout('panel-boundary-'+width);}
    for(const width of [320,390,1280]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await layout('settings-zoom200-'+width);
        const panels=await page.locator('.usage-stat-summary > section').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));
        assert.ok(panels[1]>panels[0],'enlarged text reflows panels instead of stretching a narrow column');
        if(width===1280) await page.screenshot({path:path.join(out,'single-zoom200-1280.png'),fullPage:true});
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
    await page.locator('.usage-stat-more > summary').click();
    await page.locator('.usage-stat-slot-details > summary').click();
    for(const width of [320,390,639,640,641,768,1024,1280]) {
        await page.setViewportSize({width,height:900});await layout('expanded-'+width);
    }
    for(const width of [320,390,1280]) {
        await page.setViewportSize({width,height:900});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
        await layout('expanded-zoom200-'+width);await page.evaluate(()=>{document.documentElement.style.fontSize='';});
    }
    await page.locator('.usage-stat-more > summary').click();
    await page.setViewportSize({ width: 844, height: 390 }); await layout('settings-landscape');
    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator('#usage-party-picker-summary').click();
    await page.locator('[data-choose-party]').first().click();
    await page.locator('#usage-stat-records').scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.locator('#usage-stat-records').click(); await expect(page.locator('#usage-record-dialog')).toBeVisible();
    await expect(page.locator('#usage-statistics')).not.toHaveAttribute('open');
    await page.locator('[data-preview-member]').nth(1).click();
    await expect(page.locator('.usage-preview-body .usage-loadout-part')).toHaveCount(6);
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
    for (const width of [390,1280]) { await page.setViewportSize({width,height:900}); await page.screenshot({path:path.join(out,`party-${width}.png`)}); }
    await page.setViewportSize({width:390,height:900});
    if (await page.locator('#usage-preview-next').isEnabled()) { await page.locator('#usage-preview-next').click(); await expect(page.locator('.usage-preview-nav > span')).toContainText('2 /'); await page.locator('#usage-preview-prev').click(); }
    await page.keyboard.press('Escape'); await expect(page.locator('#usage-record-dialog')).toHaveCount(0);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 2, 'closing preserves page scroll');
    await expect(page.locator('#usage-stat-records')).toBeFocused();
    await page.locator('#usage-stat-records').click();
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
