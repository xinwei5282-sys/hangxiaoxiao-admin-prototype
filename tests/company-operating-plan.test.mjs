import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadPlanModel() {
  const source = html.match(/const COMPANY_OPERATING_PLAN_DIMENSIONS=[\s\S]*?(?=\nfunction openCompanyOperatingPlanReview)/)?.[0] || '';
  assert.ok(source, 'company operating plan model is missing');
  return Function(`${source};return {COMPANY_OPERATING_PLAN_DIMENSIONS,COMPANY_OPERATING_PLAN_HISTORY,COMPANY_OPERATING_PLAN_GAPS,buildCompanyOperatingPlan,approveCompanyOperatingPlan};`)();
}

test('company plan covers the whole company and gates activation', () => {
  const { COMPANY_OPERATING_PLAN_DIMENSIONS, buildCompanyOperatingPlan, approveCompanyOperatingPlan } = loadPlanModel();
  assert.equal(COMPANY_OPERATING_PLAN_DIMENSIONS.length, 8);
  for (const id of ['strategy', 'product', 'market', 'sales', 'delivery', 'organization', 'finance', 'risk']) {
    assert.ok(COMPANY_OPERATING_PLAN_DIMENSIONS.some(item => item.id === id));
  }
  const draft = buildCompanyOperatingPlan({ evidence: [
    { id: 'confirmed-1', state: 'confirmed' },
    { id: 'candidate-1', state: 'candidate' }
  ] });
  assert.equal(draft.status, 'draft_review');
  assert.equal(draft.generatedAt, '2026-08-12 10:30');
  assert.deepEqual(draft.evidenceIds, ['confirmed-1']);
  assert.equal(draft.dimensions.length, 8);
  assert.equal(approveCompanyOperatingPlan(draft, '').status, 'draft_review');
  assert.equal(approveCompanyOperatingPlan(draft, '企业负责人').status, 'active');
});

test('operating plan workspace exposes review, dependencies, risks and review cadence', () => {
  const section = html.match(/data-subview-panel="operating-plan"([\s\S]*?)<section class="page" data-p="marketing-materials"/)?.[1] || '';
  for (const phrase of ['公司全盘', '公司级优先事项', '八维经营计划', '资源与跨部门依赖', '风险与信息缺口', '月度跟踪', '季度复盘']) {
    assert.match(section, new RegExp(phrase));
  }
  assert.equal((section.match(/data-plan-dimension=/g) || []).length, 8);
  assert.match(section, /data-act="review-company-operating-plan"/);
  assert.doesNotMatch(section, /新建经营计划/);
});

test('plan shows generation time and routes each information gap to an owner', () => {
  for (const phrase of ['本次生成时间', '财务负责人', '企业负责人 / 人事负责人', '交付负责人', '去补充']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /function enrichCompanyOperatingPlanTraceability/);
  assert.match(html, /data-act="supplement-enterprise-profile"/);
});

test('historical operating plans remain read-only and traceable', () => {
  const { COMPANY_OPERATING_PLAN_HISTORY } = loadPlanModel();
  assert.equal(COMPANY_OPERATING_PLAN_HISTORY.length, 3);
  for (const plan of COMPANY_OPERATING_PLAN_HISTORY) {
    for (const field of ['period', 'version', 'generatedAt', 'effectiveAt', 'reviewer', 'reviewConclusion']) assert.ok(plan[field]);
    assert.equal(plan.readonly, true);
  }
  assert.match(html, /当前计划/);
  assert.match(html, /历史计划/);
  assert.match(html, /data-act="switch-company-plan-view"/);
  assert.match(html, /data-act="view-historical-operating-plan"/);
});

test('historical plan details preserve execution results, review and evidence snapshot', () => {
  const { COMPANY_OPERATING_PLAN_HISTORY } = loadPlanModel();
  for (const plan of COMPANY_OPERATING_PLAN_HISTORY) {
    assert.ok(plan.detail);
    assert.ok(plan.detail.completeness > 0);
    assert.equal(plan.detail.priorities.length, 3);
    assert.equal(plan.detail.dimensions.length, 8);
    assert.deepEqual(Object.keys(plan.detail.review), ['wins', 'misses', 'causes', 'lessons', 'nextActions']);
    for (const entries of Object.values(plan.detail.review)) assert.ok(entries.length);
    assert.ok(plan.detail.evidenceSnapshot.length);
  }
  for (const phrase of ['返回历史计划', '计划快照', '公司级优先事项', '八维执行对比', '周期复盘', '当时依据']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /data-act="back-to-operating-plan-history"/);
  assert.match(html, /function renderHistoricalOperatingPlanDetail/);
  assert.match(html, /function showHistoricalOperatingPlanList/);
});

test('plan gaps reuse known facts and ask only for incremental fields', () => {
  const { COMPANY_OPERATING_PLAN_GAPS } = loadPlanModel();
  assert.deepEqual(COMPANY_OPERATING_PLAN_GAPS.map(item => item.state), ['insufficient', 'stale', 'candidate', 'conflict']);
  for (const gap of COMPANY_OPERATING_PLAN_GAPS) {
    assert.ok(gap.owner);
    assert.ok(gap.known);
    assert.ok(gap.missing.length);
  }
  for (const phrase of ['已掌握', '仍需补充', '粒度不足', '已过期', '资料候选', '存在冲突', '证据上传（可选）']) assert.match(html, new RegExp(phrase));
  assert.match(html, /data-act="supplement-company-plan-gap"/);
  assert.match(html, /function openCompanyPlanGapSupplement/);
  assert.match(html, /go\('kb'\)[\s\S]*showKbTab\('diagnosis'\)/);
});
