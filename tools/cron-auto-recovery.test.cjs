const assert = require('node:assert/strict');
const test = require('node:test');

async function loadModule() {
  return import('./cron-auto-recovery.mjs');
}

test('watchdog 응답은 heartbeat 정지와 작업 실패를 구분한다', async () => {
  const { classifyWatchdogResult } = await loadModule();

  assert.equal(classifyWatchdogResult({
    status: 503,
    payload: { ageMinutes: 41, staleAfterMinutes: 30, tasksHealthy: true }
  }).kind, 'stale');

  assert.equal(classifyWatchdogResult({
    status: 503,
    payload: { ageMinutes: 2, staleAfterMinutes: 30, tasksHealthy: false }
  }).kind, 'task-failure');

  assert.equal(classifyWatchdogResult({
    status: 401,
    payload: { error: 'Unauthorized' }
  }).kind, 'configuration-error');
});

test('Worker 응답 불능은 순간 네트워크 오류를 배제하기 위해 한 번 더 확인한다', async () => {
  const { confirmInitialState } = await loadModule();
  let checks = 0;
  let sleeps = 0;
  const result = await confirmInitialState({
    initial: { kind: 'unavailable' },
    checkHealth: async () => {
      checks += 1;
      return { kind: 'healthy' };
    },
    sleep: async milliseconds => {
      assert.equal(milliseconds, 30_000);
      sleeps += 1;
    },
    delayMs: 30_000
  });

  assert.equal(result.kind, 'healthy');
  assert.equal(checks, 1);
  assert.equal(sleeps, 1);
});

test('정상 heartbeat에는 배포를 실행하지 않는다', async () => {
  const { runAutoRecovery } = await loadModule();
  let deployments = 0;
  const result = await runAutoRecovery({
    checkHealth: async () => ({ kind: 'healthy' }),
    deployTriggers: async () => { deployments += 1; },
    deployWorker: async () => { deployments += 1; },
    waitForRecovery: async () => ({ kind: 'healthy' })
  });

  assert.equal(result.outcome, 'healthy');
  assert.equal(deployments, 0);
});

test('heartbeat 정지는 트리거 재등록 후 회복하면 전체 Worker를 배포하지 않는다', async () => {
  const { runAutoRecovery } = await loadModule();
  const calls = [];
  const result = await runAutoRecovery({
    checkHealth: async () => ({ kind: 'stale' }),
    deployTriggers: async () => { calls.push('triggers'); },
    deployWorker: async () => { calls.push('worker'); },
    waitForRecovery: async phase => {
      calls.push(`wait:${phase}`);
      return { kind: 'healthy' };
    }
  });

  assert.equal(result.outcome, 'recovered-by-trigger-redeploy');
  assert.deepEqual(calls, ['triggers', 'wait:trigger-redeploy']);
});

test('트리거 재등록으로 회복하지 않으면 main Worker 전체를 재배포한다', async () => {
  const { runAutoRecovery } = await loadModule();
  const calls = [];
  const result = await runAutoRecovery({
    checkHealth: async () => ({ kind: 'stale' }),
    deployTriggers: async () => { calls.push('triggers'); },
    deployWorker: async () => { calls.push('worker'); },
    waitForRecovery: async phase => {
      calls.push(`wait:${phase}`);
      return phase === 'trigger-redeploy' ? { kind: 'stale' } : { kind: 'healthy' };
    }
  });

  assert.equal(result.outcome, 'recovered-by-worker-redeploy');
  assert.deepEqual(calls, [
    'triggers',
    'wait:trigger-redeploy',
    'worker',
    'wait:worker-redeploy'
  ]);
});

test('작업 실패는 인프라 재배포로 덮지 않는다', async () => {
  const { runAutoRecovery } = await loadModule();
  let deployments = 0;
  await assert.rejects(() => runAutoRecovery({
    checkHealth: async () => ({ kind: 'task-failure', reason: 'task failed' }),
    deployTriggers: async () => { deployments += 1; },
    deployWorker: async () => { deployments += 1; },
    waitForRecovery: async () => ({ kind: 'healthy' })
  }), /recovery skipped/i);
  assert.equal(deployments, 0);
});

test('트리거가 살아난 뒤 작업만 실패하면 전체 Worker를 재배포하지 않는다', async () => {
  const { runAutoRecovery } = await loadModule();
  let workerDeployments = 0;
  await assert.rejects(() => runAutoRecovery({
    checkHealth: async () => ({ kind: 'stale' }),
    deployTriggers: async () => {},
    deployWorker: async () => { workerDeployments += 1; },
    waitForRecovery: async () => ({ kind: 'task-failure', reason: 'external API failed' })
  }), /resumed but is not healthy/i);
  assert.equal(workerDeployments, 0);
});

test('트리거 명령 자체가 실패해도 전체 Worker 재배포로 승격한다', async () => {
  const { runAutoRecovery } = await loadModule();
  const calls = [];
  const result = await runAutoRecovery({
    checkHealth: async () => ({ kind: 'unavailable' }),
    deployTriggers: async () => {
      calls.push('triggers');
      throw new Error('trigger API unavailable');
    },
    deployWorker: async () => { calls.push('worker'); },
    waitForRecovery: async phase => {
      calls.push(`wait:${phase}`);
      return { kind: 'healthy' };
    }
  });

  assert.equal(result.outcome, 'recovered-by-worker-redeploy');
  assert.deepEqual(calls, ['triggers', 'worker', 'wait:worker-redeploy']);
});
