import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  assessPreviewHealth,
  buildWorktreePlan,
  hasGitRepository,
  parseVerificationOptions,
  selectVerificationProfile,
} from '../scripts/lib/codex-workflow.mjs';
import {
  buildDirectPreviewUrl,
  directBrowserOpenPlan,
  managedBrowserLaunchPlan,
  managedBrowserSpawnOptions,
  retryTransientContext,
} from '../scripts/lib/managed-browser.mjs';
import { prototypeServerLaunchPlan } from '../scripts/lib/prototype-server.mjs';

const root = resolve(import.meta.dirname, '../..');

test('prototype server binds only to localhost', () => {
  assert.deepEqual(prototypeServerLaunchPlan(root, 8010), {
    command: 'python3',
    args: ['-m', 'http.server', '8010', '--bind', '127.0.0.1', '--directory', resolve(root, 'prototype')],
  });
});

test('verification detects when an independent prototype folder has no Git repository', () => {
  assert.equal(hasGitRepository('/prototype', () => ({ status: 0 })), true);
  assert.equal(hasGitRepository('/prototype', () => ({ status: 128 })), false);
});

test('worktree plan uses the ignored project directory and a codex branch', () => {
  assert.deepEqual(buildWorktreePlan({ root, slug: 'enterprise-vi-history', baseRef: 'HEAD' }), {
    slug: 'enterprise-vi-history',
    branch: 'codex/enterprise-vi-history',
    path: resolve(root, '.worktrees/codex-enterprise-vi-history'),
    baseRef: 'HEAD',
  });
  assert.throws(() => buildWorktreePlan({ root, slug: '../escape', baseRef: 'HEAD' }), /lowercase task slug/);
});

test('verification supports focused and full profiles without ambiguous combinations', () => {
  assert.deepEqual(parseVerificationOptions(['--focus', 'enterprise-vi', '--browser']), {
    mode: 'focus', focus: 'enterprise-vi', browser: true, capture: '', port: null, allDiff: false, noServeCheck: false, listFocus: false,
  });
  assert.equal(parseVerificationOptions(['--full']).mode, 'full');
  assert.throws(() => parseVerificationOptions(['--full', '--focus', 'enterprise-vi']), /cannot be combined/);
});

test('focused verification selects only mapped tests and its browser capture', () => {
  const manifest = {
    defaultFullCapture: 'prototype/scripts/capture-v1-prototype.mjs',
    desktopOnly: true,
    fullTests: ['hangxiaoxiao-admin-alignment.test.mjs'],
    focuses: {
      'enterprise-vi': {
        tests: ['enterprise-cognition-vi-v1.test.mjs', 'enterprise-ai-operating-brain-prototype.test.mjs'],
        capture: 'prototype/scripts/capture-enterprise-cognition-vi.mjs',
      },
    },
  };
  assert.deepEqual(selectVerificationProfile(manifest, { mode: 'focus', focus: 'enterprise-vi', browser: true, capture: '' }), {
    label: 'enterprise-vi',
    tests: manifest.focuses['enterprise-vi'].tests,
    capture: manifest.focuses['enterprise-vi'].capture,
    browser: true,
    desktopOnly: true,
  });
  assert.deepEqual(selectVerificationProfile(manifest, { mode: 'full', focus: '', browser: true, capture: '' }), {
    label: 'full',
    tests: manifest.fullTests,
    capture: manifest.defaultFullCapture,
    browser: true,
    desktopOnly: true,
  });
});

test('preview health rejects blank or login-covered pages and accepts visible product content', () => {
  assert.deepEqual(assessPreviewHealth({ readyState: 'complete', bodyTextLength: 0, visiblePageCount: 0, loginCovered: false, runtimeErrors: [] }).ok, false);
  assert.match(assessPreviewHealth({ readyState: 'complete', bodyTextLength: 300, visiblePageCount: 1, loginCovered: true, runtimeErrors: [] }).reason, /login overlay/);
  assert.match(assessPreviewHealth({ readyState: 'complete', bodyTextLength: 300, visiblePageCount: 1, loginCovered: false, runtimeErrors: ['ReferenceError'] }).reason, /runtime errors/);
  assert.deepEqual(assessPreviewHealth({ readyState: 'complete', bodyTextLength: 300, visiblePageCount: 1, loginCovered: false, runtimeErrors: [] }), { ok: true, reason: 'visible product content rendered' });
});

test('worktree launcher provides a non-mutating dry run', () => {
  const result = spawnSync(process.execPath, ['prototype/scripts/start-codex-task.mjs', 'workflow-smoke', '--dry-run'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert.equal(output.status, 'DRY_RUN');
  assert.equal(output.plan.branch, 'codex/workflow-smoke');
  assert.equal(output.directoryIgnored, true);
  assert.match(output.baselineMode, /tests|structural-only/);
});

test('verification CLI lists available focus profiles without running the suite', () => {
  const result = spawnSync(process.execPath, ['prototype/scripts/verify-prototype.mjs', '--list-focus'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert.deepEqual(output.focuses.sort(), ['hangxiaoxiao']);
});

test('preview CLI exposes the same non-blank health gate used after opening Chrome', () => {
  const health = JSON.stringify({ readyState: 'complete', bodyTextLength: 250, visiblePageCount: 1, loginCovered: false, runtimeErrors: [] });
  const result = spawnSync(process.execPath, ['prototype/scripts/open-prototype-preview.mjs', '--health-json', health], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { status: 'PASS', reason: 'visible product content rendered' });
});

test('managed verification browser is detached while its health check is running', () => {
  assert.deepEqual(managedBrowserSpawnOptions(), { stdio: 'ignore', detached: true });
  const plan = managedBrowserLaunchPlan({ port: 9228, profileDir: '/tmp/ai-huoke-test', url: 'http://127.0.0.1:8010/index.html' });
  assert.match(plan.command, /chrome-headless-shell$/);
  assert.ok(plan.args.includes('--headless=new'));
  assert.doesNotMatch(plan.command, /Google Chrome\.app/);
});

test('preview opens the requested route in the normal Chrome profile without any isolated browser arguments', () => {
  const url = buildDirectPreviewUrl('http://127.0.0.1:8010/index.html', 'kb');
  assert.equal(url, 'http://127.0.0.1:8010/index.html?review=kb');
  assert.deepEqual(directBrowserOpenPlan(url), {
    command: 'open',
    args: ['-a', 'Google Chrome', 'http://127.0.0.1:8010/index.html?review=kb'],
  });
  assert.equal(directBrowserOpenPlan(url).args.some(arg => arg.includes('--user-data-dir')), false);
  assert.equal(directBrowserOpenPlan(url).args.some(arg => arg.includes('--remote-debugging-port')), false);
});

test('preview retries only when Chrome replaces the initial execution context', async () => {
  let attempts = 0;
  const value = await retryTransientContext(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Execution context was destroyed.');
    return 'ready';
  }, { timeoutMs: 100, intervalMs: 0 });

  assert.equal(value, 'ready');
  assert.equal(attempts, 2);
  await assert.rejects(
    retryTransientContext(async () => { throw new Error('ReferenceError: broken'); }, { timeoutMs: 100, intervalMs: 0 }),
    /ReferenceError: broken/,
  );
});
