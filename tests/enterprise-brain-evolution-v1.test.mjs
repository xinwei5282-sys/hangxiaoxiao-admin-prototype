import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadBrainModel() {
  const source = html.match(/const enterpriseBrainEvolutionKey=[\s\S]*?(?=\nfunction renderGeneratedFormalKnowledge)/)?.[0] || '';
  assert.ok(source, 'enterprise brain evolution model is missing');
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  return Function('localStorage', `${source};return {
    classifyBrainKnowledge, scoreKnowledgeItem, scoreContentAsset, scoreLearningCandidate,
    recordGeneratedContent, recordContentRevision, recordContentPublication,
    softDeleteContentAsset, canonicalizePublicUrl, deriveIntelligenceFreshness,
    buildPublicIntelligenceCandidates,
    queueIntelligenceCandidate, confirmIntelligenceCandidate,
    rejectIntelligenceCandidate, suggestScoreWeightChange, getState:()=>enterpriseBrainEvolutionState
  };`)(localStorage);
}

test('knowledge is automatically grouped into the approved seven groups', () => {
  const brain = loadBrainModel();
  const expected = ['企业基础事实','产品与服务','客户与市场','品牌与内容规范','销售与经营规则','案例与证明材料','外部环境与行业情报'];
  for (const group of expected) assert.match(html, new RegExp(group));
  assert.equal(brain.classifyBrainKnowledge({ text: '竞对和行业政策发生变化' }), '外部环境与行业情报');
  assert.equal(brain.classifyBrainKnowledge({ text: '产品报价和服务套餐' }), '产品与服务');
});

test('three scores are explainable and use separate dimensions', () => {
  const brain = loadBrainModel();
  const knowledge = brain.scoreKnowledgeItem({sourceAuthority:.8,confirmed:1,freshness:1,consistency:.8,scope:1,rights:1}, '2026-08-11');
  assert.equal(knowledge.score, 92);
  assert.equal(knowledge.band, '高');
  assert.ok(knowledge.reasons.length);
  assert.ok(Array.isArray(knowledge.deductions));
  assert.equal(knowledge.updatedAt, '2026-08-11');

  const content = brain.scoreContentAsset({facts:1,brand:.8,compliance:1,completeness:.8,humanEdit:.5,outcome:.7});
  const learning = brain.scoreLearningCandidate({repetition:1,evidence:.8,outcome:.7,clarity:1,reuse:1,risk:.5});
  assert.notEqual(content.score, learning.score);
  assert.equal(learning.score, 87);
  assert.equal(learning.band, '优先');
});

test('generated content is reprocessed after revision, publication and soft deletion', () => {
  const brain = loadBrainModel();
  const asset = brain.recordGeneratedContent({title:'朋友圈活动图文',type:'朋友圈图文',source:'营销物料',text:'产品套餐与服务'});
  assert.equal(asset.processCount, 1);
  assert.equal(asset.formal, true);
  assert.equal(asset.reusable, true);
  assert.equal(asset.factAuthority, false);
  assert.equal(asset.knowledgeType, '系统生成内容');
  assert.equal(asset.group, '产品与服务');
  assert.equal(asset.version, 1);
  brain.recordContentRevision(asset.id, '修改价格表达');
  assert.equal(asset.version, 2);
  brain.recordContentPublication(asset.id, {channel:'朋友圈', outcome:.8});
  const deleted = brain.softDeleteContentAsset(asset.id, {reason:'事实错误', deletedBy:'蔚然'});
  assert.equal(deleted.status, 'deleted');
  assert.equal(deleted.formal, false);
  assert.equal(deleted.reusable, false);
  assert.equal(deleted.processCount, 4);
  assert.equal(deleted.deletedBy, '蔚然');
  assert.ok(deleted.audit.some(item => item.action === 'soft_delete'));
  assert.ok(brain.getState().learningCandidates.some(item => item.kind === 'prohibited_rule'));
});

test('ordinary expiry deletion is not automatically treated as a negative rule', () => {
  const brain = loadBrainModel();
  const asset = brain.recordGeneratedContent({title:'端午活动',type:'海报'});
  brain.softDeleteContentAsset(asset.id, {reason:'活动过期', deletedBy:'运营'});
  assert.equal(brain.getState().learningCandidates.length, 0);
});

