import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('PC shell keeps its established layout tokens', () => {
  for (const token of ['--sidebar-w:228px', '--topbar-h:56px', '--page-pad:28px', '--panel-radius:6px', '--control-h:36px', '--row-h:44px']) assert.ok(html.includes(token), `missing ${token}`);
  assert.doesNotMatch(html, /(?:html|body|\.app)\{[^}]*min-width:\s*1024px/);
  assert.match(html, /@media\(max-width:560px\)[\s\S]*min-height:44px/);
  assert.match(html, /PingFang SC.*HarmonyOS Sans SC.*Microsoft YaHei/);
});

test('navigation is grouped into six customer outcomes', () => {
  for (const group of ['workspace', 'content', 'assets']) assert.match(html, new RegExp(`data-nav-group="${group}"`));
  const nav = html.match(/<nav>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  assert.equal((nav.match(/<button type="button" data-v=/g) || []).length, 6);
  assert.doesNotMatch(nav, /data-v="enterprise-profile"/);
  assert.doesNotMatch(nav, /<button type="button"[^>]*data-v="(?:review|agent-center|local-codex|artifacts)"/);
  assert.match(nav, /data-nav-sub="acquisition"[\s\S]*?数字人/);
});

test('shared PC components and responsive workspaces remain available', () => {
  for (const cls of ['app-page-header', 'metric-grid', 'status-row', 'task-table', 'workspace-header', 'workspace-toolbar', 'workspace-surface', 'subnav', 'subview']) assert.match(html, new RegExp(cls));
  assert.match(html, /\.page\{[^}]*max-width:none/);
});

test('home is diagnosis-first while deeper operating tools remain reachable', () => {
  assert.match(html, /经营总览/);
  assert.match(html, /补齐企业资料，生成可信的基础诊断/);
  assert.doesNotMatch(html, /<div class="t">企业 Agent 经营驾驶舱<\/div>/);
  for (const page of ['plan', 'kb', 'acquisition']) assert.match(html, new RegExp(`data-p="${page}"`));
  for (const removed of ['tasks', 'review']) assert.doesNotMatch(html, new RegExp(`data-p="${removed}"`));
});
