import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('content creation is split into two complete workflows', () => {
  for (const phrase of ['营销视频', '数字人混剪']) assert.match(html, new RegExp(phrase));
  assert.match(html, /data-p="create"/);
  assert.match(html, /data-p="remix"/);
  for (const id of ['marketingCover', 'marketingTitle', 'marketingBody', 'remixCover', 'remixCaption']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-act="submit-remix"/);
});

test('marketing video mirrors the AI remix list and two-step creation language', () => {
  const create = html.match(/<section class="page" data-p="create"[\s\S]*?(?=<section class="page" data-p="remix")/)?.[0] ?? '';
  for (const token of ['createList', 'createBackTitle', 'createLabel', 'createStepRibbon', '1. 视频设置', '2. 封面、脚本与分镜确认', 'data-create-step-panel="1"', 'data-create-step-panel="2"', 'marketingStoryboardList', '画面、对应口播、时长、来源和质量问题统一确认', '口播、画面、时长和关键帧统一确认', '返回上一步', '暂存', '确认并生成成片']) assert.match(create, new RegExp(token));
  assert.match(html, /function showCreateStep\(step\)/);
  assert.match(html, /case 'create-generate-preview':[\s\S]{0,900}showCreateStep\(2\)/);
  assert.equal((create.match(/data-create-step-indicator/g)||[]).length, 2);
  assert.doesNotMatch(create, /<div class="stats">/);
  assert.doesNotMatch(create, /create-output|createPreviewTitle|createPreviewBody|竖屏页面预览/);
  assert.doesNotMatch(create, /data-act="confirm-script"|data-act="confirm-frames"|待确认脚本|待确认分镜/);
  assert.match(html, /function openMarketingTaskDetail\(row\)/);
  assert.match(html, /function setMarketingDetailMode\(readonly\)/);
  assert.match(create, /data-act="view-marketing-detail"/);
  assert.match(create, /营销视频任务/);
  assert.match(create, /id="marketingTaskBody"/);
  assert.match(create, /所有任务及当前进度统一在此查看/);
  assert.doesNotMatch(create, /id="genTasksCard"/);
  assert.doesNotMatch(create, /<h3>生成任务<\/h3>/);
  assert.doesNotMatch(create, /<h3>历史生成记录<\/h3>/);
});

test('marketing video supports AI-generated and one-step product marketing videos', () => {
  const create = html.match(/<section class="page" data-p="create"[\s\S]*?(?=<section class="page" data-p="remix")/)?.[0] ?? '';
  for (const token of ['marketingVideoTitle', '<label>标题', 'videoTypeSeg', 'AI 生成视频', '商品营销视频', 'aiVideoPanel', 'productMarketingPanel', 'aiVideoModelSelect', 'Seedance', '可灵', '海螺', '通义万相', 'marketingCoverCard', '重新生成封面', '本地替换封面', 'productMainImage', 'productModelImage', 'productName', 'generate-product-video', '立即生成']) {
    assert.match(create, new RegExp(token));
  }
  assert.match(html, /function setCreateVideoType\(type\)/);
  assert.match(html, /case 'create-video-type'/);
  assert.match(html, /case 'generate-product-video'/);
  assert.match(create, /<th>视频类型<\/th>/);
  assert.match(create, />AI 生成</);
  assert.match(create, />商品营销</);
  assert.doesNotMatch(create, /产出视频？/);
  assert.doesNotMatch(create, /选用视频模板/);
  assert.doesNotMatch(create, /合规规避/);
  assert.doesNotMatch(create, /套用爆款公式/);
  assert.doesNotMatch(create, /提示词风格/);
  assert.doesNotMatch(create, /Veo/);
  assert.match(create, /仅展示国产模型/);
  const productPanel = create.match(/<div id="productMarketingPanel"[\s\S]*?(?=<\/div>\s*<\/div>\s*<div class="card pad" data-create-step-panel="2")/)?.[0] ?? '';
  assert.doesNotMatch(productPanel, /productSellingPoints|核心卖点|productDuration|目标时长|productCta|CTA/);
  assert.doesNotMatch(create, /商品营销视频[\s\S]{0,500}内容确认与生成/);
  assert.ok(create.indexOf('id="marketingVideoTitle"') < create.indexOf('id="videoTypeSeg"'));
});

