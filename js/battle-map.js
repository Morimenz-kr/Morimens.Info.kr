(() => {
    'use strict';
    function render(layout, {escapeHtml, title='지도', id='map', hint='전투 노드를 선택하면 해당 전투 정보로 이동합니다.', simplifySingleCombat=true}) {
        if (!layout?.nodes?.length) return '';
        const hasStart = layout.nodes.some(node => node.kind === 'start' || node.isStart);
        const combatNodes = layout.nodes.filter(node => node.kind === 'combat');
        const visibleNodes = simplifySingleCombat && !hasStart && combatNodes.length === 1 ? combatNodes : layout.nodes;
        const minRow = Math.min(...visibleNodes.map(node => node.row));
        const minColumn = Math.min(...visibleNodes.map(node => node.column + (node.row % 2 === 0 ? 0.5 : 0)));
        const positioned = visibleNodes.map((node, index) => ({
            ...node,
            index,
            x: node.column + (node.row % 2 === 0 ? 0.5 : 0) - minColumn,
            y: node.row - minRow
        }));
        const maxX = Math.max(...positioned.map(node => node.x));
        const maxY = Math.max(...positioned.map(node => node.y));
        const boardWidth = Math.ceil(maxX * 99.36 + 108);
        const boardHeight = Math.ceil(maxY * 60.48 + 81);
        const nodes = positioned.map(node => {
            const style = `--map-x:${node.x};--map-y:${node.y}`;
            const icon = node.icon ? `images/dzone/map/node-${encodeURIComponent(node.icon)}.webp` : '';
            const textureClass = node.texture ? ` dzone-map-node--texture-${escapeHtml(node.texture)}` : '';
            const ariaNodeLabel = node.label.endsWith('노드') ? node.label : `${node.label} 노드`;
            const visualLabel = node.texture ? '' : `<span>${escapeHtml(node.label)}</span>`;
            const content = `<span class="dzone-map-node-surface" aria-hidden="true"></span>
                <span class="dzone-map-node-content${icon ? '' : ' dzone-map-node-content--label-only'}" aria-hidden="true">
                    ${icon ? `<img src="${icon}" alt="" width="54" height="54" decoding="async">` : ''}
                    ${visualLabel}
                </span>`;
            if (node.battleId || node.detailId) {
                return `<li class="dzone-map-node dzone-map-node--${escapeHtml(node.kind)}${node.icon === 'boss' ? ' dzone-map-node--boss' : ''}${textureClass}" style="${style}"${node.isStart?' data-map-start="true"':''}>
                    <button type="button" ${node.battleId?`data-map-battle="${node.battleId}"`:`data-map-detail="${escapeHtml(node.detailId)}"`}${node.battleIds?.length?` data-map-battles="${node.battleIds.join(',')}"`:''} aria-label="${escapeHtml(ariaNodeLabel)}, ${node.battleId?'전투 정보 보기':'기믹 설명 보기'}" aria-pressed="false">${content}</button>
                </li>`;
            }
            return `<li class="dzone-map-node dzone-map-node--${escapeHtml(node.kind)}${textureClass}" style="${style}"${node.isStart?' data-map-start="true"':''} aria-label="${escapeHtml(ariaNodeLabel)}">${content}</li>`;
        }).join('');
        return `<details class="dzone-map" aria-labelledby="dzone-map-title-${id}" open>
            <summary class="dzone-map-header">
                <div><h3 id="dzone-map-title-${id}">${escapeHtml(title)}</h3><p>${escapeHtml(hint)}</p></div>
                <span class="dzone-map-toggle" aria-hidden="true"></span>
            </summary>
            <div class="dzone-map-viewport" tabindex="0" aria-label="${escapeHtml(title)}. 지도가 넓으면 좌우로 이동할 수 있습니다.">
                <ol class="dzone-map-board" style="--map-width:${boardWidth/16}rem;--map-height:${boardHeight/16}rem">${nodes}</ol>
            </div>
        </details>`;
    }

    function showDetail(root,id){
        const target=root.querySelector('#'+id);if(!target)return;
        for(let parent=target.parentElement;parent&&parent!==root;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
        target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
        target.focus({preventScroll:true});
    }
    function activate(root=document) {
        for(const map of root.querySelectorAll('.dzone-map')){
            const viewport=map.querySelector('.dzone-map-viewport'),start=map.querySelector('.dzone-map-node--start,[data-map-start]');
            if(viewport&&start)viewport.scrollLeft=Math.max(0,start.offsetLeft-viewport.clientWidth/2+start.clientWidth/2);
            map.addEventListener('click',event=>{
                const button=event.target.closest('[data-map-battle],[data-map-detail]');if(!button)return;
                if(button.dataset.mapDetail){
                    showDetail(root,button.dataset.mapDetail);return;
                }
                const ids=(button.dataset.mapBattles||button.dataset.mapBattle).split(',').map(Number);
                const encounters=ids.map(id=>root.querySelector(`[data-battle-id="${id}"]`)).filter(Boolean);
                if(!encounters.length)return;
                root.querySelectorAll('[data-map-battle]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
                for(const encounter of encounters)encounter.open=true;
                encounters[0].scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
                encounters[0].querySelector('summary')?.focus({preventScroll:true});
            });
        }
    }
    window.BattleMap={render,activate,showDetail};
})();
