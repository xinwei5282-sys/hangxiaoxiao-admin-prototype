import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadEditorModel() {
  const source = html.match(/const PPT_CREATION_STAGES=[\s\S]*?(?=\nfunction openCompanyOperatingPlanReview)/)?.[0] || '';
  assert.ok(source, 'PPT editor model is missing');
  return Function(`${source};return {createPptOutlineDraft,approvePptOutline,createPptGenerationTask,completePptGenerationTask,createEditablePptDeck,createPptDemoCase,updatePptSlideDraft,movePptTextElement,changePptSlideLayout,movePptSlide,duplicatePptSlide,addPptSlide,deletePptSlide,togglePptSlideHidden,createPptSlideCandidate,adoptPptSlideCandidate,discardPptSlideCandidate};`)();
}

function readyDeck() {
  const model = loadEditorModel();
  const outline = model.approvePptOutline(model.createPptOutlineDraft({ request: '生成客户提案 PPT' }), '企业负责人');
  return { model, deck: model.createEditablePptDeck(model.completePptGenerationTask(model.createPptGenerationTask(outline))) };
}

test('manual editing only changes the selected slide', () => {
  const { model, deck } = readyDeck();
  const edited = model.updatePptSlideDraft(deck, 'page-2', { title: '新标题' });
  assert.equal(edited.slides[1].title, '新标题');
  assert.equal(edited.slides[0].title, deck.slides[0].title);
});

test('layout and page operations update only their intended deck state', () => {
  const { model, deck } = readyDeck();
  assert.equal(deck.slides[0].layoutVariants.length, 3);
  const relayout = model.changePptSlideLayout(deck, 'page-1', deck.slides[0].layoutVariants[1].id);
  assert.equal(relayout.slides[0].layoutId, deck.slides[0].layoutVariants[1].id);
  assert.equal(relayout.slides[1].layoutId, deck.slides[1].layoutId);
  const moved = model.movePptSlide(deck, 'page-2', -1);
  assert.equal(moved.slides[0].id, 'page-2');
  const duplicated = model.duplicatePptSlide(deck, 'page-1');
  assert.equal(duplicated.slides.length, deck.slides.length + 1);
  assert.notEqual(duplicated.slides[1].id, 'page-1');
  const hidden = model.togglePptSlideHidden(deck, 'page-1');
  assert.equal(hidden.slides[0].hidden, true);
  const deleted = model.deletePptSlide(deck, 'page-2');
  assert.equal(deleted.slides.length, deck.slides.length - 1);
  assert.ok(deleted.slides.every(slide => slide.id !== 'page-2'));
});

test('Presenton-style rail can append a blank editable slide', () => {
  const { model, deck } = readyDeck();
  const added = model.addPptSlide(deck);
  assert.equal(added.slides.length, deck.slides.length + 1);
  assert.equal(added.slides.at(-1).title, '无标题页面');
  assert.equal(added.slides.at(-1).layoutVariants.length, 3);
});

test('demo case contains eight evidence-grounded slides with varied visual roles', () => {
  const { model } = readyDeck();
  const demo = model.createPptDemoCase();
  assert.equal(demo.slides.length, 8);
  assert.equal(demo.title, '企业介绍与增长方案');
  assert.ok(new Set(demo.slides.map(slide => slide.role)).size >= 4);
  assert.ok(demo.slides.every(slide => slide.source && slide.body));
  assert.ok(demo.slides.some(slide => slide.metrics?.length));
  assert.ok(demo.slides.some(slide => slide.highlights?.length));
});

test('demo visual roles receive distinct non-black canvas themes', () => {
  for (const role of ['insight', 'architecture', 'process', 'factory', 'metrics', 'governance', 'cta']) {
    assert.match(html, new RegExp(`data-slide-role="${role}"`));
  }
  assert.match(html, /--ppt-canvas-bg/);
  assert.match(html, /--ppt-canvas-ink/);
  assert.match(html, /enterprise-ai-brain-background\.png/);
});

test('thumbnail rail keeps controls fixed and scrolls the slide list', () => {
  assert.match(html, /\.ppt-slide-rail\{[^}]*grid-template-rows:auto auto minmax\(0,1fr\)/);
  assert.match(html, /#pptEditorThumbnails\{[^}]*overflow-y:auto/);
  assert.match(html, /overscroll-behavior:contain/);
});

test('editor mode fills one viewport and stretches all three columns equally', () => {
  assert.match(html, /\.page\[data-p="studio"\]\.ppt-editor-open\{[^}]*height:calc\(100vh - var\(--topbar-h\)\)/);
  assert.match(html, /\.ppt-editor-workspace\.ppt-editor-grid\{[^}]*height:100%[^}]*align-items:stretch[^}]*overflow:hidden/);
  assert.match(html, /classList\.add\('ppt-editor-open'\)/);
});

