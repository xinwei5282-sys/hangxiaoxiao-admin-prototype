import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('enterprise diagnosis and cognition live under the enterprise brain', () => {
  assert.doesNotMatch(html.match(/<nav>([\s\S]*?)<\/nav>/)?.[1] || '', /data-v="enterprise-profile"|data-nav-sub="enterprise-profile"/);
  const brainNav = html.match(/<div class="nav-sub" data-nav-sub="kb">([\s\S]*?)<\/div>/)?.[1] || '';
  for (const label of ['诊断总览','企业 VI','企业知识','外部情报','进化与治理']) assert.match(brainNav, new RegExp(`>${label}<\\/button>`));
  assert.equal((brainNav.match(/<button/g) || []).length, 5);
});

test('diagnosis completeness is derived from confirmed six-dimension fields', () => {
  for (const fn of ['getEnterpriseDiagnosisCompleteness', 'renderEnterpriseDiagnosis', 'buildDiagnosisMissingItems']) {
    assert.match(html, new RegExp(`function ${fn}\\(`));
  }
  for (const dimension of ['定位与战略', '客户与市场', '产品与客户价值', '商业模式与增长', '品牌与营销', '组织与执行']) {
    assert.match(html, new RegExp(dimension));
  }
  assert.match(html, /completeness\.overall<40/);
  assert.match(html, /completeness\.overall>=80/);
  assert.match(html, /dimensions\.every\(item=>item\.score>=60\)/);
  assert.match(html, /未确认的 AI 候选不计入/);
});

