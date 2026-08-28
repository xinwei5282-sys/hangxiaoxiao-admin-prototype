import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((all, item, index, list) => {
  if (item.startsWith('--')) all.push([item.slice(2), list[index + 1]]);
  return all;
}, []));
const port = Number(args.port || 9229);
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const viewport = `${width}x${height}`;
const outDir = resolve(args['out-dir'] || 'validation/enterprise-brain-evolution');
mkdirSync(outDir, { recursive: true });

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.includes('127.0.0.1:8010')) || targets.find(item => item.type === 'page' && !item.url.startsWith('devtools://'));
if (!target) throw new Error('No browser page target found');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => {
  ws.addEventListener('open', resolveOpen, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const waiting = new Map();
const consoleErrors = [];
const runtimeErrors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    const pending = waiting.get(message.id);
    waiting.delete(message.id);
    return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map(item => item.value || item.description).join(' '));
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || 'runtime exception');
});
function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolvePromise, reject) => waiting.set(id, { resolve: resolvePromise, reject }));
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function screenshot(name) {
  await new Promise(resolveWait => setTimeout(resolveWait, 180));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(outDir, `${name}-${viewport}.png`), Buffer.from(shot.data, 'base64'));
}

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 560 });
await send('Page.navigate', { url: 'http://127.0.0.1:8010/index.html' });
await new Promise(resolveWait => setTimeout(resolveWait, 1200));
await evaluate(`(() => {
  localStorage.removeItem('aiHuokeEnterpriseBrainEvolutionV1');
  location.reload();
})()`);
await new Promise(resolveWait => setTimeout(resolveWait, 1200));
await evaluate(`(() => {
  document.querySelector('#login').style.display='none';
  document.body.classList.remove('login-active');
  document.querySelectorAll('.guide-overlay,.modal-mask').forEach(item=>item.classList.remove('show'));
  go('kb');
})()`);

const panels = ['diagnosis', 'cognition', 'content', 'intelligence', 'evolution'];
const pages = [];
for (const panel of panels) {
  await evaluate(`showKbTab(${JSON.stringify(panel)})`);
  const audit = await evaluate(`(() => {
    const page=document.querySelector('.page[data-p="kb"]');
    const direct=[...page.querySelectorAll(':scope > .kb-panel')];
    const primary=direct.filter(item=>['diagnosis','cognition','content','intelligence','evolution'].includes(item.dataset.kbpanel)&&item.classList.contains('show')).map(item=>item.dataset.kbpanel);
    return {panel:${JSON.stringify(panel)},primary,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyHeight:document.body.scrollHeight,emptyHosts:[...page.querySelectorAll('#enterpriseBrainDiagnosisHost,#enterpriseBrainCognitionHost')].filter(item=>!item.children.length).map(item=>item.id)};
  })()`);
  pages.push(audit);
  await screenshot(`brain-${panel}`);
}

const interaction = await evaluate(`(() => {
  const asset=recordGeneratedContent({title:'企业大脑验收图文',type:'朋友圈图文',source:'验收脚本',text:'产品服务套餐'});
  recordContentRevision(asset.id,'修改价格表达');
  renderGeneratedFormalKnowledge();
  const generatedRow=document.querySelector('[data-generated-knowledge="'+asset.id+'"]');
  const generatedBeforeDelete={formal:asset.formal,factAuthority:asset.factAuthority,group:asset.group,version:asset.version,rowVisible:Boolean(generatedRow),rowGroup:generatedRow?.dataset.group||''};
  const deleted=softDeleteContentAsset(asset.id,{reason:'事实错误',deletedBy:'验收员'});
  renderGeneratedFormalKnowledge();
  const generatedAfterDelete={formal:deleted.formal,rowVisible:Boolean(document.querySelector('[data-generated-knowledge="'+asset.id+'"]'))};
  const activeAsset=recordGeneratedContent({title:'新品服务推介',type:'公众号文章',source:'系统生成',text:'产品套餐与服务'});
  const intel=queueIntelligenceCandidate({type:'政策',title:'验收政策候选',url:'https://example.com/policy'});
  const before={formal:intel.formal,usable:intel.usableForFacts};
  confirmIntelligenceCandidate(intel.id,'验收员');
  renderGeneratedFormalKnowledge();renderEnterpriseBrainIntelligence();renderEnterpriseBrainEvolution();
  return {generatedBeforeDelete,generatedAfterDelete,activeKnowledge:{formal:activeAsset.formal,group:activeAsset.group,rowVisible:Boolean(document.querySelector('[data-generated-knowledge="'+activeAsset.id+'"]'))},deleted:{status:deleted.status,formal:deleted.formal,reusable:deleted.reusable,processCount:deleted.processCount,audit:deleted.audit.length},before,after:{formal:intel.formal,usable:intel.usableForFacts},learningCandidates:enterpriseBrainEvolutionState.learningCandidates.length};
})()`);
await evaluate(`showKbTab('content')`);
await evaluate(`document.querySelector('[data-generated-knowledge]')?.scrollIntoView({block:'center'})`);
await screenshot('brain-content-soft-deleted');
await evaluate(`showKbTab('intelligence')`);
await screenshot('brain-intelligence-confirmed');
await evaluate(`showKbTab('evolution')`);
await screenshot('brain-evolution-learning');

const audit = { viewport, pages, interaction, consoleErrors, runtimeErrors };
writeFileSync(resolve(outDir, `audit-${viewport}.json`), JSON.stringify(audit, null, 2));
if (pages.some(page => page.primary.length !== 1 || page.primary[0] !== page.panel || page.scrollWidth > page.clientWidth + 2 || page.emptyHosts.length)) throw new Error(`layout audit failed: ${JSON.stringify(pages)}`);
if (!interaction.generatedBeforeDelete.formal || interaction.generatedBeforeDelete.factAuthority || interaction.generatedBeforeDelete.group !== '产品与服务' || interaction.generatedBeforeDelete.version !== 2 || !interaction.generatedBeforeDelete.rowVisible || interaction.generatedBeforeDelete.rowGroup !== '产品与服务' || interaction.generatedAfterDelete.formal || interaction.generatedAfterDelete.rowVisible || !interaction.activeKnowledge.formal || interaction.activeKnowledge.group !== '产品与服务' || !interaction.activeKnowledge.rowVisible || interaction.deleted.status !== 'deleted' || interaction.deleted.formal || interaction.deleted.reusable || interaction.before.formal || !interaction.after.formal || interaction.learningCandidates < 1) throw new Error(`interaction audit failed: ${JSON.stringify(interaction)}`);
if (consoleErrors.length || runtimeErrors.length) throw new Error(`browser errors: ${JSON.stringify({ consoleErrors, runtimeErrors })}`);
console.log(JSON.stringify({ viewport, screenshots: panels.length + 3, interaction }, null, 2));
ws.close();
