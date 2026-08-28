import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((all, item, index, list) => {
  if (item.startsWith('--')) all.push([item.slice(2), list[index + 1]]);
  return all;
}, []));
const port = Number(args.port || 9228);
const outDir = resolve(args['out-dir'] || 'validation/v1-prototype');
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const viewportName = `${width}x${height}`;
mkdirSync(outDir, { recursive: true });

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
const target = targets.find(item => item.type === 'page' && /^http:\/\/127\.0\.0\.1:8010\/index\.html/.test(item.url));
if (!target) throw new Error('No AI acquisition prototype page found at http://127.0.0.1:8010/index.html');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
function failCapture(error) {
  console.error(error?.stack || error);
  ws.close();
  process.exit(1);
}
process.on('uncaughtException', failCapture);
process.on('unhandledRejection', failCapture);
let nextId = 0;
const waiting = new Map();
const consoleErrors = [];
const uncaughtErrors = [];
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.id && waiting.has(msg.id)) {
    const { ok, fail } = waiting.get(msg.id); waiting.delete(msg.id);
    return msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(msg.params.args.map(arg => arg.value || arg.description).join(' '));
  if (msg.method === 'Runtime.exceptionThrown') {
    const details = msg.params.exceptionDetails || {};
    uncaughtErrors.push(details.exception?.description || `${details.text || 'Uncaught exception'} at ${details.url || 'unknown'}:${details.lineNumber || 0}:${details.columnNumber || 0}`);
  }
});
function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((ok, fail) => waiting.set(id, { ok, fail }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Evaluation failed');
  return result.result.value;
}
async function screenshot(name) {
  await new Promise(ok => setTimeout(ok, 320));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(outDir, `${name}-${viewportName}.png`), Buffer.from(shot.data, 'base64'));
  screenshotCount += 1;
}
let screenshotCount = 0;
async function showPage(page, subview, kbTab) {
  await evaluate(`(() => { const login=document.querySelector('#login');if(login)login.style.display='none';go(${JSON.stringify(page)});${kbTab ? `showKbTab(${JSON.stringify(kbTab)});` : subview ? `switchSubview(${JSON.stringify(subview)},document.querySelector('[data-subview="${subview}"]'));` : ''} window.scrollTo(0,0); })()`);
}

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 560 });
await evaluate(`localStorage.removeItem('aiHuokeEnterpriseIntakeDraftV1');localStorage.removeItem('aiHuokeEnterpriseIntakeDraftV2');localStorage.removeItem('aiHuokeEnterpriseDiagnosisV1');localStorage.removeItem('aiHuokeDeepDiagnosisReminderDateV1')`);
await send('Page.reload', { ignoreCache: true });
await new Promise(ok => setTimeout(ok, 1200));
await evaluate(`new Promise((resolve,reject)=>{let attempts=0;const timer=setInterval(()=>{if(document.body&&typeof go==='function'){clearInterval(timer);resolve(true);}else if(++attempts>40){clearInterval(timer);reject(new Error('prototype page did not finish loading'));}},100);})`);
consoleErrors.length = 0;
uncaughtErrors.length = 0;
await evaluate(`(() => { const login=document.querySelector('#login');if(login)login.style.display='none';document.body.dataset.customer='general';go('home'); })()`);

const secondaryNavigationAudit = await evaluate(`(() => {
  const read=(route,panelSelector)=>{const page=document.querySelector('.page[data-p="'+route+'"]');return {topTitle:document.querySelector('#ptitle')?.textContent.trim()||'',contentTitle:page?.querySelector(':scope > .lead .t')?.textContent.trim()||'',activePanel:page?.querySelector(panelSelector)?.dataset.kbpanel||page?.querySelector(panelSelector)?.dataset.subviewPanel||''};};
  document.querySelector('[data-nav-sub="kb"] [data-kbtab="diagnosis"]')?.click();
  const diagnosis=read('kb',':scope > .kb-panel.show');
  document.querySelector('[data-nav-sub="settings"] [data-subview="setting-company"]')?.click();
  const enterpriseSettings=read('settings',':scope > .subview.show');
  return {diagnosis,enterpriseSettings};
})()`);

const captures = [
  ['home', 'home'],
  ['enterprise-brain-diagnosis', 'kb', null, 'diagnosis'],
  ['enterprise-brain-vi', 'kb', null, 'cognition'],
  ['brand-planning', 'brand-planning', 'brand-report'],
  ['marketing-materials-wechat', 'marketing-materials', 'material-wechat'],
  ['acquisition', 'acquisition'],
  ['settings', 'settings', 'setting-company'],
  ['settings-agent-center', 'agent-center']
];
const pages = [];
for (const [name, page, subview, kbTab] of captures) {
  await showPage(page, subview, kbTab);
  const layout = await evaluate(`(() => { const visible=[...document.querySelectorAll('.page.show')]; return {name:${JSON.stringify(name)},visiblePages:visible.map(x=>x.dataset.p),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,outside:[...document.querySelectorAll('.page.show .card')].filter(x=>{const r=x.getBoundingClientRect();return r.right>innerWidth+2||r.left<-2}).map(x=>x.className).slice(0,10)} })()`);
  pages.push(layout);
  await screenshot(name);
}
await evaluate(`(() => { document.body.dataset.customer='geyou';document.querySelector('#customerName').textContent='格优大客户模式';document.querySelectorAll('[data-customer-mode]').forEach(x=>x.textContent='格优大客户模式');document.querySelectorAll('[data-customer-desc]').forEach(x=>x.textContent='启用殡葬行业配置包、客户专属知识域与 90 天试点模板。');document.querySelectorAll('.geyou-only').forEach(x=>x.style.display='inline-flex');go('kb');showKbTab('diagnosis'); })()`);
await screenshot('geyou-mode');
await evaluate(`document.body.dataset.customer='general';document.querySelector('#customerName').textContent='通用企业';document.querySelectorAll('.geyou-only').forEach(x=>x.style.display='none')`);

