# 上架材料 · dsh-market

本文件是**提交前的工作清单**，不是提交内容。市场收录的唯一提交物是
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
仓库里的一个 YAML 文件。

---

## 一、提交到哪

dsh-market 自己**不含插件目录**。它的列表实时读取
[`awesome-dsh-plugin.com/plugins.json`](https://awesome-dsh-plugin.com/plugins.json)，
而那份数据由 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
仓库的 `data/plugins/*.yml` 生成。

所以：**去 awesome-dsh-plugin 提 PR，不要往 dsh-market 提。**

合并后站点与市场通常一天内生效，不需要发版。

---

## 二、提交物：一个文件

路径：`data/plugins/Applepinea__dsh-gemini-widget.yml`

内容（就是本目录下的 [`market-entry.yml`](./market-entry.yml) 去掉注释）：

```yaml
url: https://github.com/Applepinea/dsh-gemini-widget
name: Applepinea/dsh-gemini-widget
category: ui
description:
  en: 'A catgirl observer in the lower-right corner of DSH showing context usage, tokens, cache hit rate, balance and per-turn cost, with five expression frames, confirmation alerts and an adjustable settings panel.'
  zh: 'DSH 右下角的猫娘观察窗，显示上下文占用、Token、缓存命中率、余额与每轮花费，带五帧表情联动、确认提醒与可调设置面板。'
icon: https://raw.githubusercontent.com/Applepinea/dsh-gemini-widget/main/assets/icon.png
```

**只提交这一个文件。** 两个 README 由脚本从 `data/plugins/` 生成，
不要手工编辑，也不要为了预览去改它们。

`description.en` 含 `: `（冒号加空格）**必须加引号**，否则 YAML 当成嵌套键解析失败。
上面已经加好了。

---

## 三、硬性门槛（逐条核对）

| 要求 | 状态 | 说明 |
|---|---|---|
| `package.json` 声明 `dsh.bundle` | ✅ | `dsh.bundle.patch: "./cordis.patch.yml"` |
| 根目录有 `cordis.patch.yml` 且 `insert` 的 id/name 与包名一致 | ✅ | `scripts/check.mjs` 已自动校验 |
| 仓库有真实可用的代码 | ✅ | 宿主半 28 KB + 前端 42 KB，含 7 个测试文件 |
| 仓库创建满 **1 天** | ⚠️ **未达标** | 建于 2026-11-27 12:24 UTC，需等到 **11-28 12:24 UTC** |
| 仓库带 `dsh-plugin` topic | ✅ | 已设置 |
| 描述属实、不夸大 | ✅ | 未写任何数字或营销词，逐条对应代码 |
| `icon` 是 GitHub 图床位图 | ✅ | `assets/icon.png`，256×256 PNG（RGBA，已抠透明底） |

---

## 四、材料清单

| 材料 | 位置 | 用途 |
|---|---|---|
| 图标 256×256 PNG | `assets/icon.png` | 市场卡片图（YAML 的 `icon` 字段） |
| 界面截图 ×4 | `docs/screenshot-*.png` | README 展示；市场打开安装弹窗时从 README 自动抽取 |
| 预览页 | `docs/demo.html` | 截图来源，加载真实 `neko-widget.js`，可随时重拍 |
| YAML 草稿 | `docs/market-entry.yml` | 提 PR 的内容 |
| 授权说明 | `NOTICE.md` | 立绘来自 antigravity-observer(MIT)，本项目 AGPL |

截图不是 P 图：`demo.html` 加载的就是插件本体，只把 `/dsh-gemini-widget/state`
换成桩数据。复现命令见 README。

---

## 五、提交步骤

1. **等仓库满 1 天**（CI 自动检查，不满足必红）
2. Fork `awesome-dsh-plugin/awesome-dsh-plugin`
3. 新建 `data/plugins/Applepinea__dsh-gemini-widget.yml`，内容见上
4. 本地自查（可选，但它跑的就是 CI 那套校验）：
   ```sh
   npm ci && node scripts/generate-readme.mjs
   ```
5. 提 PR，标题例：`Add dsh-gemini-widget: catgirl telemetry observer for DSH`
6. 维护者会实际阅读仓库，核对描述与代码是否一致

---

## 六、评审会看什么（提前对齐）

官方 `contributing.md` 明确列了六条，逐条对照本插件：

1. **代码是否与条目声明一致** —— 描述里没有数字，没有命令名，不构成夸大风险
2. **分类是否合理** —— 归 `ui`（界面增强），与 `dsh-gemini-kitten-widget`、
   `dsh-context` 同类
3. **是否真实可用的代码** —— 不是占位仓库
4. **是否已被现有条目覆盖** —— ⚠️ 存在近似条目
   [`dsh-gemini-kitten-widget`](https://github.com/Void-LifeStream/dsh-gemini-kitten-widget)，
   但它只显示 **Gemini API 免费额度**；本插件显示 **DSH 会话遥测 + DeepSeek 账户余额**，
   数据源与功能都不同。PR 描述里应写明这一点，避免被判重复
5. **源码有无可疑之处** —— 无混淆、无凭据外传；网络请求只有
   `api.deepseek.com/user/balance` 一处，且只发用户自己配置的 key
6. **PR 是否动了不该动的条目** —— 只加自己那一个文件

---

## 七、可选加强项（非必需）

- **预构建 tarball**：已在 Releases 提供 `dsh-gemini-widget-0.1.3.tgz`。
  本插件能从源码直接装（无构建脚本），所以 `tarball` 字段不是必需的；
  若维护者要求，可加：
  ```yaml
  tarball: https://github.com/Applepinea/dsh-gemini-widget/releases/download/v0.1.3/dsh-gemini-widget-0.1.3.tgz
  ```
- **npm 发布**：发布后市场可直接按包名安装与检测更新。当前未发布，
  入口仍是 `github:` 形式，功能不受影响。

---

## 八、注意

收录 ≠ 安全审查。列表本身也这么写。本插件读取本机会话数据与用户自配的
DeepSeek API key（仅发往 `api.deepseek.com`），README 与 NOTICE 里都写清楚了。
