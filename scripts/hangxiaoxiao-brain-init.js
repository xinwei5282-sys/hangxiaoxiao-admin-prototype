/* 共享知识底座：补充流程与既有管理页面使用同一份原型状态。 */
(function () {
  'use strict';
  const bridge=window.HxxBrainBridge;
  if(!bridge)throw new Error('杭小消知识底座初始化失败');
  window.HxxKnowledgeFlows.init(bridge);
  window.HxxServiceFlows.init(bridge);
})();
