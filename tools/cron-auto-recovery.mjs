import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const WATCHDOG_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_RECOVERY_WAIT_MS = 12 * 60 * 1000;
const DEFAULT_UNAVAILABLE_CONFIRMATION_MS = 30_000;
const WRANGLER_VERSION = '4.123.0';

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function confirmInitialState({ initial, checkHealth, sleep, delayMs }) {
  if (initial.kind !== 'unavailable') return initial;
  await sleep(delayMs);
  return checkHealth();
}

export function classifyWatchdogResult({ status, payload, error = null }) {
  if (error) {
    return { kind: 'unavailable', reason: error.message || String(error) };
  }

  if (status === 401 || status === 403) {
    return { kind: 'configuration-error', reason: `watchdog authentication failed (${status})` };
  }

  if (payload && typeof payload === 'object') {
    const ageMinutes = numberOrNull(payload.ageMinutes);
    const staleAfterMinutes = numberOrNull(payload.staleAfterMinutes);
    const freshnessKnown = ageMinutes !== null && staleAfterMinutes !== null;
    const freshnessHealthy = freshnessKnown && ageMinutes <= staleAfterMinutes;

    if (status === 200 && payload.healthy === true) {
      return { kind: 'healthy', payload };
    }
    if (freshnessHealthy && payload.tasksHealthy === false) {
      return { kind: 'task-failure', payload, reason: 'cron is running, but a scheduled task failed' };
    }
    if (!freshnessHealthy || payload.lastCompletedAt == null) {
      return { kind: 'stale', payload, reason: 'cron heartbeat is stale or missing' };
    }
  }

  if (status >= 500) {
    return { kind: 'unavailable', payload, reason: `watchdog returned ${status}` };
  }

  return { kind: 'configuration-error', payload, reason: `unexpected watchdog response (${status})` };
}

export async function runAutoRecovery({
  checkHealth,
  deployTriggers,
  deployWorker,
  waitForRecovery,
  log = () => {}
}) {
  const initial = await checkHealth();
  log(`Initial watchdog state: ${initial.kind}`);

  if (initial.kind === 'healthy') {
    return { outcome: 'healthy', state: initial };
  }
  if (initial.kind === 'task-failure' || initial.kind === 'configuration-error') {
    throw new Error(`Automatic infrastructure recovery skipped: ${initial.reason}`);
  }

  let triggerDeploymentError = null;
  let triggersDeployed = false;
  try {
    await deployTriggers();
    triggersDeployed = true;
  } catch (error) {
    triggerDeploymentError = error;
    log(`Trigger-only recovery command failed: ${error.message || String(error)}`);
  }

  if (triggersDeployed) {
    const afterTriggers = await waitForRecovery('trigger-redeploy');
    log(`State after trigger redeploy: ${afterTriggers.kind}`);
    if (afterTriggers.kind === 'healthy') {
      return { outcome: 'recovered-by-trigger-redeploy', state: afterTriggers };
    }
    if (afterTriggers.kind === 'task-failure' || afterTriggers.kind === 'configuration-error') {
      throw new Error(`Cron event resumed but is not healthy: ${afterTriggers.reason}`);
    }
  }

  await deployWorker();
  const afterWorker = await waitForRecovery('worker-redeploy');
  log(`State after full Worker redeploy: ${afterWorker.kind}`);
  if (afterWorker.kind === 'healthy') {
    return {
      outcome: 'recovered-by-worker-redeploy',
      state: afterWorker,
      triggerDeploymentError: triggerDeploymentError?.message || null
    };
  }

  throw new Error(`Cron automatic recovery failed after full redeploy: ${afterWorker.reason || afterWorker.kind}`);
}

