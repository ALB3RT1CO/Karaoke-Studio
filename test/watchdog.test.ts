import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectSpinning, recordEvent, formatTelemetryEvent } from '../scripts/watchdog.mjs';

test('Watchdog Telemetry & Anti-Looping Engine', async (t) => {
  const tempLogFile = path.resolve(process.cwd(), 'logs', 'test_watchdog_results.jsonl');

  t.after(() => {
    if (fs.existsSync(tempLogFile)) {
      fs.unlinkSync(tempLogFile);
    }
  });

  await t.test('formatTelemetryEvent: formats valid JSONL schema', () => {
    const event = formatTelemetryEvent({
      agentId: 'test-agent',
      task: 'task-1.1',
      status: 'PASS',
      gateway: 'G3_TDD_RED',
      message: 'Test failure recorded as expected',
      evidence: { exitCode: 1, command: 'node --test' }
    });

    assert.equal(event.agent_id, 'test-agent');
    assert.equal(event.task, 'task-1.1');
    assert.equal(event.status, 'PASS');
    assert.equal(event.gateway, 'G3_TDD_RED');
    assert.ok(event.timestamp);
    assert.equal(event.evidence.exitCode, 1);
  });

  await t.test('recordEvent: appends event to jsonl file', () => {
    const event = formatTelemetryEvent({
      agentId: 'test-agent',
      task: 'init',
      status: 'PASS',
      gateway: 'Setup',
      message: 'Starting watchdog test'
    });

    recordEvent(event, tempLogFile);

    assert.ok(fs.existsSync(tempLogFile));
    const lines = fs.readFileSync(tempLogFile, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.agent_id, 'test-agent');
    assert.equal(parsed.gateway, 'Setup');
  });

  await t.test('detectSpinning: returns false when actions are progressing', () => {
    const history = [
      { action: 'edit_file', target: 'src/store.ts', timestamp: 1000 },
      { action: 'run_test', target: 'test/store.test.ts', timestamp: 2000 },
      { action: 'refactor', target: 'src/store.ts', timestamp: 3000 }
    ];

    const result = detectSpinning(history, 3);
    assert.equal(result.isSpinning, false);
  });

  await t.test('detectSpinning: detects loop when same action & target repeats >= 3 times', () => {
    const history = [
      { action: 'run_test', target: 'test/store.test.ts', error: 'SyntaxError', timestamp: 1000 },
      { action: 'run_test', target: 'test/store.test.ts', error: 'SyntaxError', timestamp: 2000 },
      { action: 'run_test', target: 'test/store.test.ts', error: 'SyntaxError', timestamp: 3000 }
    ];

    const result = detectSpinning(history, 3);
    assert.equal(result.isSpinning, true);
    assert.match(result.reason, /Repeated action/i);
    assert.equal(result.repeatedCount, 3);
  });
});
