// Synthetic interaction fixture. Never ingested, never loaded without explicit demo mode.
export function buildUsageDemo(characterId, manifest, wheels, covenants, period = 71) {
    const peers = manifest.filter(c => c.id !== characterId).slice(0, 5);
    const wheelIds = wheels.filter(w => w.owner_character_ids?.includes(characterId));
    const pair = [wheelIds[0] || wheels[0], wheelIds[1] || wheels[1]].map(w => ({ id: w.english_name, level: 15 }));
    const effects = [
        { id: 'crit_damage', label: '크리티컬 피해', value: 30, unit: '%' },
        { id: 'key_charge', label: '은열쇠 충전', value: 20, unit: '%' },
        { id: 'damage_bonus', label: '피해 증폭', value: 15, unit: '%' }
    ];
    const makeMember = (id, variant, index) => ({
        characterId: id, enlightenment: variant ? 0 : 3, borrowed: index === 3 && variant === 1,
        wheels: variant ? [pair[0], { id: wheels[2].english_name, level: 10 }] : pair,
        covenant: { completion: variant ? 89 : 96, parts: Array.from({ length: 6 }, (_, i) => ({ slot: i + 1, setId: covenants[variant].english_name, main: effects[(i + variant) % 3], subs: [effects[(i + 1 + variant) % 3]] })) }
    });
    const rows = [];
    for (let wave = 1; wave <= 5; wave++) for (let difficulty = 1; difficulty <= 7; difficulty++) {
        for (let v = 0; v < 2; v++) rows.push({ wave, difficulty: String(difficulty), count: v ? 2 + wave : 8 + difficulty,
            members: [characterId, ...peers.slice(v, v + 3).map(c => c.id)].map((id, i) => makeMember(id, (v + (period === 70 ? 1 : 0)) % 2, i)) });
    }
    return { schemaVersion: 1, characterId, period, collectedAt: 1792670400, coverage: 'sample', source: '화면 검토용 가상 표본', rows };
}
