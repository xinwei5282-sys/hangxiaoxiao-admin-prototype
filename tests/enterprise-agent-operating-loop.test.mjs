import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('enterprise operating tools preserve the complete loop behind the result-first home', () => {
  for (const label of ['企业诊断', '经营计划', '需要老板审批', '本周期结果']) {
    assert.match(html, new RegExp(label));
  }
  for (const page of ['home', 'plan', 'kb', 'acquisition']) {
    assert.match(html, new RegExp(`data-p="${page}"`));
  }
  for (const removed of ['tasks', 'review']) assert.doesNotMatch(html, new RegExp(`data-p="${removed}"`));
});

test('operating accountability stays in deeper tools instead of a home chat cockpit', () => {
  const visibleHome = html.match(/<section class="page show" data-p="home"([\s\S]*?)<section class="page" data-p="plan">/)?.[1] ?? '';
  assert.doesNotMatch(visibleHome, /agentPrompt|agent-command-bar|agent-send/);
  for (const label of ['Agent 权限', '知识范围', '数据范围', '动作权限', '结果回传']) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /data-agent-card/);
});

test('execution is risk graded and high risk actions require approval', () => {
  assert.match(html, /发布、报价、客户外发和预算必须人工审批/);
  assert.match(html, /对外发布/);
  assert.match(html, /价格与承诺需审核/);
  assert.doesNotMatch(html, /data-p="tasks"/);
});

test('results become reviewed learning rather than automatic enterprise facts', () => {
  assert.match(html, /策略建议/);
  assert.match(html, /知识候选/);
  assert.match(html, /不得自动修改[^。]*企业事实/);
  assert.match(html, /data-act="confirm-brain-learning"/);
  assert.match(html, /已确认学习候选/);
});

test('diagnosis exposes incomplete data and degraded paths', () => {
  for (const phrase of ['信息不足', '信息缺口', '待接入', '补充企业信息']) {
    assert.match(html, new RegExp(phrase));
  }
});
