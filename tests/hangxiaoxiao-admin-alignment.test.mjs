import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (url) => existsSync(url) ? readFileSync(url, 'utf8') : '';
const html = read(new URL('../index.html', import.meta.url));
const js = read(new URL('../scripts/hangxiaoxiao-admin.js', import.meta.url));
const css = read(new URL('../assets/hangxiaoxiao-admin.css', import.meta.url));
const capture = read(new URL('../scripts/capture-hangxiaoxiao-admin.mjs', import.meta.url));
const pagePrd = read(new URL('../scripts/hangxiaoxiao-page-prd.js', import.meta.url));
const prdDoc = readFileSync(new URL('../docs/hangxiaoxiao-admin-page-prd.md', import.meta.url), 'utf8');
const sourcesPage = js.slice(js.indexOf('function sourcesPage'), js.indexOf('function reviewPage'));
const reviewPage = js.slice(js.indexOf('function reviewPage'), js.indexOf('function graphPage'));
const reviewCandidateRowSource = js.slice(js.indexOf('function reviewCandidateRow'), js.indexOf('function reviewWorkItem'));
const reviewWorkflowSource = js.slice(js.indexOf('const HXX_REVIEW_WORK_ITEMS'), js.indexOf('function graphPage'));
const qualityPageSource = js.slice(js.indexOf('function qualityPage'), js.indexOf('function trendPage'));
const operationPlanPageSource = html.slice(html.indexOf('<section class="page" data-p="plan">'), html.indexOf('<!-- TASKS AND APPROVALS -->'));

test('operation plan uses list, detail and draft-task confirmation states',()=>{
  for(const token of ['HXX_OPERATION_PLANS','operationPlanState','renderOperationPlan','data-hxx-plan-view="list"','data-hxx-plan-view="detail"','data-hxx-plan-view="task"','周计划','月计划','为什么生成','计划怎么做','是否确认','view-operation-plan','adjust-operation-task','save-operation-task','confirm-operation-plan','regenerate-operation-plan','plan_id + plan_version']) assert.ok((html+js).includes(token),`missing operation-plan state: ${token}`);
  assert.doesNotMatch(operationPlanPageSource,/confirm-plan|确认并下发 8 项任务|7\.22—7\.28/);
});

test('operation plan defines statuses, periods, idempotency and formal task semantics',()=>{
  for(const token of ['生成中','生成失败','待确认','执行中','已完成','已归档','Asia/Shanghai','weekDate','month','draftTaskId','formalTaskIds','plan.version','confirmationKey','拟任务','正式任务','重复确认不重复生成']) assert.match(js+pagePrd+prdDoc,new RegExp(token));
});

test('page and formal PRDs define auditable metric calculations',()=>{
  for(const token of ['计算逻辑','metric_version','Asia/Shanghai','分母为 0','正式知识','今日采集候选','待人工处理','知识调用','知识采集量','新增入库量','知识总量','公众服务次数','热点咨询','咨询分类占比','当前咨询在线人数','咨询时段分布','平台可用率','平均响应时长','智能问答响应率','运行渠道','知识来源渠道','多模态内容量','知识与服务增长趋势','知识引用准确率','TOP 5 咨询覆盖率','自然周','自然月','C端','近 5 分钟','首个有效应答片段','统计截止时间','执行进度','逾期任务数','热度指数','增长趋势','实体链接准确率','知识可信度','内容质量与效果','学习价值','知识域维护状态','共享总额度','已用量','冻结量','剩余额度','通知未读数','日志结果数','去重主键','刷新频率','下钻明细']) assert.match(pagePrd+prdDoc,new RegExp(token));
});

test('operation plan validates tasks, confirms atomically and supports regeneration',()=>{
  for(const token of [
    'operationPlanTaskView','validateOperationPlan','data-hxx-plan-errors',
    'data-hxx-plan-task-field="planDate"','type="date"','cancel-operation-task',
    "if(name==='regenerate-operation-plan')",'依据最新企业数据重新生成',
    '确认并生成任务','批量创建全部正式任务','data-hxx-formal-task-id',
    'plan_id + plan_version','重复确认不重复生成任务','不自动对外发布'
  ]) assert.ok((js+pagePrd+prdDoc).includes(token),`missing closed-loop plan behavior: ${token}`);
});