test('text elements keep independent bounded drag positions on the selected slide', () => {
  const { model } = readyDeck();
  const demo = model.createPptDemoCase();
  const moved = model.movePptTextElement(demo, 'page-1', 'title', { x: 18, y: 12 });
  assert.deepEqual(moved.slides[0].elementPositions.title, { x: 18, y: 12 });
  assert.equal(moved.slides[1].elementPositions?.title, undefined);
  const bounded = model.movePptTextElement(moved, 'page-1', 'body', { x: 180, y: -130 });
  assert.deepEqual(bounded.slides[0].elementPositions.body, { x: 90, y: -90 });
  assert.match(html, /container-type:size/);
  assert.match(html, /1cqw/);
  assert.match(html, /1cqh/);
});

test('AI follow-up creates a candidate before adoption and can be discarded', () => {
  const { model, deck } = readyDeck();
  const candidate = model.createPptSlideCandidate(deck, 'page-2', '减少文字');
  assert.equal(candidate.pending.slideId, 'page-2');
  assert.equal(candidate.slides[1].title, deck.slides[1].title);
  const adopted = model.adoptPptSlideCandidate(candidate);
  assert.equal(adopted.pending, null);
  assert.equal(adopted.version, 2);
  const discarded = model.discardPptSlideCandidate(candidate);
  assert.equal(discarded.pending, null);
  assert.equal(discarded.slides[1].title, deck.slides[1].title);
});

test('PPT detail opens separately, edits canvas text inline and keeps only AI follow-up on the right', () => {
  for (const phrase of ['页面缩略图', '添加页面', '点击文字直接编辑', '全屏播放', '正在修改第 1 页', 'AI 追问', '只修改当前页', '请告诉 AI 如何修改当前页', '采用新版', '撤回', '已保存', '替换图片', '上移', '下移', '复制', '隐藏', '删除', '画布 100%', '企业大脑驱动的增长操作系统', '下载 PPTX', '下载 PDF']) assert.match(html, new RegExp(phrase));
  for (const className of ['ppt-editor-shell', 'ppt-editor-topbar', 'ppt-canvas-stage', 'ppt-inspector-section']) assert.match(html, new RegExp(className));
  for (const action of ['add-ppt-slide', 'select-ppt-slide', 'move-ppt-slide-up', 'move-ppt-slide-down', 'duplicate-ppt-slide', 'toggle-ppt-slide-hidden', 'delete-ppt-slide', 'replace-ppt-slide-image', 'ppt-preview-prev', 'ppt-preview-next', 'ppt-fullscreen', 'request-ppt-slide-revision', 'adopt-ppt-slide-candidate', 'discard-ppt-slide-candidate', 'download-pptx', 'download-pdf']) assert.match(html, new RegExp(`data-act="${action}"`));
  assert.doesNotMatch(html, /设计工具 · 版式候选/);
  assert.doesNotMatch(html, /data-act="select-ppt-layout"/);
  assert.doesNotMatch(html, /data-act="edit-ppt-slide-chart"/);
  assert.match(html, /data-ppt-drag-element="title"/);
  assert.match(html, /data-ppt-drag-element="body"/);
  assert.match(html, /pointerdown/);
  assert.match(html, /movePptTextElement/);
  assert.match(html, /contenteditable="true" data-ppt-inline-field="title"/);
  assert.match(html, /contenteditable="true" data-ppt-inline-field="body"/);
  assert.match(html, /window\.open\([\s\S]*'_blank'/);
  assert.match(html, /get\('pptEdit'\)/);
  assert.match(html, /pptEditParam\)\{\$\('#login'\)\.hidden=true/);
  for (const removedId of ['pptEditorModes', 'pptSlideTitle', 'pptSlideBody', 'pptSlideData', 'pptSlideImage', 'pptSlideNotes', 'pptSlideLayout']) assert.doesNotMatch(html, new RegExp(`id="${removedId}"`));
  assert.doesNotMatch(html, /data-ppt-editor-panel=/);
  assert.doesNotMatch(html, /data-act="switch-ppt-editor-mode"/);
  assert.doesNotMatch(html, /data-act="submit-studio-review"/);
});
