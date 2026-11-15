import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const url=process.env.COVENANT_SIMULATOR_URL||'http://127.0.0.1:8766/covenant_simulator.html';
const key='morimens_covenant_simulator_state_v1',browser=await chromium.launch({channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true}),p=await context.newPage(),errors=[];
p.on('pageerror',e=>errors.push(e.message));
const ready=()=>p.locator('.simulator-panel[aria-busy="false"]').waitFor();
const mode=async m=>{await p.locator(`[data-mode-tab=${m}]`).tap();};
const state=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const bank=(s,m)=>m==='editor'?{parts:s.editorParts,bound:s.editorBound}:m==='target'?{parts:s.targetSimParts,bound:s.targetBound,result:s.targetResult,scope:s.targetParts}:{parts:s.parts,bound:s.contractBound,preview:s.manualPreview,result:s.manualResult,totals:s.totals,part:s.selectedPart};
const importPreset=async m=>{await p.locator(`[data-equipment-preset=${m}]`).selectOption({label:'분리 검사'});await p.locator(`[data-import-preset=${m}]`).tap();};
await context.addInitScript(()=>localStorage.setItem('morimens-covenant-tour-v1','done'));
try{
 await p.goto(url);await ready();await mode('manual');
 // Migrate a genuine old shape, keeping the already-different target data.
 await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.version=2;s.parts[0].mainLevel=5;s.targetSimParts[0].mainLevel=2;s.contractBound=true;for(const f of ['editorParts','editorBound','targetBound','manualPreview','manualResult','targetResult','totals'])delete s[f];localStorage.setItem(k,JSON.stringify(s));},key);
 await p.reload();await ready();let s=await state();assert.equal(s.editorParts[0].mainLevel,5);assert.equal(s.parts[0].mainLevel,5);assert.equal(s.targetSimParts[0].mainLevel,2);assert.equal(s.editorBound,true);assert.equal(s.targetBound,true);
 await mode('editor');const original=await state();await p.locator('#shared-covenant-editor [data-part-label="0"]').tap();await p.locator('#shared-covenant-editor input[aria-label="1번 강화 레벨"]').fill('12');await p.locator('#shared-covenant-editor input[aria-label="1번 강화 레벨"]').press('Tab');await p.locator('#shared-covenant-editor [role=switch]').uncheck();
 s=await state();assert.equal(s.editorParts[0].mainLevel,12);assert.equal(s.editorBound,false);assert.deepEqual(bank(s,'manual'),bank(original,'manual'));assert.deepEqual(bank(s,'target'),bank(original,'target'));
 await p.locator('#preset-name-input').fill('분리 검사');await p.locator('#save-preset-btn').tap();const presets=await p.evaluate(()=>JSON.parse(localStorage.getItem('morimens_covenant_simulator_presets_v1')));assert.equal(presets[0].snapshot.parts[0].mainLevel,12);assert.ok(!('targetSimParts' in presets[0].snapshot));
 await mode('manual');assert.equal(await p.locator('[data-simulator-bound=manual]').isChecked(),true);await importPreset('manual');s=await state();assert.equal(s.parts[0].mainLevel,12);assert.equal(s.contractBound,false);assert.deepEqual(bank(s,'target'),bank(original,'target'));
 await p.locator('[data-transcription-part="5"]').tap();await p.evaluate(()=>Math.random=()=>.24);await p.locator('#manual-reroll-btn').tap();assert.equal(await p.locator('#manual-apply-btn').isEnabled(),true);const preview=(await state()).manualPreview,manualResult=(await state()).manualResult;assert.ok(manualResult);
 // Walking through the guide must preserve a pending reroll and each bank.
 const beforeGuide=await state();await p.locator('#covenant-help').tap();
 const guideSteps=Number((await p.locator('#covenant-tour-progress').textContent()).split('/')[1]);
 for(let step=0;step<guideSteps;step++)await p.locator('#covenant-tour-next').tap();
 await p.waitForFunction(()=>!document.querySelector('#covenant-tour').open);
 assert.deepEqual(await state(),beforeGuide,'guide must preserve pending reroll, all banks and active tab');
 await mode('editor');await p.locator('#shared-covenant-editor [role=switch]').check();await p.locator('#load-preset-btn').tap();s=await state();assert.equal(s.editorBound,false);assert.deepEqual(s.manualPreview,preview);assert.deepEqual(s.manualResult,manualResult);
 await mode('manual');await p.locator('[data-simulator-bound=manual]').check();await mode('target');assert.equal(await p.locator('[data-simulator-bound=target]').isChecked(),true);await importPreset('target');s=await state();assert.equal(s.targetSimParts[0].mainLevel,12);assert.equal(s.targetBound,false);assert.equal(s.contractBound,true);assert.deepEqual(s.manualPreview,preview);
 // Editing the source after import must not mutate either destination.
 const destinations=await state();await mode('editor');await p.locator('#shared-covenant-editor [data-part-label="0"]').tap();await p.locator('#shared-covenant-editor input[aria-label="1번 강화 레벨"]').fill('7');await p.locator('#shared-covenant-editor input[aria-label="1번 강화 레벨"]').press('Tab');s=await state();assert.deepEqual(bank(s,'manual'),bank(destinations,'manual'));assert.deepEqual(bank(s,'target'),bank(destinations,'target'));
 // A local editor replaces the old jump to the preset tab.
 await mode('manual');await p.locator('#edit-transcription-part').tap();assert.equal(await p.locator('#manual-setting-dialog').isVisible(),true);assert.equal(await p.locator('[data-mode-tab=manual]').getAttribute('aria-selected'),'true');await p.locator('#manual-covenant-editor input[aria-label="6번 강화 레벨"]').fill('9');await p.locator('#manual-covenant-editor input[aria-label="6번 강화 레벨"]').press('Tab');for(const [w,z]of [[320,1],[390,1],[768,1],[1024,1],[1280,1],[844,1],[320,2],[1280,2]]){await p.setViewportSize({width:w,height:w===844?390:900});await p.locator('html').evaluate((el,z)=>el.style.fontSize=z===2?'200%':'16px',z);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const fits=await p.locator('#manual-setting-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1);if(!fits){console.log('DIALOG',await p.locator('#manual-setting-dialog').evaluate(el=>{const s=getComputedStyle(el);return {w:s.width,max:s.maxWidth,rect:el.getBoundingClientRect().toJSON(),inner:innerWidth,screen:screen.width,visual:visualViewport.width,scale:visualViewport.scale,font:getComputedStyle(document.documentElement).fontSize};}));await p.screenshot({path:'D:/MorimensCodexTemp/manual-dialog-overflow.png'});console.log(await p.locator('#manual-setting-dialog').evaluate(root=>[...root.querySelectorAll('*')].map(el=>({cls:el.className,w:el.getBoundingClientRect().width,r:el.getBoundingClientRect().right})).filter(el=>el.r>root.getBoundingClientRect().right)));}assert.equal(fits,true,`manual dialog ${w}/${z}`);}
 await p.locator('html').evaluate(el=>el.style.fontSize='16px');await p.setViewportSize({width:390,height:900});await p.locator('#close-manual-settings').tap();s=await state();assert.equal(s.parts[5].mainLevel,9);assert.equal(s.editorParts[5].mainLevel,0);assert.equal(s.targetSimParts[5].mainLevel,0);assert.equal(s.manualPreview,null);
 await p.locator('#manual-reroll-btn').tap();await p.locator('#manual-apply-btn').tap();const applied=bank(await state(),'manual');assert.equal(applied.preview,null);
 // Target equipment changes and goal presets are local too.
 await mode('target');await p.locator('#target-current-tab').tap();await p.locator('#target-change-covenant').tap();await p.locator('#contract-grid button').nth(1).tap();s=await state();assert.notEqual(s.targetSimParts[0].setId,s.parts[0].setId);assert.deepEqual(bank(s,'manual'),applied);
 await p.locator('#target-goals-tab').tap();for(const i of [1,2,3,4,5])await p.locator(`[data-target-scope-index="${i}"]`).tap();const goal=p.locator('[data-target-part="0"]');await goal.locator('.target-goal-level').first().selectOption('1');await goal.locator('[data-goal-index="0"] .target-option-icons [data-option="critRate"]').tap();await p.locator('[data-simulator-bound=target]').check();
 await p.locator('[data-resource-switch=target]').tap();const targetBeforeRefresh=await state();await p.reload();await ready();
 assert.deepEqual(bank(await state(),'target'),bank(targetBeforeRefresh,'target'));assert.deepEqual(bank(await state(),'manual'),applied);assert.equal((await state()).targetLockCostMode,targetBeforeRefresh.targetLockCostMode);assert.equal(await p.locator('[data-resource-switch=target]').getAttribute('aria-checked'),String(targetBeforeRefresh.targetLockCostMode==='quill'));
 assert.equal(await p.locator('#target-preset-select,#save-target-preset-btn,#load-target-preset-btn').count(),0);

 await p.evaluate(()=>{let i=0;Math.random=()=>i++%2===0?.01:.5;});await p.locator('#run-target-btn').tap();await p.waitForFunction(()=>!document.querySelector('#run-target-btn').disabled);let completed=await state();assert.ok(completed.targetResult);assert.deepEqual(bank(completed,'manual'),applied);
 await p.reload();await ready();s=await state();assert.deepEqual(bank(s,'manual'),applied);assert.deepEqual(bank(s,'target'),bank(completed,'target'));
 // Reset just the active screen; load legacy presets without restoring other tabs.
 await p.locator('#reset-sim-btn').tap();s=await state();assert.equal(s.targetResult,null);assert.deepEqual(bank(s,'manual'),applied);assert.equal(s.editorParts[0].mainLevel,7);
 await mode('manual');await p.locator('#manual-reroll-btn').tap();const pending=(await state()).manualPreview;await p.reload();await ready();assert.deepEqual((await state()).manualPreview,pending);assert.equal(await p.locator('#manual-apply-btn').isEnabled(),true);
 await mode('editor');const beforeReset=await state();await p.locator('#reset-sim-btn').tap();s=await state();assert.deepEqual(bank(s,'manual'),bank(beforeReset,'manual'));assert.deepEqual(bank(s,'target'),bank(beforeReset,'target'));
 await mode('manual');const targetBefore=bank(await state(),'target'),editorBefore=bank(await state(),'editor');await p.locator('#reset-sim-btn').tap();s=await state();assert.equal(s.manualResult,null);assert.deepEqual(bank(s,'target'),targetBefore);assert.deepEqual(bank(s,'editor'),editorBefore);
 // The local editor must treat binding as a value change, and part selection as a new reroll context.
 await p.locator('#manual-reroll-btn').tap();const beforeBinding=await state();await p.locator('#edit-transcription-part').tap();
 await p.locator('#manual-covenant-editor [role=switch]').check();let afterBinding=await state();
 assert.deepEqual(afterBinding.manualPreview,beforeBinding.manualPreview);assert.deepEqual(afterBinding.manualResult,beforeBinding.manualResult);
 assert.deepEqual(afterBinding.parts,beforeBinding.parts);assert.deepEqual(bank(afterBinding,'editor'),bank(beforeBinding,'editor'));assert.deepEqual(bank(afterBinding,'target'),bank(beforeBinding,'target'));
 assert.equal(await p.locator('#manual-apply-btn').isEnabled(),true);
 await p.locator('#manual-covenant-editor [data-part-label="1"]').tap();afterBinding=await state();assert.equal(afterBinding.selectedPart,1);assert.equal(afterBinding.manualPreview,null);assert.equal(afterBinding.manualResult,null);assert.deepEqual(afterBinding.parts,beforeBinding.parts);assert.equal(await p.locator('#manual-apply-btn').isEnabled(),false);
 await p.locator('#close-manual-settings').tap();await p.reload();await ready();assert.equal((await state()).selectedPart,1);assert.equal(await p.locator('#manual-apply-btn').isEnabled(),false);
 // v14 could save a preview for a different selected part. Never apply that legacy preview.
 await p.locator('#manual-reroll-btn').tap();const mismatched=await state();
 await p.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.selectedPart=5;localStorage.setItem(k,JSON.stringify(s));},key);
 await p.reload();await ready();let guarded=await state();assert.equal(guarded.manualPreview,null);assert.equal(guarded.manualResult,null);assert.equal(await p.locator('#manual-apply-btn').isEnabled(),false);assert.deepEqual(guarded.parts,mismatched.parts);assert.deepEqual(bank(guarded,'editor'),bank(mismatched,'editor'));assert.deepEqual(bank(guarded,'target'),bank(mismatched,'target'));
 // Mixed VI must select VI's contract and return keyboard focus inside the local editor.
 await p.locator('#edit-transcription-part').tap();await p.locator('#manual-covenant-editor').getByRole('button',{name:'6번 비밀계약 선택',exact:true}).tap();
 const viContract=await p.locator('#contract-grid button').nth(1).getAttribute('data-contract');await p.locator('#contract-grid button').nth(1).tap();
 assert.equal(await p.evaluate(()=>document.activeElement.matches('#manual-covenant-editor .member-part-set')),true);
 await p.locator('#manual-covenant-editor').getByRole('button',{name:'6번 비밀계약 선택',exact:true}).tap();assert.equal(await p.locator('#contract-grid [aria-pressed="true"]').getAttribute('data-contract'),viContract);
 await p.locator('#close-covenant-set-picker').tap();assert.equal(await p.evaluate(()=>document.activeElement.matches('#manual-covenant-editor .member-part-set')),true);
 const dialog=await p.locator('#manual-setting-dialog').evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(document.querySelector('#close-manual-settings'));return{centered:Math.abs((r.left+r.right)/2-innerWidth/2)<1,color:s.color};});assert.equal(dialog.centered,true);assert.notEqual(dialog.color,'rgb(0, 0, 0)');
 await p.locator('#close-manual-settings').tap();assert.equal(await p.evaluate(()=>document.activeElement.id),'edit-transcription-part');
 // Failed autosave remains visibly attached to the operation, without duplicating live regions.
 await p.setViewportSize({width:320,height:640});
 await p.evaluate(()=>{window.qaOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};});
 const storedBeforeFailure=await state();await p.locator('#manual-reroll-btn').tap();
 const warning=await p.locator('#storage-status').evaluate(el=>{const r=el.getBoundingClientRect();return{visible:r.top>=0&&r.bottom<=innerHeight,text:el.textContent,inFooter:!!el.closest('#manual-panel .workspace-footer')};});assert.equal(warning.visible,true);assert.equal(warning.inFooter,true);assert.match(warning.text,/저장/);assert.equal(await p.locator('#storage-status').count(),1);assert.deepEqual(await state(),storedBeforeFailure);
 await p.locator('#edit-transcription-part').tap();await p.locator('#manual-covenant-editor input[aria-label="6번 강화 레벨"]').fill('7');
 assert.equal(await p.locator('#storage-status').evaluate(el=>{const r=el.getBoundingClientRect();return !!el.closest('#manual-setting-dialog')&&r.top>=0&&r.bottom<=innerHeight;}),true);
 await p.locator('#close-manual-settings').tap();assert.equal(await p.locator('#manual-setting-dialog').isVisible(),false,'repeated quota failure on blur must not steal the close click');assert.equal(await p.evaluate(()=>document.activeElement.id),'edit-transcription-part');
 await mode('target');assert.equal(await p.locator('[data-mode-tab=target]').getAttribute('aria-selected'),'true');assert.deepEqual(await state(),storedBeforeFailure);
 await p.evaluate(()=>Storage.prototype.setItem=window.qaOriginalSetItem);
 assert.deepEqual(errors,[]);await mkdir('.generated/scarecrow/isolation-proof',{recursive:true});await p.screenshot({path:`.generated/scarecrow/isolation-proof/mobile-${new URL(url).port}.png`,fullPage:true});console.log('PASS old-state migration / 3 independent banks / explicit preset import / no source mutation / local manual editor / target conditions autosave / reroll / apply / results+preview reload / per-mode reset / no page errors',url);
}finally{await browser.close();}