test('AI marketing video reuses remix-style storyboard cards with one quality gate and optional CTA', () => {
  const create = html.match(/<section class="page" data-p="create"[\s\S]*?(?=<section class="page" data-p="remix")/)?.[0] ?? '';
  for (const token of ['marketingCoverCard', 'marketingStoryboardList', 'marketing-material-card', '对应口播', '需 7.0s · 可用 9.2s', '企业素材库', '人工上传', 'AI 生成', '已授权', '首帧 \\+ 尾帧', 'marketing-quality-issue', 'preview-marketing-material', 'replace-marketing-material', 'regenerate-marketing-material', 'marketingConfirmButton']) {
    assert.match(create, new RegExp(token));
  }
  for (const token of ['marketingCtaToggle', 'marketingCtaInput', 'marketingCtaScene', 'toggle-marketing-cta', 'refreshMarketingQualityState']) {
    assert.match(html, new RegExp(token));
  }
  const productPanel = create.match(/<div id="productMarketingPanel"[\s\S]*?(?=<\/div>\s*<\/div>\s*<div class="card pad" data-create-step-panel="2")/)?.[0] ?? '';
  assert.doesNotMatch(productPanel, /CTA|marketingCta/);
  assert.doesNotMatch(create, /crop-marketing-material|裁剪/);
});

test('marketing scenario and target customer are inferred instead of manually entered', () => {
  const create = html.match(/<section class="page" data-p="create"[\s\S]*?(?=<section class="page" data-p="remix")/)?.[0] ?? '';
  for (const token of ['系统自动理解本次营销方向', 'marketingInferenceCard', 'marketingInferenceStatus', 'inferredMarketingScenario', 'inferredTargetCustomer']) assert.doesNotMatch(create, new RegExp(token));
  assert.doesNotMatch(create, /<label>营销场景<\/label>|<label>目标客户<\/label>/);
  assert.match(html, /已读取企业大脑并生成内容方案/);
});

test('trend discovery stays in AI acquisition without a duplicate automation workspace', () => {
  assert.match(html, /data-p="burst"/);
  assert.match(html, /data-p="create"/);
  assert.doesNotMatch(html, /data-p="automation"/);
  assert.doesNotMatch(html, /data-act="approve-automation"/);
  assert.doesNotMatch(html, /data-act="run-automation"/);
});

test('unfinished AI sales workspace is removed while approval boundaries remain visible', () => {
  assert.doesNotMatch(html, /data-p="sales-agent"/);
  assert.doesNotMatch(html, /data-act="takeover-lead"/);
  assert.match(html, /需要老板审批/);
  assert.match(html, /对外发布/);
});

test('PPT and moments are separate workspaces with clear ownership', () => {
  for (const phrase of ['PPT 创建', '朋友圈图文', '完整封面', '大纲审核', '正文与 CTA', '预览 / 编辑', '下载 PPTX', 'PPT Agent', '朋友圈图文 Agent']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /data-subview-panel="material-ppt"/);
  assert.match(html, /data-subview-panel="material-moments"/);
  assert.doesNotMatch(html, /<div class="t">PPT \/ 朋友圈 Agent<\/div>/);
  assert.match(html, /data-act="generate-ppt-outline"/);
  assert.match(html, /data-act="approve-ppt-outline"/);
  assert.doesNotMatch(html, /data-act="submit-studio-review"/);
});

test('moments workspace covers creation, platform adaptation, review and export', () => {
  for (const token of ['new-moments', 'momentsList', 'graphicTopic', 'graphicReferenceFiles', 'preview-graphic', 'edit-graphic', 'export-graphic', 'pick-graphic-reference', '提交人工审核']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /data-act="pick-edit-graphic-body"/);
  assert.match(html, /multiple hidden/);
});

test('moments workspace keeps only creation review and file export', () => {
  const moments = html.match(/<div class="subview" data-subview-panel="material-moments">([\s\S]*?)<div class="subview" data-subview-panel="material-poster">/)?.[1] ?? '';
  for (const label of ['新建朋友圈图文', '图文内容', '状态', '预览', '编辑', '导出图文包']) assert.match(moments, new RegExp(label));
  for (const removed of ['发布与结果回收', '已发布', '阅读/互动', '新增咨询', '有效线索', '发布前确认', 'workspace-summary', 'workflow-ribbon', 'workspace-aside']) assert.doesNotMatch(moments, new RegExp(removed));
  assert.match(html, /page\.classList\.toggle\('focused-material-active',\['material-moments','material-poster','material-wechat'\]\.includes\(name\)\)/);
});

