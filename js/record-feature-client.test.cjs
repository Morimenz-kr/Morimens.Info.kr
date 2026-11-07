const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('./record-feature-client.js');
test('pending outbound queries poll the same GET and return only the completed result',async t=>{
    t.mock.timers.enable({apis:['setTimeout']});let calls=0;
    const client=create({fetch:async()=>({ok:true,status:++calls===1?202:200,json:async()=>calls===1?{source:'game-server',pending:true,retryAfter:20,data:null}:{source:'game-server',data:{uid:1}}})});
    const result=client.profile(1);await new Promise(setImmediate);t.mock.timers.tick(20000);assert.equal((await result).data.uid,1);assert.equal(calls,2);
});
test('pending polling rejects invalid envelopes and is cancellable without leaking another request',async()=>{
    const invalid=create({fetch:async()=>({ok:true,status:202,json:async()=>({pending:true,retryAfter:1,source:'unknown'})})});await assert.rejects(invalid.profile(1));
    const controller=new AbortController();let calls=0;const client=create({fetch:async()=>{calls++;return{ok:true,status:202,json:async()=>({source:'game-server',pending:true,retryAfter:20,data:null})};}});
    const result=client.profile(1,{signal:controller.signal});await new Promise(setImmediate);controller.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(calls,1);
});
test('feature client uses read-only requests without credentials and safely encodes replay fragments', async () => {
    const calls = [], client = create({ fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ source: 'game-server', data: {} }) }; } });
    await client.review('00000000-0000-0000-0000-000000000001#E#a');
    assert.match(calls[0].url, /%23E%23a$/); assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.credentials, 'omit');
    await client.event('summon-148581'); assert.equal(calls[1].url, '/api/events/summon-148581');
    assert.throws(() => client.profile('../1')); assert.throws(() => client.review('bad'));
});
test('private/unavailable records are errors, never fabricated empty records or raw server text', async () => {
    const client = create({ fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: 'private', raw: 'sensitive' }) }) });
    await assert.rejects(client.profile(1), error => error.code === 'private' && !error.message.includes('sensitive'));
    const network = create({ fetch: async () => { throw Error('secret'); } });
    await assert.rejects(network.profile(1), error => error.code === 'service-unavailable' && !error.message.includes('secret'));
});