test('basic diagnosis auto-starts at 40 and deep diagnosis stays manual', () => {
  for (const fn of ['getEnterpriseDiagnosisStage', 'maybeStartBasicDiagnosis', 'startDeepDiagnosis']) {
    assert.match(html, new RegExp(`function ${fn}\\(`));
  }
  assert.match(html, /case 'start-deep-diagnosis':[\s\S]*?startDeepDiagnosis\(\)/);
  assert.match(html, /case 'confirm-modal-profile':[\s\S]*?maybeStartBasicDiagnosis\(\)/);
  const stageSource = html.match(/function getEnterpriseDiagnosisStage\([^\n]+/)?.[0] || '';
  assert.match(stageSource, /overall<40/);
  assert.match(stageSource, /overall>=80/);
  assert.match(stageSource, /dimensions\.every\(item=>item\.score>=60\)/);
  assert.doesNotMatch(stageSource, /startDeepDiagnosis\(/);
});

test('initial and deep diagnosis remain as separate previewable reports', () => {
  for (const fn of ['openInitialDiagnosisPreview', 'openDeepDiagnosisPreview']) {
    assert.match(html, new RegExp(`function ${fn}\\(`));
  }
  assert.match(html, /data-act="preview-initial-diagnosis"/);
  assert.match(html, /data-act="preview-deep-diagnosis"/);
  assert.match(html, /case 'preview-initial-diagnosis':[\s\S]*?openInitialDiagnosisPreview\(\)/);
  assert.match(html, /case 'preview-deep-diagnosis':[\s\S]*?openDeepDiagnosisPreview\(\)/);
  for (const phrase of ['企业初步诊断报告', '企业深度分析报告', '六维概览', '信息缺口', '跨维度根因', '证据链', '阶段行动方案', '资料快照']) {
    assert.match(html, new RegExp(phrase));
  }
});

test('diagnosis supplement entry reuses the unchanged four-step intake form', () => {
  assert.match(html, /function openEnterpriseProfileSupplement\(targetField/);
  assert.match(html, /case 'supplement-enterprise-profile':[\s\S]*?openEnterpriseProfileSupplement/);
  assert.match(html, /data-target-field/);
  assert.match(html, /function showEnterpriseIntakeStep\(step,\{focus=false\}=\{\}\)/);
  assert.match(html, /Math\.max\(1,Math\.min\(4,step\)\)/);
});

test('V1 profile is manually entered through a guided flow', () => {
  const intake = html.match(/id="newUserGuideModal"[\s\S]*?<div class="new-user-guide-actions">/)?.[0] ?? '';
  assert.doesNotMatch(intake, /企查查|自动工商补全|公开信息候选/);
  for (const phrase of ['企业身份', '业务、产品与客户', '获客与经营', '目标、资源与品牌', '完成初步设置', '上一步', '下一步', '企业信息完整度', '待确认', '已填写']) assert.match(html, new RegExp(phrase));
  for (const field of ['企业全称', '所属行业', '主营业务', '核心产品', '核心客户', '购买场景', '客户痛点', '客户主要从哪里来', '生意', '最想改善', '主要目标']) assert.match(html, new RegExp(field));
});

test('quick profile favors guided choices over free-form typing', () => {
  const fieldSource = html.match(/const diagnosisFieldSets=\[([\s\S]*?)\n\];/)?.[1] || '';
  assert.ok((fieldSource.match(/<select class="inp">/g) || []).length >= 10);
  assert.ok((fieldSource.match(/<textarea class="inp"/g) || []).length <= 4);
  for (const option of ['暂不清楚', '成长扩张期', '老客户转介绍', '多渠道并行', '项目 + 持续服务', '缺少内容与运营团队']) assert.match(fieldSource, new RegExp(option.replace(/[+]/g, '\\+')));
});

test('six-dimension diagnosis separates evidence from analysis', () => {
  for (const dimension of ['定位与战略', '客户与市场', '产品与客户价值', '商业模式与增长', '品牌与营销', '组织与执行']) assert.match(html, new RegExp(dimension));
  for (const evidence of ['已确认信息', '未确认的 AI 候选不计入', 'AI 优先提醒', '信息缺口']) assert.match(html, new RegExp(evidence));
  for (const summary of ['优先问题', '建议下一步', '信息完整度', '可靠诊断']) assert.match(html, new RegExp(summary));
});

test('enterprise VI and evidence intake remain complete after removing the duplicate brand page', () => {
  for (const phrase of ['Logo', '视觉关键词', '图片风格', '品牌资料', '禁止使用的表述', '企业 VI', '三套方向', '完整 VI', '产品手册', '报价表', '企业介绍', '案例', '历史宣传资料']) assert.match(html, new RegExp(phrase));
  assert.match(html, /previewEnterpriseViDirection/);
  assert.match(html, /download-enterprise-vi/);
  assert.match(html, /id="onboardingMaterialFile"[^>]*multiple/);
});

test('profile interaction functions are bounded and persistent in the prototype', () => {
  assert.match(html, /function showDiagnosisStep\(step\)/);
  assert.match(html, /Math\.max\(0,Math\.min\(4,step\)\)/);
  assert.match(html, /快速画像草稿已保存/);
  assert.match(html, /基础画像已完成/);
});

test('brand preferences are collected with the base profile', () => {
  for (const phrase of ['目标、资源与品牌', 'Logo 情况', '品牌表达语气', '禁止使用的表述', '品牌资料']) assert.match(html, new RegExp(phrase));
});

test('confirmed intake feeds automatic basic and manual deep diagnosis', () => {
  assert.match(html, /case 'do-login': startKnowledgeOnboarding\(\)/);
  assert.match(html, /function setLicenseRecognitionState\(state,fileName/);
  assert.match(html, /case 'confirm-modal-profile':[\s\S]*go\('kb'\)[\s\S]*showKbTab\('diagnosis'\)[\s\S]*maybeStartBasicDiagnosis\(\)/);
  assert.match(html, /40% 自动生成基础诊断/);
  assert.match(html, /开始深度诊断/);
  assert.match(html, /case 'start-deep-diagnosis':[\s\S]*startDeepDiagnosis\(\)/);
});

test('login lands on home and resumes the unfinished layer', () => {
  assert.match(html, /function startKnowledgeOnboarding\(\)[\s\S]*go\('home'\)/);
  assert.match(html, /localStorage\.getItem\('aiHuokeQuickProfileCompletedV1'\)/);
  assert.match(html, /localStorage\.getItem\('aiHuokeDeepDiagnosisGeneratedV1'\)/);
  assert.match(html, /id="newUserGuideModal" role="dialog" aria-modal="true"/);
  assert.match(html, /class="btn gho new-user-guide-close"[^>]*data-act="dismiss-new-user-guide"[^>]*aria-label="关闭首次引导"/);
  assert.match(html, /id="deepDiagnosisReminderModal" role="dialog" aria-modal="true"/);
  assert.match(html, /case 'pick-onboarding-license':[\s\S]*onboardingLicenseFile/);
  assert.match(html, /case 'confirm-modal-profile':[\s\S]*go\('kb'\)[\s\S]*showKbTab\('diagnosis'\)/);
  assert.match(html, /case 'dismiss-new-user-guide':[\s\S]*已留在首页/);
  assert.match(html, /case 'confirm-modal-profile':[\s\S]*localStorage\.setItem\('aiHuokeQuickProfileCompletedV1','1'\)/);
  assert.match(html, /function startDeepDiagnosis\(\)[\s\S]*localStorage\.setItem\('aiHuokeDeepDiagnosisGeneratedV1','1'\)/);
});

test('deep diagnosis reminder appears only on the first login of each local day', () => {
  const reminderSource = html.match(/const deepDiagnosisReminderDateKey=[\s\S]*?(?=\nfunction saveEnterpriseDiagnosisState)/)?.[0] || '';
  assert.ok(reminderSource, 'daily reminder behavior is missing');

  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const createReminder = Function('localStorage', `${reminderSource};return {
    getLocalDateKey,
    shouldShowDeepDiagnosisReminder,
    markDeepDiagnosisReminderShown,
    resetSession(){deepDiagnosisReminderShownInSession=false;}
  };`);
  const reminder = createReminder(localStorage);

  assert.equal(reminder.getLocalDateKey(new Date('2026-08-11T08:30:00+08:00')), '2026-08-11');
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, true, '2026-08-11'), true);
  reminder.markDeepDiagnosisReminderShown('2026-08-11');
  assert.equal(values.get('aiHuokeDeepDiagnosisReminderDateV1'), '2026-08-11');
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, true, '2026-08-11'), false);
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, true, '2026-08-12'), true);
  reminder.resetSession();
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, true, '2026-08-11'), false);
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, true, '2026-08-12'), true);
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(true, true, '2026-08-12'), false);
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, false, '2026-08-12'), false);
});

