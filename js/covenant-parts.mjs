import {applyCovenantBoundMaterial} from './covenant-bound-material.mjs';
// Shared part buttons: the simulator keeps its original two-column layout;
// equipment editors can opt into the six sectors of the in-game hexagon.
const ROMANS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
const vertices = [[50,0],[100,25],[100,75],[50,100],[0,75],[0,25]];
const innerLabelPositions=[['66.6667%','25%'],['83.3333%','50%'],['66.6667%','75%'],['33.3333%','75%'],['16.6667%','50%'],['33.3333%','25%']];
const labelPositions=[['calc(75% - 7px)','calc(12.5% + 12px)'],['calc(100% - 22px)','50%'],['calc(75% - 7px)','calc(87.5% - 12px)'],['calc(25% + 7px)','calc(87.5% - 12px)'],['22px','50%'],['calc(25% + 7px)','calc(12.5% + 12px)']];
export function renderCovenantParts(parent, {indexes=[0,1,2,3,4,5], selected=0, parts, onSelect, hex=false, labelsInside=false}) {
    parent.replaceChildren();
    parent.classList.toggle('covenant-part-hex', hex);
    parent.classList.toggle('has-inside-labels',hex&&labelsInside);
    const surface=hex?document.createElement('div'):parent;
    if(hex){surface.className='covenant-hex-surface';parent.append(surface);}
    for (const index of indexes) {
        const part = parts[index], button = document.createElement('button');
        button.type = 'button';
        button.className = `part-button ${index === selected ? 'active' : ''} ${part.lastTouched ? 'has-result' : ''}`;
        button.classList.toggle('is-empty',!!part.empty);
        button.classList.toggle('is-bound',!!part.bound);
        button.dataset.partIndex = index;
        button.setAttribute('aria-pressed', String(index === selected));
        const roman = document.createElement('span');
        roman.className = 'part-roman'; roman.textContent = ROMANS[index];
        const completion = document.createElement('span');
        completion.className = 'part-main part-completion'; completion.textContent = part.caption;
        button.append(roman, completion);
        if (hex) {
            // Keyboard and screen-reader selection uses the numbered controls.
            button.tabIndex=-1;button.setAttribute('aria-hidden','true');
            const a=vertices[index], b=vertices[(index+1)%6];
            button.style.clipPath=`polygon(50% 50%,${a[0]}% ${a[1]}%,${b[0]}% ${b[1]}%)`;
            roman.remove();
            if(part.image){const art=document.createElement('img');art.src=part.image;art.alt='';if(part.pieceArt){art.classList.add('part-art');art.style.left=index<3?'50%':'0%';art.style.top=[0,25,50,50,25,0][index]+'%';}button.prepend(art);if(part.bound)applyCovenantBoundMaterial(art,part.image);}
            button.setAttribute('aria-label',`${index+1}번 부위 · ${part.name} · ${part.caption}`);
            button.title = `${ROMANS[index]} · ${part.name}`;
            if(part.empty){const edge=document.createElementNS('http://www.w3.org/2000/svg','svg');edge.classList.add('part-empty-border');edge.setAttribute('viewBox','0 0 100 100');edge.setAttribute('preserveAspectRatio','none');const path=document.createElementNS('http://www.w3.org/2000/svg','polygon');path.setAttribute('points',`50,50 ${a[0]},${a[1]} ${b[0]},${b[1]}`);edge.append(path);button.append(edge);}
        }
        button.onclick=()=>onSelect(index);
        surface.append(button);
        if(hex){
            const label=document.createElement('button');label.type='button';label.className='part-index-button';label.textContent=ROMANS[index];label.dataset.partLabel=index;label.setAttribute('aria-label',button.getAttribute('aria-label'));label.setAttribute('aria-pressed',String(index===selected));label.classList.toggle('is-empty',!!part.empty);label.classList.toggle('is-bound',!!part.bound);const positions=labelsInside?innerLabelPositions:labelPositions;label.style.left=positions[index][0];label.style.top=positions[index][1];label.onclick=()=>onSelect(index);(labelsInside?surface:parent).append(label);
        }
    }
    // The client shows Image_Finish/GetSuitIcon only for a complete matching set.
    if(hex&&parts.length===6&&parts[0].suitId&&parts.every(p=>p.suitId===parts[0].suitId)&&parts[0].setIcon){
        const emblem=document.createElement('img');emblem.className='covenant-set-emblem';emblem.src=parts[0].setIcon;emblem.alt='';emblem.setAttribute('aria-hidden','true');surface.append(emblem);
    }
}
