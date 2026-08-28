import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('poster generation is a complete module workflow', () => {
  for (const token of ['new-poster', 'posterReferenceFile', 'posterImageInstruction', 'posterTitle', 'preview-poster', 'edit-poster', 'export-poster']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /只需提供一段文案和一张图片/);
  assert.match(html, /用途自动识别/);
  assert.match(html, /提交人工审核/);
});

test('poster generation injects enterprise context into the image-model request', () => {
  for (const token of ['buildPosterGenerationContext', 'renderPosterContextPreview', 'GPT Image 2', 'enterprise:', 'company:', 'brand:', 'constraints:', 'sources:', 'posterReferenceFile', 'posterImageInstruction', 'referenceImage']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /不把整份知识库原文发送给模型/);
  assert.match(html, /本次任务所需且有权限的字段/);
  assert.match(html, /_lastPosterGenerationPayload/);
});

test('WeChat article generation selects an account and collects results per article', () => {
  for (const token of ['new-wechat-article', 'graphicTopic', 'graphicReferenceFiles', 'graphicPublishingAccount', 'wechatAccountId', 'preview-wechat', 'edit-wechat', 'publish-wechat', 'sync-wechat-article', 'manage-wechat-account']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /已绑定 2 个公众号/);
  assert.match(html, /发布与数据按文章归档/);
  assert.match(html, /正在通过官方 API 发布到：/);
  assert.match(html, /确认启动 RPA 发布/);
  assert.match(html, /失败原因和重试入口/);
  assert.match(html, /<th>阅读<\/th><th>分享<\/th>/);
  assert.match(html, /recordContentPublication/);
  assert.match(html, /resultSink:\['moments','poster'\]\.includes\(channel\)\?null/);
  assert.match(html, /标题、摘要、正文、封面、配图和 CTA/);
  assert.match(html, /公众号图文预览/);
  assert.match(html, /文章封面预览/);
  assert.match(html, /正文配图一/);
  assert.match(html, /正文配图二/);
  assert.match(html, /修改后重新进入人工审核/);
  assert.match(html, /当前文章封面/);
  for (const token of ['editWechatCoverPreview', 'editWechatBodyPreview', 'editWechatBodyGallery', 'editWechatTitle', 'editWechatSummary', 'editWechatBody', 'editWechatCta', 'editWechatBrief', 'pick-edit-wechat-cover', 'pick-edit-wechat-body', 'editWechatCoverFile', 'editWechatBodyFile']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /multiple hidden/);
  assert.match(html, /按选择顺序排列在正文中/);
  assert.match(html, /style\.maxHeight='70vh'/);
  assert.match(html, /overflowY='auto'/);
});

test('material generation keeps knowledge and approval boundaries', () => {
  assert.match(html, /materialKnowledgeNotice/);
  assert.match(html, /缺少的成交数据不会被自动补全/);
  assert.match(html, /价格(?:\/|与)承诺需人工(?:确认|审核)/);
  assert.match(html, /未自动发布/);
});
