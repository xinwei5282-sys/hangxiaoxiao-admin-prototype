import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

export function findHeadlessBrowserPath() {
  const root = join(homedir(), '.cache', 'puppeteer', 'chrome-headless-shell');
  const versions = existsSync(root) ? readdirSync(root).sort().reverse() : [];
  for (const version of versions) {
    const executable = join(root, version, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (existsSync(executable)) return executable;
  }
  throw new Error('Puppeteer headless browser is not installed; cannot run isolated browser verification');
}

export function managedBrowserSpawnOptions() {
  return { stdio: 'ignore', detached: true };
}

export function managedBrowserLaunchPlan({ port, profileDir, url }) {
  return {
    command: findHeadlessBrowserPath(),
    args: [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--disable-extensions',
      url,
    ],
  };
}

export function buildDirectPreviewUrl(baseUrl, route = 'home') {
  const url = new URL(baseUrl);
  url.searchParams.set('review', String(route || 'home'));
  return url.toString();
}

export function directBrowserOpenPlan(url) {
  return { command: 'open', args: ['-a', 'Google Chrome', url] };
}

export function openDirectBrowser(url) {
  const plan = directBrowserOpenPlan(url);
  const result = spawnSync(plan.command, plan.args, { stdio: 'ignore' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`normal Chrome open failed with exit code ${result.status}`);
}

export async function retryTransientContext(action, { timeoutMs = 3000, intervalMs = 80 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return await action();
    } catch (error) {
      if (!String(error?.message || error).includes('Execution context was destroyed') || Date.now() >= deadline) throw error;
      await new Promise(resolveWait => setTimeout(resolveWait, intervalMs));
    }
  }
}

export async function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolvePort(port));
    });
  });
}

export async function waitForPrototypeTarget(port, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(800) });
      const targets = await response.json();
      const target = targets.find(item => item.type === 'page' && item.url.includes('127.0.0.1:8010/index.html'));
      if (target) return target;
      lastError = 'CDP is available but the prototype page is not open';
    } catch (error) {
      lastError = error.message;
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 120));
  }
  throw new Error(`prototype browser target did not become ready on CDP ${port}: ${lastError}`);
}

export async function startManagedBrowser({ url = 'http://127.0.0.1:8010/index.html', port = null } = {}) {
  const selectedPort = port || await findFreePort();
  const profileDir = mkdtempSync(join(tmpdir(), 'ai-huoke-preview-'));
  const plan = managedBrowserLaunchPlan({ port: selectedPort, profileDir, url });
  const browserProcess = spawn(plan.command, plan.args, managedBrowserSpawnOptions());
  browserProcess.unref();
  try {
    const target = await waitForPrototypeTarget(selectedPort);
    return { port: selectedPort, profileDir, browserProcess, target, managed: true };
  } catch (error) {
    browserProcess.kill('SIGTERM');
    rmSync(profileDir, { recursive: true, force: true });
    throw error;
  }
}

export async function stopManagedBrowser(browser) {
  if (!browser?.managed) return;
  const pid = browser.browserProcess?.pid;
  const running = () => { try { process.kill(pid, 0);return true; } catch { return false; } };
  if (pid && running()) { try { process.kill(-pid, 'SIGTERM'); } catch { browser.browserProcess.kill('SIGTERM'); } }
  const deadline = Date.now() + 4000;
  while (pid && running() && Date.now() < deadline) {
    await new Promise(resolveWait => setTimeout(resolveWait, 80));
  }
  if (pid && running()) { try { process.kill(-pid, 'SIGKILL'); } catch { browser.browserProcess.kill('SIGKILL'); } }
  try { rmSync(browser.profileDir, { recursive: true, force: true }); } catch {}
}
