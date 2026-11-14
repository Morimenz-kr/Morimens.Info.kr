// Host adapter only: all card effects, costs, triggers and state lifetimes remain native.
export const sequenceCalculatorLua=String.raw`
local input=scarecrow_input
local bc=require('Battle.BattleConst')
scarecrow_sequence_step=function(e,action)
 local step=action.sequenceStep;if not step then return end
 local player=e.roleMgr:GetPlayer(bc.BattleCamp.Camp1)
 local actor;local enemies={}
 for _,role in ipairs(e.roleMgr:GetRoleList()) do
  if role.tid==step.actorTid and role.camp==1 then actor=role end
  if role.camp==2 and role:GetProperty('hp')>0 then enemies[#enemies+1]=role.uid end
 end
 assert(actor,'각성체를 확인하세요.')
 local d={actorTid=step.actorTid,skillTid=step.skillTid,skillLevel=step.level,ultimate=step.ultimate,critical=step.critical,cardCost=step.cost}
 if step.ultimate then
  action.roleUid=actor.uid
  if step.rage~=nil then actor.property:SetPropertySilent('ulti_energy',step.rage)
  elseif step.initial then actor.property:SetPropertySilent('ulti_energy',actor:GetUltiCost()) end
 else
  local card=step.initial and e:GetObj(1000000) or e.cardMgr:CreateCardByInfo({tid=step.skillTid,level=step.level,camp=actor.camp,deck=bc.CardDeck.HandDeck,owner=actor})
  assert(card,'카드를 확인하세요.');action.cardUid=card.uid;d.cardUid=card.uid
  if step.flame~=nil then
   e:RunEffectOrder(function()
    local old={};for _,s in ipairs(e.stateMgr:GetStateListByOwnerUid(card.uid) or {}) do if s.stateId==98466 or s.stateId==98470 or s.stateId==98468 then old[#old+1]=s end end
    for _,s in ipairs(old) do e.stateMgr:RemoveState(s) end
    if step.flame>0 then e.stateMgr:CreateState(card,{stateId=({98466,98470,98468})[step.flame],layer=1,castRoleUid=player.uid,source={},skillLevel=step.level}) end
   end,{})
  end
 end
 input.damage=d
 if action.measureStart then
  local stats=e.statsMgr.typeToStats.CurBoutStats
  scarecrow_sequence_statistics={used=stats.UsedCardCount,ulti=stats.UltiSkillCount}
 end
 if step.target=='FrontEnemy' then action.targetUids={enemies[1]}
 elseif step.target=='AllEnemy' or step.target=='AllEnemy2' then action.targetUids=enemies
 elseif step.target=='CmdCaster' then action.targetUids={actor.uid}
 elseif step.target=='PlayerRole' then action.targetUids={player.uid} end
end
local f=assert(io.open('/damage-calculator.lua','rb'));local source=f:read('*a');f:close()
local before='for index,action in ipairs(input.actions or {}) do if action.measureStart then'
local first,last=source:find(before,1,true);assert(first,'Sequence adapter hook changed')
source=source:sub(1,first-1)..'for index,action in ipairs(input.actions or {}) do scarecrow_sequence_step(e,action); if action.measureStart then'..source:sub(last+1)
local result=assert(load(source,'sequence-calculator','t',_ENV))()
result.selectedCardUid=input.damage.cardUid
result.sequenceStatistics=scarecrow_sequence_statistics
return result
`;

export function sequenceStep(person,card,state){
 return {actorTid:person.id,skillTid:card.id,level:card.level??1,ultimate:!!card.ulti,target:card.target,
  ...(state.crit==='치명'?{critical:true}:state.crit==='비치명'?{critical:false}:{}),
  ...(card.costEdited?{cost:card.currentCost}:{}),...(card.ulti&&person.rage!=null?{rage:person.rage}:{}),
  ...(state.flame&&state.flame!=='자동'?{flame:{없음:0,'1단계':1,'2단계':2,'3단계':3}[state.flame]}:{})};
}
export function sequenceInput(base,committed,step){
 if(committed.length>100)throw Error('최대 100장까지 적용할 수 있습니다. 처음 설정으로 돌아가 주세요.');
 const request=structuredClone(base);request.sequence=true;request.damage.preparing=true;
 if(!committed.length){const card=request.init.cards.find(c=>c.uid===1000000);card.tid=step.skillTid;card.level=step.level;}
 const pre=request.actions.filter(a=>!['card','ulti'].includes(a.op));
 const actions=[...committed.map(s=>structuredClone(s)),{step:structuredClone(step),replies:[]}];
 request.actions=pre;
 actions.forEach((entry,index)=>{
  const active={...entry.step,initial:index===0};
  request.actions.push({op:active.ultimate?'ulti':'card',sequenceStep:active,measureStart:index===actions.length-1});
  request.actions.push(...entry.replies);
 });
 return request;
}
