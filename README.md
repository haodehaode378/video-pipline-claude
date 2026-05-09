# AI-Video — 全自动短视频生成流水线

<p align="center">
  <strong>输入主题 → 输出成片 | 7步自动化流水线 | 支持多模型 | 实时进度推送</strong>
</p>

<p align="center">
  <a href="https://github.com/haodehaode378/video-pipeline/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-green.svg" alt="Node">
  <img src="https://img.shields.io/badge/python-%3E%3D3.8-green.svg" alt="Python">
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> •
  <a href="#流水线架构">架构</a> •
  <a href="#api-端点">API</a> •
  <a href="#环境变量">配置</a> •
  <a href="#目录结构">目录</a>
</p>

---

## ✨ 特性

- **7 步全自动流水线** — 脚本生成 → 代码生成 → 截图 → 视频渲染 → 旁白 → TTS → 合成
- **多模型兼容** — 支持 OpenAI / Kimi / DeepSeek / 千问 / Claude 等任意 OpenAI 兼容 API
- **实时进度** — WebSocket 推送每一步状态，前端实时更新
- **分步重试** — 任意步骤失败可从断点重跑，不用从头来
- **批量生成** — 一次提交多个主题，自动排队处理
- **风格可配** — 配色、字体、动画、TTS 风格均可自定义
- **Web 管理台** — React 前端，可视化管理所有剧集

## 📦 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + Tailwind CSS |
| 后端 | Node.js + Express |
| AI | OpenAI 兼容 API |
| 渲染 | Puppeteer + ffmpeg |
| TTS | MiniMax API |
| 实时推送 | WebSocket (ws) |

## 🚀 快速开始

### 1. 安装依赖

```bash
cd webapp
npm install
```

### 2. 配置环境变量

```bash
cp config/env.example .env
```

编辑 `.env`：

```env
OPENAI_API_KEY=sk-xxx                        # API 密钥（必需）
OPENAI_BASE_URL=https://api.openai.com/v1    # 支持 Moonshot/DeepSeek/千问等
OPENAI_MODEL=gpt-4o                          # 模型名（如 kimi-k2.5、deepseek-chat）
MINIMAX_API_KEY=xxx                           # MiniMax TTS 密钥
MINIMAX_BASE_URL=https://api.minimaxi.com
PORT=3000
AUTO_CONFIRM=false                            # true=全自动，false=人工审核
RENDER_FPS=30                                 # 渲染帧率
```

### 3. 启动

```bash
npm run dev    # 启动前端 (localhost:5173) + 后端 (localhost:3000)
```

或分别启动：

```bash
npm run server   # 仅后端
npm run dev      # 仅前端
```

## 🏗️ 流水线架构

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Step 1   │───▶│ Step 2   │───▶│ Step 3   │──┐
│ AI脚本   │    │ AI代码   │    │ 自动截图 │  │
└──────────┘    └──────────┘    └──────────┘  │
                                              ▼
┌──────────┐    ┌──────────┐    ┌──────────┐  ┌──────────┐
│ Step 7   │◀───│ Step 6   │◀───│ Step 5   │◀─│ Step 4   │
│ 最终合成 │    │ TTS配音  │    │ 旁白生成 │  │ 视频渲染 │
└──────────┘    └──────────┘    └──────────┘  └──────────┘
```

Step 3（截图）和 Step 4（视频渲染）**并行执行**，节省时间。

## 📡 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/episodes` | 创建新集，触发流水线 |
| `GET` | `/api/episodes` | 列出所有集 |
| `GET` | `/api/episodes/:slug` | 单集状态和产物 |
| `POST` | `/api/episodes/:slug/retry` | 重试（可指定从哪步开始） |
| `PUT` | `/api/episodes/:slug/script` | 编辑脚本 |
| `PUT` | `/api/episodes/:slug/code` | 编辑 HTML/CSS/JS |
| `GET` | `/api/episodes/:slug/download` | 下载视频 |
| `GET` | `/api/episodes/logs` | 服务端日志 |
| `GET` | `/api/episodes/style-config` | 获取风格配置 |
| `PUT` | `/api/episodes/style-config` | 保存风格配置 |
| `WS` | `/ws` | 实时进度推送 |

## 📂 目录结构

```
webapp/
├── server/              # Express 后端
│   ├── ai/              # API 封装 + 提示词模板
│   ├── pipeline/        # 7 步流水线
│   ├── media/           # ffmpeg + TTS
│   ├── routes/          # API 路由
│   └── utils/           # 文件读写 + 日志
├── src/                 # React 前端
│   ├── pages/           # 4 个页面（Dashboard / 创建 / 详情 / 风格配置）
│   ├── components/      # 公共组件
│   └── hooks/           # WebSocket + 状态管理
├── data/                # 运行时数据
├── config/              # 环境变量模板
└── videos/              # 视频输出目录
```

## 📋 页面说明

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | Dashboard | 剧集卡片网格 + 缩略图 + 状态标签 |
| `/create` | CreateEpisode | 单个/批量创建剧集 |
| `/episode/:slug` | EpisodeDetail | 实时进度 + 脚本编辑 + 代码编辑 + 视频播放 |
| `/style-config` | StyleConfig | 配色/字体/动画/TTS 风格管理 |

## ✅ 开发进度

- [x] Phase 1 — 前端框架
- [x] Phase 2 — 后端 API + AI 脚本/代码生成
- [x] Phase 3 — 自动截图 + 视频渲染
- [x] Phase 4 — 旁白 + TTS + 合成
- [x] Phase 5 — 前端实时进度 + 编辑 + WebSocket
- [x] Phase 6 — 分步重试 + 日志 + 批量生成 + 风格配置

## 🤝 贡献

欢迎 Issue 和 PR！

## 📄 License

MIT
