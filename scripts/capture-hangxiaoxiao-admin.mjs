import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((items, value, index, all) => {
  if (value.startsWith('--')) items.push([value.slice(2), all[index + 1]]);
  return items;
}, []));
const port = Number(args.port || 9228);
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const minimumWidth = 1024;
if (width < minimumWidth) throw new Error(`杭小消后台仅验收 PC 端，当前宽度 ${width}px 小于 ${minimumWidth}px`);
const suffix = `${width}x${height}`;
const outDir = resolve(args['out-dir'] || 'validation/hangxiaoxiao-admin');
mkdirSync(outDir, { recursive: true });

const routes = [
  'home', 'marketing-materials', 'acquisition', 'plan', 'burst', 'remix', 'create', 'avatar',
  'review', 'knowledge', 'graph', 'quality', 'sources', 'dashboard', 'system', 'members', 'permissions', 'bind', 'prompts', 'usage', 'logs',
];
const pagePrdContexts = [
  ['home', '', 'home', '运营工作台 · 页面 PRD', '今日待办字段'],
  ['dashboard', '', 'dashboard', '运营大屏 · 页面 PRD', '展示指标'],
  ['marketing-materials', 'material-ppt', 'material-ppt', 'PPT · 页面 PRD', '创建与大纲字段'],
  ['marketing-materials', 'material-moments', 'material-moments', '朋友圈图文 · 页面 PRD', '图文内容字段'],
  ['marketing-materials', 'material-poster', 'material-poster', '海报 · 页面 PRD', '海报内容字段'],
  ['marketing-materials', 'material-wechat', 'material-wechat', '公众号文章 · 页面 PRD', '公众号授权字段'],
  ['acquisition', '', 'acquisition', 'AI 获客总览 · 页面 PRD', '能力卡片字段'],
  ['plan', '', 'plan', '运营计划 · 页面 PRD', '生成依据快照'],
  ['burst', '', 'burst', '爆款追踪 · 页面 PRD', '热点字段'],
  ['remix', '', 'remix', 'AI 混剪 · 页面 PRD', '输入与生成字段'],
  ['create', '', 'create', '营销视频 · 页面 PRD', '视频字段'],
  ['avatar', '', 'avatar', '数字人 · 页面 PRD', '资源与任务字段'],
  ['review', '', 'review', '知识审核 · 页面 PRD', '候选内容字段'],
  ['knowledge', '', 'knowledge', '企业大脑 · 页面 PRD', '检索与结果字段'],
  ['graph', '', 'graph', '知识图谱 · 页面 PRD', '图谱与候选字段'],
  ['quality', '', 'quality', '进化治理 · 页面 PRD', '维护中心与规则字段'],
  ['sources', '', 'sources', '数据采集 · 页面 PRD', '渠道字段'],
  ['system', '', 'system', '系统设置 · 页面 PRD', '企业信息字段'],
  ['members', '', 'members', '成员管理 · 页面 PRD', '成员字段'],
  ['permissions', '', 'permissions', '权限管理 · 页面 PRD', '角色列表字段'],
  ['bind', '', 'bind', '平台账号 · 页面 PRD', '授权账号字段'],
  ['prompts', '', 'prompts', '提示词管理 · 页面 PRD', '完整Prompt内容'],
  ['usage', '', 'usage', '用量管理 · 页面 PRD', '额度指标'],
  ['logs', '', 'logs', '日志与审计 · 页面 PRD', '日志类型'],
];
const expectedPages = {};
const screenshotRoutes = ['home', 'marketing-materials', 'acquisition', 'remix', 'knowledge', 'sources', 'review', 'graph', 'dashboard', 'members', 'permissions', 'bind', 'prompts', 'system', 'usage', 'logs'];

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
const target = targets.find(item => item.type === 'page' && /^http:\/\/127\.0\.0\.1:8010\/index\.html/.test(item.url));
if (!target) throw new Error('杭小消原型页面未在 http://127.0.0.1:8010/index.html 打开');

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
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map(item => item.value || item.description).join(' '));
  }
  if (message.method === 'Runtime.exceptionThrown') {
    uncaughtErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || 'Uncaught exception');
  }
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

async function wait(ms) {
  await new Promise(resolveWait => setTimeout(resolveWait, ms));
}

async function screenshot(route) {
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(outDir, `${route}-${suffix}.png`), Buffer.from(image.data, 'base64'));
}

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8010/index.html' });
await wait(900);
try {
  await evaluate(`new Promise((resolveReady,rejectReady)=>{let attempts=0;const timer=setInterval(()=>{if(typeof window.hxxNavigate==='function'&&document.body.classList.contains('hxx-admin')){clearInterval(timer);resolveReady(true);}else if(++attempts>50){clearInterval(timer);rejectReady(new Error('杭小消适配层未就绪'));}},100);})`);
} catch (error) {
  const diagnostic = await evaluate(`(() => ({readyState:document.readyState,title:document.title,bodyClass:document.body?.className||'',script:[...document.scripts].map(item=>item.src).filter(Boolean),navigateType:typeof window.hxxNavigate,htmlLength:document.documentElement?.outerHTML.length||0}))()`);
  throw new Error(`${error.message}\nconsole: ${consoleErrors.join(' | ') || '无'}\nuncaught: ${uncaughtErrors.join(' | ') || '无'}\ndiagnostic: ${JSON.stringify(diagnostic)}`);
}
const sharedLoginBrand = await evaluate(`(() => {const login=document.querySelector('#login'),text=login?.innerText||'';return getComputedStyle(login).display!=='none'&&text.includes('AI 获客')&&!text.includes('杭小消知识运营平台');})()`);
const pagePrdHiddenOnLogin = await evaluate(`document.querySelector('[data-hxx-page-prd-trigger]')?.hidden===true`);
await screenshot('login');
await evaluate(`document.querySelector('[data-act="do-login"]')?.click()`);
await wait(120);
const sharedLoginEntersHangxiaoxiaoTenant = sharedLoginBrand && await evaluate(`(() => {const login=document.querySelector('#login');return getComputedStyle(login).display==='none'&&!document.body.classList.contains('login-active')&&document.querySelector('#customerName')?.textContent==='杭小消专属租户'&&document.querySelector('.brand')?.textContent.includes('杭小消知识运营平台')&&document.querySelector('.page.show')?.dataset.p==='home';})()`);

const routeAudits = [];
for (const route of routes) {
  await evaluate(`window.hxxNavigate(${JSON.stringify(route)})`);
  await wait(90);
  const audit = await evaluate(`(() => {
    const route=${JSON.stringify(route)};
    const expectedPage=${JSON.stringify(expectedPages[route] || route)};
    const visible=[...document.querySelectorAll('.page.show')];
    const page=document.querySelector('.page.show');
    const measured=[...page.querySelectorAll('.hxx-panel,.hxx-kpis,.hxx-flow,.hxx-toolbar,.hxx-callout,.hxx-template-grid,.hxx-showcase-panel,.hxx-showcase-metrics')];
    const outside=measured.filter(node=>{const rect=node.getBoundingClientRect();return rect.left < -2 || rect.right > innerWidth + 2;}).map(node=>node.className);
    return {
      route,
      title:document.querySelector('#ptitle')?.textContent||'',
      visibleCount:visible.length,
      correctPage:page?.dataset.p===expectedPage,
      contentLength:(page?.innerText||'').trim().length,
      horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,
      outside,
    };
  })()`);
  routeAudits.push(audit);
  if (screenshotRoutes.includes(route)) await screenshot(route);
}

