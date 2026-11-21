<p align="center">
  <img src="assets/webagent-hero.png" alt="WebAgent 2.0" width="320" style="border-radius: 24px; box-shadow: 0 12px 36px rgba(0,0,0,0.15);" />
</p>

<h1 align="center">WebAgent 2.0</h1>

<p align="center">
  <b>下一代网页端大模型自动化 MCP 协同调度器与本地工程执行桥接扩展</b><br>
  <i>Next-Generation Web AI Automated MCP Orchestrator & Local System Bridge</i>
</p>

<p align="center">
  <a href="https://github.com/ysunyang4/webagent"><img src="https://img.shields.io/badge/Version-2.0.0-blue.svg?style=flat-square" alt="Version"></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/"><img src="https://img.shields.io/badge/Manifest-V3-success.svg?style=flat-square" alt="Manifest V3"></a>
  <a href="https://blog.ycu.de5.net/"><img src="https://img.shields.io/badge/Blog-Official%20Tutorial-10B981.svg?style=flat-square" alt="Tutorial"></a>
  <a href="https://t.me/ysun_webai"><img src="https://img.shields.io/badge/Telegram-@ysun__webai-0088cc.svg?style=flat-square" alt="Telegram"></a>
  <a href="https://github.com/ysunyang4/webagent"><img src="https://img.shields.io/badge/QQ%20Group-1131916140-1296DB.svg?style=flat-square" alt="QQ Group"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-orange.svg?style=flat-square" alt="License"></a>
</p>

---

## 📖 官方配置教程与社区直达

> [!TIP]
> 首次使用建议先阅读图文博客教程，了解如何配置本地工作区目录、专属 MCP 路径与技能库，开启网页端大模型全自动执行能力！

