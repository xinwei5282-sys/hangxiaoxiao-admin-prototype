import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((items, value, index, all) => {
  if (value.startsWith('--')) items.push([value.slice(2), all[index + 1]]);
  return items;
}, []));
const port = Number(args.port || 9228);
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const outDir = resolve(args['out-dir'] || 'validation/knowledge-overview');
mkdirSync(outDir, { recursive: true });

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && /^http:\/\/127\.0\.0\.1:8010\/index\.html/.test(item.url));
if (!target) throw new Error('Prototype page not found at http://127.0.0.1:8010/index.html');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', rejectOpen, { once: true });
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
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 560 });
await evaluate(`(() => {
  ['aiHuokeEnterpriseIntakeDraftV1','aiHuokeEnterpriseIntakeDraftV2','aiHuokeQuickProfileCompletedV1','aiHuokeKnowledgeEvidenceTasksV1','aiHuokeKnowledgeCandidatesV1'].forEach(key=>localStorage.removeItem(key));
})()`);
await send('Page.reload', { ignoreCache: true });
await new Promise(resolveWait => setTimeout(resolveWait, 900));
await evaluate(`new Promise((resolveReady,rejectReady)=>{let attempts=0;const timer=setInterval(()=>{if(typeof go==='function'&&typeof renderEnterpriseKnowledgeOverview==='function'){clearInterval(timer);resolveReady(true);}else if(++attempts>40){clearInterval(timer);rejectReady(new Error('prototype did not become ready'));}},100);})`);
await evaluate(`(() => {
  const set=(selector,value)=>{const control=document.querySelector(selector);if(!control)return;control.value=value;control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));};
  set('#licenseCompanyName','杭州示例科技有限公司');
  set('#intakeIndustry','enterprise-service');
  set('#intakeBusinessStage','growth');
  set('#intakeMainBusiness','为成长型企业提供经营诊断与数字化获客服务');
  set('#intakeCustomerPain','线索转化效率偏低');
  set('#intakeGoalResult','未来 3 个月提高有效商机转化率');
  const source=document.querySelector('input[name="intakeAcquisitionSources"][value="platform"]');if(source){source.checked=true;source.dispatchEvent(new Event('change',{bubbles:true}));}
  saveEnterpriseIntakeDraft();
  localStorage.setItem('aiHuokeQuickProfileCompletedV1','1');
  knowledgeOverviewStore.saveCandidates([{id:'candidate-intakeCustomerPain',targetId:'intakeCustomerPain',value:'获客渠道不稳定',source:'客户经营复盘.docx',officialValue:'线索转化效率偏低',status:'conflict',updatedAt:new Date().toISOString()}]);
  knowledgeOverviewStore.saveTasks([
    {id:'task-parsing',name:'产品手册.pdf',kind:'业务、产品与客户资料',state:'parsing',detail:'正在提取产品与客户候选',candidateCount:0,updatedAt:new Date().toISOString()},
    {id:'task-review',name:'客户经营复盘.docx',kind:'获客与经营资料',state:'review',detail:'已生成 1 条待确认候选',candidateCount:1,updatedAt:new Date().toISOString()},
    {id:'task-auth',name:'企业公众号',kind:'公众号账号 / 历史内容',state:'authorization',detail:'等待授权采集范围',candidateCount:0,updatedAt:new Date().toISOString()}
  ]);
})()`);
await send('Page.reload', { ignoreCache: true });
await new Promise(resolveWait => setTimeout(resolveWait, 900));
consoleErrors.length = 0;
uncaughtErrors.length = 0;
await evaluate(`(() => {document.querySelector('#login').style.display='none';document.body.classList.remove('login-active');go('kb');showKbTab('overview');window.scrollTo(0,0);})()`);
await new Promise(resolveWait => setTimeout(resolveWait, 350));
const audit = await evaluate(`(() => {
  const visible=document.querySelector('[data-kbpanel="overview"].show');
  const cards=[...document.querySelectorAll('#knowledgeOverviewCards .knowledge-overview-card')];
  return {
    viewport:{width:innerWidth,height:innerHeight},
    visible:Boolean(visible),
    cardCount:cards.length,
    cardTitles:cards.map(card=>card.querySelector('h3')?.textContent||''),
    conflictVisible:visible?.textContent.includes('有冲突')||false,
    confirmedVisible:visible?.textContent.includes('已确认')||false,
    taskMetrics:document.querySelector('#knowledgeEvidenceSummary')?.textContent||'',
    governanceBoundary:document.querySelector('#knowledgeGovernanceSummary')?.textContent||'',
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
    outside:[...document.querySelectorAll('[data-kbpanel="overview"].show .card')].filter(node=>{const rect=node.getBoundingClientRect();return rect.left<-2||rect.right>innerWidth+2;}).map(node=>node.id||node.className),
    fixedMetricsVisible:['78%','1,248','94%'].filter(value=>visible?.textContent.includes(value))
  };
})()`);
const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const suffix = `${width}x${height}`;
writeFileSync(resolve(outDir, `knowledge-overview-${suffix}.png`), Buffer.from(image.data, 'base64'));
await evaluate(`document.querySelector('#knowledgeEvidenceSummary')?.scrollIntoView({block:'start'})`);
await new Promise(resolveWait => setTimeout(resolveWait, 250));
const evidenceImage = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(resolve(outDir, `knowledge-overview-evidence-${suffix}.png`), Buffer.from(evidenceImage.data, 'base64'));
audit.interactions = await evaluate(`(() => {
  const business=document.querySelector('[data-overview-section="business"]');
  business?.querySelector('[data-act="toggle-knowledge-overview-card"]')?.click();
  const expanded=document.querySelector('[data-overview-section="business"]')?.classList.contains('expanded')||false;
  const expandedFields=document.querySelectorAll('[data-overview-section="business"] .knowledge-overview-field').length;
  document.querySelector('[data-overview-section="business"] [data-act="supplement-enterprise-overview"]')?.click();
  const supplementStep=document.querySelector('[data-intake-step]:not([hidden])')?.dataset.intakeStep||'';
  const supplementOpen=document.querySelector('#newUserGuideModal')?.classList.contains('show')||false;
  document.querySelector('#newUserGuideModal')?.classList.remove('show');
  document.querySelector('#knowledgeEvidenceSummary [data-act="review-enterprise-candidates"]')?.click();
  const reviewOpen=document.querySelector('[data-kbpanel="review"]')?.classList.contains('show')||false;
  showKbTab('overview');
  return {expanded,expandedFields,supplementOpen,supplementStep,reviewOpen};
})()`);
writeFileSync(resolve(outDir, `knowledge-overview-audit-${suffix}.json`), `${JSON.stringify({ ...audit, consoleErrors, uncaughtErrors }, null, 2)}\n`);
socket.close();

const failed = !audit.visible || audit.cardCount !== 4 || !audit.conflictVisible || !audit.confirmedVisible || audit.horizontalOverflow || audit.outside.length || audit.fixedMetricsVisible.length || !audit.interactions.expanded || audit.interactions.expandedFields <= 4 || !audit.interactions.supplementOpen || audit.interactions.supplementStep !== '2' || !audit.interactions.reviewOpen || consoleErrors.length || uncaughtErrors.length;
if (failed) {
  console.error(JSON.stringify({ ...audit, consoleErrors, uncaughtErrors }, null, 2));
  process.exitCode = 1;
} else console.log(`Knowledge overview capture PASS: ${suffix}`);
