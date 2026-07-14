/* Party Builder search primitives.
 * All exports are deterministic and do not read or mutate DOM/application state.
 */

    export const KEY_TAGS = Object.freeze([
        '산출력', '산출력 획득', '은열쇠 에너지', '은열쇠 게이지', '방어막 획득', '체력 회복', '힘', '힘 증가',
        '피해 증폭', '치명타 확률', '치명타 확률 증가', '치명타 피해', '치명타 피해 증가', '영역 숙련', '카드 추가',
        '드로우', '카드 뽑기', '코스트 감소', '계산 비용', '복사본', '영감', '광기', '광기 부여', '약화', '취약',
        '중독', '중독 부여', '힘 훔침', '힘 감소', '반격', '소멸', '경계', '희생', '터치월', '터치 손상',
        '출생 의식', '스칼렛 용광로', '초월 턴', '시편', '주사위'
    ]);

    export const WHEEL_TAGS = Object.freeze([
        '은열쇠 충전', '피해 증폭', '영역 숙련', '죽음 저항', '광기 회복', '검은 인장 드롭율', '크리티컬 확률',
        '크리티컬 피해', '기본 피해 증가', '최종 피해 증가', '능동 피해 증가', '힘', '임시 힘', '반격', '방어막',
        'HP 회복', '광기 획득', '은열쇠 에너지', '산출력', '손패 상한', '카드 뽑기', '중독', '취약', '허약',
        '전투 시작 시', '턴 시작 시', '광기 폭발', '은열쇠 발동', '명령 카드', '타격', '방어', '적 처치', '피격',
        '혈육', '심해', '초차원', '배아', '촉수', '핏빛 용광로', '심장의 불', '빙설', '학자 인격', '광대 인격',
        '고요한 바다', '몰아치는 파도', '저주받은 유물', '증상 카드'
    ]);

    function compact(value) {
        return String(value || '').replace(/\s+/g, '');
    }

    export function createKeywordMatcher(keywords) {
        const normalizedKeywords = keywords.map(keyword => [keyword, compact(keyword)]);
        return Object.freeze({
            find(text) {
                const normalizedText = compact(text);
                return normalizedKeywords
                    .filter(([, normalizedKeyword]) => normalizedText.includes(normalizedKeyword))
                    .map(([keyword]) => keyword);
            }
        });
    }

    export function matches(text, query, searchUtils) {
        if (searchUtils?.matchesSearchText) return searchUtils.matchesSearchText(text, query);
        return compact(text).toLowerCase().includes(compact(query).toLowerCase());
    }

    export function matchesByQueryType(primaryText, fullText, query, searchUtils) {
        const target = searchUtils?.isChoseongQuery?.(query) ? primaryText : fullText;
        return matches(target, query, searchUtils);
    }

    export function normalizeWheelMainStat(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return raw
            .replace(/\s+/g, ' ')
            .replace(/드롭율/g, '드롭')
            .replace(/겅은 인장/g, '검은 인장')
            .trim()
            .replace(/^영역숙련/, '영역 숙련')
            .replace(/검은 인장 드롭\s*(\d)/, '검은 인장 드롭 $1')
            .replace(/\s+\d+(?:\.\d+)?%?$/, '');
    }

    export function normalizeDedicatedTarget(value) {
        return String(value || '')
            .normalize('NFKC')
            .replace(/[「」｢｣]/g, '')
            .trim()
            .toLowerCase();
    }
