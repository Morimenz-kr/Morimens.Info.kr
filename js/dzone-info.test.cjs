const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'dzone-info.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'dzone_info.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'pages', 'dzone-info.css'), 'utf8');
const linksSource = fs.readFileSync(path.join(__dirname, 'links.js'), 'utf8');
const linksCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'pages', 'links.css'), 'utf8');
const infoToolsCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'pages', 'info_tools.css'), 'utf8');
const rerunHtml = fs.readFileSync(path.join(__dirname, '..', 'rerun_schedule.html'), 'utf8');
const landingHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dzoneData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'dzone_current.json'), 'utf8'));
const characterEffects = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'character_effects.json'), 'utf8'));

test('이번 융재의 숨은 단계 상태는 모든 해당 몬스터에서 6턴 이후 응시로 해석한다', () => {
    let matchedMonsters = 0;
    for (const wave of dzoneData.waves) {
        const staticMonsters = [...wave.monsters, ...(wave.summonDefinitions || [])];
        for (const monster of staticMonsters) {
            if (!(monster.states || []).some(state => state.id === 22074)) continue;
            matchedMonsters += 1;
            const action = (monster.conditionalActions || []).find(item => item.contextResolved && item.skillId === 4681);
            const skill = (monster.skills || []).find(item => item.id === 4681);
            assert.ok(action, `${wave.wave}파 ${monster.nameKo}의 응시 조건 누락`);
            assert.equal(action.conditionText, '6턴부터 매 턴');
            assert.equal(action.persistent, true);
            assert.equal(action.sourceStageGroupId, wave.stageGroupId);
            assert.equal((monster.conditionalActions || []).some(item => item.contextResolved && item.skillId === 4747), false);
            assert.equal(skill.name, '응시');
            assert.equal(skill.descriptionTemplate, '장기전이 밀경의 주목을 끌었다… 증상 카드 1장을 영구적으로 덱에 넣는다.');

            for (const alert of wave.alerts) {
                for (const stats of [...alert.monsters, ...(alert.summonedMonsters || [])].filter(item => item.tid === monster.tid)) {
                    assert.equal(stats.resolvedSkills['4681'].description, skill.descriptionTemplate);
                }
            }
        }
    }
    assert.equal(matchedMonsters, 33);
});

test('확정 턴 교체는 기본 반복과 합쳐 최종 행동 순서로 표시한다', () => {
    assert.match(source, /function deterministicOverride/);
    assert.match(source, /최종 행동 순서/);
    assert.match(source, /`\$\{override\.firstTurn\}~`/);
    assert.doesNotMatch(source, /\$\{override\.firstTurn\}턴부터 \$\{skillById/);
    assert.doesNotMatch(css, /\.flow-phase--final-order \.action-step:last-child/);
    assert.match(source, /action\.contextResolved && action\.persistent/);
});

test('다중 체력 행동 구간은 체력바 대신 페이즈로 표시한다', () => {
    assert.match(source, /title: secondCycle \? '1페이즈'/);
    assert.match(source, /title: '2페이즈'/);
    assert.match(source, /2페이즈 전환/);
    assert.doesNotMatch(source, /1번째 체력바(?: 반복)? 행동/);
    assert.doesNotMatch(source, /2번째 체력바 행동/);
});

test('패턴 도중 끼어드는 후속 행동과 다중 의도 교체 조건을 분리해 표시한다', () => {
    const boss = dzoneData.waves.find(wave => wave.wave === 5).monsters.find(monster => monster.tid === 148007);
    const intervention = boss.patternInterventions.find(item => item.stateId === 148392);
    const replacement = boss.conditionalActions.find(item => item.skillId === 148364);
    assert.match(intervention.descriptionTemplate, /10 스택.*다음에 카드를 사용한 직후 즉시 행동/);
    assert.deepEqual(intervention.sourceStateIds, [148385]);
    assert.equal(replacement.sourceSkillId, 148362);
    assert.doesNotMatch(source, /패턴 개입/);
    assert.doesNotMatch(source, /기본 순환에 끼어듦/);
    assert.match(source, /intervention\.sourceStateIds\?\.includes\(rule\.id\)/);
    assert.match(source, /withoutEmbeddedReplacementEffect/);
    assert.match(source, /renderFoldedReplacements/);
    assert.match(source, /action-replacements/);
    assert.match(source, /action-step action-step--replacement/);
    assert.match(source, /조건부 의도/);
    assert.doesNotMatch(source, /flow-step-spacer/);
    assert.doesNotMatch(source, /aria-label="교체 의도">↳/);
    assert.doesNotMatch(css, /\.pattern-interventions/);
    assert.match(css, /\.action-replacements/);
    assert.match(css, /\.action-step--replacement\s*\{[^}]*grid-template-columns:\s*2\.3rem/s);
});

async function relicDisplayContext() {
    const levels = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/research_depth_levels.json'), 'utf8'));
    const context = vm.createContext({
        window: {}, fetch: async () => ({ ok: true, json: async () => levels }),
        number: new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }),
        researchLevel: 81, dynamicMarkup: text => text
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'research-depth.js'), 'utf8'), context);
    await context.window.ResearchDepth.load();
    vm.runInContext(source.slice(source.indexOf('    function relicParameterText('), source.indexOf('    function renderRelics(')), context);
    return context;
}

test('조건부 행동과 연결되어도 시작 상태와 스택·전체 효과를 숨기지 않는다', () => {
    const wave = dzoneData.waves.find(w => w.wave === 2);
    const monster = wave.monsters.find(m => m.tid === 149115);
    const stats = wave.alerts.at(-1).monsters.find(m => m.tid === 149115);
    const context = vm.createContext({
        data: dzoneData, number: new Intl.NumberFormat('ko-KR'),
        escapeHtml: String, gameText: String, politeText: String, dynamicMarkup: String,
        renderIntentIcon: () => '', skillById: (m, id) => m.skills.find(s => s.id === id),
        isFoldedReplacementAction: () => false
    });
    vm.runInContext(source.slice(source.indexOf('    function renderConditionalActions('), source.indexOf('    function renderSummons(')), context);
    const rules = context.renderRules(monster, stats);
    assert.equal((rules.match(/<article>/g) || []).length, 4);
    assert.match(rules, /눈보라 속으로 잠기다<\/strong><span[^>]+>시작 2스택/);
    assert.match(rules, /75층/);
    assert.match(rules, /1층을 제거/);
    assert.match(rules, /서리 방패<\/strong>/);
    assert.match(rules, /매 턴 최대 5회/);
    const action = context.renderConditionalActions(monster, stats);
    assert.match(action, /눈보라 속으로 잠기다」 보유 중/);
    assert.match(action, /방어막이 모두 파괴되었을 때/);
    assert.match(action, /설해/);
    assert.doesNotMatch(action, /75층/);
});

