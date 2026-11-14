import {covenantBound, covenantSlots} from './covenant-equipment.mjs';
import {covenantSubLevel} from './covenant-stats.mjs';

const SCHEMA = 'morimens.covenant-setting';
export const covenantTransferLimit = 32768;

// Only equipment crosses hosts. Account, party, simulation history and goals stay local.
export function normalizeCovenantSetting(value, catalog, metadata) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('비밀계약 세팅 형식을 확인하세요.');
    if (!Array.isArray(value.contractSlots) || value.contractSlots.length !== 6) throw Error('비밀계약 6부위의 세트 정보를 확인하세요.');
    const publishedIds = catalog.setIds ? new Set(Object.values(catalog.setIds)) : null;
    const contractSlots = covenantSlots(catalog, value);
    if (publishedIds && contractSlots.some(id => id && !publishedIds.has(id))) throw Error('현재 공개된 비밀계약 세트만 가져올 수 있습니다.');
    if (typeof value.contractBound !== 'boolean') throw Error('비밀계약 귀속 정보를 확인하세요.');
    if (!Array.isArray(value.trinkets) || value.trinkets.length > 6) throw Error('비밀계약 부위는 최대 6개입니다.');
    const positions = new Set();
    const trinkets = value.trinkets.map(piece => {
        if (!piece || !Number.isInteger(piece.position) || piece.position < 1 || piece.position > 6 || positions.has(piece.position)) {
            throw Error('중복되거나 잘못된 비밀계약 부위가 있습니다.');
        }
        positions.add(piece.position);
        const slot = metadata.slots[piece.position - 1];
        if (!Number.isSafeInteger(piece.main) || piece.main !== 0 && !slot.main.includes(piece.main)) throw Error(`${piece.position}번 부위의 주옵션을 확인하세요.`);
        if (piece.quality !== 'Orange') throw Error('현재 공용 편집기는 황금 비밀계약 세팅만 옮길 수 있습니다.');
        if (!Number.isInteger(piece.level) || piece.level < 0 || piece.level > 12) throw Error('강화 레벨은 0~12로 설정하세요.');
        if (!Array.isArray(piece.sub) || piece.sub.length > 3) throw Error('부옵션은 최대 3개입니다.');
        const sub = piece.sub.map(option => {
            if (!option || !Number.isSafeInteger(option.id) || !metadata.attributes[option.id] || !Number.isFinite(option.value) || covenantSubLevel(option) === null) {
                throw Error('부옵션 종류와 Lv.1~8 수치를 확인하세요.');
            }
            return {id: option.id, value: option.value};
        });
        return {position: piece.position, main: piece.main, quality: 'Orange', level: piece.level, bound: value.contractBound, sub};
    }).sort((a, b) => a.position - b.position);
    return {contractSlots, contractBound: value.contractBound, trinkets};
}

export function encodeCovenantSetting(owner, catalog, metadata) {
    const equipment = normalizeCovenantSetting({...owner, contractSlots: covenantSlots(catalog, owner), contractBound: covenantBound(owner), trinkets: owner.trinkets || []}, catalog, metadata);
    return JSON.stringify({schema: SCHEMA, version: 1, equipment});
}

export function decodeCovenantSetting(text, catalog, metadata) {
    if (typeof text !== 'string' || !text.trim() || text.length > covenantTransferLimit) throw Error('복사한 비밀계약 세팅을 붙여넣으세요. 세팅은 32KB 이하여야 합니다.');
    let value;
    try { value = JSON.parse(text); } catch { throw Error('비밀계약 세팅을 끝까지 복사했는지 확인하세요.'); }
    if (value?.schema !== SCHEMA || value.version !== 1) throw Error('지원하지 않는 비밀계약 세팅 형식입니다.');
    return normalizeCovenantSetting(value.equipment, catalog, metadata);
}
