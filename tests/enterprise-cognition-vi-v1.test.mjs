import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadViModel() {
  const source = html.match(/const ENTERPRISE_VI_STATE_KEY=[\s\S]*?(?=\nfunction renderEnterpriseCognitionVi)/)?.[0] || '';
  assert.ok(source, 'enterprise VI state model is missing');
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  return Function('localStorage', `${source};return {
    buildEnterpriseViPreferences, startEnterpriseViDirectionGeneration,
    completeEnterpriseViDirectionGeneration, selectEnterpriseViDirection,
    generateEnterpriseViDraft, completeEnterpriseViDraftGeneration,
    completeEnterpriseViGenerationAndActivate,
    failEnterpriseViGeneration, retryEnterpriseViGeneration,
    activateEnterpriseViDraft, getActiveEnterpriseVi,
    buildActiveEnterpriseViContext, buildEnterpriseViBrandStrategy,
    buildEnterpriseViBrandSeed, recommendEnterpriseViScenes,
    confirmEnterpriseViDirectionAndGenerate,
    confirmEnterpriseViScenePlan, queueEnterpriseViImageTasks,
    advanceEnterpriseViImageTask, retryEnterpriseViImageTask,
    adoptEnterpriseViImageTask, rejectEnterpriseViImageTask,
    getAdoptedEnterpriseViImages, getState:()=>enterpriseViState
  };`)(localStorage);
}

function buildDraft(vi) {
  vi.startEnterpriseViDirectionGeneration({ brandTone: '专业、直接', companyName: '蔚然企业', logoStatus: 'existing' });
  vi.completeEnterpriseViDirectionGeneration();
  vi.selectEnterpriseViDirection(vi.getState().directions[0].id);
  vi.generateEnterpriseViDraft();
  return vi.completeEnterpriseViDraftGeneration();
}

test('each VI direction includes an existing-logo optimization proposal that follows the selected direction into the draft', () => {
  const vi = loadViModel();
  vi.startEnterpriseViDirectionGeneration({ companyName: '蔚然企业', logoStatus: 'existing' });
  const directions = vi.completeEnterpriseViDirectionGeneration();

  assert.equal(directions.length, 3);
  for (const direction of directions) {
    assert.match(direction.imageUrl, /^assets\/demo\/enterprise-vi\/direction-/);
    assert.equal(direction.logoProposal.mode, 'optimize_existing');
    assert.equal(direction.logoProposal.wordmark, '蔚然企业');
    assert.deepEqual(direction.logoProposal.variants, ['standard', 'icon', 'reverse']);
    assert.equal(direction.logoProposal.changes.length, 3);
  }

  vi.selectEnterpriseViDirection(directions[1].id);
  vi.generateEnterpriseViDraft();
  const draft = vi.completeEnterpriseViDraftGeneration();
  assert.deepEqual(draft.logoProposal, directions[1].logoProposal);
  assert.notEqual(draft.logoProposal, directions[1].logoProposal);
});

test('VI skill builds a confirmed-only brand seed and recommends relevant scenes from enterprise evidence', () => {
  const vi = loadViModel();
  const snapshot = {
    licenseCompanyName: { display: '蔚然企业' },
    intakeBusinessModes: { display: '线上店铺销售' },
    intakeTransactionMethod: { display: '淘宝下单' },
    intakeCoreProduct: { display: '实物商品' },
    intakeAcquisitionSources: { display: '公众号、朋友圈、短视频' },
    intakeForbiddenClaims: { display: '禁止保证效果' },
  };
  vi.startEnterpriseViDirectionGeneration({ companyName: '蔚然企业', logoStatus: 'existing' });
  const direction = vi.completeEnterpriseViDirectionGeneration()[0];
  const strategy = vi.buildEnterpriseViBrandStrategy(snapshot);
  const seed = vi.buildEnterpriseViBrandSeed(direction, strategy);
  const scenes = vi.recommendEnterpriseViScenes(snapshot);

  assert.equal(strategy.evidenceBoundary, 'confirmed_only');
  assert.equal(seed.directionId, direction.id);
  assert.equal(seed.logoImage, direction.imageUrl);
  assert.ok(scenes.length >= 4 && scenes.length <= 6);
  assert.equal(scenes[0].id, 'packaging');
  assert.match(scenes[0].reason, /线上|商品|淘宝/);
  assert.ok(scenes.every(item => item.imageUrl.endsWith('.png') && item.reason));
});