test('안전 출구+ 반격은 선택 등급에 맞는 올림 수치만 표시한다', async () => {
    const context = await relicDisplayContext();
    const archive = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dzone_season67.json'), 'utf8'));
    const relic = archive.waves.flatMap(wave => wave.initialRelics).find(item => item.id === 98378);
    for (const [level, expected] of [[1, 5], [40, 36], [81, 236], [100, 309]]) {
        context.researchLevel = level;
        const text = context.relicDescriptionMarkup(relic);
        assert.ok(text.includes(`${expected} 반격`), text);
        assert.doesNotMatch(text, /기본 수치|증가 효과|전투 중/);
        assert.doesNotMatch(text, /연구 깊이|확인되지|\[Arg/);
    }
});

test('67·68기 초기 유물의 모든 수치 인자는 금기 학식 등급으로 계산된다', async () => {
    const context = await relicDisplayContext();
    const archive = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dzone_season67.json'), 'utf8'));
    for (const level of [1, 40, 81, 100]) {
        context.researchLevel = level;
        for (const data of [archive, dzoneData]) {
            for (const relic of data.waves.flatMap(wave => wave.initialRelics)) {
                assert.doesNotMatch(context.relicDescriptionMarkup(relic), /연구 깊이|확인되지|\[Arg/, `${data.period}기 ${relic.nameKo}, ${level}등급`);
            }
        }
    }
    assert.equal(context.relicParameterText({ expression: 'UnknownDepth*0.06', coefficient: 0.06, label: '영식 연구 깊이' }), '확인되지 않은 수치');
});

test('융재금구 화면은 사용자용 제목과 초기 유물 용어를 사용한다', () => {
    assert.match(html, /진행 중인 융재금구 정보/);
    assert.match(source, /초기 유물/);
    assert.doesNotMatch(source, /융재금구 제\$\{data\.period\}기/);
});

test('68기는 원본 스테이지 그룹과 네 가지 난이도를 사용한다', () => {
    assert.equal(dzoneData.period, 68);
    assert.deepEqual(dzoneData.waves.map(wave => wave.stageGroupId), [83389, 83391, 83390, 83393, 83392]);
    for (const wave of dzoneData.waves) {
        assert.deepEqual(wave.alerts.map(alert => alert.difficultyLabel), ['일반', '어려움', '악몽', '광기']);
        assert.equal(wave.alerts.length, 4);
    }
    assert.match(source, /const difficulties = data\.waves\[0\]\?\.alerts \|\| \[\]/);
    assert.doesNotMatch(source, /\[1, 2, 3, 4, 5\]\.map/);
});

test('68기 다중 체력 보스는 각성 후 HP 증가분과 몬스터 초상을 제공한다', () => {
    const wave4Madness = dzoneData.waves.find(wave => wave.wave === 4).alerts.find(alert => alert.difficulty === 'madness');
    const deepSeaLady = wave4Madness.monsters.find(monster => monster.tid === 118029);
    assert.deepEqual(deepSeaLady.phases.map(phase => phase.hp), [8744674, 17489348]);
    assert.equal(deepSeaLady.effectiveHp, 26234022);

    const wave3Madness = dzoneData.waves.find(wave => wave.wave === 3).alerts.find(alert => alert.difficulty === 'madness');
    const directorSara = wave3Madness.monsters.find(monster => monster.tid === 74035);
    assert.equal(directorSara.hp, 7349597);

    const firstWave4Elite = wave4Madness.monsters.find(monster => monster.tid === 13967);
    assert.equal(firstWave4Elite.hp, 3769743);

    const wave1Madness = dzoneData.waves.find(wave => wave.wave === 1).alerts.find(alert => alert.difficulty === 'madness');
    const shadow24 = wave1Madness.monsters.find(monster => monster.tid === 47981);
    assert.deepEqual(shadow24.phases.map(phase => phase.hp), [3004974, 6009948]);
    assert.equal(shadow24.effectiveHp, 9014922);
    const shadow24Definition = dzoneData.waves.find(wave => wave.wave === 1).monsters.find(monster => monster.tid === 47981);
    assert.deepEqual(shadow24Definition.phaseTransitions[0].createdCards[0].effects, ['전방 적의 행동을 「기절」으로 변경', '카드 3장 뽑기', '산출력 3pt 획득']);

    const definitions = dzoneData.waves.flatMap(wave => [...wave.monsters, ...(wave.summonDefinitions || [])]);
    for (const monster of definitions) {
        assert.ok(fs.existsSync(path.join(__dirname, '..', monster.webImage)), `초상 누락: ${monster.tid} ${monster.webImage}`);
    }
});

test('하티·스콜 소환체의 능력치와 잠복 힘은 스테이지 배율로 계산한다', () => {
    const wave2Madness = dzoneData.waves.find(wave => wave.wave === 2).alerts.find(alert => alert.difficulty === 'madness');
    const wave2Pack = wave2Madness.summonedMonsters.filter(monster => [149104, 149114].includes(monster.tid));
    assert.ok(wave2Pack.length > 0);
    assert.equal(wave2Pack.every(monster => monster.hp === 197612 && monster.attack === 1178), true);
    assert.equal(wave2Pack.every(monster => {
        const skillId = monster.tid === 149104 ? '149081' : '149082';
        return monster.resolvedSkills[skillId].args[0].value.display === 236;
    }), true);

    const wave5Madness = dzoneData.waves.find(wave => wave.wave === 5).alerts.find(alert => alert.difficulty === 'madness');
    const wave5Pack = wave5Madness.summonedMonsters.filter(monster => [149104, 149114].includes(monster.tid));
    assert.equal(wave5Pack.every(monster => monster.hp === 354418 && monster.attack === 1373), true);
    assert.equal(wave5Pack.every(monster => {
        const skillId = monster.tid === 149104 ? '149081' : '149082';
        return monster.resolvedSkills[skillId].args[0].value.display === 275;
    }), true);
});

test('상태 의존 행동은 기본값과 스택당 증가량을 정확히 표시한다', () => {
    const wave2Madness = dzoneData.waves.find(wave => wave.wave === 2).alerts.find(alert => alert.difficulty === 'madness');
    const saint = wave2Madness.monsters.find(monster => monster.tid === 149109);
    assert.equal(saint.resolvedSkills['149130'].description, '기본 365 피해를 3회 입히고, 피의 맹세 1 스택마다 입히는 피해가 43 증가.');
    assert.match(saint.resolvedStates.find(state => state.id === 149143).description, /둔화 명령 카드가 1장 있을 때마다 피의 맹세 1스택을 획득/);

    const visibleDescriptions = dzoneData.waves.flatMap(wave => wave.alerts.flatMap(alert => [
        ...alert.monsters,
        ...(alert.summonedMonsters || [])
    ].flatMap(monster => [
        ...Object.values(monster.resolvedSkills || {}).map(skill => skill.richDescription || skill.description),
        ...Object.values(monster.phaseResolvedSkills || {}).flatMap(skills => Object.values(skills).map(skill => skill.richDescription || skill.description)),
        ...(monster.resolvedStates || []).filter(state => state.visible).map(state => state.richDescription || state.description)
    ])));
    assert.equal(visibleDescriptions.some(description => /\[[^\]]*?(?:Arg|Layer)\d*\]/.test(description || '')), false);
    assert.doesNotMatch(source, /현재 상태에 따라 달라지는|조건에 따라 정해진 횟수/);
});

test('5파 보스 각성 효과명과 피에 굶주린 철구 설명을 정확히 표시한다', () => {
    const wave5 = dzoneData.waves.find(wave => wave.wave === 5);
    const reaper = wave5.monsters.find(monster => monster.tid === 148007);
    const transition = reaper.phaseTransitions.find(item => item.phaseIndex === 2);

    assert.deepEqual(
        transition.addedStates.filter(state => state.visible).map(state => state.name),
        ['은심 고정', '영혼 사냥 선언']
    );
    assert.equal(reaper.skills.find(skill => skill.id === 148364).name, '피에 굶주린 철구');
    assert.deepEqual(transition.displayStateReplacements['148020'], {
        id: 148395,
        name: '영혼을 거두리-피에 굶주린 철구',
        descriptionTemplate: '모든 피해(관통 피해 포함)에 면역되며 HP를 잃을 수 없습니다. 적의 턴 종료 후 제거됩니다.',
        icon: 'images/keyword-icons/original/icons_buff_058.png',
        visible: true,
        richDescriptionTemplate: '<game-text:모든 피해(관통 피해 포함)에 면역되며 HP를 잃을 수 없습니다. 적의 턴 종료 후 제거됩니다.>'
    });

    const stats = wave5.alerts.find(alert => alert.difficulty === 'madness').monsters.find(monster => monster.tid === 148007);
    const context = vm.createContext({
        escapeHtml: String,
        dynamicMarkup: String,
        skillById: (monster, id) => monster.skills.find(skill => skill.id === id)
    });
    vm.runInContext(source.slice(source.indexOf('    function renderPhaseTransition('), source.indexOf('    function renderActionFlow(')), context);
    const transitionHtml = context.renderPhaseTransition(reaper, transition, stats);
    assert.match(transitionHtml, /영혼을 거두리-피에 굶주린 철구/);
    assert.doesNotMatch(transitionHtml, /은심 고정/);

    for (const alert of wave5.alerts) {
        const resolved = alert.monsters.find(monster => monster.tid === 148007).resolvedSkills['148364'];
        assert.match(resolved.description, /^기본 [\d,]+ 피해를 1회 입히고, 적의 출혈 3 스택마다 피해 1 증가/);
        assert.doesNotMatch(resolved.description, /\(대상의 출혈 3스택당 \+1\)/);
        assert.doesNotMatch(resolved.richDescription, /\(대상의 출혈 3스택당 \+1\)/);
    }
    assert.match(source, /displayStateReplacements/);
    assert.doesNotMatch(source, /conditional-applied-state/);
    assert.match(css, /\.phase-transition-summary,\s*\.phase-transition > p,\s*\.phase-card p\s*\{[^}]*font-size:\s*0\.76rem/s);
});

test('위치 제약이 없다는 중복 문구를 화면에서 제거한다', () => {
    assert.match(source, /\(\?:어디든\|위치에\)/);
    assert.match(source, /\(\?:관계\|상관\)/);
});

test('원본 키워드 연결 설명에서도 위치 괄호 문구를 제거하고 실제 조건은 보존한다', () => {
    const context = vm.createContext({
        window: { DzoneRichText: require('./dzone-richtext.js') },
        data: { keywordGlossary: { kw_0123456789abcdef: { description: '힘', color: '#ffffff' } } },
        escapeHtml: String, tooltips: {}
    });
    vm.runInContext(source.slice(source.indexOf('    const gameText ='), source.indexOf('    function staticMonster(')), context);
    for (const suffix of ['(어디든 관계없이)', '(어디든 상관 없이)', '(위치에 관계없이)', '（위치에 상관없이）']) {
        const text = `모든 적이 <kw_0123456789abcdef:힘> 51pt를 획득한다${suffix}.`;
        const result = context.dynamicMarkup(`<game-text:${text}>`);
        assert.doesNotMatch(result, /어디든|위치에/);
        assert.match(result, /tooltip-trigger/);
        assert.match(result, /51pt를 획득합니다\./);
        assert.doesNotMatch(context.dynamicMarkup(`실드를 획득한다${suffix}.`), /어디든|위치에/);
    }
    assert.match(context.dynamicMarkup('<game-text:피해를 입힌다(HP가 50% 미만일 때).</game-text>'), /HP가 50% 미만일 때/);
});

test('연결 해제는 1 HP 생존 후 실행하는 조건부 행동이며 체력바를 추가하지 않는다', () => {
    const wave = dzoneData.waves.find(wave => wave.wave === 2);
    const monster = wave.monsters.find(monster => monster.tid === 72151);
    const context = vm.createContext({
        data: dzoneData, number: new Intl.NumberFormat('ko-KR'),
        escapeHtml: String, gameText: String, politeText: String, dynamicMarkup: String,
        renderIntentIcon: () => '', skillById: (m, id) => m.skills.find(s => s.id === id),
        isFoldedReplacementAction: () => false
    });
    vm.runInContext(source.slice(source.indexOf('    function renderConditionalActions('), source.indexOf('    function renderSummons(')), context);
    assert.deepEqual(monster.phaseTransitions, []);
    for (const alert of wave.alerts) {
        const stats = alert.monsters.find(monster => monster.tid === 72151);
        assert.equal(stats.phases.length, 1);
        assert.equal(stats.effectiveHp, stats.hp);
        const result = context.renderConditionalActions(monster, stats);
        assert.equal((result.match(/<article /g) || []).length, 1);
        assert.match(result, /<strong>연결 해제<\/strong>/);
        assert.doesNotMatch(result, /<strong>응시<\/strong>/);
        assert.match(result, /잿더미 융식체」 3명과 「긴급 연락」 1개를 소환/);
        assert.doesNotMatch(result, /피해 완전 면역 1스택 보유/);
        assert.doesNotMatch(result, /「「연결자」」/);
        // Older snapshots must not hide an action behind a phase never rendered.
        const legacy = { ...monster, phaseTransitions: [{ phaseIndex: 2, phaseSkillIds: [72112] }] };
        assert.match(context.renderConditionalActions(legacy, stats), /<strong>연결 해제<\/strong>/);
    }
});

test('사라 소환체의 HP와 체력바는 현재 보스 최대 HP의 2%로 일치한다', () => {
    const wave = dzoneData.waves.find(wave => wave.wave === 3);
    for (const alert of wave.alerts) {
        const boss = alert.monsters.find(monster => monster.tid === 74035);
        for (const summon of alert.summonedMonsters.filter(monster => monster.tid === 73523)) {
            assert.equal(summon.hp, Math.ceil(boss.hp * 0.02));
            assert.equal(summon.phases[0].hp, summon.hp);
            assert.equal(summon.effectiveHp, summon.hp);
        }
    }
});

test('연결 해제로 소환되는 긴급 연락의 이미지·행동·패시브·난이도별 수치를 연결한다', () => {
    const wave = dzoneData.waves.find(w => w.wave === 2);
    const definition = wave.summonDefinitions.find(monster => monster.tid === 72150);
    assert.ok(definition);
    assert.equal(definition.nameKo, '긴급 연락');
    assert.ok(fs.existsSync(path.join(__dirname, '..', definition.webImage)));
    assert.deepEqual(definition.patterns.find(p => p.id === 'cycle-1').skillIds, [72125, 72115, 72119, 72115]);
    for (const alert of wave.alerts) {
        const parent = alert.monsters.find(monster => monster.tid === 72151);
        const group = alert.summonedMonsters.filter(monster => monster.parentTid === 72151 && monster.rule.sourceSkillId === 72112);
        assert.equal(group.length, 4);
        const emergency = group.find(monster => monster.tid === 72150);
        assert.equal(emergency.hp, Math.ceil(parent.hp * 0.3));
        assert.equal(emergency.phases[0].hp, emergency.hp);
        assert.equal(emergency.effectiveHp, emergency.hp);
        assert.equal(emergency.attack, Math.ceil(parent.attack * 0.3));
        assert.equal(emergency.resolvedSkills['72115'].args[0].value.display, Math.ceil(emergency.attack * 1.4));
        const passive = emergency.resolvedStates.find(state => state.id === 73567);
        assert.equal(passive.stateArgs[0].value.display, Math.ceil(emergency.attack * 0.025));
        assert.equal(passive.stateArgs[1].value.display, Math.ceil(emergency.hp * 0.05));
        assert.doesNotMatch(passive.richDescription, /\[StateArg/);
    }
    const context = vm.createContext({
        selectedAlert: wave.alerts.at(-1).alert, escapeHtml: String,
        summonDefinition: (w, id) => w.summonDefinitions.find(m => m.tid === id),
        renderMonsterCard: m => `<article>${m.nameKo}</article>`
    });
    vm.runInContext(source.slice(source.indexOf('    function renderSummons('), source.indexOf('    function relicParameterText(')), context);
    const rendered = context.renderSummons(wave, 72151);
    assert.match(rendered, /aria-label="「연결 해제」로 소환"/);
    assert.equal((rendered.match(/<article>긴급 연락<\/article>/g) || []).length, 1);
});

test('동일 소환체는 수량으로 묶되 다른 패턴·능력치·소환 경로는 합치지 않는다', () => {
    const wave = dzoneData.waves.find(w => w.wave === 2);
    const cards = [];
    const context = vm.createContext({
        selectedAlert: wave.alerts.at(-1).alert, escapeHtml: String,
        summonDefinition: (w, id) => w.summonDefinitions.find(m => m.tid === id),
        renderMonsterCard: (monster, stats, options) => { cards.push({ tid: monster.tid, stats, badge: options.badgeLabel }); return ''; }
    });
    vm.runInContext(source.slice(source.indexOf('    function renderSummons('), source.indexOf('    function relicParameterText(')), context);
    context.renderSummons(wave, 72151);
    assert.equal(cards.length, 5);
    const disconnect = cards.filter(c => c.stats.rule.sourceSkillId === 72112);
    assert.equal(disconnect.length, 3);
    assert.match(disconnect.find(c => c.tid === 72144).badge, /최대 ×2/);
    assert.equal(disconnect.find(c => c.tid === 72142).stats.count, 1);
    assert.equal(disconnect.find(c => c.tid === 72150).stats.count, 1);
    assert.equal(cards.filter(c => c.tid === 72144).length, 2);
    assert.equal(wave.alerts.at(-1).summonedMonsters.filter(s => s.parentTid === 72151).length, 8);
    cards.length = 0;
    const sample = disconnect.find(c => c.tid === 72150).stats;
    const triple = { ...wave, alerts: [{ alert: context.selectedAlert,
        summonedMonsters: [1, 2, 3].map(position => ({ ...sample, positions: [position], count: 1 })) }] };
    context.renderSummons(triple, 72151);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].badge, '소환 개체 ×3');
});

