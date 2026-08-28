import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const prototype = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const design = readFileSync(new URL('../../docs/superpowers/specs/2026-08-12-ppt-async-generation-download-design.md', import.meta.url), 'utf8');
const plan = readFileSync(new URL('../../docs/codex/plans/2026-08-12-ppt-async-editor-implementation.md', import.meta.url), 'utf8');
const productPrd = readFileSync(new URL('../../prd/PRD_企业AI经营大脑_当前开发基线.md', import.meta.url), 'utf8');
const contentPrd = readFileSync(new URL('../../prd/PRD_内容创作.md', import.meta.url), 'utf8');

test('active PPT contracts use one async generation and inline editing vocabulary', () => {
  for (const document of [design, plan, productPrd, contentPrd]) {
    assert.match(document, /大纲/);
    assert.match(document, /异步|后台生成/);
    assert.match(document, /画布/);
    assert.match(document, /AI 追问/);
  }
  assert.doesNotMatch(plan, /结构化编辑|结构化表单|历史恢复/);
  assert.doesNotMatch(design, /版本历史|恢复任意历史版本|从版本历史中恢复/);
  assert.match(productPrd, /PPT 不使用通用内容审核状态/);
});

test('prototype has no retired PPT review states, output renderer or history restore contract', () => {
  assert.match(prototype, /const PPT_CREATION_STAGES=\['brief','outline_review','outline_approved','generating','ready','failed'\]/);
  assert.doesNotMatch(prototype, /function renderPptGeneration\(/);
  assert.doesNotMatch(prototype, /function renderPptOutput\(/);
  assert.doesNotMatch(prototype, /function restorePptSlideVersion\(/);
});

test('PPT contracts keep Presenton inspiration separate from the export implementation', () => {
  for (const document of [design, productPrd]) {
    assert.match(document, /Presenton/);
    assert.match(document, /PptExportAdapter/);
    assert.match(document, /PptxGenJS/);
    assert.match(document, /presenton-export/);
    assert.match(document, /不使用|禁止|排除/);
  }
  assert.match(prototype, /产品交互原型/);
  assert.match(prototype, /正式导出将使用独立审核的宽松许可组件/);
  assert.doesNotMatch(prototype, /src=["'][^"']*presenton-export|import[^\n]*presenton-export/);
});