await evaluate(`(() => { localStorage.removeItem('aiHuokeQuickProfileCompletedV1');localStorage.removeItem('aiHuokeDeepDiagnosisGeneratedV1');localStorage.removeItem('aiHuokeEnterpriseIntakeDraftV1');localStorage.removeItem('aiHuokeEnterpriseIntakeDraftV2');localStorage.removeItem('aiHuokeEnterpriseDiagnosisV1');localStorage.removeItem('aiHuokeDeepDiagnosisReminderDateV1');deepDiagnosisReminderShownInSession=false;enterpriseDiagnosisState={...defaultEnterpriseDiagnosisState};brainState={...defaultBrainState};saveBrainState();const login=document.querySelector('#login');if(login){login.style.display='grid';document.body.classList.add('login-active');}document.querySelector('[data-act="do-login"]').click(); })()`);
await new Promise(ok => setTimeout(ok, 2600));
const initialIntakeLayout = await evaluate(`(() => { const zone=document.querySelector('.onboarding-license-zone')?.getBoundingClientRect();const card=document.querySelector('.new-user-guide-card')?.getBoundingClientRect();return {zoneHeight:zone?.height||0,zoneWidth:zone?.width||0,cardTop:card?.top??-1,cardWidth:card?.width||0}; })()`);
const initialFieldState = await evaluate(`(() => {
  const result=document.querySelector('#onboardingLicenseResult');
  const fields=[...document.querySelectorAll('#onboardingLicenseResult input,#onboardingLicenseResult textarea')];
  const company=document.querySelector('#licenseCompanyName');
  company.value='手动填写测试企业';
  company.dispatchEvent(new Event('input',{bubbles:true}));
  return {visible:result ? !result.hidden && getComputedStyle(result).display!=='none' : false,fieldCount:fields.length,editable:fields.every(field=>!field.disabled&&!field.readOnly),manualValue:company.value};
})()`);
await screenshot('new-user-login-guide');
const emptyFlow = await evaluate(`(() => {
  document.querySelectorAll('[data-intake-step] input,[data-intake-step] textarea,[data-intake-step] select').forEach(field=>{if(field.type==='checkbox'||field.type==='radio')field.checked=false;else if(field.type!=='file')field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});
  for(let i=0;i<3;i++)document.querySelector('[data-act="skip-enterprise-intake"]').click();
  const stepFourVisible=!document.querySelector('#enterpriseIntakeGoals').hidden;
  const confirmEnabled=!document.querySelector('#confirmModalProfileBtn').disabled;
  document.querySelector('[data-act="confirm-modal-profile"]').click();
  const result={stepFourVisible,confirmEnabled,page:document.querySelector('.page.show')?.dataset.p,stored:localStorage.getItem('aiHuokeQuickProfileCompletedV1'),profileState:brainState.profile,status:document.querySelector('#diagnosisStageBadge')?.textContent||''};
  localStorage.removeItem('aiHuokeQuickProfileCompletedV1');
  localStorage.removeItem('aiHuokeDeepDiagnosisGeneratedV1');
  brainState={...defaultBrainState};saveBrainState();
  const login=document.querySelector('#login');if(login){login.style.display='grid';document.body.classList.add('login-active');}
  document.querySelector('[data-act="do-login"]').click();
  return result;
})()`);
await new Promise(ok => setTimeout(ok, 2600));
await evaluate(`(() => {
  const company=document.querySelector('#licenseCompanyName');company.value='上传前手工企业';company.dispatchEvent(new Event('input',{bubbles:true}));
  const input=document.querySelector('#onboardingLicenseFile');
  const transfer=new DataTransfer();
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  transfer.items.add(new File([bytes], '营业执照.png', {type:'image/png'}));
  input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
})()`);
await new Promise(ok => setTimeout(ok, 850));
const licenseManualPreserved = await evaluate(`document.querySelector('#licenseCompanyName')?.value==='上传前手工企业'`);
await evaluate(`(() => { const company=document.querySelector('#licenseCompanyName');company.value='识别后手动修改有限公司';company.dispatchEvent(new Event('input',{bubbles:true})); })()`);
await screenshot('new-user-license-recognized');
await evaluate(`(() => {
  document.querySelector('[data-act="next-enterprise-intake"]').click();
  const business=document.querySelector('#intakeMainBusiness');business.value='为成长型企业提供经营诊断与数字化服务';business.dispatchEvent(new Event('input',{bubbles:true}));
})()`);
await screenshot('new-user-business-step');
const businessModeAudit = await evaluate(`(() => {
  const modes=[...document.querySelectorAll('input[name="intakeBusinessModes"]')];
  const setMode=(value,checked)=>{const input=modes.find(item=>item.value===value);input.checked=checked;input.dispatchEvent(new Event('change',{bubbles:true}));};
  setMode('online-retail',true);setMode('offline-store',true);
  const setValue=(selector,value)=>{const input=document.querySelector(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
  setValue('#intakeOnlinePriceMin','39');setValue('#intakeOnlinePriceMax','199');setValue('#intakeOnlineAverageOrder','89');
  setValue('#intakeOfflinePriceMin','20');setValue('#intakeOfflinePriceMax','300');setValue('#intakeOfflineAverageOrder','110');
  [...document.querySelectorAll('input[name="intakeOnlineScenes"]')].slice(0,2).forEach(input=>{input.checked=true;input.dispatchEvent(new Event('input',{bubbles:true}));});
  [...document.querySelectorAll('input[name="intakeOfflineScenes"]')].slice(0,2).forEach(input=>{input.checked=true;input.dispatchEvent(new Event('input',{bubbles:true}));});
  const online=document.querySelector('[data-business-mode-section="online-retail"]'),offline=document.querySelector('[data-business-mode-section="offline-store"]');
  const onlineVisible=!online.hidden,offlineVisible=!offline.hidden;
  setMode('offline-store',false);const offlineHidden=offline.hidden;
  setMode('offline-store',true);const offlineValueRestored=document.querySelector('#intakeOfflineAverageOrder').value==='110';
  const card=document.querySelector('#newUserGuideModal .new-user-guide-card');if(card&&online)card.scrollTop+=online.getBoundingClientRect().top-card.getBoundingClientRect().top-150;
  return {businessModeCount:modes.length,onlineVisible,offlineVisible,offlineHidden,offlineValueRestored,selectedModes:[...selectedBusinessModes()],onlineSceneCount:document.querySelectorAll('input[name="intakeOnlineScenes"]:checked').length,offlineSceneCount:document.querySelectorAll('input[name="intakeOfflineScenes"]:checked').length};
})()`);
await screenshot('new-user-business-mixed-modes');
await evaluate(`(() => {
  const material=document.querySelector('#onboardingMaterialFile');
  const transfer=new DataTransfer();
  transfer.items.add(new File(['prototype-company'], '公司介绍.docx', {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
  transfer.items.add(new File(['prototype-product'], '产品手册.pdf', {type:'application/pdf'}));
  material.files=transfer.files;
  material.dispatchEvent(new Event('change',{bubbles:true}));
})()`);
await new Promise(ok => setTimeout(ok, 1400));
await evaluate(`(() => { const card=document.querySelector('#newUserGuideModal .new-user-guide-card'),candidate=document.querySelector('[data-candidate-target="intakeCustomerPain"]');if(card&&candidate)card.scrollTop+=candidate.getBoundingClientRect().top-card.getBoundingClientRect().top-card.clientHeight/2; })()`);
await screenshot('new-user-business-candidate');
await evaluate(`document.querySelector('[data-act="adopt-enterprise-intake-candidate"]')?.click()`);
await evaluate(`document.querySelector('[data-act="next-enterprise-intake"]').click()`);
await screenshot('new-user-operations-step');
const acquisitionAudit = await evaluate(`(() => {
  const change=(input,checked=true)=>{input.checked=checked;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
  const pick=(name,value)=>{const input=document.querySelector('input[name="'+name+'"][value="'+value+'"]');change(input);return input;};
  pick('intakeAcquisitionSources','platform');pick('intakeAcquisitionSources','referral');
  const uncertain=pick('intakeAcquisitionSources','uncertain');
  const uncertainClearsConcrete=document.querySelectorAll('input[name="intakeAcquisitionSources"]:checked').length===1&&uncertain.checked;
  const platform=pick('intakeAcquisitionSources','platform');
  const concreteClearsUncertain=platform.checked&&!uncertain.checked;
  pick('intakeAcquisitionSources','referral');pick('intakeBusinessStability','volatile');pick('intakeLeadOwner','service');pick('intakeImprovementPriority','conversion');
  pick('intakeOnlineTrafficState','volatile');pick('intakeOnlineOrderState','promotion');pick('intakeOnlineRepeatState','sometimes');
  pick('intakeOfflineArrivalSources','walkby');pick('intakeOfflineArrivalSources','referral');pick('intakeOfflineTrafficState','peak');pick('intakeOfflineMemberState','personal');
  const setValue=(selector,value)=>{const input=document.querySelector(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
  document.querySelector('#intakeOnlineMetrics').open=true;document.querySelector('#intakeOfflineMetrics').open=true;
  setValue('#intakeOnlineMonthlyVisitors','3000');setValue('#intakeOfflineMonthlyVisits','800');
  const visibleModes=[...document.querySelectorAll('[data-acquisition-mode-section]')].filter(section=>!section.hidden).map(section=>section.dataset.acquisitionModeSection);
  const hiddenModeCount=[...document.querySelectorAll('[data-acquisition-mode-section]')].filter(section=>section.hidden).length;
  const offlineMode=document.querySelector('input[name="intakeBusinessModes"][value="offline-store"]'),offlineSection=document.querySelector('[data-acquisition-mode-section="offline-store"]');
  change(offlineMode,false);const offlineHidden=offlineSection.hidden;change(offlineMode,true);
  const offlineValueRestored=document.querySelector('#intakeOfflineMonthlyVisits').value==='800'&&document.querySelector('input[name="intakeOfflineTrafficState"][value="peak"]').checked;
  const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';
  const online=document.querySelector('[data-acquisition-mode-section="online-retail"]'),card=document.querySelector('#newUserGuideModal .new-user-guide-card');if(card&&online)card.scrollTop+=online.getBoundingClientRect().top-card.getBoundingClientRect().top-150;
  return {visibleModes,hiddenModeCount,uncertainClearsConcrete,concreteClearsUncertain,offlineHidden,offlineValueRestored,onlineMetric:document.querySelector('#intakeOnlineMonthlyVisitors').value,offlineMetric:document.querySelector('#intakeOfflineMonthlyVisits').value,improvement:document.querySelector('input[name="intakeImprovementPriority"]:checked')?.value||'',summaryTags:document.querySelectorAll('#acquisitionModeSummary .bdg').length};
})()`);
await screenshot('new-user-acquisition-dynamic-modes');
await evaluate(`(() => {
  document.querySelector('#onboardingSourceType').value='wechat-account';
  document.querySelector('#onboardingSourceUrl').value='https://mp.weixin.qq.com/s/example';
  document.querySelector('[data-act="add-onboarding-source"]').click();
})()`);
await new Promise(ok => setTimeout(ok, 2700));
await evaluate(`document.querySelector('#onboardingAsyncTasks')?.scrollIntoView({block:'center'})`);
await screenshot('new-user-async-sources');
await evaluate(`document.querySelector('[data-act="next-enterprise-intake"]').click()`);
const goalsStepImmediateScrollTop = await evaluate(`document.querySelector('#newUserGuideModal .new-user-guide-card')?.scrollTop||0`);
const goalsStepViewport = await evaluate(`(() => { const card=document.querySelector('#newUserGuideModal .new-user-guide-card')?.getBoundingClientRect();return {windowScrollY:window.scrollY,cardTop:card?.top??-1}; })()`);
const goalsResourcesBrandInteraction = await evaluate(`(() => {
  const change=(input,checked=true)=>{input.checked=checked;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
  const setValue=(selector,value)=>{const input=document.querySelector(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
  const recommended=document.querySelector('input[name="intakeGoalDirection"][value="conversion"]')?.closest('label')?.classList.contains('recommended')||false;
  const recommendationDidNotConfirm=!document.querySelector('input[name="intakeGoalDirection"]:checked');
  const trust=document.querySelector('input[name="intakeGoalDirection"][value="trust"]');change(trust);syncGoalRecommendation();
  const manualGoalPreserved=trust.checked&&document.querySelector('#intakeGoalRecommendation').hidden;
  change(document.querySelector('input[name="intakeGoalHorizon"][value="3-months"]'));
  setValue('#intakeGoalResult','未来 3 个月将门店成交率提升 20%');
  setValue('#intakeBudgetPeriod','monthly');setValue('#intakeBudgetMonthlyRange','5000-10000');
  setValue('#intakeBudgetPeriod','annual');setValue('#intakeBudgetAnnualRange','50000-100000');
  setValue('#intakeBudgetPeriod','monthly');
  const monthlyBudgetPreserved=document.querySelector('#intakeBudgetMonthlyRange').value==='5000-10000'&&!document.querySelector('#intakeBudgetMonthlyRange').hidden&&document.querySelector('#intakeBudgetAnnualRange').hidden;
  setValue('#intakeExecutionOwner','founder');setValue('#intakeWeeklyTime','5-10');setValue('#intakeExecutionTeamSize','2-3');
  const sales=document.querySelector('input[name="intakeCapabilities"][value="sales"]'),service=document.querySelector('input[name="intakeCapabilities"][value="service"]'),none=document.querySelector('input[name="intakeCapabilities"][value="none"]');
  change(sales);change(service);change(none);const noneClearsCapabilities=none.checked&&document.querySelectorAll('input[name="intakeCapabilities"]:checked').length===1;change(sales);const concreteClearsNone=sales.checked&&!none.checked;
  setValue('#intakeExecutionConstraint','负责人时间有限，需要先跑小规模验证');
  const details=document.querySelector('#enterpriseIntakeBrandDetails');details.open=true;
  setValue('#intakeLogoStatus','existing');setValue('#intakeForbiddenClaims','禁止使用绝对化表达和保证效果');
  const professional=document.querySelector('input[name="intakeBrandTone"][value="professional"]'),friendly=document.querySelector('input[name="intakeBrandTone"][value="friendly"]'),direct=document.querySelector('input[name="intakeBrandTone"][value="direct"]'),uncertainTone=document.querySelector('input[name="intakeBrandTone"][value="uncertain"]');
  change(professional);change(friendly);change(direct);const toneLimitPreservesFirstTwo=professional.checked&&friendly.checked&&!direct.checked&&document.querySelectorAll('input[name="intakeBrandTone"]:checked').length===2;
  change(uncertainTone);const uncertainClearsTones=uncertainTone.checked&&document.querySelectorAll('input[name="intakeBrandTone"]:checked').length===1;change(professional);change(friendly);
  details.open=false;const collapsedBrandPreserved=document.querySelector('#intakeLogoStatus').value==='existing'&&document.querySelector('#intakeForbiddenClaims').value.includes('保证效果');details.open=true;const reopenedBrandPreserved=document.querySelector('#intakeLogoStatus').value==='existing'&&document.querySelectorAll('input[name="intakeBrandTone"]:checked').length===2;details.open=false;
  const beforeTasks=document.querySelectorAll('#onboardingAsyncTasks .onboarding-task-row').length,brandFile=document.querySelector('#onboardingBrandFile'),transfer=new DataTransfer();transfer.items.add(new File(['brand-logo'],'品牌Logo.png',{type:'image/png'}));transfer.items.add(new File(['brand-guide'],'品牌手册.pdf',{type:'application/pdf'}));brandFile.files=transfer.files;brandFile.dispatchEvent(new Event('change',{bubbles:true}));
  const brandTasksAdded=document.querySelectorAll('#onboardingAsyncTasks .onboarding-task-row').length-beforeTasks;
  const asyncDoesNotBlock=brandTasksAdded===2&&!document.querySelector('#confirmModalProfileBtn').disabled;
  const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';
  const shell=document.querySelector('#newUserGuideModal .new-user-guide-card');if(shell)shell.scrollTop=0;
  return {recommended,recommendationDidNotConfirm,manualGoalPreserved,monthlyBudgetPreserved,noneClearsCapabilities,concreteClearsNone,toneLimitPreservesFirstTwo,uncertainClearsTones,collapsedBrandPreserved,reopenedBrandPreserved,brandTasksAdded,asyncDoesNotBlock,goal:trust.checked?'trust':'',budgetPeriod:document.querySelector('#intakeBudgetPeriod').value,modalOverflow:shell?shell.scrollWidth>shell.clientWidth+2:false};
})()`);
await screenshot('new-user-goals-step');
await evaluate(`document.querySelector('.goal-resource-card.resources')?.scrollIntoView({block:'start'});document.querySelector('#toasts').innerHTML=''`);
await screenshot('new-user-goals-resources');
await evaluate(`(() => { const details=document.querySelector('#enterpriseIntakeBrandDetails');details.open=true;details.scrollIntoView({block:'start'});const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML=''; })()`);
await screenshot('new-user-goals-brand');
await evaluate(`document.querySelector('#enterpriseIntakeBrandDetails').open=false`);