async function checkWatchdog({ url, token, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WATCHDOG_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    return classifyWatchdogResult({ status: response.status, payload });
  } catch (error) {
    return classifyWatchdogResult({ status: 0, payload: null, error });
  } finally {
    clearTimeout(timeout);
  }
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required for cron automatic recovery`);
  return value;
}

function positiveSeconds(name, fallback) {
  const parsed = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : fallback;
}

async function waitForRecovery({ checkHealth, phase, timeoutMs, pollIntervalMs, log }) {
  const deadline = Date.now() + timeoutMs;
  let latest = await checkHealth();
  while (Date.now() < deadline) {
    if (latest.kind === 'healthy' || latest.kind === 'task-failure' || latest.kind === 'configuration-error') {
      return latest;
    }
    log(`${phase}: ${latest.kind}; waiting for the next cron heartbeat`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    latest = await checkHealth();
  }
  return latest;
}

async function writeSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  await appendFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

export async function main() {
  const watchdogUrl = requiredEnv('WATCHDOG_URL');
  const watchdogToken = requiredEnv('WATCHDOG_TOKEN');
  const pollIntervalMs = positiveSeconds('RECOVERY_POLL_SECONDS', DEFAULT_POLL_INTERVAL_MS);
  const triggerWaitMs = positiveSeconds('TRIGGER_RECOVERY_WAIT_SECONDS', DEFAULT_RECOVERY_WAIT_MS);
  const workerWaitMs = positiveSeconds('WORKER_RECOVERY_WAIT_SECONDS', DEFAULT_RECOVERY_WAIT_MS);
  const unavailableConfirmationMs = positiveSeconds(
    'UNAVAILABLE_CONFIRMATION_SECONDS',
    DEFAULT_UNAVAILABLE_CONFIRMATION_MS
  );
  const log = message => console.log(`[cron-auto-recovery] ${message}`);
  const checkHealth = () => checkWatchdog({ url: watchdogUrl, token: watchdogToken });

  const requireCloudflareCredentials = () => {
    requiredEnv('CLOUDFLARE_API_TOKEN');
    requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  };
  const wranglerEnv = () => ({
    ...process.env,
    CLOUDFLARE_API_TOKEN: requiredEnv('CLOUDFLARE_API_TOKEN'),
    CLOUDFLARE_ACCOUNT_ID: requiredEnv('CLOUDFLARE_ACCOUNT_ID')
  });
  const wrangler = (...args) => runCommand(
    'npx',
    ['--yes', `wrangler@${WRANGLER_VERSION}`, ...args, '--config', 'wrangler.jsonc'],
    wranglerEnv()
  );

  const firstCheck = await checkHealth();
  const initial = await confirmInitialState({
    initial: firstCheck,
    checkHealth,
    sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    delayMs: unavailableConfirmationMs
  });
  if (initial.kind === 'healthy') {
    log('Cron is healthy; no remediation required.');
    await writeSummary(['## Worker cron watchdog', '', '✅ Cron heartbeat is healthy.']);
    return;
  }
  if (initial.kind === 'task-failure' || initial.kind === 'configuration-error') {
    throw new Error(`Automatic infrastructure recovery skipped: ${initial.reason}`);
  }

  requireCloudflareCredentials();
  const result = await runAutoRecovery({
    checkHealth: async () => initial,
    deployTriggers: () => wrangler('triggers', 'deploy'),
    deployWorker: () => wrangler('deploy'),
    waitForRecovery: phase => waitForRecovery({
      checkHealth,
      phase,
      timeoutMs: phase === 'trigger-redeploy' ? triggerWaitMs : workerWaitMs,
      pollIntervalMs,
      log
    }),
    log
  });

  log(`Recovery outcome: ${result.outcome}`);
  await writeSummary([
    '## Worker cron watchdog',
    '',
    `✅ Automatic recovery completed: \`${result.outcome}\`.`
  ]);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch(async error => {
    console.error(`[cron-auto-recovery] ${error.stack || error.message || String(error)}`);
    await writeSummary([
      '## Worker cron watchdog',
      '',
      `❌ Automatic recovery failed: ${error.message || String(error)}`
    ]).catch(() => {});
    process.exitCode = 1;
  });
}
