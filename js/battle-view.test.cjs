const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(__dirname+'/battle-view.js','utf8'),context);
const api=context.window.BattleView;
const stage=()=>JSON.parse(fs.readFileSync(__dirname+'/../data/story/stages/125663.json'));
test('스토리와 융재금구가 같은 체력·전환 렌더러를 사용한다',()=>{
 for(const name of ['story-info.js','dzone-info.js']){const code=fs.readFileSync(__dirname+'/'+name,'utf8');assert.match(code,/window.BattleView.renderHp/);assert.match(code,/window.BattleView.renderPhaseTransition/);}
 const s=stage(),m=s.monsters[130469],stats=s.stats[130469],ctx={escapeHtml:String,number:new Intl.NumberFormat('ko-KR'),dynamicMarkup:String,skillById:(m,id)=>m.skills.find(s=>s.id===id),data:s};
 const hp=api.renderHp(stats,m,ctx);assert.equal((hp.match(/class="hp-phase-segment"/g)||[]).length,2);assert.match(hp,/실질 총 HP/);assert.doesNotMatch(hp,/NaN/);
 const transition=api.renderPhaseTransition(m,m.phaseTransitions[0],stats,ctx);assert.match(transition,/치명적인 피해/);assert.match(transition,/250%/);assert.match(transition,/phase-transition-states/);
});
test('성신편5장 상태 연결·정수 피해와 소환 링크 제거를 유지한다',()=>{
 const s=stage(),stats=s.stats[130469];
 assert.match(stats.resolvedStates.find(s=>s.id===131127).richDescription,/<kw_[a-f0-9]+:임시 열광>/);
 assert.match(stats.resolvedSkills[130477].richDescription,/<kw_[a-f0-9]+:속박의 서약>/);
 for(const skills of [stats.resolvedSkills,...Object.values(stats.phaseResolvedSkills)]){assert.doesNotMatch(skills[130471].description,/\d+\.\d+/);assert.match(skills[130471].description,/2장: 679pt/);}
 assert.doesNotMatch(fs.readFileSync(__dirname+'/story-info.js','utf8'),/story-summon-link/);
});
test('소환 난수 분기는 수량으로 합치지 않고 종류별 후보로 보존한다',()=>{
 const s=stage(),refs=s.monsters[130469].linkedSummons,groups=new Map();for(const r of refs){const rows=groups.get(r.choiceGroup)||[];rows.push(r);groups.set(r.choiceGroup,rows);}
 assert.equal(groups.size,2);for(const rows of groups.values()){assert.equal(rows.length,3);assert(rows.every(r=>r.choiceCount===3));const sequences=rows.map(r=>JSON.stringify(s.monsters[r.tid].patterns));assert.equal(new Set(sequences).size,3);}
});
test('플레이어를 경유한 의도 변경 네 단계와 추가 행동의 설명·발동 조건을 보존한다',()=>{
 const s=stage(),m=s.monsters[130469];for(const id of [130478,130472,130475,130476,131365]){assert(m.skills.some(x=>x.id===id));assert(m.conditionalActions.some(x=>x.skillId===id&&x.conditionText));assert(s.stats[130469].resolvedSkills[id]?.description);}
 assert.match(s.stats[130469].resolvedSkills[130478].description,/2 턴/);
 assert.match(s.stats[130469].resolvedSkills[130478].richDescription,/<kw_[a-f0-9]+:운명의 파편>/);
 assert.match(s.stats[130469].resolvedSkills[130478].richDescription,/<kw_[a-f0-9]+:봉인>/);
 for(const id of [131179,131180,131181,131182,131183,131184])assert(!s.monsters[id].skills.some(x=>x.id===131365));
});
test('암중 파괴 툴팁의 피해는 정수 pt이며 스토리 용어는 스택으로 통일한다',()=>{
 const s=stage(),entries=Object.values(s.keywordGlossary).filter(g=>g.source?.type==='State'&&g.source.id===127705);assert(entries.length>0);assert(entries.some(g=>g.description.includes('89pt의 피해')));for(const entry of entries)assert.doesNotMatch(entry.description,/\d+\.\d+\s*(?:pt|점)?(?:의)?\s*피해/);
 for(const file of fs.readdirSync(__dirname+'/../data/story/stages'))assert.doesNotMatch(fs.readFileSync(__dirname+'/../data/story/stages/'+file,'utf8'),/중첩/);
});
test('폭노의 고치의 HP 비례 피해는 정수 범위로 표시한다',()=>{
 const s=stage(),resolved=s.stats[129602].resolvedSkills[129616];assert.match(resolved.richDescription,/<amount_damage:713~1,426pt>/);assert.doesNotMatch(resolved.description,/\d+\.\d+/);
});

