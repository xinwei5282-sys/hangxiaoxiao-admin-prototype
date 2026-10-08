# 杭小消 · 消保委后台原型

消保委企业大脑、多模态知识库及运营后台的 PC 交互原型。采集、AI、审核及数据均为演示，不代表已接入生产系统。

- 企业大脑预览：https://xinwei5282-sys.github.io/hangxiaoxiao-admin-prototype/?review=knowledge
- 运营工作台：同一地址使用 `?review=home`
- 页面真源：`index.html`
- 杭小消适配层：`scripts/hangxiaoxiao-admin.js`、`assets/hangxiaoxiao-admin.css`
- 页面说明：`scripts/hangxiaoxiao-page-prd.js`
- PRD 发布快照：`docs/hangxiaoxiao-admin-page-prd.md`，用于仓库独立运行测试；需求变更时从项目正式 PRD 同步更新。

## 发布

推送到 `main` 后，GitHub Actions 执行原型检查、生成 `_site/` 并部署 GitHub Pages。发布目录仅包含页面、静态资源及浏览器脚本。

本地生成发布文件：

```sh
node scripts/build-pages.mjs
```

本地验证：

```sh
node --test tests/hangxiaoxiao-admin-alignment.test.mjs tests/consumer-protection-knowledge.test.mjs tests/commercial-workflows.test.mjs tests/remotion-video-workflow.test.mjs
```

## 上传审核规则（2026-09-23）

用户上传资料检查无异常后默认通过并自动进入企业大脑；异常转人工审核，检查未完成不发布。上传弹窗的演示设置可切换检查结果，记录仅保存在当前页面内存中，不代表真实解析或生产入库。采集、优化建议与图谱保持原人工审核流程。


### 企业大脑补充流程（2026-10-08）

- 企业大脑 / 知识查询：各类标签默认展示相关性最高的 30 个；“调整展示”支持人工增减与恢复推荐，知识标签支持 AND/OR，排序保留筛选。
- 企业大脑 / 知识管理：修订→草稿→提交→知识审核→新版本；下架移入归档，恢复重新审核，版本弹窗保留实际历史快照。
- 知识审核：版本冲突对比证据与影响，保留旧版 / 采用新版 / 按范围拆分。
- 进化治理：多模态问答测试、引用与富媒体卡片、预期知识用例及复验；相关性优先，同等相关优先最新有效知识。
- 营销视频、营销物料：独立素材候选回库，绑定来源知识版本与版权，人工审核后才进入查询。
- 数据采集：批次明细、失败项重试、审核联动及按实际发布计算的周更新。
- 日志与审计：示例多轮咨询、用户及反馈筛选、带引用版本的完整问答 CSV。

增强脚本通过 `HxxBrainBridge` 共享原型状态。全部数据仅在当前会话内存中，刷新重置；未接入生产模型、OCR、采集或素材服务。正式 PRD 与发布目录文档保持同步，交付前执行 `node scripts/verify-prototype.mjs --full`。
