const test = require('node:test');
const assert = require('node:assert/strict');

const stat = id => ({id,label:id,unit:'%',value:2});
function row(pair, contract, count, {sub='damage',completion=95}={}) {
    const wheels = pair === null ? null : pair.map(id => ({id,level:15}));
    const covenant = contract === null ? null : {completion,parts:Array.from({length:6},(_,i) => ({slot:i+1,setId:contract,main:stat('attack'),subs:i === 0 ? [stat(sub),stat(sub)] : i === 1 ? [stat(sub)] : []}))};
    return {wave:1,difficulty:'6',count,members:[{characterId:'target',enlightenment:0,borrowed:false,wheels,covenant}]};
}
const fixture = () => [row(['a','b'],'x',8),row(['a','b'],'x',5,{sub:'low',completion:89}),row(['a','b'],'y',2,{sub:'speed'}),row(['c','d'],'x',7,{sub:'critical'}),row(['c','d'],'y',30,{sub:'shield'})];

test('rankings use weighted global denominators and remain unchanged by either equipment selection',async()=>{
    const {equipmentStatistics}=await import('./usage-recommendations.mjs');
    const rows=fixture(),before=JSON.stringify(rows);
    const a=equipmentStatistics(rows,'target',{wheelKey:'a|b',covenantKey:'x:6'});
    const b=equipmentStatistics(rows,'target',{wheelKey:'c|d',covenantKey:'y:6'});
    assert.deepEqual(a.wheelGroups,[{key:'c|d',ids:['c','d'],count:37,rate:37/52},{key:'a|b',ids:['a','b'],count:15,rate:15/52}]);
    assert.deepEqual(a.contractGroups.map(g=>[g.key,g.count,g.rate,g.knownCount]),[['y:6',32,32/52,52],['x:6',20,20/52,52]]);
    assert.deepEqual(a.wheelGroups,b.wheelGroups);assert.deepEqual(a.contractGroups,b.contractGroups);
    assert.equal(JSON.stringify(rows),before);
});

test('option adoption is conditioned on both selected wheels and contract and keeps low-completion rows only as source evidence',async()=>{
    const {equipmentStatistics}=await import('./usage-recommendations.mjs');
    const rows=fixture(),result=equipmentStatistics(rows,'target',{wheelKey:'a|b',covenantKey:'x:6'});
    assert.deepEqual(result.jointRows,[rows[0],rows[1]]);
    assert.equal(result.optionGroup.count,13);assert.equal(result.optionGroup.options.total,8);
    assert.deepEqual(result.optionGroup.options.subs.map(s=>[s.id,s.count,s.rate]),[['damage',24,1]]);
    assert.equal(result.optionGroup.options.slots[0].subs[0].count,16);
    assert.equal(result.optionGroup.options.subs.some(s=>['critical','low','shield','speed'].includes(s.id)),false);
    assert.deepEqual(result.optionGroup.wheels,['a','b']);
});

test('two independently existing selections with no joint observations are preserved without replacement statistics',async()=>{
    const {equipmentStatistics}=await import('./usage-recommendations.mjs');
    const rows=[row(['a','b'],'x',10),row(['c','d'],'y',20)];
    const result=equipmentStatistics(rows,'target',{wheelKey:'a|b',covenantKey:'y:6'});
    assert.equal(result.selectedWheelKey,'a|b');assert.equal(result.selectedCovenantKey,'y:6');
    assert.ok(result.wheelGroups.some(g=>g.key==='a|b'));assert.ok(result.contractGroups.some(g=>g.key==='y:6'));
    assert.deepEqual(result.jointRows,[]);assert.equal(result.optionGroup,null);
});

test('unobserved, unequipped and single-wheel records do not become pairs or leak into option statistics',async()=>{
    const {equipmentStatistics}=await import('./usage-recommendations.mjs');
    const valid=row(['b','a'],'x',4),missing=row(null,'x',100,{sub:'missing'}),empty=row([],'x',200,{sub:'empty'}),single=row(['a'],'x',300,{sub:'single'}),hiddenContract=row(['c','d'],null,6);
    const result=equipmentStatistics([valid,missing,empty,single,hiddenContract],'target',{wheelKey:'a|b',covenantKey:'x:6'});
    assert.deepEqual(result.wheelGroups,[{key:'c|d',ids:['c','d'],count:6,rate:.6},{key:'a|b',ids:['a','b'],count:4,rate:.4}]);
    assert.equal(result.contractGroups[0].count,604);assert.equal(result.contractGroups[0].knownCount,604);
    assert.deepEqual(result.jointRows,[valid]);assert.equal(result.optionGroup.options.total,4);
    assert.deepEqual(result.optionGroup.options.subs.map(s=>s.id),['damage']);
});

test('initial selection is the most frequent observed joint rather than the independently highest-ranked equipment',async()=>{
    const {equipmentStatistics}=await import('./usage-recommendations.mjs');
    const rows=[row(['a','b'],'y',40),row(['a','b'],'z',35),row(['c','d'],'x',45),row(['e','f'],'x',35)];
    const result=equipmentStatistics(rows,'target');
    assert.equal(result.wheelGroups[0].key,'a|b');assert.equal(result.contractGroups[0].key,'x:6');
    assert.equal(result.selectedWheelKey,'c|d');assert.equal(result.selectedCovenantKey,'x:6');
    assert.deepEqual(result.jointRows,[rows[2]]);assert.equal(result.optionGroup.count,45);
});

test('a partial selection is completed only with an observed matching partner',async()=>{
    const {equipmentStatistics}=await import('./usage-recommendations.mjs');
    const wheel=equipmentStatistics(fixture(),'target',{wheelKey:'a|b'});
    assert.equal(wheel.selectedWheelKey,'a|b');assert.equal(wheel.selectedCovenantKey,'x:6');
    const contract=equipmentStatistics(fixture(),'target',{covenantKey:'y:6'});
    assert.equal(contract.selectedWheelKey,'c|d');assert.equal(contract.selectedCovenantKey,'y:6');
});

test('when no joint can be observed, no fabricated default pair/contract is selected',async()=>{
    const {equipmentStatistics}=await import('./usage-recommendations.mjs');
    const result=equipmentStatistics([row(['a','b'],null,20),row(null,'x',30)],'target');
    assert.equal(result.wheelGroups.length,1);assert.equal(result.contractGroups.length,1);
    assert.equal(result.selectedWheelKey,'');assert.equal(result.selectedCovenantKey,'');
    assert.equal(result.optionGroup,null);assert.deepEqual(result.jointRows,[]);
    const stale=equipmentStatistics(fixture(),'target',{wheelKey:'gone|pair',covenantKey:'x:6'});
    assert.equal(stale.selectedWheelKey,'gone|pair');assert.equal(stale.selectedCovenantKey,'x:6');
    assert.equal(stale.optionGroup,null);assert.deepEqual(stale.jointRows,[]);
});