test('VI image tasks retry independently and only adopted images enter the active context', () => {
  const vi = loadViModel();
  vi.startEnterpriseViDirectionGeneration({ companyName: '蔚然企业', logoStatus: 'existing' });
  const direction = vi.completeEnterpriseViDirectionGeneration()[0];
  vi.selectEnterpriseViDirection(direction.id);
  vi.getState().brandStrategy = vi.buildEnterpriseViBrandStrategy({ intakeBusinessModes: { display: '线上销售' } });
  vi.getState().brandSeed = vi.buildEnterpriseViBrandSeed(direction, vi.getState().brandStrategy);
  vi.getState().sceneRecommendations = vi.recommendEnterpriseViScenes({ intakeBusinessModes: { display: '线上销售' }, intakeCoreProduct: { display: '实物商品' } });
  vi.confirmEnterpriseViScenePlan(vi.getState().sceneRecommendations.slice(0, 4).map(item => item.id));
  const tasks = vi.queueEnterpriseViImageTasks();
  assert.ok(tasks.length >= 7);
  assert.ok(tasks.some(item => item.kind === 'foundation'));
  assert.ok(tasks.some(item => item.kind === 'scene'));

  const failed = tasks.find(item => item.kind === 'scene');
  const untouched = tasks.find(item => item.id !== failed.id);
  vi.advanceEnterpriseViImageTask(failed.id, 'failed');
  assert.equal(vi.getState().imageTasks.find(item => item.id === failed.id).status, 'failed');
  assert.equal(vi.getState().imageTasks.find(item => item.id === untouched.id).attempts, untouched.attempts);
  vi.retryEnterpriseViImageTask(failed.id);
  assert.equal(vi.getState().imageTasks.find(item => item.id === failed.id).status, 'queued');
  assert.equal(vi.getState().imageTasks.find(item => item.id === failed.id).attempts, 2);

  for (const task of vi.getState().imageTasks) {
    vi.advanceEnterpriseViImageTask(task.id, 'review');
    if (task.kind === 'foundation' || task.id === failed.id) vi.adoptEnterpriseViImageTask(task.id);
    else vi.rejectEnterpriseViImageTask(task.id);
  }
  assert.ok(vi.getAdoptedEnterpriseViImages().every(item => item.status === 'adopted'));
  vi.generateEnterpriseViDraft();
  const draft = vi.completeEnterpriseViDraftGeneration();
  const active = vi.activateEnterpriseViDraft(draft.id, '企业管理员');
  assert.ok(active);
  assert.ok(active.adoptedImages.every(item => item.status === 'adopted'));
  assert.ok(vi.buildActiveEnterpriseViContext().adoptedImages.every(item => item.status === 'adopted'));
});

test('VI directions must be selected before a complete draft can be generated', () => {
  const vi = loadViModel();
  vi.startEnterpriseViDirectionGeneration({ brandTone: '专业、直接' });
  vi.completeEnterpriseViDirectionGeneration();
  assert.equal(vi.getState().status, 'directions_ready');
  assert.equal(vi.getState().directions.length, 3);
  assert.equal(vi.generateEnterpriseViDraft(), null);
  vi.selectEnterpriseViDirection(vi.getState().directions[0].id);
  assert.equal(vi.generateEnterpriseViDraft().status, 'generating_vi');
});

test('confirming a VI direction immediately starts one idempotent complete VI generation', () => {
  const vi = loadViModel();
  const snapshot = {
    intakeBusinessModes: { display: '线上店铺销售' },
    intakeCoreProduct: { display: '实物商品' },
  };
  vi.startEnterpriseViDirectionGeneration({ companyName: '蔚然企业', logoStatus: 'existing' });
  const direction = vi.completeEnterpriseViDirectionGeneration()[0];

  const started = vi.confirmEnterpriseViDirectionAndGenerate(direction.id, snapshot);
  assert.equal(started.status, 'generating_vi');
  assert.equal(started.selectedDirectionId, direction.id);
  assert.equal(started.scenePlanConfirmed, true);
  assert.ok(started.sceneRecommendations.length >= 4);
  assert.ok(started.imageTasks.length > started.sceneRecommendations.length);
  assert.equal(started.draft.directionId, direction.id);
  assert.equal(started.directions.length, 1);
  assert.equal(started.directions[0].id, direction.id);
  assert.equal(vi.getActiveEnterpriseVi(), null);

  const draftId = started.draft.id;
  const repeated = vi.confirmEnterpriseViDirectionAndGenerate(direction.id, snapshot);
  assert.equal(repeated.draft.id, draftId);
  assert.equal(repeated.status, 'generating_vi');
  assert.equal(vi.getActiveEnterpriseVi(), null);
});

