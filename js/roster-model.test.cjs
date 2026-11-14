const {test}=require('node:test');const assert=require('node:assert/strict');const M=require('./roster-model.js');
const growth={a:{maxLevel:60,talentUpgrades:[{type:1,name:'징조',maxLevel:12}],skillUpgrades:[{slot:'one',name:'카드',maxLevel:6}]},b:{maxLevel:50,talentUpgrades:[{type:1,name:'징조',maxLevel:10}],skillUpgrades:[{slot:'one',name:'카드',maxLevel:4}]}};
test('legacy inventory migration preserves ownership and potency without inventing growth',()=>{const a=M.migrate({characters:['a'],wheels:['w'],characterBreakthroughs:{a:7},wheelBreakthroughs:{w:3}});assert.equal(a.characters.a.potency,7);assert.equal(a.wheels.w.potency,3);assert.equal(a.characters.a.level,undefined);});
test('bulk maximum resolves separately for every character and slot',()=>{const r=M.apply(M.empty(),['a','b'],{'skill:one':'max','talent:1':'max'},growth);assert.equal(r.account.characters.a.skills.one,6);assert.equal(r.account.characters.b.skills.one,4);assert.equal(r.account.characters.b.talents[1],10);});
test('fill blanks preserves explicitly entered zero and existing values',()=>{let a=M.apply(M.empty(),['a'],{'talent:1':0,level:20},growth).account;const r=M.apply(a,['a'],{'talent:1':'max',level:60,'skill:one':'max'},growth,true);assert.equal(r.account.characters.a.talents[1],0);assert.equal(r.account.characters.a.level,20);assert.equal(r.account.characters.a.skills.one,6);});
test('missing source and above-cap values are reported without clamping',()=>{const r=M.apply(M.empty(),['a','unknown'],{'skill:one':7},growth);assert.equal(r.skipped.length,2);assert.equal(r.account.characters.a.skills.one,undefined);});
test('unregistering preserves growth for later registration',()=>{const a=M.apply(M.empty(),['a'],{owned:true,level:40},growth).account;assert.equal(M.apply(a,['a'],{owned:false},growth).account.characters.a.level,40);});
test('file validation rejects malformed and out of range imports',()=>{assert.throws(()=>M.validate({version:4},['a'],[],growth));const a=M.apply(M.empty(),['a'],{owned:true,level:60},growth).account;a.characters.a.level=61;assert.throws(()=>M.validate(a,['a'],[],growth));});
test('backup round trip retains talents, slots, wheels and presets',()=>{const a=M.apply(M.empty(),['a'],{owned:true,'skill:one':3,'talent:1':0},growth).account;a.wheels.w={owned:true,potency:2};a.presets=[{name:'스킬','patch':{'skill:one':'max'}}];assert.deepEqual(M.validate(JSON.parse(JSON.stringify(a)),['a'],['w'],growth).account,a);});
test('unknown character IDs are reported for review',()=>{const a=M.apply(M.empty(),['unknown'],{owned:true},{ }).account;assert.deepEqual(M.validate(a,['a'],[],growth).unknown,['unknown']);});
test('merge fills missing fields while retaining entered values',()=>{const a=M.apply(M.empty(),['a'],{owned:true,level:20},growth).account;const b=M.apply(M.empty(),['a'],{owned:true,level:60,'skill:one':6},growth).account;const merged=M.merge(a,b);assert.equal(merged.characters.a.level,20);assert.equal(merged.characters.a.skills.one,6);assert.equal(a.characters.a.skills.one,undefined);});
test('team availability keeps distinct missing slots',()=>{const a=M.apply(M.empty(),['a'],{owned:true},growth).account;assert.deepEqual(M.availability({members:['a','b','c','d']},a),{owned:1,missing:['b','c','d']});});

test('ScareCrow potency badge uses three passive diamonds then enhancement 1 through 12',()=>{
    assert.deepEqual(M.potencyDisplay(0),{diamonds:0,extra:0,max:false});
    assert.deepEqual(M.potencyDisplay(3),{diamonds:3,extra:0,max:false});
    assert.deepEqual(M.potencyDisplay(4),{diamonds:3,extra:1,max:false});
    assert.deepEqual(M.potencyDisplay(7),{diamonds:3,extra:4,max:false});
    assert.deepEqual(M.potencyDisplay(15),{diamonds:3,extra:12,max:true});
    assert.deepEqual(M.potencyDisplay(null),{diamonds:0,extra:null,max:false});
});

test('wheel potency 0 through 15 survives migration and backup validation without truncation',()=>{
    for(let potency=0;potency<=15;potency++){
        const migrated=M.migrate({wheels:['w'],wheelBreakthroughs:{w:potency}});
        const restored=M.validate(JSON.parse(JSON.stringify(migrated)),[],['w'],{}).account;
        assert.deepEqual(restored.wheels.w,{owned:true,potency});
    }
    for(const potency of [-1,16,1.5,'15',null]){
        const account=M.empty();account.wheels.w={owned:true,potency};
        assert.throws(()=>M.validate(account,[],['w'],{}),/명륜 돌파/);
    }
});

