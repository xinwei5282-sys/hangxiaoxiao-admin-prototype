import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function hasGitRepository(root, run = spawnSync) {
  return run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' }).status === 0;
}

export function buildWorktreePlan({ root, slug, baseRef = 'HEAD' }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ''))) {
    throw new Error('Use a lowercase task slug containing only letters, numbers, and hyphens.');
  }
  return {
    slug,
    branch: `codex/${slug}`,
    path: resolve(root, `.worktrees/codex-${slug}`),
    baseRef,
  };
}

export function parseVerificationOptions(args) {
  const focusIndex = args.indexOf('--focus');
  const captureIndex = args.indexOf('--capture');
  const portIndex = args.indexOf('--port');
  const full = args.includes('--full');
  const focus = focusIndex >= 0 ? String(args[focusIndex + 1] || '') : '';
  if (full && focus) throw new Error('--full and --focus cannot be combined');
  return {
    mode: full ? 'full' : focus ? 'focus' : 'standard',
    focus,
    browser: args.includes('--browser') || full,
    capture: captureIndex >= 0 ? String(args[captureIndex + 1] || '') : '',
    port: portIndex >= 0 ? Number(args[portIndex + 1]) : null,
    allDiff: args.includes('--all-diff'),
    noServeCheck: args.includes('--no-serve-check'),
    listFocus: args.includes('--list-focus'),
  };
}

export function selectVerificationProfile(manifest, options) {
  if (options.mode === 'focus') {
    const focus = manifest.focuses?.[options.focus];
    if (!focus) throw new Error(`unknown verification focus: ${options.focus}`);
    return {
      label: options.focus,
      tests: focus.tests || [],
      capture: options.capture || focus.capture || '',
      browser: Boolean(options.browser),
      desktopOnly: Boolean(focus.desktopOnly ?? manifest.desktopOnly),
    };
  }
  return {
    label: options.mode,
    tests: options.mode === 'full' ? manifest.fullTests || [] : [],
    capture: options.capture || (options.mode === 'full' ? manifest.defaultFullCapture || '' : ''),
    browser: Boolean(options.browser || options.capture),
    desktopOnly: Boolean(manifest.desktopOnly),
  };
}

export function assessPreviewHealth({ readyState, bodyTextLength, visiblePageCount, loginCovered, runtimeErrors = [] }) {
  if (runtimeErrors.length) return { ok: false, reason: `runtime errors: ${runtimeErrors.join(' | ')}` };
  if (readyState !== 'complete' && readyState !== 'interactive') return { ok: false, reason: `document is not ready (${readyState || 'unknown'})` };
  if (loginCovered) return { ok: false, reason: 'login overlay still covers the product preview' };
  if (bodyTextLength < 80 || visiblePageCount < 1) return { ok: false, reason: `blank preview (text=${bodyTextLength}, visiblePages=${visiblePageCount})` };
  return { ok: true, reason: 'visible product content rendered' };
}
