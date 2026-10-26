import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const read = async p => JSON.parse(await readFile(p,'utf8'));
const site = '.generated/scarecrow/site';
const chars = await read(`${site}/data/character_manifest.json`), wheels = await read(`${site}/data/wheel_list.json`);
const catalog = await read(`${site}/catalog.json`), info = await read(`${site}/build-info.json`);
const out = '.generated/scarecrow/checkpoint-proof'; await mkdir(out,{recursive:true});
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge'});
const page = await browser.newPage({viewport:{width:1280,height:900}}), errors=[], proof={dedicated:[],wheels:[],viewports:[]};
page.on('pageerror',e=>errors.push(e.message));
const base = process.env.SCARECROW_URL || 'http://127.0.0.1:4185/';
try {
    await page.goto(base); await page.waitForFunction(()=>window.scarecrowOriginalReady);
    await page.getByText('빠른 편성',{exact:true}).click();
    assert.equal(await page.locator('#grid-char .grid-item-character').count(),chars.length);
    for(const id of info.unsupported.characters) assert.match(await page.locator(`[data-character-id="${id}"]`).innerText(),/계산 준비 중/);
    await page.locator('#modal-char .close-btn').click();
    const fixture = async id => page.evaluate(id=>{allPages[0].teams[0]=createEmptyTeam(0);allPages[0].teams[0].chars=[id,null,null,null];currentPageIdx=0;currentTeamIdx=0;renderAll();},id);
    for(const c of chars.filter(c=>!info.unsupported.characters.includes(c.id))) {
        await fixture(c.id); await page.getByRole('button',{name:`${c.name} 명륜 1 선택`,exact:true}).click();
        for(const grade of ['SSR','SR']) {
            const expected = wheels.find(w=>w.grade===grade&&w.owner_character_ids?.includes(c.id)&&!info.unsupported.wheels.includes(w.english_name));
            const button=page.locator(grade==='SSR'?'#btn-equip-ssr':'#btn-equip-sr');
            assert.equal(await button.isDisabled(),!expected,`${c.id} ${grade}`);
            if(expected) { await button.click(); assert.equal(await page.evaluate(({g})=>allPages[0].teams[0].wheels[0][g==='SSR'?0:1],{g:grade}),expected.english_name); }
            proof.dedicated.push({character:c.id,grade,weapon:expected?.english_name||null});
        }
        await page.locator('#btn-wheel-done').click();
    }
    console.log('Dedicated buttons',proof.dedicated.length);
    for(const w of wheels) {
        await fixture('tulu'); await page.getByRole('button',{name:'툴루 명륜 1 선택',exact:true}).click();
        await page.locator('#wheel-search-input').fill(w.korean_name);
        const option=page.locator(`[data-equipment-id="${w.english_name}"]`);
        assert.equal(await option.count(),1,w.english_name);
        if(info.unsupported.wheels.includes(w.english_name)) assert.match(await option.innerText(),/계산 준비 중/);
        else {
            await option.click(); assert.equal(await page.evaluate(()=>allPages[0].teams[0].wheels[0][0]),w.english_name);
            await page.locator('#scarecrow-wheel-refinement').selectOption('3'); await page.locator('#scarecrow-wheel-enhancement').selectOption('12');
            proof.wheels.push(w.english_name);
        }
        await page.locator('#btn-wheel-done').click();
        if(proof.wheels.length%36===0) console.log('Wheel records',proof.wheels.length);
    }
    proof.keys=[]; proof.dedicatedKeys=[]; proof.contracts=[];
    const keyRecords=await read(site+'/data/silverkey_list.json');
    for(const c of chars.filter(c=>!info.unsupported.characters.includes(c.id))) {
        await fixture(c.id);await page.locator('.silverkey-box').click();
        const expected=keyRecords.find(k=>k.owner_character_ids?.includes(c.id)&&!info.unsupported.keys.includes(k.english_name));
        assert.equal(await page.locator('#btn-equip-key').isDisabled(),!expected,c.id);
        if(expected){await page.locator('#btn-equip-key').click();assert.equal(await page.evaluate(()=>allPages[0].teams[0].key),expected.english_name);}
        else await page.locator('#modal-key .close-btn').click();
        proof.dedicatedKeys.push(c.id);
    }
    for(const k of keyRecords){
        await fixture('tulu');await page.locator('.silverkey-box').click();await page.locator('#key-search-input').fill(k.korean_name);
        const button=page.locator('[data-equipment-id="'+k.english_name+'"]');assert.equal(await button.count(),1);
        if(info.unsupported.keys.includes(k.english_name)){assert.match(await button.innerText(),/계산 준비 중/);await page.locator('#modal-key .close-btn').click();}
        else{await button.click();assert.equal(await page.evaluate(()=>allPages[0].teams[0].key),k.english_name);proof.keys.push(k.english_name);}
    }
    await fixture('tulu');
    for(const c of await read(site+'/data/covenant_list.json')){
        await page.getByRole('button',{name:'툴루 비밀계약 선택',exact:true}).click();const frame=page.frameLocator('#modal-contract iframe');
        await frame.locator('[data-contract="'+c.english_name+'"]').click();await frame.locator('#equip-contract').click();await page.locator('#modal-contract').waitFor({state:'hidden'});
        assert.equal(await page.evaluate(()=>allPages[0].teams[0].scarecrowContracts.tulu),c.clientSuitId);proof.contracts.push(c.english_name);
    }
    await page.locator('#scarecrow-relics').click();
    proof.relicVariants=await page.locator('#modal-relic iframe').evaluate(async el=>{
        const w=el.contentWindow;while(!w.RelicInfoPicker?.ready)await new Promise(r=>setTimeout(r,20));
        const catalog=await w.fetch('data/relic_catalog.json').then(r=>r.json()),ids=catalog.relics.flatMap(r=>r.variants.map(v=>v.id));
        for(const id of ids){let result;w.RelicInfoPicker.configure({selected:[id],available:ids,onChange:value=>result=value});
            const b=w.document.querySelector('[data-toggle-relic="'+id+'"]');if(!b)throw Error('Missing relic '+id);b.click();if(result.includes(id))throw Error('Relic remove '+id);
            w.document.querySelector('[data-toggle-relic="'+id+'"]').click();if(!result.includes(id))throw Error('Relic equip '+id);
        }return ids.length;
    });
    await page.locator('#modal-relic .modal-header button').click();
    console.log('Keys/contracts/relic variants',proof.keys.length,proof.contracts.length,proof.relicVariants);
    // A real UI selection, calculation, and persisted context; no game process.
    await fixture('tulu'); await page.getByText('빠른 편성',{exact:true}).click();
    for(const id of ['murphy','ogier','vortice']) await page.locator(`[data-character-id="${id}"]`).click();
    await page.getByText('배치 확정',{exact:true}).click();
    await page.getByRole('button',{name:'툴루 명륜 1 선택',exact:true}).click(); await page.locator('#btn-equip-ssr').click();
    await page.locator('#scarecrow-wheel-refinement').selectOption('3'); await page.locator('#scarecrow-wheel-enhancement').selectOption('12'); await page.locator('#btn-wheel-done').click();
    await page.getByRole('button',{name:'툴루 비밀계약 선택',exact:true}).click(); const contract=page.frameLocator('#modal-contract iframe');
    await contract.locator('[data-contract]').first().click();await contract.locator('#equip-contract').click();await page.locator('#modal-contract').waitFor({state:'hidden'});
    await page.locator('#scarecrow-relics').click(); const relic=page.frameLocator('#modal-relic iframe');
    await relic.locator('[data-toggle-relic]').first().click(); await page.locator('#modal-relic .modal-header button').click();
    await page.getByRole('button',{name:'카드·상황 →',exact:true}).click(); const damage=page.frameLocator('#modal-damage iframe');
    await damage.locator('[data-run]').click(); await damage.locator('footer').filter({hasText:'계산 완료'}).waitFor({timeout:90000});
    const calculation = await page.locator('#modal-damage iframe').evaluate(async f=>({snapshot:f.contentWindow.scarecrowLive.snapshot(),input:await f.contentWindow.scarecrowLive.preparedInput()}));
    assert.equal(calculation.snapshot.people[0].gearId1,9644); assert.equal(calculation.snapshot.people[0].refine1,12);
    await page.screenshot({path:`${out}/calculation-1280.png`,fullPage:true});
    await page.locator('#modal-damage .modal-header button').click(); await page.reload(); await page.waitForFunction(()=>window.scarecrowOriginalReady);
    const saved=await page.evaluate(()=>allPages[0].teams[0]); assert.equal(saved.chars.length,4); assert.equal(saved.scarecrowContext.relicIds.length,1);
    assert.equal(saved.scarecrowGrowth.tulu.refinement,'3'); assert.equal(saved.scarecrowGrowth.tulu.enhancement,'12'); assert.ok(saved.scarecrowContracts.tulu);
    for(const width of [320,390,519,520,521,767,768,769,1024,1280]) {
        await page.setViewportSize({width,height:900}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        await page.getByRole('button',{name:'툴루 명륜 1 선택',exact:true}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        if([320,390,1280].includes(width)) await page.screenshot({path:`${out}/wheel-${width}.png`,fullPage:true});
        await page.keyboard.press('Escape'); proof.viewports.push(width);
    }
    await page.setViewportSize({width:844,height:390}); await page.addStyleTag({content:'html{font-size:200%}'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false); await page.screenshot({path:`${out}/zoom200.png`,fullPage:true});
    assert.deepEqual(errors,[]); proof.calculation=true;proof.persistence=true;proof.errors=errors;proof.unsupported=info.unsupported;
    await writeFile(`${out}/verification.json`,JSON.stringify(proof,null,2)); console.log('CHECKPOINT PASS',proof.dedicated.length,proof.wheels.length);
} finally { await browser.close(); }