test('순교자의 죽음 저항과 분열체의 포식당함을 다른 개체·효과로 유지한다', () => {
    const wave = dzoneData.waves.find(wave => wave.wave === 4);
    assert.equal(wave.monsters.find(monster => monster.tid === 94942).conditionalActions.some(action => action.skillId === 94957), false);
    assert.equal(wave.summonDefinitions.find(monster => monster.tid === 94702).conditionalActions.some(action => action.skillId === 94957), true);
    for (const alert of wave.alerts) {
        assert.equal(alert.monsters.find(monster => monster.tid === 94942).phases.length, 1);
        for (const summon of alert.summonedMonsters.filter(monster => monster.tid === 94702)) {
            assert.equal(summon.hp, null);
            assert.match(summon.hpDisplay, /소환 턴/);
            assert.equal(summon.resolvedSkills['94957'].args[0].value.display, Math.ceil(summon.attack * 0.5));
        }
    }
});

test('각성 후 HP 비례 수치는 증가한 최대 HP를 사용한다', () => {
    const wave = dzoneData.waves.find(wave => wave.wave === 4);
    const boss = wave.alerts.find(alert => alert.difficulty === 'madness').monsters.find(monster => monster.tid === 118029);
    assert.equal(boss.phaseResolvedSkills['2']['118975'].args[0].value.display, 2623403);
    assert.match(source, /stats\.phaseResolvedSkills\?\.\['2'\]/);
});