test('wheel bulk edits change only selected wheels, retain ownership and support maximum and default',()=>{
    const a=M.empty();a.characters.a={owned:true,potency:7,skills:{one:3},talents:{}};
    a.wheels={a:{owned:true,potency:2},b:{owned:false,potency:9},c:{owned:true,potency:4}};
    const snapshot=M.clone(a);
    const full=M.applyWheels(a,['a','b'],{potency:'max'});
    assert.equal(full.changes,2);assert.deepEqual(full.skipped,[]);
    assert.deepEqual(full.account.wheels,{a:{owned:true,potency:15},b:{owned:false,potency:15},c:a.wheels.c});
    assert.deepEqual(full.account.characters,a.characters);assert.deepEqual(a,snapshot);
    const reset=M.applyWheels(full.account,['b'],{potency:null,owned:true}).account;
    assert.deepEqual(reset.wheels.b,{owned:true,potency:0});assert.equal(reset.wheels.a.potency,15);
    assert.equal(M.applyWheels(a,['a'],{potency:8}).account.wheels.a.potency,8);
    assert.deepEqual(M.applyWheels(a,['a'],{potency:16}).account,a);
    assert.deepEqual(M.applyWheels(a,['a'],{}).account,a);
});

test('potency arrows cycle both directions over every value including base and full',()=>{
    assert.equal(M.stepPotency(0,-1),15);assert.equal(M.stepPotency(15,1),0);
    for(let n=0;n<=15;n++){
        assert.equal(M.stepPotency(M.stepPotency(n,1),-1),n);
        assert.equal(M.stepPotency(M.stepPotency(n,-1),1),n);
    }
});

test('limited innate level stays 5 through load normalization and bulk edits',()=>{
    const a=M.empty();a.characters.a={owned:true,potency:0,talents:{1:12,2:0,3:0},skills:{}};
    a.characters.b={owned:true,potency:0,talents:{3:2},skills:{}};
    const newlyOwned=M.apply(M.empty(),['a'],{owned:true},growth,false,['a']);
    assert.equal(newlyOwned.account.characters.a.talents[3],5);
    const normalized=M.normalizeLimited(a,['a']);
    assert.equal(normalized.characters.a.talents[3],5);
    assert.equal(normalized.characters.a.talents[2],0);
    assert.equal(normalized.characters.b.talents[3],2);
    assert.equal(a.characters.a.talents[3],0);
    for(const value of [0,null,'max']){
        const result=M.apply(a,['a'],{'talent:3':value},growth,false,['a']);
        assert.equal(result.account.characters.a.talents[3],5);
        assert.equal(result.skipped.length,0);
    }
});
test('limited innate level is supplied even when the legacy growth catalog omits it',()=>{
    const result=M.apply(M.empty(),['a'],{owned:true,'talent:3':0},growth,false,['a']);
    assert.equal(result.account.characters.a.talents[3],5);
    assert.equal(result.skipped.length,0);
    const restored=M.validate(result.account,['a'],[],growth).account;
    assert.equal(M.normalizeLimited(restored,['a']).characters.a.talents[3],5);
});

test('character defaults use level 1, base potency, skill 1 and talent 0 with limited innate 5',()=>{
    const normal=M.characterDefaults();
    assert.equal(normal.level,1);assert.equal(normal.potency,0);
    assert.deepEqual(Object.values(normal.skills),[1,1,1,1,1,1]);
    assert.deepEqual(normal.talents,{1:0,2:0,3:0});
    assert.equal(M.characterDefaults({},true).talents[3],5);
});
test('applying defaults preserves entered levels and explicit zero values across reload/import',()=>{
    const a=M.empty();a.characters.a={owned:true,level:55,potency:7,talents:{1:12,2:0,3:3},skills:{Slot_Super:4}};
    const normalized=M.normalizeDefaults(a,['a']);
    assert.equal(normalized.characters.a.level,55);assert.equal(normalized.characters.a.potency,7);
    assert.equal(normalized.characters.a.talents[2],0);assert.equal(normalized.characters.a.talents[3],5);
    assert.equal(normalized.characters.a.skills.Slot_Super,4);assert.equal(normalized.characters.a.skills.Slot_Strike,1);
    assert.equal(a.characters.a.skills.Slot_Strike,undefined);
    assert.deepEqual(M.normalizeDefaults(normalized,['a']),normalized);
});
test('default-only bulk mode upgrades baseline values while preserving invested growth',()=>{
    const a=M.empty();a.characters.a={owned:true,level:1,potency:0,talents:{1:0},skills:{one:1}};
    a.characters.b={owned:true,level:30,potency:3,talents:{1:8},skills:{one:3}};
    const r=M.apply(a,['a','b'],{level:50,'talent:1':10,'skill:one':4},growth,true,[],true);
    assert.equal(r.account.characters.a.level,50);assert.equal(r.account.characters.a.talents[1],10);assert.equal(r.account.characters.a.skills.one,4);
    assert.equal(r.account.characters.b.level,30);assert.equal(r.account.characters.b.talents[1],8);assert.equal(r.account.characters.b.skills.one,3);
});
