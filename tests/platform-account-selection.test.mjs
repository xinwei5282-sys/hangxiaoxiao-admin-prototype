import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadPlatformAccounts() {
  const source = html.match(/const PLATFORM_ACCOUNTS=[\s\S]*?(?=\nfunction getPublishingAccounts)/)?.[0] || '';
  assert.ok(source, 'platform account registry is missing');
  return Function(`${source};return PLATFORM_ACCOUNTS;`)();
}

test('WeChat, Douyin, and Xiaohongshu each support multiple bound accounts', () => {
  const accounts = loadPlatformAccounts();
  for (const platform of ['wechat', 'douyin', 'xiaohongshu']) {
    assert.ok(accounts[platform].length >= 2, `${platform} must support multiple accounts`);
    assert.equal(new Set(accounts[platform].map(item => item.id)).size, accounts[platform].length);
  }
});

test('every bound publishing account can use RPA and rejects unsupported methods', () => {
  const accounts = loadPlatformAccounts();
  for (const platform of ['wechat', 'douyin', 'xiaohongshu']) {
    for (const account of accounts[platform]) assert.ok(account.publishMethods.includes('rpa'), `${account.name} lacks RPA`);
  }
  const source = html.match(/function resolvePublishingMethod\([^\n]*/)?.[0] || '';
  assert.ok(source, 'publishing method resolver is missing');
  const resolve = Function(`${source};return resolvePublishingMethod;`)();
  assert.equal(resolve({ publishMethods: ['rpa', 'manual'] }, 'rpa'), 'rpa');
  assert.equal(resolve({ publishMethods: ['rpa', 'manual'] }, 'api'), 'rpa');
  assert.equal(resolve({ publishMethods: [] }, 'api'), 'manual');
});

test('RPA publishing requires confirmation and supports failure retry transitions', () => {
  const source = html.match(/function nextRpaPublishState\([^\n]*/)?.[0] || '';
  assert.ok(source, 'RPA state transition is missing');
  const next = Function(`${source};return nextRpaPublishState;`)();
  assert.equal(next('queued', 'confirm'), 'running');
  assert.equal(next('running', 'failure'), 'failed');
  assert.equal(next('failed', 'retry'), 'running');
  assert.equal(next('running', 'success'), 'success');
  assert.equal(next('success', 'retry'), 'success');

  const flow = html.match(/function startWechatRpaPublish\([\s\S]*?(?=\nfunction syncWechatArticleResults)/)?.[0] || '';
  assert.match(flow, /确认启动 RPA 发布/);
  assert.match(flow, /启动前人工确认/);
  assert.match(flow, /retry-wechat-rpa/);
  assert.match(flow, /失败原因/);

  const acquisitionFlow = html.match(/function publishAcquisitionTask\([\s\S]*?(?=\nfunction syncWechatArticleResults)/)?.[0] || '';
  assert.match(acquisitionFlow, /确认启动 RPA 发布/);
  assert.match(acquisitionFlow, /retry-acquisition-rpa/);
});

test('article result growth is calculated per article instead of using one global result', () => {
  const source = html.match(/function nextWechatArticleMetrics\([^\n]*/)?.[0] || '';
  assert.ok(source, 'per-article metric calculator is missing');
  const next = Function(`${source};return nextWechatArticleMetrics;`)();
  assert.deepEqual(next(null), { reads: 1286, shares: 46 });
  assert.deepEqual(next({ reads: 1286, shares: 46 }), { reads: 1314, shares: 48 });
});

test('article and acquisition composers require a concrete publishing account', () => {
  const graphicComposer = html.match(/function openGraphicComposer\(channel\)\{[\s\S]*?(?=\nfunction openMomentsComposer)/)?.[0] || '';
  const acquisitionComposer = html.match(/function openAcquisitionTaskComposer\(\)\{[\s\S]*?(?=\nfunction )/)?.[0] || '';
  assert.match(graphicComposer, /graphicPublishingAccount/);
  assert.match(graphicComposer, /graphicPublishingMethod/);
  assert.match(graphicComposer, /wechatAccountId/);
  assert.match(acquisitionComposer, /acquisitionPublishingAccount/);
  assert.match(acquisitionComposer, /acquisitionPublishingMethod/);
  assert.match(acquisitionComposer, /发布账号/);
  assert.match(html, /createTask\.dataset\.act='new-acquisition-task'/);
});

test('WeChat results are rendered into their article row and the global result panel is removed at runtime', () => {
  const upgrade = html.match(/function upgradePublishingAccountExperience\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  const sync = html.match(/function syncWechatArticleResults\([^\n]*/)?.[0] || '';
  assert.match(upgrade, /wechatResultPanel[^\n]*remove/);
  for (const token of ['data-wechat-read', 'data-wechat-share']) assert.match(sync, new RegExp(token));
  assert.doesNotMatch(sync, /data-wechat-(?:like|follow)/);
  assert.match(sync, /row\.dataset\.wechatMetrics/);
  assert.doesNotMatch(upgrade, /<th>文章数据<\/th>/);
});
