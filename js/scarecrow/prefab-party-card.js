// Values are generated from the game's RectTransforms and active layout group.
(()=>{
 const L={
  "source": "UI_Team_Item_Awaker_List",
  "card": {
    "width": 294.0,
    "height": 672.0
  },
  "bottom": 20.899993896484375,
  "gap": 10.989999771118164,
  "info": {
    "x": 315.3882141113281,
    "y": 135.88980102539062
  },
  "level": {
    "x": 25.179636001586914,
    "y": 8.61153793334961,
    "font": 36,
    "labelFont": 24
  },
  "potency": {
    "x": 12.246399096258955,
    "y": 48.284939336777086,
    "size": 38.40000209808352,
    "pitch": 32.64000178337099,
    "font": 17.280000944137583
  },
  "skill": {
    "x": 15.6058349609375,
    "y": 79.78491520881653,
    "font": 20,
    "icon": 36
  },
  "talent": {
    "x": 19.305834770202637,
    "y": 117.88491821289062,
    "font": 20,
    "icon": 24
  },
  "seal": {
    "x": 229.01141739432205,
    "y": 75.26377825590495,
    "width": 92.15999794006348,
    "height": 95.99999785423279,
    "rawIconSize": {
      "x": 150.0,
      "y": 150.0
    },
    "imageFit": "Fit the extracted set artwork inside the prefab Trinket_Bg interaction box; raw 150x150 icon overhang is not copied."
  },
  "weapon": {
    "width": 92.0,
    "height": 138.0,
    "gap": 35.39999771118164,
    "mask": {
      "x": 86.0,
      "y": 132.0
    },
    "art": {
      "x": 99.0,
      "y": 200.0
    }
  }
};
 function layout(card,row){
  const s=card.clientWidth/L.card.width,zoom=parseFloat(getComputedStyle(document.documentElement).fontSize)/16,flow=zoom>1.25;
  row.dataset.prefabLayout=flow?'flow':'anchored';card.dataset.growthFlow=flow?'flow':'anchored';card.style.setProperty('--card-unit',s+'px');
  const set=(key,n)=>row.style.setProperty('--pc-'+key,n+'px');
  for(const [name,v] of Object.entries({level:L.level,potency:L.potency,skill:L.skill,talent:L.talent})){set(name+'-x',v.x*s);set(name+'-y',v.y*s);if(v.font)set(name+'-font',Math.max(name==='level'?18:12,v.font*s)*zoom);if(v.icon)set(name+'-icon',v.icon*s);}
  set('label-font',L.level.labelFont*s*zoom);set('star-size',L.potency.size*s);set('star-pitch',L.potency.pitch*s);set('seal-x',L.seal.x*s);set('seal-y',L.seal.y*s);set('seal-size',Math.min(L.seal.width,L.seal.height)*s);
  const weaponBottom=(L.bottom-5)*s,weaponHeight=L.weapon.height*s,gap=L.gap*s,weapons=card.querySelector('.wheels-wrapper');
  weapons.style.bottom=weaponBottom+'px';weapons.style.gap=L.weapon.gap*s+'px';
  for(const slot of weapons.querySelectorAll('.slot-wheel')){slot.style.setProperty('--weapon-star-size',22.68*s+'px');slot.style.setProperty('--weapon-star-gap',0*s+'px');slot.style.setProperty('--weapon-number-size',11.76*s+'px');slot.style.width=L.weapon.width*s+'px';slot.style.height=weaponHeight+'px';slot.style.setProperty('--weapon-art-width',L.weapon.art.x*s+'px');slot.style.setProperty('--weapon-art-height',L.weapon.art.y*s+'px');slot.style.setProperty('--weapon-clip-y',((L.weapon.art.y-L.weapon.mask.y)/2/L.weapon.art.y*100)+'%');slot.style.setProperty('--weapon-clip-x',((L.weapon.art.x-L.weapon.mask.x)/2/L.weapon.art.x*100)+'%');}
  row.style.bottom=(weaponBottom+weapons.getBoundingClientRect().height+gap+2)+'px';
  if(!flow)row.style.height=Math.max(L.info.y,L.talent.y+L.talent.icon)*s+'px';else row.style.height='auto';
  return {s,bottom:weaponBottom,weaponHeight,gap};
 }
 window.PrefabPartyCard={layout,source:L};
})();