test('poster stays file-only and WeChat publishes by account with article-level results', () => {
  const poster = html.match(/<div class="subview" data-subview-panel="material-poster">([\s\S]*?)<div class="subview" data-subview-panel="material-wechat">/)?.[1] ?? '';
  const wechat = html.match(/<div class="subview" data-subview-panel="material-wechat">([\s\S]*?)<\/section>/)?.[1] ?? '';
  for (const label of ['新建海报', '海报内容', '状态', '预览', '编辑', '下载']) assert.match(poster, new RegExp(label));
  for (const label of ['新建公众号文章', '发布账号', '发布状态', '阅读', '分享', '预览', '编辑', '审核并发布']) assert.match(html, new RegExp(label));
  for (const removed of ['发布前确认', '已发布', '发布失败', '待发布', 'workspace-aside', 'material-statebar', '剩余 10 次', '重新生成']) assert.doesNotMatch(poster, new RegExp(removed));
  for (const token of ['wechat-integration-bar', 'wechatAccountStatus', 'wechatAutoPublish', 'PLATFORM_ACCOUNTS', 'graphicPublishingAccount', 'data-wechat-read', 'data-wechat-share', 'publish-wechat', 'sync-wechat-article']) assert.match(html, new RegExp(token));
});

test('graphic content channels share one internal task contract without promotional UI', () => {
  for (const token of ['CONTENT_FACTORY_CHANNELS', 'createContentFactoryTask', 'content-factory-v1', 'enterprise-knowledge', 'brand-visual', 'asset-library', 'compliance-policy', 'review-and-results']) {
    assert.match(html, new RegExp(token));
  }
  for (const channel of ['wechat', 'moments', 'poster', 'ppt']) assert.match(html, new RegExp(`${channel}:\\{`));
  assert.doesNotMatch(html, /不同入口调用不同 Agent，底层共用/);
});

test('WeChat and moments use the same graphic editor interaction', () => {
  for (const token of ['openGraphicComposer', 'previewGraphic', 'editGraphic', 'pick-graphic-reference', 'preview-graphic', 'edit-graphic', 'export-graphic', 'shared-editor', 'editGraphicTitle', 'editGraphicGallery']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /function openWechatComposer\(\)\{return openGraphicComposer\('wechat'\)/);
  assert.match(html, /function openMomentsComposer\(\)\{return openGraphicComposer\('moments'\)/);
  assert.match(html, /function previewWechat\(trigger\)\{return previewGraphic\('wechat'/);
  assert.match(html, /function previewMoments\(trigger\)\{return previewGraphic\('moments'/);
});

test('moments stops at reviewed file export and has no result sink', () => {
  assert.match(html, /moments:\{[^}]*pipeline:\[[^\]]*'导出图文包'/);
  assert.match(html, /moments:\{[^}]*delivery:'文件导出'/);
  assert.match(html, /data-act="export-graphic" data-channel="moments"/);
  assert.match(html, /resultSink:\['moments','poster'\]\.includes\(channel\)\?null:'review-and-results'/);
});

test('internal local file executor is not exposed to customers', () => {
  assert.doesNotMatch(html, /data-p="local-codex"/);
  assert.doesNotMatch(html, /id="localDeviceStatus"/);
  assert.doesNotMatch(html, /data-act="run-local-task"/);
  assert.doesNotMatch(html, /企业专属文件执行器/);
});

test('Agent permissions are a compact settings governance view', () => {
  assert.match(html, /data-p="agent-center"/);
  assert.equal((html.match(/data-agent-card/g) || []).length, 0);
  for (const phrase of ['知识范围', '数据范围', '动作权限', '人工审批', '结果回传']) {
    assert.match(html, new RegExp(phrase));
  }
  assert.doesNotMatch(html, /data-act="configure-agent"/);
  assert.doesNotMatch(html, /data-act="add-business-agent"/);
});
