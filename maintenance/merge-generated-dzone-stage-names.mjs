import { readFile, writeFile } from 'node:fs/promises';

const [generatedPath, sitePath] = process.argv.slice(2);
if (!generatedPath || !sitePath) {
    throw new Error('Usage: node merge-generated-dzone-stage-names.mjs <generated-season70.json> <site-current.json>');
}

const generated = JSON.parse(await readFile(generatedPath, 'utf8'));
const site = JSON.parse(await readFile(sitePath, 'utf8'));
if (generated.period !== 70 || site.period !== 70 || generated.waves?.length !== 5 || site.waves?.length !== 5) {
    throw new Error('Both inputs must contain the complete season 70');
}

let changed = 0;
for (const [index, wave] of site.waves.entries()) {
    const sourceWave = generated.waves[index];
    if (wave.wave !== index + 1 || sourceWave?.wave !== wave.wave || wave.alerts?.length !== 7 || sourceWave.alerts?.length !== 7) {
        throw new Error(`Incomplete wave ${index + 1}`);
    }
    for (const [gradeIndex, stage] of wave.alerts.entries()) {
        const source = sourceWave.alerts[gradeIndex];
        if (stage.alert !== gradeIndex + 1 || source?.alert !== stage.alert || source.stageId !== stage.stageId) {
            throw new Error(`Stage identity mismatch in wave ${wave.wave}, grade ${gradeIndex + 1}`);
        }
        if (gradeIndex < 6 && stage.stageNameKo !== source.stageNameKo) {
            throw new Error(`Unexpected name difference in wave ${wave.wave}, grade ${gradeIndex + 1}`);
        }
        if (gradeIndex === 6 && source.stageNameKo !== `제${wave.wave}금지구역`) {
            throw new Error(`Unverified seventh-grade name in wave ${wave.wave}`);
        }
        if (stage.stageNameKo !== source.stageNameKo) {
            stage.stageNameKo = source.stageNameKo;
            changed++;
        }
    }
}
if (changed !== 5) throw new Error(`Expected exactly five unresolved names, found ${changed}`);
await writeFile(sitePath, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
console.log(`Applied ${changed} verified stage names from generated season 70 data`);
