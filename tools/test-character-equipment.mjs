import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createPreviewServer } from './serve-dzone-preview.mjs';
import { normalizeUsage, targetMember, wheelKey, covenantKey, sampleCount } from '../js/character-usage-model.mjs';
import { equipmentStatistics } from '../js/usage-recommendations.mjs';

// Isolated, public snapshot browser checks. Never opens the user's browser or writes roster state.
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'.generated/character-equipment-check');
await fs.mkdir(out,{recursive:true});
const server=createPreviewServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(9384,'127.0.0.1',resolve);});
const base='http://127.0.0.1:9384',id='doll_inferno',errors=[],layouts=[],checks=[];
const rate=n=>`${(n*100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
let browser,workerRequests=0;
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*.workers.dev/**',r=>{workerRequests++;return r.abort();});
 await context.route('**/*google-analytics.com/**',r=>r.abort());await context.route('**/*googletagmanager.com/**',r=>r.abort());
 const data=normalizeUsage((await(await fetch(`${base}/data/dzone-meta/73/characters/${id}.json`)).json()).data),rows=data.rows;
 const member=r=>targetMember(r,id),joint=(w,c)=>rows.filter(r=>member(r).wheels?.length===2&&wheelKey(member(r))===w&&covenantKey(member(r))===c);
 const model=equipmentStatistics(rows,id),jointCounts=new Map();
 for(const r of rows){const m=member(r);if(m.wheels?.length!==2||!m.covenant)continue;const key=JSON.stringify([wheelKey(m),covenantKey(m)]);jointCounts.set(key,(jointCounts.get(key)||0)+r.count);}
 assert.equal(sampleCount(model.jointRows),Math.max(...jointCounts.values()),'default is a most frequent observed joint, not independently joined top ranks');
 assert.deepEqual(model.jointRows,joint(model.selectedWheelKey,model.selectedCovenantKey));
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 let serial=0;const visit=async page=>{await page.goto(`${base}/links.html?category=character&id=${id}&period=73&equipmentTest=${serial++}#usage`);await page.locator('[data-equipment-section=wheels]').waitFor({timeout:30000});};
 const ranks=async page=>page.locator('[data-stat-wheel],[data-stat-preset]').evaluateAll(es=>es.map(e=>({key:e.dataset.statWheel||e.dataset.statPreset,text:e.innerText})));
 async function selection(page,w,c){
  assert.equal(await page.locator('#usage-stat-wheel').inputValue(),w);assert.equal(await page.locator('#usage-stat-contract-0').inputValue(),c);
  for(const [selector,key]of [['[data-stat-wheel]',w],['[data-stat-preset]',c]])for(const e of await page.locator(selector).all())assert.equal(await e.getAttribute('aria-pressed'),String((await e.getAttribute(selector.includes('wheel')?'data-stat-wheel':'data-stat-preset'))===key));
 }
 async function options(page,w,c){
  const qualified=joint(w,c).filter(r=>member(r).covenant.completion>=90),total=sampleCount(qualified);
  if(!total){await expect(page.locator('#usage-stat-distributions')).toContainText('옵션 기록이 없습니다');await expect(page.locator('#usage-stat-distributions .usage-stat-rate')).toHaveCount(0);return;}
  const slots=Array.from({length:6},()=>new Map()),subs=new Map();
  for(const r of qualified){const seen=new Set();for(const part of member(r).covenant.parts){const main=`${part.main.id}:${part.main.unit}`;slots[part.slot-1].set(main,(slots[part.slot-1].get(main)||0)+r.count);for(const sub of part.subs)seen.add(`${sub.id}:${sub.unit}`);}for(const key of seen)subs.set(key,(subs.get(key)||0)+r.count);}
  for(const kind of ['main','sub']){const d=page.locator(`#usage-stat-${kind}-options`);if(!await d.evaluate(e=>e.open))await d.locator(':scope > summary').click();}
  for(const [i,values]of slots.entries())for(const [key,count]of values)await expect(page.locator(`.usage-stat-mainstats [data-stat-slot="${i+1}"] [data-stat-option="${key}"] .usage-stat-rate`)).toHaveText(rate(count/total));
  for(const [key,count]of subs)await expect(page.locator(`.usage-stat-substats > .usage-stat-rates [data-stat-option="${key}"] .usage-stat-rate`)).toHaveText(rate(count/total));
  assert.equal(equipmentStatistics(rows,id,{wheelKey:w,covenantKey:c}).optionGroup.options.total,total);
  for(const kind of ['main','sub'])await page.locator(`#usage-stat-${kind}-options > summary`).click();
 }
 async function chooseWheel(page,key){await page.locator('.usage-equipment-catalogue > summary').click();await page.locator('#usage-stat-wheel').selectOption(key);}
 async function chooseContract(page,key){await page.locator('.usage-stat-other-contracts > summary').click();await page.locator('#usage-stat-contract-0').selectOption(key);}
 await visit(p);await expect(p.locator('[data-equipment-section=wheels] > header h4')).toHaveText('명륜');await expect(p.locator('[data-equipment-section=covenants] > header h4')).toHaveText('비밀계약');
 await expect(p.locator('#usage-wave')).not.toBeVisible();await expect(p.locator('#usage-difficulty')).not.toBeVisible();
 await selection(p,model.selectedWheelKey,model.selectedCovenantKey);await options(p,model.selectedWheelKey,model.selectedCovenantKey);checks.push('default joint and independent main/sub weighted rates');
 const baseline=await ranks(p);
 const alternate=model.wheelGroups.find(g=>g.key!==model.selectedWheelKey&&joint(g.key,model.selectedCovenantKey).some(r=>member(r).covenant.completion>=90));
 assert.ok(alternate,'real alternate wheel pair with options');await chooseWheel(p,alternate.key);await expect(p.locator('#usage-stat-wheel-heading')).toBeFocused();await selection(p,alternate.key,model.selectedCovenantKey);assert.deepEqual(await ranks(p),baseline,'global rankings do not change when pair changes');
 // A rendered catalogue must leave visible keyboard focus after selection.
 assert.ok(await p.evaluate(()=>{const e=document.activeElement;return e&&e!==document.body&&e.getBoundingClientRect().height>0;}),'wheel catalogue selection leaves visible keyboard focus');await options(p,alternate.key,model.selectedCovenantKey);
 await p.locator('#usage-stat-records').click();await expect(p.locator('#usage-record-dialog')).toBeVisible();await expect(p.locator('#usage-preview-select option')).toHaveCount(joint(alternate.key,model.selectedCovenantKey).length);await expect(p.locator('[data-preview-member="doll_inferno"]')).toHaveAttribute('aria-pressed','true');for(const index of [0,joint(alternate.key,model.selectedCovenantKey).length-1]){await p.locator('#usage-preview-select').selectOption(String(index));assert.deepEqual((await p.locator('.usage-preview-body .usage-loadout-wheels [data-equipment]').evaluateAll(es=>es.map(e=>e.dataset.equipment))).sort(),alternate.key.split('|').sort());const contracts=await p.locator('.usage-preview-body .usage-loadout-contracts > div').evaluateAll(es=>es.map(e=>e.querySelector('[data-equipment]').dataset.equipment+':'+e.querySelector('small').textContent.replace('세트','')).sort());assert.deepEqual(contracts,model.selectedCovenantKey.split('|').sort());}await p.locator('#usage-preview-close').click();checks.push('alternate pair keeps global rank and filters record evidence');
 const altContract=model.contractGroups.find(g=>g.key!==model.selectedCovenantKey&&joint(alternate.key,g.key).some(r=>member(r).covenant.completion>=90));
 assert.ok(altContract);await chooseContract(p,altContract.key);await expect(p.locator('#usage-stat-current')).toBeFocused();await selection(p,alternate.key,altContract.key);assert.deepEqual(await ranks(p),baseline,'global rankings do not change when contract changes');await options(p,alternate.key,altContract.key);checks.push('alternate contract exact joint option rates');
 let zero;for(const w of model.wheelGroups){const c=model.contractGroups.find(c=>joint(w.key,c.key).length===0);if(c){zero={w:w.key,c:c.key};break;}}
 assert.ok(zero,'real independently observed equipment with no joint evidence');await chooseWheel(p,zero.w);await chooseContract(p,zero.c);await selection(p,zero.w,zero.c);await options(p,zero.w,zero.c);await expect(p.locator('#usage-stat-records')).toHaveCount(0);assert.deepEqual(await ranks(p),baseline);checks.push('zero joint gives no fabricated options or record action');
 const sizes=[[320,900,1],[390,900,1],[639,900,1],[640,900,1],[641,900,1],[768,900,1],[1024,900,1],[1280,900,1],[390,900,2],[1280,900,2],[844,390,1]];
 for(const [width,height,zoom]of (process.argv.includes('--flow-only')?[]:sizes)){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await visit(page);await page.evaluate(z=>document.documentElement.style.fontSize=z===2?'200%':'',zoom);
  for(const mode of ['default','expanded','compare']){
   if(mode==='expanded'){await page.locator('#usage-stat-main-options > summary').click();await page.locator('#usage-stat-sub-options > summary').click();}
   if(mode==='compare')await page.locator('#usage-stat-compare').click();
   const result=await page.locator('.usage-stat-settings').evaluate(root=>{const visible=e=>e.getClientRects().length>0;const esc=[...root.querySelectorAll('button,select,img,.usage-stat-option-name,.usage-stat-rate')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5;}).map(e=>e.tagName+':'+e.textContent.slice(0,30));return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),escaping:esc,brokenImages:[...root.querySelectorAll('img')].filter(visible).filter(e=>e.complete&&e.naturalWidth===0).map(e=>e.getAttribute('src')),font:getComputedStyle(root.querySelector('.usage-stat-rate')).fontSize};});
   assert.equal(result.overflow,0,JSON.stringify({width,height,zoom,mode,result}));assert.deepEqual(result.escaping,[],JSON.stringify({width,height,zoom,mode,result}));assert.deepEqual(result.brokenImages,[]);
   layouts.push({width,height,zoom,mode,...result});
   if([390,1280].includes(width)&&zoom===1){await page.locator('.usage-stat-settings').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-20));await page.screenshot({path:path.join(out,`${mode}-${width}.png`),fullPage:true});}
  }await page.close();console.log(`장비 UI ${width}×${height} ${zoom*100}% 3상태 확인`);
 }
 assert.equal(workerRequests,0,'no feedback Worker requests');assert.deepEqual(errors,[],'no browser runtime errors');
 await fs.writeFile(path.join(out,process.argv.includes('--flow-only')?'flow-results.json':'results.json'),JSON.stringify({passed:true,checks,layouts,workerRequests,errors,initial:{wheel:model.selectedWheelKey,covenant:model.selectedCovenantKey},zero},null,2));
 console.log(`PASS: ${checks.length} semantic flows, ${layouts.length} responsive states, Worker ${workerRequests}`);
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,layouts,workerRequests,errors},null,2));throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}



