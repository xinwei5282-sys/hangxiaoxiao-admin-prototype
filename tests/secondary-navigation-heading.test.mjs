import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadResolver() {
  const source = html.match(/const SECONDARY_NAVIGATION_HEADINGS=[\s\S]*?(?=\nfunction setNavigationHeading)/)?.[0] || '';
  assert.ok(source, 'secondary navigation heading resolver is missing');
  return Function(`${source};return resolveSecondaryNavigationHeading;`)();
}

test('secondary navigation resolves to its own title without repeating the parent title', () => {
  const resolveHeading = loadResolver();
  assert.deepEqual(resolveHeading('material-wechat'), ['公众号文章', '创作 · 审核 · 自动发布 · 数据回收']);
  assert.deepEqual(resolveHeading('cognition'), ['企业 VI', '企业偏好 · 方向选择 · 版本启用']);
  assert.deepEqual(resolveHeading('brand-report'), ['品牌报告', '诊断依据 · 版本 · 下载']);
  assert.deepEqual(resolveHeading('operating-plan'), ['经营计划', '公司全盘 · 人工审核 · 月度跟踪 · 季度复盘']);
  assert.deepEqual(resolveHeading('setting-company'), ['企业设置', '企业信息 · 经营周期 · 审核要求']);
  assert.equal(resolveHeading('marketing-materials'), null);
});

test('secondary navigation keeps the parent in the top bar and writes the child into the content heading', () => {
  const setNavigationHeading = html.match(/function setNavigationHeading\(route[^\n]*/)?.[0] || '';
  const setContentHeading = html.match(/function setContentHeading\([^\n]*/)?.[0] || '';
  const switchSubview = html.match(/function switchSubview\(name,trigger\)\{[\s\S]*?\n\}/)?.[0] || '';
  const showKbTab = html.match(/function showKbTab\(id='diagnosis'\)\{[\s\S]*?(?=\nfunction placeKbDataView)/)?.[0] || '';
  assert.match(setNavigationHeading, /titles\[route\]/);
  assert.doesNotMatch(setNavigationHeading, /resolveSecondaryNavigationHeading/);
  assert.match(setContentHeading, /resolveSecondaryNavigationHeading/);
  assert.match(switchSubview, /setNavigationHeading\(page\.dataset\.p\)/);
  assert.match(switchSubview, /setContentHeading\([^)]*name/);
  assert.match(showKbTab, /setNavigationHeading\('kb'\)/);
  assert.match(showKbTab, /setContentHeading\([^)]*active/);
  assert.doesNotMatch(html, /\.page\.secondary-active\s*>\s*\.lead\{display:none\}/);
});

test('secondary panels remove their internal duplicate heading while retaining the action row', () => {
  const source = html.match(/function pruneRedundantSecondaryHeadings\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(source, 'duplicate secondary heading cleanup is missing');
  const removed = [];
  const decorated = [];
  const leads = Array.from({ length: 4 }, (_, index) => ({
    querySelector: () => ({ remove: () => removed.push(index) }),
    classList: { add: value => decorated.push([index, value]) }
  }));
  let queriedSelector = '';
  let helpRemoved = false;
  const document = {
    querySelectorAll(selector) { queriedSelector = selector; return leads; },
    querySelector(selector) { return selector.includes('setting-help') ? { remove: () => { helpRemoved = true; } } : null; }
  };
  Function('document', `${source};pruneRedundantSecondaryHeadings();`)(document);
  for (const panel of ['brand-report', 'operating-plan', 'material-ppt', 'evolution']) assert.match(queriedSelector, new RegExp(panel));
  assert.doesNotMatch(queriedSelector, /intelligence/);
  assert.equal(removed.length, 4);
  assert.deepEqual(decorated.map(([, value]) => value), Array(4).fill('panel-actions'));
  assert.equal(helpRemoved, true);
});

test('VI, intelligence, and evolution hide unrelated upload and agent actions', () => {
  assert.match(html, /data-kb-primary-actions/);
  const source = html.match(/function showKbTab\([\s\S]*?(?=\nfunction showKbDataView)/)?.[0] || '';
  assert.match(source, /\['cognition','intelligence','evolution'\]/);
  assert.match(source, /kbPrimaryActions/);
});

test('external intelligence actions share the secondary page title row', () => {
  const page = html.match(/<section class="page" data-p="kb"[\s\S]*?<div class="kb-panel show" data-kbpanel="overview">/)?.[0] || '';
  const pageLead = page.match(/<div class="lead">[\s\S]*?<div class="subnav">/)?.[0] || '';
  const intelligencePanel = page.match(/<div class="kb-panel" data-kbpanel="intelligence">[\s\S]*?(?=<div class="kb-panel" data-kbpanel="evolution">)/)?.[0] || '';
  assert.match(pageLead, /data-intelligence-primary-actions/);
  assert.match(pageLead, /添加公开链接[\s\S]*采集公开网站/);
  assert.doesNotMatch(intelligencePanel, /data-act="(?:add|collect)-brain-intelligence"/);
  const source = html.match(/function showKbTab\([\s\S]*?(?=\nfunction showKbDataView)/)?.[0] || '';
  assert.match(source, /intelligencePrimaryActions/);
});

test('PPT create action shares the page title row and follows the active material view', () => {
  const page = html.match(/<section class="page" data-p="marketing-materials">([\s\S]*?)<section class="page" data-p="acquisition"/)?.[1] || '';
  const pageLead = page.match(/<div class="lead">[\s\S]*?<div class="subnav">/)?.[0] || '';
  const pptPanel = page.match(/data-subview-panel="material-ppt">([\s\S]*?)data-subview-panel="material-moments"/)?.[1] || '';
  assert.match(pageLead, /data-material-primary-action="material-ppt"[\s\S]*>\s*新建 PPT\s*<\/button>/);
  assert.doesNotMatch(pptPanel, />\s*新建 PPT\s*<\/button>/);
  const switchSubview = html.match(/function switchSubview\(name,trigger\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(switchSubview, /syncMaterialPrimaryAction\(name\)/);
  assert.match(html, /function syncMaterialPrimaryAction/);
});
