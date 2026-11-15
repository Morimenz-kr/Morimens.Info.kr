import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome'});
const key='morimens_covenant_simulator_state_v1';
const url=process.env.COVENANT_SIMULATOR_URL||'http://127.0.0.1:8766/covenant_simulator.html';
const context=await browser.newContext({hasTouch:true,isMobile:true});
await context.addInitScript(()=>localStorage.setItem('morimens-covenant-tour-v1','done'));
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.locator('.simulator-panel[aria-busy="false"]').waitFor();
const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
await mkdir('.generated/scarecrow/empty-picker-proof',{recursive:true});
try{
 await page.goto(url);await ready();
 for(const mode of ['editor','manual']){
  const field=mode==='editor'?'editorParts':'parts';
  const root=page.locator(mode==='editor'?'#shared-covenant-editor':'#manual-covenant-editor');
  for(const [width,height,zoom] of [[320,900,1],[390,900,1],[768,900,1],[1024,900,1],[1280,900,1],[844,390,1],[320,900,2],[1280,900,2]]){
   await page.setViewportSize({width,height});
   for(let index=0;index<6;index++){
    await page.evaluate(({key,field,mode})=>{
     const s=JSON.parse(localStorage.getItem(key));s.mode=mode;
     for(const p of s[field]){p.setId=0;p.mainOption='none';p.mainLevel=0;p.substats=p.substats.map(()=>({option:'none',level:1,locked:false}));}
     localStorage.setItem(key,JSON.stringify(s));
    },{key,field,mode});
    await page.reload();await ready();
    await page.locator('html').evaluate((el,z)=>el.style.fontSize=z===2?'200%':'16px',zoom);await frames();
    if(mode==='manual')await page.locator('#edit-transcription-part').tap();
    const before=await saved();
    await root.locator(`[data-part-label="${index}"]`).tap();
    const picker=page.locator('#covenant-set-dialog');await picker.waitFor({state:'visible'});
    assert.equal(await picker.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`picker overflow ${mode}/${width}/${zoom}`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    if(index===0){
     await page.screenshot({path:`.generated/scarecrow/empty-picker-proof/${mode}-${width}-${zoom}.png`});
     await page.locator('#close-covenant-set-picker').tap();
     assert.deepEqual(await saved(),before,'cancel must preserve all values');
     // Keyboard activation of the same empty part also opens the picker.
     await root.locator(`[data-part-label="${index}"]`).focus();await page.keyboard.press('Enter');
     await picker.waitFor({state:'visible'});
    }
    await page.locator('#contract-grid button').nth(1).tap();
    const after=await saved(),setId=after[field][0].setId;
    assert.ok(setId);assert.ok(after[field].every(p=>p.setId===setId),'first selection equips all six');
    for(const other of ['editorParts','parts','targetSimParts'].filter(f=>f!==field))assert.deepEqual(after[other],before[other],'other tabs unchanged');
    assert.equal(await root.locator(`[data-covenant-position="${index+1}"]`).isVisible(),true,'return to clicked part');
    if(mode==='manual')await page.locator('#close-manual-settings').tap();
    await page.reload();await ready();assert.deepEqual((await saved())[field],after[field],'selection survives reload');
   }
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS 96 empty-part flows: immediate picker, six-part equip, cancel, keyboard, independent banks, reload; 320/390/768/1024/1280/landscape/200%');
}finally{await browser.close();}
