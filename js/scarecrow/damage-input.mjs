import {levelStage} from './level-stage.mjs';
import {researchTeamHp} from './account-growth.mjs';
export async function makeDamageInput({catalog,call,party,chapter,accountLevel,actor,skill,skillLevel,keeper=0,relics=[],seed=12345}){
 if(party.length!==4||new Set(party.map(p=>p.tid)).size!==4)throw new Error('서로 다른 각성체 네 명을 선택하세요.');
 const builds=[],members=[],preparedStates=[];
 for(const p of party){
  const c=catalog.characters.find(c=>c.id===p.tid);if(!c)throw new Error('파티 캐릭터를 확인하세요.');
  for(const w of p.equipment?.weapons??(p.weapon?[{attributes:p.equipment?.weaponAttributes||{}}]:[]))if(!['atk','def','physique'].every(k=>k in (w.attributes||{}))&&!['atk','def','physique'].every(k=>k in p.override))throw new Error(`${c.name}: 장착한 각 명륜의 공격·방어·체질 또는 게임 표시 최종 능력치 세 항목을 입력하세요.`);
  const b=await call('build',{chapter,tid:p.tid,level:p.level,breakthrough:levelStage(c,p.level),talentTid:c.talents[0]?.id||0,talentLevel:p.talent,soulTrainingLevel:p.soulTraining,madnessLevel:p.madness||0,potencyIndex:p.potency,weapon:p.weapon,refinement:p.refinement,suits:p.suit?[{id:p.suit,count:p.suitCount}]:[],...p.equipment,finalProperties:p.override});
  builds.push(b);members.push({tid:p.tid,level:p.level,slots:c.skills.map(tid=>({tid,level:p.tid===party[actor].tid&&tid===skill?skillLevel:(p.skillLevels?.[tid]??p.cardLevel)})),attrs:{...b.combatProperties,...p.override},potencyLevel:b.potencyLevel,breakSkillLevel:b.breakSkillLevel,talents:b.talents,stageTalentStates:b.soulTraining.stateIds,talent_attr_lv:p.talent,physique_extra:0,atk_extra:0,def_extra:0});
  for(const s of Array.isArray(b.states)?b.states:[])preparedStates.push({id:s.id,layers:s.layers,params:s.params??null,scope:s.targetScope??null,ownerTid:s.owner==='player'?0:p.tid,casterTid:s.caster==='player'?0:p.tid});
 }
 const team=await call('team',{members}),hp=researchTeamHp(builds,accountLevel,catalog.accountGrowth);
 const input={prepareSchoolStageStates:'original-active-roots-once',prepareAwakerStageStates:'original-active-roots-once',prepareAwakerPassiveStates:'original-selected-roots-once',prepareWeaponStageStates:true,expressionProfile:'original-runtime-load',uiMetadata:true,preparedStates,
 init:{gameplayType:1,playerLevel:accountLevel,battleTid:8259,stageId:8191,difficultyId:0,randomseed:seed,cards:[{uid:1000000,tid:skill,level:skillLevel,deck:'HandDeck'}],backupAwakeCards:members.flatMap(m=>m.slots.filter(s=>catalog.skills[String(s.tid)]?.slot==='Slot_Awake')),relics:relics.map((tid,index)=>({tid,uid:2000000+index,camp:1,stateUids:[],stateUid2TargetUid:{},descArgs:[]})),stateList:[],statistics:{},skipTimer:true,isMock:true,roleData:members,copyProperties:{...team.commonProperties,hp:hp.hp,max_hp:hp.hp,atk:team.atk,energy:100,death_resist:hp.remainingDeathResistance},...(keeper?{keeperSkill:keeper}:{}),selectedKeeperSkill:{},unlockedKeeperSkillItems:keeper?[keeper]:[],worldAttrs:{},schoolMap:{},lives:1,gameSpeed:1,coverMonsters:{Monster1:72151,MonsterPoint1:1,MonsterHp1:100000000}},
 damage:{actorTid:party[actor].tid,skillTid:skill,skillLevel,cardUid:1000000,states:[],properties:[],history:[]},actions:[]};
 return {input,builds,team,hp};
}
