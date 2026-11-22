const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../data', name), 'utf8'));
const data = read('dzone_season74.json');

test('74기 중첩 상태는 실제 명령의 상태로 연결되고 수식에서 참조하는 상태도 설명한다', () => {
    for (const [parentId, childId, label] of [[94730, 3068, '중독'], [117889, 2900, '힘'], [119108, 36014, '헌제'], [2840, 60265, '용혈']]) {
        const parents = Object.entries(data.keywordGlossary).filter(([, item]) => item.source.type === 'State' && item.source.id === parentId);
        assert.ok(parents.length, `State:${parentId}`);
        for (const [key, item] of parents) {
            const children = [...String(item.richDescription).matchAll(/<(kw_[a-f0-9]{16}):([^<>]+)>/g)];
            assert.ok(children.some(([, child, shown]) => shown === label && data.keywordGlossary[child]?.source.id === childId), key);
        }
    }
    for (const item of Object.values(data.keywordGlossary)) for (const [, key] of String(item.richDescription || '').matchAll(/<(kw_[a-f0-9]{16}):/g)) assert.ok(data.keywordGlossary[key]?.description, key);
    const poisonBlade = Object.values(data.keywordGlossary).find(item => item.source.id === 94730 && item.description.includes('10의 중독'));
    assert.ok(poisonBlade);
    const poisonKey = [...poisonBlade.richDescription.matchAll(/<(kw_[a-f0-9]{16}):중독>/g)][0][1];
    assert.match(data.keywordGlossary[poisonKey].description, /10\s*의/);
});

test('74기 준비본은 res23 원본과 일정·35개 스테이지·지도를 연결한다', () => {
    assert.equal(data.period, 74);
    assert.equal(data.source.resourceVersion, 23);
    assert.equal(data.source.branchName, 'Z1G_2026_11_OB');
    const metadata = read('dzone_season_catalog.json').seasons.find(row => row.period === 74);
    assert.equal(data.usageSince, metadata.usageSince);
    assert.equal(data.difficultyCount, 7);
    assert.equal(data.waves.length, 5);
    const maps = read('dzone_maps_season74.json');
    for (const wave of data.waves) {
        const expected = metadata.waves.find(row => row.wave === wave.wave);
        assert.equal(wave.stageGroupId, expected.stageGroupId);
        assert.deepEqual(wave.alerts.map(row => row.stageId), expected.alerts.map(row => row.stageId));
        const map = maps.waves.find(row => row.wave === wave.wave);
        assert.equal(map.mapId, wave.mapId);
        for (const encounter of wave.encounters) assert.ok(map.nodes.some(node => node.battleId === encounter.battleId));
    }
    assert.equal(data.summary.uniqueMonsterCount, 47);
    assert.equal(data.summary.summonedMonsterCount, 13);
});

test('74기 툴팁·이미지와 카드 사용 의도 변형에 끊어진 참조가 없다', () => {
    const audit = data.contentAudit;
    assert.equal(audit.generator.id, 'morimens-data-extractor/dzone');
    assert.deepEqual(audit.diagnostics, []);
    assert.deepEqual(audit.presentationAudit.issues, []);
    assert.equal(audit.presentationAudit.counts.unlinkedMentions, 0);
    assert.equal(audit.presentationAudit.counts.cardUseVariants, 6);
    assert.equal(audit.referenceInventory.missingTargetCount, 0);
    assert.equal(audit.referenceInventory.externalTargetCount, 0);
    assert.deepEqual(audit.warnings, [{ kind: 'source-empty-description', source: 'State:3255', presentation: '연결 없이 원문 표기' }]);
    for (const match of JSON.stringify(data.waves).matchAll(/<(kw_[a-f0-9]{16}):/g)) assert.ok(data.keywordGlossary[match[1]]?.description);
    for (const item of Object.values(data.keywordGlossary)) assert.doesNotMatch(item.description, /\[(?:\w+:)?(?:Arg|StateArg|DescArg)\d+\]|NaN|undefined/);
    const visit = value => {
        if (typeof value === 'string' && value.startsWith('images/')) assert.ok(fs.existsSync(path.join(__dirname, '..', value)), value);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(data);
});

test('74기 소환체를 포함한 응시는 실제 단계의 6턴 반복 의도로 해석된다', () => {
    let checked = 0;
    for (const wave of data.waves) for (const monster of [...wave.monsters, ...wave.summonDefinitions]) {
        if (!monster.states.some(state => state.id === 22074)) continue;
        checked++;
        const action = monster.conditionalActions.find(row => row.contextResolved && row.skillId === 4681);
        assert.ok(action, `${wave.wave}파 Monster:${monster.tid}`);
        assert.equal(action.sourceStageGroupId, wave.stageGroupId);
        assert.equal(action.firstTurn, 6);
        assert.equal(action.persistent, true);
        assert.ok(action.contextEvidence.length);
        assert.ok(!monster.conditionalActions.some(row => row.contextResolved && row.skillId === 4747));
    }
    assert.ok(checked > 0);
});

 test('74기 운영 데이터와 지도는 검증된 보관본과 동일하며 73기 보관본을 유지한다', () => {
 assert.deepEqual(read('dzone_current.json'), data);
 assert.deepEqual(read('dzone_maps.json'), read('dzone_maps_season74.json'));
 assert.equal(read('dzone_season73.json').period, 73);
 });
