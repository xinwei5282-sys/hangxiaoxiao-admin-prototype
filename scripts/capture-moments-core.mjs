import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((items, value, index, all) => {
  if (value.startsWith('--')) items.push([value.slice(2), all[index + 1]]);
  return items;
}, []));
const port = Number(args.port || 9228);
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const view = args.view || 'moments';
const views = {
  moments: { subview: 'material-moments', labels: ['新建朋友圈图文','图文内容','状态','预览','编辑','导出图文包'], exportAction: 'export-graphic', toast: '朋友圈图文包已导出' },
  poster: { subview: 'material-poster', labels: ['新建海报','海报内容','状态','预览','编辑','下载'], exportAction: 'export-poster', toast: '海报已下载' }
};
const config = views[view];
if (!config) throw new Error(`Unknown material view: ${view}`);
const outDir = resolve(args['out-dir'] || 'validation/material-core');
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

await send('Runtime.enable');
await send('Page.enable');
await send('Page.bringToFront');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 560 });
await send('Page.reload', { ignoreCache: true });
await new Promise(resolveWait => setTimeout(resolveWait, 900));
await evaluate(`new Promise((ready,reject)=>{let n=0;const timer=setInterval(()=>{if(document.readyState==='complete'&&typeof go==='function'&&typeof switchSubview==='function'){clearInterval(timer);ready(true);}else if(++n>80){clearInterval(timer);reject(new Error('prototype did not become ready'));}},100);})`);
consoleErrors.length = 0;
uncaughtErrors.length = 0;
await evaluate(`(() => {
  document.querySelector('#login').style.display='none';
  document.body.classList.remove('login-active');
  go('marketing-materials');
  const tab=document.querySelector('[data-subview="${config.subview}"]');
  switchSubview('${config.subview}',tab);
  window.scrollTo(0,0);
})()`);
await evaluate(`new Promise((ready,reject)=>{let n=0;const timer=setInterval(()=>{const page=document.querySelector('[data-p="marketing-materials"]'),panel=document.querySelector('[data-subview-panel="${config.subview}"]');if(page?.classList.contains('show')&&panel?.classList.contains('show')){clearInterval(timer);ready(true);}else if(++n>40){clearInterval(timer);reject(new Error('material view did not become visible'));}},100);})`);
const audit = await evaluate(`(() => {
  const page=document.querySelector('[data-p="marketing-materials"]');
  const panel=document.querySelector('[data-subview-panel="${config.subview}"]');
  const text=panel?.innerText||'';
  const before=JSON.stringify(enterpriseBrainEvolutionState);
  panel?.querySelector('[data-act="${config.exportAction}"]')?.click();
  const after=JSON.stringify(enterpriseBrainEvolutionState);
  return {
    viewport:{width:innerWidth,height:innerHeight},
    pageVisible:page?.classList.contains('show')||false,
    panelVisible:panel?.classList.contains('show')||false,
    focusedActive:page?.classList.contains('focused-material-active')||false,
    coreLabels:${JSON.stringify(config.labels)}.filter(label=>text.includes(label)),
    forbiddenLabels:['发布与结果回收','已发布','阅读/互动','新增咨询','有效线索','发布前确认'].filter(label=>text.includes(label)),
    extraBlocks:panel?.querySelectorAll('.workflow-ribbon,.workspace-summary,.workspace-aside').length||0,
    sharedLeadHidden:getComputedStyle(page.querySelector(':scope > .lead')).display==='none',
    sharedContractHidden:getComputedStyle(page.querySelector(':scope > .content-factory-contract')).display==='none',
    stateChangedAfterExport:after!==before,
    toast:document.querySelector('#toasts .toast:last-child')?.textContent||'',
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
    outside:[...panel.querySelectorAll('.card,table')].filter(node=>{const r=node.getBoundingClientRect();return r.left<-2||r.right>innerWidth+2;}).map(node=>node.className||node.tagName)
    ,cells:[...panel.querySelectorAll('td')].map(node=>{const r=node.getBoundingClientRect();return {text:node.innerText,display:getComputedStyle(node).display,width:r.width,height:r.height,left:r.left,top:r.top};})
  };
})()`);
await new Promise(resolveWait => setTimeout(resolveWait, 250));
const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const suffix = `${width}x${height}`;
writeFileSync(resolve(outDir, `${view}-core-${suffix}.png`), Buffer.from(image.data, 'base64'));
writeFileSync(resolve(outDir, `${view}-core-audit-${suffix}.json`), `${JSON.stringify({ ...audit, consoleErrors, uncaughtErrors }, null, 2)}\n`);
socket.close();

const expectedLabelCount = width <= 560 ? config.labels.length - 2 : config.labels.length;
const failed = !audit.pageVisible || !audit.panelVisible || !audit.focusedActive || audit.coreLabels.length !== expectedLabelCount || audit.forbiddenLabels.length || audit.extraBlocks || !audit.sharedLeadHidden || !audit.sharedContractHidden || audit.stateChangedAfterExport || audit.toast !== config.toast || audit.horizontalOverflow || audit.outside.length || consoleErrors.length || uncaughtErrors.length;
if (failed) {
  console.error(JSON.stringify({ ...audit, consoleErrors, uncaughtErrors }, null, 2));
  process.exitCode = 1;
} else console.log(`${view} core capture PASS: ${suffix}`);
