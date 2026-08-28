import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('new tenant sees one three-stage knowledge onboarding modal', () => {
  assert.match(html, /id="diagnosisOnboardingModal"/);
  assert.doesNotMatch(html, /data-p="kb-onboarding"/);
  assert.match(html, /data-kbstep="upload"/);
  assert.match(html, /data-kbstep="analyze"/);
  assert.match(html, /data-kbstep="confirm"/);
  assert.match(html, /id="kbInitFile"/);
  assert.match(html, /没有资料.*AI.*对话补充/s);
});

test('industry differences are blueprint configuration, not duplicate pages', () => {
  assert.match(html, /const KB_BLUEPRINTS\s*=/);
  assert.match(html, /sales:\s*\{/);
  assert.match(html, /consumer:\s*\{/);
  assert.match(html, /AI 获客/);
  assert.match(html, /杭小消/);
  assert.equal((html.match(/id="diagnosisOnboardingModal"/g) || []).length, 1);
});

test('the shared workflow exposes source-centered work and delegates agent authorization', () => {
  for (const panel of ['work', 'domains', 'governance']) {
    assert.match(html, new RegExp(`data-kbpanel="${panel}"`));
  }
  for (const removed of ['sources', 'review', 'agents']) assert.doesNotMatch(html, new RegExp(`data-kbpanel="${removed}"`));
  assert.match(html, /data-v="agent-center"[^>]*>Agent 权限/);
  assert.match(html, /data-act="continue-kb-governance"/);
  assert.match(html, /人工审核/);
});

test('consumer blueprint covers Hangxiaoxiao knowledge and feedback loop', () => {
  for (const phrase of ['法律法规', '日常问答', '典型案例', '消费警示', '维权任务链', '多模态资产']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /未命中.*治理待办/s);
  assert.match(html, /原型演示.*不代表.*真实/s);
});

test('onboarding state functions use consistent names', () => {
  for (const fn of [
    'showKnowledgeOnboardingStep',
    'startKnowledgeOnboarding',
    'activateKnowledgeWorkspace',
    'applyKnowledgeBlueprint'
  ]) {
    assert.match(html, new RegExp(`function ${fn}\\(`));
  }
});
