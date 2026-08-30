(() => {
    const TYPE_LABELS = Object.freeze({ Common: '일반', Elite: '엘리트', Boss: '보스' });
    const TYPE_ORDER = Object.freeze({ Common: 0, Elite: 1, Boss: 2 });
    const MONSTER_TAGS = Object.freeze({
        84277: { label: '지배자' },
        84280: { label: '조각가 협회', counters: [{ id: '24', name: '「24」', image: 'images/24-thumb.png', effect: "｢24｣가 입히는 기본 피해가 20 ~ 50% 증가하며, '조각가 협회' 적에게 입히는 최종 피해가 20 ~ 70% 증가한다." }] },
        84283: { label: '미지의 생물' },
        84284: { label: '설원', counters: [{ id: 'helot', name: '히로', image: 'images/Helot-thumb.png', effect: "히로가 '설원' 적에게 입히는 최종 피해가 20 ~ 70% 증가한다." }] },
        84291: { label: '야수', counters: [{ id: 'casiah', name: '카시아', image: 'images/Casiah-thumb.png', effect: "전투 시작 시 '야수' 적이 존재하면, 카시아가 이번 전투에서 획득하는 힘이 20 ~ 50% 증가한다." }] },
        84293: { label: '변이체', counters: [{ id: 'arachne', name: '아라크네', image: 'images/arachne-thumb.png', effect: "아라크네가 부여하는 [운명 재단]이 30 ~ 100% 증가하며, '변이체' 적에게 부여하는 [운명 재단]이 2배가 된다." }] },
        84297: { label: '각성체' },
        84298: { label: '주재자', counters: [{ id: 'mouchette', name: '무셰트', image: 'images/Mouchette-thumb.png', effect: "무셰트가 '주재자' 적에게 입히는 최종 피해가 20 ~ 50% 증가한다." }] },
        84299: { label: '벌레 종족', counters: [{ id: 'clementine', name: '클레멘타인', image: 'images/Clementine-thumb.png', effect: "클레멘타인이 '벌레 종족' 적에게 피해를 입힐 때, 목표에게 입힌 피해량의 50 ~ 100%에 해당하는 [출혈]을 부여한다. 클레멘타인이 매 턴 처음으로 방어막을 생성하거나 HP를 회복할 때, '벌레 종족' 적은 임시로 클레멘타인의 방어력 20 ~ 30%만큼 힘을 잃는다." }] },
        84303: { label: '혈육', counters: [
            { id: 'alva', name: '앨바', image: 'images/Alva-thumb.png', effect: "앨바가 '혈육' 적에게 입히는 최종 피해가 50 ~ 100% 증가한다." },
            { id: 'saya', name: '사야', image: 'images/Saya-thumb.png', effect: "사야가 '혈육' 적에게 부여하는 [침식]이 추가로 50 ~ 100% 증가한다." }
        ] },
        90640: { label: '껍데기', counters: [
            { id: 'saya', name: '사야', image: 'images/Saya-thumb.png', effect: "사야가 파티에 있을 때 '혈육' 영역이 '번식 · 혈육'으로 변경된다. '핏빛 용광로'가 '껍데기' 적에게 부여하는 '핏빛 침식'이 5배로 증가한다." },
            { id: 'caraboo', name: '카라부', image: 'images/caraboo-thumb.png', effect: "카라부가 파티에 있을 때 '혈육' 영역이 '번식 · 혈육'으로 변경된다. '핏빛 용광로'가 '껍데기' 적에게 부여하는 '핏빛 침식'이 5배로 증가한다." }
        ] },
        90641: { label: '권속' },
        90642: { label: '권속' },
        90643: { label: '심해', counters: [{ id: 'coporsant', name: '코퍼산트', image: 'images/Coporsant-thumb.png', effect: "전투 시작 시 모든 적이 받는 촉수 피해가 5 ~ 15% 증가하며, '심해' 적에게는 효과가 2배가 된다. '징벌의 천둥'이 '심해' 적에게 입히는 피해가 50 ~ 100% 증가한다." }] },
        90644: { label: '초차원', counters: [{ id: 'lily', name: '릴리', image: 'images/Lily-thumb.png', effect: "'초차원' 적의 공격을 받은 뒤, 이번 공격으로 잃은 HP의 10 ~ 20%에 해당하는 지연 회복 효과를 획득한다." }] },
        90645: { label: '인간형', counters: [
            { id: 'xu', name: '서', image: 'images/Xu-thumb.png', effect: "[도취]의 각 스택은 '인간형' 적이 입히는 피해를 1% 감소시키고, [도취]가 제거될 때 '인간형' 적의 최대 HP 1%에 해당하는 [고정 피해]를 입힌다." },
            { id: 'faint', name: '파인트', image: 'images/Faint-thumb.png', effect: "파인트의 명령 카드를 사용한 후, '인간형' 적의 힘을 파인트의 공격력 5 ~ 10%만큼 [강탈]하며, 매 턴 최대 3회 발동한다." },
            { id: 'tinct', name: '틴커트', image: 'images/Tinct-thumb.png', effect: "'서서히 퍼지는 선율'을 사용하면 모든 '인간형' 적의 피해를 임시로 10 ~ 20% 감소시키며, 중첩할 수 없다." }
        ] },
        90646: { label: '등불 교회', counters: [
            { id: 'castor', name: '카스토르', image: 'images/Castor-thumb.png', effect: "카스토르가 '등불 교회' 적에게 부여하는 [침식]이 20 ~ 50% 증가한다." },
            { id: 'pollux', name: '폴룩스', image: 'images/Pollux-thumb.png', effect: "피해를 입힐 때, [죄의 낙인]의 효과는 '등불 교회' 적에게 2배가 된다." }
        ] },
        94556: { label: '망령', counters: [{ id: 'doresain', name: '도어세인', image: 'images/Doresain-thumb.png', effect: "도어세인이 '언데드' 적을 처치할 때, 30 ~ 50 광기를 획득한다." }] }
    });
    const MECHANIC_COUNTER_LIBRARY = Object.freeze({
        alva: {
            id: 'alva', name: '앨바', image: 'images/Alva-thumb.png', note: '봉인 해제',
            effect: '「임전 태세」 사용 시 모든 각성체의 봉인 상태를 해제한다.'
        },
        arachne: {
            id: 'arachne', name: '아라크네', image: 'images/arachne-thumb.png', note: '손패 둔화 해제',
            effect: '「운명, 이로써 고하노라」 사용 시 모든 손패의 둔화 상태를 제거한다.'
        },
        karen: {
            id: 'karen', name: '카렌', image: 'images/Karen-thumb.png', note: '손패 둔화 해제',
            effect: '「손님, 천천히 드세요!」 사용 시 손패의 모든 둔화 상태를 제거한다.'
        },
        celeste: {
            id: 'celeste', name: '셀레스트', image: 'images/Celeste-thumb.png', note: '손패 둔화 해제',
            effect: '「순백의 꿈」 사용 시 손패의 둔화 상태를 제거한다.'
        },
        vortice: {
            id: 'vortice', name: '모스', image: 'images/mosk-thumb.png', note: '손패 연소 해제',
            effect: '「심연! 소용돌이! 대포!」 사용 시 손에 있는 모든 카드의 연소 상태를 해제한다.'
        },
        'kathigu-ra': {
            id: 'kathigu-ra', name: '카티구라', image: 'images/Kathigu-Ra-thumb.png', note: '손패 연소 제거',
            effect: '영혼 단련 효과로 턴 시작 시와 버리기 단계 전에 손패의 모든 연소를 제거하고, 제거한 스택마다 폭염 1스택을 획득한다.'
        },
        caraboo: {
            id: 'caraboo', name: '카라부', image: 'images/caraboo-thumb.png', note: '손패 연소 해제',
            effect: '「짜잔☆요정님 등장!」 사용 시 손에 든 모든 카드의 연소 상태를 해제한다.'
        },
        sanga: {
            id: 'sanga', name: '산', image: 'images/Sanga-thumb.png', note: '자신의 손상 해제',
            effect: '「폐쇄적 창작」 사용 후 다음 턴 시작 시 자신의 손상 상태를 해제한다.'
        },
        faint: {
            id: 'faint', name: '파인트', image: 'images/Faint-thumb.png', note: '자신의 손상 해제',
            effect: '「별의 요람」 사용 시 자신의 손상 상태를 해제한다.'
        },
        winkle: {
            id: 'winkle', name: '윙클', image: 'images/Winkle-thumb.png', note: '자신의 손상 해제',
            effect: '「형태 없는 전이」 사용 시 자신의 손상 상태를 해제한다.'
        },
        erica: {
            id: 'erica', name: '에리카', image: 'images/Erica-thumb.png', note: '자신의 손상·허약 해제',
            effect: '「기계 무장-회수」는 자신의 손상을, 「기계 무장-전개」는 자신의 허약 상태를 해제한다.'
        },
        tinct: {
            id: 'tinct', name: '틴커트', image: 'images/Tinct-thumb.png', note: '자신의 손상·허약·취약 해제',
            effect: '「진혼곡」 사용 시 자신의 손상, 허약, 취약 상태를 모두 해제한다.'
        },
        ogier: {
            id: 'ogier', name: '오지에', image: 'images/Ogier-thumb.png', note: '자신의 손상 해제',
            effect: '「일곱 덕목, 미덕의 전승」 사용 시 자신이 손상 상태라면 이를 해제한다.'
        },
        caecus: {
            id: 'caecus', name: '카이커스', image: 'images/Caecus-thumb.png', note: '자신의 허약 해제',
            effect: '「이단의 혈통」 사용 시 자신의 허약 상태를 해제한다.'
        },
        tulu: {
            id: 'tulu', name: '툴루', image: 'images/Tulu-thumb.png', note: '자신의 허약 해제',
            effect: '「레무리아의 재림」 사용 시 자신의 허약 상태를 해제한다.'
        },
        helot: {
            id: 'helot', name: '히로', image: 'images/Helot-thumb.png', note: '자신의 허약·힘 감소 해제',
            effect: '「절망 속의 생존」 사용 시 자신의 허약과 임시 힘 감소 상태를 해제한다.'
        },
        lotan: {
            id: 'lotan', name: '로탄', image: 'images/Lotan-thumb.png', note: '자신의 허약 해제',
            effect: '「혼돈의 짐승」 사용 시 자신의 허약 상태를 해제한다.'
        },
        faros: {
            id: 'faros', name: '파로스', image: 'images/Faros-thumb.png', note: '자신의 취약 해제',
            effect: '「잃어버린 고대의 도시」 사용 시 자신의 취약 상태를 해제한다.'
        },
        leigh: {
            id: 'leigh', name: '레이아', image: 'images/Leigh-thumb.png', note: '자신의 취약 해제',
            effect: '「아첨의 포옹」의 포식 효과가 발동하면 자신의 취약 상태를 해제한다.'
        },
        doll: {
            id: 'doll', name: '돌', image: 'images/Doll-thumb.png', note: '자신의 취약 해제',
            effect: '「이성, 진리와 현실」 사용 시 자신의 취약 상태를 해제한다.'
        }
    });
    const STATUS_COUNTERS = Object.freeze({
        손상: ['sanga', 'faint', 'winkle', 'erica', 'tinct', 'ogier'],
        허약: ['caecus', 'tulu', 'helot', 'erica', 'tinct', 'lotan'],
        취약: ['faros', 'leigh', 'tinct', 'doll'],
        봉인: ['alva'],
        둔화: ['arachne', 'karen', 'celeste'],
        연소: ['vortice', 'kathigu-ra', 'caraboo']
    });
    const MECHANIC_COUNTERS = Object.freeze({
        14075: ['손상'],
        14077: ['손상'],
        65530: ['둔화'],
        72151: ['취약'],
        149109: ['허약', '둔화'],
        149116: ['손상', '둔화'],
        74035: ['허약'],
        13967: ['둔화'],
        118029: ['허약', '취약'],
        22220: ['둔화'],
        65527: ['둔화'],
        149069: ['봉인', '허약'],
        149070: ['손상', '둔화'],
        149103: ['허약', '둔화'],
        149107: ['봉인', '허약']
    });
    const INTENT_ICON_IDS = Object.freeze({
        Intent_Attack: '001', Intent_HeavyAttack: '002', Intent_Debuff: '003',
        Intent_StrongDebuff: '004', Intent_Buff: '005', Intent_StrongBuff: '006',
        Intent_Defence: '007', Intent_AttackDefence: '008', Intent_AttackDebuff: '009',
        Intent_AttackBuff: '010', Intent_DefenceBuff: '011', Intent_DefenceDebuff: '012',
        Intent_Dizzy: '013', Intent_Unknown: '014', Intent_Burst: '015', Intent_Burst2: '015'
    });
    const MECHANIC_DEFINITIONS = Object.freeze([
        { label: '봉인', terms: ['봉인'] },
        { label: '중독', terms: ['중독'] },
        { label: '허약', terms: ['허약'] },
        { label: '실명', terms: ['실명'] },
        { label: '연소', terms: ['활염', '폭염', '연소'] },
        { label: '취약', terms: ['취약'] },
        { label: '출혈', terms: ['출혈'] },
        { label: '기절', terms: ['기절'] },
        { label: '손상', terms: ['손상'] },
        { label: '둔화', terms: ['둔화'] },
        { label: '동결', terms: ['동결', '빙결'] },
        { label: '인지착란', terms: ['인지착란'] }
    ]);
    const DZONE_CARD_TOOLTIPS = Object.freeze({
        '「상처」': '상태 카드 | 상처\n\n사용 시 순수 피해를 받고 카드 1장을 드로우합니다.',
        '「비틀거림」': '상태 카드 | 비틀거림\n\n산출력 2를 소모해 사용할 수 있으며, 별도의 사용 효과는 없습니다.',
        '「질식」': '상태 카드 | 질식\n\n산출력 1을 소모합니다. 턴 종료 시 손에 남아 있으면 중독을 획득합니다.',
        '「다이얼 폭탄」': '상태 카드 | 다이얼 폭탄\n\n손에 있는 동안 이 카드와 산출력 소모가 같은 카드를 사용하면 최대 HP의 8%만큼 순수 피해를 받고, 다른 소모값의 다이얼 폭탄으로 변합니다. 사용 후 산출력 소모와 같은 수만큼 카드를 드로우합니다.',
        '「다이얼식 폭탄」': '상태 카드 | 다이얼 폭탄\n\n손에 있는 동안 이 카드와 산출력 소모가 같은 카드를 사용하면 최대 HP의 8%만큼 순수 피해를 받고, 다른 소모값의 다이얼 폭탄으로 변합니다. 사용 후 산출력 소모와 같은 수만큼 카드를 드로우합니다.',
        '증상: 쇠약': '증상 카드 | 쇠약\n\n턴 종료 시 손에 있으면 자신에게 허약을 1턴간 부여합니다. 사용하면 모든 적에게 허약을 1턴간 부여합니다.',
        '증상: 낙담': '증상 카드 | 낙담\n\n최대 HP의 10%만큼 실드를 획득합니다. 드로우하면 모든 각성체가 광기 3을 잃습니다.',
        '증상: 의심': '증상 카드 | 의심\n\n드로우한 턴에 카드를 3장 이하로 사용하면 다음 턴 시작 시 산출력 2를 추가로 획득합니다.',
        '증상: 망상': '증상 카드 | 망상\n\n최대 HP의 10%를 잃고 산출력 2를 획득합니다.',
        '증상: 망언': '증상 카드 | 망언\n\n카드를 2장 드로우하고 같은 증상 카드 1장을 버린 카드 더미에 넣습니다.',
        '증상: 맹종': '증상 카드 | 맹종\n\n손에 있는 동안 모든 각성체의 치명타 확률이 25% 증가합니다. 턴 종료 시 무작위 증상 카드 1장을 덱에 넣습니다.',
        '증상: 쇼크': '증상 카드 | 쇼크\n\n사용 시 임시 힘을 획득하며, 드로우했을 때 임시 힘이 감소합니다.',
        '증상: 발작': '증상 카드 | 발작\n\n최대 HP의 10%를 잃고 카드를 2장 드로우합니다.',
        '증상: 섬망': '증상 카드 | 섬망\n\n턴 시작 시 덱에 있는 무작위 명령 카드의 복사본으로 변하며 산출력 소모가 3으로 고정됩니다. 턴 종료 시 원래대로 돌아옵니다.',
        '증상: 폐쇄 공포증': '증상 카드 | 폐쇄 공포증\n\n최대 HP의 5%를 잃고, 잃은 수치의 2배만큼 실드를 획득합니다.',
        '증상: 붕괴': '증상 카드 | 붕괴\n\n턴 종료 시 손에 있으면 자신에게 취약을 1턴간 부여합니다. 사용하면 모든 적에게 취약을 1턴간 부여합니다.',
        '증상: 히스테리': '증상 카드 | 히스테리\n\n산출력 1을 획득하고 같은 증상 카드 1장을 버린 카드 더미에 넣습니다.',
        '증상: 광기': '증상 카드 | 광기\n\n최대 HP의 10%를 잃고 모든 각성체가 광기 10을 획득합니다.',
        '증상: 흥분': '증상 카드 | 흥분\n\n드로우한 턴의 종료 시 남은 산출력이 2 이상이면 다음 턴 시작 시 카드를 2장 추가로 드로우합니다.'
    });
    const number = new Intl.NumberFormat('ko-KR');
    let data = null;
    let tooltips = {};
    let selectedWave = 1;
    let selectedAlert = 4;
    let researchLevel = 81;
    let selectedMechanic = '';
    let mechanicCursor = -1;

    const escapeHtml = value => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const gameText = value => String(value ?? '')
        .replace(/<[^:>]+:([^>]+)>/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

    function politeText(value) {
        return gameText(value)
            .replace(/\b(\d+)\s*번\b/g, '$1번')
            .replace(/\b(\d+)\s*턴\b/g, '$1턴')
            .replace(/발생시킨다(?=[.!?]|\s|$)/g, '발생시킵니다')
            .replace(/입힌다(?=[.!?]|\s|$)/g, '입힙니다')
            .replace(/얻는다(?=[.!?]|\s|$)/g, '얻습니다')
            .replace(/넣는다(?=[.!?]|\s|$)/g, '넣습니다')
            .replace(/버린다(?=[.!?]|\s|$)/g, '버립니다')
            .replace(/버리지 않는다(?=[.!?]|\s|$)/g, '버리지 않습니다')
            .replace(/받는다(?=[.!?]|\s|$)/g, '받습니다')
            .replace(/잃는다(?=[.!?]|\s|$)/g, '잃습니다')
            .replace(/남는다(?=[.!?]|\s|$)/g, '남습니다')
            .replace(/돌아간다(?=[.!?]|\s|$)/g, '돌아갑니다')
            .replace(/바뀐다(?=[.!?]|\s|$)/g, '바뀝니다')
            .replace(/준다(?=[.!?]|\s|$)/g, '줍니다')
            .replace(/시킨다(?=[.!?]|\s|$)/g, '시킵니다')
            .replace(/된다(?=[.!?]|\s|$)/g, '됩니다')
            .replace(/한다(?=[.!?]|\s|$)/g, '합니다')
            .replace(/힘 획득\./g, '힘을 획득합니다.');
    }

    function contextualPlainKeywords(value) {
        const text = String(value || '');
        const keywords = [];
        if (/자신을 희생하여/.test(text)) keywords.push('희생');
        if (/「기절」\s*\d+장을 덱/.test(text)) keywords.push('기절');
        if (/(?:최소\s*)?\d+스택(?:을)?\s*보유하고/.test(text)) keywords.push('보유');
        return keywords;
    }

    function dynamicMarkup(description, options = {}) {
        const cleaned = politeText(description || '상세 설명이 없습니다.')
            .replace(/빙결/g, '동결')
            .replace(/\s*\((?:어디든|위치에)\s*(?:관계|상관)\s*없이\)/g, '')
            .replace(/\(\s*\)/g, '')
            .replace(/\s+([,.])/g, '$1')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .replace(/봉인(?=합니다)/g, '봉인\u2060');
        const plainKeywords = [...new Set([
            ...(options.plainKeywords || []),
            ...contextualPlainKeywords(cleaned)
        ])];
        return window.CharacterEffects?.renderRichText
            ? window.CharacterEffects.renderRichText(cleaned, tooltips, { plainKeywords })
            : escapeHtml(cleaned);
    }

    function staticMonster(wave, tid) {
        return wave.monsters.find(monster => monster.tid === tid);
    }

    function summonDefinition(wave, tid) {
        return (wave.summonDefinitions || []).find(monster => monster.tid === tid);
    }

    function alertMonster(wave, tid) {
        return wave.alerts.find(alert => alert.alert === selectedAlert)?.monsters.find(monster => monster.tid === tid);
    }

    function skillById(monster, skillId) {
        return monster.skills.find(skill => skill.id === skillId);
    }

    function monsterSearchText(monster, stats) {
        return [
            monster.nameKo,
            monster.description,
            ...(monster.skills || []).flatMap(skill => [
                skill.name,
                skill.descriptionTemplate,
                stats.resolvedSkills?.[String(skill.id)]?.description
            ]),
            ...(stats.resolvedStates || []).flatMap(state => [state.name, state.description]),
            ...(monster.conditionalActions || []).map(action => action.conditionText)
        ].filter(Boolean).map(gameText).join(' ');
    }

    function monsterSearchDetails(monster, stats) {
        const details = (monster.skills || []).map(skill => ({
            label: skill.name || '행동',
            text: [skill.name, skill.descriptionTemplate, stats.resolvedSkills?.[String(skill.id)]?.description]
                .filter(Boolean).map(gameText).join(' ')
        }));
        details.push(...(stats.resolvedStates || []).map(state => ({
            label: state.name || '특수 규칙',
            text: [state.name, state.description].filter(Boolean).map(gameText).join(' ')
        })));
        return details;
    }

    function searchEntries() {
        return data.waves.flatMap(wave => {
            const alert = wave.alerts.find(item => item.alert === selectedAlert);
            if (!alert) return [];
            const entries = wave.encounters.flatMap(encounter => encounter.members.map(member => {
                const monster = staticMonster(wave, member.tid);
                const stats = alert.monsters.find(item => item.tid === member.tid);
                if (!monster || !stats) return null;
                const summonText = (alert.summonedMonsters || [])
                    .filter(item => item.parentTid === member.tid)
                    .map(item => {
                        const summon = summonDefinition(wave, item.tid);
                        return summon ? `소환 ${monsterSearchText(summon, item)}` : '소환';
                    }).join(' ');
                const structuralText = [
                    stats.phases?.length > 1 ? '다중 체력 체력바' : '',
                    monster.patterns?.some(pattern => pattern.id === 'cycle-2') ? '부활' : '',
                    summonText
                ].filter(Boolean).join(' ');
                const details = monsterSearchDetails(monster, stats);
                if (stats.phases?.length > 1) details.push({ label: `HP ${stats.phases.length}줄`, text: '다중 체력 체력바' });
                if (monster.patterns?.some(pattern => pattern.id === 'cycle-2')) details.push({ label: '부활 후 행동 변화', text: '부활' });
                if (summonText) details.push({ label: '소환 개체', text: summonText });
                return {
                    wave: wave.wave,
                    monsterId: monster.tid,
                    title: monster.nameKo,
                    context: `${TYPE_LABELS[encounter.battleType] || encounter.battleType} 전투`,
                    text: `${monsterSearchText(monster, stats)} ${structuralText}`,
                    details
                };
            }).filter(Boolean));
            return entries;
        });
    }

    function mechanicMatches(label) {
        const definition = MECHANIC_DEFINITIONS.find(item => item.label === label);
        if (!definition) return [];
        const terms = definition.terms.map(term => term.toLowerCase());
        const matches = searchEntries().filter(entry => {
            const haystack = entry.text.toLowerCase();
            return terms.some(term => haystack.includes(term));
        });
        return [...new Map(matches.map(entry => [`${entry.wave}-${entry.monsterId}`, entry])).values()];
    }

    function renderMechanicNavigation() {
        const container = document.getElementById('dzone-mechanic-chips');
        if (!container) return;
        const available = MECHANIC_DEFINITIONS
            .map(definition => ({ label: definition.label, matches: mechanicMatches(definition.label) }))
            .filter(item => item.matches.length);
        if (selectedMechanic && !available.some(item => item.label === selectedMechanic)) {
            selectedMechanic = '';
            mechanicCursor = -1;
        }
        container.innerHTML = available.map(item => `
            <button type="button" data-mechanic="${escapeHtml(item.label)}"
                    aria-pressed="${item.label === selectedMechanic}"
                    aria-label="${escapeHtml(item.label)} 기믹 위치로 이동">
                ${escapeHtml(item.label)}
            </button>`).join('');
    }

    function waveMechanics(wave) {
        const alert = wave.alerts.find(item => item.alert === selectedAlert);
        if (!alert) return [];
        const corpus = wave.monsters.map(monster => {
            const stats = alert.monsters.find(item => item.tid === monster.tid);
            return stats ? monsterSearchText(monster, stats) : '';
        }).join(' ').toLowerCase();
        const mechanics = MECHANIC_DEFINITIONS
            .filter(item => item.terms.some(term => corpus.includes(term.toLowerCase())))
            .map(item => item.label);
        return [...new Set(mechanics)].slice(0, 4);
    }

    function sameSequence(left, right) {
        return Boolean(left && right)
            && left.skillIds.length === right.skillIds.length
            && left.skillIds.every((id, index) => id === right.skillIds[index]);
    }

    function renderIntentIcon(skill) {
        const iconId = INTENT_ICON_IDS[skill?.type] || INTENT_ICON_IDS.Intent_Unknown;
        return `<img class="intent-icon" src="images/dzone/intent/intent_${iconId}.png" alt="" aria-hidden="true" decoding="async">`;
    }

    function renderSequence(monster, stats, pattern, repeats = false) {
        const sequence = pattern.skillIds.map((skillId, index) => {
            const skill = skillById(monster, skillId);
            const resolved = stats.resolvedSkills?.[String(skillId)];
            return `<li class="action-step">
                <div class="action-marker">
                    <span class="flow-step-number">${index + 1}</span>
                    ${renderIntentIcon(skill)}
                </div>
                <div class="action-copy">
                    <strong>${escapeHtml(skill?.name || `행동 ${index + 1}`)}</strong>
                    <p>${dynamicMarkup(resolved?.description || skill?.descriptionTemplate)}</p>
                </div>
            </li>`;
        }).join('');
        return `<ol class="flow-sequence">${sequence}</ol>${repeats ? '<div class="flow-loop" aria-label="반복">이후 1번부터 반복</div>' : ''}`;
    }

    function renderFlowPhase(monster, stats, { title, pattern, repeats = false }) {
        return `<section class="flow-phase"><header><h5>${escapeHtml(title)}</h5>${repeats ? '<span class="flow-badge">반복</span>' : ''}</header>${renderSequence(monster, stats, pattern, repeats)}</section>`;
    }

    function renderActionFlow(monster, stats) {
        const opening = monster.patterns.find(pattern => pattern.id === 'opening');
        const firstCycle = monster.patterns.find(pattern => pattern.id === 'cycle-1');
        const secondCycle = monster.patterns.find(pattern => pattern.id === 'cycle-2');
        if (!opening && !firstCycle) return '';

        const phases = [];
        if (sameSequence(opening, firstCycle) || (!opening && firstCycle)) {
            phases.push(renderFlowPhase(monster, stats, {
                title: secondCycle ? '1번째 체력바 행동' : '행동 순서',
                pattern: firstCycle || opening,
                repeats: true
            }));
        } else {
            if (opening) phases.push(renderFlowPhase(monster, stats, {
                title: '전투 시작',
                pattern: opening
            }));
            if (firstCycle) {
                phases.push('<div class="flow-connector"><span>이후</span></div>');
                phases.push(renderFlowPhase(monster, stats, {
                    title: secondCycle ? '1번째 체력바 반복 행동' : '이후 반복 행동',
                    pattern: firstCycle,
                    repeats: true
                }));
            }
        }
        if (secondCycle) {
            phases.push('<div class="flow-connector flow-connector--phase"><span>첫 체력바 소진 · 부활</span></div>');
            phases.push(renderFlowPhase(monster, stats, {
                title: '2번째 체력바 행동',
                pattern: secondCycle,
                repeats: true
            }));
        }
        return `<section class="combat-flow" aria-label="행동 진행 순서">${phases.join('')}</section>`;
    }

    function renderConditionalActions(monster, stats) {
        const actions = monster.conditionalActions || [];
        if (!actions.length) return '';
        const cards = actions.map(action => {
            const skill = skillById(monster, action.skillId);
            const resolved = stats.resolvedSkills?.[String(action.skillId)];
            const resolvedState = stats.resolvedStates?.find(state => state.id === action.stateId);
            const rawCondition = action.conditionText
                || politeText(resolvedState?.description)
                || '특정 전투 조건을 충족하면 발동합니다.';
            const replacementName = rawCondition.match(/현재 의도를 「([^」]+)」로 대체/)?.[1];
            const condition = rawCondition
                .replace(/\(현재\s*\d+장\s*남음\)/g, '')
                .replace(/,?\s*현재 의도를 「[^」]+」로 대체(?:한다|합니다?)\.?/g, '')
                .replace(/때마다\.?$/, '때마다 발동합니다.')
                .trim();
            return `<article class="conditional-action">
                ${renderIntentIcon(skill)}
                <div class="conditional-action-copy">
                    <header><strong>${escapeHtml(replacementName || skill?.name || '조건부 행동')}</strong><span>조건부</span></header>
                    <p class="conditional-trigger"><b>발동:</b> ${dynamicMarkup(condition)}</p>
                    <p>${dynamicMarkup(resolved?.description || skill?.descriptionTemplate)}</p>
                </div>
            </article>`;
        }).join('');
        return `<section class="conditional-actions" aria-label="조건부 행동"><h5 class="section-label">조건부 행동</h5>${cards}</section>`;
    }

    function renderRules(monster, stats) {
        const conditionalStateIds = new Set((monster.conditionalActions || []).map(action => action.stateId));
        const rules = (stats.resolvedStates || []).filter(state => (
            state.visible
            && !conditionalStateIds.has(state.id)
            && (state.name || state.description)
        ));
        if (!rules.length) return '';
        return `<section class="monster-rules" aria-label="특수 규칙">${rules.map(rule => `<article><strong>${escapeHtml(gameText(rule.name) || '특수 규칙')}</strong><p>${dynamicMarkup(rule.description || '전투 중 적용되는 특수 규칙입니다.')}</p></article>`).join('')}</section>`;
    }

    function renderSummons(wave, tid) {
        const alert = wave.alerts.find(item => item.alert === selectedAlert);
        const summons = (alert?.summonedMonsters || []).filter(monster => monster.parentTid === tid);
        if (!summons.length) return '';
        const cards = summons.map(stats => {
            const monster = summonDefinition(wave, stats.tid);
            if (!monster) return '';
            return renderMonsterCard(monster, stats, {
                badgeLabel: stats.count > 1 ? `소환 개체 ×${stats.count}` : '소환 개체',
                badgeType: 'Summon',
                extraClass: 'monster-card--summon'
            });
        }).join('');
        return `<section class="summon-section" aria-label="소환 개체"><h5 class="section-label">소환 개체</h5><div class="summon-list">${cards}</div></section>`;
    }

    function relicParameterText(parameter) {
        if (parameter.kind === 'fixed') return number.format(parameter.fixedValue);
        const value = window.ResearchDepth?.evaluate(parameter.expression, window.ResearchDepth.depthAt(researchLevel));
        if (value !== null && value !== undefined) return number.format(value);
        if (Number.isFinite(parameter.coefficient)) {
            return `${parameter.label}의 ${number.format(parameter.coefficient * 100)}%`;
        }
        return '금기 학식 등급에 따라 결정되는 수치';
    }

    function relicDescriptionMarkup(relic) {
        const parameters = new Map((relic.parameters || []).map(parameter => [parameter.index, parameter]));
        const description = String(relic.battleDescription || relic.description || '효과 설명이 없습니다.')
            .replace(/\[(?:[A-Za-z]+:)?Arg(\d+)\]/g, (match, index) => {
                const parameter = parameters.get(Number(index));
                return parameter ? relicParameterText(parameter) : '';
            });
        return dynamicMarkup(description);
    }

    function renderRelics(wave) {
        if (!wave.initialRelics?.length) return '';
        const cards = wave.initialRelics.map(relic => {
            return `<article class="relic-card">
                <img class="relic-image" src="${escapeHtml(relic.image)}" alt="${escapeHtml(relic.nameKo)}" width="96" height="96" loading="lazy" decoding="async">
                <div class="relic-copy">
                    <header><h3>${escapeHtml(relic.nameKo)}</h3></header>
                    <p class="relic-effect">${relicDescriptionMarkup(relic)}</p>
                </div>
            </article>`;
        }).join('');
        return `<section class="wave-relics" aria-label="초기 유물"><header><h3>초기 유물</h3></header><div class="relic-grid">${cards}</div></section>`;
    }

    function renderHp(stats) {
        if (!stats.phases || stats.phases.length < 2) {
            const hp = Number.isFinite(stats.hp) ? number.format(stats.hp) : '전투 중 결정';
            return `<dl class="monster-stats"><div class="monster-stat monster-stat--hp"><dt>HP</dt><dd>${hp}</dd></div></dl>`;
        }
        const phaseCount = stats.phases.length;
        const phaseMap = stats.phases.map((phase, index) => `<span class="hp-phase-segment" style="--hp-phase-size: ${phase.hp}" aria-hidden="true"><b>${index + 1}</b></span>`).join('');
        const bars = stats.phases.map((phase, index) => `<div class="hp-stage"><dt>${index + 1}번째 체력바</dt><dd>${number.format(phase.hp)}</dd></div>`).join('');
        return `<section class="hp-breakdown" aria-label="HP ${phaseCount}줄"><header><h5>HP <span>${phaseCount}줄</span></h5></header><div class="hp-phase-map" aria-hidden="true">${phaseMap}</div><dl>${bars}<div class="hp-stage hp-stage--total"><dt>실질 총 HP</dt><dd>${number.format(stats.effectiveHp)}</dd></div></dl></section>`;
    }

    function monsterTagDefinitions(monster) {
        return [...new Map((monster.monsterTags || [])
            .map(tagId => MONSTER_TAGS[tagId])
            .filter(Boolean)
            .map(tag => [tag.label, tag])).values()];
    }

    function renderMonsterTags(monster) {
        const tags = monsterTagDefinitions(monster);
        if (!tags.length) return '';
        return `<span class="monster-heading-tags">${tags
            .map(tag => `<span class="monster-tag">${escapeHtml(tag.label)}</span>`)
            .join('')}</span>`;
    }

    function renderMonsterAffinity(monster) {
        const tagDefinitions = monsterTagDefinitions(monster);
        const tagCounters = tagDefinitions
            .flatMap(tag => (tag.counters || []).map(counter => ({ ...counter, note: `${tag.label}에 추가 효과` })));
        const mechanicCounters = (MECHANIC_COUNTERS[monster.tid] || [])
            .flatMap(status => STATUS_COUNTERS[status] || [])
            .map(id => MECHANIC_COUNTER_LIBRARY[id])
            .filter(Boolean);
        const counters = [...[...tagCounters, ...mechanicCounters].reduce((counterMap, counter) => {
            const existing = counterMap.get(counter.id);
            if (!existing) {
                counterMap.set(counter.id, { ...counter });
                return counterMap;
            }
            existing.note = [...new Set([existing.note, counter.note].filter(Boolean))].join(' · ');
            existing.effect = [...new Set([existing.effect, counter.effect].filter(Boolean))].join(' ');
            return counterMap;
        }, new Map()).values()];
        if (!counters.length) return '';
        const counterMarkup = counters.length ? counters.map(counter => `
            <details class="affinity-awakener site-disclosure">
                <summary>
                    <img src="${escapeHtml(counter.image)}" alt="" width="48" height="48" loading="lazy" decoding="async">
                    <span class="affinity-awakener-name"><strong>${escapeHtml(counter.name)}</strong><small>${escapeHtml(counter.note)}</small></span>
                </summary>
                <div class="affinity-awakener-effect">
                    <p>${dynamicMarkup(counter.effect)}</p>
                    <a href="links.html?category=character&amp;id=${encodeURIComponent(counter.id)}">각성체 정보 보기</a>
                </div>
            </details>`).join('') : '';

        return `<section class="monster-stat monster-stat--affinity" aria-label="상성 각성체">
            <h5>상성 각성체</h5>
            <div class="affinity-awakener-list">${counterMarkup}</div>
        </section>`;
    }

    function renderMonsterCard(monster, stats, { badgeLabel = '', badgeType = '', extraClass = '', after = '' } = {}) {
        const badge = badgeLabel
            ? `<span class="monster-badge" data-type="${escapeHtml(badgeType)}">${escapeHtml(badgeLabel)}</span>`
            : '';
        const hpBarBadge = stats.phases?.length > 1
            ? `<span class="hp-count-badge">HP ${stats.phases.length}줄</span>`
            : '';
        const portraitSource = [monster.webImage, monster.portrait, monster.icon, monster.image]
            .find(source => /^(?:images\/|https?:\/\/)/.test(String(source || ''))) || '';
        const portrait = portraitSource
            ? `<img class="monster-portrait" src="${escapeHtml(portraitSource)}" alt="" width="48" height="48" loading="lazy" decoding="async">`
            : '';
        return `
            <details class="monster-card site-disclosure ${escapeHtml(extraClass)}" data-monster-id="${monster.tid}" open>
                <summary class="monster-heading">
                    ${portrait}
                     <div class="monster-heading-copy"><h4>${escapeHtml(monster.nameKo)}</h4>${badge}${renderMonsterTags(monster)}${hpBarBadge}</div>
                </summary>
                <div class="monster-body">
                    <div class="monster-overview">
                        ${renderHp(stats)}
                        ${renderMonsterAffinity(monster)}
                    </div>
                    ${renderRules(monster, stats)}
                    ${renderActionFlow(monster, stats)}
                    ${renderConditionalActions(monster, stats)}
                    ${after}
                </div>
            </details>`;
    }

    function renderMonster(wave, member) {
        const monster = staticMonster(wave, member.tid);
        const stats = alertMonster(wave, member.tid);
        if (!monster || !stats) return '';
        const typeLabel = TYPE_LABELS[monster.monsterClass] || monster.monsterClass || '일반';
        return renderMonsterCard(monster, stats, {
            badgeLabel: monster.monsterClass === 'Common' ? '' : typeLabel,
            badgeType: monster.monsterClass,
            after: renderSummons(wave, monster.tid)
        });
    }

    function renderEncounter(wave, encounter) {
        const typeLabel = TYPE_LABELS[encounter.battleType] || encounter.battleType;
        return `
            <details class="encounter-card site-disclosure" open>
                <summary class="encounter-header">
                    <h3>${escapeHtml(typeLabel)} 전투</h3>
                </summary>
                <div class="monster-list">${encounter.members.map(member => renderMonster(wave, member)).join('')}</div>
            </details>`;
    }

    function renderWave(wave) {
        const difficulty = wave.alerts.find(item => item.alert === selectedAlert);
        const difficultyLabel = difficulty?.difficultyLabel || `경보 ${selectedAlert}급`;
        const encounters = [...wave.encounters]
            .sort((left, right) => (TYPE_ORDER[left.battleType] ?? 99) - (TYPE_ORDER[right.battleType] ?? 99))
            .map(encounter => renderEncounter(wave, encounter)).join('');
        const mechanicBadges = waveMechanics(wave);
        return `
            <section class="wave-section" id="wave-${wave.wave}">
                <header class="wave-header">
                    <div class="wave-heading"><h2 class="wave-title"><span>${wave.wave}파</span></h2>${mechanicBadges.length ? `<ul class="wave-mechanics" aria-label="주요 기믹">${mechanicBadges.map(label => `<li>${escapeHtml(label)}</li>`).join('')}</ul>` : ''}</div>
                    <div class="wave-meta">${escapeHtml(difficultyLabel)}</div>
                </header>
                ${renderRelics(wave)}
                <div class="encounter-grid">${encounters}</div>
            </section>`;
    }

    function render() {
        if (data?.period !== window.DzoneSeason.selectSeason().period) {
            void refreshSeason();
            return;
        }
        const selected = data.waves.find(wave => wave.wave === selectedWave) || data.waves[0];
        selectedWave = selected.wave;
        if (!selected.alerts.some(item => item.alert === selectedAlert)) {
            selectedAlert = selected.alerts.at(-1)?.alert ?? selected.alerts[0]?.alert ?? selectedAlert;
        }
        const difficultyLabel = selected.alerts.find(item => item.alert === selectedAlert)?.difficultyLabel || `경보 ${selectedAlert}급`;
        const content = document.getElementById('dzone-content');
        content.dataset.season = String(data.period);
        content.innerHTML = renderWave(selected);
        document.getElementById('selection-status').textContent = `${selectedWave}파, ${difficultyLabel} 난이도 선택됨`;
        document.querySelectorAll('[data-wave]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.wave) === selectedWave)));
        document.querySelectorAll('[data-alert]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.alert) === selectedAlert)));
        history.replaceState(null, '', `#wave-${selectedWave}-alert-${selectedAlert}`);
        window.CharacterEffects?.setupTooltips(content);
        renderMechanicNavigation();
    }

    function buildControls() {
        const researchInput = document.getElementById('dzone-research-level');
        researchInput.value = researchLevel;
        researchInput.oninput = () => {
            researchLevel = window.ResearchDepth.selectLevel(researchInput.value);
            researchInput.value = researchLevel;
            render();
        };
        const waveSelector = document.getElementById('wave-selector');
        waveSelector.innerHTML = data.waves.map(wave => `<button type="button" class="wave-button" data-wave="${wave.wave}" aria-pressed="${wave.wave === selectedWave}">${wave.wave}파</button>`).join('');
        waveSelector.onclick = event => {
            const button = event.target.closest('[data-wave]');
            if (!button) return;
            selectedWave = Number(button.dataset.wave);
            render();
        };

        const alertSelector = document.getElementById('alert-selector');
        const difficulties = data.waves[0]?.alerts || [];
        alertSelector.innerHTML = difficulties.map(item => `<button type="button" class="alert-button" data-alert="${item.alert}" aria-pressed="${item.alert === selectedAlert}">${escapeHtml(item.difficultyLabel || `${item.alert}급`)}</button>`).join('');
        alertSelector.onclick = event => {
            const button = event.target.closest('[data-alert]');
            if (!button) return;
            selectedAlert = Number(button.dataset.alert);
            render();
        };

        document.getElementById('dzone-mechanic-chips').onclick = event => {
            const button = event.target.closest('[data-mechanic]');
            if (!button) return;
            const mechanic = button.dataset.mechanic;
            const matches = mechanicMatches(mechanic);
            if (!matches.length) return;
            if (selectedMechanic === mechanic) {
                mechanicCursor = (mechanicCursor + 1) % matches.length;
            } else {
                const currentWaveMatch = matches.findIndex(match => match.wave === selectedWave);
                mechanicCursor = currentWaveMatch >= 0 ? currentWaveMatch : 0;
            }
            selectedMechanic = mechanic;
            const match = matches[mechanicCursor];
            selectedWave = match.wave;
            render();
            requestAnimationFrame(() => {
                const target = document.querySelector(`[data-monster-id="${CSS.escape(String(match.monsterId))}"]`);
                if (!target) return;
                target.open = true;
                target.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                    block: 'start'
                });
                target.querySelector('summary')?.focus({ preventScroll: true });
            });
        };
    }

    let seasonTimer = null;
    let refreshingSeason = false;

    function scheduleSeasonRefresh() {
        clearTimeout(seasonTimer);
        const delay = window.DzoneSeason.nextCheckDelay();
        if (delay !== null) seasonTimer = setTimeout(refreshSeason, delay);
    }

    async function refreshSeason() {
        if (refreshingSeason) return;
        if (data?.period === window.DzoneSeason.selectSeason().period) {
            scheduleSeasonRefresh();
            return;
        }
        refreshingSeason = true;
        const content = document.getElementById('dzone-content');
        const toolbar = document.querySelector('.dzone-toolbar');
        toolbar.inert = true;
        delete content.dataset.season;
        content.innerHTML = '<div class="dzone-loading">현재 시즌 데이터를 불러오는 중입니다.</div>';
        try {
            data = await window.DzoneSeason.loadCurrent();
            selectedMechanic = '';
            mechanicCursor = 0;
            buildControls();
            render();
            toolbar.inert = false;
            scheduleSeasonRefresh();
        } catch (error) {
            console.error('융재금구 시즌 전환 실패:', error);
            content.innerHTML = '<div class="dzone-error">현재 시즌 정보를 불러오지 못했습니다. 잠시 후 다시 시도합니다.</div>';
            clearTimeout(seasonTimer);
            seasonTimer = setTimeout(refreshSeason, 60000);
        } finally {
            refreshingSeason = false;
        }
    }

    async function initialize() {
        try {
            const [seasonData, tooltipResponse] = await Promise.all([
                window.DzoneSeason.loadCurrent(),
                fetch(`data/db_tooltips.json?t=${Date.now()}`).catch(() => null),
                window.ResearchDepth.load()
            ]);
            data = seasonData;
            const rawTooltips = tooltipResponse?.ok ? await tooltipResponse.json() : {};
            tooltips = Object.fromEntries(Object.entries(rawTooltips).map(([keyword, description]) => [
                keyword,
                typeof description === 'string' ? politeText(description) : description
            ]));
            Object.assign(tooltips, DZONE_CARD_TOOLTIPS);
            window.CharacterEffects?.configureTooltips(tooltips);
            researchLevel = window.ResearchDepth.selectedLevel();
            const hashSelection = location.hash.match(/^#wave-(\d+)(?:-alert-(\d+))?$/);
            if (hashSelection) {
                selectedWave = Number(hashSelection[1]);
                if (hashSelection[2]) selectedAlert = Number(hashSelection[2]);
            }
            document.title = '진행 중인 융재금구 정보';
            document.getElementById('dzone-title').textContent = '진행 중인 융재금구 정보';
            document.getElementById('dzone-summary').textContent = '현재 진행 중인 융재금구의 전투 구성과 몬스터 행동을 확인할 수 있습니다.';
            buildControls();
            render();
            window.addEventListener('focus', refreshSeason);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) refreshSeason();
            });
            // Shared resources may have finished loading across the cutoff.
            await refreshSeason();
        } catch (error) {
            console.error('융재금구 데이터 로드 실패:', error);
            document.getElementById('dzone-content').innerHTML = '<div class="dzone-error">융재금구 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