test('successful complete VI generation automatically activates one downloadable direction', () => {
  const vi = loadViModel();
  vi.startEnterpriseViDirectionGeneration({ companyName: '蔚然企业', logoStatus: 'existing' });
  const direction = vi.completeEnterpriseViDirectionGeneration()[1];
  vi.confirmEnterpriseViDirectionAndGenerate(direction.id, { intakeBusinessModes: { display: '企业服务' } });
  for (const task of vi.getState().imageTasks) vi.advanceEnterpriseViImageTask(task.id, 'review');

  const active = vi.completeEnterpriseViGenerationAndActivate();
  assert.equal(active.status, 'active');
  assert.equal(active.directionId, direction.id);
  assert.equal(vi.getState().directions.length, 1);
  assert.equal(vi.getState().draft, null);
  assert.equal(vi.getActiveEnterpriseVi().id, active.id);
});

test('confirmed enterprise preferences survive AI regeneration', () => {
  const vi = loadViModel();
  const first = vi.buildEnterpriseViPreferences({ brandTone: '专业、直接' });
  const confirmed = first.map(item => item.key === 'tone'
    ? {...item, value: '温暖、真诚', confirmation: 'enterprise_confirmed'}
    : item);
  vi.getState().preferences = confirmed;
  const regenerated = vi.buildEnterpriseViPreferences({ brandTone: '高端、权威' });
  assert.equal(regenerated.find(item => item.key === 'tone').value, '温暖、真诚');
  assert.equal(regenerated.find(item => item.key === 'tone').confirmation, 'enterprise_confirmed');
});

test('only a confirmed VI version becomes active and reusable', () => {
  const vi = loadViModel();
  const draft = buildDraft(vi);
  assert.equal(draft.status, 'draft_review');
  assert.equal(vi.getActiveEnterpriseVi(), null);
  assert.equal(vi.buildActiveEnterpriseViContext().status, 'system_default');
  vi.activateEnterpriseViDraft(draft.id, '企业管理员');
  assert.equal(vi.getActiveEnterpriseVi().id, draft.id);
  assert.equal(vi.getActiveEnterpriseVi().status, 'active');
  assert.equal(vi.getActiveEnterpriseVi().version, 1);
  assert.equal(vi.getState().history.length, 0);
  assert.equal(vi.buildActiveEnterpriseViContext().status, 'active');
  assert.equal(vi.buildActiveEnterpriseViContext().version, 1);
});

test('a failed replacement preserves the active VI and can retry its stage', () => {
  const vi = loadViModel();
  const draft = buildDraft(vi);
  vi.activateEnterpriseViDraft(draft.id, '企业管理员');
  const activeId = vi.getActiveEnterpriseVi().id;
  vi.startEnterpriseViDirectionGeneration({ brandTone: '现代增长' });
  vi.failEnterpriseViGeneration('directions', '生成服务暂时不可用');
  assert.equal(vi.getState().status, 'generation_failed');
  assert.equal(vi.getActiveEnterpriseVi().id, activeId);
  vi.retryEnterpriseViGeneration();
  assert.equal(vi.getState().status, 'analyzing_preferences');
  assert.equal(vi.getActiveEnterpriseVi().id, activeId);
});

