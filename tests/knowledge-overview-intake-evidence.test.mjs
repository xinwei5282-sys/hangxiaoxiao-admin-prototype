import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const overview = html.match(/<div class="kb-panel show" data-kbpanel="overview">([\s\S]*?)<div class="kb-panel kb-data-panel" data-kbpanel="work">/)?.[1] ?? '';

test('knowledge overview mirrors the four-step enterprise intake', () => {
  for (const section of ['企业身份', '业务、产品与客户', '获客与经营', '目标、资源与品牌']) {
    assert.match(overview, new RegExp(section));
  }
  for (const id of ['knowledgeOverviewSummary', 'knowledgeOverviewCards', 'knowledgeEvidenceSummary']) {
    assert.match(overview, new RegExp(`id="${id}"`));
  }
});

test('knowledge overview does not present fixed demo metrics as customer facts', () => {
  for (const demoValue of ['知识健康度', '286 条', '1,248 次', '已验证可用 241']) {
    assert.doesNotMatch(overview, new RegExp(demoValue));
  }
});

function loadKnowledgeOverviewModel() {
  const source = html.match(/\/\/ KNOWLEDGE_OVERVIEW_MODEL_START([\s\S]*?)\/\/ KNOWLEDGE_OVERVIEW_MODEL_END/)?.[1] ?? '';
  assert.ok(source, 'knowledge overview model source is missing');
  return Function(`${source};return {KNOWLEDGE_OVERVIEW_SECTIONS,buildKnowledgeOverviewModel};`)();
}

test('confirmed values stay separate from candidates and missing fields', () => {
  const { buildKnowledgeOverviewModel } = loadKnowledgeOverviewModel();
  const model = buildKnowledgeOverviewModel({
    confirmed: true,
    snapshot: {
      licenseCompanyName: { display: '示例科技有限公司', filled: true },
      intakeMainBusiness: { display: '企业经营诊断', filled: true },
    },
    candidates: [{ id: 'candidate-1', targetId: 'intakeCustomerPain', value: '获客不稳定', source: '公司介绍.docx', status: 'pending' }],
    tasks: [],
  });

  assert.equal(model.sections[0].confirmedCount, 1);
  assert.equal(model.sections[1].confirmedCount, 1);
  assert.equal(model.sections[1].candidateCount, 1);
  assert.equal(model.sections[1].fields.find(item => item.key === 'intakeCustomerPain').status, 'candidate');
  assert.doesNotMatch(model.sections[1].summary, /获客不稳定/);
  assert.ok(model.sections[0].missingCount > 0);
});

test('drafts, conflicts and evidence tasks remain distinct', () => {
  const { buildKnowledgeOverviewModel } = loadKnowledgeOverviewModel();
  const model = buildKnowledgeOverviewModel({
    confirmed: false,
    snapshot: {
      licenseCompanyName: { display: '草稿企业', filled: true },
      intakeCustomerPain: { display: '当前手填痛点', filled: true },
      intakeOnlineMonthlyVisitors: { display: '', filled: false, sectionId: 'operations', optionalMetric: true },
    },
    candidates: [{ id: 'candidate-2', targetId: 'intakeCustomerPain', value: '资料识别痛点', source: '产品手册.pdf', status: 'pending' }],
    tasks: [
      { id: 'task-1', state: 'parsing' },
      { id: 'task-2', state: 'review' },
      { id: 'task-3', state: 'failed' },
      { id: 'task-4', state: 'authorization' },
    ],
  });

  assert.equal(model.sections[0].fields.find(item => item.key === 'licenseCompanyName').status, 'draft');
  assert.equal(model.sections[1].fields.find(item => item.key === 'intakeCustomerPain').status, 'conflict');
  assert.equal(model.sections[1].summary, '');
  assert.equal(model.totals.parsingTasks, 1);
  assert.equal(model.totals.reviewTasks, 1);
  assert.equal(model.totals.failedTasks, 1);
  assert.equal(model.totals.authorizationTasks, 1);
  assert.doesNotMatch(JSON.stringify(model), /月访客数[^}]*0/);
});

function loadKnowledgeOverviewStore() {
  const source = html.match(/\/\/ KNOWLEDGE_OVERVIEW_STORE_START([\s\S]*?)\/\/ KNOWLEDGE_OVERVIEW_STORE_END/)?.[1] ?? '';
  assert.ok(source, 'knowledge overview store source is missing');
  return Function(`${source};return {createKnowledgeOverviewStore};`)().createKnowledgeOverviewStore;
}

test('evidence metadata and candidates survive reload without file bodies', () => {
  const createKnowledgeOverviewStore = loadKnowledgeOverviewStore();
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const store = createKnowledgeOverviewStore(storage);
  store.saveTasks([{ id: 'task-1', name: '产品手册.pdf', kind: '业务资料', state: 'parsing', candidateCount: 0, file: { secret: 'must not persist' } }]);
  store.saveCandidates([{ id: 'candidate-1', targetId: 'intakeCustomerPain', value: '获客不稳定', source: '产品手册.pdf', status: 'pending' }]);

  assert.equal(createKnowledgeOverviewStore(storage).loadTasks()[0].state, 'parsing');
  assert.equal(createKnowledgeOverviewStore(storage).loadCandidates()[0].status, 'pending');
  assert.equal('file' in createKnowledgeOverviewStore(storage).loadTasks()[0], false);
});

test('malformed overview storage recovers to empty arrays', () => {
  const createKnowledgeOverviewStore = loadKnowledgeOverviewStore();
  const storage = { getItem() { return '{bad json'; }, setItem() {} };
  const store = createKnowledgeOverviewStore(storage);
  assert.deepEqual(store.loadTasks(), []);
  assert.deepEqual(store.loadCandidates(), []);
});

test('overview rendering connects supplement, evidence and candidate actions', () => {
  for (const fn of ['collectEnterpriseIntakeSnapshot', 'renderEnterpriseKnowledgeOverview', 'renderKnowledgeEvidenceSummary', 'openEnterpriseOverviewStep']) {
    assert.match(html, new RegExp(`function ${fn}\\(`));
  }
  for (const action of ['toggle-knowledge-overview-card', 'supplement-enterprise-overview', 'review-enterprise-candidates']) {
    assert.match(html, new RegExp(`case '${action}'`));
  }
});

test('intake candidates and evidence task changes refresh the overview', () => {
  const candidateSource = html.match(/function applyEnterpriseIntakeCandidate\([\s\S]*?\n\}/)?.[0] ?? '';
  const taskSource = html.match(/function setOnboardingTaskState\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(candidateSource, /saveCandidates/);
  assert.match(candidateSource, /renderEnterpriseKnowledgeOverview/);
  assert.match(taskSource, /saveTasks/);
  assert.match(taskSource, /renderEnterpriseKnowledgeOverview/);
});
