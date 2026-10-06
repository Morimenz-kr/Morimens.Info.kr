(function(root){
    const catalog = Object.freeze({
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

root.MonsterTypeCatalog=catalog;
})(window);
