import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((items, value, index, all) => {
  if (value.startsWith('--')) items.push([value.slice(2), all[index + 1]]);
  return items;
}, []));
const port = Number(args.port || 9228);
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const outDir = resolve(args['out-dir'] || 'validation/wechat-publish-loop');
mkdirSync(outDir, { recursive: true });

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && /^http:\/\/127\.0\.0\.1:8010\/index\.html/.test(item.url));
if (!target) throw new Error('Prototype page not found at http://127.0.0.1:8010/index.html');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((open, reject) => {
  socket.addEventListener('open', open, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const waiting = new Map();
const consoleErrors = [];
const uncaughtErrors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    const pending = waiting.get(message.id);
    waiting.delete(message.id);
    return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map(item => item.value || item.description).join(' '));
  if (message.method === 'Runtime.exceptionThrown') uncaughtErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || 'Uncaught exception');
});
function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveRequest, rejectRequest) => waiting.set(id, { resolve: resolveRequest, reject: rejectRequest }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function screenshot(name) {
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(outDir, name), Buffer.from(image.data, 'base64'));
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.bringToFront');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 560 });
await send('Page.reload', { ignoreCache: true });
await new Promise(resolveWait => setTimeout(resolveWait, 900));
await evaluate(`new Promise((ready,reject)=>{let n=0;const timer=setInterval(()=>{if(typeof go==='function'&&typeof switchSubview==='function'){clearInterval(timer);ready(true);}else if(++n>40){clearInterval(timer);reject(new Error('prototype did not become ready'));}},100);})`);
consoleErrors.length = 0;
uncaughtErrors.length = 0;
await evaluate(`(() => {
  document.querySelector('#login').style.display='none';
  document.body.classList.remove('login-active');
  go('marketing-materials');
  switchSubview('material-wechat',document.querySelector('[data-subview="material-wechat"]'));
  window.scrollTo(0,0);
})()`);
await new Promise(resolveWait => setTimeout(resolveWait, 350));
const before = await evaluate(`(() => {
  const page=document.querySelector('[data-p="marketing-materials"]');
  const panel=document.querySelector('[data-subview-panel="material-wechat"]');
  const text=panel?.innerText||'';
  return {
    pageVisible:page?.classList.contains('show')||false,
    panelVisible:panel?.classList.contains('show')||false,
    focusedActive:page?.classList.contains('focused-material-active')||false,
    accountStatus:document.querySelector('#wechatAccountStatus')?.textContent.trim(),
    autoPublish:document.querySelector('#wechatAutoPublish')?.checked,
    publishAction:panel?.querySelector('[data-act="publish-wechat"]')?.textContent.trim(),
    coreLabels:['公众号文章','已绑定 2 个公众号','审核后自动发布','发布账号','文章数据','审核并发布'].filter(label=>text.includes(label)),
    accountCount:getPublishingAccounts('wechat').length,
    rowAccount:document.querySelector('#wechatList tr')?.dataset.wechatAccountName||'',
    metricsText:document.querySelector('#wechatList [data-wechat-metrics]')?.textContent.trim()||'',
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
    outside:[...panel.querySelectorAll('.card,.wechat-integration-bar,.wechat-result-panel')].filter(node=>{const r=node.getBoundingClientRect();return r.left<-2||r.right>innerWidth+2;}).map(node=>node.className)
  };
})()`);
await screenshot(`wechat-before-${width}x${height}.png`);

await evaluate(`document.querySelector('[data-subview-panel="material-wechat"] [data-act="publish-wechat"]')?.click()`);
await evaluate(`new Promise((ready,reject)=>{let n=0;const timer=setInterval(()=>{const row=document.querySelector('#wechatList tr');if(row?.dataset.wechatPublished==='true'&&row.dataset.wechatMetrics){clearInterval(timer);ready(true);}else if(++n>80){clearInterval(timer);reject(new Error('WeChat article did not reach synced state'));}},100);})`);
const afterPublish = await evaluate(`(() => {const row=document.querySelector('#wechatList tr'),metrics=JSON.parse(row?.dataset.wechatMetrics||'{}');return {
  publishStatus:row?.querySelector('[data-wechat-publish-status]')?.textContent.trim(),
  rowAction:row?.querySelector('[data-act="sync-wechat-article"]')?.textContent.trim(),
  metrics,
  published:row?.dataset.wechatPublished==='true',
  account:row?.dataset.wechatAccountName||'',
  toast:document.querySelector('#toasts .toast:last-child')?.textContent||''
}})()`);
await evaluate(`document.querySelector('#wechatList tr')?.scrollIntoView({block:'center'})`);
await new Promise(resolveWait => setTimeout(resolveWait, 3200));
await screenshot(`wechat-results-${width}x${height}.png`);

await evaluate(`document.querySelector('[data-act="sync-wechat-article"]')?.click()`);
await evaluate(`new Promise((ready,reject)=>{let n=0;const timer=setInterval(()=>{const row=document.querySelector('#wechatList tr'),metrics=JSON.parse(row?.dataset.wechatMetrics||'{}');if(metrics.reads===1314){clearInterval(timer);ready(true);}else if(++n>30){clearInterval(timer);reject(new Error('Manual WeChat article sync did not finish'));}},100);})`);
const afterManualSync = await evaluate(`(() => ({
  metrics:JSON.parse(document.querySelector('#wechatList tr')?.dataset.wechatMetrics||'{}'),
  toast:document.querySelector('#toasts .toast:last-child')?.textContent||'',
  horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2
}))()`);

const audit = { viewport: { width, height }, before, afterPublish, afterManualSync, consoleErrors, uncaughtErrors };
writeFileSync(resolve(outDir, `wechat-audit-${width}x${height}.json`), `${JSON.stringify(audit, null, 2)}\n`);
socket.close();

const failed = !before.pageVisible || !before.panelVisible || !before.focusedActive || before.accountStatus !== '已授权' || !before.autoPublish || before.publishAction !== '审核并发布' || before.coreLabels.length !== 6 || before.accountCount !== 2 || before.rowAccount !== '蔚然企业服务' || !before.metricsText.includes('发布后回收') || before.horizontalOverflow || before.outside.length || afterPublish.publishStatus !== '已发布' || afterPublish.rowAction !== '刷新数据' || JSON.stringify(afterPublish.metrics) !== JSON.stringify({reads:1286,shares:46,likes:83,follows:17}) || !afterPublish.published || afterPublish.account !== '蔚然企业服务' || !afterPublish.toast.includes('首次数据已回收') || JSON.stringify(afterManualSync.metrics) !== JSON.stringify({reads:1314,shares:48,likes:86,follows:18}) || !afterManualSync.toast.includes('本篇文章数据已刷新') || afterManualSync.horizontalOverflow || consoleErrors.length || uncaughtErrors.length;
if (failed) {
  console.error(JSON.stringify(audit, null, 2));
  process.exitCode = 1;
} else console.log(`WeChat publish loop PASS: ${width}x${height}`);