const goalsResourcesBrandPersistence = await evaluate(`(() => {
  const clearStepFour=()=>{document.querySelectorAll('#enterpriseIntakeGoals input,#enterpriseIntakeGoals select,#enterpriseIntakeGoals textarea').forEach(control=>{if(control.type==='file')return;if(control.type==='checkbox'||control.type==='radio')control.checked=false;else control.value='';});document.querySelector('#enterpriseIntakeBrandDetails').open=false;};
  saveEnterpriseIntakeDraft();clearStepFour();const restored=restoreEnterpriseIntakeDraft();
  const v2Restored=restored&&document.querySelector('input[name="intakeGoalDirection"][value="trust"]').checked&&document.querySelector('#intakeBudgetPeriod').value==='monthly'&&document.querySelector('#intakeBudgetMonthlyRange').value==='5000-10000'&&document.querySelector('#intakeExecutionOwner').value==='founder'&&document.querySelector('#intakeLogoStatus').value==='existing'&&document.querySelector('#intakeForbiddenClaims').value.includes('保证效果');
  clearStepFour();localStorage.removeItem('aiHuokeEnterpriseIntakeDraftV2');localStorage.setItem('aiHuokeEnterpriseIntakeDraftV1',JSON.stringify({annualGoal:'旧年度成交目标',marketingBudget:'1–5 万',teamSize:'2–3 人小组',mainConstraint:'旧执行约束',primaryColor:'蓝色',visualStyle:'专业商务',imageStyle:'真实纪实',brandTone:'专业直接',forbiddenClaims:'旧禁用承诺'}));enterpriseIntakeMigratedState=null;
  const migrated=restoreEnterpriseIntakeDraft();
  const migrationKeepsGoalUnconfirmed=migrated&&document.querySelector('#intakeGoalResult').value==='旧年度成交目标'&&!document.querySelector('input[name="intakeGoalDirection"]:checked')&&!document.querySelector('input[name="intakeGoalHorizon"]:checked');
  const migrationKeepsBudgetPending=document.querySelector('#intakeBudgetPeriod').value===''&&!document.querySelector('#intakeLegacyCandidates').hidden&&document.querySelector('#intakeLegacyCandidates').textContent.includes('1–5 万');
  const migrationKeepsTeamPending=document.querySelector('#intakeExecutionTeamSize').value===''&&document.querySelector('#intakeLegacyCandidates').textContent.includes('2-3');
  const migrationKeepsTonePending=!document.querySelector('input[name="intakeBrandTone"]:checked')&&document.querySelector('#intakeLegacyCandidates').textContent.includes('专业直接');
  const migrationKeepsVisualCandidates=enterpriseIntakeMigratedState?.brandVisualCandidates?.primaryColor==='蓝色'&&enterpriseIntakeMigratedState?.brandVisualCandidates?.visualStyle==='专业商务'&&enterpriseIntakeMigratedState?.brandVisualCandidates?.imageStyle==='真实纪实';
  localStorage.removeItem('aiHuokeEnterpriseIntakeDraftV1');localStorage.removeItem('aiHuokeEnterpriseIntakeDraftV2');
  return {v2Restored,migrationKeepsGoalUnconfirmed,migrationKeepsBudgetPending,migrationKeepsTeamPending,migrationKeepsTonePending,migrationKeepsVisualCandidates};
})()`);
const goalsResourcesBrandAudit={...goalsResourcesBrandInteraction,...goalsResourcesBrandPersistence};

