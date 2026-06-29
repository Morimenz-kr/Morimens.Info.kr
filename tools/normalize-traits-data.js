const fs = require('fs');

const filePath = 'data/character_effects.json';
const effects = JSON.parse(fs.readFileSync(filePath, 'utf8'));

function decodeHtml(text) {
  return String(text)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeName(name) {
  return decodeHtml(name)
    .replace(/^\d+(?:\.\d+)*\.\s*특성(?:\[편집\])?\s*/u, '')
    .replace(/^특성(?:\[편집\])?\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEffect(effect) {
  let normalized = decodeHtml(effect)
    .replace(/고정\s*피해\[고정피해\]/g, '[고정피해]')
    .replace(/촉수\s*피해\[촉수피해\]/g, '[촉수피해]')
    .replace(/중독\[중독\]/g, '[중독]')
    .replace(/인내\[인내\]/g, '[인내]')
    .replace(/보존\[보존\]/g, '[보존]')
    .replace(/준비1\[준비1\]/g, '[준비1]')
    .replace(/영감\[영감\]/g, '[영감]')
    .replace(/희생\[희생\]/g, '[희생]')
    .replace(/배아 융합\[배아융합\]/g, '[배아융합]')
    .replace(/포식\[포식\]/g, '[포식]')
    .replace(/강탈\[강탈\]/g, '[강탈]')
    .replace(/침식\[침식\]/g, '[침식]')
    .replace(/배아\[배아\]/g, '[배아]')
    .replace(/소모\[소모\]/g, '[소모]')
    .replace(/여파\[여파\]/g, '[여파]')
    .replace(/출혈\[출혈\]/g, '[출혈]')
    .replace(/죄의 낙인\[죄의낙인\]/g, '[죄의낙인]')
    .replace(/운명 재단\[운명재단\]/g, '[운명재단]')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const duplicatedLinks = [
    ['반격', '반격'],
    ['죽음 저항', '죽음저항'],
    ['도취', '도취'],
    ['꿈의 유혹', '꿈의유혹'],
    ['활염', '활염'],
    ['연소', '연소'],
    ['희생', '희생'],
    ['운명의 계약', '운명의계약'],
    ['강생 의식', '강생의식'],
    ['요새화', '요새화'],
    ['관통 피해', '관통피해'],
    ['발견', '발견'],
    ['창의', '창의'],
    ['번식·배아', '번식배아'],
    ['번식 광란', '번식광란'],
    ['소멸', '소멸'],
    ['워프', '워프'],
    ['공감', '공감'],
    ['차원 이동', '차원이동'],
    ['초차원 공간', '초차원공간']
  ];

  for (const [label, keyword] of duplicatedLinks) {
    normalized = normalized.replaceAll(`${label}[${keyword}]`, `[${keyword}]`);
  }

  return normalized
    .replace(/\[\d+\]/g, '')
    .trim();
}

for (const character of Object.values(effects)) {
  if (!Array.isArray(character.traits)) continue;

  for (const trait of character.traits) {
    trait.name = normalizeName(trait.name);
    trait.effect = normalizeEffect(trait.effect);
  }
}

const pontos = effects.pontos;
if (pontos) {
  const eternalDarkness = (pontos.traits || []).find((trait) => trait.name === '영원한 어둠의 땅');
  if (eternalDarkness) {
    eternalDarkness.effect = "폰토스가 팀에 존재할 때, '심해' 영역을 '[회명 · 심해]' 영역으로 대체한다.";
  }

  const skillByName = new Map((pontos.skills || []).map((skill) => [skill.name, skill]));

  const raid = skillByName.get('요마 습격');
  if (raid) {
    raid.effect = '모든 적에게 반드시 치명타로 적중하는 공격력 n%의 피해를 입히고, 광기를 n 얻는다. X회 추가로 발동한다.';
    raid.levels = [
      { level: 1, '피해': '30%', '광기': '3' },
      { level: 2, '피해': '36%', '광기': '4' },
      { level: 3, '피해': '42%', '광기': '5' },
      { level: 4, '피해': '48%', '광기': '6' },
      { level: 5, '피해': '54%', '광기': '7' },
      { level: 6, '피해': '60%', '광기': '8' }
    ];
  }

  const horn = skillByName.get('건트지기의 호각');
  if (horn) {
    horn.effect = '이번 전투에서 처음 사용할 경우, 방어력 n%의 방어막을 획득하고, 3종류의 서로 다른 건트를 생성하여 패에 넣고, 보유한 영구 건트 4장마다 그 중 1장이 쌍생 건트로 업그레이드된다. 그렇지 않을 경우, 건트 3장을 뽑는다. 준비1, 보존.';
    horn.levels = [
      { level: 1, '방어막': '30%' },
      { level: 2, '방어막': '36%' },
      { level: 3, '방어막': '42%' },
      { level: 4, '방어막': '48%' },
      { level: 5, '방어막': '54%' },
      { level: 6, '방어막': '60%' }
    ];
    horn.linked_level_targets = ['약탈의 건트', '교란의 건트', '사냥의 건트'];
  }

  const hunt = skillByName.get('끝없는 사냥');
  if (hunt) {
    hunt.effect = '자신의 힘 감소 상태를 해제하고, 모든 적의 힘을 임시로 방어력 n% 감소시킨다. HP가 가장 낮은 적에게 [촉수피해]의 n%에 해당하는 [고정피해]를 입히고, 해당 적을 처치할 경우 건트 1장을 영구적으로 생성하여 패에 넣는다. 한 전투 당 최대 3장까지 생성할 수 있다.';
    hunt.levels = [
      { level: 1, '힘 감소': '18%', '피해량': '3000%' },
      { level: 2, '힘 감소': '21.6%', '피해량': '3600%' },
      { level: 3, '힘 감소': '25.2%', '피해량': '4200%' },
      { level: 4, '힘 감소': '28.8%', '피해량': '4800%' },
      { level: 5, '힘 감소': '32.4%', '피해량': '5400%' },
      { level: 6, '힘 감소': '36%', '피해량': '6000%' }
    ];
    hunt.linked_level_targets = ['약탈의 건트', '교란의 건트', '사냥의 건트'];
  }

  const plunderGaunt = skillByName.get('약탈의 건트');
  if (plunderGaunt) {
    plunderGaunt.levels = [
      { level: 1 },
      { level: 2 },
      { level: 3 },
      { level: 4 },
      { level: 5 },
      { level: 6 }
    ];
  }

  const disruptionGaunt = skillByName.get('교란의 건트');
  if (disruptionGaunt) {
    disruptionGaunt.effect = '모든 적의 힘을 임시로 방어력 n% 감소시키고, [촉수피해]가 공격력 n% 증가한다.';
    disruptionGaunt.levels = [
      { level: 1, '힘 감소': '5%', '촉수 피해': '7.5%' },
      { level: 2, '힘 감소': '6.5%', '촉수 피해': '9%' },
      { level: 3, '힘 감소': '8%', '촉수 피해': '10.5%' },
      { level: 4, '힘 감소': '9.5%', '촉수 피해': '12%' },
      { level: 5, '힘 감소': '11%', '촉수 피해': '13.5%' },
      { level: 6, '힘 감소': '12.5%', '촉수 피해': '15%' }
    ];
  }

  const huntingGaunt = skillByName.get('사냥의 건트');
  if (huntingGaunt) {
    huntingGaunt.effect = 'HP가 가장 낮은 적에게 [촉수피해]의 n%에 해당하는 [고정피해]를 입힌다. 폰토스의 기본 크리티컬 피해의 15%에 해당하는 임시 크리티컬 피해를 얻는다.';
    huntingGaunt.levels = [
      { level: 1, '피해량': '1000%' },
      { level: 2, '피해량': '1200%' },
      { level: 3, '피해량': '1400%' },
      { level: 4, '피해량': '1600%' },
      { level: 5, '피해량': '1800%' },
      { level: 6, '피해량': '2000%' }
    ];
  }
}

if (effects.doll_inferno) {
  effects.doll_inferno.traits = [
    {
      name: '소멸의 길',
      effect: "보스 전투에서, 턴 시작 시와 융해 · 돌이 광기 폭발을 발동한 후 '종말' 1스택을 획득한다. '종말'은 최대 10스택까지 보유할 수 있으며, 10스택에 도달하면 '허무의 종언' 1장을 손패에 추가한다."
    },
    {
      name: '광기의 징조',
      effect: '탐색 시작 후, 5 ~ 60 광기를 획득한다.',
      level_range: 'Lv. 1 ~ 12'
    },
    {
      name: '영혼 단련',
      effect: "이 특성은 [성신편] 스테이지에서만 유효하다.\n이 각성체의 체력, 공격, 방어가 3 ~ 30% 증가하고, 이 각성체가 처음으로 영지 각성을 사용한 후 은열쇠 에너지를 50 ~ 500 획득한다.\n탐색 시작 후, 모든 각성체가 생성하는 [중독], [반격], 기본 피해가 5 ~ 15% 증가한다.",
      level_range: 'Lv. 1 ~ 10'
    }
  ];
}

if (effects.doresain) {
  effects.doresain.traits = [
    {
      name: '유해의 관',
      effect: "도어세인이 적을 처치하거나 광기 폭발을 사용해 보스에게 피해를 입히면 '유해'를 1스택 획득한다. '유해'는 최대 3스택 축적할 수 있으며, 다음 전투로 이어진다."
    },
    {
      name: '부패한 연회의 은총',
      effect: "도어세인이 '유해'를 획득하면 '영원한 밤의 향연' 1장을 손패에 추가한다."
    },
    {
      name: '광기의 징조',
      effect: '탐색 시작 후, 5 ~ 60 광기를 획득한다.',
      level_range: 'Lv. 1 ~ 12'
    },
    {
      name: '영혼 단련',
      effect: "이 특성은 [별의 장] 스테이지에서만 유효하다.\n이 각성체의 체력, 공격, 방어가 3 ~ 30% 증가하고, 이 각성체가 처음으로 영지 각성을 사용한 후 50 ~ 500 은열쇠 에너지를 획득한다.\n모든 각성체가 획득하는 힘이 5 ~ 15% 증가한다.\n도어세인이 '언데드' 적을 처치할 때, 30 ~ 50 광기를 획득한다.",
      level_range: 'Lv. 1 ~ 10'
    }
  ];
}

fs.writeFileSync(filePath, `${JSON.stringify(effects, null, 2)}\n`);
