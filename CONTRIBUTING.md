# 贡献指南

## 开发环境

- Node.js >= 18（CI 覆盖 22 / 24）
- 本插件**零运行时依赖**，不需要 `npm install`

## 提交前必须跑通

```bash
npm run check   # 清单 / 插件声明 / 文件 / 资源 / 前端约定 / 语法
npm test        # 单元 + UI 冒烟
```

两条都必须是绿的。CI 也会跑这两个命令。

## 代码约定

### 客户端（`assets/neko-widget.js`）

- **纯 DOM，不要用 React**，也不参与 web boot。
- **绝对不能出现 `require()`** —— 桌面端主窗是 `contextIsolation: true` + `sandbox: true`，
  客户端脚本里一出现 `require`，整个 boot 会失败、应用弹「无法启动」。
  要插样式就自建 `<style>` 挂到 `head`。
- 所有数据走 HTTP 路由，不碰 electron IPC。
- 任何初始化路径上的异常都要 `console.error`，**不要静默 `catch {}`** ——
  否则表现为「挂件活着但点不动」，极难排查。

### 宿主（`lib/index.js`）

- 注入行必须在 `apply()` **开头**注册：桌面端的注入表是宿主启动时一次性收集的，
  晚一步就永远进不了表（挂件完全不出现，且控制台不报错）。
- 可选服务用 `ctx.get('xxx')` 读，**不要写进 `inject`** —— 老宿主没有该服务时，
  写进 inject 会让整个插件永远等不到服务、完全不 apply。
- 所有路由必须挂信任栅栏（`connection.requestRejection` + 跨站拒绝），
  写接口额外限制本机来源。
- 金额用定点整数（×1e8），不要浮点。
- 配置文件读写走原子替换（临时文件 + rename），Windows 上重试 `EBUSY/EPERM/EACCES`；
  文件损坏时改名备份后重建，**不要抛错锁死**。

## 发版

```bash
npm run release         # 升 patch
npm run release minor   # 升 minor
npm run release -- --dry-run
```

版本号只在 `scripts/release.mjs` 里改，README 不写版本号。
