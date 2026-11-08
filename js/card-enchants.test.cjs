const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {catalog,keywordGlossary}=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/story/card-enchants.json')));
test('card enchant catalog preserves 19 normal/advanced pairs and chapter-specific variants',()=>{
 assert.equal(catalog.length,46);assert.equal(catalog.filter(c=>c.grade==='normal').length,19);assert.equal(catalog.filter(c=>c.grade==='advanced').length,22);assert.equal(catalog.filter(c=>c.grade==='special').length,5);
 for(const row of catalog.filter(c=>c.grade==='normal')){
  const higher=catalog.find(c=>c.group===row.group&&c.grade==='advanced');assert(higher);
  assert.notEqual(higher.stateIds[0],row.stateIds[0]);assert.notEqual(higher.key,row.key);
  assert.match(keywordGlossary[higher.key].name,/^고급 /);
 }
 for(const id of[49108,59530,59531,59532,67415,67416,67417,119927])assert(catalog.some(c=>c.id===id));
});
test('enchant bodies link their actual granted status and card attributes without unresolved operands',()=>{
 const entry=id=>keywordGlossary[catalog.find(c=>c.id===id).key];
 for(const e of Object.values(keywordGlossary)){
  assert(e.source?.id);assert.doesNotMatch(e.description,/\[(?:StateArg|Arg|DescArg)\d+\]|NaN|undefined|[\u3400-\u9fff]/);
  for(const m of String(e.richDescription||'').matchAll(/<(kw_[a-f0-9]{16}):/g))assert(keywordGlossary[m[1]],m[1]);
 }
 assert.match(entry(18183).richDescription,/<kw_[a-f0-9]{16}:취약>/);
 assert.match(entry(49108).richDescription,/<kw_[a-f0-9]{16}:보존>/);
 assert.match(entry(49108).richDescription,/<kw_[a-f0-9]{16}:소모>/);
 assert.match(entry(18174).description,/2턴/);assert.match(entry(18183).description,/1턴/);
 assert.match(entry(18196).description,/7\.5%/);assert.match(entry(18184).description,/15%/);
 assert.match(entry(59532).richDescription,/:보존>/);assert.match(entry(119927).richDescription,/:여파>/);
});