- 🌐 **官方图文教程与博客**：[https://blog.ycu.de5.net/](https://blog.ycu.de5.net/)
- ✈️ **Telegram 官方交流频道**：[https://t.me/ysun_webai](https://t.me/ysun_webai)
- 🐧 **QQ 官方技术交流群**：**1131916140**
- 🐙 **GitHub 开源仓库**：[https://github.com/ysunyang4/webagent](https://github.com/ysunyang4/webagent)
- 📧 **反馈与合作邮箱**：[ysunyang4@gmail.com](mailto:ysunyang4@gmail.com)

---

## 🌟 WebAgent 2.0 核心升级说明（相比 1.3.4）

WebAgent 2.0 是自发布以来最重大的全方位重构版本，全面解决了 Chrome 扩展报错、长任务中断、界面混杂和多语言体验等关键问题：

```
┌────────────────────────────────────────────────────────────────────────┐
│                             WebAgent 2.0                               │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ 3D 拟态品牌与极简抽屉  │  │ 双独立折叠控制面板 │  │ 设置中心全折叠卡片 │  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ 零报错弹性自愈引擎     │  │ 跨会话断点接力续传 │  │ 100% 四国语言纯净  │  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. 全新 3D 拟态品牌设计与极简主操作界面
- **3D 拟物品牌体系**：引入全新官方 3D 拟态标识与高清多尺寸应用图标（16px / 48px / 128px）。
- **主界面极致克制**：主操作抽屉移除非核心社媒外露，仅保留「⚙ 设置」、「🎨 主题」和「✕ 关闭」三个主控键，视觉专注无干扰。

### 2. Chrome 扩展零报错与四级弹性自愈引擎
- **彻底清洗平台代码块杂质**：在 DeepSeek、ChatGPT 等主流平台中，网页端经常在代码块前插入 `nexusCopyDownload` 等杂质前缀，2.0 引擎在解析前自动智能剥离。
- **四级容错自动修复**：
  1. 级别 1：原生 `JSON.parse` 校验；
  2. 级别 2：自动补全未闭合括号并清理尾部逗号；
  3. 级别 3：自动转义 Windows 孤立单反斜杠路径；
  4. 级别 4：针对复杂 PowerShell（如 `$b=@{jsonrpc='2.0'}`）与单双引号混用的字段级正则安全提取。
- **扩展管理面板 100% 绿色就绪**：报警日志全部规整降级为 `console.debug`，彻底消除了 Chrome 扩展管理页面的红色 "Errors" 报警。

### 3. Nexus 专属 MCP 与 Nexus 技能中心双独立折叠面板
- **架构解耦**：将主界面的专属 MCP 与技能库（Skills）分离为两个完全独立的折叠卡片。
- **本地服务路径绑定**：专属 MCP 路径与技能库路径各自独立配置，均配有专属红色垃圾桶 `🗑️` 一键清空按钮。
- **单项垃圾桶删除与独立滚动**：两套面板列表均支持垂直独立滚动（`max-height: 140px; overflow-y: auto;`），单行均配有行内删除按钮。

### 4. 设置中心全板块独立折叠化（Accordion Dropdowns）
设置中心全面告别长滚动，重构为 5 大独立下拉卡片：
- **卡片 0：官方博客教程与入门指南**（内置作者圆形头像与专属博客直达链接）；
- **卡片 1：基础语言与本地路径**（4 种语言一键切换，默认工作目录、专属 MCP 路径、Skill 库路径均带垃圾桶）；
- **卡片 2：执行与频控安全策略**（数据脱敏防外泄、自动拦截调用、安全润色保护模式、延迟缓冲滑块与频控上限滑块）；
- **卡片 3：扩展工具与高级选项**（已就绪工具列表、自定义系统规则提示词、Token 与端口设置）；
- **卡片 4：Developer & Community 社区矩阵**（集成 GitHub、Telegram 频道、QQ 官方交流群与联系邮箱）。

### 5. 100% 纯净四国语言国际化（零泄漏）
- 原生支持 **English (en-US)**、**简体中文 (zh-CN)**、**日本語 (ja-JP)**、**Deutsch (de-DE)**。
- 动态语言切换时，界面标题、按钮、占位符、Toast 提示以及注入模型的开发者 Prompt 协议 **100% 全量切换**，彻底杜绝外语模式下的中文残留。

### 6. 跨会话自愈与断点快照接力续传（Cross-Session Handover）
- 当长任务导致网页大模型提示“达到单次对话长度上限”时，插件自动捕获异常状态。
- 自动提取当前任务目标、工作区目录以及最近执行的步骤断点（`recentSteps`），自动点击「新建对话」并在新会话中回填结构化快照，实现长任务无缝接力。

---

## 🎮 支持的网页大模型平台矩阵（14+ 平台原生适配）

| 平台 | 适配网址 | 特性支持 |
| :--- | :--- | :--- |
| **DeepSeek** | `chat.deepseek.com` | 专属暗黑/浅色主题、思考链隔离、复制杂质清洗 |
| **ChatGPT** | `chatgpt.com` / `chat.openai.com` | ProseMirror 编辑器适配、多轮连续执行 |
| **Google Gemini** | `gemini.google.com` | Quill 富文本输入、多行重做、自动化调度 |
| **Google AI Studio** | `aistudio.google.com` | Chat Prompt / Freeform 运行、流式中断捕获 |
| **Kimi (月之暗面)** | `kimi.ai` / `kimi.moonshot.cn` | 自动新建会话、长文本自愈 |
| **通义千问 (Qwen)** | `chat.qwen.ai` / `tongyi.aliyun.com` | 专属主题、多轮工具自动回填 |
| **豆包 (Doubao)** | `doubao.com` | 对话输入适配、状态检测 |
| **Duck.ai** | `duck.ai` | 纯净极简界面原生支持 |
| **Z.ai (智谱)** | `zchat.z.ai` / `chat.z.ai` | 国际站原生适配与代码块解析 |
| **Perplexity** | `perplexity.ai` | 搜索增强模型工具联动 |
| **Microsoft Copilot** | `copilot.microsoft.com` | 企业与个人版网页端调度 |
| **当贝 AI** | `ai.dangbei.com` | 原生主题适配与状态追踪 |
| **Dola** | `dola.com` | 页面快照与连续调用 |

---

## 📦 快速安装与配置（5 分钟上手）

### 第一步：加载 Chrome 扩展
1. 下载或克隆本仓库到本地：
   ```bash
   git clone https://github.com/ysunyang4/webagent.git
   ```
2. 打开 Chromium 内核浏览器（Google Chrome、Edge、Brave 等），访问扩展程序管理页：
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. 开启右上角 **「开发者模式 (Developer Mode)」**。
4. 点击左上角 **「加载已解压的扩展程序 (Load unpacked)」**，选择本项目文件夹。

### 第二步：配置与开始使用
1. 打开任意支持的网页大模型（如 [DeepSeek](https://chat.deepseek.com/) 或 [ChatGPT](https://chatgpt.com/)）。
2. 页面顶部将自动浮现 **WebAgent 2.0 浮动控制药丸**。
3. 点击齿轮图标进入「设置中心」，根据 [官方博客教程](https://blog.ycu.de5.net/) 填入您的默认工作目录与 MCP 服务地址。
4. 点击 **「注入开发协作协议」**，网页端 AI 即可直接读取本地文件、运行终端命令并协同执行！

---

## 🛡️ 数据脱敏与安全策略

- **本地回环通信**：所有与本地 MCP / 终端的通信严格限制在 `127.0.0.1` 环回接口，不依赖任何第三方云端中转服务器。
- **数据脱敏保护**：内置敏感信息过滤器，自动在工具回填前脱敏 API Key、密码、密钥以及用户主目录绝对路径。
- **频控与熔断保护**：用户可自定义「回填延迟缓冲」（0.5s - 10s）与「连续调用上限」（1 - 50 步），彻底防止模型死循环消耗 Token。

---

## 🤝 社区交流与反馈

欢迎加入 WebAgent 开发者社区，提出功能建议或反馈问题：

- 🌐 **博客专栏**：[https://blog.ycu.de5.net/](https://blog.ycu.de5.net/)
- ✈️ **Telegram 官方频道**：[https://t.me/ysun_webai](https://t.me/ysun_webai)
- 🐧 **QQ 官方交流群**：**1131916140**
- 🐙 **GitHub Issues**：[https://github.com/ysunyang4/webagent/issues](https://github.com/ysunyang4/webagent/issues)

---

<p align="center">Made with ❤️ by <a href="https://github.com/ysunyang4">ysunyang4</a> & Open Source Contributors</p>
