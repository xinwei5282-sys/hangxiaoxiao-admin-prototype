import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mobile = readFileSync(new URL('../mobile.html', import.meta.url), 'utf8');

test('backoffice no longer exposes the unfinished mobile H5 from customer navigation', () => {
  const navigation = html.match(/<nav>[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.doesNotMatch(navigation, /移动端体验|mobile\.html/);
  assert.doesNotMatch(html, /data-p="mobile-experience"/);
  for (const token of ['结果先行', '快速画像', '企业诊断', '最近成果', '移动端导航', '和 AI 说说企业', '对话式企业补充']) assert.match(mobile, new RegExp(token));
  assert.match(mobile, /viewport-fit=cover/);
  assert.match(mobile, /env\(safe-area-inset-bottom\)/);
  assert.match(mobile, /min-height:48px/);
});

test('backoffice shell keeps the approved compact system', () => {
  for (const token of [
    '--sidebar-w:228px', '--topbar-h:56px', '--page-pad:28px',
    '--panel-radius:6px', '--control-h:36px', '--row-h:44px',
    '--drawer-w:560px', '--motion-fast:140ms', '--motion-base:220ms'
  ]) assert.ok(html.includes(token), `missing ${token}`);
  assert.match(html, /PingFang SC.*HarmonyOS Sans SC.*Microsoft YaHei/);
});

test('home is result-first without a duplicate chat cockpit', () => {
  const home = html.match(/<section class="page show" data-p="home"([\s\S]*?)<section class="page" data-p="plan">/)?.[1] ?? '';
  for (const label of ['当前最重要', '需要老板审批', '本周期结果', '继续补充', '审核文章', '查看 VI']) {
    assert.match(home, new RegExp(label));
  }
  assert.doesNotMatch(home, /id="agentPrompt"|agent-command-bar|企业 Agent 学习建议/);
  assert.match(home, /home-priority-card/);
  assert.equal((home.match(/class="card pad/g) || []).length, 3);
});

test('AI acquisition is a task workspace rather than a feature-card launcher', () => {
  const section = html.match(/<section class="page" data-p="acquisition"([\s\S]*?)<section class="page" data-p="settings">/)?.[1] ?? '';
  assert.match(section, /class="workspace-toolbar"/);
  assert.match(section, /class="workspace-surface"/);
  for (const label of ['任务名称', '当前阶段', '知识依据', '人工确认']) assert.match(section, new RegExp(label));
  for (const cls of ['workspace-summary', 'workspace-frame', 'workspace-aside', 'workspace-state']) assert.match(section, new RegExp(cls));
  assert.match(section, /id="acquisitionLoading"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(section, /id="acquisitionError"[^>]*role="alert"/);
  assert.match(html, /function refreshAcquisition\(/);
  assert.doesNotMatch(section, /class="outcome-grid"/);
});

test('marketing material workspace keeps only channel work and honest delivery boundaries', () => {
  const section = html.match(/<section class="page" data-p="marketing-materials"([\s\S]*?)<section class="page" data-p="acquisition"/)?.[1] ?? '';
  for (const label of ['PPT', '朋友圈图文', '海报', '公众号文章', '导出图文包', '审核并发布', '发布与数据回收']) assert.match(section, new RegExp(label));
  assert.doesNotMatch(section, /data-content-factory="shared"|统一内容底座|Content Factory V1/);
});

test('enterprise brain follows the governed diagnosis-to-evolution flow', () => {
  const section = html.match(/<section class="page" data-p="kb"([\s\S]*?)<section class="page" data-p="avatar"/)?.[1] ?? '';
  for (const label of ['诊断总览', '企业 VI', '企业知识', '外部情报', '进化与治理', '正式知识', '资料与待处理', '待确认', '维护中心', '版本冲突', '即将到期', '负责人']) {
    assert.match(section, new RegExp(label));
  }
  for (const state of ['待确认', '处理中', '处理失败', '严格受限']) assert.match(html, new RegExp(state));
  assert.match(section, /来源：2026 产品报价\.xlsx/);
  assert.match(section, /修改会提示受影响的 Agent 与工作流/);
});

test('enterprise knowledge exposes intake evidence and an honest governance boundary', () => {
  const section = html.match(/<section class="page" data-p="kb"([\s\S]*?)<section class="page" data-p="avatar"/)?.[1] ?? '';
  for (const label of ['AI 已了解的企业信息', '企业身份', '业务、产品与客户', '获客与经营', '目标、资源与品牌', '资料与待处理', '企业知识可用性']) {
    assert.match(section, new RegExp(label));
  }
  for (const decision of ['auto_usable', 'draft_only', 'quarantined']) assert.match(html, new RegExp(decision));
  assert.match(html, /function renderEnterpriseKnowledgeOverview/);
  assert.match(html, /function renderKnowledgeEvidenceSummary/);
  assert.match(section, /原型演示 · 待接入/);
});

test('enterprise brain keeps the approved five-entry navigation', () => {
  const section = html.match(/<section class="page" data-p="kb"([\s\S]*?)<section class="page" data-p="avatar"/)?.[1] ?? '';
  const subnav = section.match(/<div class="subnav">([\s\S]*?)<\/div>/)?.[1] ?? '';
  for (const label of ['诊断总览', '企业 VI', '企业知识', '外部情报', '进化与治理']) assert.match(subnav, new RegExp(label));
  for (const label of ['资料与待处理', '正式知识']) assert.doesNotMatch(subnav, new RegExp(label));
  assert.match(section, /id="kbDataView"/);
  assert.match(section, /企业大脑/);
  assert.match(section, /class="kb-data-tabs"/);
  assert.match(html, /function showKbDataView/);
  assert.match(html, /function placeKbDataView/);
  assert.match(section, /data-act="kb-data-tab"/);
  for (const label of ['资料与待处理', '正式知识']) assert.match(section, new RegExp('data-act="kb-data-tab"[^>]*>[^<]*'+label));
});

test('enterprise brain keeps source actions available', () => {
  const section = html.match(/<section class="page" data-p="kb"([\s\S]*?)<section class="page" data-p="avatar"/)?.[1] ?? '';
  const lead = section.match(/<div class="lead">([\s\S]*?)<\/div>\s*<div class="subnav">/)?.[1] ?? '';
  assert.match(lead, /连接数据源|上传资料|上传企业资料/);
});

test('knowledge tabs do not duplicate source actions after the tab strip', () => {
  const section = html.match(/<section class="page" data-p="kb"([\s\S]*?)<section class="page" data-p="avatar"/)?.[1] ?? '';
  const dataView = section.match(/<div class="card pad" id="kbDataView"([\s\S]*?)<\/div>\s*<div class="card pad">/)?.[0] ?? '';
  assert.doesNotMatch(dataView, /连接数据源/);
  assert.doesNotMatch(dataView, /data-act="open-kb-upload"/);
  assert.doesNotMatch(dataView, /知识库内容和待确认统一在这里处理/);
  assert.match(html, /\.kb-data-tabs\{display:flex;align-items:center;gap:2px;flex-wrap:wrap;border-bottom/);
});

test('uploaded source candidates are inserted into the source-centered work queue', () => {
  assert.match(html, /id="knowledgeWorkQueue"/);
  assert.match(html, /function appendKbReviewCandidate/);
  assert.match(html, /appendKbReviewCandidate\(f,ty\)/);
  assert.match(html, /来源定位/);
});

test('standard drawer and interaction states are accessible', () => {
  assert.match(html, /id="detailDrawer"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /function openDrawer\(/);
  assert.match(html, /function closeDrawer\(/);
  assert.match(html, /data-act="open-drawer"/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /\.inp:focus-visible/);
});

test('primary navigation and form labels use native accessible semantics', () => {
  const navigation = html.match(/<nav>[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.doesNotMatch(navigation, /<a(?![^>]*\bhref=)[^>]*data-v=/);
  for (const route of ['home', 'brand-planning', 'marketing-materials', 'acquisition', 'kb', 'settings']) {
    assert.match(navigation, new RegExp(`<button[^>]*type="button"[^>]*data-v="${route}"`));
  }
  assert.doesNotMatch(navigation, /data-v="enterprise-profile"/);
  assert.match(html, /function bindFormLabels\(\)/);
  assert.match(html, /label\.htmlFor=control\.id/);
  assert.match(html, /bindFormLabels\(\);/);
});

test('the V1.0 style layer contains no raw hexadecimal colors', () => {
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
  assert.doesNotMatch(styles, /#[0-9a-fA-F]{3,8}\b/);
});

test('narrow layouts do not force page-wide desktop width', () => {
  assert.doesNotMatch(html, /html\{[^}]*min-width:1024px/);
  assert.doesNotMatch(html, /body\{[^}]*min-width:1024px/);
  assert.doesNotMatch(html, /\.app\{[^}]*min-width:1024px/);
  assert.match(html, /@media\(max-width:560px\)[\s\S]*min-height:44px/);
});

test('prototype labels simulated capabilities and recovery states honestly', () => {
  assert.match(html, /能力演示 · 待接入/);
  assert.match(html, /部分成功/);
  assert.match(html, /只重试失败镜头/);
  assert.doesNotMatch(html, /本地 Codex 已连接|设备在线|自动发布成功/);
});

test('V1.0 migration layer governs every routed page and legacy surface family', () => {
  assert.match(html, /V1\.0 full migration layer/);
  const pages = [...html.matchAll(/<section class="page[^\"]*" data-p="([^"]+)"/g)].map(match => match[1]);
  assert.ok(pages.length >= 16, `expected all retained routed workspaces, got ${pages.length} pages`);
  assert.equal(new Set(pages).size, pages.length, 'page routes must remain unique');
  for (const family of [
    '.card,.tile,.atile,.burst,.dis',
    '.workspace-toolbar,.toolbar',
    '.workspace-surface,.artifact-list',
    '.modal,.drawer,.toast',
    '.wizard-steps,.kb-onboarding-steps'
  ]) assert.ok(html.includes(family), `missing migration coverage for ${family}`);
  assert.doesNotMatch(html, /var\(--control-radius\)/);
});
