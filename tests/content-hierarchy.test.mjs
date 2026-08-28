import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const routes = [...html.matchAll(/<section class="page[^\"]*" data-p="([^"]+)"/g)];

function page(route) {
  const start = html.search(new RegExp(`<section class="page[^\"]*" data-p="${route}"`));
  if (start < 0) return '';
  const next = routes.map(match => match.index).find(index => index > start);
  return html.slice(start, next ?? html.indexOf('</main>', start));
}

test('shared hierarchy primitives are available', () => {
  for (const cls of ['page-heading', 'section-heading', 'content-panel', 'content-row']) {
    assert.match(html, new RegExp(`\\.${cls}(?:[,{])`), `missing .${cls}`);
  }
});

test('customer routes are registered for one shared page heading', () => {
  assert.match(html, /const hierarchyRoutes=\['home','brand-planning','marketing-materials','acquisition','kb','settings'\]/);
  assert.match(html, /heading\.classList\.add\('page-heading'\)/);
  for (const route of ['home', 'brand-planning', 'marketing-materials', 'acquisition', 'kb', 'settings']) {
    assert.match(html, new RegExp(`['"]${route}['"]`));
  }
  assert.doesNotMatch(html, /data-p="enterprise-profile"/);
});

test('decision workspaces expose ordered hierarchy mappings', () => {
  const implementation = html.match(/function applyContentHierarchy\(\)\{([\s\S]*?)\n\}/)?.[1] ?? '';
  for (const route of ['home', 'acquisition', 'kb']) assert.match(implementation, new RegExp(`const ${route}=`));
  for (const name of ['current-focus', 'pending-work', 'primary-workspace', 'recent-status']) assert.match(implementation, new RegExp(`['"]${name}['"]`));
  assert.match(implementation, /frame\.insertBefore\(aside,main\)/);
});

test('page-level primary actions are unique', () => {
  assert.equal((html.match(/dataset\.pagePrimary='true'/g) || []).length, 2);
  assert.match(html, /new-acquisition-task/);
  assert.match(html, /open-kb-upload/);
});

test('responsive hierarchy collapses without forcing page width', () => {
  assert.match(html, /@media\(max-width:1023px\)[\s\S]*?\.decision-layout,[^{]+\{grid-template-columns:1fr\}/);
  assert.match(html, /@media\(max-width:760px\)[\s\S]*?\.page-heading\{flex-direction:column/);
  assert.doesNotMatch(html, /(?:html|body|\.app)\{[^}]*min-width:\s*1024px/);
});
