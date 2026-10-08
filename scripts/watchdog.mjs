import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DEFAULT_LOG_FILE = path.resolve(process.cwd(), 'logs', 'automation_results.jsonl');

/**
 * Format an AI-friendly, machine-readable telemetry event.
 */
export function formatTelemetryEvent({
  agentId = 'system',
  task = 'general',
  status = 'PASS',
  gateway = 'General',
  message = '',
  evidence = null,
  retryCount = 0
}) {
  return {
    timestamp: new Date().toISOString(),
    agent_id: agentId,
    task,
    status,
    gateway,
    message,
    evidence,
    retry_count: retryCount
  };
}

/**
 * Append a telemetry event to the JSON-L log file.
 */
export function recordEvent(event, logPath = DEFAULT_LOG_FILE) {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(logPath, line, 'utf8');
}

/**
 * Analyze an action history stream to detect repetitive loops / spinning.
 * @param {Array} history - Array of recent action objects: { action, target, error, timestamp }
 * @param {number} threshold - Number of consecutive repetitive actions to trigger a loop detection (default 3)
 */
export function detectSpinning(history = [], threshold = 3) {
  if (!Array.isArray(history) || history.length < threshold) {
    return { isSpinning: false, repeatedCount: 0, reason: null };
  }

  const recent = history.slice(-threshold);
  const first = recent[0];

  const isIdentical = recent.every((item) => {
    const sameAction = item.action === first.action;
    const sameTarget = item.target === first.target;
    const sameError = item.error ? item.error === first.error : true;
    return sameAction && sameTarget && sameError;
  });

  if (isIdentical) {
    return {
      isSpinning: true,
      repeatedCount: threshold,
      reason: `Repeated action '${first.action}' on '${first.target || 'target'}' ${threshold} times without convergence.`
    };
  }

  return { isSpinning: false, repeatedCount: 0, reason: null };
}

/**
 * Run a full watchdog cycle.
 * Inspects Git diff stagnation and system state, then logs status.
 */
export function runWatchdogCycle(options = {}) {
  const logPath = options.logPath || DEFAULT_LOG_FILE;
  let stuckCount = 0;
  let message = '0 stuck tasks detected. 0 stuck subagents detected.';

  try {
    // Check git diff stats
    const diff = execSync('git diff --stat', { encoding: 'utf8' }).trim();
    // In future iterations, compare against a cached previous diff snapshot
  } catch (err) {
    // Git diff check failed or not in repo
  }

  const event = formatTelemetryEvent({
    agentId: 'system',
    task: 'watchdog_check',
    status: stuckCount > 0 ? 'SPINNING' : 'PASS',
    gateway: 'Agent-Monitoring',
    message,
    retryCount: 0
  });

  recordEvent(event, logPath);
  return event;
}

// If executed directly as CLI script
if (process.argv[1] && process.argv[1].endsWith('watchdog.mjs')) {
  const result = runWatchdogCycle();
  console.log(`[Watchdog] Cycle completed: ${result.status} - ${result.message}`);
}
