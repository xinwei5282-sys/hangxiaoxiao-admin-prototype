import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((items, item, index, list) => {
  if (item.startsWith('--')) items.push([item.slice(2), list[index + 1]]);
  return items;
}, []));
const port = Number(args.port || 9228);
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const viewport = `${width}x${height}`;
const outDir = resolve(args['out-dir'] || 'validation/enterprise-cognition-vi');
mkdirSync(outDir, { recursive: true });

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.includes('127.0.0.1:8010/index.html'));
if (!target) throw new Error('No prototype target found at http://127.0.0.1:8010/index.html');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });

let nextId = 0;
const waiting = new Map();
const consoleErrors = [];
const runtimeErrors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    const pending = waiting.get(message.id);
    waiting.delete(message.id);
    return message.error ? pending.fail(new Error(message.error.message)) : pending.ok(message.result);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map(item => item.value || item.description).join(' '));
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || 'runtime exception');
});
function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((ok, fail) => waiting.set(id, { ok, fail }));
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function screenshot(name) {
  await new Promise(ok => setTimeout(ok, 220));
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(outDir, `${name}-${viewport}.png`), Buffer.from(image.data, 'base64'));
}

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 560 });
await send('Page.navigate', { url: 'http://127.0.0.1:8010/index.html' });
await new Promise(ok => setTimeout(ok, 1200));
await evaluate(`(() => { localStorage.removeItem('aiHuokeEnterpriseViStateV1'); location.reload(); })()`);
await new Promise(ok => setTimeout(ok, 1200));
consoleErrors.length = 0;
runtimeErrors.length = 0;
await evaluate(`(() => {
  document.querySelector('#login').style.display='none';
  document.body.classList.remove('login-active');
  document.querySelectorAll('.guide-overlay,.modal-mask').forEach(item=>item.classList.remove('show'));
  go('kb');showKbTab('cognition');
  startEnterpriseViDirectionGeneration({brandTone:'专业、温暖',intakeCoreAdvantage:'值得信赖、清晰可执行',companyName:'蔚然企业',logoStatus:'existing'});
  completeEnterpriseViDirectionGeneration();renderEnterpriseCognitionVi();
})()`);
await screenshot('vi-directions-ready');

const draftGate = await evaluate(`(() => {
  const before=buildActiveEnterpriseViContext();
  selectEnterpriseViDirection('steady');generateEnterpriseViDraft();completeEnterpriseViDraftGeneration();renderEnterpriseCognitionVi();
  const after=buildActiveEnterpriseViContext();
  return {before,after,status:enterpriseViState.status,draftStatus:enterpriseViState.draft?.status,directionCards:document.querySelectorAll('.vi-direction-card').length,logoMode:enterpriseViState.draft?.logoProposal?.mode,logoWordmark:enterpriseViState.draft?.logoProposal?.wordmark,logoShowcases:document.querySelectorAll('.vi-logo-showcase').length};
})()`);
await evaluate(`(() => { go('kb');showKbTab('cognition');document.querySelector('#enterpriseViDraft')?.scrollIntoView({block:'start'});window.scrollBy(0,-90); })()`);
await screenshot('vi-draft-review');

const activation = await evaluate(`(() => {
  const id=enterpriseViState.draft.id;
  const active=activateEnterpriseViDraft(id,'验收员');renderEnterpriseCognitionVi();
  const poster=buildPosterGenerationContext();
  return {activeStatus:active?.status,version:active?.version,context:buildActiveEnterpriseViContext(),posterVi:poster.vi,source:poster.sources.at(-1)};
})()`);
await evaluate(`(() => { go('kb');showKbTab('cognition');document.querySelector('#enterpriseViDraft')?.scrollIntoView({block:'start'});window.scrollBy(0,-90); })()`);
await screenshot('vi-active');

const failure = await evaluate(`(() => {
  const activeBefore=getActiveEnterpriseVi();
  startEnterpriseViDirectionGeneration({brandTone:'更稳健'});failEnterpriseViGeneration('directions','演示：视觉生成服务暂时繁忙');renderEnterpriseCognitionVi();
  const activeAfter=getActiveEnterpriseVi();
  return {status:enterpriseViState.status,failedStage:enterpriseViState.failedStage,preserved:activeBefore?.id===activeAfter?.id,activeVersion:activeAfter?.version};
})()`);
await evaluate(`(() => { go('kb');showKbTab('cognition');document.querySelector('#enterpriseViDraft')?.scrollIntoView({block:'start'});window.scrollBy(0,-90); })()`);
await screenshot('vi-generation-failed');

const layout = await evaluate(`(() => {
  const page=document.querySelector('.page[data-p="kb"]');
  const primary=[...page.querySelectorAll(':scope > .kb-panel')].filter(panel=>['diagnosis','cognition','content','intelligence','evolution'].includes(panel.dataset.kbpanel)&&panel.classList.contains('show')).map(panel=>panel.dataset.kbpanel);
  const dataView=document.querySelector('#kbDataView');
  const actionHeights=[...document.querySelectorAll('[data-kbpanel="cognition"] button')].filter(button=>button.offsetParent).map(button=>Math.round(button.getBoundingClientRect().height));
  return {primary,dataViewDisplay:dataView?getComputedStyle(dataView).display:null,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,actionHeights,directionGridOverflow:document.querySelector('#enterpriseViDirections')?.scrollWidth>document.querySelector('#enterpriseViDirections')?.clientWidth+2};
})()`);

const audit = { viewport, draftGate, activation, failure, layout, consoleErrors, runtimeErrors };
writeFileSync(resolve(outDir, `audit-${viewport}.json`), JSON.stringify(audit, null, 2));
if (draftGate.before.status !== 'system_default' || draftGate.after.status !== 'system_default' || draftGate.status !== 'draft_review' || draftGate.draftStatus !== 'draft_review' || draftGate.directionCards !== 3 || draftGate.logoMode !== 'optimize_existing' || draftGate.logoWordmark !== '蔚然企业' || draftGate.logoShowcases !== 3) throw new Error(`draft gate failed: ${JSON.stringify(draftGate)}`);
if (activation.activeStatus !== 'active' || activation.version !== 1 || activation.context.status !== 'active' || activation.posterVi.status !== 'active' || activation.source !== 'enterprise_vi:v1') throw new Error(`activation failed: ${JSON.stringify(activation)}`);
if (failure.status !== 'generation_failed' || failure.failedStage !== 'directions' || !failure.preserved || failure.activeVersion !== 1) throw new Error(`failure preservation failed: ${JSON.stringify(failure)}`);
if (layout.primary.length !== 1 || layout.primary[0] !== 'cognition' || layout.dataViewDisplay !== 'none' || layout.scrollWidth > layout.clientWidth + 2) throw new Error(`layout failed: ${JSON.stringify(layout)}`);
if (width <= 560 && layout.actionHeights.some(value => value < 40)) throw new Error(`mobile action target too small: ${JSON.stringify(layout.actionHeights)}`);
if (consoleErrors.length || runtimeErrors.length) throw new Error(`browser errors: ${JSON.stringify({ consoleErrors, runtimeErrors })}`);
console.log(JSON.stringify(audit, null, 2));
ws.close();
