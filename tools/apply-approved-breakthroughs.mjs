import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'character_effects.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const specs = {
  nautila: [
    { stage: 1, target: '타격', append: '공격력 n%의 반격을 획득한다.', values: ['15%', '18%', '21%', '24%', '27%', '30%'], valueKey: '반격' },
    { stage: 2, target: '고열구역 출입금지', append: '준비1' },
    { stage: 3, target: '출전 준비 완료', append: '고정 피해가 50% 증가하고, 1턴 동안 손상, 허약, 취약 상태에 면역이 된다.' }
  ],
  ryker: [
    { stage: 1, target: '의외의 수확', append: '크리티컬이 발생하면 선택한 카드의 산출력 소모가 추가로 1 감소한다.' },
    { stage: 1, target: '승부의 순간', append: '크리티컬이 발생할 때마다 추가로 3 광기를 획득한다.' },
    { stage: 3, target: '무모한 도박', append: '검은 인장 1개를 소모할 때마다 이번 탐색에서 이 카드의 기본 피해가 0.5% 증가한다.' },
    { stage: 3, target: '타격', append: '산출력이 부족할 경우 검은 인장 3개를 소모하여 2회 발동할 수 있다.' },
    { stage: 3, target: '방어', append: '산출력이 부족할 경우 검은 인장 3개를 소모하여 2회 발동할 수 있다.' }
  ],
  lily: [
    { stage: 1, target: '금지된 검은 늪', append: '현재 HP가 50% 미만이면 추가로 1회 방어막을 획득하고, 부여하는 중독이 2배로 증가한다.' },
    { stage: 2, target: '보복의 일격', append: '준비1이 준비2로 강화되며, 기본 피해와 크리티컬 확률이 20% 증가한다.' },
    { stage: 3, target: '시들지 않는 진흙 속의 꽃', append: '제거하는 인내가 절반으로 감소한다.' },
    { stage: 3, target: '보복의 일격', append: '제거하는 인내가 절반으로 감소한다.' }
  ],
  mouchette: [
    { stage: 2, target: '필멸의 폭발', append: '마지막으로 사용한 다른 타격 카드의 임시 복사본 1장을 손패에 추가하고, 산출력 소모가 1 감소한다.' },
    { stage: 3, target: '샤이닝☆토네이도', append: '이번 턴 무셰트가 입히는 피해 횟수가 1 증가한다.' }
  ],
  doll_inferno: [
    { stage: 1, target: '자폭 개조', append: '흥분을 선택하면 모든 적에게 1턴 취약을 부여하고, 저주를 선택하면 모든 적에게 1턴 허약을 부여한다.' },
    { stage: 2, target: '종점, 진리와 심연의 문', append: '부여하는 기본 중독이 50% 증가하며, 종말 1스택마다 추가로 15% 증가한다.' },
    { stage: 2, target: '운명의 붕괴', append: '부여하는 기본 중독이 50% 증가하며, 종말 1스택마다 추가로 15% 증가한다.' },
    { stage: 3, target: '타격', append: '추가로 광기 상한 5%의 광기를 획득한다.' },
    { stage: 3, target: '방어', append: '추가로 광기 상한 5%의 광기를 획득한다.' },
    { stage: 3, target: '허무의 종언', create: { type: '명령', cost: { type: '산출력', value: 0 }, effect: '모든 적에게 최대 HP 25%의 고정 피해를 입힌다. 사용 후 「종점, 진리와 심연의 문」과 「운명의 붕괴」가 종말 형태로 변경된다. 소모' }, effect: '모든 적에게 최대 HP 30%의 고정 피해를 입히고, 잃은 HP의 30%를 회복한다. 사용 후 「종점, 진리와 심연의 문」과 「운명의 붕괴」가 종말 형태로 변경된다. 소모' }
  ],
  alva: [
    { stage: 1, target: '임전 태세', append: '이 카드는 방어로 간주된다.' },
    { stage: 2, target: '무한한 정의', append: '뽑는 카드 수가 1 증가한다.' },
    { stage: 3, target: '무한한 정의', append: '발동 시 엘바의 임시 크리티컬 확률과 크리티컬 피해가 50% 증가한다.' }
  ],
  lotan_cetarchon: [
    { stage: 1, target: '타격', append: '크리티컬 확률이 10% 증가하고 기본 피해가 20% 증가한다. 침식·로탄 자신, 명륜 및 비밀 계약의 검은 인장 드롭률 1%마다 크리티컬 확률이 추가로 0.5%, 기본 피해가 추가로 1% 증가한다.' },
    { stage: 2, target: '타격', append: '매 턴 처음 사용할 때 「단검·식」 1장을 뽑는다.' },
    { stage: 2, target: '방어', append: '매 턴 처음 사용할 때 「장검·낙」 1장을 뽑는다.' },
    { stage: 3, target: '경계를 베는 검', append: '「대검·고래 낙하」로 획득하는 피해 보너스가 75%에서 150%로 증가한다.' },
    { stage: 3, target: '침멸', append: '매 턴 처음 사용할 때 산출력을 소모하지 않는다.' }
  ],
  karen: [
    { stage: 1, target: '은밀한 헌신', append: '최대 중첩 횟수가 3회로 증가한다.' },
    { stage: 2, target: '개구리 스튜', append: '중독과 HP 회복량이 50% 증가한다.' },
    { stage: 3, target: '기묘한 요리', effect: '산출력 1을 획득한다. 3회 사용 가능하다. 50% 확률로 신기한 긍정 효과가 발동한다. 유지. 소모.\n- 자신이 10 광기를 획득한다.\n- 다른 각성체가 5 광기를 획득한다.\n- 모든 적에게 1턴 취약을 부여한다.\n- 모든 적에게 1턴 허약을 부여한다.\n- 카드를 1장 뽑는다.\n- 은열쇠 에너지를 200 획득한다.' }
  ],
  'kathigu-ra': [
    { stage: 1, target: '타격', append: '기본 피해와 획득하는 광기가 50% 증가한다.' },
    { stage: 1, target: '방어', append: '기본 방어막과 획득하는 광기가 50% 증가한다.' },
    { stage: 2, target: '테라 플레어', append: '활염 3스택을 보유한 경우 기본 피해가 50% 증가한다.' },
    { stage: 2, target: '마지막 총성', append: '활염 3스택을 보유한 경우 획득하는 힘이 공격력 3% 증가한다.' }
  ],
  tawil: [
    { stage: 1, target: '시공을 가르는 날개', append: '영감 1장을 손패에 추가한다.' },
    { stage: 2, target: '만물귀일', effect: '은열쇠 에너지를 n 획득한다. 현재 영역의 스킬 카드 5장을 발견하고, 최대 3장을 선택해 손에 넣고 타비의 카드로 간주한다. 이 카드들은 소모, 준비1 및 유지를 획득한다. 다음에 사용하는 타비의 명령 카드가 2회 발동한다. 이번 턴 동안 자신의 명령 카드가 주는 최종 피해가 15% 증가한다.' },
    { stage: 3, target: '타격', append: '사용 시 타비의 크리티컬 확률과 크리티컬 피해가 3% 증가하며, 최대 30%까지 증가한다.' },
    { stage: 3, target: '방어', append: '사용 시 타비의 크리티컬 확률과 크리티컬 피해가 3% 증가하며, 최대 30%까지 증가한다.' },
    { stage: 3, target: '과거의 메아리', create: { type: '버프', cost: { type: '산출력', value: 0 }, effect: '현재 HP와 실드를 이전 턴 종료 시점의 상태로 되돌린다. 유지. 소모.' }, effect: '현재 HP와 실드를 이전 턴 종료 시점의 상태로 되돌린다. 유지. 소모.' }
  ],
  pandia: [
    { stage: 1, target: '타격', append: '입힌 피해의 50%에 해당하는 임시 반격을 획득한다.' },
    { stage: 1, target: '방어', append: '공격력 n%의 반격을 획득한다.' },
    { stage: 2, target: '뜨거운 밀랍의 욕망', effect: '반격을 공격력 n% 획득한다. 모든 적의 힘을 공격력 n% 강탈한다. 모든 적의 반격을 제거한다. 20 광기를 획득한다. 유지' },
    { stage: 3, target: '꿀빛 비극의 환상', append: '기본 피해가 2배로 증가하고, 공격력 n%의 반격을 획득한다.' }
  ],
  hameln: [
    { stage: 1, target: '타격', append: '공격력 15%의 임시 힘을 획득한다. 선율 효과가 발동한 경우 획득하는 임시 힘이 2배가 된다.' },
    { stage: 1, target: '방어', append: '공격력 15%의 임시 힘을 획득한다. 선율 효과가 발동한 경우 획득하는 임시 힘이 2배가 된다.' },
    { stage: 3, target: '영혼의 서곡', append: '선율 효과 또는 「협주의 교향」을 총 10회 발동할 때마다 이번 전투에서 피해 횟수가 1 증가하며, 최대 3회 증가한다.' },
    { stage: 3, target: '원초의 음률', append: '선율 효과 또는 「협주의 교향」을 총 10회 발동할 때마다 이번 전투에서 피해 횟수가 1 증가하며, 최대 3회 증가한다.' },
    { stage: 3, target: '협주의 교향', append: '사용 후 하멜른의 크리티컬 확률과 크리티컬 피해가 1% 증가한다.' }
  ],
  ramona_timeworn: [
    { stage: 3, target: '패러독스 수렴', append: '잠금 해제된 은열쇠 중 1개를 선택하여, 사용하거나 전투 종료 시까지 현재 은열쇠를 대체한다.' }
  ],
  goliath: [
    { stage: 1, target: '참수의 일격', append: '촉수 1개마다 힘 보너스 효과가 1배수씩 추가로 증가한다.' },
    { stage: 2, target: '강자의 법칙', effect: '공격력 n%의 힘을 획득한다. 모든 적의 힘을 임시로 모두 제거하고, 제거한 만큼의 임시 힘을 획득한다.' },
    { stage: 3, target: '해연의 힘', append: '찬탈: 골리아의 임시 크리티컬 확률이 25% 증가한다.\n- 잠복: 골리아가 25 광기를 획득한다.' }
  ],
  coporsant: [
    { stage: 1, target: '타격', effect: '공격력 n%의 피해를 입히고, n 광기를 획득한다. 여파: 다음에 사용할 때 획득하는 광기가 5 증가하며, 최대 2회 중첩된다.', values: ['10','11','12','13','14','15'], valueKey: '광기' },
    { stage: 1, target: '방어', effect: '방어력 n%의 방어막을 획득하고, n 광기를 획득한다. 여파: 다음에 사용할 때 획득하는 광기가 5 증가하며, 최대 2회 중첩된다.', values: ['10','11','12','13','14','15'], valueKey: '광기' },
    { stage: 2, target: '혼돈의 깃발 신호', append: '모든 적에게 1턴 허약을 부여한다.' },
    { stage: 2, target: '항해', append: '촉수 1개마다 이 카드의 방어막, 힘 및 촉수 피해가 5% 증가하며, 최대 50% 증가한다.' },
    { stage: 3, target: '심해를 비추는 인도', effect: '방어력 n%의 방어막을 획득하고, 임시 촉수 3개를 생성한다. 모든 적에게 1턴 취약을 부여한다. 임시 크리티컬 피해가 30% 증가하고, 이번 전투에서 죽음 저항이 발동한 횟수마다 추가로 15% 증가한다. 모든 손패를 버리고 같은 수의 카드를 뽑는다.' }
  ],
  murphy: [
    { stage: 1, target: '레무리아의 역류', effect: '모든 적에게 공격력 n%의 피해를 입히고, 1턴 허약과 취약을 부여한다. 이 피해는 n%의 촉수 피해 보너스가 적용되며, 촉수 2개마다 추가로 1회 피해를 입힌다. 희생의 n%를 제거한다. 유지' },
    { stage: 2, target: '타격', append: '촉수 피해가 공격력 n% 증가한다.' },
    { stage: 2, target: '방어', append: '촉수 피해가 공격력 n% 증가한다.' }
  ],
  miryam: [
    { stage: 3, target: '타격', baseEffect: '공격력 n%의 피해를 입히고, 100%의 촉수 피해 보너스가 적용된다. n 광기를 획득한다. 제의: 최종 피해가 100%/250%/500% 증가한다.', append: '제의 효과가 30% 증가한다.' },
    { stage: 3, target: '방어', append: '제의 효과가 30% 증가한다.' },
    { stage: 1, target: '무상의 제례', effect: '공격력 n%의 관통 피해를 입히고, n%의 중독을 부여한다. 임시 크리티컬 피해가 미리암의 기본 크리티컬 피해의 15%만큼 증가한다. 제의: 공격력 l%/m%/n%의 힘을 획득하고, 촉수 피해가 공격력 l%/m%/n% 증가한다.' },
    { stage: 3, target: '무상의 제례', effect: '공격력 n%의 관통 피해를 입히고, n%의 중독을 부여한다. 임시 크리티컬 피해가 미리암의 기본 크리티컬 피해의 15%만큼 증가한다. 제의: 공격력 l%/m%/n%의 힘을 획득하고, 촉수 피해가 공격력 l%/m%/n% 증가한다.' },
    { stage: 2, target: '선택받은 자', effect: '다른 각성체 1명을 선택하여 n 광기를 부여한다. 영역 숙련을 20 획득한다. 제의: 추가로 10/25/50 광기를 부여한다. 유지, 준비1' },
    { stage: 3, target: '선택받은 자', effect: '다른 각성체 1명을 선택하여 n 광기를 부여한다. 영역 숙련을 20 획득한다. 제의: 추가로 13/33/65 광기를 부여한다. 유지, 준비1' },
    { stage: 3, target: '깊은 심연에 기도를', append: '각 성례를 집착으로 전환할 때마다 이번 전투에서 이 카드가 부여하는 기본 중독이 공격력 15% 증가한다.' }
  ],
  arachne: [
    { stage: 1, target: '운명, 이로써 고하노라', append: '아라크네 자신, 장비한 명륜 및 비밀 계약의 영역 숙련 1마다 임시 피해 증폭 증가량이 추가로 0.25% 증가한다.' }
  ],
  doresain: [
    { stage: 3, target: '영원한 밤의 향연', create: { type: '명령', cost: { type: '산출력', value: 0 }, effect: '모든 적에게 공격력 40%의 관통 피해를 입힌다. 소모, 유지' }, effect: '모든 적에게 공격력 120%의 관통 피해를 입힌다. 사용 후 해당 턴 동안 추가로 사용하는 「영원한 밤의 향연」의 힘 계수가 100% 상승한다. 소모, 유지' }
  ],
  horla: [
    { stage: 2, target: '광상의 시편', append: '유지' },
    { stage: 2, target: '애통의 시편', append: '유지' },
    { stage: 2, target: '환몽의 시편', append: '유지' },
    { stage: 2, target: '기묘한 시편', append: '유지' }
  ]
};

