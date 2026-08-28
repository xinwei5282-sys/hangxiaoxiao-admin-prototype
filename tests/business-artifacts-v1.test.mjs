import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const operatingBrainPrd = readFileSync(new URL('../../prd/PRD_企业AI经营大脑_当前开发基线.md', import.meta.url), 'utf8');
const promptPrd = readFileSync(new URL('../../prd/PRD_提示词.md', import.meta.url), 'utf8');

test('operating plan manages its own artifacts', () => {
  assert.doesNotMatch(html, />新建品牌报告<\/button>/);
  assert.doesNotMatch(html, />新建经营计划<\/button>/);
  const operatingPlan = html.match(/data-subview-panel="operating-plan"([\s\S]*?)<section class="page" data-p="marketing-materials"/)?.[1] ?? '';
  for (const phrase of ['AI 自动生成', '人工审核通过后才正式生效', '待负责人审核', '审核经营计划', '生成依据']) assert.match(operatingPlan, new RegExp(phrase));
  for (const removed of ['计划周期', 'data-act="pick-period"', '新建经营计划']) assert.doesNotMatch(operatingPlan, new RegExp(removed));
});

test('brand report shows only initial and deep diagnosis report cases', () => {
  const brandReport = html.match(/data-subview-panel="brand-report"([\s\S]*?)data-subview-panel="operating-plan"/)?.[1] ?? '';
  for (const title of ['企业初步诊断报告案例', '企业深度诊断报告案例']) {
    assert.match(brandReport, new RegExp(title));
  }
  assert.match(brandReport, /data-act="preview-diagnosis-report-case"[^>]*data-report-case="initial"/);
  assert.match(brandReport, /data-act="preview-diagnosis-report-case"[^>]*data-report-case="deep"/);
  assert.equal((brandReport.match(/>预览案例<\/button>/g) || []).length, 2);
  assert.doesNotMatch(brandReport, /企业品牌诊断报告|品牌定位初稿|查看原因|下载|重新生成/);
});

test('initial and deep diagnosis report cases open different readable previews', () => {
  assert.match(html, /function openDiagnosisReportCasePreview\(kind='initial'\)/);
  assert.match(html, /case 'preview-diagnosis-report-case':[\s\S]*?openDiagnosisReportCasePreview\(el\.dataset\.reportCase\|\|'initial'\)/);
  const preview = html.match(/function openDiagnosisReportCasePreview\(kind='initial'\)\{([\s\S]*?)\n\}/)?.[1] ?? '';
  for (const phrase of ['企业初步诊断报告案例', '六维概览', '信息缺口', '企业深度诊断报告案例', '跨维度根因', '证据链', '30 / 60 / 90 天', '资料快照']) {
    assert.match(preview, new RegExp(phrase.replaceAll('/', '\\/')));
  }
  assert.match(preview, /modal\('报告案例预览/);
});

test('deep diagnosis case is a complete navigable management document', () => {
  assert.match(html, /const deepDiagnosisCaseSections=\[/);
  for (const id of [
    'report-context', 'executive-summary', 'decision-list',
    'evidence-confidence', 'six-dimension', 'causal-chain',
    'root-priority', 'strategy-options', 'recommendation',
    'action-plan', 'risks-appendix'
  ]) assert.match(html, new RegExp(`id:'${id}'`));
  for (const phrase of [
    '管理层摘要', '老板决策清单', '定位与战略', '组织与执行',
    '保守优化', '聚焦突破', '增长扩张', '为什么暂不选择',
    '负责人角色', '验收指标', '停止条件', '证据引用清单'
  ]) assert.match(html, new RegExp(phrase));
  for (const contract of [
    'function buildDeepDiagnosisCaseDocument()',
    'function navigateDiagnosisReportSection(sectionId)',
    'data-act="navigate-diagnosis-report-section"',
    'id="diagnosisCaseSectionSelect"',
    'class="diagnosis-case-document"',
    'class="diagnosis-case-toc"',
    'class="diagnosis-case-content"'
  ]) assert.match(html, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /@media\(max-width:700px\)[\s\S]*?\.diagnosis-case-layout\{grid-template-columns:1fr\}[\s\S]*?\.diagnosis-case-toc\{display:none\}[\s\S]*?\.diagnosis-case-mobile-nav\{display:block/);
});

test('initial and deep diagnosis prompts are separately versioned and executable', () => {
  for (const heading of ['P-011 企业初步诊断', 'P-012 企业深度诊断']) assert.match(operatingBrainPrd, new RegExp(heading));
  for (const token of [
    'initial_diagnosis_report', 'deep_diagnosis_report', 'prompt_version',
    'input_snapshot_id', 'evidence_refs', 'validation_error',
    'report_context', 'executive_summary', 'decision_list', 'evidence_confidence',
    'six_dimension', 'causal_chain', 'root_priority', 'strategy_options',
    'recommendation', 'action_plan', 'risks_appendix'
  ]) assert.match(operatingBrainPrd, new RegExp(token));
  assert.match(operatingBrainPrd, /整体完整度[^\n]*80%[\s\S]*六维[^\n]*60%/);
  assert.match(operatingBrainPrd, /不得虚构[^\n]*(行业基准|ROI|经营结果)/);
  for (const promptId of ['P-011', 'P-012']) assert.match(promptPrd, new RegExp(`\\| ${promptId} \\|`));
  assert.match(promptPrd, /完整可复制提示词和 JSON 约束以[\s\S]*当前开发基线/);
  assert.match(html, /P-012 v1\.0/);
  assert.match(html, /input_snapshot_id/);
});

test('PPT, poster and WeChat article each have a creation and list workspace', () => {
  for (const phrase of ['新建 PPT', '预览 / 编辑', '下载 PPTX', '下载 PDF', '页面缩略图', '新建海报', '海报内容', '新建公众号文章', '文章内容', '审核并发布']) assert.match(html, new RegExp(phrase));
});

test('poster stops at file export while WeChat closes the publish and data loop', () => {
  const material = html.match(/<div class="subview" data-subview-panel="material-poster">([\s\S]*?)<\/section>/)?.[1] ?? '';
  const poster = material.match(/([\s\S]*?)<div class="subview" data-subview-panel="material-wechat">/)?.[1] ?? '';
  const wechat = material.match(/<div class="subview" data-subview-panel="material-wechat">([\s\S]*)/)?.[1] ?? '';
  for (const state of ['待审核', '下载']) assert.match(poster, new RegExp(state));
  for (const removed of ['发布前确认', '待发布', '已发布', '发布失败']) assert.doesNotMatch(poster, new RegExp(removed));
  for (const phrase of ['已授权', '审核后自动发布', '审核并发布', '发布与数据回收', '同步数据']) assert.match(wechat, new RegExp(phrase));
});

test('customer-level artifact duplication is removed', () => {
  const nav = html.match(/<nav>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  assert.doesNotMatch(nav, /成果中心|作品库/);
  assert.doesNotMatch(html, /复制到作品库/);
});
