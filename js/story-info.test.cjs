const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=JSON.parse(fs.readFileSync(path.join(root,'data/story/index.json')));
const stages=index.stages.map(s=>JSON.parse(fs.readFileSync(path.join(root,'data/story/stages',s.id+'.json'))));
test('스토리 범위와 직접 배치 보스, 전투 구성의 참조가 완전하다',()=>{
 assert.equal(stages.length,388);assert.equal(stages.filter(s=>s.encounters.length).length,315);
 const bosses=new Set(),battles=new Set();
 for(const s of stages){assert(['노말','하드'].includes(s.difficulty));assert(s.chapter<= (s.arc==='성신편'?6:9));
  for(const e of s.encounters){battles.add(e.battleId);for(const member of e.members){const m=s.monsters[member.tid];assert(m);assert(Number.isFinite(s.stats[member.tid]?.hp));if(m.monsterClass==='Boss')bosses.add(m.tid);}}
  for(const m of Object.values(s.monsters)){assert(fs.existsSync(path.join(root,m.webImage)),m.webImage);for(const t of m.storyTransitions)assert(fs.existsSync(path.join(root,t.image)),t.image);for(const summon of m.linkedSummons)assert(s.monsters[summon.tid]);}
 }
 assert.equal(bosses.size,124);assert.equal(battles.size,1173);
});
test('산의 기생충의 두 번째 행동 목록과 전환 초상을 보존한다',()=>{
 const m=stages.find(s=>s.monsters[150109]).monsters[150109];
 const transition=m.storyTransitions.find(t=>t.changesPortrait);
 assert.equal(transition.cycleIndex,2);assert.match(transition.image,/S2B0006_BT\.webp$/);assert(m.patterns.some(p=>p.id==='cycle-2'));
});
test('홈과 배포 산출물에 스토리 전용 진입점이 있다',()=>{
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/menu-section-story/);
 assert.match(fs.readFileSync(path.join(root,'tools/prepare-pages-artifact.mjs'),'utf8'),/'story_info\.html'/);
});
test('스토리 전투는 융재와 같은 카드 및 행동 구성요소를 사용한다',()=>{
 const js=fs.readFileSync(path.join(root,'js/story-info.js'),'utf8');
 for(const component of ['encounter-card','monster-card','monster-body','monster-rules','flow-sequence','action-step','intent-icon','flow-loop'])assert(js.includes(component),component);
 const boss=stages.find(s=>s.monsters[150109]).monsters[150109];
 assert(boss.skills.every(s=>typeof s.type==='string'));
});
test('편별 실제 턴 순서를 생성하고 적용 과정은 표시하지 않는다',()=>{
 let count=0;
 for(const s of stages){assert(!s.rules.some(r=>r.id==='long-battle'));for(const m of Object.values(s.monsters).filter(m=>m.turnOverrides?.length)){
  assert.deepEqual(m.turnOverrides,s.arc==='성신편'?[{firstTurn:6,skillId:4681,persistent:true}]:[{firstTurn:8,skillId:4681,persistent:false},{firstTurn:9,skillId:4747,persistent:true}]);
  assert(!m.states.some(r=>r.id===22074));assert(m.skills.some(r=>r.id===4681));count++;
 }}assert(count>0);
});
test('망각편과 성신편의 공통·스테이지·지원 규칙은 별개로 보존한다',()=>{
 const counts={morimens:0,stars:0};let extra=0;
 for(const s of stages){const expected=s.arc==='성신편'?'stars':'morimens';assert.equal(s.ruleProfile,expected);counts[expected]++;
  const common=s.rules.filter(r=>r.source==='chapter').map(r=>r.id);
  assert.deepEqual(common,expected==='stars'?[76236,74791,89559]:[72102]);
  if(s.rules.some(r=>r.source==='stage'||r.source==='positive'))extra++;
  for(const r of s.rules.filter(r=>r.source==='monster'))assert.equal(r.profile,expected);
 }
 assert.deepEqual(counts,{morimens:232,stars:156});assert.equal(extra,30);
 const support=stages.find(s=>s.id===48072);assert(support.rules.some(r=>r.id===50389&&r.source==='positive'));
 const late=stages.find(s=>s.id===59505);assert(late.rules.some(r=>r.id===119080&&r.source==='stage'));
});

test('성상 축복 반전은 선택지와 즉시 손실을 설명하고 실제 현재 HP 기준을 보존한다',()=>{
 const matching=stages.filter(s=>s.stats[118028]?.resolvedSkills[118071]);assert(matching.length>0);
 for(const s of matching){const effect=s.stats[118028].resolvedSkills[118071];const entry=Object.entries(s.keywordGlossary).find(([,v])=>v.source.type==='State'&&v.source.id===120222);assert(entry);assert(effect.richDescription.includes(entry[0]));for(const phrase of ['영원한 꿈','위엄의 꿈','지식의 꿈','현재 HP의 50%','힘의 50%','광기의 50%','다시 선택할 수 없습니다'])assert(entry[1].description.includes(phrase),phrase);assert(!entry[1].description.includes('최대 HP의 50%'));}
});
test('상태 카드 아이콘은 융재와 일치하며 생성 카드 효과는 본문 툴팁에서 제공한다',()=>{
 for(const s of stages)for(const entry of Object.values(s.keywordGlossary))if(entry.description.startsWith('상태 카드 |'))assert.equal(entry.icon,'images/dzone/cards/portrait_card_state_skull.png');
 const s=stages.find(s=>s.id===118130);const silver=Object.entries(s.keywordGlossary).find(([,e])=>e.source.type==='Skill'&&e.source.id===73536);assert(silver);assert(s.rules.some(r=>r.richDescription.includes(silver[0])));
 const js=fs.readFileSync(path.join(root,'js/story-info.js'),'utf8');assert(!js.includes('story-state-cards'));assert(!js.includes('story-rule-cards'));
});

