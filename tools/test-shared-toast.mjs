import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.generated/shared-toast-proof';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false});
const results=[];
const pages=[
 {name:'roster',url:'http://127.0.0.1:8766/inventory_checker.html',kind:'roster'},
 {name:'party',url:'http://127.0.0.1:8766/party_builder.html',kind:'party'},
 {name:'simulator',url:'http://127.0.0.1:8766/covenant_simulator.html',kind:'simulator'},
 {name:'roster-build',url:'http://127.0.0.1:8766/.generated/roster-pages/',kind:'roster',built:true},
 {name:'party-build',url:'http://127.0.0.1:4185/',kind:'party',built:true},
 {name:'simulator-build',url:'http://127.0.0.1:4185/covenant_simulator.html',kind:'simulator',built:true}
];
try{for(const entry of pages){
 if(process.env.SHARED_TOAST_CASES&&!process.env.SHARED_TOAST_CASES.split(',').includes(entry.name))continue;
 const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addInitScript(()=>{localStorage.setItem('morimens-roster-tour-v1','done');localStorage.setItem('morimens-covenant-tour-v1','done');});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(entry.url);
 let trigger;
 if(entry.kind==='roster'){await p.waitForFunction(()=>document.body.dataset.rosterReady==='true');trigger=()=>p.locator('#bulk-toggle').click();}
 else if(entry.kind==='party'){await p.waitForFunction(()=>typeof window.saveAllData==='function'&&document.querySelector('#team-slots')?.children.length>0);const save=p.locator('button[onclick="saveAllData()"]');trigger=async()=>{if(await save.isVisible())await save.click();else await p.evaluate(()=>saveAllData());};}
 else{await p.locator('.simulator-panel[aria-busy=false]').waitFor();await p.locator('#preset-name-input').fill('공통 토스트');trigger=()=>p.locator('#save-preset-btn').click();}
 assert.equal(await p.evaluate(()=>typeof window.MorimensToast?.show),'function');
 const sizes=entry.built?[[390,900,1]]:[[320,900,1],[390,900,1],[768,900,1],[1024,900,1],[1280,900,1],[844,390,1],[320,900,2],[1280,900,2]];
 for(const [w,h,z]of sizes){await p.setViewportSize({width:w,height:h});await p.locator('html').evaluate((el,z)=>el.style.fontSize=z===2?'200%':'16px',z);await trigger();await p.waitForTimeout(400);
 const toast=p.locator('.morimens-toast');assert.equal(await toast.count(),1);assert.equal(await p.locator('#covenant-snackbar,.inventory-toast,.save-toast').count(),0);
 const m=await toast.evaluate(el=>{const r=el.getBoundingClientRect(),f=document.activeElement.getBoundingClientRect(),s=getComputedStyle(el);return {fits:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,focusTag:document.activeElement.tagName,overlap:document.activeElement!==document.body&&document.activeElement!==document.documentElement&&Math.min(r.right,f.right)>Math.max(r.left,f.left)+1&&Math.min(r.bottom,f.bottom)>Math.max(r.top,f.top)+1,role:el.getAttribute('role'),background:s.backgroundColor,borderRadius:s.borderRadius,pointerEvents:s.pointerEvents};});
 assert.equal(m.fits,true,JSON.stringify({entry:entry.name,w,h,z,...m}));assert.equal(m.overlap,false,JSON.stringify({entry:entry.name,w,h,z,...m}));assert.equal(m.role,'status');assert.equal(m.pointerEvents,'none');
 if(w===390||w===844)await p.screenshot({path:`${out}/${entry.name}-${w}.png`});results.push({name:entry.name,w,h,z,...m});}
 await p.locator('.morimens-toast').waitFor({state:'detached',timeout:4500});
 await trigger();await trigger();assert.equal(await p.locator('.morimens-toast').count(),1);await p.locator('.morimens-toast').waitFor({state:'detached',timeout:4500});
 if(entry.kind==='roster'&&!entry.built){await p.locator('html').evaluate(el=>el.style.fontSize='16px');await p.setViewportSize({width:390,height:900});await p.locator('.compact-select').first().click();await p.locator('[data-edit-level]').first().click();await p.locator('#save-next').check();await p.locator('#editor-submit').click();await p.waitForTimeout(400);assert.equal(await p.locator('#editor[open] .morimens-toast.success').count(),1);const footerFit=await p.locator('#editor .morimens-toast').evaluate(el=>el.getBoundingClientRect().bottom<=el.closest('dialog').querySelector('.dialog-footer').getBoundingClientRect().top+1);assert.equal(footerFit,true);await p.screenshot({path:`${out}/roster-modal.png`});await p.locator('#editor [data-close]').first().click();assert.equal(await p.locator('.morimens-toast').count(),0);}
 await writeFile(`${out}/${entry.name}-results.json`,JSON.stringify(results.filter(r=>r.name===entry.name),null,2));assert.deepEqual(errors,[],entry.name);console.log('PASS',entry.name,'existing UI → shared toast; responsive, timer removal, replacement, no focus obstruction');await context.close();
}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log('PASS shared toast',results.length,'responsive conditions');}finally{await browser.close();}
