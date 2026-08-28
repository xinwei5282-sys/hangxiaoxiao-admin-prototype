import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const remix = html.match(/<section class="page" data-p="remix"[\s\S]*?<\/section>/)?.[0] ?? '';

test('AI remix list starts directly with tasks without summary statistics', () => {
  assert.doesNotMatch(remix, /<div class="stats">/);
});

test('AI remix uses the approved Remotion material-review workflow', () => {
  for (const phrase of ['AI 混剪', 'Remotion', '企业大脑自动匹配', '企业事实', '人工上传', 'AI 自动生成', '开头 1 秒', '数字人口播', '字幕轨', '背景音乐', '生成前检查', '确认素材并生成成片']) {
    assert.match(remix, new RegExp(phrase));
  }
});

test('AI-generated scene materials generate first and last keyframes only when needed', () => {
  for (const phrase of ['默认生成首帧', '动作连续', '转场衔接', '同时生成尾帧', '上传素材不重复生成']) {
    assert.match(remix, new RegExp(phrase));
  }
  assert.match(remix, /首帧 \+ 尾帧/);
});

test('AI video exposes deterministic preflight and does not claim automatic publishing', () => {
  for (const token of ['remixPlatform', 'remixAspect', 'remixDuration', 'remixAvatarAsset', 'remixCoverAsset', 'remixSceneAssets', 'remixPreflight', 'confirm-remix-materials', 'fill-remix-assets']) {
    assert.match(remix, new RegExp(token));
  }
  assert.match(remix, /Remotion/);
  assert.doesNotMatch(remix, /自动发布成功|无需人工确认/);
});

test('AI remix configures platform, aspect ratio and duration independently', () => {
  for (const phrase of ['目标平台', '画面方向', '视频时长', '竖屏 · 9:16', '横屏 · 16:9', '跟随数字人口播时长']) {
    assert.match(remix, new RegExp(phrase));
  }
  assert.doesNotMatch(remix, /目标平台与时长/);
});

test('AI video keeps prompt inputs tenant and industry aware', () => {
  for (const phrase of ['平台通用规则', '行业知识包', '企业配置', '本次任务']) assert.match(remix, new RegExp(phrase));
  assert.match(remix, /企业素材优先/);
});

test('AI remix reads enterprise context automatically and only asks for video content', () => {
  for (const phrase of ['视频设置', '企业大脑自动匹配', '已自动提取', '无需重复填写企业信息', '本次视频主题', '最终口播稿']) {
    assert.match(remix, new RegExp(phrase));
  }
  assert.doesNotMatch(remix, /<label>所属企业<\/label>|<label>行业内容策略<\/label>/);
});

test('AI remix supports manual scripts, viral rewriting and link capture rewriting', () => {
  for (const token of ['remixManualScript', 'remix-rewrite-manual', 'remixReferenceLink', 'remix-fetch-link', 'remixFinalScript', '粘贴链接抓取', '按爆款结构仿写']) {
    assert.match(remix, new RegExp(token));
  }
  assert.match(html, /仅借鉴结构/);
});

test('AI remix CTA is optional and only appears when configured', () => {
  for (const token of ['remixCtaToggle', 'remixCtaInput', 'toggle-remix-cta', 'remixCtaSceneTitle', '未配置则自然收尾', '自然收尾（未配置 CTA）']) {
    assert.match(html, new RegExp(token));
  }
});

test('AI remix opens on a task list and enters settings only after create', () => {
  for (const token of ['remixList', 'remixForm', 'new-remix', 'back-remix-list', '创建 AI 混剪', 'AI 混剪任务', '继续编辑']) {
    assert.match(remix, new RegExp(token));
  }
  assert.match(remix, /id="remixForm" style="display:none"/);
});

test('digital human layout is fixed bottom-right without a final-duration field in settings', () => {
  assert.match(remix, /右下圆形小窗 · 贯穿口播/);
  assert.doesNotMatch(remix, /右侧半屏/);
  assert.doesNotMatch(remix, /id="remixFinalDuration"|<label>最终时长<\/label>/);
});

test('AI remix creation is reduced to two user-facing steps', () => {
  assert.match(remix, /1\. 视频设置/);
  assert.match(remix, /2\. 素材确认/);
  assert.match(remix, /分镜素材与首尾帧/);
  assert.doesNotMatch(remix, /<h3>3\. 分镜素材<\/h3>|<h3>4\. 生成边界<\/h3>/);
  assert.doesNotMatch(remix, /<span>Remotion 合成<\/span>|<span>质检与下载<\/span>/);
});

test('AI remix steps are separate panels instead of stacked on one page', () => {
  assert.match(remix, /data-remix-step-panel="1"/);
  assert.match(remix, /data-remix-step-panel="2" hidden/);
  assert.match(remix, /生成素材方案并进入下一步/);
  assert.match(remix, /prev-remix-step/);
  assert.match(html, /function showRemixStep\(step\)/);
});

test('step two is clearly a pre-render material review', () => {
  assert.match(remix, /生成视频前审核/);
  assert.match(remix, /确认素材并生成成片/);
  assert.doesNotMatch(remix, /素材确认与生成/);
});