test('융재금구는 금기 학식 등급만 받고 정확한 연구 깊이는 노출하지 않는다', () => {
    assert.match(html, /id="dzone-research-level"/);
    assert.doesNotMatch(html, /dzone-depth-summary/);
    assert.doesNotMatch(source, /formatDepth\(/);
    assert.doesNotMatch(source, /연구 깊이에 따라 결정되는 수치/);
});

test('융재금구 진입점과 헤더·초기 유물은 평면 톤으로 통일한다', () => {
    const bannerMarkup = linksSource.match(/<a href="dzone_info\.html" class="dzone-info-banner">([\s\S]*?)<\/a>/)?.[0] || '';
    assert.match(bannerMarkup, /<strong>이번 융재금구 데이터<\/strong>/);
    assert.doesNotMatch(bannerMarkup, /현재 시즌 데이터|융재금구 전투 정보 한눈에 보기|몬스터 실제 HP|정보 열기/);
    const bannerBlock = linksCss.match(/\.dzone-info-banner\s*\{([\s\S]*?)\}/)?.[1] || '';
    const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] || '';
    const relicBlock = css.match(/\.wave-relics\s*\{([\s\S]*?)\}/)?.[1] || '';
    assert.doesNotMatch(bannerBlock, /gradient/);
    assert.doesNotMatch(relicBlock, /gradient/);
    assert.match(bannerBlock, /background:\s*#25262a/);
    assert.match(html, /class="info-shell info-shell--dark dzone-shell"/);
    assert.match(html, /class="info-header dzone-hero"/);
    assert.match(rootBlock, /--dzone-panel:\s*#24242a/);
    assert.match(relicBlock, /background:\s*var\(--dzone-panel\)/);
});

test('소환 개체는 상세 정보에 남기되 주요 기믹에서는 제외한다', () => {
    const mechanicDefinitions = source.match(/const MECHANIC_DEFINITIONS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';
    const waveMechanicsBlock = source.match(/function waveMechanics\(wave\) \{([\s\S]*?)\n    \}/)?.[1] || '';
    assert.doesNotMatch(mechanicDefinitions, /label:\s*'소환'/);
    assert.doesNotMatch(waveMechanicsBlock, /mechanics\.push\('소환'\)/);
    assert.match(source, /class="summon-section" aria-label=/);
});

test('HP와 상성 각성체 영역은 몬스터 카드와 같은 배경을 사용한다', () => {
    const statBlock = css.match(/\.monster-stat\s*\{([\s\S]*?)\}/)?.[1] || '';
    const hpBlock = css.match(/\.hp-breakdown\s*\{([\s\S]*?)\}/)?.[1] || '';
    const statLabelBlock = css.match(/\.monster-stat dt\s*\{([\s\S]*?)\}/)?.[1] || '';
    const affinityLabelBlock = css.match(/\.monster-stat--affinity > h5\s*\{([\s\S]*?)\}/)?.[1] || '';
    assert.match(statBlock, /background:\s*transparent/);
    assert.match(hpBlock, /background:\s*transparent/);
    assert.match(statLabelBlock, /color:\s*#f1f1f2/);
    assert.match(statLabelBlock, /font-size:\s*0\.84rem/);
    assert.match(affinityLabelBlock, /color:\s*#f1f1f2/);
    assert.match(affinityLabelBlock, /font-size:\s*0\.84rem/);
});

test('본문 툴팁은 문장 기준선을 유지한다', () => {
    const tooltipBlock = css.match(/\.action-copy p \.tooltip-trigger,([\s\S]*?)\}/)?.[1] || '';
    assert.match(tooltipBlock, /align-items:\s*baseline/);
    assert.match(tooltipBlock, /min-height:\s*0/);
    assert.match(tooltipBlock, /line-height:\s*inherit/);
});

test('융재금구 페이지는 공통 뒤로가기와 신고 버튼을 제공한다', () => {
    assert.match(html, /href="index\.html" class="back-link">⬅ 뒤로가기<\/a>/);
    assert.match(html, /class="floating-report-btn"/);
    assert.match(html, /loadJS\('js\/feedback\.js'\)/);
    assert.match(css, /\.dzone-page-shell \.back-link\s*\{[\s\S]*?min-height:\s*44px/);
    assert.match(css, /body\.dzone-page:not\(\.landing-page\) > \.floating-report-btn\s*\{[^}]*top:\s*auto/);
    assert.match(css, /body\.dzone-page:not\(\.landing-page\) > \.floating-report-btn\s*\{[^}]*bottom:\s*max\(20px, env\(safe-area-inset-bottom\)\)/);
});

test('행동과 부가 정보는 상성 각성체의 안쪽 기준선에 맞춘다', () => {
    const flowBlock = css.match(/\.combat-flow\s*\{([\s\S]*?)\}/)?.[1] || '';
    const conditionalBlock = css.match(/\.conditional-actions\s*\{([\s\S]*?)\}/)?.[1] || '';
    assert.match(flowBlock, /margin:\s*1rem var\(--monster-content-inset\) 0/);
    assert.match(conditionalBlock, /margin:\s*0\.8rem var\(--monster-content-inset\) 0/);
});

test('파 제목과 기믹 뱃지는 같은 중심선에 놓고 전투 패널 밝기를 통일한다', () => {
    const toolbarBlock = css.match(/\.dzone-toolbar\s*\{([\s\S]*?)\}/)?.[1] || '';
    const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] || '';
    const monsterCardBlock = css.match(/\.monster-card\s*\{([\s\S]*?)\}/)?.[1] || '';
    const encounterHeaderBlock = css.match(/\.encounter-header\s*\{([\s\S]*?)\}/)?.[1] || '';
    assert.match(css, /\.info-shell \.wave-title\s*\{\s*margin:\s*0;/);
    assert.match(toolbarBlock, /margin:\s*0 0 0\.75rem/);
    assert.match(rootBlock, /--dzone-panel:\s*#24242a/);
    assert.match(rootBlock, /--dzone-combat-panel:\s*#2a2a32/);
    assert.match(rootBlock, /--dzone-combat-header:\s*#25262a/);
    assert.match(monsterCardBlock, /background:\s*var\(--dzone-combat-panel\)/);
    assert.match(encounterHeaderBlock, /background:\s*var\(--dzone-combat-header\)/);
});

test('융재금구와 복각 일정은 은열쇠 정보와 같은 어두운 외곽 패널을 사용한다', () => {
    assert.match(html, /class="info-shell info-shell--dark dzone-shell"/);
    assert.match(rerunHtml, /class="info-shell info-shell--dark"/);
    assert.match(infoToolsCss, /\.info-shell--dark\s*\{[\s\S]*?background:\s*#1e1e24/);
});

test('융재금구 전투 정보는 도서관과 진행 중인 팁에서 모두 접근할 수 있다', () => {
    const librarySection = landingHtml.match(/<section class="menu-section menu-section-library"([\s\S]*?)<\/section>/)?.[0] || '';
    assert.match(librarySection, /href="dzone_info\.html"/);
    assert.match(librarySection, /융재금구 전투 정보/);
    assert.match(linksSource, /href="dzone_info\.html" class="dzone-info-banner"/);
});

test('문맥상 일반어인 희생·기절·보유는 툴팁에서 제외한다', () => {
    assert.match(source, /자신을 희생하여/);
    assert.match(source, /「기절」/);
    assert.match(source, /보유하고/);
});

test('다중 체력과 조건부 행동은 별도 라운드 박스를 사용하지 않는다', () => {
    assert.match(source, /<h5>HP <span>/);
    assert.doesNotMatch(source, /체력 단계/);
    assert.doesNotMatch(css, /\.flow-phase--awakened/);
    assert.match(css, /\.conditional-actions[\s\S]*border-top:/);
});

test('몬스터 카드는 화면 너비와 관계없이 한 행에 하나만 배치한다', () => {
    assert.match(css, /\.monster-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.doesNotMatch(css, /\.monster-list\s*\{[^}]*repeat\(/);
});

test('현재 시즌에 존재하는 기믹만 바로가기 뱃지로 제공한다', () => {
    assert.match(html, /id="dzone-mechanic-chips"/);
    assert.match(html, /이번 융재 기믹/);
    assert.doesNotMatch(html, /기믹 검색|type="search"|data-search-keyword/);
    assert.match(source, /MECHANIC_DEFINITIONS/);
    assert.match(source, /waveMechanics/);
    assert.match(source, /renderMechanicNavigation/);
    assert.match(source, /data-mechanic/);
    assert.match(source, /mechanicMatches/);
    assert.match(source, /scrollIntoView/);
    assert.match(source, /aria-pressed/);
    assert.doesNotMatch(source, /renderSearchResults|searchQuery|data-search-wave/);
    assert.match(source, /\{ label: '동결', terms: \['동결', '빙결'\] \}/);
    assert.match(source, /\.replace\(\/빙결\/g, '동결'\)/);
});

test('카드류와 다중 체력·부활은 기믹 뱃지에서 제외하고 본문 툴팁으로 안내한다', () => {
    const mechanicBlock = source.match(/const MECHANIC_DEFINITIONS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';
    assert.doesNotMatch(mechanicBlock, /증상 카드|상처|비틀거림|질식|다이얼 폭탄|다중 체력|부활/);
    assert.doesNotMatch(source, /mechanics\.push\('다중 체력'\)|mechanics\.push\('부활'\)/);
    assert.match(source, /const DZONE_CARD_TOOLTIPS/);
    assert.match(source, /'「상처」': '상태 카드 \| 상처/);
    assert.match(source, /'「비틀거림」': '상태 카드 \| 비틀거림/);
    assert.match(source, /'「질식」': '상태 카드 \| 질식/);
    assert.match(source, /'「다이얼 폭탄」': '상태 카드 \| 다이얼 폭탄/);
    assert.match(source, /'증상: 쇠약': '증상 카드 \| 쇠약/);
    const frost = Object.values(dzoneData.keywordGlossary).find(entry => entry.source.id === 149773);
    assert.match(frost.description, /능동 피해.*둔화.*5회/);
    assert.doesNotMatch(frost.description, /눈막에 감춰진 자취|피해를 먼저 흡수하는 방어막입니다/);
    const bone = Object.values(dzoneData.keywordGlossary).find(entry => entry.source.id === 149167);
    assert.match(bone.description, /최대 HP가 스택 수만큼 감소/);
    assert.match(source, /Object\.assign\(tooltips, DZONE_CARD_TOOLTIPS\)/);
    assert.match(css, /\.action-copy p \.tooltip-trigger[\s\S]*display:\s*inline-flex/);
});

test('다중 체력 몬스터는 체력바 개수와 정확한 수치를 보여준다', () => {
    assert.match(source, /HP \$\{stats\.phases\.length\}줄/);
    assert.match(source, /hp-phase-map/);
    assert.match(source, /--hp-phase-size: \$\{phase\.hp\}/);
    assert.match(css, /\.hp-phase-segment \+ \.hp-phase-segment\s*\{[^}]*border-left:/);
    assert.match(source, /실질 총 HP/);
    assert.doesNotMatch(source, /부활 후 \$\{index \+ 1\}번째 체력바/);
});

test('전투 선택 UI는 중복되는 표시 문구와 시각적 그룹 라벨을 숨긴다', () => {
    assert.match(html, /<h2 id="filter-heading">전투 선택<\/h2>/);
    assert.doesNotMatch(html, /보고 싶은 전투 선택|표시하고 있습니다/);
    assert.match(html, /<legend class="dzone-visually-hidden">파 선택<\/legend>/);
    assert.match(html, /<legend class="dzone-visually-hidden">난이도 선택<\/legend>/);
    assert.match(html, /id="selection-status" class="dzone-visually-hidden"/);
});

test('몬스터 분류는 이름 옆에, 상성 각성체는 HP 아래 상세 카드로 보여준다', () => {
    assert.match(source, /84297: \{ label: '각성체'/);
    assert.match(source, /90645: \{ label: '인간형'/);
    assert.match(source, /94556: \{ label: '망령'/);
    assert.match(source, /monster-heading-tags/);
    assert.match(source, /상성 각성체/);
    assert.match(source, /affinity-awakener-effect/);
    assert.match(source, /\$\{tag\.label\}에 추가 효과/);
    assert.match(source, /name: '파인트'/);
    assert.doesNotMatch(source, /name: '페인트'/);
    assert.match(source, /images\/Lily-thumb\.png/);
    assert.match(source, /links\.html\?category=character/);
    assert.match(css, /\.monster-overview\s*\{/);
    assert.match(css, /\.affinity-awakener\s*\{/);
    assert.match(css, /\.monster-overview\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.doesNotMatch(css, /\.monster-overview\s*\{[^}]*repeat\(2/);
    assert.match(css, /\.affinity-awakener-list\s*\{[^}]*auto-fit/);
    assert.doesNotMatch(css, /#4d5c51|#242d27|#2b382f|#a8d2b1|#d8efde|#b8ddc1/);
    assert.match(source, /if \(!counters\.length\) return '';/);
    assert.doesNotMatch(source, /인게임 분류/);
});

test('번식 혈육을 활성화하는 사야와 카라부는 껍데기 적의 상성 각성체로 표시한다', () => {
    assert.match(source, /90640: \{ label: '껍데기', counters:/);
    assert.match(source, /id: 'saya'[\s\S]*'핏빛 침식'이 5배/);
    assert.match(source, /id: 'caraboo'[\s\S]*'핏빛 침식'이 5배/);
    assert.match(source, /84303: \{ label: '혈육', counters:[\s\S]*id: 'saya'/);
});

test('현재 융재의 상태 기믹은 전체 각성체 데이터에서 확인한 해제기와 연결한다', () => {
    const allMonsters = dzoneData.waves.flatMap(wave => [...wave.monsters, ...(wave.summonDefinitions || [])]);
    const mechanicText = tid => {
        const monster = allMonsters.find(entry => entry.tid === tid);
        return JSON.stringify([monster?.states, monster?.skills]);
    };
    assert.match(mechanicText(149116), /둔화/);
    assert.match(mechanicText(149109), /허약/);
    assert.match(mechanicText(118029), /취약/);
    assert.match(mechanicText(149069), /봉인/);
    assert.match(mechanicText(149070), /손상/);

    assert.match(characterEffects.vortice.skills.find(skill => skill.name === '심연! 소용돌이! 대포!').effect, /모든 카드의 연소 상태를 해제/);
    assert.match(characterEffects.caraboo.skills.find(skill => skill.name === '짜잔☆요정님 등장!').effect, /모든 카드의 연소 상태를 해제/);
    assert.match(characterEffects['kathigu-ra'].traits.find(trait => trait.name === '영혼 단련').effect, /손패의 모든 \[연소\] 상태를 제거/);
    assert.match(characterEffects.arachne.skills.find(skill => skill.name === '운명, 이로써 고하노라').effect, /모든 손패의 둔화 상태를 제거/);
    assert.match(characterEffects.karen.skills.find(skill => skill.name === '손님, 천천히 드세요!').effect, /손패의 모든 둔화 상태를 제거/);
    assert.match(characterEffects.celeste.skills.find(skill => skill.name === '순백의 꿈').effect, /손패의 둔화 상태를 제거/);
    assert.match(characterEffects.alva.skills.find(skill => skill.name === '임전 태세').effect, /모든 각성체의 봉인 상태를 해제/);
    assert.match(characterEffects.sanga.skills.find(skill => skill.name === '폐쇄적 창작').effect, /자신의 손상 상태를 해제/);
    assert.match(characterEffects.tinct.skills.find(skill => skill.name === '진혼곡').effect, /자신의 손상, 허약, 취약 상태를 해제/);
    assert.match(characterEffects.helot.skills.find(skill => skill.name === '절망 속의 생존').effect, /자신의 허약 과 임시 힘 감소 상태를 해제/);
    assert.match(characterEffects.faros.skills.find(skill => skill.name === '잃어버린 고대의 도시').effect, /자신의 취약 상태를 해제/);

    assert.match(source, /손상: \['sanga', 'faint', 'winkle', 'erica', 'tinct', 'ogier'\]/);
    assert.match(source, /허약: \['caecus', 'tulu', 'helot', 'erica', 'tinct', 'lotan'\]/);
    assert.match(source, /취약: \['faros', 'leigh', 'tinct', 'doll'\]/);
    assert.match(source, /둔화: \['arachne', 'karen', 'celeste'\]/);
    assert.match(source, /연소: \['vortice', 'kathigu-ra', 'caraboo'\]/);
    assert.match(source, /118029: \['허약', '취약'\]/);
    assert.match(source, /149116: \['손상', '둔화'\]/);
    assert.match(source, /149069: \['봉인', '허약'\]/);
    assert.match(source, /existing\.note = \[\.\.\.new Set/);
});

test('선택한 스테이지의 공개 기록을 채용률과 편성 조합으로 전환해 보여준다', () => {
    assert.match(source, /\/api\/dzone\/stage\/\$\{stageId\}\/usage/);
    assert.match(source, /실전 편성 통계/);
    assert.match(source, /각성체 채용률/);
    assert.match(source, /자주 쓰인 편성/);
    assert.match(source, /표본 \$\{number\.format\(metadata\.recordCount\)\}건 · 공개 기록 기준/);
    assert.match(source, /최근 집계 \$\{dateTime\.format\(metadata\.fetchedAt \* 1000\)\}/);
    assert.match(source, /\$\{dateTime\.format\(metadata\.since \* 1000\)\} KST 이후 공개 클리어 기록/);
    assert.match(source, /timeZone: 'Asia\/Seoul'/);
    assert.match(source, /updated\.dateTime = new Date\(metadata\.fetchedAt \* 1000\)\.toISOString\(\)/);
    assert.match(source, /<progress max="1"/);
    assert.match(source, /stageUsageCache = new Map\(\)/);
    assert.match(source, /STAGE_USAGE_REFRESH_START = Date\.parse\('2026-09-01T21:00:00\+09:00'\)/);
    assert.match(source, /STAGE_USAGE_REFRESH_INTERVAL = 30 \* 1000/);
    assert.match(source, /CONFIG\.DZONE_USAGE_ENDPOINT_URL/);
    assert.match(source, /response\.status === 404/);
    assert.match(source, /아직 전송된 실전 통계가 없습니다\./);
    assert.match(source, /통계 수신 대기 중/);
    assert.match(source, /await loadStageUsage\(stageId, true\)/);
    assert.match(css, /\.stage-usage-tabs button\s*\{[^}]*min-height:\s*44px/);
    assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.usage-party-members\s*\{[^}]*repeat\(2/);
    assert.match(css, /@media \(max-width: 368px\)[\s\S]*\.usage-party-list > li\s*\{[^}]*grid-template-columns:\s*1\.2rem minmax\(0, 1fr\)/);
    assert.match(css, /\.usage-awakener--compact > span:last-child\s*\{[^}]*word-break:\s*keep-all/);
});

test('난이도별 클리어 기록은 성장·영지체 제한과 성립 가능한 조합을 한눈에 보여준다', () => {
    assert.match(source, /stageUsageView = 'constraints'/);
    assert.match(source, />제한 클리어<\/button>/);
    assert.match(source, /label: \['초한 X'\]/);
    assert.match(source, /label: \['최종 X'\]/);
    assert.match(source, /label: \['영지체 X'\]/);
    assert.match(source, /label: \['초한 O', '최종 X', '영지체 O'\]/);
    assert.match(source, /label: \['초한 O', '최종 O', '영지체 X'\]/);
    assert.match(source, /label: \['초한 O', '최종 X', '영지체 X'\]/);
    assert.match(source, /label: \['초한 X', '최종 X', '영지체 O'\]/);
    assert.match(source, /label: \['초한 X', '최종 X', '영지체 X'\]/);
    assert.match(source, /<strong>X<\/strong> 없음 또는 미사용/);
    assert.match(source, /“초한만 없음”은 성립하지 않습니다/);
    assert.match(source, /전체 \$\{number\.format\(overview\.recordCount\)\}건 · \$\{scopeLabel\}/);
    assert.match(source, /difficultySet\.has\('nightmare'\) && difficultySet\.has\('madness'\)/);
    assert.match(source, /\? '5개 파 · 악몽·광기'/);
    assert.match(source, /stages\.map\(stage =>/);
    assert.doesNotMatch(source, /overview\.stages\.slice/);
    assert.match(source, /\/api\/dzone\/usage/);
    assert.match(source, /\/private-tools\/output\/dzone-usage-overview\.json/);
    assert.match(source, /overview\?\.stages\?\.find\(stage => stage\.stageTid === stageId\)/);
    assert.match(source, /localStageUsage\.usageRecordCount \?\? localStageUsage\.recordCount/);
    assert.match(source, /localStageUsage\.usageFetchedAt \?\? overview\.fetchedAt/);
    assert.match(source, /Array\.isArray\(localStageUsage\.awakeners\)/);
    assert.match(source, /Array\.isArray\(localStageUsage\.parties\)/);
    assert.match(source, /stages\?\.length === 10/);
    assert.match(source, /\['nightmare', 'madness'\]\.includes/);
    assert.match(source, /stages\?\.length !== 20/);
    assert.match(css, /\.usage-constraint-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(css, /\.usage-constraint-table\s*\{[^}]*min-width:\s*48rem/);
    assert.match(css, /\.usage-constraint-table\s*\{[^}]*table-layout:\s*fixed/);
    assert.match(css, /\.usage-constraint-state\s*\{[^}]*display:\s*grid/);
    assert.match(css, /\.usage-constraint-state > span\s*\{[^}]*white-space:\s*nowrap/);
    assert.doesNotMatch(css, /\.usage-constraint-table td\s*\{[^}]*min-width/);
    assert.match(css, /\.usage-constraint-result strong\s*\{[^}]*white-space:\s*nowrap/);
    assert.doesNotMatch(css, /usage-constraint[^{]*\{[^}]*(?:text-overflow:\s*ellipsis|overflow:\s*hidden)/);
});
