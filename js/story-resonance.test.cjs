const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const native=JSON.parse(fs.readFileSync(__dirname+'/../data/story/resonance-ui.json'));
const context=vm.createContext({window:{},document:{addEventListener(){}},fetch:async()=>({ok:true,json:async()=>native})});vm.runInContext(fs.readFileSync(__dirname+'/story-resonance.js','utf8'),context);
const maps=JSON.parse(fs.readFileSync(__dirname+'/../data/story/maps.json'));
test.before(async()=>context.window.StoryResonance.load());

test('스토리 스타일의 로컬 이미지 참조가 배포 경로에 존재한다',()=>{
 const path=require('node:path'),file=path.join(__dirname,'../css/pages/story-info.css');
 for(const [,url] of fs.readFileSync(file,'utf8').matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){
  if(/^(?:data:|https?:)/.test(url))continue;
  assert(fs.existsSync(path.resolve(path.dirname(file),url)),url);
 }
});
test('모든 장의 공명은 프리팹의 기본 노드·좌표·실제 연결선과 이미지를 보존한다',()=>{
 for(const tree of Object.values(maps.resonance)){
  const graph=context.window.StoryResonance.layout(tree),nodes=tree.nodes.filter(n=>!n.inherited),source=native.layouts[tree.group];
  assert.equal(graph.nodes.length,nodes.length);assert.equal(new Set(graph.nodes.map(p=>p.node.id)).size,nodes.length);
  assert.equal(graph.edges.length,source.edges.length);
  for(const edge of graph.edges){assert(graph.nodes.some(p=>p.node.id===edge.from));assert(graph.nodes.some(p=>p.node.id===edge.to));assert(edge.parts.length);}
  for(const p of graph.nodes){const original=source.nodes.find(n=>n.id===p.node.id);assert.equal(p.x,original.x/32);assert.equal(p.y,original.y/32);assert.equal(p.frame,original.frame);assert.equal(p.icon,original.icon);for(const file of[p.icon,p.frame,p.selectedFrame])assert(fs.existsSync(__dirname+'/../'+file));}
 }
 assert.equal(Object.values(native.layouts).reduce((sum,g)=>sum+g.nodes.length,0),135);
 assert.equal(Object.values(native.layouts).reduce((sum,g)=>sum+g.edges.length,0),137);
 const first=context.window.StoryResonance.layout(maps.resonance['망각편:1']);assert(first.nodes[1].x>first.nodes[2].x);assert(first.nodes[0].node.default);
});
test('설명은 하나만 표시하고 노드는 접근 가능한 선택 버튼으로 렌더링한다',()=>{
 const tree=maps.resonance['망각편:1'];const html=context.window.StoryResonance.render(tree,{escapeHtml:String,chapterKey:'망각편:1',detailHtml:n=>'<article>'+n.name+'</article>'});
 assert.equal((html.match(/<article>/g)||[]).length,1);assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
 assert.equal((html.match(/data-resonance-select=/g)||[]).length,6);assert.match(html,/aria-label="공명 노드 연결도"/);assert.match(html,/aria-label="선택한 공명 효과"/);assert.doesNotMatch(html,/✦|<svg/);
});
