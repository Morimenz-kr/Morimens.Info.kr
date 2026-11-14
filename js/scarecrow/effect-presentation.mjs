// res160 State/Cmd IDs: 2331 -> 3580, 121363 -> 121365, 132705 -> 132707.
// Presentation and input ownership only; native effect programs remain authoritative.
const reviewed = {
  3130: {placement:'team',scope:'team',name:'임시 힘',valueLabel:'임시 힘',description:'아군이 공용으로 사용하는 이번 턴의 임시 힘입니다.'},
  53115: {placement:'actor',scope:'actor',name:'다음 제의 강화',valueLabel:'활성화 (0 또는 1)',description:'이번 턴 미리암의 다음 제의 효과를 강화하는 개인 상태입니다.'},
  3580: {placement:'tentacle',scope:'team',name:'촉수 관통',source:'심연의 호령',valueLabel:'남은 턴',description:'촉수 공격이 관통 피해를 주는 남은 턴입니다.'},
  121365: {placement:'target',scope:'target',name:'받는 촉수 피해 증가 · 편성 효과',source:'편성 효과',valueLabel:'증가율 (%)',description:'툴루의 편성 효과로 이 적이 추가로 받는 촉수 피해율입니다. 비워두면 편성에 따라 계산합니다.'},
  132707: {placement:'target',scope:'target',name:'받는 촉수 피해 증가 · 불멸의 위엄',source:'불멸의 위엄',valueLabel:'누적 증가율 (%)',description:'불멸의 위엄 각성 후 광기폭발로 누적된 증가율입니다. 중첩 횟수가 아닌 합계(%)를 입력하세요.'}
};
export function effectPresentation(definition){
  const exact=reviewed[definition.id];
  return {...definition,placement:definition.scope==='context'?'actor':definition.scope,...exact};
}
export function effectSnapshot(item){
  const rule=reviewed[item.id];if(!rule)return {...item};
  const next={...item,owner:rule.scope};delete next.ownerTid;delete next.cardTid;
  if(rule.scope==='actor'){next.ownerTid=item.ownerTid??item.sourceTid;delete next.owner;}
  if(rule.scope==='target')next.targetIndex=item.targetIndex??0;else delete next.targetIndex;
  return next;
}
