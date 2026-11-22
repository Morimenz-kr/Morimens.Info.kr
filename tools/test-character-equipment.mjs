import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createPreviewServer } from './serve-dzone-preview.mjs';
import { normalizeUsage, targetMember, wheelKey, covenantKey, sampleCount, teamKey } from '../js/character-usage-model.mjs';
import { wheelStatistics, covenantStatistics } from '../js/usage-recommendations.mjs';

// Isolated, public snapshot browser checks. Never opens the user's browser or writes roster state.
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'.generated/character-equipment-check');
await fs.mkdir(out,{recursive:true});
const server=createPreviewServer(root, { showPartyRecommendations: true });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(9384,'127.0.0.1',resolve);});
const base='http://127.0.0.1:9384',id='doll_inferno',errors=[],layouts=[],checks=[];
const rate=n=>`${(n*100).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
let browser,workerRequests=0;
try {
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*.workers.dev/**',r=>{workerRequests++;return r.abort();});
 await context.route('**/*google-analytics.com/**',r=>r.abort());await context.route('**/*googletagmanager.com/**',r=>r.abort());
 const data=normalizeUsage((await(await fetch(`${base}/data/dzone-meta/73/characters/${id}.json`)).json()).data),rows=data.rows;
 const member = row => targetMember(row,id);
 const wheels = wheelStatistics(rows,id);
 const contracts = covenantStatistics(rows,id);
 const top = contracts[0];
 const qualified = rows.filter(row => covenantKey(member(row))===top.key && member(row).covenant.completion>=90);
 const total = sampleCount(qualified);
 assert.ok(new Set(qualified.map(row=>wheelKey(member(row)))).size>1,'fixture covers multiple wheel pairs');
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 let serial=0;const visit=async page=>{await page.goto(`${base}/links.html?category=character&id=${id}&period=73&equipmentTest=${serial++}#usage`);await page.locator('[data-equipment-section=wheels]').waitFor({timeout:30000});};
 await visit(p);
 await expect(p.locator('.usage-stat-settings')).not.toContainText(/전체 조합|전체 계약|계약 비교|명륜별 채용률|\d+\s*세트/);
 await expect(p.locator('.usage-stat-settings select')).toHaveCount(0);
 for(const [section,groups,limit] of [['wheels',wheels,5],['covenants',contracts,3]]) {
  const rankItems=p.locator(`[data-equipment-section=${section}] [data-rank-key]`);
  assert.deepEqual(await rankItems.evaluateAll(es=>es.map(e=>e.dataset.rankKey)),groups.slice(0,limit).map(group=>group.key));
 }
 await expect(p.locator('[data-equipment-section=wheels] [data-rank-key]').first().locator('span').nth(1)).toHaveText(/\S \+ \S/);
 await expect(p.locator('[data-equipment-section=wheels] [data-rank-key] b')).toHaveText(wheels.slice(0,5).map(group=>rate(group.rate)));
 const mainDetails=p.locator('#usage-stat-main-options > summary');
 await expect(mainDetails).toHaveAccessibleName('주옵션 채용률 자세히 보기');
 await expect(p.locator('#usage-stat-sub-options > summary')).toHaveAccessibleName('부옵션 채용률 자세히 보기');
 await mainDetails.press('Enter');
 await expect(p.locator('#usage-stat-main-options')).toHaveAttribute('open','');
 await expect(p.locator('#usage-stat-sub-options')).not.toHaveAttribute('open');
 await p.locator('#usage-stat-sub-options > summary').click();
 const mains=Array.from({length:6},()=>new Map()), subs=new Map();
 for(const row of qualified) {
  for(const part of member(row).covenant.parts){
   const key=`${part.main.id}:${part.main.unit}`,slot=mains[part.slot-1];
   slot.set(key,(slot.get(key)||0)+row.count);
   for(const stat of part.subs){
    const subKey=`${stat.id}:${stat.unit}`;
    subs.set(subKey,(subs.get(subKey)||0)+row.count);
   }
  }
 }
 for(const [index,values]of mains.entries())for(const [key,count]of values)await expect(p.locator(`.usage-stat-mainstats [data-stat-slot="${index+1}"] [data-stat-option="${key}"] .usage-stat-rate`)).toHaveText(rate(count/total));
 assert.equal(subs.size,8);
 const totalSubLines=[...subs.values()].reduce((sum,count)=>sum+count,0);
 let shownTenths=0;
 for(const [key,count]of subs){
  const option=p.locator(`.usage-stat-substats > .usage-stat-rates [data-stat-option="${key}"]`);
  const tenths=Math.round(parseFloat(await option.locator('.usage-stat-rate').innerText())*10);
  assert.ok(Math.abs(tenths-count/totalSubLines*1000)<1);
  shownTenths+=tenths;
 }
 assert.equal(shownTenths,1000,'the eight rendered values sum to exactly 100%');
 await expect(p.locator('.usage-stat-settings')).not.toContainText(/공동 1순위|동률 후보/);
 checks.push('contract rates across all wheel pairs');
 const contractOptions=p.locator('.usage-stat-distributions');
 const originalOptions=await contractOptions.innerText();
 const alternateWheels=p.getByRole('button',{name:/허무로 추락하는 인형 \+ 죽음을 넘어/});
 await alternateWheels.press('Enter');
 await expect(alternateWheels).toHaveAttribute('aria-pressed','true');
 await expect(alternateWheels).toBeFocused();
 await expect(p.locator('.usage-stat-wheel-pair [data-equipment]')).toHaveText(['허무로 추락하는 인형','죽음을 넘어']);
 assert.equal(await contractOptions.innerText(),originalOptions,'new wheel pair does not alter contract rates');
 const alternateContract=p.getByRole('list',{name:'비밀계약 채용 순위'}).getByRole('button',{name:/^재진화\s/});
 await alternateContract.click();
 await expect(alternateContract).toHaveAttribute('aria-pressed','true');
 await expect(alternateWheels).toHaveAttribute('aria-pressed','true');
 await expect(p.locator('.usage-stat-contract-art [data-equipment]')).toHaveText('재진화');
 await expect(contractOptions).toHaveAccessibleName('재진화 옵션 채용률');
 const alternateGroup=contracts[1];
 for(const option of alternateGroup.options.subs)await expect(p.locator(`.usage-stat-substats > .usage-stat-rates [data-stat-option="${option.id}:${option.unit}"] .usage-stat-rate`)).toHaveText(rate(option.percentTenths/1000));
 checks.push('wheel and contract ranks update only their own display');
 const before=await p.locator('.usage-stat-settings').innerText();
 const cards=p.locator('.usage-party-card');
 await expect(cards).toHaveCount(3);
 await expect(p.locator('#usage-party-picker')).toHaveCount(0);
 const card=cards.nth(1);
 const loadouts=card.locator('[data-preview-party]');
 await expect(loadouts.locator('img')).toHaveCount(4);
 await expect(loadouts).toHaveText('');
 await expect(card.locator('.usage-party-candidates')).toBeVisible();
 assert.equal((await card.getAttribute('data-team')).split('|').length,3);
 const party=await loadouts.getAttribute('data-preview-party');
 const records=rows.filter(row=>teamKey(row)===party&&wheelKey(member(row))&&covenantKey(member(row)));
 await loadouts.click();
 await expect(p.locator('#usage-record-dialog')).toBeVisible();
 await expect(p.locator('[data-preview-member="doll_inferno"]')).toHaveAttribute('aria-pressed','true');
 await expect(p.locator('#usage-preview-select option')).toHaveCount(records.length);
 for(const index of [0,records.length-1]){
  await p.locator('#usage-preview-select').selectOption(String(index));
  const shownWheels=(await p.locator('.usage-preview-body .usage-loadout-wheels [data-equipment]').evaluateAll(es=>es.map(e=>e.dataset.equipment))).sort();
  const parts=await p.locator('.usage-preview-body [data-covenant-id]').evaluateAll(es=>es.map(e=>e.dataset.covenantId));
  const shownContracts=[...new Set(parts)].map(id=>id+':'+parts.filter(part=>part===id).length).sort();
  assert.ok(records.some(row=>wheelKey(member(row))===(shownWheels.join('|')||'__unequipped__') && covenantKey(member(row))===shownContracts.join('|')));
  await expect(p.locator('#usage-record-dialog')).not.toContainText(/\d+\s*세트/);
 }
 await p.locator('#usage-preview-close').click();
 await expect(loadouts).toBeFocused();
 assert.equal(await p.locator('.usage-stat-settings').innerText(),before);
 checks.push('party card opens its recorded loadouts and restores focus');
 const sizes=[[320,900,1],[390,900,1],[639,900,1],[640,900,1],[641,900,1],[561,900,1],[562,900,1],[563,900,1],[768,900,1],[1023,900,1],[1024,900,1],[1280,900,1],[320,900,2],[390,900,2],[1280,900,2],[844,390,1]];
 for(const [width,height,zoom]of (process.argv.includes('--flow-only')?[]:sizes)){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await visit(page);await page.evaluate(z=>document.documentElement.style.fontSize=z===2?'200%':'',zoom);
  for(const mode of ['default','expanded','slot-options']){
   if(mode==='expanded'){await page.locator('#usage-stat-main-options > summary').click();await page.locator('#usage-stat-sub-options > summary').click();}
   if(mode==='slot-options')await page.locator('.usage-stat-slot-details > summary').click();
   await expect(page.locator('.usage-stat-settings')).not.toContainText(/\d+\s*세트/);
   if(mode==='default'){
    const partySection=page.locator('.usage-clear-party');
    const partyLayout=await partySection.evaluate(section=>{
     const cards=[...section.querySelectorAll('.usage-party-card')];
     const tools=section.querySelector('.usage-party-tools').getBoundingClientRect();
     const first=cards[0].getBoundingClientRect();
     const distinctRows=new Set(cards.map(card=>card.getBoundingClientRect().top)).size;
     const controlsFit=cards.every(card=>{
      const lineup=card.querySelector('.usage-party-lineup').getBoundingClientRect();
      const candidates=card.querySelector('.usage-party-candidates');
      const group=candidates.getBoundingClientRect();
      return (lineup.bottom<=group.top || lineup.right<=group.left)
        && [...candidates.querySelectorAll('button')].every(button=>button.getBoundingClientRect().height>=44);
     });
     return {fits:cards.every(card=>card.scrollWidth<=card.clientWidth+1),filterAbove:tools.bottom<=first.top,columns:cards.length/distinctRows,controlsFit};
    });
    assert.ok(partyLayout.fits&&partyLayout.filterAbove&&partyLayout.controlsFit,JSON.stringify(partyLayout));
    assert.equal(partyLayout.columns,1);
    if([390,1280].includes(width)&&zoom===1)await partySection.screenshot({path:path.join(out,`party-cards-${width}.png`)});
    const report=page.locator('#floating-report-btn');
    await expect(report).toBeVisible();
    await expect(report).toHaveText('🚨');
    const content=await page.locator('.usage-stat-settings').boundingBox();
    const reportBox=await report.boundingBox();
    if(width>=1024){
     assert.ok(reportBox.x>=content.x+content.width,'floating report stays outside the recommendations');
    }else assert.ok(reportBox.y+reportBox.height<=content.y,'mobile report stays above the recommendations');
    await report.press('Enter');
    const reportDialog=page.locator('dialog#report-modal');
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.locator('#report-source-url')).toHaveValue(page.url());
    const submit=reportDialog.getByRole('button',{name:'제보 보내기'});
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    if([390,1280].includes(width)&&zoom===1)await page.screenshot({path:path.join(out,`report-${width}.png`)});
    await page.keyboard.press('Escape');
    await expect(reportDialog).toBeHidden();
    await expect(report).toBeFocused();
    const headers=page.locator('.usage-stat-option-disclosure > summary');
    await expect(headers.locator('.usage-stat-option-action')).toHaveText(['자세히 보기','자세히 보기']);
    const rightAligned=await headers.evaluateAll(rows=>rows.every(row=>{
     const [title,action]=row.children;
     const headerBox=row.getBoundingClientRect();
     const titleBox=title.getBoundingClientRect();
     const actionBox=action.getBoundingClientRect();
     const sameLine=titleBox.right<actionBox.left&&Math.abs(titleBox.top+titleBox.height/2-actionBox.top-actionBox.height/2)<1;
     const narrowHeader=titleBox.bottom<=actionBox.top&&titleBox.width+actionBox.width+parseFloat(getComputedStyle(row).columnGap)>headerBox.width;
     return headerBox.height>=44&&Math.abs(headerBox.right-actionBox.right)<1&&(sameLine||narrowHeader);
    }));
    assert.ok(rightAligned,`option detail labels align at ${width}px / ${zoom*100}%`);
    const ranks=page.locator('[data-equipment-section=wheels] [data-rank-key]');
    const aligned=await ranks.evaluateAll(rows=>rows.every(row=>{
     const [rank,name,rate]=row.children;
     const center=el=>{const {top,height}=el.getBoundingClientRect();return top+height/2;};
     const style=getComputedStyle(row);
     const rowCenter=center(row)+(parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth))/2;
     return [rank,name,rate].every(el=>Math.abs(center(el)-rowCenter)<1);
    }));
    assert.ok(aligned,`wheel pair aligns to the centered rank at ${width}px / ${zoom*100}%`);
    if([390,1280].includes(width)&&zoom===1)await page.getByRole('list',{name:'명륜 조합 채용 순위'}).screenshot({path:path.join(out,`wheel-ranks-${width}.png`)});
   }
   const result=await page.locator('.usage-stat-settings').evaluate(root=>{const visible=e=>e.getClientRects().length>0;const esc=[...root.querySelectorAll('button,select,img,.usage-stat-option-name,.usage-stat-rate')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();const frame=e.closest('.usage-stat-art-frame');const clip=frame&&getComputedStyle(frame).overflowX==='hidden'?frame.getBoundingClientRect():r;return Math.max(r.left,clip.left)<-.5||Math.min(r.right,clip.right)>innerWidth+.5;}).map(e=>e.tagName+':'+e.textContent.slice(0,30));return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),escaping:esc,brokenImages:[...root.querySelectorAll('img')].filter(visible).filter(e=>e.complete&&e.naturalWidth===0).map(e=>e.getAttribute('src')),font:getComputedStyle(root.querySelector('.usage-stat-rate')).fontSize};});
   assert.equal(result.overflow,0,JSON.stringify({width,height,zoom,mode,result}));assert.deepEqual(result.escaping,[],JSON.stringify({width,height,zoom,mode,result}));assert.deepEqual(result.brokenImages,[]);
   layouts.push({width,height,zoom,mode,...result});
   if([390,1280].includes(width)&&zoom===1){await page.locator('.usage-stat-settings').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-20));await page.screenshot({path:path.join(out,`${mode}-${width}.png`),fullPage:true});}
  }await page.close();console.log(`장비 UI ${width}×${height} ${zoom*100}% 3상태 확인`);
 }
 assert.equal(workerRequests,0,'no feedback Worker requests');assert.deepEqual(errors,[],'no browser runtime errors');
 await fs.writeFile(path.join(out,process.argv.includes('--flow-only')?'flow-results.json':'results.json'),JSON.stringify({passed:true,checks,layouts,workerRequests,errors,initial:{wheel:wheels[0].key,covenant:top.key}},null,2));
 console.log(`PASS: ${checks.length} semantic flows, ${layouts.length} responsive states, Worker ${workerRequests}`);
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,layouts,workerRequests,errors},null,2));throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
