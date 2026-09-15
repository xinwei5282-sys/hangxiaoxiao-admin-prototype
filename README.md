# 杭小消 · 消保委后台原型

消保委企业大脑、多模态知识库及运营后台的 PC 交互原型。采集、AI、审核及数据均为演示，不代表已接入生产系统。

- 企业大脑预览：https://xinwei5282-sys.github.io/hangxiaoxiao-admin-prototype/?review=knowledge
- 运营工作台：同一地址使用 `?review=home`
- 页面真源：`index.html`
- 杭小消适配层：`scripts/hangxiaoxiao-admin.js`、`assets/hangxiaoxiao-admin.css`
- 页面说明：`scripts/hangxiaoxiao-page-prd.js`

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