test('external intelligence remains candidate-only until a human confirms it', () => {
  const brain = loadBrainModel();
  const candidate = brain.queueIntelligenceCandidate({type:'政策',title:'本地扶持政策',url:'https://example.com/policy'});
  assert.equal(candidate.formal, false);
  assert.equal(candidate.usableForFacts, false);
  brain.confirmIntelligenceCandidate(candidate.id, '蔚然');
  assert.equal(candidate.formal, true);
  assert.equal(candidate.usableForFacts, true);

  const rejected = brain.queueIntelligenceCandidate({type:'竞对',title:'竞对促销信息'});
  brain.rejectIntelligenceCandidate(rejected.id, '来源不可靠');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.usableForFacts, false);
});

test('public website intelligence preserves traceability and merges duplicate URLs', () => {
  const brain = loadBrainModel();
  assert.equal(brain.canonicalizePublicUrl('https://example.com/news/?utm_source=feed&a=1#top'), 'https://example.com/news?a=1');
  assert.equal(brain.canonicalizePublicUrl('javascript:alert(1)'), '');
  assert.equal(brain.deriveIntelligenceFreshness('2026-08-01', '2026-08-12'), 'current');
  assert.equal(brain.deriveIntelligenceFreshness(null, '2026-08-12'), 'unknown');

  const first = brain.queueIntelligenceCandidate({
    type:'policy', title:'中小企业数字化政策更新', summary:'公开政策栏目发布新信息',
    url:'https://example.com/policy/?utm_campaign=test', source:'示例政府网站',
    publishedAt:'2026-08-01', collectedAt:'2026-08-12T10:00:00.000Z', applicableRegion:'全国',
    evidenceLevel:'primary', confidence:'high', enterpriseRelevance:'影响企业服务方案设计'
  });
  const duplicate = brain.queueIntelligenceCandidate({
    type:'政策', title:'同一政策的另一标题', url:'https://example.com/policy',
    source:'示例政府网站', collectedAt:'2026-08-12T11:00:00.000Z'
  });

  assert.equal(first.id, duplicate.id);
  assert.equal(brain.getState().intelligenceCandidates.length, 1);
  assert.equal(first.url, 'https://example.com/policy');
  assert.equal(first.publishedAt, '2026-08-01');
  assert.equal(first.applicableRegion, '全国');
  assert.equal(first.evidenceLevel, 'primary');
  assert.equal(first.confidence, 'high');
  assert.equal(first.freshness, 'current');
  assert.equal(first.sources[0].publisher, '示例政府网站');
  assert.deepEqual(first.suggestedActions, ['view_source','adopt','ignore']);
  assert.equal(first.status, 'pending_confirmation');
  assert.equal(first.formal, false);
});

test('public website collection creates traceable review candidates for the selected scope', () => {
  const brain = loadBrainModel();
  const candidates = brain.buildPublicIntelligenceCandidates({
    keywords:'AI 获客、企业经营', region:'浙江', days:30, collectedAt:'2026-08-12T12:00:00.000Z'
  });
  assert.deepEqual(candidates.map(item => item.type), ['policy','industry','competitor']);
  for (const item of candidates) {
    assert.equal(item.applicableRegion, '浙江');
    assert.equal(item.collectedAt, '2026-08-12T12:00:00.000Z');
    assert.match(item.summary, /公开/);
    assert.ok(item.enterpriseRelevance);
    assert.match(item.url, /^https:\/\//);
    assert.ok(item.source);
  }
});

test('AI weight suggestions cannot change scoring weights without confirmation', () => {
  const brain = loadBrainModel();
  const before = JSON.stringify(brain.getState().weights);
  const candidate = brain.suggestScoreWeightChange('提高内容效果权重');
  assert.equal(candidate.status, 'pending_confirmation');
  assert.equal(JSON.stringify(brain.getState().weights), before);
});

test('enterprise brain actions expose explicit human governance boundaries', () => {
  for (const action of ['collect-brain-intelligence','add-brain-intelligence','confirm-brain-intelligence','reject-brain-intelligence','delete-brain-content','confirm-brain-learning','reject-brain-learning']) {
    assert.match(html, new RegExp(`data-act="${action}"|case '${action}'`));
  }
  for (const phrase of ['人工确认后才能入脑','不得自动修改评分权重','软删除','不可复用']) assert.match(html, new RegExp(phrase));
});

test('generated content is rendered inside formal knowledge instead of a standalone asset card', () => {
  assert.doesNotMatch(html, /id="enterpriseBrainContentAssets"|id="brainContentAssetList"/);
  assert.match(html, /function renderGeneratedFormalKnowledge\(\)/);
  assert.match(html, /data-generated-knowledge/);
  assert.match(html, /系统生成内容/);
  assert.match(html, /生成内容中的硬事实不会反向覆盖企业事实/);
});