test('enterprise cognition uses the approved staged VI information architecture', () => {
  for (const id of ['enterpriseViPreferenceSummary','enterpriseViDirections','enterpriseViScenePlan','enterpriseViDraft','enterpriseViVersionHistory']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /id="enterpriseViImageTasks"/);
  for (const action of ['preview-enterprise-vi-direction','select-enterprise-vi-direction','select-enterprise-vi-direction-from-preview','generate-enterprise-vi-draft','download-enterprise-vi','confirm-enterprise-vi-download','retry-enterprise-vi','edit-enterprise-vi-preferences']) {
    assert.match(html, new RegExp(`data-act="${action}"|case '${action}'`));
  }
  for (const label of ['AI 推断','企业确认','稳健决策','人文专业','现代增长','原型演示 · 待接入']) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, /企业档案与品牌视觉统一形成企业认知/);
  assert.doesNotMatch(html, />企业认知</);
  assert.match(html, /方案预览 · 尚未选择/);
  assert.match(html, /查看完整展示/);
  assert.match(html, /确认此方向并生成 VI/);
  assert.match(html, /下载全套 VI/);
  assert.match(html, /04 · 完整 VI/);
  assert.doesNotMatch(html, /data-act="activate-enterprise-vi"/);
  assert.doesNotMatch(html, />确认并启用</);
  const completeViRenderer = html.match(/function renderEnterpriseViDraft\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(completeViRenderer, />修改偏好</);
  assert.doesNotMatch(completeViRenderer, />查看历史版本</);
  assert.match(html, /能力演示 · 本次不会生成真实压缩包/);
  assert.match(html, /开始下载（演示）/);
  assert.match(html, /全套 VI 下载任务已创建（演示）/);
  assert.match(html, /<article class="vi-direction-card/);
  assert.doesNotMatch(html, /<button class="vi-direction-card/);
  assert.match(html, /vi-logo-showcase/);
  assert.match(html, /基于原 Logo 优化/);
  assert.match(html, /确认此方向并生成 VI/);
  assert.match(html, /Logo 标准组合/);
  assert.match(html, /Logo 图标版/);
  assert.match(html, /Logo 反白版/);
  assert.match(html, /vi-direction-image/);
  assert.match(html, /03 · VI 应用场景/);
  assert.doesNotMatch(html, /04 · 图片生成任务/);
  assert.match(html, /基础视觉资产/);
  assert.match(html, /视觉表现严格继承当前唯一 VI 方向/);
  const sceneRenderer = html.match(/function renderEnterpriseViScenePlan\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  for (const contract of ['direction.colors','direction.font','direction.logoProposal','vi-scene-brand-layer']) assert.match(sceneRenderer, new RegExp(contract.replace('.', '\\.')));
  assert.doesNotMatch(html, /确认场景并开始生成/);
  assert.match(html, /场景内容来自企业情况推荐，视觉表现严格继承当前唯一 VI 方向/);
  assert.match(html, /单张重新生成/);
  assert.match(html, /确认采用/);
  assert.match(html, /不采用/);
  assert.match(html, /图片生成服务尚待真实接入/);
});

test('VI preview and download preserve selection and activation boundaries', () => {
  const preview = html.match(/function previewEnterpriseViDirection\(id\)[\s\S]*?\n\}/)?.[0] || '';
  assert.match(preview, /enterpriseViState\.directions\.find/);
  assert.doesNotMatch(preview, /selectEnterpriseViDirection\(/);
  const download = html.match(/function openEnterpriseViDownload\(id\)[\s\S]*?\n\}/)?.[0] || '';
  assert.match(download, /getActiveEnterpriseVi\(\)/);
  assert.match(download, /active\.id!==id/);
  assert.doesNotMatch(download, /Blob|createObjectURL|download=/);
});

test('both direction confirmation actions use the shared confirm-to-generate flow', () => {
  const handlers = html.match(/case 'select-enterprise-vi-direction':[^\n]*[\s\S]*?case 'toggle-enterprise-vi-scene'/)?.[0] || '';
  assert.match(handlers, /confirmEnterpriseViDirectionAndGenerate/);
  assert.match(handlers, /select-enterprise-vi-direction-from-preview/);
  assert.match(handlers, /enterpriseViDraft/);
  assert.doesNotMatch(handlers, /请确认应用场景/);
});

test('onboarding queues VI direction generation without blocking diagnosis', () => {
  const handlers = html.match(/case 'confirm-profile':[\s\S]*?case 'start-deep-diagnosis'/)?.[0] || '';
  assert.match(handlers, /queueEnterpriseViDirectionGeneration\(\)/);
  assert.match(handlers, /showKbTab\('diagnosis'\)/);
  assert.match(handlers, /maybeStartBasicDiagnosis\(\)/);
  assert.doesNotMatch(handlers, /await queueEnterpriseViDirectionGeneration/);
});

test('content generation reads only the active VI context', () => {
  const context = html.match(/function buildPosterGenerationContext\(\)\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(context, /buildActiveEnterpriseViContext\(\)/);
  assert.doesNotMatch(context, /enterpriseViState\.draft/);
  assert.match(html, /未启用企业 VI · 使用系统默认视觉/);
  assert.match(html, /企业 VI v/);
});