const onboardingFlow = await evaluate(`(() => {
  const afterLogin=document.querySelector('.page.show')?.dataset.p;
  const reminderVisible=document.querySelector('#newUserGuideModal')?.classList.contains('show');
  const licenseState=document.querySelector('#onboardingLicenseStatus')?.dataset.state;
  const licenseResultVisible=!document.querySelector('#onboardingLicenseResult')?.hidden;
  const preview=document.querySelector('#onboardingLicensePreview');
  const previewImage=document.querySelector('#onboardingLicensePreviewImage');
  const echoLayout=document.querySelector('.license-echo-layout');
  const previewVisible=preview ? !preview.hidden : false;
  const previewLoaded=(previewImage?.naturalWidth||0)>0;
  const previewFileName=document.querySelector('#onboardingLicenseFileName')?.textContent||'';
  const taskCount=document.querySelectorAll('#onboardingAsyncTasks .onboarding-task-row').length;
  const materialNames=[...document.querySelectorAll('#onboardingAsyncTasks .onboarding-task-row b')].map(node=>node.textContent);
  const authorizationVisible=[...document.querySelectorAll('#onboardingAsyncTasks button')].some(button=>button.textContent.includes('去授权'));
  const fourStepIndicators=document.querySelectorAll('[data-intake-step-indicator]').length;
  const candidateVisible=!document.querySelector('[data-candidate-target="intakeCustomerPain"]')?.hidden;
  const candidateAdopted=document.querySelector('#intakeCustomerPain')?.value==='缺少专业运营团队，获客渠道不稳定';
  const manualCandidateBlocked=applyEnterpriseIntakeCandidate('intakeMainBusiness','不应覆盖的候选','验收测试')===false&&document.querySelector('#intakeMainBusiness')?.value==='为成长型企业提供经营诊断与数字化服务';
  for(let i=0;i<3;i++)document.querySelector('[data-act="prev-enterprise-intake"]').click();
  const stepBackVisible=!document.querySelector('#enterpriseIntakeIdentity').hidden;
  const fieldsStillVisible=!document.querySelector('#onboardingLicenseResult').hidden && getComputedStyle(document.querySelector('#onboardingLicenseResult')).display!=='none';
  const editedCompany=document.querySelector('#licenseCompanyName')?.value||'';
  const echoLayoutColumnCount=echoLayout ? getComputedStyle(echoLayout).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length : 0;
  for(let i=0;i<3;i++)document.querySelector('[data-act="next-enterprise-intake"]').click();
  document.querySelector('[data-act="confirm-modal-profile"]').click();
  const afterProfile={page:document.querySelector('[data-p="kb"]')?.classList.contains('show'),modal:document.querySelector('#diagnosisOnboardingModal')?.classList.contains('show'),activePanel:document.querySelector('[data-kbpanel].show')?.dataset.kbpanel||''};
  const diagnosisPanel=document.querySelector('[data-kbpanel="diagnosis"]');
  const profileStored=localStorage.getItem('aiHuokeQuickProfileCompletedV1');
  const diagnosis=getEnterpriseDiagnosisCompleteness();
  return {afterLogin,reminderVisible,licenseState,licenseResultVisible,previewVisible,previewLoaded,previewFileName,echoLayoutColumnCount,taskCount,materialNames,authorizationVisible,fourStepIndicators,candidateVisible,candidateAdopted,manualCandidateBlocked,stepBackVisible,fieldsStillVisible,editedCompany,afterProfile,afterDiagnosis:document.querySelector('.page.show')?.dataset.p,diagnosisVisible:diagnosisPanel?.classList.contains('show'),profileStored,diagnosisOverall:diagnosis.overall,dimensionCount:diagnosis.dimensions.length,diagnosisStage:getEnterpriseDiagnosisStage(diagnosis)};
})()`);
const dailyDeepReminderAudit = await evaluate(`(() => {
  const modal=document.querySelector('#deepDiagnosisReminderModal');
  const login=document.querySelector('#login');
  const openLogin=()=>{modal?.classList.remove('show');if(login){login.style.display='grid';document.body.classList.add('login-active');}document.querySelector('[data-act="do-login"]')?.click();};
  localStorage.removeItem('aiHuokeDeepDiagnosisGeneratedV1');
  localStorage.removeItem(deepDiagnosisReminderDateKey);
  deepDiagnosisReminderShownInSession=false;
  enterpriseDiagnosisState.deepStatus='idle';
  openLogin();
  const today=getLocalDateKey(),firstLoginVisible=modal?.classList.contains('show')||false,storedDate=localStorage.getItem(deepDiagnosisReminderDateKey);
  document.querySelector('[data-act="dismiss-deep-reminder"]')?.click();
  openLogin();
  const sameDayLoginVisible=modal?.classList.contains('show')||false;
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  localStorage.setItem(deepDiagnosisReminderDateKey,getLocalDateKey(yesterday));
  deepDiagnosisReminderShownInSession=false;
  openLogin();
  const nextDayFirstLoginVisible=modal?.classList.contains('show')||false;
  modal?.classList.remove('show');
  localStorage.setItem('aiHuokeDeepDiagnosisGeneratedV1','1');
  localStorage.removeItem(deepDiagnosisReminderDateKey);
  deepDiagnosisReminderShownInSession=false;
  openLogin();
  const completedDiagnosisVisible=modal?.classList.contains('show')||false;
  localStorage.removeItem('aiHuokeDeepDiagnosisGeneratedV1');
  localStorage.removeItem(deepDiagnosisReminderDateKey);
  deepDiagnosisReminderShownInSession=false;
  enterpriseDiagnosisState.deepStatus='idle';saveEnterpriseDiagnosisState();
  modal?.classList.remove('show');go('kb');showKbTab('diagnosis');renderEnterpriseDiagnosis();
  return {today,firstLoginVisible,storedDate,sameDayLoginVisible,nextDayFirstLoginVisible,completedDiagnosisVisible};
})()`);
await evaluate(`document.querySelector('#toasts').innerHTML=''`);
await screenshot('enterprise-diagnosis-after-profile');

