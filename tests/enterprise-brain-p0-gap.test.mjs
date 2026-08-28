import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('P0 enterprise brain exposes a shared knowledge readiness contract', () => {
  for (const token of ['brainReadinessPanel', 'company_profile', 'diagnosis_result', 'brand_preference', 'knowledge_item', 'auto_usable', 'draft_only', 'quarantined']) {
    assert.match(html, new RegExp(token));
  }
  assert.match(html, /企业知识可用性/);
  assert.match(html, /已确认、可追溯且未过期/);
});

test('P0 content generation shows knowledge evidence before generation', () => {
  assert.match(html, /createKnowledgeGate/);
  assert.match(html, /企业知识依据/);
  assert.match(html, /缺失内容不会自动补写/);
  assert.match(html, /renderCreateKnowledgeGate/);
});

test('P0 profile confirmation and diagnosis update the shared brain state', () => {
  assert.match(html, /markProfileConfirmed\(\)/);
  assert.match(html, /markDiagnosisGenerated\(\)/);
  assert.match(html, /已确认并进入企业知识/);
  assert.match(html, /可供授权 Agent 调用/);
});