test('산의 기생충의 숨김 감시 상태와 의도 이동 명령을 플레이어 효과나 독립 행동으로 노출하지 않는다',()=>{
 const s=JSON.parse(fs.readFileSync(__dirname+'/../data/story/stages/146255.json')),m=s.monsters[150109],stats=s.stats[150109];
 assert(!stats.playerEntryStates.some(state=>state.id===150413));assert(!m.skills.some(skill=>skill.id===150111));assert(!m.conditionalActions.some(action=>action.skillId===150111));
 assert.equal(m.reactiveActions.length,1);assert.deepEqual(m.reactiveActions[0].skillIds,[150122,149843,149842]);assert.match(m.reactiveActions[0].description,/적이 현재 의도를 즉시 실행/);
 assert.match(stats.resolvedSkills[149844].richDescription,/<amount_damage:330pt>/);
});

test('산의 기생충의 단계 전환은 실제 보물 다섯 종과 파괴 조건을 포함한다',()=>{
 const s=JSON.parse(fs.readFileSync(__dirname+'/../data/story/stages/146255.json')),m=s.monsters[150109],stats=s.stats[150109],phase=m.phaseTransitions.find(p=>p.phaseIndex===2);
 assert.deepEqual(phase.stateLifecycles,[{stateId:66314,skillId:149847}]);assert.match(phase.sequenceDescription,/부활 시.*획득.*탐식 공양.*실행 시 제거/);assert.deepEqual(phase.phaseSkillIds,[149847]);assert.deepEqual(phase.addedStates.map(x=>x.id),[149915,149922,149923,149920,149919]);
 const html=api.renderPhaseTransition(m,phase,stats,{escapeHtml:String,number:new Intl.NumberFormat('ko-KR'),dynamicMarkup:String,skillById:(m,id)=>m.skills.find(s=>s.id===id),data:s});
 for(const name of['악마의 열쇠','공정의 깃털','필멸의 눈','운명의 실','예지의 거울'])assert(html.includes(name));assert.match(html,/부활/);assert.match(html,/파괴/);assert.doesNotMatch(html,/\[DescArg\d+\]|158\.04/);
});

test('스토리 전체에서 실시간 남은 횟수는 제외하고 보물 파괴 조건과 서리 방패 강조는 보존한다',()=>{
 for(const file of fs.readdirSync(__dirname+'/../data/story/stages'))assert.doesNotMatch(fs.readFileSync(__dirname+'/../data/story/stages/'+file,'utf8'),/(?:남은|잔여)\s*(?:발동\s*)?횟수/);
 const s=JSON.parse(fs.readFileSync(__dirname+'/../data/story/stages/146255.json')),stats=s.stats[150109],phase=s.monsters[150109].phaseTransitions[0];
 for(const id of[149842,149845])assert.match(stats.resolvedSkills[id].richDescription,/<amount_shield:38,342pt>/);
 const feather=phase.addedStates.find(state=>state.id===149922);assert.match(feather.descriptionTemplate,/2회 격파 후 파괴/);assert.match(feather.richDescriptionTemplate,/<amount_shield:최대 HP의 3%>/);
 assert.match(phase.addedStates.find(state=>state.id===149923).descriptionTemplate,/광기 폭발 5회 발동 후 파괴/);
});


test('단일 HP도 막대로 표시하고 시작 체력바 수를 전투 전체 HP와 구분한다',()=>{
 const ctx={escapeHtml:String,number:new Intl.NumberFormat('ko-KR')};
 const common=api.renderHp({hp:100},{monsterClass:'Common'},ctx);assert.doesNotMatch(common,/hp-phase-map|hp-phase-segment/);assert.match(common,/100/);
 const one=api.renderHp({hp:100}, {monsterClass:'Boss'},ctx);assert.match(one,/hp-phase-segment/);assert.match(one,/100/);
 const many=api.renderHp({hp:299851,startingBars:5,phases:[{hp:299851}]},{},ctx);
 assert.equal((many.match(/class="hp-phase-segment"/g)||[]).length,5);
 assert.match(many,/시작 총 HP/);assert.match(many,/1,499,255/);assert.doesNotMatch(many,/실질 총 HP/);
 assert.doesNotMatch(api.renderHp({}, {},ctx),/hp-phase-segment/);
});

test('전환 후 HP 범위도 최대 HP 라벨과 막대를 함께 표시한다',()=>{
 const html=api.renderHp({hpDisplay:'300 ~ 400',hpRange:{min:300,max:400},hpLabel:'최대 HP'},{monsterClass:'Boss'},{escapeHtml:String,number:new Intl.NumberFormat('ko-KR')});
 assert.match(html,/300 ~ 400/);assert.match(html,/<dt>최대 HP<\/dt>/);assert.match(html,/hp-phase-map/);assert.doesNotMatch(html,/undefined|NaN/);
});


test('미완성 전환 기록이 시작 체력바 수를 덮어쓰지 않는다',()=>{
 const html=api.renderHp({hp:95242,startingBars:4,phases:[{hp:95242},{hp:95242}]},{monsterClass:'Boss'},{escapeHtml:String,number:new Intl.NumberFormat('ko-KR')});
 assert.equal((html.match(/class="hp-phase-segment"/g)||[]).length,4);
 assert.match(html,/380,968/);assert.match(html,/시작 총 HP/);assert.doesNotMatch(html,/실질 총 HP/);
});
