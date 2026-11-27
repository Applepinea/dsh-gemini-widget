# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 未发布

- 文案：角色名统一为 **Gemini娘**，移除「观察窗 / 观察台」措辞
- README 安装改为按来源分节：npm / GitHub（源码与 Release 包）/ 插件市场 / 桌面端 / 本地开发

- 新增：市场卡片图标 `assets/icon.png`（256×256 PNG，白底）
- 新增：`docs/` 界面截图与可复现的预览页 `docs/demo.html`
- 新增：上架材料清单 `docs/MARKET.md` 与条目草稿 `docs/market-entry.yml`
- 新增：`scripts/check.mjs` 校验 `icon` 存在且为位图、`docs` 不进发布包
- 修复：每轮结束提示音独立开关（此前后与按压音效共用一个开关）

## 0.1.1

- 修复：上下文百分比恒为 0（窗口容量未从 tokenMeter 传入时未回退到估算）
- 修复：浏览器自动播放策略下按压音效不出声（首次交互时 resume 音频上下文）

## 0.1.0

首个版本。

- 五帧表情联动：`idle` / `eat` / `wait` / `xd` / `grin`
- 确认提醒走 `approval/asked` 与 `ask_user_question` 事件，不依赖 DOM 探针
- 三段式左键气泡：额度 → 台词 → 收起
- 每轮结束自动播报消耗，10 秒自动关闭
- 输入框下方统计栏：轮次 / 步数 / tok-per-sec / Token / 缓存 / 上下文 / 余额
- 右键遥测详情卡 + 设置面板
- 设置面板：尺寸 64–180px、透明度、音效组（小黄鸭 / 叮咚）、音量、四个开关、四角停靠
- 音效全部 Web Audio 现场合成，无音频素材
- 余额双路径：`DEEPSEEK_API_KEY` 优先，失败回退 DSH 账号服务
- 计费按峰谷与模型分档，`reasoningTokens` 不重复累加
