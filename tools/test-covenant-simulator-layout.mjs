import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';

// Isolated Chrome storage; run against the source or the generated site.
const url=process.env.COVENANT_SIMULATOR_URL||'http://127.0.0.1:8766/covenant_simulator.html';
const out='.generated/scarecrow/simulator-layout-proof-'+new URL(url).port;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[],proof=[];
page.on('pageerror',error=>errors.push(error.message));
const ready=()=>page.locator('.simulator-panel[aria-busy="false"]').waitFor();
const mode=async name=>{await page.locator(`[data-mode-tab="${name}"]`).tap();assert.equal(await page.locator(`[data-mode-tab="${name}"]`).getAttribute('aria-selected'),'true');};
const edit=async index=>page.locator(`[data-target-edit-part="${index}"]`).tap();
const view=async name=>page.locator(`[data-target-editor-view="${name}"]`).tap();
await context.addInitScript(()=>localStorage.setItem('morimens-covenant-tour-v1','done'));
try{
 await page.goto(url);await ready();
 const hexSizes=new Map();
 for(const name of ['editor','manual','target']){
  await mode(name);
  if(name==='manual')await page.locator('[data-transcription-part="0"]').tap();
  for(const [width,height,zoom] of [[320,900,1],[390,900,1],[768,900,1],[1024,900,1],[1101,900,1],[1102,900,1],[1103,900,1],[1280,900,1],[844,390,1],[320,900,2],[1280,900,2]]){
   await page.setViewportSize({width,height});
   await page.locator('html').evaluate((node,z)=>node.style.fontSize=z===2?'200%':'16px',zoom);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const root=page.locator(name==='editor'?'#shared-covenant-editor .member-covenant-body':name==='manual'?'.transcription-workspace':'.target-contract-toolbar');
   await root.scrollIntoViewIfNeeded();
   if(name==='target')await page.locator('.target-controls-scroll').evaluate(node=>node.scrollTop=0);
   const metrics=await root.evaluate(node=>{
    const left=node.firstElementChild.getBoundingClientRect(),right=node.querySelector(':scope>.simulator-side-panel,:scope>.member-contract-detail').getBoundingClientRect(),capture=node.querySelector('.capture-panel'),result=capture&&!capture.hidden?capture.getBoundingClientRect():right;
    const selected=node.querySelector('.part-index-button[aria-pressed="true"]')||node.querySelector('.part-index-button'),style=getComputedStyle(selected);
    const body=node.querySelector('.target-controls-scroll'),summary=node.querySelector('#target-setting-import'),bodyRect=right,summaryRect=summary?.getBoundingClientRect();
    const statRows=[...node.querySelectorAll('.contract-attribute-totals>div')];
    const abilityOnRight=!!node.querySelector('.simulator-side-panel .contract-attribute-totals,:scope>.member-contract-detail .contract-attribute-totals');
    const statRowsVisible=statRows.length===8&&statRows.every(row=>{const r=row.getBoundingClientRect();if(r.height<=0)return false;for(let parent=row.parentElement;parent&&parent!==node;parent=parent.parentElement){if(['auto','scroll','hidden','clip'].includes(getComputedStyle(parent).overflowY)){const clip=parent.getBoundingClientRect();if(r.top<clip.top-1||r.bottom>clip.bottom+1)return false;}}return true;});
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,sideBySide:left.right<=right.x,centered:Math.abs((left.top+left.bottom-right.top-right.bottom)/2)<1,equalColumns:Math.abs(left.width-right.width)<1,left:left.height,right:right.height,diagramColumnWidth:left.width,balancedHeight:right.height<=left.height+80,unframed:getComputedStyle(node).backgroundColor==='rgba(0, 0, 0, 0)',resultInside:result.x>=right.x&&result.right<=right.right+1&&result.bottom<=right.bottom+1,presetVisible:!body||summaryRect.bottom<=bodyRect.bottom+1,hexWidth:node.querySelector('.covenant-hex-surface').getBoundingClientRect().width,statRowsVisible,
     levelLabelsFit:[...node.querySelectorAll('.target-goal-level')].filter(el=>el.getBoundingClientRect().width>0).every(el=>{const c=document.createElement('canvas').getContext('2d'),s=getComputedStyle(el);c.font=s.font;return el.clientWidth>=c.measureText(el.selectedOptions[0].textContent).width+parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)+24;}),selectedBackground:style.backgroundColor,selectedOutline:style.outlineStyle,abilityOnRight,
     targets:[...node.querySelectorAll('.part-index-button')].every(button=>{const r=button.getBoundingClientRect();return r.width>=44&&r.height>=44;})};
   });
   assert.equal(metrics.overflow,false);assert.equal(metrics.targets,true);assert.equal(metrics.levelLabelsFit,true,JSON.stringify({name,width,zoom,...metrics}));
   assert.equal(metrics.statRowsVisible,true,JSON.stringify({name,width,zoom,...metrics}));
   assert.equal(metrics.abilityOnRight,true,'ability and results must remain on the right');
   const sizeKey=[width,height,zoom].join('/');
   if(name==='editor')hexSizes.set(sizeKey,metrics.hexWidth);
   else assert.ok(Math.abs(metrics.hexWidth-hexSizes.get(sizeKey))<1,'same original size in '+name+'/'+sizeKey);
   if(width===1280)assert.equal(metrics.hexWidth,320,'original preset size, including text zoom');
   assert.equal(metrics.selectedBackground,'rgba(0, 0, 0, 0)');assert.equal(metrics.selectedOutline,'none');
   if(metrics.sideBySide){assert.equal(metrics.equalColumns,true);if(name!=='editor')assert.equal(metrics.centered,true,JSON.stringify({name,width,...metrics}));assert.equal(metrics.resultInside,true);}
   if(name==='target'&&metrics.sideBySide&&zoom===1)assert.equal(metrics.presetVisible,true,JSON.stringify({width,...metrics}));
   await page.screenshot({path:`${out}/${name}-${width}-${height}-${zoom}.png`});
   proof.push({name,width,height,zoom,...metrics});
  }
  await page.locator('html').evaluate(node=>node.style.fontSize='16px');
 }
 await page.setViewportSize({width:1280,height:900});await mode('target');await view('goals');
 for(let index=0;index<6;index++){
  await edit(index);const card=page.locator(`[data-target-part="${index}"]`);
  await card.locator('[data-goal-index="0"] .target-option-icons [data-option="critRate"]').tap();
  await card.locator('.target-goal-level').first().selectOption('3');
  for(let row=0;row<3;row++)await card.locator('.goal-enabled').nth(row).setChecked(row===0);
 }
 await page.evaluate(()=>{let i=0;Math.random=()=>i++%2===0?.01:.5;});
 await page.locator('#run-target-btn').tap();await page.waitForFunction(()=>!document.querySelector('#run-target-btn').disabled);
 assert.equal(await page.locator('#result-summary .part-result-card').count(),6);
 const longResult=await page.locator('.target-contract-toolbar').evaluate(root=>{
  const diagram=root.querySelector('.simulator-contract-visual').getBoundingClientRect(),table=root.querySelector('.simulator-ability-panel').getBoundingClientRect(),scroll=root.querySelector('#result-summary');
  return{onRight:root.querySelector('.simulator-side-panel').contains(root.querySelector('.simulator-ability-panel')),hexWidth:root.querySelector('.covenant-hex-surface').getBoundingClientRect().width,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight};
 });
 assert.equal(longResult.onRight,true);assert.equal(longResult.hexWidth,320);
 assert.ok(longResult.scrollHeight>longResult.clientHeight);
 await page.locator('#result-summary .part-result-card').last().scrollIntoViewIfNeeded();
 assert.equal(await page.locator('#result-summary .part-result-card').last().evaluate(node=>{const r=node.getBoundingClientRect(),p=node.closest('#result-summary').getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1;}),true);
 console.log('PASS six-part long result / ability stays on right / last card fully reachable');
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/results.json`,JSON.stringify({url,passed:true,proof},null,2));
 console.log('PASS 33 responsive conditions / fixed original preset size including text zoom / equal half columns / diagram vertically centered / no page errors');
}finally{await browser.close();}
