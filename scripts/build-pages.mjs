import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '_site');
mkdirSync(resolve(output, 'scripts'), { recursive: true });
for (const file of ['index.html', 'mobile.html']) cpSync(resolve(root, file), resolve(output, file));
cpSync(resolve(root, 'assets'), resolve(output, 'assets'), { recursive: true, filter: source => !source.endsWith('/.DS_Store') });
for (const file of ['hangxiaoxiao-admin.js', 'hangxiaoxiao-knowledge-flows.js', 'hangxiaoxiao-service-flows.js', 'hangxiaoxiao-page-prd.js', 'hangxiaoxiao-brain-init.js']) {
  cpSync(resolve(root, 'scripts', file), resolve(output, 'scripts', file));
}
writeFileSync(resolve(output, '.nojekyll'), '');
console.log(`GitHub Pages artifact prepared: ${output}`);
