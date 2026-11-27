<p align="center">
  <img src="assets/icon.png?v=2" width="112" alt="DSH Gemini Widget">
</p>

# DSH Gemini Widget · Gemini娘

DeepSeek Harness 界面里的一只 **Gemini娘**——表情随会话状态切换（待机、思考、
等你确认、回合结束），把上下文占用、Token、缓存命中率、账户余额和每轮花费
实时摊在你眼前。

**标准 DSH bundle 插件** —— `dsh plugin` 一键安装，零依赖、无外部服务、不需要任何令牌。

![额度气泡](docs/screenshot-stats.png)

---

## 截图

| | |
|---|---|
| ![额度气泡](docs/screenshot-stats.png)<br><sub>左键第一次：上下文 / Token / 缓存命中 / 余额</sub> | ![详情卡](docs/screenshot-card.png)<br><sub>右键：完整遥测详情卡</sub> |
| ![设置面板](docs/screenshot-settings.png)<br><sub>设置面板：尺寸、透明度、音效、开关、停靠</sub> | ![确认提醒](docs/screenshot-wait.png)<br><sub>有授权待批 / 提问待答时切 <code>wait</code> 差分</sub> |

> 截图取自仓库内的 [`docs/demo.html`](docs/demo.html) —— 它加载**真实的** `assets/neko-widget.js`，
> 只把宿主接口换成桩数据，所以是实际渲染结果而非效果图。

---

## 它能干什么

### 五帧表情，跟着你的会话状态动

| 状态 | 触发条件 | 差分 |
|---|---|---|
| 待机 `idle` | 没有活动 | 主立绘，柔和呼吸微动 |
| 思考 `eat` | 会话 running（正在生成） | 切换「吃大米」差分 |
| **确认 `wait`** | 有授权待批 / 有提问等你回答 | 鼓嘴 `><` 差分 + 提醒气泡 + 音效 |
| 戳一下 `xd` | 左键点她 | 差分 + Q 弹回弹 + 小黄鸭音效 |
| 彩蛋 `grin` | 一轮结束 / 连戳 3 下 | 呲牙笑差分 |

> **确认提醒是从事件拿的，不是扒 DOM。**
> 监听 `approval/asked` 与 `ask_user_question` 工具调用，比靠 `data-testid` 猜要稳得多。
> 提醒气泡琥珀色描边、**4 秒自动收起**，不挡你的确认按钮。

### 三段式左键气泡

1. **第一次点** → 额度气泡：上下文占用 / 本轮 Token / 缓存命中 / 余额 / 峰谷
2. **第二次点气泡** → 换一句 Gemini娘台词（内置 + 自定义，支持 `{ctx}` `{tokens}` `{cache}` `{balance}` 占位符）
3. **第三次点** → 收起

### 每轮结束自动播报

一轮对话结束 → 弹出本轮消耗（`¥0.0173`）与新增 Token，**10 秒自动关闭**。

### 输入框下方统计栏

```
3轮 · 7步 · 31.2 tok/s · 62.5K tok · 缓存 80% · 上下文 30% · ¥44.72
```

### 右键详情卡 & 设置面板

右键她 → 完整遥测卡（会话名 / 模型 / 轮次步数 / 上下文 / 累计 Token / 缓存命中 /
本会话花费 / 余额 / 峰谷），底部三个按钮：**刷新 · 设置 · 关闭**。

设置面板里能调：

- 📏 **挂件大小** 64–180px（滑块 + 数字框，缩放时吸附角不动、不会跳位）
- 👁 **透明度** 35–100%
- 🔊 **音效组**：**小黄鸭** / 叮咚，带**试听**，独立音量滑块
- ☑️ 统计栏 / 轮末播报 / 确认提醒气泡 / 提醒音效，四个独立开关
- 📍 四角快速停靠

---

## 安装

> 以下命令适用于 `dsh web` 与自定义 profile——命令里的 `web` 换成你的 profile 名即可。
> **官方桌面端**读 `desktop` profile、由应用自带的插件管理器接管，见下方专门一节。

### 从 npm 安装

```bash
dsh plugin --profile web add dsh-gemini-widget
```

### 从 GitHub 安装

```bash
dsh plugin --profile web add github:Applepinea/dsh-gemini-widget
```