function findTarget(character, name) {
  return [...(character.skills || []), ...(character.derivedCards || [])].find(item => item.name === name);
}

function cleanKey(key, stage) {
  return key
    .replace(/^\*/, '')
    .replace(new RegExp(`\\s*\\((?:돌파${stage}|${stage}돌파)\\)\\s*`), '')
    .trim();
}

function stageLevels(skill, stage) {
  if (!skill.levels?.length) return undefined;
  return skill.levels.map(level => {
    const result = {};
    for (const [key, value] of Object.entries(level)) {
      if (key === 'level' || !/돌파/.test(key)) result[key] = value;
    }
    for (const [key, value] of Object.entries(level)) {
      if (new RegExp(`(?:돌파${stage}|${stage}돌파)`).test(key)) result[cleanKey(key, stage)] = value;
    }
    return result;
  });
}

for (const [characterId, entries] of Object.entries(specs)) {
  const character = data[characterId];
  if (!character) throw new Error(`캐릭터를 찾을 수 없음: ${characterId}`);
  for (const entry of entries) {
    let target = findTarget(character, entry.target);
    if (!target && entry.create) {
      target = { ...entry.create, name: entry.target };
      character.derivedCards ||= [];
      character.derivedCards.push(target);
    }
    if (!target) throw new Error(`대상을 찾을 수 없음: ${characterId} / ${entry.target}`);
    if (entry.baseEffect) target.effect = entry.baseEffect;
    const variant = { stage: entry.stage };
    if (entry.effect) variant.effect = entry.effect;
    if (entry.append) variant.append = entry.append;
    if (entry.values) {
      variant.levels = target.levels.map((level, index) => ({ ...level, [entry.valueKey]: entry.values[index] }));
    } else {
      const levels = stageLevels(target, entry.stage);
      if (levels) variant.levels = levels;
    }
    target.breakthroughs = [
      ...(target.breakthroughs || []).filter(item => Number(item.stage) !== Number(entry.stage)),
      variant
    ].sort((left, right) => Number(left.stage) - Number(right.stage));
  }
}

const miryamRitual = findTarget(data.miryam, '무상의 제례');
for (const variant of miryamRitual.breakthroughs || []) {
  const sourceLevels = miryamRitual.levels;
  variant.levels = sourceLevels.map(level => {
    const amplified = variant.stage === 3 ? level['*힘과 촉수 피해 (돌파3)'] : level['힘과 촉수 피해'];
    return {
      level: level.level,
      피해: level.피해,
      중독: level.피해,
      힘: amplified,
      '촉수 피해': amplified
    };
  });
}

fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
const linkedCardCount = Object.values(data).reduce((count, character) => (
  count + [...(character.skills || []), ...(character.derivedCards || [])]
    .reduce((sum, item) => sum + (item.breakthroughs?.length || 0), 0)
), 0);
console.log(`승인 돌파 규칙 ${Object.values(specs).flat().length}건 적용, 전체 카드 연결 ${linkedCardCount}건`);