test('operation plan list exposes complete filtering and table semantics',()=>{
  for(const token of [
    'data-hxx-plan-filter="type"','data-hxx-plan-filter="weekDate"','data-hxx-plan-filter="month"',
    'data-hxx-plan-period-control','没有符合当前条件的运营计划',
    '计划类型','计划周期','核心目标','生成时间','任务数','执行进度','操作'
  ]) assert.match(js,new RegExp(token),`missing plan list behavior: ${token}`);
  assert.match(js,/route:'plan',label:'运营计划'/);
  assert.match(js,/plan:\['运营计划'/);
});

test('page PRD renderer injects page-specific calculation tables',()=>{
  for(const token of [
    'const CALCULATION_COLUMNS','const calculations=','const HXX_PAGE_CALCULATIONS=',
    'calculationRows','计算逻辑','定义与公式','纳入\/排除及去重','周期\/权限\/刷新','空值与下钻'
  ]) assert.match(pagePrd,new RegExp(token),`missing page calculation renderer: ${token}`);
  assert.doesNotMatch(pagePrd,/window\.HXX_PAGE_CALCULATIONS=/);
});

test('browser acceptance covers operation-plan filters, adjustment, confirmation and PRD',()=>{
  for(const token of [
    'operationPlanListAndPeriodFiltersWork','operationPlanDraftTaskAdjustmentClosesLoop',
    'operationPlanConfirmationIsAtomicAndIdempotent','operationPlanPrdContainsCalculations',
    "screenshot('plan-list')","screenshot('plan-detail')","screenshot('plan-task-detail')"
  ]) assert.ok(capture.includes(token),`missing browser operation-plan acceptance: ${token}`);
});
const logsPageSource = js.slice(js.indexOf('function logsPage'), js.indexOf('function membersPage'));
const membersPageSource = js.slice(js.indexOf('function membersPage'), js.indexOf('function permissionsPage'));
const permissionsPageSource = js.slice(js.indexOf('function permissionsPage'), js.indexOf('function promptsPage'));
const promptsPageSource = js.slice(js.indexOf('function promptsPage'), js.indexOf('function systemPage'));
const systemPageSource = js.slice(js.indexOf('function systemPage'), js.indexOf('function mountPages'));
const mountShellSource = js.slice(js.indexOf('function mountShell'), js.indexOf('function syncHxxNavigation'));
const loginOverrideSource = mountShellSource.slice(mountShellSource.indexOf('const login='), mountShellSource.indexOf('document.querySelectorAll'));
const materialPptSource = html.slice(html.indexOf('<div class="subview show" data-subview-panel="material-ppt"'), html.indexOf('<div class="subview" data-subview-panel="material-moments"'));

test('Hangxiaoxiao uses the shared AI Huoke login and tenant shell', () => {
  assert.match(html, /消费教育数字化平台 · 杭小消后台原型/);
  assert.match(html, /hangxiaoxiao-admin\.css/);
  assert.match(html, /hangxiaoxiao-admin\.js/);
  assert.match(js, /AI 获客/);
  assert.match(js, /杭小消知识运营平台/);
  assert.match(js, /杭小消专属租户/);
  assert.doesNotMatch(js, /杭小消独立实例/);
  assert.doesNotMatch(js, /杭小消独立登录/);
  assert.match(loginOverrideSource, /<b>AI 获客<\/b>/);
  assert.doesNotMatch(loginOverrideSource, /杭小消知识运营平台|让消费知识|杭小消 · 产品原型演示/);
  assert.match(js, /杭州市消费者权益保护委员会/);
  assert.match(js, /产品原型 · 演示数据/);
  assert.match(css, /--hxx-brand:/);
});

test('navigation covers the approved product scope without reopening the microsite', () => {
  for (const route of [
    'home', 'marketing-materials', 'acquisition', 'plan', 'burst', 'remix', 'create', 'avatar',
    'review', 'knowledge', 'graph', 'quality', 'sources',
    'dashboard', 'usage', 'logs', 'members', 'permissions', 'prompts', 'system'
  ]) assert.match(js, new RegExp(`route:\\s*'${route}'`), `missing route ${route}`);

  for (const group of ['工作台', '内容运营', '知识中台', '系统管理']) {
    assert.match(js, new RegExp(group));
  }
  assert.doesNotMatch(js, /group:'运营管理'/);
  for (const forbidden of ['在线购买', '立即续费', '平台账号绑定', '微官网管理']) {
    assert.doesNotMatch(js, new RegExp(forbidden));
  }
});

test('knowledge pages expose the approved governance rules', () => {
  for (const token of [
    '一个主分组', '三级分类', 'Prompt 生成标签', '适用范围',
    '默认关闭', '增量采集', '语义重复', '版本冲突',
    'AI 候选', '人工审核', '配置权限', '正式启用',
    '已发布版本不可覆盖', '草稿可删除', '下架或归档',
    '音近字', '形近字', '拼音串', '您是否想搜索',
    '图文混排', '视频卡片', '快捷按钮', '关联专题',
    '候选实体', '正式实体', '失效实体', '证据锚点',
    '未命中', '低置信度', '用户差评', '人工修正', '知识缺口'
  ]) assert.match(js, new RegExp(token), `missing knowledge rule: ${token}`);
});

test('data sources page only exposes collection channels and lifecycle actions', () => {
  for (const token of ['采集渠道', 'data-hxx-source', 'toggle-source', '停用', '启用']) {
    assert.match(sourcesPage, new RegExp(token), `missing source channel contract: ${token}`);
  }
  for (const forbidden of ['hxx-kpis', '分权控制', '采集治理', 'source-approval']) {
    assert.doesNotMatch(sourcesPage, new RegExp(forbidden), `sources page still exposes ${forbidden}`);
  }
  assert.doesNotMatch(js, /数据源分权确认/);
});

test('multimodal knowledge search exposes all approved filter dimensions', () => {
  for (const token of ['消费领域', '内容模态', '内容分类', '热点专题', 'data-hxx-knowledge-filter']) {
    assert.match(js, new RegExp(token), `missing multimodal search dimension: ${token}`);
  }
});

test('knowledge list opens on all formal knowledge without a category sidebar', () => {
  assert.doesNotMatch(js, /class="hxx-knowledge-tree"/);
  assert.doesNotMatch(js, /<b>知识域与分类<\/b>/);
  assert.match(js, /status==='已发布'/);
});

test('one knowledge menu provides permission-aware query and management views', () => {
  for (const token of [
    'data-hxx-knowledge-view="query"', 'data-hxx-knowledge-panel="query"',
    'data-hxx-knowledge-view="manage"', 'data-hxx-knowledge-panel="manage"',
    'data-hxx-permission="knowledge.manage"', '知识查询', '知识管理',
    'data-hxx-action="route-review"'
  ]) assert.match(js, new RegExp(token), `missing knowledge view contract: ${token}`);
  assert.doesNotMatch(js, /route:\s*'knowledge-(?:query|manage)'/);
});

test('Hangxiaoxiao keeps review tasks outside formal knowledge management', () => {
  for (const token of [
    'AI 自动分组',
    'data-hxx-management-group="全部正式知识"',
    'data-hxx-management-type="全部"',
    'data-hxx-action="route-review"',
    '待审核任务'
  ]) assert.match(js, new RegExp(token), `missing separated review structure: ${token}`);
  assert.doesNotMatch(js, /data-hxx-management-tab="work"/);
  assert.doesNotMatch(js, /data-hxx-managed-candidate/);
  assert.doesNotMatch(js, /hxx-managed-domain-card/);
});

test('knowledge review tasks retain source evidence inside the unified task list', () => {
  for (const token of [
    'HXX_REVIEW_WORK_ITEMS', 'deriveReviewWorkStatus', 'renderReviewWorkQueue',
    'data-hxx-review-work', 'data-hxx-review-candidate', 'toggle-review-work',
    'data-review-task-type="knowledge"', '待审核', '有冲突', '已通过',
    '来源定位', '驳回', '调整', '审核并发布'
  ]) assert.match(js, new RegExp(token), `missing source-led review contract: ${token}`);
  assert.doesNotMatch(reviewPage, /hxx-review-layout|hxx-review-item/);
  assert.doesNotMatch(reviewPage, /正在解析|处理失败|重试当前资料/);
  assert.doesNotMatch(reviewWorkflowSource, /待配置权限|需配置权限|配置权限并启用|permission:/);
});

test('review candidate adjustment uses structured category, tag and scope controls', () => {
  for (const token of [
    'data-hxx-review-editor', 'data-hxx-review-field',
    'save-review-adjustment', 'cancel-review-adjustment',
    'editingReviewCandidates', 'HXX_REVIEW_CATEGORY_OPTIONS', 'HXX_REVIEW_SCOPE_OPTIONS',
    'data-hxx-review-tag-editor', 'data-hxx-review-tag',
    'add-review-tag', 'remove-review-tag'
  ]) assert.match(js, new RegExp(token), `missing review adjustment contract: ${token}`);
  assert.doesNotMatch(reviewCandidateRowSource, /data-hxx-review-field="permission"|<em>权限<\/em>/);
});

test('review access provides searchable processing without reviewer assignment', () => {
  for (const token of [
    'reviewSearchQuery', 'filteredReviewWorkItems',
    'data-hxx-review-search', 'review-search', 'review-filter-reset',
    'reviewCategoryFilters', 'data-hxx-review-category-trigger',
    'data-hxx-review-category-menu', 'data-hxx-review-category',
    'toggle-review-category-menu', 'updateReviewFilterSummary',
    'rejectingReviewCandidates', 'data-hxx-reject-reason',
    'confirm-review-rejection', 'cancel-review-rejection'
  ]) assert.match(js, new RegExp(token), `missing review processing contract: ${token}`);
  assert.match(pagePrd + prdDoc, /拥有当前页面对应按钮权限即可处理|拥有页面及审核按钮权限即可处理/);
  assert.doesNotMatch(reviewPage, /批量分配审核人|assign-reviewer|查看处理/);
});

test('knowledge candidates and optimization suggestions share one filtered list', () => {
  for (const token of [
    "reviewTaskTypeFilter='all'", 'data-hxx-review-type-filter',
    'data-review-task-type="knowledge"', 'data-review-task-type="optimization"', '知识审核', '优化建议',
    'renderEvolutionCandidates', 'route-review-optimization',
    'data-hxx-evolution-candidate', 'confirm-evolution-candidate', 'reject-evolution-candidate',
    'view-review-source', 'view-optimization-source', 'data-hxx-review-source-preview',
    '新版本候选，仍需人工审核'
  ]) assert.match(js, new RegExp(token), `missing unified task entry contract: ${token}`);
  assert.match(pagePrd + prdDoc, /拥有当前页面对应按钮权限即可处理|拥有页面及审核按钮权限即可处理/);
  assert.doesNotMatch(reviewPage, /data-hxx-review-view|role="tablist"|reviewViewTabs/);
});

test('evolution and governance aligns with the AI Huoke controlled-learning workspace', () => {
  for (const token of [
    '进化治理', 'HXX_EVOLUTION_CANDIDATES', 'renderEvolutionCandidates',
    '知识可信度', '内容质量与效果', '学习价值', '受控自我学习',
    '优化建议待处理', '去处理', 'route-review-optimization',
    '维护中心', '治理规则', '知识域维护状态',
    'toggle-evolution-rule', '不得自动修改正式知识'
  ]) assert.match(js, new RegExp(token), `missing evolution governance contract: ${token}`);
  assert.doesNotMatch(qualityPageSource, /生成本周周报|知识运营周报|治理待办|hxxGovernanceBacklog|confirm-evolution-candidate|reject-evolution-candidate/);
});

test('maintenance center statistics are clickable routing entries', () => {
  for (const token of [
    "maintenanceCard\\('expiring'",
    "maintenanceCard\\('version-conflict'",
    "maintenanceCard\\('scope-missing'",
    "maintenanceCard\\('knowledge-gap'",
    'maintenance-filter', '来自维护中心', "target==='expiring'"
  ]) assert.match(js, new RegExp(token), `missing maintenance routing contract: ${token}`);
});

test('content navigation reuses the original AI Huoke workspaces instead of mounting replacements', () => {
  for (const token of [
    "'marketing-materials':'marketing-materials'", "acquisition:'acquisition'", "plan:'plan'", "burst:'burst'",
    "remix:'remix'", "create:'create'", "avatar:'avatar'", "subview:'material-ppt'", "subview:'material-wechat'"
  ]) assert.match(js, new RegExp(token), `missing reused content route: ${token}`);
  assert.doesNotMatch(js, /page\('aigc'|function aigcPage|HXX_TEMPLATES/);
  for (const token of [
    'data-p="marketing-materials"', 'data-subview-panel="material-ppt"', 'data-subview-panel="material-wechat"',
    'data-p="acquisition"', 'data-p="plan"', 'data-p="burst"', 'data-p="remix"',
    'data-p="create"', 'createStepRibbon', '1. 视频设置', '2. 封面、脚本与分镜确认',
    'marketingVideoTitle', 'createKnowledgeGate', 'marketingStoryboardList',
    'data-p="avatar"'
  ]) assert.match(html, new RegExp(token), `missing reused AI Huoke capability: ${token}`);
  for (const token of ['杭小消正式知识依据', '预付式消费付款前确认事项', '复用 AI 获客数字人能力']) {
    assert.match(js, new RegExp(token), `missing Hangxiaoxiao capability configuration: ${token}`);
  }
});

test('management pages expose button permissions, prompts, quota and logs', () => {
  for (const token of [
    '模块权限', '数据权限', '按钮权限', '只读', '可操作',
    '共享总额度', '子账号用量上限', '平台手动增加额度', '额度调整记录',
    '操作日志', '安全审计日志', '调用日志', '知识使用统计',
    '导出日志', '导出统计报表', '不支持知识内容批量导出',
    '标签生成 Prompt', '分类建议 Prompt', '结构化提取 Prompt', '搜索热词纠错 Prompt',
    '测试 Prompt', '发布版本', '回滚版本',
    '创建/分配角色', '成员生命周期', '角色模板', '已开通功能关联', '模型', '基础信息', '功能配置', '站内通知', '登录与安全日志', 'AI 调用日志', '知识使用日志', '导出记录'
  ]) assert.match(js, new RegExp(token), `missing management rule: ${token}`);
});

test('SaaS system management follows the approved seven-item contract', () => {
  const order = ['system','members','permissions','bind','prompts','usage','logs'];
  assert.match(js, new RegExp(order.map(route => `route:'${route}'`).join('[\\s\\S]*')));
  for (const [route, label] of [['system','系统设置'],['members','成员管理'],['permissions','权限管理'],['bind','平台账号'],['prompts','提示词管理'],['usage','用量管理'],['logs','日志与审计']]) {
    assert.match(js, new RegExp(`route:'${route}'[^}]*label:'${label}'`));
  }
  assert.doesNotMatch(js, /route:'agent-center'[^}]*label:'Agent 权限'/);
  for (const token of ['成员生命周期','角色模板','模块/数据/按钮权限','创建/分配角色','已开通功能关联','模型','测试 Prompt','发布版本','回滚版本','基础信息','功能配置','站内通知','登录与安全日志','AI 调用日志','知识使用日志','导出记录']) assert.match(js, new RegExp(token));
  for (const forbidden of ['RESTful 项目接口','接口配置','安全配置','多级审核','同人不可自审','独立模型配置','帮助与服务']) assert.doesNotMatch(js, new RegExp(forbidden));
});

test('tenant system settings only edits enterprise info while capabilities stay in the BOSS backend', () => {
  assert.match(systemPageSource, /<h3>企业信息<\/h3>/);
  for (const field of ['企业名称', '统一社会信用代码', '联系人', '联系手机']) {
    assert.match(systemPageSource, new RegExp(field), `missing enterprise field: ${field}`);
  }
  assert.match(systemPageSource, /data-hxx-setting="enterprise-name"/);
  assert.doesNotMatch(systemPageSource, /功能配置|已开通业务能力|data-hxx-setting="knowledge"|data-hxx-setting="content"|站内通知|通知规则|data-hxx-notification-rule|data-hxx-setting="notification"/);
  assert.match(mountShellSource, /data-hxx-action="open-notification-center"/);
  assert.match(js, /通知中心/);
  assert.match(js, /根据当前账号与权限自动接收/);
  for (const token of ['HXX_NOTIFICATION_RULES', '拥有知识审核权限的账号', '系统管理员账号', 'view-notification', 'handle-notification', 'detailDrawer', 'drawerMask']) {
    assert.match(js, new RegExp(token), `missing notification-center behavior: ${token}`);
  }
});

test('member management assigns roles while permission management configures role permissions', () => {
  for (const token of ['成员列表','成员生命周期','新增成员','分配角色','data-hxx-member','toggle-member-status','reset-member-password','roles:\\[','data-hxx-member-role','可多选','权限取','并集']) {
    assert.match(membersPageSource + js, new RegExp(token), `missing SaaS member behavior: ${token}`);
  }
  assert.doesNotMatch(membersPageSource, /角色管理|按钮级权限矩阵|创建角色/);
  for (const token of ['角色列表','创建人','创建时间','创建角色','模块权限','数据权限','按钮权限','HXX_ROLE_META','HXX_PERMISSION_MODULES','HXX_ROLE_GRANTS','rolePermissionBuilder','data-hxx-role-module','data-hxx-role-button','edit-role','copy-role','delete-role','indeterminate']) {
    assert.match(permissionsPageSource + js, new RegExp(token), `missing role permission behavior: ${token}`);
  }
  assert.doesNotMatch(permissionsPageSource, /角色权限矩阵/);
  assert.doesNotMatch(js, /save-role-permissions/);
  assert.doesNotMatch(membersPageSource, /单个账号允许覆盖|逐账号覆盖/);
});

test('prompt center renders enabled capability prompts with linked models', () => {
  for (const token of ['HXX_ENABLED_CAPABILITIES','HXX_PROMPT_CATALOG','HXX_PROMPT_CONTENT','featureKey','model','parameters','visibleToCurrentAccount','data-hxx-prompt-filter','data-hxx-prompt-search','data-hxx-prompt-row','edit-prompt-model','data-hxx-prompt-content']) {
    assert.match(js, new RegExp(token), `missing Prompt catalog behavior: ${token}`);
  }
  assert.match(promptsPageSource, /已开通功能关联/);
  assert.match(js, /完整 Prompt 内容/);
  assert.match(js, /HXX_PROMPT_CONTENT\[prompt\.id\]/);
  for (const promptName of ['知识自动分组 Prompt','适用范围识别 Prompt','知识冲突识别 Prompt','朋友圈图文创作 Prompt','海报内容生成 Prompt','PPT 页面内容生成 Prompt','内容合规检查 Prompt','获客计划生成 Prompt','爆款结构分析 Prompt','AI 混剪改写 Prompt']) {
    assert.match(js, new RegExp(promptName), `missing audited Prompt: ${promptName}`);
  }
  assert.doesNotMatch(promptsPageSource, /const prompts=\[\['标签生成 Prompt'/);
});

test('logs page exposes five filterable audit categories', () => {
  assert.match(logsPageSource, /lead\('日志与审计'/);
  for (const token of ['操作日志','登录与安全日志','AI 调用日志','知识使用日志','导出记录','data-hxx-log-filter','data-hxx-log-row','view-log-detail']) {
    assert.match(js, new RegExp(token), `missing log audit behavior: ${token}`);
  }
});

test('platform accounts reuse AI Huoke while the static Agent permissions page stays hidden', () => {
  assert.match(js, /bind:'bind'/);
  assert.doesNotMatch(js, /'agent-center':'agent-center'/);
  assert.doesNotMatch(js, /function bindPage\(|function agentCenterPage\(/);
  assert.doesNotMatch(js, /page\('bind'|page\('agent-center'/);
});

test('browser acceptance includes login and all seven system routes', () => {
  assert.match(capture, /'members',\s*'permissions',\s*'bind'/);
  assert.doesNotMatch(capture, /'agent-center'/);
  assert.match(capture, /screenshot\('login'\)/);
  assert.match(capture, /sharedLoginEntersHangxiaoxiaoTenant/);
});

test('Hangxiaoxiao admin is explicitly delivered and verified as PC-only', () => {
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*(?:560|720)px\)/);
  assert.match(capture, /minimumWidth\s*=\s*1024/);
  assert.match(capture, /仅验收 PC 端/);
  assert.doesNotMatch(capture, /mobileTargets|390x844/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(js, /role="status"/);
  assert.match(js, /role="alert"/);
  assert.match(js, /aria-disabled="true"/);
});

test('prototype closure exposes actionable knowledge, source and graph flows', () => {
  for (const action of ['upload-demo','add-source','view-source-candidates','query-source','query-feedback','managed-detail','managed-version','graph-candidates']) {
    assert.match(js, new RegExp(`if\\(name==='${action}'\\)`));
  }
  assert.doesNotMatch(js, /data-hxx-action="query-use"|name==='query-use'|引用到已开通功能/);
  assert.doesNotMatch(js, /if\(name==='new-knowledge'\)|data-hxx-action="new-knowledge"/);
  assert.match(js, /buttons:\['查看','上传资料','编辑','归档'\]/);
  assert.match(js, /上传知识','upload-demo'/);
  assert.match(js, /同步完成[^]*data-hxx-action=\"view-source-candidates\"/);
  assert.match(js, /\['approve-entity','merge-entity','reject-entity'\]\.includes\(name\)/);
  assert.match(js, /const readOnly=item\.scope\.includes\('只读'\)[\s\S]{0,500}readOnly\?'':/);
  assert.match(js, /data-usage-member="readonly"[\s\S]{0,300}只读状态/);
  assert.doesNotMatch(js, /data-usage-member="readonly"[\s\S]{0,300}set-cap/);
});

test('all Hangxiaoxiao pages expose field-level page PRDs', () => {
  assert.match(html, /scripts\/hangxiaoxiao-page-prd\.js/);
  assert.match(js, /hxx:routechange/);
  assert.match(pagePrd, /const HXX_PAGE_PRDS\s*=\s*\{\s*home:/);
  const pageKeys = ['home','dashboard','material-ppt','material-moments','material-poster','material-wechat','acquisition','plan','burst','remix','create','avatar','review','knowledge','graph','quality','sources','system','members','permissions','bind','prompts','usage','logs','notifications'];
  for (const key of pageKeys) assert.match(pagePrd, new RegExp(`key:'${key}'`), `missing explicit PRD config: ${key}`);
  assert.equal((pagePrd.match(/key:'/g) || []).length, 25);
  for (const token of ['页面级 PRD','Page Catalog','Page Requirements','字段','操作','状态','边界','Testing Decisions']) assert.match(prdDoc, new RegExp(token));
  assert.match(pagePrd, /prd\.tables\.map\(renderTable\)/);
  assert.match(pagePrd, /function pagePrdKey\(route,subview/);
  assert.match(pagePrd, /currentMaterialSubview/);
  assert.match(pagePrd, /data-act="switch-subview/);
  for (const token of [
    '页面 PRD', '页面概述', '页面级业务规则',
    '核心指标字段', '今日待办字段', '采集运行字段', '状态与跳转',
    '通知与日志', '异常与空状态', '页面验收标准', '治理边界提示',
    '公众号授权字段', '创建与大纲字段', '候选内容字段', '检索与结果字段',
    '维护中心与规则字段', '角色列表字段', '完整Prompt内容', '日志类型'
  ]) assert.match(pagePrd, new RegExp(token), `missing page PRD contract: ${token}`);
  assert.match(capture, /allPagePrdContextsAreVisible/);
  assert.match(capture, /allPagePrdDrawersOpenWithMatchingTitles/);
  assert.match(capture, /materialSubviewSwitchUpdatesPagePrd/);
  assert.match(capture, /workbenchPagePrdDrawerOpens/);
  assert.match(capture, /workbenchPagePrdClosesAndRestoresFocus/);
});

test('notification center has an independent PRD and PPT list has no summary statistics', () => {
  for (const token of ['通知类型与触发规则','通知字段','操作与结果','已读状态','处理状态','查看 PRD','返回通知中心']) {
    assert.match(pagePrd + prdDoc, new RegExp(token), `missing notification PRD contract: ${token}`);
  }
  assert.match(js, /open-notification-prd/);
  assert.match(js, /return-notification-center/);
  assert.match(capture, /notificationCenterPrdOpensAndReturns/);
  assert.doesNotMatch(materialPptSource, /workspace-summary|pptTotalCount|pptGeneratingCount|pptReadyCount|最新版本/);
  assert.match(materialPptSource, /pptArtifactList/);
  assert.doesNotMatch(html, /id="pptTotalCount"|id="pptGeneratingCount"|id="pptReadyCount"/);
});
