import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const nav = html.match(/<nav>([\s\S]*?)<\/nav>/)?.[1] ?? '';

test('prototype presents the general enterprise AI operating brain', () => {
  assert.match(html, /<title>企业 AI 经营大脑 · 产品原型<\/title>/);
  assert.match(html, /<b>企业 AI 经营大脑<\/b>/);
  assert.match(html, /中小企业经营知识与内容执行平台/);
});

test('customer navigation has exactly six business entries', () => {
  const entries = ['首页', '品牌与经营', '营销物料', 'AI 获客', '企业大脑', '设置'];
  assert.equal((nav.match(/<button type="button" data-v=/g) || []).length, 6);
  for (const entry of entries) assert.match(nav, new RegExp(`>${entry}(?:<|$)`));
  for (const removed of ['企业档案', '成果中心', '作品库', '本地工作台']) assert.doesNotMatch(nav, new RegExp(`>${removed}<`));
  for (const removedGroup of ['经营', '增长', '资产与管理']) assert.doesNotMatch(nav, new RegExp(`<div class="grp">${removedGroup}<\/div>`));
});

test('approved secondary navigation is grouped in the left rail', () => {
  for (const phrase of ['诊断总览', '企业 VI', '企业知识', '外部情报', '进化与治理', '品牌报告', '经营计划', 'PPT', '海报', '公众号文章', '获客计划', '爆款追踪', 'AI 混剪', '营销视频', '企业设置', '成员与权限', '平台账号', 'Agent 权限', '用量与套餐', '帮助与服务']) {
    assert.match(nav, new RegExp(phrase), `missing left navigation entry: ${phrase}`);
  }
  assert.doesNotMatch(nav, /data-nav-sub="enterprise-profile"/);
  const brainNav=nav.match(/data-nav-sub="kb"([\s\S]*?)<\/div>/)?.[1]||'';
  assert.equal((brainNav.match(/<button/g)||[]).length,5);
  assert.equal([...brainNav.matchAll(/>([^<>]+)<\/button>/g)].map(match=>match[1]).join('|'), '诊断总览|企业 VI|企业知识|外部情报|进化与治理');
  for (const parent of ['brand-planning', 'marketing-materials', 'acquisition', 'kb', 'settings']) assert.match(nav, new RegExp(`data-nav-sub="${parent}"`));
  assert.match(html, /\.nav-sub\{display:grid/);
  assert.match(html, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /\.nav-sub\{[^}]*border-left:0/);
  assert.doesNotMatch(html, /\.nav-sub\{display:none/);
  assert.match(html, /\.main \.subnav\{display:none\}/);
});

test('enterprise brain exposes five non-duplicated responsibility panels', () => {
  for (const panel of ['diagnosis', 'cognition', 'content', 'intelligence', 'evolution']) {
    assert.equal((html.match(new RegExp(`data-kbpanel="${panel}"`, 'g')) || []).length, 1, `unexpected ${panel} panel count`);
  }
  for (const phrase of ['企业信息完整度', '企业偏好与视觉规范', '系统生成内容立即成为正式知识', '当前采集范围', '修改、发布、删除与学习候选']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /function mountEnterpriseBrainPanels\(\)/);
  assert.match(html, /function showKbTab\(id='diagnosis'\)/);
});

test('enterprise knowledge data tabs are hidden when another brain panel is active', () => {
  const showTab = html.match(/function showKbTab\(id='diagnosis'\)\{[\s\S]*?(?=\nfunction placeKbDataView)/)?.[0] ?? '';
  assert.match(showTab, /const dataView=\$\('#kbDataView'\);if\(dataView\)dataView\.style\.display='none';/);
  assert.match(showTab, /if\(active==='content'\)\{[\s\S]*?dataView\.style\.display=/);
});

test('legacy knowledge blueprint updates tolerate panels removed by the enterprise brain migration', () => {
  const block = html.match(/function applyKnowledgeBlueprint\(kind\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(block, /const coverage=\$\('#kbCoverageStrip'\);if\(coverage\)coverage\.innerHTML=/);
});

test('Agent permissions are a settings sub-entry rather than a customer top-level menu', () => {
  assert.doesNotMatch(nav, /<button type="button"[^>]*data-v="agent-center"/);
  assert.match(nav, /data-nav-sub="settings"[\s\S]*?data-v="agent-center"[\s\S]*?Agent 权限/);
  assert.match(html, /统一约束知识、数据、动作与结果边界/);
});

test('Geyou stays a configurable large customer', () => {
  for (const phrase of ['格优大客户模式', '殡葬行业配置包', '90 天试点模板']) assert.match(html, new RegExp(phrase));
  assert.doesNotMatch(html, /90 天经营计划书/u);
});

test('AI acquisition is a PC test capability with the approved video gates', () => {
  for (const phrase of ['能力演示 · 待接入', '爆款追踪', '相对基线', '八维拆解', '封面、脚本与分镜确认', '确认并生成成片', '只重试失败镜头', 'MP4 成片']) assert.match(html, new RegExp(phrase));
});

test('unverified integrations are not presented as live', () => {
  assert.doesNotMatch(nav, /<button type="button"[^>]*data-v="(?:local-codex|agent-center)"/u);
  assert.doesNotMatch(html, /本地 Codex 已连接|设备在线|自动发布成功/u);
  assert.match(html, /能力演示 · 待接入/u);
});