test('AI remix selects a digital human and voice in video settings', () => {
  for (const token of ['remixAvatarSelect', 'remixVoiceSelect', 'remixAvatarSummary', '企业数字人', '平台公模', '企业声音', '平台音色', '替换数字人', '替换声音']) {
    assert.match(remix, new RegExp(token));
  }
  assert.match(html, /function syncRemixAvatarSummary\(\)/);
});

test('material review can replace avatar and voice, save draft and confirm generation', () => {
  for (const phrase of ['<b>数字人</b>', '替换数字人', '替换声音', '返回上一步', '暂存', '确认素材并生成成片', 'save-remix-draft']) {
    assert.match(remix, new RegExp(phrase));
  }
});

test('right preview supports low-cost composite and content-only modes', () => {
  for (const token of ['remixPreviewMode', 'remix-preview-mode', '低成本合成预览', '内容占位预览', '低成本可实现', '不触发正式 Remotion 渲染', '不生成预览视频']) {
    assert.match(html, new RegExp(token));
  }
});

test('AI remix list maps each video status to the correct action', () => {
  const mappings = [
    ['draft', '草稿', '继续编辑'],
    ['materials-generating', '素材生成中', '查看详情'],
    ['review', '待确认', '立即生成'],
    ['rendering', '成片生成中', '查看详情'],
    ['completed', '已完成', '查看成片'],
    ['failed', '生成失败', '查看原因']
  ];
  for (const [status, label, action] of mappings) {
    assert.match(remix, new RegExp(`data-remix-status="${status}"[\\s\\S]*?${label}[\\s\\S]*?${action}`));
  }
  for (const action of ['open-remix-review', 'view-remix-detail', 'view-remix-video', 'view-remix-failure', 'retry-remix-task']) assert.match(html, new RegExp(action));
  assert.doesNotMatch(remix, /查看进度|view-remix-progress/);
});

test('every AI remix status exposes details and completed video is downloadable', () => {
  assert.equal((remix.match(/data-act="view-remix-detail"/g)||[]).length, 6);
  assert.match(html, /<video src="assets\/demo\/hunjian\.mp4" controls/);
  assert.match(html, /download="AI混剪成片\.mp4"/);
});

test('task details reuse the creation page and both steps are directly clickable', () => {
  assert.match(html, /function openRemixTaskDetail\(row,step\)/);
  assert.match(html, /case 'view-remix-detail':openRemixTaskDetail/);
  assert.equal((remix.match(/data-act="remix-step-jump"/g)||[]).length, 2);
  assert.match(remix, /data-step="1"/);
  assert.match(remix, /data-step="2"/);
});

test('captions are auto-aligned and expose a full timestamped review panel', () => {
  for (const token of ['已自动对齐 · 18 句', '低置信度', '查看/校对字幕', 'open-remix-caption-review', '00:01.20–03.80', '00:17.40–20.00', '保存字幕']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /时间轴保持自动对齐/);
});

test('creation header places back-to-list before the AI remix title', () => {
  assert.match(remix, /class="remix-back-icon" id="remixBackTitle"[\s\S]*?<path d="M15 18l-6-6 6-6"\/><\/svg><\/button><div class="t">AI 混剪<\/div><b class="remix-create-label" id="remixCreateLabel" hidden>创建设置<\/b>/);
  assert.match(html, /remixBackTitle'\)\.hidden=view!==?'form'/);
  assert.match(html, /remixCreateLabel'\)\.hidden=view!==?'form'/);
  assert.doesNotMatch(remix, />← 返回列表<\/button>/);
});

test('AI remix runs its quality gate in the background and marks scene-level issues', () => {
  for (const token of ['质量门禁已在后台自动完成', '问题已标记到对应分镜', '画面布局', '时长不足', '语义匹配', '阻断', '待优化', 'remix-quality-issue', 'auto-fix-remix-quality', '全部通过 · 待人工复核']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /质量门禁正在后台执行/);
  assert.doesNotMatch(remix, /run-remix-quality-check|重新检查|生成前质量门禁/);
  assert.match(html, /btn\.disabled=true;btn\.textContent='请先处理阻断问题'/);
  assert.match(html, /btn\.disabled=false;btn\.textContent='确认素材并生成成片'/);
  assert.equal((remix.match(/Prompt remix-video-v1\.0\.0/g)||[]).length, 2);
});

test('material review shows actual selected assets and editable scene controls', () => {
  for (const token of ['分镜素材与首尾帧', 'remixMaterialList', 'remix-material-card', '对应口播', '需 10.0s · 可用 12.4s', '企业素材库', '人工上传', 'AI 生成', 'preview-remix-material', 'replace-remix-material', 'delete-remix-material', 'remixMainShot']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(remix, /<img src="\.\.\/remotion\/beauty-shoulder-relaxation\/public\/assets\/scene-01\.png"/);
  assert.match(remix, /<video src="assets\/demo\/ai-gen\.mp4"/);
  assert.doesNotMatch(remix, /crop-remix-material|裁剪/);
  assert.doesNotMatch(remix, />已选分镜素材</);
});