或用 [Releases](https://github.com/Applepinea/dsh-gemini-widget/releases) 里的预构建包（免克隆源码）：

```bash
dsh plugin --profile web add https://github.com/Applepinea/dsh-gemini-widget/releases/download/v<版本>/dsh-gemini-widget-<版本>.tgz
```

### 插件市场

装了 [dsh-market](https://github.com/dsh-market/dsh-market) 的话，在 **插件 → 插件市场** 里搜
`dsh-gemini-widget` 直接一键安装。也可以用宿主自带的「索引源」：添加
`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`，然后在 **发现** 里搜。

### 官方桌面端（Electron）

桌面端读的是 **`desktop` profile**，而 `dsh plugin` 按设计拒绝操作它。请在本客户端的会话里直接说：

> 请使用当前桌面端内置的 `plugin_manager` 安装 `dsh-gemini-widget`。

装完**完全退出客户端（含系统托盘）再打开** —— 桌面端的注入表是宿主启动时一次性收集的。

### 本地开发

软链安装，源码改动即时生效（改前端刷新页面即可，改宿主半需重启 DSH）：

```bash
dsh plugin --profile web add link:<本目录绝对路径>
```

---

## 交互速查

| 操作 | 效果 |
|---|---|
| 左键点她 | 三段式气泡（额度 → 台词 → 收起） |
| 按住拖动 | 移动；松手自动吸附最近边，贴左自动镜像翻转 |
| 右键 | 打开遥测详情卡 |
| 点统计栏 | 等同左键点她 |

---

## 数据从哪来

全部**只读本机数据**，不联网取遥测：

| 数据 | 来源 |
|---|---|
| 上下文占用 / Token / 缓存命中 / 轮次 | `ctx.on('session/event')` 监听 `assistant/message`（真实 usage） |
| 上下文窗口容量 | `ctx.tokenMeter.contextPressure(session)`（可选服务，缺失则只显示绝对值） |
| 余额 | `GET https://api.deepseek.com/user/balance`（用 `DEEPSEEK_API_KEY`），或回退 DSH 账号服务 |
| 峰谷时段 | 本地按北京时间判定：工作日 9–12 / 14–18 为峰，其余含周末全天为谷 |

### 计费口径

金额按 **CNY / 百万 token**，`[谷价, 峰价]`：

| 模型 | 缓存命中 | 缓存未命中 | 输出 |
|---|---|---|---|
| `deepseek-flash` 系列 | 0.02 / 0.04 | 1 / 2 | 4 / 8 |
| `deepseek-v4-pro` | 0.15 / 0.30 | 4.5 / 9.0 | 13.5 / 27.0 |

⚠️ `reasoningTokens` **不单独累加** —— DSH 保证它 ⊆ `outputTokens`，重复计算会让输出侧翻倍。

### 余额取不到怎么办

两条路都试：**API key 优先**，失败后回退 **DSH 账号登录态**
（`ctx.get('deepseekAccount').getBalance()`）。两条都失败才显示 `—`，
并把两条路的原因都带在错误里。**没有 key 不算故障**，登录了账号也能读。

---

## ⚠️ 关于「余额不动但 Token 在涨」

这**不是 bug**。如果你用的是第三方中转（workbuddy / doubao / milionseek 之类），
模型名可能仍叫 `deepseek-v4.1-flash`，但**计费发生在中转那边，不走你的 DeepSeek 账户余额**。

于是会出现：余额恒定、Token 却在涨。这是两套口径：
- **余额** = DeepSeek 官方账户的钱（中转调用不动它）
- **Token 花费** = 按 DeepSeek 官方价目表估算的「如果走官方要花多少」

两者不可直接相减。本插件同时展示、**不做合并**。

---

## 文件落点

运行时数据都在 `$DSH_HOME`（默认 `~/.dsh`）：

| 文件 | 用途 |
|---|---|
| `gemini-widget/prefs.json` | 外观与开关（尺寸、透明度、音效组、音量、四角停靠） |
| `gemini-widget/balance-cache.json` | 最近一次成功的余额快照 |

配置文件损坏时会**改名备份后重建**（`.corrupt-<时间戳>.bak`），不会锁死功能。

---

## 开发

```bash
npm run check    # 发布前自检：清单 / 插件声明 / 文件 / 资源 / 前端约定 / 语法
npm test         # 单元 + UI 冒烟（极简 DOM 模拟层，不需要 DSH 宿主）
npm run release  # 一条命令发版：自检 → 测试 → 升版本 → 打包到 dist/
```

目录：

```text
dsh-gemini-widget/
├─ lib/index.js           宿主半：路由、遥测采集、余额、注入行
├─ assets/
│  ├─ neko-widget.js      客户端半：纯 DOM，无 React、无 require
│  └─ frames/*.webp       五帧立绘
├─ scripts/check.mjs      发布前自检
├─ scripts/release.mjs    发版脚本
├─ tests/                 测试（selftest / hosttest / uitest / ctxtest / audiotest）
└─ .github/workflows/     CI
```

- 改 **`assets/neko-widget.js`**（前端）→ 浏览器 `Ctrl+F5` 即可
- 改 **`lib/index.js`**（宿主）→ 需重启 DSH

### 为什么测试不用 `node --test`

`node --test` 会为每个测试文件 spawn 子进程；在任何禁止 spawn 的环境里
（受限 CI、沙箱）会直接 EPERM，测试还没跑就红了。这里用同进程顺序执行，
并且 `scripts/check.mjs` 的语法检查走 `vm.compileFunction` 而不是 `node --check`，
同样是为了不依赖子进程。

---

## 授权

代码以 **GNU AGPL-3.0-or-later** 发布，见 [LICENSE](./LICENSE)。

Gemini娘立绘素材来自 [antigravity-observer](https://github.com/yunjuanyunshu114-byte/antigravity-observer)（MIT），
**保留原授权**，详见 [NOTICE.md](./NOTICE.md)。
