import fs from 'node:fs';
import path from 'node:path';
import { buildMonsterTemplate, resolveMonsterEncounter } from './monster-combat-transformer.mjs';

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith('--') || argv[index + 1] == null) throw new Error(`잘못된 인수: ${key || ''}`);
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
}

function readJsonValue(value) {
  if (!value) return null;
  return value.trim().startsWith('{')
    ? JSON.parse(value)
    : JSON.parse(fs.readFileSync(value, 'utf8'));
}

const args = parseArgs(process.argv.slice(2));
if (!args.raw || !args.monster || !args.out) {
  throw new Error('필수 인수: --raw <추출 디렉터리> --monster <TID> --out <출력 JSON>');
}

const files = {
  monsters: 'Config.MonsterConfig.json',
  skills: 'Config.Skill.json',
  commands: 'Config.Cmd.json',
  states: 'Config.State.json',
  textMonster: 'Text_KR.Text_MonsterConfig.json',
  textSkill: 'Text_KR.Text_Skill.json',
  textState: 'Text_KR.Text_State.json'
};
const tables = Object.fromEntries(Object.entries(files).map(([key, fileName]) => [
  key,
  JSON.parse(fs.readFileSync(path.join(args.raw, fileName), 'utf8')).data
]));
const template = buildMonsterTemplate({ monsterId: Number(args.monster), tables });
const standard = readJsonValue(args.standard);
const result = standard
  ? resolveMonsterEncounter(template, {
    encounterId: args.encounter || '',
    standard,
    runtime: readJsonValue(args.runtime) || {}
  })
  : template;

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);
console.log(`${standard ? '전투 결과' : '몬스터 템플릿'} 생성: ${args.out}`);
