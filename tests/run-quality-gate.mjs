import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { ROOT } from './helpers/site-fixture.mjs';

const steps = [
    ['소스 감사', ['tools/audit-site.mjs']],
    ['데이터 관계 검증', ['tools/validate-character.mjs', '--all']],
    ['런타임 데이터 샤드 동기화', ['tools/generate-data-shards.mjs', '--check']],
    ['배포 산출물 빌드', ['tools/build-site.mjs']],
    ['회귀 테스트', [
        '--test',
        '--test-reporter=spec',
        'tests/covenant-domain.test.mjs',
        'tests/data-contracts.test.mjs',
        'tests/data-shards.test.mjs',
        'tests/design-contracts.test.mjs',
        'tests/deployment-artifact.test.mjs',
        'tests/feedback-worker.test.mjs',
        'tests/inventory-domain.test.mjs',
        'tests/links-domain.test.mjs',
        'tests/party-builder-core.test.mjs'
    ]]
];

for (const [label, args] of steps) {
    console.log(`\n=== ${label} ===`);
    const result = spawnSync(process.execPath, args, {
        cwd: ROOT,
        stdio: 'inherit'
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n전체 품질 게이트를 통과했습니다.');
