import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('enterprise knowledge delegates agent authorization to settings', () => {
  const knowledge = html.match(/<!-- KB -->([\s\S]*?)<!-- AVATAR -->/)?.[1] ?? '';
  for (const removed of [
    'data-kbpanel="agents"', 'data-kbtab="agents"', 'id="kbAgentRows"',
    'function renderConsumerAgents(', 'Agent 知识与动作授权', "case 'edit-agent-auth'"
  ]) assert.doesNotMatch(knowledge, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const settings = html.match(/data-nav-sub="settings"([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.match(settings, /data-v="agent-center"[^>]*>Agent 权限/);
});

test('formal knowledge and source work share two non-duplicated workspaces', () => {
  const dataTabs = html.match(/id="kbDataView"([\s\S]*?)<\/div><\/div>/)?.[1] ?? '';
  for (const label of ['正式知识', '资料与待处理']) assert.match(dataTabs, new RegExp(label));
  for (const removed of ['资料收件箱', '>待确认']) assert.doesNotMatch(dataTabs, new RegExp(removed));
  for (const contract of [
    'const KNOWLEDGE_WORK_ITEMS=', 'function deriveKnowledgeWorkStatus(item)',
    'function renderKnowledgeWorkQueue()', 'function toggleKnowledgeWorkItem(id)',
    'id="knowledgeWorkQueue"', 'data-kbpanel="work"'
  ]) assert.match(html, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const state of ['处理中', '待确认', '有冲突', '处理失败', '已完成']) assert.match(html, new RegExp(state));
  assert.doesNotMatch(html, /data-kbpanel="sources"|data-kbpanel="review"/);
});

test('WeChat composer stores plan recommendation and per-article schedule', () => {
  for (const id of [
    'wechatPublishingAccount', 'wechatOperatingPlan', 'wechatPlanMilestone',
    'wechatRecommendedPublishAt', 'wechatScheduledPublishAt', 'wechatArticleAutoPublish'
  ]) assert.match(html, new RegExp(`id="${id}"`));
  for (const token of [
    'recommendWechatPublishAt', 'evaluateWechatScheduleGate', 'operatingPlanId',
    'planMilestoneId', 'recommendedPublishAt', 'scheduledPublishAt',
    'scheduleSource', 'autoPublishEnabled', '系统推荐发布时间', '本篇自动发布时间'
  ]) assert.match(html, new RegExp(token));
  assert.match(html, /经营计划节点/);
  assert.doesNotMatch(html, /<th>在看<\/th>|<th>新增关注<\/th>/);
});

test('all four enterprise intake steps are clickable draft-safe navigation', () => {
  const steps = html.match(/id="enterpriseIntakeSteps"([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.equal((steps.match(/data-act="switch-enterprise-intake-step"/g) || []).length, 4);
  assert.equal((steps.match(/data-intake-step-target="[1-4]"/g) || []).length, 4);
  assert.doesNotMatch(steps, /<span[^>]*data-intake-step-indicator/);
  assert.match(html, /function getEnterpriseIntakeStepState\(step\)/);
  assert.match(html, /aria-current/);
  assert.match(html, /已填写/);
  assert.match(html, /已确认/);
  assert.match(html, /case 'switch-enterprise-intake-step':[\s\S]*?saveEnterpriseIntakeDraft\(\)[\s\S]*?showEnterpriseIntakeStep/);
  assert.match(html, /\.enterprise-intake-steps button\{[^}]*min-height:44px/);
});
