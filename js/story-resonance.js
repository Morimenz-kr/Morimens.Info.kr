(() => {
  'use strict';
  let nativeLayouts={},background='',loading;
  function load(){return loading??=(async()=>{const response=await fetch('data/story/resonance-ui.json?v=native-1');if(!response.ok)throw Error('Missing native resonance UI');const data=await response.json();nativeLayouts=data.layouts;background=data.background;})();}
  function views(tree){const ids=new Set(tree.nodes.map(n=>n.id));return Object.keys(nativeLayouts).filter(group=>nativeLayouts[group].nodes.every(n=>ids.has(n.id)));}
  function groupForNode(tree,id){return views(tree).find(group=>nativeLayouts[group].nodes.some(n=>n.id===id));}
  function layout(tree,group=tree.group){
    const source=nativeLayouts[group];if(!source)throw Error('Missing native resonance layout '+group);
    const byId=new Map(tree.nodes.map(n=>[n.id,n]));
    return {group,width:source.width/32,height:source.height/32,nodes:source.nodes.map(p=>({...p,node:byId.get(p.id),x:p.x/32,y:p.y/32})),edges:source.edges};
  }
  function artwork(p,escapeHtml){return `<img class="story-resonance-frame" src="${escapeHtml(p.frame)}" alt="" width="262" height="262" draggable="false"><img class="story-resonance-icon" src="${escapeHtml(p.icon)}" alt="" width="130" height="130" draggable="false"><span class="story-resonance-max">Lv.${p.node.levels.length>1?'1~'+p.node.levels.length:'1'}</span>`;}
  function icon(tree,id,escapeHtml){const p=layout(tree,groupForNode(tree,id)).nodes.find(p=>p.node.id===id);return `<span class="story-resonance-art story-resonance-preview" aria-hidden="true" style="--native-scale:.45">${artwork(p,escapeHtml)}</span>`;}
  function render(tree,{escapeHtml,detailHtml,chapterKey,layoutGroup=tree.group}){
    const graph=layout(tree,layoutGroup),first=graph.nodes[0]?.node;if(!first)return '';
    const lines=graph.edges.map(edge=>`<div class="story-resonance-native-edge" data-resonance-edge="${edge.from}:${edge.to}" aria-hidden="true">${edge.parts.map(p=>`<img src="${escapeHtml(p.image)}" alt="" draggable="false" style="left:${p.x/32}rem;top:${p.y/32}rem;width:${p.width/32}rem;height:${p.height/32}rem;opacity:${p.opacity};transform:translate(-50%,-50%) rotate(${p.angle}deg)">`).join('')}</div>`).join('');
    const buttons=graph.nodes.map(p=>`<button type="button" class="story-resonance-node story-resonance-art" data-resonance-select="${p.node.id}" aria-label="${escapeHtml(p.node.name)} · 최대 Lv.${p.node.levels.length}" title="${escapeHtml(p.node.name)}" aria-pressed="${p.node.id===first.id}" aria-controls="story-resonance-detail" style="left:${p.x}rem;top:${p.y}rem;--native-scale:${p.scale}">${artwork(p,escapeHtml)}</button>`).join('');
    const groups=views(tree),tabs=groups.length>1?'<div class="story-resonance-views" aria-label="공명 보기">'+groups.sort((a,b)=>Number(b===tree.group)-Number(a===tree.group)).map(group=>`<button type="button" class="story-resonance-link" data-resonance-view="${escapeHtml(group)}" aria-pressed="${group===layoutGroup}">${group===tree.group?'이 장의 공명':'계승한 공명'}</button>`).join('')+'</div>':'';
    return `<section class="story-resonance" data-resonance-chapter="${escapeHtml(chapterKey)}" data-resonance-group="${escapeHtml(layoutGroup)}">${tabs}<p class="story-resonance-hint">공명을 선택하면 효과를 확인할 수 있습니다.</p><div class="story-resonance-viewport" role="region" aria-label="공명 노드 연결도" tabindex="0" style="--resonance-height:${graph.height}rem;background-image:url('${escapeHtml(background)}')"><div class="story-resonance-canvas" style="width:${graph.width}rem;height:${graph.height}rem">${lines}${buttons}</div></div><div id="story-resonance-detail" class="story-resonance-detail" role="region" aria-label="선택한 공명 효과" aria-live="polite">${detailHtml(first)}</div></section>`;
  }
  let drag;
  document.addEventListener('pointerdown',event=>{
    const viewport=event.target.closest('.story-resonance-viewport');if(!viewport||event.pointerType!=='mouse'||event.button!==0||event.target.closest('button'))return;
    drag={viewport,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');event.preventDefault();
  });
  document.addEventListener('pointermove',event=>{if(drag){drag.viewport.scrollLeft=drag.left+drag.x-event.clientX;drag.viewport.scrollTop=drag.top+drag.y-event.clientY;}});
  const end=()=>{if(drag){drag.viewport.classList.remove('is-dragging');drag=null;}};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
  window.StoryResonance={load,layout,render,groupForNode,icon};
})();
