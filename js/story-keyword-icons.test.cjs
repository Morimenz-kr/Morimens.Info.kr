const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
test('스토리의 카드 상태는 실제 상태 아이콘이 있으면 본문 아이콘도 제공한다',()=>{
 let checked=0;
 for(const file of fs.readdirSync(path.join(root,'data/story/stages'))){
  const data=JSON.parse(fs.readFileSync(path.join(root,'data/story/stages',file)));
  for(const entry of Object.values(data.keywordGlossary)){
   if(!entry.description.startsWith('카드 상태 |')||!/^images\/keyword-icons\/original\/icons_buff_\d+\.png$/.test(entry.tooltipIcon||''))continue;
   assert(entry.icon,`${file}:State:${entry.source.id}`);
   assert(fs.existsSync(path.join(root,entry.icon)),entry.icon);checked++;
  }
 }
 assert(checked>0);
 const veil=JSON.parse(fs.readFileSync(path.join(root,'data/story/stages/118130.json')));
 assert.equal(Object.values(veil.keywordGlossary).find(e=>e.source.type==='State'&&e.source.id===3330).icon,'images/keyword-icons/original/icons_buff_024.png');
});