const basicDiagnosisStartAudit = await evaluate(`(() => {
  const setField=(field)=>{const controls=[...document.querySelectorAll('[name="'+field+'"]')];if(controls.length){const input=controls.find(item=>item.value!=='uncertain')||controls[0];input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));return;}const control=document.querySelector('#'+field);if(!control)return;if(control.tagName==='SELECT'){const option=[...control.options].find(item=>item.value&&item.value!=='uncertain')||control.options[1];if(option)control.value=option.value;}else control.value='补充到基础诊断门槛';control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));};
  const before=getEnterpriseDiagnosisCompleteness().overall;for(const item of buildDiagnosisMissingItems()){if(getEnterpriseDiagnosisCompleteness().overall>=40)break;setField(item.field);}enterpriseDiagnosisState={...defaultEnterpriseDiagnosisState};saveEnterpriseDiagnosisState();const atThreshold=getEnterpriseDiagnosisCompleteness().overall,started=maybeStartBasicDiagnosis();return {before,atThreshold,started,status:enterpriseDiagnosisState.basicStatus};
})()`);
await new Promise(ok => setTimeout(ok, 1600));
const basicDiagnosisCompleteAudit = await evaluate(`(() => ({status:enterpriseDiagnosisState.basicStatus,stage:getEnterpriseDiagnosisStage(getEnterpriseDiagnosisCompleteness()),generatedAt:enterpriseDiagnosisState.basicGeneratedAt}))()`);

