/* Synthetic, labelled examples. Never a fixture from a real account. */
(function (root) {
    root.RecordDemo = {
        create(links, manifest) {
            const ids = ['pollux', 'castor', 'clementine', 'arachne'];
            const members = ids.map((siteId, i) => {
                const tid = links.characters.find(row => row.siteId === siteId)?.clientId;
                if (!tid) throw Error('데모 각성체 매핑이 없습니다.');
                const character = manifest.find(row => row.id === siteId);
                return { tid, name: character.name, image_thumb: character.image_thumb, level: i === 3 ? 70 : 60, potencyLevel: i < 2 ? 7 : 3,
                    breakLevel: 3, assistPlayerId: 0, talents: {}, weaponSlots: [], trinkets: [], boundTrinkets: {}, boundTrinketsComplete: true,
                    attrs: {}, slots: [{ tid: tid * 10, name: '데모 카드', level: [6,6,3,6][i], slot: 1 }] };
            });
            const actors = members.map(row => row.tid), metric = 'AwakerDoDamage';
            const turns = [actors.map((tid, i) => [tid, { [metric]: (i + 1) * 1000 }]), actors.map((tid, i) => [tid, { [metric]: (4 - i) * 2000 }])]
                .map(entries => ({ totals: Object.fromEntries(entries), sources: Object.fromEntries(entries.map(([tid, value]) => [`${tid}:skill:${tid * 10}`, value])) }));
            return { source: 'synthetic-demo', isDemo: true, battleUuid: '00000000-0000-0000-0000-000000000001', stageTid: 1,
                timestamp: 0, summary: { playerLevel: 80, stageRoundCount: 2, bossBattleRoundCount: 2, respawnedNum: 0 },
                keeperSkill: null, awakeners: members, items: {}, battles: [{ gearType: 'demo', turns }],
                totals: { AwakerDoDamage: Object.fromEntries(actors.map((tid, i) => [tid, (i + 1) * 1000 + (4 - i) * 2000])) },
                sourceLabels: Object.fromEntries(actors.map(tid => [`${tid}:skill:${tid * 10}`, '데모 카드'])), teamAttrs: {} };
        }
    };
})(globalThis);