test('deep diagnosis reminder falls back to once per page session when storage fails', () => {
  const reminderSource = html.match(/const deepDiagnosisReminderDateKey=[\s\S]*?(?=\nfunction saveEnterpriseDiagnosisState)/)?.[0] || '';
  assert.ok(reminderSource, 'daily reminder behavior is missing');
  const unavailableStorage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); },
  };
  const reminder = Function('localStorage', `${reminderSource};return {
    shouldShowDeepDiagnosisReminder,
    markDeepDiagnosisReminderShown
  };`)(unavailableStorage);

  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, true, '2026-08-11'), true);
  reminder.markDeepDiagnosisReminderShown('2026-08-11');
  assert.equal(reminder.shouldShowDeepDiagnosisReminder(false, true, '2026-08-11'), false);
});

test('new user onboarding is a single-page enterprise intake', () => {
  for (const removed of ['01 提供资料', '02 确认识别', '03 补充缺口', '04 查看成果']) {
    assert.doesNotMatch(html, new RegExp(removed));
  }
  for (const id of ['onboardingLicenseFile', 'onboardingMaterialFile', 'onboardingLicenseResult', 'onboardingAsyncTasks']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const field of ['licenseCompanyName', 'licenseCreditCode', 'licenseLegalRepresentative', 'licenseEstablishedDate', 'licenseRegisteredAddress', 'licenseBusinessScope']) {
    assert.match(html, new RegExp(`id="${field}"`));
  }
  assert.match(html, /id="onboardingLicenseFile"[^>]*accept="[^"]*\.jpg[^"]*\.pdf/);
  assert.match(html, /case 'pick-onboarding-license':[\s\S]*onboardingLicenseFile/);
  assert.match(html, /function setLicenseRecognitionState\(state,fileName/);
  assert.match(html, /原型演示 · OCR 待接入/);
});

test('uploaded license is previewed beside editable fields and can be replaced', () => {
  for (const id of [
    'onboardingLicensePreview',
    'onboardingLicensePreviewImage',
    'onboardingLicensePreviewPdf',
    'onboardingLicenseFileName',
    'licensePreviewModal'
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /function setLicensePreview\(file\)/);
  assert.match(html, /function clearLicensePreview\(\)/);
  assert.match(html, /URL\.createObjectURL\(file\)/);
  assert.match(html, /URL\.revokeObjectURL\(activeLicensePreviewUrl\)/);
  assert.match(html, /case 'view-onboarding-license'/);
  assert.match(html, /case 'replace-onboarding-license'/);
});

test('license fields are visible and editable before upload', () => {
  assert.match(html, /id="onboardingLicenseEcho" class="license-echo-layout no-preview">/);
  assert.match(html, /id="onboardingLicenseResult"><div class="license-result-grid">/);
  assert.doesNotMatch(html, /id="license(?:CompanyName|CreditCode|LegalRepresentative|EstablishedDate|RegisteredAddress|BusinessScope)"[^>]*(?:disabled|readonly)/);
  const recognition = html.match(/function setLicenseRecognitionState\(state,fileName=''\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(recognition, /result\.hidden=true/);
});

test('enterprise intake uses four optional form steps', () => {
  for (const id of ['enterpriseIntakeSteps', 'enterpriseIntakeIdentity', 'enterpriseIntakeBusiness', 'enterpriseIntakeOperations', 'enterpriseIntakeGoals']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const label of ['企业身份', '业务、产品与客户', '获客与经营', '目标、资源与品牌']) assert.match(html, new RegExp(label));
  assert.match(html, /function showEnterpriseIntakeStep\(step,\{focus=false\}=\{\}\)/);
  assert.match(html, /Math\.max\(1,Math\.min\(4,step\)\)/);
  assert.match(html, /case 'next-enterprise-intake'/);
  assert.match(html, /case 'prev-enterprise-intake'/);
  assert.match(html, /case 'skip-enterprise-intake'/);
  assert.match(html, /上传企业资料（可选）/);
  assert.match(html, /官网 \/ 公众号链接（可选）/);
  assert.doesNotMatch(html, /class="material-group-card"/);
});

test('adaptive intake maps the diagnosis fields without requiring them', () => {
  for (const id of [
    'intakeIndustry', 'intakeBusinessStage', 'intakeMainBusiness', 'intakeCoreProduct',
    'intakeTransactionCustomer', 'intakeTransactionMethod', 'intakeCoreCustomer', 'intakeCustomerPain',
    'intakeVerifiedValue', 'intakeAcquisitionSources', 'intakeBusinessStability',
    'intakeLeadOwner', 'intakeImprovementPriority', 'intakeGoalDirection', 'intakeGoalHorizon',
    'intakeGoalResult', 'intakeBudgetPeriod', 'intakeExecutionOwner', 'intakeWeeklyTime',
    'intakeExecutionTeamSize', 'intakeCapabilities', 'intakeExecutionConstraint',
    'intakeBrandToneGroup', 'intakeForbiddenClaims'
  ]) assert.match(html, new RegExp(`id="${id}"`));
  const intake = html.match(/id="enterpriseIntakeIdentity"[\s\S]*?id="confirmModalProfileBtn"[^>]*>/)?.[0] || '';
  assert.doesNotMatch(intake, /\srequired(?:\s|>)/);
  assert.match(html, /id="enterpriseIntakeBrandDetails"/);
});

test('goals and resources use optional plain-language controls', () => {
  const goals = html.match(/id="enterpriseIntakeGoals"[\s\S]*?id="enterpriseIntakeActions"/)?.[0] || '';
  for (const id of [
    'intakeGoalDirection', 'intakeGoalHorizon', 'intakeGoalResult',
    'intakeBudgetPeriod', 'intakeBudgetMonthlyRange', 'intakeBudgetAnnualRange',
    'intakeExecutionOwner', 'intakeWeeklyTime', 'intakeExecutionTeamSize',
    'intakeCapabilities', 'intakeExecutionConstraint'
  ]) assert.match(goals, new RegExp(`id="${id}"`));
  assert.equal((goals.match(/name="intakeGoalDirection"/g) || []).length, 6);
  assert.equal((goals.match(/name="intakeGoalHorizon"/g) || []).length, 4);
  assert.equal((goals.match(/name="intakeCapabilities"/g) || []).length, 7);
  for (const phrase of ['未来 3 个月', '按月', '按年', '每周可投入时间', '暂无专职人员', '本页内容均非必填']) {
    assert.match(goals, new RegExp(phrase));
  }
});

test('brand boundaries stay collapsed and visual attributes are inferred from evidence', () => {
  const goals = html.match(/id="enterpriseIntakeGoals"[\s\S]*?id="enterpriseIntakeActions"/)?.[0] || '';
  for (const id of [
    'enterpriseIntakeBrandDetails', 'intakeLogoStatus',
    'intakeBrandToneGroup', 'intakeForbiddenClaims', 'onboardingBrandFile'
  ]) assert.match(goals, new RegExp(`id="${id}"`));
  for (const id of ['intakePrimaryColor', 'intakeVisualStyle', 'intakeImageStyle']) {
    assert.doesNotMatch(goals, new RegExp(`id="${id}"`));
  }
  for (const phrase of ['Logo', '品牌资料', '禁止使用的表述', 'AI', '主色', '视觉风格', '后续确认']) {
    assert.match(goals, new RegExp(phrase));
  }
  const upload = goals.match(/<input id="onboardingBrandFile"[^>]+>/)?.[0] || '';
  assert.match(upload, /\smultiple(?:\s|>)/);
  for (const ext of ['.doc', '.docx', '.txt', '.pdf', '.ppt', '.pptx', '.jpg', '.png']) {
    assert.match(upload, new RegExp(ext.replace('.', '\\.')));
  }
  assert.match(html, /bindOnboardingEvidenceInput\('onboardingBrandFile','目标、资源与品牌资料'\)/);
});

test('goal resource and brand controllers preserve confirmation boundaries', () => {
  for (const fn of [
    'syncGoalRecommendation', 'syncBudgetPeriod', 'syncCapabilityChoice',
    'syncBrandToneChoice', 'saveEnterpriseIntakeDraft',
    'restoreEnterpriseIntakeDraft', 'migrateEnterpriseIntakeDraft'
  ]) assert.match(html, new RegExp(`function ${fn}\\(`));
  assert.match(html, /aiHuokeEnterpriseIntakeDraftV2/);
  const migration = html.match(/function migrateEnterpriseIntakeDraft\(raw\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(migration, /annualGoal[\s\S]*intakeGoalResult/);
  assert.doesNotMatch(migration, /annualGoal[\s\S]*intakeGoalDirection/);
  assert.doesNotMatch(migration, /annualGoal[\s\S]*intakeGoalHorizon/);
});

test('acquisition intake starts with plain-language common status instead of required metrics', () => {
  const operations = html.match(/id="enterpriseIntakeOperations"[\s\S]*?id="enterpriseIntakeGoals"/)?.[0] || '';
  for (const id of ['intakeAcquisitionSources', 'intakeBusinessStability', 'intakeLeadOwner', 'intakeImprovementPriority']) {
    assert.match(operations, new RegExp(`id="${id}"`));
  }
  for (const oldId of ['intakeAcquisitionChannels', 'intakeMonthlyLeads', 'intakeConversionRate', 'intakeRevenueModel']) {
    assert.doesNotMatch(operations, new RegExp(`id="${oldId}"`));
  }
  for (const phrase of ['有客户，但时好时坏', '没有固定方式', '提高下单或签约成交']) assert.match(operations, new RegExp(phrase));
});

test('acquisition status follows all seven selected business modes', () => {
  for (const mode of [
    'online-retail', 'offline-store', 'wholesale', 'project-sales',
    'professional-service', 'subscription', 'custom-production'
  ]) assert.match(html, new RegExp(`data-acquisition-mode-section="${mode}"`));
  for (const id of [
    'intakeOnlineMetrics', 'intakeOfflineMetrics', 'intakeWholesaleMetrics', 'intakeProjectMetrics',
    'intakeServiceMetrics', 'intakeSubscriptionMetrics', 'intakeCustomMetrics'
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /我知道经营数据，可以补充/);
});

test('acquisition mode visibility preserves values and uncertain sources are exclusive', () => {
  assert.match(html, /function syncAcquisitionModeSections\(\)/);
  assert.match(html, /section\.hidden=!active\.has\(section\.dataset\.acquisitionModeSection\)/);
  assert.match(html, /function syncExclusiveUncertainChoice\(input\)/);
  assert.match(html, /data-exclusive-uncertain/);
  assert.match(html, /function activeAcquisitionModeControls\(\)/);
  const sync = html.match(/function syncAcquisitionModeSections\(\)\{([\s\S]*?)\nfunction syncBusinessModeSections/)?.[1] || '';
  assert.doesNotMatch(sync, /\.value=''|\.checked=false/);
});

test('acquisition choices collapse to one readable column on mobile', () => {
  assert.match(html, /@media\(max-width:700px\)[\s\S]*?\.acquisition-card \.business-scene-options\{grid-template-columns:1fr\}/);
});

test('business modes support mixed online and offline operations', () => {
  for (const mode of [
    'online-retail', 'offline-store', 'wholesale', 'project-sales',
    'professional-service', 'subscription', 'custom-production'
  ]) assert.match(html, new RegExp(`name="intakeBusinessModes" value="${mode}"`));
  assert.equal((html.match(/<input type="checkbox" name="intakeBusinessModes"/g) || []).length, 7);
  for (const id of [
    'intakeOnlinePriceMin', 'intakeOnlinePriceMax', 'intakeOnlineAverageOrder', 'intakeOnlinePurchaseScenes',
    'intakeOfflinePriceMin', 'intakeOfflinePriceMax', 'intakeOfflineAverageOrder', 'intakeOfflinePurchaseScenes'
  ]) assert.match(html, new RegExp(`id="${id}"`));
});

test('selected business modes reveal independent pricing and purchase-scene groups', () => {
  for (const mode of [
    'online-retail', 'offline-store', 'wholesale', 'project-sales',
    'professional-service', 'subscription', 'custom-production'
  ]) assert.match(html, new RegExp(`data-business-mode-section="${mode}"`));
  assert.match(html, /function selectedBusinessModes\(\)/);
  assert.match(html, /function syncBusinessModeSections\(\)/);
  assert.match(html, /section\.hidden=!active\.has\(section\.dataset\.businessModeSection\)/);
});

test('adaptive candidates never overwrite an existing manual value', () => {
  assert.match(html, /function updateEnterpriseIntakeCompletion\(\)/);
  assert.match(html, /function applyEnterpriseIntakeCandidate\(/);
  assert.match(html, /status=officialValue&&officialValue!==value\?'conflict':'pending'/);
  assert.match(html, /officialValue/);
  assert.match(html, /资料候选 · 待确认/);
  assert.match(html, /资料候选 · 与手填内容冲突/);
  assert.match(html, /case 'adopt-enterprise-intake-candidate'/);
});

test('optional material upload accepts multiple document files', () => {
  const input = html.match(/<input id="onboardingMaterialFile"[^>]+>/)?.[0] || '';
  assert.match(input, /\smultiple(?:\s|>)/);
  for (const ext of ['.doc', '.docx', '.txt', '.pdf', '.ppt', '.pptx']) assert.match(input, new RegExp(ext.replace('.', '\\.')));
  assert.doesNotMatch(input, /\.xls|\.xlsx|\.csv|image\/\*|audio\/\*|video\/\*/);
  assert.match(html, /id="confirmModalProfileBtn"(?![^>]*disabled)[^>]*>完成初步设置/);
});

test('business and operating steps expose unified materials and asynchronous source states', () => {
  for (const phrase of [
    '上传企业资料（可选）', 'Word、TXT、PDF、PPT', '可一次选择多个文件',
    '官网 / 公众号链接（可选）',
    '已排队', '采集中', '解析中', '待确认', '部分成功', '失败', '等待授权'
  ]) assert.match(html, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /公众号单篇文章/);
  assert.match(html, /公众号账号[\s\S]*授权/);
  assert.match(html, /公众号采集[\s\S]*待接入/);
  assert.match(html, /function renderOnboardingAsyncTask\(/);
  assert.match(html, /case 'add-onboarding-source'/);
});

test('saved onboarding content enters knowledge with confirmation states', () => {
  assert.match(html, /case 'confirm-modal-profile':[\s\S]*已确认内容已同步到企业知识/);
  assert.match(html, /异步资料只生成知识候选/);
  assert.match(html, /未确认内容保留在待确认/);
});