const supplementAudit = await evaluate(`(() => {
  const button=document.querySelector('#diagnosisMissingList [data-act="supplement-enterprise-profile"]');
  const target=button?.dataset.targetField||'';
  button?.click();
  const result={target,modalOpen:document.querySelector('#newUserGuideModal')?.classList.contains('show'),visibleStep:document.querySelector('[data-intake-step]:not([hidden])')?.dataset.intakeStep||'',fourStepCount:document.querySelectorAll('[data-intake-step]').length,saveLabel:document.querySelector('#confirmModalProfileBtn')?.textContent||''};
  document.querySelector('#newUserGuideModal')?.classList.remove('show');enterpriseProfileEditMode=false;document.querySelector('#confirmModalProfileBtn').textContent='完成初步设置';
  return result;
})()`);
const diagnosisThresholdAudit = await evaluate(`(() => {
  const setField=(field)=>{const controls=[...document.querySelectorAll('[name="'+field+'"]')];if(controls.length){const input=controls.find(item=>item.value!=='uncertain')||controls[0];input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));return;}const control=document.querySelector('#'+field);if(!control)return;if(control.tagName==='SELECT'){const option=[...control.options].find(item=>item.value&&item.value!=='uncertain')||control.options[1];if(option)control.value=option.value;}else control.value='验收已确认信息';control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));};
  enterpriseDiagnosisDimensions.flatMap(item=>item.fields).forEach(([field])=>setField(field));
  enterpriseDiagnosisState={...defaultEnterpriseDiagnosisState,basicStatus:'success',basicGeneratedAt:'2026/8/11 10:00:00'};saveEnterpriseDiagnosisState();renderEnterpriseDiagnosis();
  const completeness=getEnterpriseDiagnosisCompleteness(),stage=getEnterpriseDiagnosisStage(completeness),button=document.querySelector('#startDeepDiagnosisBtn');
  return {overall:completeness.overall,allDimensionsReady:completeness.dimensions.every(item=>item.score>=60),stage,deepStatusBeforeClick:enterpriseDiagnosisState.deepStatus,deepButtonEnabled:Boolean(button&&!button.disabled),menuLabels:[...document.querySelectorAll('[data-nav-sub="kb"] [data-kbtab]')].map(item=>item.textContent.trim()),horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2};
})()`);
await evaluate(`document.querySelector('#toasts').innerHTML=''`);
await screenshot('enterprise-diagnosis-deep-ready');
await evaluate(`document.querySelector('#startDeepDiagnosisBtn')?.click()`);
await new Promise(ok => setTimeout(ok, 1800));
const deepDiagnosisAudit = await evaluate(`(() => ({deepStatus:enterpriseDiagnosisState.deepStatus,stored:localStorage.getItem('aiHuokeDeepDiagnosisGeneratedV1'),stage:getEnterpriseDiagnosisStage(getEnterpriseDiagnosisCompleteness()),buttonText:document.querySelector('#startDeepDiagnosisBtn')?.textContent||''}))()`);
await evaluate(`document.querySelector('#toasts').innerHTML=''`);
await screenshot('enterprise-diagnosis-deep-complete');

