import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../index.html'), 'utf8');

test('primary navigation exposes only the six approved business outcomes', () => {
  const nav = html.match(/<div class="nav" id="nav">([\s\S]*?)<\/div><\/nav>/)?.[1] ?? '';
  const topLevelRoutes = [...nav.matchAll(/<button type="button" data-v="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(topLevelRoutes, [
    'home',
    'brand-planning',
    'marketing-materials',
    'acquisition',
    'kb',
    'settings'
  ]);
  assert.match(nav, />AI 混剪<\/button>[\s\S]*?>营销视频<\/button>/);
  assert.doesNotMatch(nav, /移动端体验/);
});

test('removed duplicate and internal demo workspaces are unreachable', () => {
  for (const route of [
    'enterprise-profile',
    'mobile-experience',
    'tasks',
    'sales-agent',
    'review',
    'automation',
    'local-codex'
  ]) {
    assert.doesNotMatch(html, new RegExp(`data-p="${route}"`), `${route} must be removed`);
  }
});

test('customer pages do not expose internal architecture promotion or fake mobile actions', () => {
  assert.doesNotMatch(html, /统一内容底座/);
  assert.doesNotMatch(html, /Content Factory V1/);
  assert.doesNotMatch(html, /生成二维码（原型占位）/);
});

test('channel delivery boundaries remain explicit after distillation', () => {
  const materials = html.match(/<section class="page" data-p="marketing-materials">([\s\S]*?)<section class="page" data-p="acquisition"/)?.[1] ?? '';

  assert.match(materials, /data-act="export-graphic" data-channel="moments"/);
  assert.doesNotMatch(materials, /data-channel="moments"[^>]*data-act="publish/);
  assert.match(materials, /data-act="export-poster"/);
  assert.match(materials, /data-act="publish-wechat"/);
  assert.match(materials, /data-wechat-results/);
});
