import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildWorktreePlan } from './lib/codex-workflow.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const slug = args.find(item => !item.startsWith('--')) || '';
const baseIndex = args.indexOf('--base');
const baseRef = baseIndex >= 0 ? String(args[baseIndex + 1] || 'HEAD') : 'HEAD';
const dryRun = args.includes('--dry-run');

function git(commandArgs, options = {}) {
  return spawnSync('git', commandArgs, { cwd: root, encoding: 'utf8', ...options });
}

function fail(message) {
  process.stderr.write(`${JSON.stringify({ status: 'FAIL', error: message }, null, 2)}\n`);
  process.exit(1);
}

let plan;
try {
  plan = buildWorktreePlan({ root, slug, baseRef });
} catch (error) {
  fail(error.message);
}

const ignored = git(['check-ignore', '-q', '.worktrees']).status === 0;
if (!ignored) fail('.worktrees is not ignored; add it to .gitignore before creating a linked worktree');
const sourceDirtyCount = git(['status', '--porcelain']).stdout.trim().split('\n').filter(Boolean).length;
const branchExists = git(['show-ref', '--verify', '--quiet', `refs/heads/${plan.branch}`]).status === 0;
const pathExists = existsSync(plan.path);
const trackedTests = git(['cat-file', '-e', `${plan.baseRef}:prototype/tests`]).status === 0;
const baselineMode = trackedTests ? 'tests' : 'structural-only';

if (dryRun) {
  process.stdout.write(`${JSON.stringify({ status: 'DRY_RUN', plan, directoryIgnored: ignored, sourceDirtyCount, branchExists, pathExists, baselineMode }, null, 2)}\n`);
  process.exit(0);
}
if (branchExists || pathExists) fail(branchExists ? `branch already exists: ${plan.branch}` : `worktree path already exists: ${plan.path}`);

const created = git(['worktree', 'add', plan.path, '-b', plan.branch, plan.baseRef], { stdio: 'inherit' });
if (created.status !== 0) fail(`git worktree add failed with exit code ${created.status}`);

if (trackedTests) {
  const tests = readdirSync(resolve(plan.path, 'prototype/tests')).filter(name => name.endsWith('.test.mjs')).sort().map(name => resolve(plan.path, 'prototype/tests', name));
  const baseline = spawnSync(process.execPath, ['--test', '--test-reporter=dot', ...tests], { cwd: plan.path, stdio: 'inherit' });
  if (baseline.status !== 0) fail(`worktree was created but baseline tests failed with exit code ${baseline.status}`);
} else {
  if (!existsSync(resolve(plan.path, 'prototype/index.html'))) fail('worktree was created but prototype/index.html is missing from the base ref');
  const structural = spawnSync('git', ['diff', '--check'], { cwd: plan.path, stdio: 'inherit' });
  if (structural.status !== 0) fail(`worktree was created but structural baseline failed with exit code ${structural.status}`);
}

process.stdout.write(`${JSON.stringify({ status: 'READY', plan, sourceDirtyCount, baseline: trackedTests ? 'PASS' : 'PASS (structural-only; base ref has no tracked prototype tests)', note: sourceDirtyCount ? 'source checkout was dirty; uncommitted changes were not copied into the isolated worktree' : 'source checkout was clean' }, null, 2)}\n`);
