import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hasGitRepository, parseVerificationOptions, selectVerificationProfile } from './lib/codex-workflow.mjs';
import { startManagedBrowser, stopManagedBrowser, waitForPrototypeTarget } from './lib/managed-browser.mjs';
import { ensurePrototypeServer } from './lib/prototype-server.mjs';

const root = resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(resolve(root, 'prototype/verification-manifest.json'), 'utf8'));
let options;
try {
  options = parseVerificationOptions(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'FAIL', error: error.message }, null, 2)}\n`);
  process.exit(1);
}

if (options.listFocus) {
  process.stdout.write(`${JSON.stringify({ focuses: Object.keys(manifest.focuses || {}).sort() }, null, 2)}\n`);
  process.exit(0);
}

const profile = selectVerificationProfile(manifest, options);
const results = [];
let managedBrowser = null;

function run(label, command, commandArgs) {
  process.stdout.write(`\n[RUN] ${label}\n`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
  results.push({ label, status: 'PASS' });
}

function selectedTests() {
  const names = profile.tests.length ? profile.tests : readdirSync(resolve(root, 'prototype/tests')).filter(name => name.endsWith('.test.mjs')).sort();
  return names.map(name => resolve(root, 'prototype/tests', name));
}

async function browserPort() {
  if (options.port) {
    await waitForPrototypeTarget(options.port, 2500);
    results.push({ label: `existing browser CDP ${options.port}`, status: 'PASS' });
    return options.port;
  }
  managedBrowser = await startManagedBrowser({ url: 'http://127.0.0.1:8010/index.html' });
  results.push({ label: `isolated browser CDP ${managedBrowser.port}`, status: 'PASS' });
  return managedBrowser.port;
}

try {
  run(profile.tests.length ? `focused tests: ${profile.label}` : 'all prototype tests', process.execPath, ['--test', '--test-reporter=dot', ...selectedTests()]);
  if (hasGitRepository(root)) {
    run(options.allDiff ? 'git diff check (entire repository)' : 'git diff check (prototype scope)', 'git', ['diff', '--check', ...(options.allDiff ? [] : ['--', 'prototype'])]);
  } else {
    results.push({ label: 'git diff check', status: 'SKIPPED (independent prototype folder is not a Git repository)' });
  }

  if (options.noServeCheck) {
    results.push({ label: 'served source', status: 'SKIPPED (--no-serve-check)' });
  } else {
    const server = await ensurePrototypeServer(root);
    results.push({ label: 'served source matches prototype/index.html', status: 'PASS', sha256: server.sha256, server: server.server });
  }

  if (profile.browser) {
    if (!profile.capture) throw new Error(`browser verification has no capture script for profile ${profile.label}`);
    const port = await browserPort();
    const script = resolve(root, profile.capture);
    run('desktop browser capture 1440x900', process.execPath, [script, '--port', String(port), '--width', '1440', '--height', '900']);
    if (profile.desktopOnly) run('wide desktop browser capture 2560x1440', process.execPath, [script, '--port', String(port), '--width', '2560', '--height', '1440']);
    if (profile.desktopOnly) results.push({ label: 'mobile browser capture', status: 'OUT OF SCOPE (PC-only prototype)' });
    else run('mobile browser capture 390x844', process.execPath, [script, '--port', String(port), '--width', '390', '--height', '844']);
  } else {
    results.push({ label: 'real browser capture', status: options.mode === 'focus' ? 'NOT RUN (add --browser)' : 'NOT RUN (use --full, --browser, or --capture <script>)' });
  }

  process.stdout.write(`\n${JSON.stringify({ status: 'PASS', profile: profile.label, results }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`\n${JSON.stringify({ status: 'FAIL', profile: profile.label, error: error.message, results }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (managedBrowser) await stopManagedBrowser(managedBrowser);
}
