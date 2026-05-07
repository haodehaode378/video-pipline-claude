# AI-Video — 全自动微课视频生成流水线

输入主题 → AI 生成脚本 → AI 生成 HTML/CSS/JS → 自动截图 → 渲染 MP4 → TTS 配音 → 成片输出。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + Tailwind CSS |
| 后端 | Node.js + Express |
| AI | OpenAI 兼容 API（支持 Kimi / 千问 / DeepSeek / Claude 等） |
| 渲染 | Puppeteer + ffmpeg |
| TTS | MiniMax API |
| 实时推送 | WebSocket (ws) |

## 快速开始

```bash
cd webapp
npm install
cp config/env.example .env   # 编辑 .env 填入你的 API Keys
npm run dev                   # 启动前端 (localhost:5173) + 后端 (localhost:3000)
```

或者分别启动：

```bash
npm run server   # 仅后端
npm run dev      # 仅前端
```

## 环境变量

在 `.env` 中配置：

```env
OPENAI_API_KEY=sk-xxx           # OpenAI 兼容 API 密钥（必需）
OPENAI_BASE_URL=https://api.openai.com/v1  # 支持 Moonshot/DeepSeek/千问等
OPENAI_MODEL=gpt-4o             # 模型名（如 kimi-k2.5、deepseek-chat）
MINIMAX_API_KEY=xxx              # MiniMax TTS
MINIMAX_BASE_URL=https://api.minimaxi.com
PORT=3000
AUTO_CONFIRM=false               # true=全自动，false=人工审核
RENDER_FPS=30                    # 渲染帧率
```

## 流水线步骤

```
Step1(脚本) → Step2(代码) → Step3(截图) ─┐
                              └→ Step4(视频) → Step5(旁白) → Step6(TTS) → Step7(合成)
```

Step 3 和 Step 4 并行执行。

## 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 剧集卡片网格 + 缩略图 + 状态标签 |
| `/create` | CreateEpisode | 单个/批量创建 |
| `/episode/:slug` | EpisodeDetail | 实时进度 + 脚本编辑 + 代码编辑 + 视频播放 |
| `/style-config` | StyleConfig | 配色/字体/动画/TTS 风格管理 |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/episodes | 创建新集，触发流水线 |
| GET | /api/episodes | 列出所有集 |
| GET | /api/episodes/:slug | 单集状态和产物 |
| POST | /api/episodes/:slug/retry | 重试（可带 step 从失败步骤开始） |
| PUT | /api/episodes/:slug/script | 编辑脚本 |
| PUT | /api/episodes/:slug/code | 编辑 HTML/CSS/JS |
| GET | /api/episodes/:slug/download | 下载视频 |
| GET | /api/episodes/logs | 服务端日志 |
| GET | /api/episodes/style-config | 获取风格配置 |
| PUT | /api/episodes/style-config | 保存风格配置 |
| WS | /ws | 实时进度推送 |

## 目录结构

```
webapp/
├── server/              # Express 后端
│   ├── ai/              # API 封装 + 提示词模板
│   ├── pipeline/        # 7 步流水线
│   ├── media/           # ffmpeg + TTS
│   ├── routes/          # API 路由
│   └── utils/           # 文件读写 + 日志
├── src/                 # React 前端
│   ├── pages/           # 4 个页面
│   ├── components/      # 公共组件
│   └── hooks/           # WebSocket + 状态管理
├── data/                # 运行时数据（episodes.json / style-config.json）
├── config/              # 环境变量模板
└── videos/              # 视频输出目录
```

## 当前进度

- ✅ Phase 1 — 前端框架
- ✅ Phase 2 — 后端 API + AI 脚本/代码生成
- ✅ Phase 3 — 自动截图 + 视频渲染
- ✅ Phase 4 — 旁白 + TTS + 合成
- ✅ Phase 5 — 前端实时进度 + 编辑 + WebSocket
- ✅ Phase 6 — 分步重试 + 日志 + 批量生成 + 风格配置