const audit = {
  capturedAt: new Date().toISOString(),
  viewport: { width, height },
  consoleErrors,
  uncaughtErrors,
  secondaryNavigationAudit,
  horizontalOverflowPages: pages.filter(page => page.scrollWidth > page.clientWidth + 2).map(page => page.name),
  duplicateVisiblePages: pages.filter(page => page.visiblePages.length !== 1).map(page => ({ name: page.name, visiblePages: page.visiblePages })),
  outsideElements: pages.filter(page => page.outside.length).map(page => ({ name: page.name, elements: page.outside })),
  initialFieldState,
  licenseManualPreserved,
  emptyFlow,
  businessModeAudit,
  acquisitionAudit,
  goalsResourcesBrandAudit,
  onboardingFlow,
  basicDiagnosisStartAudit,
  basicDiagnosisCompleteAudit,
  dailyDeepReminderAudit,
  supplementAudit,
  diagnosisThresholdAudit,
  deepDiagnosisAudit,
  initialIntakeLayout,
  goalsStepImmediateScrollTop,
  goalsStepViewport,
  pages
};
writeFileSync(resolve(outDir, `layout-audit-${viewportName}.json`), `${JSON.stringify(audit, null, 2)}\n`);
if (width === 1440 && height === 900) writeFileSync(resolve(outDir, 'layout-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
ws.close();
const expectedEchoColumns=width<=700?1:2;
const captureFailed=consoleErrors.length || uncaughtErrors.length || audit.horizontalOverflowPages.length || audit.duplicateVisiblePages.length || audit.outsideElements.length ||
  secondaryNavigationAudit.diagnosis.topTitle !== '企业大脑' || secondaryNavigationAudit.diagnosis.contentTitle !== '诊断总览' || secondaryNavigationAudit.diagnosis.activePanel !== 'diagnosis' ||
  secondaryNavigationAudit.enterpriseSettings.topTitle !== '设置' || secondaryNavigationAudit.enterpriseSettings.contentTitle !== '企业设置' || secondaryNavigationAudit.enterpriseSettings.activePanel !== 'setting-company' ||
  goalsStepImmediateScrollTop > 2 || goalsStepViewport.windowScrollY > 2 || goalsStepViewport.cardTop < 8 ||
  initialIntakeLayout.zoneHeight < 100 || initialIntakeLayout.zoneWidth < 240 || !initialFieldState.visible || initialFieldState.fieldCount !== 6 || !initialFieldState.editable || initialFieldState.manualValue !== '手动填写测试企业' || !licenseManualPreserved ||
  !emptyFlow.stepFourVisible || !emptyFlow.confirmEnabled || emptyFlow.page !== 'kb' || emptyFlow.stored !== '1' || emptyFlow.profileState !== 'draft' || !emptyFlow.status.includes('待补充') ||
  businessModeAudit.businessModeCount !== 7 || !businessModeAudit.onlineVisible || !businessModeAudit.offlineVisible || !businessModeAudit.offlineHidden || !businessModeAudit.offlineValueRestored || businessModeAudit.onlineSceneCount < 2 || businessModeAudit.offlineSceneCount < 2 || !businessModeAudit.selectedModes.includes('online-retail') || !businessModeAudit.selectedModes.includes('offline-store') ||
  acquisitionAudit.visibleModes.length !== 2 || !acquisitionAudit.visibleModes.includes('online-retail') || !acquisitionAudit.visibleModes.includes('offline-store') || acquisitionAudit.hiddenModeCount !== 5 || !acquisitionAudit.uncertainClearsConcrete || !acquisitionAudit.concreteClearsUncertain || !acquisitionAudit.offlineHidden || !acquisitionAudit.offlineValueRestored || acquisitionAudit.onlineMetric !== '3000' || acquisitionAudit.offlineMetric !== '800' || acquisitionAudit.improvement !== 'conversion' || acquisitionAudit.summaryTags !== 2 ||
  !goalsResourcesBrandAudit.recommended || !goalsResourcesBrandAudit.recommendationDidNotConfirm || !goalsResourcesBrandAudit.manualGoalPreserved || !goalsResourcesBrandAudit.monthlyBudgetPreserved || !goalsResourcesBrandAudit.noneClearsCapabilities || !goalsResourcesBrandAudit.concreteClearsNone || !goalsResourcesBrandAudit.toneLimitPreservesFirstTwo || !goalsResourcesBrandAudit.uncertainClearsTones || !goalsResourcesBrandAudit.collapsedBrandPreserved || !goalsResourcesBrandAudit.reopenedBrandPreserved || goalsResourcesBrandAudit.brandTasksAdded !== 2 || !goalsResourcesBrandAudit.asyncDoesNotBlock || goalsResourcesBrandAudit.modalOverflow || !goalsResourcesBrandAudit.v2Restored || !goalsResourcesBrandAudit.migrationKeepsGoalUnconfirmed || !goalsResourcesBrandAudit.migrationKeepsBudgetPending || !goalsResourcesBrandAudit.migrationKeepsTeamPending || !goalsResourcesBrandAudit.migrationKeepsTonePending || !goalsResourcesBrandAudit.migrationKeepsVisualCandidates ||
  onboardingFlow.afterLogin !== 'home' || !onboardingFlow.reminderVisible || onboardingFlow.licenseState !== 'done' || !onboardingFlow.licenseResultVisible || !onboardingFlow.previewVisible || !onboardingFlow.previewLoaded || onboardingFlow.previewFileName !== '营业执照.png' || onboardingFlow.echoLayoutColumnCount !== expectedEchoColumns ||
  onboardingFlow.taskCount < 3 || !onboardingFlow.materialNames.includes('公司介绍.docx') || !onboardingFlow.materialNames.includes('产品手册.pdf') || !onboardingFlow.authorizationVisible || onboardingFlow.fourStepIndicators !== 4 || !onboardingFlow.candidateVisible || !onboardingFlow.candidateAdopted || !onboardingFlow.manualCandidateBlocked ||
  !onboardingFlow.stepBackVisible || !onboardingFlow.fieldsStillVisible || onboardingFlow.editedCompany !== '识别后手动修改有限公司' || !onboardingFlow.afterProfile.page || onboardingFlow.afterProfile.modal || onboardingFlow.afterProfile.activePanel !== 'diagnosis' || onboardingFlow.afterDiagnosis !== 'kb' || !onboardingFlow.diagnosisVisible || onboardingFlow.profileStored !== '1' || onboardingFlow.dimensionCount !== 6 || onboardingFlow.diagnosisOverall >= 40 || onboardingFlow.diagnosisStage !== 'supplement' ||
  !dailyDeepReminderAudit.firstLoginVisible || dailyDeepReminderAudit.storedDate !== dailyDeepReminderAudit.today || dailyDeepReminderAudit.sameDayLoginVisible || !dailyDeepReminderAudit.nextDayFirstLoginVisible || dailyDeepReminderAudit.completedDiagnosisVisible ||
  basicDiagnosisStartAudit.before >= 40 || basicDiagnosisStartAudit.atThreshold < 40 || !basicDiagnosisStartAudit.started || basicDiagnosisStartAudit.status !== 'running' || basicDiagnosisCompleteAudit.status !== 'success' || basicDiagnosisCompleteAudit.stage !== 'basic' || !basicDiagnosisCompleteAudit.generatedAt ||
  !supplementAudit.modalOpen || supplementAudit.fourStepCount !== 4 || !supplementAudit.visibleStep || supplementAudit.saveLabel !== '保存补充' ||
  diagnosisThresholdAudit.overall < 80 || !diagnosisThresholdAudit.allDimensionsReady || diagnosisThresholdAudit.stage !== 'deep-ready' || diagnosisThresholdAudit.deepStatusBeforeClick !== 'idle' || !diagnosisThresholdAudit.deepButtonEnabled || diagnosisThresholdAudit.menuLabels.join('|') !== '诊断总览|企业 VI|企业知识|外部情报|进化与治理' || diagnosisThresholdAudit.horizontalOverflow ||
  deepDiagnosisAudit.deepStatus !== 'success' || deepDiagnosisAudit.stored !== '1' || deepDiagnosisAudit.stage !== 'deep-complete' || !deepDiagnosisAudit.buttonText.includes('已完成');
if (captureFailed) {
  console.error(JSON.stringify(audit, null, 2));
  process.exitCode = 1;
} else {
  console.log(`V1 prototype capture PASS: ${screenshotCount} screenshots`);
}