const interactions = { sharedLoginEntersHangxiaoxiaoTenant };
await evaluate(`window.hxxNavigate('plan')`);
await wait(40);
await screenshot('plan-list');
interactions.operationPlanListAndPeriodFiltersWork = await evaluate(`(async()=>{
  const type=document.querySelector('[data-hxx-plan-filter="type"]');
  if(!type||document.querySelectorAll('[data-hxx-operation-plan]').length!==3)return false;
  type.value='week';type.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  const week=document.querySelector('[data-hxx-plan-filter="weekDate"]');
  if(!week||document.querySelector('[data-hxx-plan-period-control="week"]')?.hidden)return false;
  week.value='2026-09-02';week.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  const weekRows=[...document.querySelectorAll('[data-hxx-operation-plan]')];
  const weekValid=weekRows.length===1&&weekRows[0].dataset.hxxOperationPlan==='plan-week-2026-w36';
  const nextType=document.querySelector('[data-hxx-plan-filter="type"]');
  if(!nextType)return false;
  nextType.value='month';nextType.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  const month=document.querySelector('[data-hxx-plan-filter="month"]');
  if(!month||document.querySelector('[data-hxx-plan-period-control="month"]')?.hidden)return false;
  month.value='2026-08';month.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  const monthRows=[...document.querySelectorAll('[data-hxx-operation-plan]')];
  const monthValid=monthRows.length===1&&monthRows[0].dataset.hxxOperationPlan==='plan-month-2026-08';
  document.querySelector('[data-hxx-action="plan-filter-reset"]')?.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  return weekValid&&monthValid&&document.querySelectorAll('[data-hxx-operation-plan]').length===3;
})()`);
await evaluate(`document.querySelector('[data-hxx-operation-plan="plan-week-2026-w36"] [data-hxx-action="view-operation-plan"]')?.click()`);
await wait(40);
await screenshot('plan-detail');
await evaluate(`document.querySelector('[data-hxx-draft-task-id="task-1"] [data-hxx-action="adjust-operation-task"]')?.click()`);
await wait(40);
await screenshot('plan-task-detail');
interactions.operationPlanDraftTaskAdjustmentClosesLoop = await evaluate(`(async()=>{
  const taskView=document.querySelector('[data-hxx-plan-view="task"]'),expected=taskView?.querySelector('[data-hxx-plan-task-field="expected"]');
  if(!taskView||!expected||!taskView.textContent.includes('任务依据'))return false;
  expected.value='预期阅读 3,200 次';
  document.querySelector('[data-hxx-action="save-operation-task"]')?.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  const detail=document.querySelector('[data-hxx-plan-view="detail"]');
  return Boolean(detail)&&detail.textContent.includes('预期阅读 3,200 次')&&!detail.querySelector('[data-hxx-formal-task-id]');
})()`);
interactions.operationPlanConfirmationIsAtomicAndIdempotent = await evaluate(`(async()=>{
  const draftCount=document.querySelectorAll('[data-hxx-draft-task-id]').length;
  document.querySelector('[data-hxx-action="confirm-operation-plan"]')?.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  const modalText=document.querySelector('#modal')?.textContent||'';
  if(!modalText.includes('批量创建全部正式任务')||!modalText.includes('不自动对外发布'))return false;
  document.querySelector('#modal [data-mo]')?.click();
  await new Promise(resolve=>setTimeout(resolve,30));
  const firstIds=[...document.querySelectorAll('[data-hxx-formal-task-id]')].map(node=>node.dataset.hxxFormalTaskId);
  const probe=document.createElement('button');probe.dataset.hxxAction='confirm-operation-plan';document.body.appendChild(probe);probe.click();
  await new Promise(resolve=>setTimeout(resolve,20));probe.remove();
  const secondIds=[...document.querySelectorAll('[data-hxx-formal-task-id]')].map(node=>node.dataset.hxxFormalTaskId);
  return draftCount===3&&firstIds.length===draftCount&&new Set(firstIds).size===draftCount
    && JSON.stringify(firstIds)===JSON.stringify(secondIds)
    && document.querySelector('[data-hxx-plan-view="detail"]')?.textContent.includes('执行中');
})()`);
interactions.operationPlanPrdContainsCalculations = await evaluate(`(async()=>{
  document.querySelector('[data-hxx-page-prd-trigger]')?.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  const text=document.querySelector('#drawerBody')?.textContent||'';
  const valid=document.querySelector('#drawerTitle')?.textContent==='运营计划 · 页面 PRD'
    && ['生成依据快照','计算逻辑','执行进度','纳入/排除及去重','周期/权限/刷新','空值与下钻','plan_id + plan_version'].every(label=>text.includes(label));
  window.closeDrawer?.();return valid;
})()`);
await evaluate(`window.hxxNavigate('home')`);
interactions.allPagePrdContextsAreVisible = pagePrdHiddenOnLogin && await evaluate(`(async()=>{
  const contexts=${JSON.stringify(pagePrdContexts)};
  const trigger=document.querySelector('[data-hxx-page-prd-trigger]');
  if(!trigger||document.querySelectorAll('[data-hxx-page-prd-trigger]').length!==1)return false;
  for(const [route,subview,key] of contexts){
    window.hxxNavigate(route,subview);
    await new Promise(resolve=>setTimeout(resolve,15));
    if(trigger.hidden||trigger.dataset.hxxPagePrdKey!==key)return false;
  }
  window.hxxNavigate('home');
  return !trigger.hidden&&trigger.dataset.hxxPagePrdKey==='home';
})()`);
interactions.allPagePrdDrawersOpenWithMatchingTitles = await evaluate(`(async()=>{
  const contexts=${JSON.stringify(pagePrdContexts)};
  const trigger=document.querySelector('[data-hxx-page-prd-trigger]');
  for(const [route,subview,key,title,marker] of contexts){
    window.hxxNavigate(route,subview);
    await new Promise(resolve=>setTimeout(resolve,15));
    trigger?.click();
    await new Promise(resolve=>setTimeout(resolve,10));
    const drawer=document.querySelector('#detailDrawer'),body=document.querySelector('#drawerBody'),text=body?.textContent||'';
    const valid=drawer?.dataset.hxxPagePrdKey===key
      && drawer.getAttribute('aria-hidden')==='false'
      && document.querySelector('#drawerTitle')?.textContent===title
      && body.querySelectorAll('.hxx-page-prd-table').length>=2
      && ['页面概述','页面级业务规则','治理边界提示','状态与跳转','通知与日志','异常与空状态','页面验收标准','技术评估项',marker].every(label=>text.includes(label));
    window.closeDrawer?.();
    await new Promise(resolve=>setTimeout(resolve,10));
    if(!valid)return false;
  }
  window.hxxNavigate('home');
  return true;
})()`);
interactions.materialSubviewSwitchUpdatesPagePrd = await evaluate(`(async()=>{
  window.hxxNavigate('marketing-materials','material-ppt');
  await new Promise(resolve=>setTimeout(resolve,20));
  document.querySelector('[data-act="switch-subview"][data-subview="material-wechat"]')?.click();
  await new Promise(resolve=>setTimeout(resolve,30));
  const trigger=document.querySelector('[data-hxx-page-prd-trigger]');
  if(trigger?.dataset.hxxPagePrdKey!=='material-wechat')return false;
  trigger.click();
  await new Promise(resolve=>setTimeout(resolve,10));
  const valid=document.querySelector('#drawerTitle')?.textContent==='公众号文章 · 页面 PRD'
    && (document.querySelector('#drawerBody')?.textContent||'').includes('公众号授权字段');
  window.closeDrawer?.();window.hxxNavigate('home');
  return valid;
})()`);
interactions.notificationCenterPrdOpensAndReturns = await evaluate(`(async()=>{
  window.hxxNavigate('home');
  const entry=document.querySelector('[data-hxx-action="open-notification-center"]');
  entry?.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  const badgeBefore=entry?.querySelector('b')?.textContent;
  const notificationsBefore=document.querySelectorAll('#drawerBody [data-hxx-notification]').length;
  const prdButton=document.querySelector('#drawerFoot [data-hxx-action="open-notification-prd"]');
  if(!prdButton||notificationsBefore<1)return false;
  prdButton.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  const prdText=document.querySelector('#drawerBody')?.textContent||'';
  const opened=document.querySelector('#detailDrawer')?.dataset.hxxPagePrdKey==='notifications'
    && document.querySelector('#drawerTitle')?.textContent==='通知中心 · 页面 PRD'
    && ['通知类型与触发规则','通知字段','操作与结果','已读状态','处理状态'].every(label=>prdText.includes(label));
  document.querySelector('#drawerFoot [data-hxx-action="return-notification-center"]')?.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  const returned=document.querySelector('#drawerTitle')?.textContent==='通知中心'
    && document.querySelectorAll('#drawerBody [data-hxx-notification]').length===notificationsBefore
    && entry?.querySelector('b')?.textContent===badgeBefore;
  window.closeDrawer?.();
  return opened&&returned;
})()`);
interactions.pptListHasNoSummaryStatistics = await evaluate(`(() => {
  window.hxxNavigate('marketing-materials','material-ppt');
  const panel=document.querySelector('[data-subview-panel="material-ppt"]');
  return Boolean(panel?.querySelector('#pptArtifactList'))
    && !panel.querySelector('.workspace-summary')
    && !document.querySelector('#pptTotalCount,#pptGeneratingCount,#pptReadyCount');
})()`);
await evaluate(`(() => {
  window.hxxNavigate('home');
  document.querySelector('[data-hxx-action="open-notification-center"]')?.click();
  document.querySelector('#drawerFoot [data-hxx-action="open-notification-prd"]')?.click();
  return true;
})()`);
await wait(80);
await screenshot('notification-center-prd');
await evaluate(`window.closeDrawer?.()`);
interactions.workbenchPagePrdDrawerOpens = await evaluate(`(() => {
  window.hxxNavigate('home');
  const trigger=document.querySelector('[data-hxx-page-prd-trigger]'),before=location.href;
  trigger?.click();
  const drawer=document.querySelector('#detailDrawer'),body=document.querySelector('#drawerBody'),text=body?.textContent||'';
  return drawer?.classList.contains('show')
    && drawer.getAttribute('aria-hidden')==='false'
    && trigger?.getAttribute('aria-expanded')==='true'
    && document.querySelector('#drawerTitle')?.textContent==='运营工作台 · 页面 PRD'
    && drawer.querySelectorAll('.hxx-page-prd-section').length>=11
    && drawer.querySelectorAll('.hxx-page-prd-table').length>=1
    && ['页面概述','页面级业务规则','核心指标字段','今日待办字段','采集运行字段','操作与结果','治理边界提示','状态与跳转','通知与日志','异常与空状态','页面验收标准','技术评估项'].every(label=>text.includes(label))
    && ['正式知识','今日采集候选','待人工处理','知识调用','任务','来源','风险','状态','操作','渠道分组'].every(field=>text.includes(field))
    && location.href===before
    && document.body.style.overflow==='hidden';
})()`);
await wait(120);
await screenshot('home-page-prd');
interactions.workbenchPagePrdClosesAndRestoresFocus = await evaluate(`new Promise(resolve=>{
  const trigger=document.querySelector('[data-hxx-page-prd-trigger]');
  document.querySelector('#detailDrawer .drawer-head [data-act="close-drawer"]')?.click();
  setTimeout(()=>resolve(!document.querySelector('#detailDrawer')?.classList.contains('show')
    && document.querySelector('#detailDrawer')?.getAttribute('aria-hidden')==='true'
    && trigger?.getAttribute('aria-expanded')==='false'
    && document.activeElement===trigger
    && document.body.style.overflow===''),30);
})`);
interactions.workbenchPagePrdSupportsMaskAndEscape = await evaluate(`(async()=>{
  const trigger=document.querySelector('[data-hxx-page-prd-trigger]');
  trigger?.click();
  document.querySelector('#drawerMask')?.click();
  await new Promise(resolve=>setTimeout(resolve,30));
  const maskClosed=document.querySelector('#detailDrawer')?.getAttribute('aria-hidden')==='true';
  trigger?.click();
  await new Promise(resolve=>setTimeout(resolve,30));
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,30));
  return maskClosed&&document.querySelector('#detailDrawer')?.getAttribute('aria-hidden')==='true';
})()`);
interactions.knowledgeNavigationNamesOrderAndTitles = await evaluate(`(() => {
  const group=document.querySelector('[data-hxx-nav-group="知识中台"]');
  if(!group)return false;
  const actual=[...group.querySelectorAll('[data-hxx-route]')].map(item=>[item.dataset.hxxRoute,item.textContent.trim().replace(/\\d+$/,'')]);
  const expected=[['review','知识审核'],['knowledge','企业大脑'],['graph','知识图谱'],['quality','进化治理'],['sources','数据采集']];
  if(JSON.stringify(actual)!==JSON.stringify(expected))return false;
  for(const [route,title] of expected){window.hxxNavigate(route);if(document.querySelector('#ptitle')?.textContent!==title)return false;}
  return true;
})()`);
interactions.contentOperationsReuseAiHuokeNavigation = await evaluate(`(async () => {
  const group=document.querySelector('[data-hxx-nav-group="内容运营"]');
  if(!group)return false;
  const parents=[...group.querySelectorAll(':scope > [data-hxx-nav-category]')].map(item=>[item.dataset.hxxNavCategory,item.querySelector('[data-hxx-nav-label]')?.textContent.trim()||item.textContent.trim()]);
  const expectedParents=[['marketing-materials','营销物料'],['acquisition','AI 获客']];
  if(JSON.stringify(parents)!==JSON.stringify(expectedParents))return false;
  if(group.querySelector(':scope > button[data-hxx-route="marketing-materials"],:scope > button[data-hxx-route="acquisition"]'))return false;
  if([...group.querySelectorAll(':scope > [data-hxx-nav-category]')].some(item=>!item.matches('button:disabled')||item.classList.contains('on')||item.hasAttribute('data-hxx-route')))return false;
  const materialChildren=[...group.querySelectorAll('[data-hxx-parent-route="marketing-materials"]')].map(item=>item.textContent.trim());
  const acquisitionChildren=[...group.querySelectorAll('[data-hxx-parent-route="acquisition"]')].map(item=>item.textContent.trim());
  if(JSON.stringify(materialChildren)!==JSON.stringify(['PPT','朋友圈图文','海报','公众号文章']))return false;
  if(JSON.stringify(acquisitionChildren)!==JSON.stringify(['运营计划','爆款追踪','AI 混剪','营销视频','数字人']))return false;
  if(['AIGC 创作','趋势内容','作品与素材'].some(label=>group.textContent.includes(label)))return false;
  group.querySelector('[data-hxx-content-subview="material-wechat"]')?.click();
  await new Promise(resolve=>setTimeout(resolve,80));
  if(document.querySelector('.page.show')?.dataset.p!=='marketing-materials'||!document.querySelector('[data-subview-panel="material-wechat"]')?.classList.contains('show'))return false;
  group.querySelector('[data-hxx-route="remix"]')?.click();
  await new Promise(resolve=>setTimeout(resolve,80));
  return document.querySelector('.page.show')?.dataset.p==='remix'
    && document.querySelector('#ptitle')?.textContent==='AI 混剪'
    && !group.querySelector('[data-hxx-nav-category="acquisition"]')?.classList.contains('on')
    && group.querySelector('[data-hxx-route="remix"]')?.classList.contains('on');
})()`);
interactions.relatedMenusAreGroupedLikeAiHuoke = await evaluate(`(() => {
  const expected=[
    ['workbench','工作台',[['home','运营工作台'],['dashboard','运营大屏']]],
    ['knowledge-center','知识中台',[['review','知识审核'],['knowledge','企业大脑'],['graph','知识图谱'],['quality','进化治理'],['sources','数据采集']]],
    ['system-management','系统管理',[['system','系统设置'],['members','成员管理'],['permissions','权限管理'],['bind','平台账号'],['prompts','提示词管理'],['usage','用量管理'],['logs','日志与审计']]]
  ];
  if(document.querySelector('[data-hxx-nav-category="operations"],[data-hxx-nav-sub="operations"]'))return false;
  for(const [key,label,children] of expected){
    const category=document.querySelector('[data-hxx-nav-category="'+key+'"]');
    const sub=document.querySelector('[data-hxx-nav-sub="'+key+'"]');
    if(!category?.matches('button:disabled')||category.textContent.trim()!==label||!sub)return false;
    const actual=[...sub.querySelectorAll('[data-hxx-route]')].map(item=>[item.dataset.hxxRoute,item.textContent.trim().replace(/\\d+$/,'')]);
    if(JSON.stringify(actual)!==JSON.stringify(children))return false;
    if(children.some(([route])=>document.querySelector('[data-hxx-nav-parent="'+route+'"]')))return false;
  }
  return true;
})()`);
interactions.navigationMatchesAiHuokeStyle = await evaluate(`(() => {
  const nav=document.querySelector('#nav');
  const workbenchCategory=nav?.querySelector('[data-hxx-nav-category="workbench"]');
  const workbenchSub=nav?.querySelector('[data-hxx-nav-sub="workbench"]');
  const workbenchItem=workbenchSub?.querySelector('[data-hxx-route="home"]');
  const category=nav?.querySelector('[data-hxx-nav-category="marketing-materials"]');
  const sub=nav?.querySelector('[data-hxx-nav-sub="marketing-materials"]');
  const nested=sub?.querySelector('[data-hxx-content-subview="material-ppt"]');
  if(!nav||!workbenchCategory||!workbenchSub||!workbenchItem||!category||!sub||!nested||nav.querySelector('.grp')||nav.querySelector('[data-hxx-nav-parent="home"]'))return false;
  const topShape=node=>{const style=getComputedStyle(node);return [style.minHeight,style.padding,style.borderRadius,style.fontSize,style.gap];};
  const nestedStyle=getComputedStyle(nested),workbenchItemStyle=getComputedStyle(workbenchItem),subStyle=getComputedStyle(sub),workbenchSubStyle=getComputedStyle(workbenchSub);
  const workbenchShape=topShape(workbenchCategory),categoryShape=topShape(category);
  return workbenchShape[0]==='40px'
    && workbenchShape[1]==='8px 11px'
    && workbenchShape[2]==='8px'
    && workbenchShape[4]==='11px'
    && JSON.stringify(categoryShape)===JSON.stringify(workbenchShape)
    && nestedStyle.padding==='7px'
    && nestedStyle.borderRadius==='6px'
    && nestedStyle.fontSize===workbenchShape[3]
    && workbenchItemStyle.padding===nestedStyle.padding
    && workbenchItemStyle.borderRadius===nestedStyle.borderRadius
    && subStyle.marginLeft==='28px'
    && workbenchSubStyle.marginLeft===subStyle.marginLeft
    && subStyle.rowGap==='2px'
    && subStyle.columnGap==='4px'
    && subStyle.gridTemplateColumns.split(' ').length===2
    && workbenchSubStyle.gridTemplateColumns.split(' ').length===2;
})()`);
interactions.pageContentUsesFullWidth = await evaluate(`(() => {
  const main=document.querySelector('.main');
  const page=document.querySelector('.page.show');
  if(!main||!page)return false;
  const styles=getComputedStyle(main);
  const available=main.clientWidth-parseFloat(styles.paddingLeft||0)-parseFloat(styles.paddingRight||0);
  return Math.abs(page.getBoundingClientRect().width-available)<=2;
})()`);
await evaluate(`window.hxxNavigate('knowledge')`);
interactions.knowledgeQueryIsDefaultView = await evaluate(`(() => {
  const query=document.querySelector('[data-hxx-knowledge-panel="query"]');
  const manage=document.querySelector('[data-hxx-knowledge-panel="manage"]');
  return !query?.hidden
    && manage?.hidden
    && document.querySelector('[data-hxx-knowledge-view="query"]')?.classList.contains('on')
    && document.querySelector('[data-hxx-knowledge-view="manage"]')?.dataset.hxxPermission==='knowledge.manage';
})()`);
interactions.knowledgeOverviewIsVisible = await evaluate(`(() => {
  const workspace=document.querySelector('#hxxKnowledgeWorkspace');
  const rows=[...document.querySelectorAll('[data-hxx-knowledge-result]')];
  return workspace?.dataset.mode==='overview'
    && Number(document.querySelector('#hxxKnowledgeResultCount')?.dataset.count||0)>=6
    && !document.querySelector('.hxx-knowledge-tree')
    && rows.every(row=>row.textContent.includes('已发布'))
    && document.querySelector('#hxxKnowledgePreview')?.textContent.includes('消费者权益保护法');
})()`);
interactions.knowledgeDomainFiltersResults = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="knowledge-clear"]')?.click();
  document.querySelector('[data-hxx-knowledge-filter="category"][data-hxx-filter-value="咨询问答"]')?.click();
  const active=document.querySelector('[data-hxx-knowledge-filter="category"].on');
  const rows=[...document.querySelectorAll('[data-hxx-knowledge-result]')];
  return active?.dataset.hxxFilterValue==='咨询问答'
    && rows.length===2
    && rows.every(row=>row.dataset.domain==='咨询问答');
})()`);
interactions.knowledgeMultimodalFiltersWork = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="knowledge-clear"]')?.click();
  document.querySelector('[data-hxx-knowledge-filter="modality"][data-hxx-filter-value="视频"]')?.click();
  const rows=[...document.querySelectorAll('[data-hxx-knowledge-result]')];
  const modalityActive=document.querySelector('[data-hxx-knowledge-filter="modality"].on');
  return modalityActive?.dataset.hxxFilterValue==='视频'
    && rows.length===1
    && rows.every(row=>row.dataset.modality==='视频')
    && document.querySelector('.hxx-multimodal-filters')?.textContent.includes('消费领域')
    && document.querySelector('.hxx-multimodal-filters')?.textContent.includes('热点专题');
})()`);
interactions.knowledgeSemanticSearchWorks = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="knowledge-clear"]')?.click();
  document.querySelector('[data-hxx-search-mode="semantic"]')?.click();
  const input=document.querySelector('#hxxKnowledgeSearch');
  if(input){input.value='预付款退定';input.dispatchEvent(new Event('input',{bubbles:true}));}
  document.querySelector('[data-hxx-action="knowledge-search"]')?.click();
  const workspace=document.querySelector('#hxxKnowledgeWorkspace');
  const resultText=[...document.querySelectorAll('[data-hxx-knowledge-result]')].map(row=>row.textContent).join(' ');
  return workspace?.dataset.mode==='search'
    && workspace?.dataset.searchMode==='semantic'
    && resultText.includes('预付卡商家闭店如何维权')
    && document.querySelector('#hxxKnowledgeSearchSummary')?.textContent.includes('预付款退订');
})()`);
interactions.knowledgeResultUpdatesPreview = await evaluate(`(() => {
  const target=[...document.querySelectorAll('[data-hxx-knowledge-result]')].find(row=>row.textContent.includes('退款办理步骤'));
  target?.click();
  const selected=document.querySelector('[data-hxx-knowledge-result="qa-prepay-refund"]');
  const preview=document.querySelector('#hxxKnowledgePreview')?.textContent||'';
  return selected?.classList.contains('on')
    && preview.includes('预付式消费退款办理步骤')
    && preview.includes('来源')
    && preview.includes('版本')
    && preview.includes('适用范围')
    && preview.includes('关联内容');
})()`);
interactions.enterpriseBrainOnlyUploadsMaterials = await evaluate(`(() => {
  const page=document.querySelector('.page.show');
  const upload=page?.querySelector('[data-hxx-action="upload-demo"]');
  return page?.dataset.p==='knowledge'
    && upload?.textContent.includes('上传资料')
    && !page.querySelector('[data-hxx-action="new-knowledge"]')
    && !page.textContent.includes('新建知识');
})()`);
interactions.knowledgeUploadOpensReviewIntake = await evaluate(`(() => {
  const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';
  document.querySelector('[data-hxx-action="upload-demo"]')?.click();
  const modal=document.querySelector('#modal');
  const valid=document.querySelector('#mask')?.classList.contains('show')
    && modal?.textContent.includes('上传资料')
    && Boolean(document.querySelector('#hxxUploadFile'))
    && Boolean(document.querySelector('#hxxUploadSource'))
    && Boolean(document.querySelector('#hxxUploadDomain'))
    && modal.textContent.includes('提交后进入知识审核');
  return Boolean(valid);
})()`);
await wait(80);
await screenshot('knowledge-upload');
await evaluate(`window.closeModal?.()`);
interactions.knowledgeSourceOpensOriginal = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="query-source"]')?.click();
  const modal=document.querySelector('#modal');
  const valid=document.querySelector('#mask')?.classList.contains('show')
    && modal?.textContent.includes('查看知识原件')
    && modal.textContent.includes('原文片段')
    && modal.textContent.includes('证据定位');
  window.closeModal?.();
  return Boolean(valid);
})()`);
interactions.knowledgeFeedbackOpensGovernedFlow = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="query-feedback"]')?.click();
  const modal=document.querySelector('#modal');
  const valid=document.querySelector('#mask')?.classList.contains('show')
    && modal?.textContent.includes('反馈知识有误')
    && modal.textContent.includes('反馈进入优化建议')
    && modal.textContent.includes('不会直接修改正式知识');
  window.closeModal?.();
  return Boolean(valid);
})()`);
interactions.knowledgeUsesGlobalFormalKnowledgeWithoutManualReference = await evaluate(`(() => {
  const page=document.querySelector('.page.show');
  return !page?.querySelector('[data-hxx-action="query-use"]')
    && !page?.textContent.includes('引用知识')
    && Boolean(page?.querySelector('[data-hxx-action="query-source"]'))
    && Boolean(page?.querySelector('[data-hxx-action="query-feedback"]'));
})()`);
await wait(120);
await screenshot('knowledge-search');
interactions.knowledgeManagementViewOpens = await evaluate(`(() => {
  document.querySelector('[data-hxx-knowledge-view="manage"]')?.click();
  const manage=document.querySelector('[data-hxx-knowledge-panel="manage"]');
  return !manage?.hidden
    && document.querySelector('[data-hxx-knowledge-view="manage"]')?.classList.contains('on')
    && manage.querySelectorAll('[data-hxx-management-group]').length===7
    && manage.querySelectorAll('[data-hxx-managed-formal]').length===6
    && manage.textContent.includes('AI 自动分组')
    && !manage.querySelector('[data-hxx-management-tab]')
    && !manage.querySelector('[data-hxx-managed-candidate]')
    && Boolean(manage.querySelector('[data-hxx-action="route-review"]'));
})()`);
await wait(80);
await screenshot('knowledge-manage');
interactions.knowledgeDetailAndVersionOpen = await evaluate(`(() => {
  const detail=document.querySelector('[data-hxx-action="managed-detail"]');
  detail?.click();
  const detailValid=document.querySelector('#modal')?.textContent.includes('知识详情')
    && document.querySelector('#modal')?.textContent.includes('适用范围');
  window.closeModal?.();
  document.querySelector('[data-hxx-action="managed-version"]')?.click();
  const versionText=document.querySelector('#modal')?.textContent||'';
  const versionValid=versionText.includes('知识版本记录')
    && versionText.includes('已发布版本不可覆盖')
    && versionText.includes('历史版本');
  window.closeModal?.();
  return Boolean(detailValid&&versionValid);
})()`);
interactions.managementGroupAndTypeFiltersWork = await evaluate(`(() => {
  document.querySelector('[data-hxx-management-group="宣传素材"]')?.click();
  document.querySelector('[data-hxx-management-type="素材"]')?.click();
  const rows=[...document.querySelectorAll('[data-hxx-managed-formal]')];
  return document.querySelector('[data-hxx-management-group="宣传素材"]')?.classList.contains('on')
    && document.querySelector('[data-hxx-management-type="素材"]')?.classList.contains('on')
    && rows.length===1
    && rows[0].dataset.group==='宣传素材'
    && rows[0].dataset.type==='素材';
})()`);
interactions.managementReviewShortcutOpensReviewCenter = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="route-review"]')?.click();
  const page=document.querySelector('.page.show');
  const medical=document.querySelector('[data-hxx-review-work="review-medical"]');
  return page?.dataset.p==='review'
    && document.querySelector('#ptitle')?.textContent==='知识审核'
    && document.querySelector('[data-hxx-route="review"]')?.textContent.includes('知识审核')
    && page.querySelector('[data-hxx-review-type-filter]')?.value==='all'
    && !page.querySelector('[data-hxx-review-view]')
    && page.querySelectorAll('.hxx-review-work-item[data-review-task-type]').length===7
    && page.querySelectorAll('[data-hxx-review-work]').length===4
    && page.querySelectorAll('[data-hxx-evolution-candidate]').length===3
    && Boolean(page.querySelector('[data-hxx-review-search]'))
    && !page.textContent.includes('批量分配审核人')
    && !page.textContent.includes('配置权限')
    && !page.textContent.includes('处理失败')
    && medical?.querySelector('.hxx-review-work-detail')?.hidden===false
    && Boolean(document.querySelector('[data-hxx-action="approve-review"][data-knowledge-id="case-medical"]'));
})()`);
interactions.reviewCandidateSourcePreviewOpens = await evaluate(`(() => {
  document.querySelector('[data-hxx-review-candidate="medical-case"] [data-hxx-action="view-review-source"]')?.click();
  const valid=document.querySelector('#modalTitle')?.textContent.includes('原文预览 · 已定位')
    && Boolean(document.querySelector('[data-hxx-review-source-preview]'))
    && [...document.querySelectorAll('#modal input')].some(input=>input.value.includes('视频 00:18–02:46'));
  window.closeModal?.();
  return Boolean(valid);
})()`);
await wait(80);
await evaluate(`(() => {const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';})()`);
await screenshot('review-candidate');
interactions.reviewFuzzySearchFiltersSources = await evaluate(`(() => {
  const input=document.querySelector('[data-hxx-review-search]');
  if(input)input.value='直播带货';
  document.querySelector('[data-hxx-action="review-search"]')?.click();
  const filtered=[...document.querySelectorAll('[data-hxx-review-work]')];
  const matched=filtered.length===1
    && filtered[0].dataset.hxxReviewWork==='review-live-group'
    && document.querySelector('#hxxReviewPendingCount')?.textContent.includes('显示 1 项待处理');
  if(input)input.value='';
  document.querySelector('[data-hxx-action="review-search"]')?.click();
  return matched&&document.querySelectorAll('[data-hxx-review-work]').length===4;
})()`);
interactions.reviewCategoryDropdownSupportsMultiSelect = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="toggle-review-category-menu"]')?.click();
  const menu=document.querySelector('[data-hxx-review-category-menu]');
  const categories=['咨询问答 / 网络消费 / 直播电商','法律法规 / 地方政策 / 预付消费'];
  categories.forEach(value=>{const input=menu?.querySelector('[data-hxx-review-category="'+value+'"]');if(input){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}});
  const sources=[...document.querySelectorAll('[data-hxx-review-work]')].map(node=>node.dataset.hxxReviewWork);
  return menu?.hidden===false
    && document.querySelector('[data-hxx-review-category-trigger]')?.textContent.includes('已选 2 项')
    && sources.length===2
    && sources.includes('review-live-group')
    && sources.includes('review-prepay-rule');
})()`);
await wait(80);
await screenshot('review-filtered');
interactions.reviewFilterResetRestoresAllSources = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="review-filter-reset"]')?.click();
  return document.querySelectorAll('[data-hxx-review-work]').length===4
    && document.querySelector('[data-hxx-review-search]')?.value===''
    && document.querySelector('[data-hxx-review-category-trigger]')?.textContent.includes('全部分类')
    && [...document.querySelectorAll('[data-hxx-review-category]')].every(input=>!input.checked);
})()`);
interactions.reviewAdjustmentOpensEditor = await evaluate(`(() => {
  document.querySelector('[data-hxx-review-candidate="medical-case"] [data-hxx-action="adjust-review-candidate"]')?.click();
  const candidate=document.querySelector('[data-hxx-review-candidate="medical-case"]');
  const editor=document.querySelector('[data-hxx-review-editor="medical-case"]');
  return Boolean(editor)
    && ['category','scope'].every(field=>editor.querySelector('[data-hxx-review-field="'+field+'"]')?.tagName==='SELECT')
    && Boolean(editor.querySelector('[data-hxx-review-tag-editor]'))
    && editor.querySelectorAll('[data-hxx-review-tag]').length===2
    && !editor.textContent.includes('权限')
    && Boolean(candidate?.querySelector('[data-hxx-action="save-review-adjustment"]'))
    && Boolean(candidate?.querySelector('[data-hxx-action="cancel-review-adjustment"]'));
})()`);
await wait(80);
await screenshot('review-adjustment');
interactions.reviewAdjustmentSavesChanges = await evaluate(`(() => {
  const editor=document.querySelector('[data-hxx-review-editor="medical-case"]');
  const values={
    category:'典型案例 / 服务消费 / 医美纠纷',
    scope:'杭州地区 · 社会公众 · 脱敏后公开'
  };
  Object.entries(values).forEach(([field,value])=>{const input=editor?.querySelector('[data-hxx-review-field="'+field+'"]');if(input)input.value=value;});
  const tagInput=editor?.querySelector('[data-hxx-review-tag-input]');
  if(tagInput)tagInput.value='责任认定';
  editor?.querySelector('[data-hxx-action="add-review-tag"]')?.click();
  editor?.closest('[data-hxx-review-candidate]')?.querySelector('[data-hxx-action="save-review-adjustment"]')?.click();
  const candidate=document.querySelector('[data-hxx-review-candidate="medical-case"]');
  return !document.querySelector('[data-hxx-review-editor="medical-case"]')
    && Object.values(values).every(value=>candidate?.textContent.includes(value))
    && candidate?.textContent.includes('虚假宣传 · 医美消费 · 责任认定')
    && !candidate?.textContent.includes('审核员发布');
})()`);
interactions.reviewSourcesCollapseAndExpand = await evaluate(`(() => {
  const work=document.querySelector('[data-hxx-review-work="review-live-group"]');
  const toggle=work?.querySelector('[data-hxx-action="toggle-review-work"]');
  const startsAsProcess=toggle?.textContent==='处理';
  toggle?.click();
  const expanded=document.querySelector('[data-hxx-review-work="review-live-group"] .hxx-review-work-detail')?.hidden===false
    && document.querySelector('[data-hxx-review-candidate="live-group"]')?.textContent.includes('新建知识分组：直播购物与带货')
    && document.querySelector('[data-hxx-review-work="review-live-group"] [data-hxx-action="toggle-review-work"]')?.textContent==='收起';
  document.querySelector('[data-hxx-review-work="review-live-group"] [data-hxx-action="toggle-review-work"]')?.click();
  const collapsed=document.querySelector('[data-hxx-review-work="review-live-group"] .hxx-review-work-detail')?.hidden===true
    && document.querySelector('[data-hxx-review-work="review-live-group"] [data-hxx-action="toggle-review-work"]')?.textContent==='处理';
  return startsAsProcess&&expanded&&collapsed;
})()`);
interactions.reviewApprovalAddsQueryKnowledge = await evaluate(`(() => {
  const approval=document.querySelector('[data-hxx-action="approve-review"][data-knowledge-id="case-medical"]');
  approval?.click();
  const reviewWork=document.querySelector('[data-hxx-review-work="review-medical"]');
  const approved=reviewWork?.dataset.reviewStatus==='已通过'
    && document.querySelector('[data-hxx-review-candidate="medical-case"]')?.textContent.includes('已通过')
    && document.querySelector('#hxxReviewPendingCount')?.textContent.includes('显示 6 项待处理')
    && !document.querySelector('[data-hxx-action="approve-review"][data-knowledge-id="case-medical"]');
  window.hxxNavigate('knowledge');
  document.querySelector('[data-hxx-knowledge-view="query"]')?.click();
  document.querySelector('[data-hxx-action="knowledge-clear"]')?.click();
  const rows=[...document.querySelectorAll('[data-hxx-knowledge-result]')];
  return approved
    && Boolean(document.querySelector('[data-hxx-knowledge-result="case-medical"]'))
    && rows.length===7
    && rows.every(row=>row.textContent.includes('已发布'));
})()`);
await wait(80);
await screenshot('knowledge-approved');
await evaluate(`window.hxxNavigate('sources')`);
interactions.sourcePageOnlyShowsCollectionChannels = await evaluate(`(() => {
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='sources'
    && page.querySelectorAll('[data-hxx-source]').length===4
    && !page.querySelector('.hxx-kpis')
    && !page.querySelector('aside')
    && !page.textContent.includes('分权控制')
    && !page.textContent.includes('采集治理')
    && page.textContent.includes('采集渠道');
})()`);
interactions.addSourceOpensActionableDialog = await evaluate(`(() => {
  const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';
  document.querySelector('[data-hxx-action="add-source"]')?.click();
  const modal=document.querySelector('#modal');
  const valid=document.querySelector('#mask')?.classList.contains('show')
    && modal?.textContent.includes('添加采集渠道')
    && ['hxxSourceName','hxxSourceType','hxxSourceFrequency','hxxSourceUrl'].every(id=>Boolean(document.querySelector('#'+id)))
    && modal.textContent.includes('采集结果只进入候选队列');
  return Boolean(valid);
})()`);
await wait(80);
await screenshot('source-add');
await evaluate(`window.closeModal?.()`);
interactions.sourceCanBeDisabledAndEnabled = await evaluate(`(() => {
  const row=document.querySelector('[data-hxx-source="council-wechat"]');
  const toggle=row?.querySelector('[data-hxx-action="toggle-source"]');
  const sync=row?.querySelector('[data-hxx-action="sync-one"]');
  toggle?.click();
  const disabled=row?.dataset.sourceEnabled==='false'
    && row.classList.contains('is-disabled')
    && row.querySelector('[data-hxx-source-status]')?.textContent==='已停用'
    && sync?.disabled
    && toggle?.textContent==='启用'
    && document.querySelector('#hxxSourceStatus')?.textContent.includes('3 个渠道运行中');
  toggle?.click();
  const enabled=row?.dataset.sourceEnabled==='true'
    && !row.classList.contains('is-disabled')
    && row.querySelector('[data-hxx-source-status]')?.textContent==='运行中'
    && !sync?.disabled
    && toggle?.textContent==='停用'
    && document.querySelector('#hxxSourceStatus')?.textContent.includes('4 个渠道运行中');
  return disabled&&enabled;
})()`);
interactions.sourceSyncStarts = await evaluate(`(() => {document.querySelector('[data-hxx-action="sync-one"]')?.click();return document.querySelector('#hxxSourceStatus')?.textContent.includes('正在同步当前渠道')||false;})()`);
await wait(850);
interactions.sourceSyncCompletes = await evaluate(`document.querySelector('#hxxSourceStatus')?.textContent.includes('同步完成')&&Boolean(document.querySelector('[data-hxx-action="view-source-candidates"]'))`);
interactions.sourceCandidatesRouteToReview = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="view-source-candidates"]')?.click();
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='review'
    && document.querySelector('#ptitle')?.textContent==='知识审核'
    && page.querySelector('.hxx-review-origin')?.textContent.includes('本次采集批次')
    && document.querySelector('[data-hxx-review-search]')?.value==='采集渠道'
    && page.querySelectorAll('[data-hxx-review-work]').length===1;
})()`);
await evaluate(`document.querySelector('[data-hxx-action="clear-review-origin"]')?.click()`);

await evaluate(`window.hxxNavigate('review')`);
interactions.reviewPublishedStatePersists = await evaluate(`(() => {
  const work=document.querySelector('[data-hxx-review-work="review-medical"]');
  return work?.dataset.reviewStatus==='已通过'
    && document.querySelector('[data-hxx-review-candidate="medical-case"]')?.textContent.includes('已通过')
    && !document.querySelector('[data-hxx-action="approve-review"][data-knowledge-id="case-medical"]');
})()`);
interactions.reviewRejectionRequiresAndRecordsReason = await evaluate(`(() => {
  document.querySelector('[data-hxx-review-work="review-platform-entity"] [data-hxx-action="toggle-review-work"]')?.click();
  document.querySelector('[data-hxx-review-candidate="platform-entity"] [data-hxx-action="reject-review-candidate"]')?.click();
  const reason=document.querySelector('[data-hxx-review-candidate="platform-entity"] [data-hxx-reject-reason]');
  document.querySelector('[data-hxx-review-candidate="platform-entity"] [data-hxx-action="confirm-review-rejection"]')?.click();
  const blocked=Boolean(document.querySelector('[data-hxx-review-candidate="platform-entity"] [data-hxx-reject-reason]'));
  if(reason)reason.value='实体指代范围不一致，退回补充标准名称依据';
  document.querySelector('[data-hxx-review-candidate="platform-entity"] [data-hxx-action="confirm-review-rejection"]')?.click();
  const candidate=document.querySelector('[data-hxx-review-candidate="platform-entity"]');
  return blocked
    && candidate?.textContent.includes('已驳回')
    && candidate?.textContent.includes('驳回原因：实体指代范围不一致，退回补充标准名称依据')
    && !candidate?.querySelector('[data-hxx-reject-reason]');
})()`);
await wait(80);
await evaluate(`(() => {const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';})()`);
await screenshot('review-rejected');

interactions.reviewOptimizationViewOwnsDecisions = await evaluate(`(() => {
  const filter=document.querySelector('[data-hxx-review-type-filter]');if(filter){filter.value='optimization';filter.dispatchEvent(new Event('change',{bubbles:true}));}
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='review'
    && page.querySelector('[data-hxx-review-type-filter]')?.value==='optimization'
    && page.querySelectorAll('[data-hxx-evolution-candidate]').length===3
    && page.textContent.includes('优化建议')
    && Boolean(page.querySelector('[data-hxx-action="confirm-evolution-candidate"]'))
    && !page.querySelector('[data-hxx-review-work]');
})()`);
interactions.reviewOptimizationSourcePreviewOpens = await evaluate(`(() => {
  document.querySelector('[data-hxx-evolution-candidate="prepay-term"] [data-hxx-action="view-optimization-source"]')?.click();
  const valid=document.querySelector('#modal')?.textContent.includes('优化依据原文 · 已定位')&&Boolean(document.querySelector('[data-hxx-review-source-preview]'));
  window.closeModal?.();return Boolean(valid);
})()`);
interactions.reviewOptimizationDecisionWorks = await evaluate(`(() => {
  const suggestion=document.querySelector('[data-hxx-evolution-candidate="prepay-term"]');
  suggestion?.querySelector('[data-hxx-action="confirm-evolution-candidate"]')?.click();
  return document.querySelector('[data-hxx-review-type-filter]')?.value==='knowledge'
    && Boolean(document.querySelector('[data-hxx-review-work="optimization-version-prepay-term"]'))
    && document.querySelector('[data-hxx-review-work="optimization-version-prepay-term"]')?.textContent.includes('新版本候选');
})()`);
await wait(80);
await screenshot('review-optimization');

await evaluate(`window.hxxNavigate('graph')`);
interactions.graphDrilldown = await evaluate(`(() => {document.querySelector('[data-hxx-graph="七日无理由"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));return document.querySelector('#hxxGraphDetail')?.textContent.includes('七日无理由')||false;})()`);
interactions.graphCandidatesOpenReview = await evaluate(`(() => {
  const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';
  document.querySelector('[data-hxx-action="graph-candidates"]')?.click();
  const modal=document.querySelector('#modal');
  return document.querySelector('#mask')?.classList.contains('show')
    && modal?.textContent.includes('实体关系候选审核')
    && modal.querySelectorAll('[data-hxx-entity-candidate]').length===2
    && ['approve-entity','merge-entity','reject-entity'].every(action=>Boolean(modal.querySelector('[data-hxx-action="'+action+'"]')));
})()`);
await wait(80);
await screenshot('graph-candidates');
interactions.graphCandidateDecisionWorks = await evaluate(`(() => {
  const row=document.querySelector('[data-hxx-entity-candidate]');
  row?.querySelector('[data-hxx-action="approve-entity"]')?.click();
  const valid=row?.textContent.includes('已通过')
    && !row.querySelector('[data-hxx-action="approve-entity"]')
    && !row.querySelector('[data-hxx-action="merge-entity"]')
    && !row.querySelector('[data-hxx-action="reject-entity"]');
  window.closeModal?.();
  return Boolean(valid);
})()`);

await evaluate(`window.hxxNavigate('quality')`);
interactions.evolutionGovernanceMatchesAiHuoke = await evaluate(`(() => {
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='quality'
    && document.querySelector('#ptitle')?.textContent==='进化治理'
    && page.textContent.includes('受控自我学习')
    && ['知识可信度','内容质量与效果','学习价值','维护中心','治理规则','知识域维护状态'].every(text=>page.textContent.includes(text))
    && !page.textContent.includes('治理待办')
    && !page.querySelector('[data-hxx-governance-backlog-item]')
    && page.querySelectorAll('[data-hxx-maintenance-target]').length===4
    && page.textContent.includes('优化建议待处理')
    && !page.querySelector('[data-hxx-evolution-candidate]')
    && !page.querySelector('[data-hxx-action="confirm-evolution-candidate"]')
    && !page.querySelector('[data-hxx-action="reject-evolution-candidate"]')
    && !page.textContent.includes('知识运营周报');
})()`);
interactions.evolutionSummaryRoutesToOptimization = await evaluate(`(() => {
  document.querySelector('[data-hxx-action="route-review-optimization"]')?.click();
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='review'
    && page.querySelector('[data-hxx-review-type-filter]')?.value==='optimization'
    && page.querySelectorAll('[data-hxx-evolution-candidate]').length===2;
})()`);
await evaluate(`window.hxxNavigate('quality')`);
interactions.evolutionGovernanceRuleToggles = await evaluate(`(() => {
  const rule=document.querySelector('[data-hxx-evolution-rule]');
  rule?.click();
  const paused=rule?.dataset.enabled==='false'&&rule.textContent.includes('已暂停');
  rule?.click();
  return paused&&rule?.dataset.enabled==='true'&&rule.textContent.includes('已启用');
})()`);
interactions.maintenanceVersionConflictRoutesToKnowledgeReview = await evaluate(`(() => {
  document.querySelector('[data-hxx-maintenance-target="version-conflict"]')?.click();
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='review'
    && page.querySelector('[data-hxx-review-type-filter]')?.value==='knowledge'
    && page.textContent.includes('来自维护中心')
    && page.querySelectorAll('[data-hxx-review-work]').length===1
    && Boolean(page.querySelector('[data-hxx-review-work="review-prepay-rule"]'));
})()`);
await evaluate(`window.hxxNavigate('quality')`);
interactions.maintenanceKnowledgeGapRoutesToOptimization = await evaluate(`(() => {
  document.querySelector('[data-hxx-maintenance-target="knowledge-gap"]')?.click();
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='review'
    && page.querySelector('[data-hxx-review-type-filter]')?.value==='optimization'
    && page.textContent.includes('来自维护中心')
    && page.querySelectorAll('[data-hxx-evolution-candidate]').length===1
    && Boolean(page.querySelector('[data-hxx-evolution-candidate="minor-refund"]'));
})()`);
await evaluate(`window.hxxNavigate('quality')`);
interactions.maintenanceExpiringRoutesToKnowledgeReview = await evaluate(`(() => {
  document.querySelector('[data-hxx-maintenance-target="expiring"]')?.click();
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='review'
    && page.querySelector('[data-hxx-review-type-filter]')?.value==='knowledge'
    && page.textContent.includes('来自维护中心')
    && page.textContent.includes('即将到期')
    && page.querySelectorAll('[data-hxx-review-work]').length===1
    && Boolean(page.querySelector('[data-hxx-review-work="review-medical"]'));
})()`);
await evaluate(`window.hxxNavigate('quality')`);
interactions.maintenanceScopeMissingFocusesDomainMaintenance = await evaluate(`(() => {
  document.querySelector('[data-hxx-maintenance-target="scope-missing"]')?.click();
  const page=document.querySelector('.page.show');
  return page?.dataset.p==='quality'
    && page.textContent.includes('维护范围缺失')
    && Boolean(page.querySelector('#hxxDomainMaintenance.is-focus'));
})()`);
await wait(80);
await evaluate(`(() => {const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';})()`);
await screenshot('quality');

interactions.dashboardIsOperationsOverview = await evaluate(`(() => {
  window.hxxNavigate('dashboard');
  const page=document.querySelector('.page.show');
  const showcase=document.querySelector('#hxxLeadershipShowcase');
  const text=showcase?.textContent||'';
  const rail=document.querySelector('.rail');
  const top=document.querySelector('.top');
  const valid=document.body.classList.contains('hxx-dashboard-mode')
    && page?.dataset.p==='dashboard'
    && Boolean(showcase)
    && getComputedStyle(rail).display==='none'
    && getComputedStyle(top).display==='none'
    && ['杭州市消费者权益保护委员会','消费教育数字化运营大屏','杭小消智慧消费服务','知识资源概览','今日新增','服务触达','消费咨询热点','平台运行监测','平台可用率','系统运行稳定'].every(label=>text.includes(label))
    && !['项目成果','建设成果','近期建设成效','多模态知识中台','AI 内容生产','微官网传播矩阵','待审核','失败任务','剩余额度','导出','内部治理','全屏展示'].some(label=>text.includes(label))
    && showcase.querySelectorAll('[data-hxx-showcase-metric]').length===5
    && showcase.querySelectorAll('[data-hxx-showcase-resource]').length===5
    && !showcase.querySelector('[data-hxx-showcase-capability]')
    && Boolean(showcase.querySelector('[data-hxx-showcase-trend] svg'))
    && showcase.querySelectorAll('[data-hxx-showcase-hotspot]').length>=5;
  showcase?.querySelector('[data-hxx-action="exit-dashboard"]')?.click();
  const restored=document.querySelector('.page.show')?.dataset.p==='home'
    && !document.body.classList.contains('hxx-dashboard-mode')
    && getComputedStyle(rail).display!=='none'
    && getComputedStyle(top).display!=='none';
  if(!restored)window.hxxNavigate('home');
  return valid&&restored;
})()`);

await evaluate(`window.hxxNavigate('create')`);
interactions.marketingVideoReusesAiHuokeWorkspace = await evaluate(`document.querySelector('.page.show')?.dataset.p==='create'&&Boolean(document.querySelector('#createStepRibbon'))`);
interactions.marketingVideoCreationSettingsOpen = await evaluate(`(() => {document.querySelector('[data-act="new-create"]')?.click();return getComputedStyle(document.querySelector('#createForm')).display!=='none'&&Boolean(document.querySelector('#marketingVideoTitle'));})()`);
await wait(850);
await evaluate(`(() => {const toasts=document.querySelector('#toasts');if(toasts)toasts.innerHTML='';window.scrollTo(0,0);})()`);
await screenshot('marketing-video-create');

await evaluate(`window.hxxNavigate('system')`);
interactions.systemSettingsContainsOnlyApprovedSections = await evaluate(`(() => {const page=document.querySelector('.page.show'),text=page?.innerText||'';return page?.dataset.p==='system'&&['企业信息','企业名称','统一社会信用代码'].every(label=>text.includes(label))&&!['功能配置','已开通业务能力','站内通知','通知规则','流程配置','接口配置','安全配置','模型服务','多级审核','同人不可自审'].some(label=>text.includes(label));})()`);
interactions.systemSettingsSaveWorks = await evaluate(`(() => {document.querySelector('[data-hxx-action="save-settings"]')?.click();return document.querySelector('#toasts')?.textContent.includes('已保存')||false;})()`);

interactions.notificationCenterOpensAsAccountDrawer = await evaluate(`(() => {document.querySelector('[data-hxx-action="open-notification-center"]')?.click();const drawer=document.querySelector('#detailDrawer');return drawer?.classList.contains('show')&&document.querySelector('#drawerMask')?.classList.contains('show')&&!document.querySelector('#mask')?.classList.contains('show')&&document.querySelector('#drawerTitle')?.textContent==='通知中心'&&drawer.textContent.includes('当前账号')&&drawer.textContent.includes('无需单独配置')&&drawer.querySelectorAll('[data-hxx-notification]').length===3;})()`);
await wait(80);
await screenshot('notification-center');
interactions.notificationCanBeViewedAndMarkedRead = await evaluate(`(() => {const before=document.querySelector('.hxx-notification-center b')?.textContent;document.querySelector('[data-hxx-action="view-notification"][data-notification-id="notice-review"]')?.click();const item=document.querySelector('[data-hxx-notification="notice-review"]');return before==='3'&&document.querySelector('.hxx-notification-center b')?.textContent==='2'&&item?.textContent.includes('推送规则')&&item?.textContent.includes('拥有知识审核权限的账号');})()`);
interactions.notificationCanRouteToProcessingPage = await evaluate(`(() => {document.querySelector('[data-hxx-action="handle-notification"][data-notification-id="notice-review"]')?.click();return !document.querySelector('#detailDrawer')?.classList.contains('show')&&document.querySelector('.page.show')?.dataset.p==='review'&&document.querySelector('#ptitle')?.textContent==='知识审核';})()`);

await evaluate(`window.hxxNavigate('members')`);
interactions.saasMemberLifecycleWorks = await evaluate(`(() => {const page=document.querySelector('.page.show'),first=page?.querySelector('[data-hxx-member]'),before=first?.textContent||'';first?.querySelector('[data-hxx-action="toggle-member-status"]')?.click();const after=document.querySelector('[data-hxx-member]')?.textContent||'';return page?.dataset.p==='members'&&document.querySelector('#ptitle')?.textContent==='成员管理'&&page.textContent.includes('成员生命周期')&&!page.textContent.includes('角色权限矩阵')&&before!==after;})()`);
interactions.addMemberOpensActionableDialog = await evaluate(`(() => {document.querySelector('[data-hxx-action="add-member"]')?.click();return document.querySelector('#mask')?.classList.contains('show')&&document.querySelector('#modal')?.textContent.includes('新增成员');})()`);
interactions.memberDialogSupportsMultipleRolesAndUnion = await evaluate(`(() => {const checks=[...document.querySelectorAll('[data-hxx-member-role]')];const valid=checks.length===4&&document.querySelector('#modal')?.textContent.includes('可多选')&&document.querySelector('#modal')?.textContent.includes('并集');window.closeModal?.();const member=document.querySelector('[data-hxx-member="member-li"]');member?.querySelector('[data-hxx-action="edit-member-role"]')?.click();const selected=[...document.querySelectorAll('[data-hxx-member-role]:checked')].map(item=>item.value);const editValid=selected.length===2&&selected.includes('内容运营')&&selected.includes('观察员');return valid&&editValid;})()`);
await evaluate(`window.closeModal?.()`);

await evaluate(`window.hxxNavigate('permissions')`);
interactions.rolePermissionsLiveInPermissionManagement = await evaluate(`(() => {const page=document.querySelector('.page.show'),rows=[...page.querySelectorAll('[data-hxx-role]')];return page?.dataset.p==='permissions'&&document.querySelector('#ptitle')?.textContent==='权限管理'&&['角色列表','创建人','创建时间','操作'].every(label=>page.textContent.includes(label))&&rows.length===4&&rows.every(row=>['edit-role','copy-role','delete-role'].every(action=>row.querySelector('[data-hxx-action="'+action+'"]')))&&!page.querySelector('[data-hxx-action="save-role-permissions"]')&&!page.textContent.includes('角色权限矩阵');})()`);
interactions.roleEditShowsPermissionSetAndParentChildLinkage = await evaluate(`(() => {document.querySelector('[data-hxx-action="edit-role"][data-role-name="内容运营"]')?.click();const modal=document.querySelector('#modal'),knowledge=modal?.querySelector('[data-hxx-role-module][value="knowledge"]'),content=modal?.querySelector('[data-hxx-role-module][value="content"]'),sources=modal?.querySelector('[data-hxx-role-module][value="sources"]');const initial=modal?.textContent.includes('编辑角色')&&knowledge?.indeterminate===true&&content?.checked===true&&!sources?.checked;sources.checked=true;sources.dispatchEvent(new Event('change',{bubbles:true}));const sourceChildren=[...modal.querySelectorAll('[data-hxx-role-button][data-module="sources"]')],parentSelectsAll=sourceChildren.every(input=>input.checked);sourceChildren[0].checked=false;sourceChildren[0].dispatchEvent(new Event('change',{bubbles:true}));const partial=sources.indeterminate===true&&!sources.checked;window.closeModal?.();return initial&&parentSelectsAll&&partial;})()`);
interactions.createRoleSelectsFunctionsAndButtonPermissions = await evaluate(`(() => {document.querySelector('[data-hxx-action="create-role"]')?.click();const modal=document.querySelector('#modal'),name=document.querySelector('#hxxRoleName');if(name)name.value='法规复核员';for(const key of ['knowledge','review']){const module=modal?.querySelector('[data-hxx-role-module][value="'+key+'"]');if(module){module.checked=true;module.dispatchEvent(new Event('change',{bubbles:true}));}}const configured=modal?.querySelectorAll('[data-hxx-role-module]').length===6&&modal?.querySelectorAll('[data-hxx-role-button]').length===24&&[...modal.querySelectorAll('[data-hxx-role-button][data-module="knowledge"],[data-hxx-role-button][data-module="review"]')].every(input=>input.checked);modal?.querySelector('[data-mo]')?.click();const page=document.querySelector('.page.show'),role=page?.querySelector('[data-hxx-role="法规复核员"]');return configured&&Boolean(role)&&role.textContent.includes('企业大脑')&&role.textContent.includes('知识审核')&&role.textContent.includes('8 项按钮权限')&&page.querySelectorAll('[data-hxx-role]').length===5;})()`);
interactions.roleCopyAndDeleteOperationsWork = await evaluate(`(() => {document.querySelector('[data-hxx-action="copy-role"][data-role-name="法规复核员"]')?.click();const copied=document.querySelector('[data-hxx-role="法规复核员-副本"]');copied?.querySelector('[data-hxx-action="delete-role"]')?.click();const confirm=document.querySelector('#modal [data-mo]'),deleteDialog=document.querySelector('#modal')?.textContent.includes('确认删除')||document.querySelector('#modal')?.textContent.includes('删除后');confirm?.click();return Boolean(copied)&&deleteDialog&&!document.querySelector('[data-hxx-role="法规复核员-副本"]');})()`);
interactions.assignedRoleCannotBeDeleted = await evaluate(`(() => {document.querySelector('[data-hxx-action="delete-role"][data-role-name="内容运营"]')?.click();const blocked=document.querySelector('#modal')?.textContent.includes('已关联 1 个成员')&&document.querySelector('#modal')?.textContent.includes('先在成员管理中移除');window.closeModal?.();return blocked;})()`);
interactions.createdRoleAppearsInMemberRoleAssignment = await evaluate(`(() => {window.hxxNavigate('members');document.querySelector('[data-hxx-action="add-member"]')?.click();const option=[...document.querySelectorAll('[data-hxx-member-role]')].find(input=>input.value==='法规复核员');const valid=Boolean(option)&&document.querySelectorAll('[data-hxx-member-role]').length===5;window.closeModal?.();return valid;})()`);

await evaluate(`window.hxxNavigate('prompts')`);
interactions.promptCatalogUsesCapabilitiesAndModels = await evaluate(`(() => {const page=document.querySelector('.page.show'),rows=[...page.querySelectorAll('[data-hxx-prompt-row]')];return page?.dataset.p==='prompts'&&rows.length===21&&rows.every(row=>row.dataset.feature&&/(DeepSeek-V3|通义千问-Max)/.test(row.textContent))&&page.textContent.includes('已开通功能关联');})()`);
interactions.promptAuditCoversAllAiFlows = await evaluate(`(() => {const text=document.querySelector('.page.show')?.textContent||'';return ['知识自动分组 Prompt','适用范围识别 Prompt','知识冲突识别 Prompt','朋友圈图文创作 Prompt','海报内容生成 Prompt','PPT 页面内容生成 Prompt','内容合规检查 Prompt','获客计划生成 Prompt','爆款结构分析 Prompt','AI 混剪改写 Prompt'].every(name=>text.includes(name));})()`);
interactions.promptCapabilityFilterWorks = await evaluate(`(() => {const filter=document.querySelector('[data-hxx-prompt-filter]');if(!filter)return false;filter.value='search';filter.dispatchEvent(new Event('change',{bubbles:true}));const rows=[...document.querySelectorAll('[data-hxx-prompt-row]')];return rows.length===2&&rows.every(row=>row.dataset.feature==='search');})()`);
interactions.promptEditShowsCompletePromptContent = await evaluate(`(() => {document.querySelector('[data-hxx-prompt-row="prompt-correction"] [data-hxx-action="edit-prompt-model"]')?.click();const textarea=document.querySelector('[data-hxx-prompt-content]');const valid=document.querySelector('#mask')?.classList.contains('show')&&document.querySelector('#modal')?.textContent.includes('完整 Prompt 内容')&&textarea&&!textarea.disabled&&textarea.value.includes('音近字')&&textarea.value.includes('{{query}}');window.closeModal?.();return Boolean(valid);})()`);
interactions.readOnlyPromptShowsContentWithoutEditing = await evaluate(`(() => {document.querySelector('[data-hxx-prompt-row="prompt-query"] [data-hxx-action="edit-prompt-model"]')?.click();const textarea=document.querySelector('[data-hxx-prompt-content]');const valid=document.querySelector('#mask')?.classList.contains('show')&&textarea?.disabled&&textarea.value.includes('语义检索');window.closeModal?.();return Boolean(valid);})()`);
interactions.readOnlyPromptHidesMutationActions = await evaluate(`(() => {
  const readOnly=document.querySelector('[data-hxx-prompt-row="prompt-query"]');
  const editable=document.querySelector('[data-hxx-prompt-row="prompt-correction"]');
  return Boolean(readOnly&&editable)
    && !readOnly.querySelector('[data-hxx-action="publish-prompt"]')
    && !readOnly.querySelector('[data-hxx-action="rollback-prompt"]')
    && Boolean(editable.querySelector('[data-hxx-action="publish-prompt"]'))
    && Boolean(editable.querySelector('[data-hxx-action="rollback-prompt"]'));
})()`);

await evaluate(`window.hxxNavigate('usage')`);
interactions.readOnlyUsageHidesCapAction = await evaluate(`(() => {
  const operator=document.querySelector('[data-usage-member="operator"]');
  const readOnly=document.querySelector('[data-usage-member="readonly"]');
  return Boolean(operator?.querySelector('[data-hxx-action="set-cap"]'))
    && !readOnly?.querySelector('[data-hxx-action="set-cap"]')
    && readOnly?.textContent.includes('只读统计')
    && readOnly?.textContent.includes('只读状态')
    && document.querySelector('.page.show')?.textContent.includes('初始项目额度');
})()`);

await evaluate(`window.hxxNavigate('logs')`);
interactions.logAuditFilterWorks = await evaluate(`(() => {const page=document.querySelector('.page.show'),filter=page?.querySelector('[data-hxx-log-filter]');if(!filter)return false;filter.value='export';filter.dispatchEvent(new Event('change',{bubbles:true}));const rows=[...page.querySelectorAll('[data-hxx-log-row]')];return document.querySelector('#ptitle')?.textContent==='日志与审计'&&rows.length===1&&rows[0].textContent.includes('导出记录');})()`);

await evaluate(`window.hxxNavigate('bind')`);
interactions.platformAccountsReuseAiHuoke = await evaluate(`document.querySelector('.page.show')?.dataset.p==='bind'&&Boolean(document.querySelector('[data-od-id="bind-page"]'))&&document.querySelector('.page.show')?.textContent.includes('平台账号')`);
interactions.staticAgentPermissionsPageIsHidden = await evaluate(`!document.querySelector('.page[data-p="agent-center"]')&&!document.querySelector('[data-hxx-route="agent-center"]')`);

await evaluate(`window.hxxNavigate('quality')`);
await send('Page.reload', { ignoreCache: true });
await wait(900);
await evaluate(`new Promise((resolveReady,rejectReady)=>{let attempts=0;const timer=setInterval(()=>{if(typeof window.hxxNavigate==='function'&&document.body.classList.contains('hxx-admin')){clearInterval(timer);resolveReady(true);}else if(++attempts>50){clearInterval(timer);rejectReady(new Error('杭小消适配层刷新后未就绪'));}},100);})`);
interactions.qualityRefreshKeepsSingleHangxiaoxiaoPage = await evaluate(`(() => {
  const visible=[...document.querySelectorAll('.page.show')];
  const page=visible[0];
  return new URLSearchParams(location.search).get('review')==='quality'
    && visible.length===1
    && page?.dataset.p==='quality'
    && document.querySelector('#ptitle')?.textContent==='进化治理'
    && !page.textContent.includes('学习候选')
    && !page.textContent.includes('治理待办')
    && !document.querySelector('[data-kbpanel="evolution"]')
    && !document.querySelector('[data-kbpanel="governance"]');
})()`);

const report = {
  viewport: { width, height },
  routes: routeAudits,
  interactions,
  consoleErrors,
  uncaughtErrors,
};
writeFileSync(resolve(outDir, `audit-${suffix}.json`), `${JSON.stringify(report, null, 2)}\n`);
socket.close();

const routeMinimumContent={system:40};
const failedRoutes = routeAudits.filter(item => !item.correctPage || item.visibleCount !== 1 || item.contentLength < (routeMinimumContent[item.route]||80) || item.horizontalOverflow || item.outside.length);
const failedInteractions = Object.entries(interactions).filter(([, value]) => value !== true);
if (failedRoutes.length || failedInteractions.length || consoleErrors.length || uncaughtErrors.length) {
  console.error(JSON.stringify({ failedRoutes, failedInteractions, consoleErrors, uncaughtErrors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`杭小消后台浏览器验收 PASS：${suffix}，${routes.length} 个路由与 ${Object.keys(interactions).length} 项关键交互均通过`);
}
