import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('consumer protection remains a shared knowledge blueprint instead of a forked tenant product', () => {
  assert.match(html, /const KB_BLUEPRINTS\s*=/);
  assert.match(html, /consumer:\s*\{/);
  assert.match(html, /label:'杭小消'/);
  assert.match(html, /data-blueprint="consumer"/);
  assert.equal((html.match(/id="diagnosisOnboardingModal"/g) || []).length, 1);
  assert.doesNotMatch(html, /const TENANT_PROFILES\s*=/);
  assert.doesNotMatch(html, /tenant=consumer-protection/);
});

test('consumer blueprint covers the approved knowledge domains and critical confirmation gates', () => {
  for (const token of [
    '法律法规', '日常问答', '典型案例', '消费警示',
    '维权任务链', '多模态资产', '法律效力与适用地区',
    '消费警示有效期', '多模态内容版权'
  ]) assert.match(html, new RegExp(token));
});

test('consumer knowledge candidates preserve sources, review status, conflict and copyright recovery', () => {
  for (const token of [
    '来源：授权法规网站', '自动采集候选', '版本冲突',
    '人工审核', '版权待确认', '尚未进入正式库',
    '不会自动进入正式知识', '知识补充任务'
  ]) assert.match(html, new RegExp(token));
  assert.match(html, /function renderKnowledgeReviewExamples\(/);
});

test('consumer multimodal knowledge keeps explicit visibility boundaries without in-page agent authorization', () => {
  for (const token of [
    '原件已保留', '已生成转写、描述与标签', '对外使用待版权确认',
    '消费者权益保护法', '预付卡商家闭店如何维权', '某健身房预付费退款调解案例'
  ]) assert.match(html, new RegExp(token));
  assert.match(html, /function renderConsumerKnowledgeItems\(/);
  assert.doesNotMatch(html, /data-kbpanel="agents"|data-kbtab="agents"|id="kbAgentRows"|function renderConsumerAgents\(|Agent 知识与动作授权/);
});

test('prototype-only ingestion and review states are labelled honestly', () => {
  assert.match(html, /原型演示处理状态/);
  assert.match(html, /不代表已经接入真实采集、解析或审核服务/);
});
