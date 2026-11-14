import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

// Run after scarecrow:build, with the repository and ScareCrow servers running.
const simulatorUrl = process.env.COVENANT_SIMULATOR_URL || 'http://127.0.0.1:8766/covenant_simulator.html';
const partyUrl = process.env.SCARECROW_URL || 'http://127.0.0.1:4185/';
const out = '.generated/scarecrow/shared-covenant-proof';
await mkdir(out, {recursive: true});
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'msedge'});
// Isolated storage: never change a developer's saved parties or presets.
const context = await browser.newContext({viewport: {width: 1280, height: 900}});
context.setDefaultTimeout(20000);
const sim = await context.newPage(), party = await context.newPage(), errors = [];
for (const p of [sim, party]) p.on('pageerror', e => errors.push(e.message));
const proof = {functional: [], responsive: [], partControls: [], overviewToggle: []};
const verifyOverviewToggle=async(name,host,page,root,part)=>{
    const input=host.getByRole('spinbutton',{name:part+'번 강화 레벨',exact:true});
    const value=await input.inputValue();
    for(const [width,height,zoom] of [[320,900,1],[390,900,1],[768,900,1],[1024,900,1],[1280,900,1],[844,390,1],[390,900,2]]){
        await page.setViewportSize({width,height});
        await root.evaluate(zoom=>{document.documentElement.style.fontSize=zoom===2?'200%':'16px';},zoom);
        const button=host.locator('.member-contract-toolbar .member-overview-back');
        await button.scrollIntoViewIfNeeded();
        const before=await button.boundingBox(),node=await button.elementHandle();
        await button.click();
        await host.locator('.member-contract-overview').waitFor({state:'visible'});
        const after=await button.boundingBox();
        assert.ok(Math.abs(before.x-after.x)<=1&&Math.abs(before.y-after.y)<=1,'전환 버튼 위치 '+name+'/'+width);
        assert.equal(await node.evaluate(n=>n.isConnected&&n===document.activeElement&&n.textContent==='부위 편집'),true);
        await button.press('Enter');
        assert.equal(await input.inputValue(),value,'같은 부위·수치 복원');
        proof.overviewToggle.push({host:name,width,height,textZoom:zoom,before,after});
    }
    await root.evaluate(()=>{document.documentElement.style.fontSize='16px';});
    await page.setViewportSize({width:1280,height:900});
};
const copy = async host => {
    await host.getByRole('button', {name: '세팅 복사', exact: true}).click();
    const value = await host.getByRole('textbox', {name: '비밀계약 세팅', exact: true}).inputValue();
    await host.getByRole('button', {name: '닫기', exact: true}).click();
    return JSON.parse(value);
};
const paste = async (host, value) => {
    await host.getByRole('button', {name: '세팅 가져오기', exact: true}).click();
    await host.getByRole('textbox', {name: '비밀계약 세팅', exact: true}).fill(JSON.stringify(value));
    await host.getByRole('button', {name: '세팅 적용', exact: true}).click();
};
const openParty = async () => {
    await party.waitForFunction(() => window.scarecrowOriginalReady);
    await party.getByRole('button', {name: '폴룩스 비밀계약 선택', exact: true}).click();
    await party.frameLocator('#modal-damage iframe').getByRole('button', {name: '세팅 가져오기', exact: true}).waitFor();
    return party.frameLocator('#modal-damage iframe');
};
try {
    console.log('시뮬레이터 시작');
    await sim.goto(simulatorUrl);
    const initial = await copy(sim);
    console.log('초기 세팅 복사');
    await sim.locator('.member-contract-binding input').check();
    await sim.locator('.member-contract-binding input').uncheck();
    // An actual v1 snapshot/preset lacks per-slot IDs and global binding.
    const legacy = await sim.evaluate(() => JSON.parse(localStorage.getItem('morimens_covenant_simulator_state_v1')));
    legacy.version = 1; delete legacy.contractBound;
    for (const p of legacy.parts) delete p.setId;
    legacy.parts[0].substats[0].locked = true;
    await sim.evaluate(snapshot => {
        localStorage.setItem('morimens_covenant_simulator_state_v1', JSON.stringify(snapshot));
        localStorage.setItem('morimens_covenant_simulator_presets_v1', JSON.stringify([{id: 'legacy', name: '이전 프리셋', snapshot}]));
    }, legacy);
    await sim.reload();
    console.log('v1 저장 복원');
    await sim.locator('#preset-select').selectOption('legacy');
    await sim.locator('#load-preset-btn').click();
    assert.deepEqual(await copy(sim), initial);
    const before = await sim.evaluate(() => JSON.parse(localStorage.getItem('morimens_covenant_simulator_state_v1')));
    assert.equal(before.parts[0].substats[0].locked, true);
    const ids = await sim.evaluate(async () => Object.values((await (await fetch('data/covenant_editor.json')).json()).setIds));
    const setting = structuredClone(initial);
    setting.equipment.contractSlots = ids.slice(0, 2).flatMap(id => [id, id, id]);
    setting.equipment.contractBound = true;
    setting.equipment.trinkets.forEach((p, i) => {
        p.level = i * 2; p.bound = true;
        p.sub = [{id: 18159, value: 1.6}, {id: 18105, value: .3}, {id: 18126, value: 2}];
    });
    await paste(sim, setting);
    console.log('혼합 세팅 적용');
    const imported = await sim.evaluate(() => JSON.parse(localStorage.getItem('morimens_covenant_simulator_state_v1')));
    assert.deepEqual(imported.parts[0].goals, before.parts[0].goals);
    assert.equal(imported.parts[0].substats[0].locked, true);
    await sim.locator('#preset-select').selectOption('');
    await sim.locator('#preset-name-input').fill('왕복 세팅');
    await sim.locator('#save-preset-btn').click();
    await sim.reload(); assert.deepEqual(await copy(sim), setting);
    console.log('혼합 세팅 저장·새로고침');
    await sim.locator('[data-mode-tab=manual]').click();
    await sim.locator('#manual-reroll-btn').click();
    await sim.locator('#manual-apply-btn').click();
    await sim.locator('[data-mode-tab=editor]').click();
    await sim.locator('#preset-select').selectOption({label: '왕복 세팅'});
    await sim.locator('#load-preset-btn').click();
    assert.deepEqual(await copy(sim), setting);
    await sim.locator('[data-part-label="5"]').click();
    await verifyOverviewToggle('simulator',sim,sim,sim,6);
    await sim.getByRole('button',{name:'전체 보기',exact:true}).click();
    proof.functional.push('v1 저장·프리셋, 목표·잠금 유지, 혼합 세트 저장·새로고침, 전사·교체 후 프리셋 복원');
    console.log('시뮬레이터 저장·전사·프리셋 검사 통과');

    await party.goto(partyUrl); await party.waitForFunction(() => window.scarecrowOriginalReady);
    await party.getByRole('button', {name: '빠른 편성', exact: true}).click();
    for (const id of ['pollux', 'kathigu-ra', 'ogier', 'pandia']) await party.locator(`#grid-char [data-character-id="${id}"]`).click();
    await party.getByRole('button', {name: '배치 확정', exact: true}).click();
    assert.ok((await party.locator('.char-top-name').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fontFamily))).every(font=>font.includes('ScarecrowCardKR')));
    let frame = await openParty();
    // First equipment choice from any empty part initializes all six slots.
    await frame.locator('[data-part-label="5"]').click();
    const firstPicker = party.frameLocator('#modal-contract iframe');
    await firstPicker.locator('[data-contract="covenant_April"]').click();
    await firstPicker.locator('#equip-contract').click();
    await frame.getByRole('spinbutton', {name: '6번 강화 레벨', exact: true}).waitFor({state:'visible'});
    assert.deepEqual((await copy(frame)).equipment.contractSlots, Array(6).fill(ids[0]));
    await party.getByRole('button', {name:'← 뒤로가기',exact:true}).click();
    await frame.locator('.member-contract-overview').waitFor({state:'visible'});
    assert.equal(await party.getByRole('button',{name:'← 파티 편성',exact:true}).count(),1);
    await paste(frame, setting);
    assert.deepEqual(await copy(frame), setting);
    assert.equal(await frame.locator('.member-contract-overview').innerText(), await sim.locator('.member-contract-overview').innerText());
    await frame.locator('[data-apply]').click();
    await party.locator('#modal-damage.show').waitFor({state: 'hidden'});
    const growth = await party.evaluate(() => allPages[0].teams[0].scarecrowGrowth.pollux);
    await party.reload(); frame = await openParty();
    assert.deepEqual(await copy(frame), setting);
    assert.equal((await party.evaluate(() => allPages[0].teams[0].scarecrowGrowth.pollux)).level, growth.level);
    // Re-enter a part through the real set picker, then edit its level.
    await frame.locator('[data-part-label="0"]').click();
    const picker = party.frameLocator('#modal-contract iframe');
    await picker.locator('#equip-contract').click();
    await frame.getByRole('spinbutton', {name: '1번 강화 레벨', exact: true}).fill('12');
    const battleFrame=party.frames().find(f=>f.url().includes('battle.html'));
    await verifyOverviewToggle('scarecrow',frame,party,battleFrame,1);
    for(const [width,height,zoom] of [[320,900,1],[367,900,1],[369,900,1],[390,900,1],[768,900,1],[1024,900,1],[1280,900,1],[844,390,1],[390,900,2]]){
        await party.setViewportSize({width,height});
        if(zoom===2)await battleFrame.evaluate(()=>{document.documentElement.style.fontSize='200%';});
        const metrics=await battleFrame.evaluate(()=>{
            const part=document.querySelector('[data-covenant-position="1"]');
            return {width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...part.querySelectorAll('.contract-option-row')].map(row=>{
                const range=row.querySelector('input[type=range]'),number=row.querySelector('input[type=number]');
                return {range:range.getBoundingClientRect().width,number:number.getBoundingClientRect().width,value:number.value,icons:[...row.querySelectorAll('.contract-option-icons img')].map(n=>({width:n.getBoundingClientRect().width,loaded:n.naturalWidth>0}))};
            })};
        });
        assert.ok(metrics.scroll<=metrics.width+1,'부위 편집 가로 넘침 '+width);
        for(const row of metrics.controls){assert.ok(row.range>=48,'슬라이더 축소 '+width);assert.ok(row.number>=40,'숫자 입력 축소 '+width);assert.ok(row.icons.every(i=>i.width>=18&&i.loaded),'아이콘 축소·누락 '+width);}
        assert.equal(metrics.controls[0].value,'12');
        proof.partControls.push({width,height,textZoom:zoom,metrics});
        if(width===320||width===1280||zoom===2)await party.screenshot({path:`${out}/part-controls-${width}-${zoom}x.png`,fullPage:true});
    }
    await battleFrame.evaluate(()=>{document.documentElement.style.fontSize='16px';});
    await party.setViewportSize({width:1280,height:900});
    await party.getByRole('button',{name:'← 뒤로가기',exact:true}).click();
    await frame.locator('.member-contract-overview').waitFor({state:'visible'});
    const edited = await copy(frame); assert.equal(edited.equipment.trinkets[0].level, 12);
    await frame.locator('[data-apply]').click();
    await party.locator('#modal-damage.show').waitFor({state: 'hidden'});
    await paste(sim, edited); assert.deepEqual(await copy(sim), edited);
    proof.functional.push('시뮬레이터→파티 계약 적용·저장·재접속·부위 재편집→시뮬레이터, 합계·귀속·성장 유지');
    frame = await openParty();
    console.log('ScareCrow 왕복·저장·재편집 검사 통과');
    for (const [name, host, p] of [['simulator', sim, sim], ['scarecrow', frame, party]]) {
        const unchanged = await copy(host);
        await host.getByRole('button', {name: '세팅 가져오기', exact: true}).click();
        await host.getByRole('textbox', {name: '비밀계약 세팅', exact: true}).fill('{bad');
        await host.getByRole('button', {name: '세팅 적용', exact: true}).click();
        assert.match(await host.locator('.covenant-transfer-status').innerText(), /끝까지 복사/);
        await host.getByRole('textbox', {name: '비밀계약 세팅', exact: true}).press('Escape');
        assert.equal(await host.locator('[data-covenant-import]').evaluate(n => n === document.activeElement), true);
        assert.deepEqual(await copy(host), unchanged);
        for (const [width, height, zoom] of [[320,900,1],[390,900,1],[607,900,1],[609,900,1],[768,900,1],[1024,900,1],[1280,900,1],[844,390,1],[390,900,2]]) {
            await p.setViewportSize({width, height});
            const root = name === 'simulator' ? sim : party.frames().find(f => f.url().includes('battle.html'));
            if (zoom === 2) await root.evaluate(() => {
                const sizes = [...document.querySelectorAll('body, body *')].map(n => [n, parseFloat(getComputedStyle(n).fontSize)]);
                for (const [node, size] of sizes) node.style.fontSize = size * 2 + 'px';
            });
            await host.getByRole('button', {name: '세팅 가져오기', exact: true}).click();
            const metrics = await root.evaluate(() => {
                const d = document.querySelector('.covenant-transfer-dialog[open]'), b = d.getBoundingClientRect();
                const buttons = [...d.querySelectorAll('button')].filter(n => !n.hidden).map(n => {const r=n.getBoundingClientRect();return {w:r.width,h:r.height};});
                return {viewport:innerWidth,document:document.documentElement.scrollWidth,dialog:{x:b.x,right:b.right,width:b.width,scroll:d.scrollWidth,client:d.clientWidth},buttons};
            });
            assert.ok(metrics.document <= metrics.viewport + 1, name+' page overflow '+width);
            assert.ok(metrics.dialog.x >= -1 && metrics.dialog.right <= metrics.viewport + 1, name+' dialog bounds '+width);
            assert.ok(metrics.dialog.scroll <= metrics.dialog.client + 1, name+' dialog overflow '+width);
            assert.ok(metrics.buttons.every(b => b.w >= 24 && b.h >= 24), name+' targets '+width);
            await host.getByRole('button', {name: '세팅 적용', exact: true}).scrollIntoViewIfNeeded();
            if ([320,1280,844].includes(width) || zoom === 2) await p.screenshot({path:`${out}/${name}-${width}-${height}-${zoom}x.png`,fullPage:true});
            await host.getByRole('textbox', {name: '비밀계약 세팅', exact: true}).press('Escape');
            proof.responsive.push({host:name,width,height,textZoom:zoom,metrics});
            console.log(`${name} ${width}×${height} 글자 ${zoom*100}% 통과`);
        }
    }
    assert.deepEqual(errors, []);
    proof.functional.push('양쪽 호스트의 손상 입력 거부·값 보존·Escape 포커스 복귀');
    await writeFile(`${out}/results.json`, JSON.stringify(proof, null, 2)+'\n');
    console.log(JSON.stringify({passed:true,functional:proof.functional,responsiveCases:proof.responsive.length}));
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
