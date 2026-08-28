import { resolve } from 'node:path';
import { assessPreviewHealth } from './lib/codex-workflow.mjs';
import {
  buildDirectPreviewUrl,
  openDirectBrowser,
} from './lib/managed-browser.mjs';
import { ensurePrototypeServer } from './lib/prototype-server.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const healthIndex = args.indexOf('--health-json');
if (healthIndex >= 0) {
  const health = assessPreviewHealth(JSON.parse(args[healthIndex + 1] || '{}'));
  process.stdout.write(`${JSON.stringify({ status: health.ok ? 'PASS' : 'FAIL', reason: health.reason })}\n`);
  process.exit(health.ok ? 0 : 1);
}

const routeIndex = args.indexOf('--route');
const route = routeIndex >= 0 ? String(args[routeIndex + 1] || 'home') : 'home';
try {
  const server = await ensurePrototypeServer(root);
  const directUrl = buildDirectPreviewUrl(server.url, route);
  openDirectBrowser(directUrl);
  process.stdout.write(`${JSON.stringify({ status: 'PASS', reason: 'served source verified and normal browser opened', url: directUrl, requestedRoute: route, browserMode: 'normal Chrome profile', isolatedBrowser: false, server: server.server, sha256: server.sha256, note: '已直接在日常 Chrome 中打开；未启动任何隔离浏览器' }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'FAIL', error: error.message, note: '服务或真源预检失败，未打开浏览器' }, null, 2)}\n`);
  process.exitCode = 1;
}
