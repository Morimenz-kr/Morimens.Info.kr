// Input adapter only. The original spawner, role constructor and state programs still execute.
export const enemySpawnInputLua=`
local choices=scarecrow_input.init.enemySnapshots
local Spawner=require('Battle.DbgEngine.MonsterSpawner.BattleMonsterSpawnerMgr')
local original=Spawner.Spawn
local used={}
scarecrow_enemy_input_trace={}
Spawner.Spawn=function(self,...)
 local manager=self.battleEngine.roleMgr
 if not manager.scarecrowEnemyInputs then
  manager.scarecrowEnemyInputs=true
  local create=manager.SpawnMonster
  manager.SpawnMonster=function(m,dto)
   for index,choice in ipairs(choices) do
    if not used[index] and dto.tid==choice.tid and dto.battleFieldPos==choice.point then
     for key,value in pairs(choice.properties) do dto.properties[key]=value end
     if choice.level then dto.level=choice.level end
     scarecrow_enemy_input_trace[#scarecrow_enemy_input_trace+1]={tid=dto.tid,point=dto.battleFieldPos,level=dto.level,atk=dto.properties.atk,def=dto.properties.def}
     used[index]=true
     break
    end
   end
   return create(m,dto)
  end
 end
 return original(self,...)
end
`;
