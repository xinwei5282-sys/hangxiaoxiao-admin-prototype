import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadPptModel() {
  const source = html.match(/const PPT_CREATION_STAGES=[\s\S]*?(?=\nfunction openCompanyOperatingPlanReview)/)?.[0] || '';
  assert.ok(source, 'PPT creation model is missing');
  return Function(`${source};return {PPT_CREATION_STAGES,PPT_THEME_OPTIONS,selectPptTheme,createPptOutlineDraft,approvePptOutline,startApprovedPptGeneration,createPptGenerationTask,completePptGenerationTask,canDownloadPpt};`)();
}

test('theme selection offers enterprise VI and owned commercial-safe themes', () => {
  const { PPT_THEME_OPTIONS, selectPptTheme, createPptOutlineDraft } = loadPptModel();
  assert.equal(PPT_THEME_OPTIONS.length, 4);
  assert.equal(PPT_THEME_OPTIONS[0].id, 'enterprise-vi');
  assert.ok(PPT_THEME_OPTIONS.slice(1).every(theme => theme.ownership === 'owned'));
  const selected = selectPptTheme('editorial-trust');
  assert.equal(selected.id, 'editorial-trust');
  const outline = createPptOutlineDraft({ request: '生成客户提案 PPT', themeId: selected.id });
  assert.equal(outline.theme.id, 'editorial-trust');
});

test('one sentence creates an outline grounded in enterprise brain and active VI', () => {
  const { createPptOutlineDraft } = loadPptModel();
  const empty = createPptOutlineDraft({ request: '  ' });
  assert.equal(empty.status, 'brief_required');
  const outline = createPptOutlineDraft({
    request: '帮我生成一份首次拜访客户的公司介绍与产品方案 PPT',
    brainContext: { formalOnly: true, sources: ['企业档案', '产品与服务', '已确认案例'] },
    viContext: { status: 'active', version: 2, direction: '稳健决策' }
  });
  assert.equal(outline.status, 'outline_review');
  assert.equal(outline.pages.length, 8);
  assert.equal(outline.evidencePolicy, 'confirmed_only');
  assert.equal(outline.vi.version, 2);
  assert.ok(outline.pages.every(page => page.title && page.purpose && page.source && page.visual));
});

test('complete PPT generation is blocked until a human approves the outline', () => {
  const { createPptOutlineDraft, approvePptOutline, startApprovedPptGeneration } = loadPptModel();
  const outline = createPptOutlineDraft({ request: '生成季度经营复盘 PPT' });
  assert.equal(startApprovedPptGeneration(outline).status, 'outline_review');
  assert.equal(approvePptOutline(outline, '').status, 'outline_review');
  const approved = approvePptOutline(outline, '企业负责人');
  assert.equal(approved.status, 'outline_approved');
  assert.equal(startApprovedPptGeneration(approved).status, 'generating');
});

test('approved outline becomes a background task that is directly downloadable when ready', () => {
  const { createPptOutlineDraft, approvePptOutline, createPptGenerationTask, completePptGenerationTask, canDownloadPpt } = loadPptModel();
  const outline = approvePptOutline(createPptOutlineDraft({ request: '生成客户提案 PPT' }), '企业负责人');
  const task = createPptGenerationTask(outline);
  assert.equal(task.status, 'generating');
  assert.equal(canDownloadPpt(task), false);
  const ready = completePptGenerationTask(task);
  assert.equal(ready.status, 'ready');
  assert.equal(canDownloadPpt(ready), true);
});

test('PPT workspace exposes two immediate phases and no completed-artifact review gate', () => {
  const studio = html.match(/<section class="page" data-p="studio"[\s\S]*?(?=<section class="page" data-p="create")/)?.[0] || '';
  for (const phrase of ['一句话描述你要生成的 PPT', '企业大脑', '已启用企业 VI', '补充资料（可选）', '填写需求', '大纲审核', '确认大纲并开始生成']) {
    assert.match(studio, new RegExp(phrase));
  }
  for (const action of ['generate-ppt-outline', 'approve-ppt-outline', 'regenerate-ppt-outline']) {
    assert.match(html, new RegExp(`data-act="${action}"`));
  }
  assert.match(html, /data-ppt-stage="outline"[^>]*hidden/);
  assert.doesNotMatch(studio, /data-ppt-stage="generating"|data-ppt-stage="output"|submit-studio-review|成品审核/);
  assert.match(html, /function renderPptCreationWorkspace/);
  for (const phrase of ['选择演示主题', '企业 VI', '稳健商务', '杂志叙事', '增长聚焦']) assert.match(studio, new RegExp(phrase));
  assert.match(html, /data-act="select-ppt-theme"/);
});