test('꿈의 족쇄는 시작 스택과 보스 체력바 소진·봉인 대상을 분리한다',()=>{
 const s=stages.find(s=>s.id===118130).stats[118028].resolvedStates.find(s=>s.id===119757);
 assert.equal(s.initialLayer.value.display,4);assert.match(s.richDescription,/보스 「낙원의 장막」의 체력바가 소진될 때마다/);assert.match(s.richDescription,/능동 피해로 체력바를 소진시킨 각성체/);assert.match(s.richDescription,/광기 폭발/);assert.match(s.richDescription,/카드도 봉인/);
 const js=fs.readFileSync(path.join(root,'js/story-info.js'),'utf8');assert(js.includes('story-initial-stack'));assert(js.includes('시작 ${number.format'));
});

test('시작 체력바·플레이어 효과·축복 선택과 소환체 수치를 함께 제공한다',()=>{
 const stage=stages.find(s=>s.id===118130),boss=stage.stats[118028];
 assert.equal(boss.startingBars,5);
 assert.equal(boss.playerEntryStates.find(s=>s.id===120215).initialLayer.value.display,4);
 assert.match(boss.playerEntryStates.find(s=>s.id===120218).description,/처음 3번의 턴 종료/);
 assert.match(boss.resolvedSkills[119313].description,/1,049,479/);
 const fish=stage.summonedMonsters.find(s=>s.parentTid===117859&&s.tid===118645);
 assert.equal(fish.hp,18599);assert.equal(fish.attack,385);
 assert.match(fish.resolvedSkills[117861].description,/270/);
 assert(!stage.monsters[118030].linkedSummons.some(s=>s.tid===131430));
 const changing=stage.summonedMonsters.find(s=>s.parentTid===118030&&s.tid===94702);
 assert.equal(changing.hp,14702);assert.match(changing.hpDisplay,/17,152/);
});

test('스토리 툴팁과 카드 아이콘은 모든 스테이지에서 실제 파일과 연결된다',()=>{
 for(const stage of stages){
  for(const entry of Object.values(stage.keywordGlossary)){
   assert(!/\[(?:[A-Za-z]+:)?(?:Arg|StateArg|DescArg)\d+\]/.test(entry.description));
   for(const key of ['icon','tooltipIcon'])if(entry[key])assert(fs.existsSync(path.join(root,entry[key])),stage.id+': '+entry[key]);
  }
  const markup=JSON.stringify(stage).matchAll(/<(kw_[a-f0-9]{16}):/g);
  for(const match of markup)assert(stage.keywordGlossary[match[1]],stage.id+': '+match[1]);
 }
});
test('응시의 무작위 카드 풀과 상단 프리즘 렌즈는 실제 효과 툴팁을 유지한다',()=>{
 const stage=stages.find(s=>s.id===118130);
 const symptom=Object.values(stage.keywordGlossary).find(e=>e.name==='증상 카드');
 assert.equal(symptom.source.relatedIds.length,8);
 assert.match(symptom.description,/산출력 0/);assert.match(symptom.description,/산출력 1/);
 assert.match(symptom.description,/증상: 히스테리/);
 assert(!symptom.description.split('\n')[0].includes('산출력'));
 assert(JSON.stringify(stage.stats).includes('<'+Object.keys(stage.keywordGlossary).find(k=>stage.keywordGlossary[k]===symptom)+':증상 카드>'));
 const stars=stages.filter(s=>s.arc==='성신편');
 assert(stars.some(s=>Object.values(s.keywordGlossary).some(e=>e.source.relatedIds?.includes(76435)&&e.source.relatedIds?.includes(89557)&&/중독/.test(e.description))));
});
test('영혼 서곡과 암흑 요리의 툴팁에 미해석 인자가 남지 않는다',()=>{
 const entries=stages.flatMap(s=>Object.values(s.keywordGlossary));
 const soul=entries.find(e=>e.source.id===60436),dish=entries.find(e=>e.source.id===24989);
 assert(soul);assert.match(soul.description,/무작위로 부여/);assert(!soul.description.includes('상처'));
 assert(dish);assert.match(dish.description,/산출력 0/);assert.match(dish.description,/중독/);
});

test('봉인·산호 증식·기생 산호를 실제 상태와 생성 카드에 연결한다',()=>{
 const s=stages.find(s=>s.id===118130);
 const seal=s.stats[119854].resolvedSkills[35965].richDescription.match(/<(kw_[a-f0-9]+):봉인>/)[1];
 assert.equal(s.keywordGlossary[seal].source.id,81341);assert.match(s.keywordGlossary[seal].description,/광기 폭발/);assert.match(s.keywordGlossary[seal].description,/1턴/);
 const spawn=s.summonedMonsters.find(m=>m.tid===119954).resolvedStates.find(r=>r.id===36111);
 const card=spawn.richDescription.match(/<(kw_[a-f0-9]+):산호 증식>/)[1];
 assert.equal(s.keywordGlossary[card].source.id,36030);assert.match(s.keywordGlossary[card].description,/15의 순수 피해/);assert.match(s.keywordGlossary[card].description,/덱에서 제거/);
 assert.match(s.stats[35581].resolvedSkills[36039].richDescription,/<kw_[a-f0-9]+:기생 산호>/);
});
