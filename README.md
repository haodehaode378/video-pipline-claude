# AI-Vedio — 全自动微课视频生成流水线

输入主题 → AI 生成脚本 → AI 生成 HTML/CSS/JS → 自动截图 → 渲染 MP4 → TTS 配音 → 成片输出。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + Tailwind CSS |
| 后端 | Node.js + Express |
| AI | Claude API (Anthropic) |
| 渲染 | Puppeteer + ffmpeg |
| TTS | MiniMax API (Phase 4) |

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

在 `config/.env` 中配置：

```env
ANTHROPIC_API_KEY=sk-ant-xxx     # Claude API（必需）
MINIMAX_API_KEY=xxx              # MiniMax TTS（Phase 4）
MINIMAX_GROUP_ID=xxx             # MiniMax 分组
PORT=3000
AUTO_CONFIRM=false
RENDER_FPS=30
```

## 流水线步骤

```
Step1(脚本) → Step2(代码) → Step3(截图) ─┐
                              └→ Step4(视频) → Step5(旁白) → Step6(TTS) → Step7(合成)
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/episodes | 创建新集，触发流水线 |
| GET | /api/episodes | 列出所有集 |
| GET | /api/episodes/:slug | 单集状态和产物 |
| POST | /api/episodes/:slug/retry | 重试某步 |
| PUT | /api/episodes/:slug/script | 编辑脚本 |
| PUT | /api/episodes/:slug/code | 编辑代码 |

## 目录结构

```
webapp/
├── server/          # Express 后端
│   ├── ai/          # Claude API 封装 + 提示词
│   ├── pipeline/    # 7 步流水线
│   ├── media/       # ffmpeg + TTS
│   ├── routes/      # API 路由
│   └── utils/       # 工具函数
├── src/             # React 前端
│   ├── pages/       # 4 个页面
│   └── components/  # 公共组件
└── config/          # 环境变量模板
```

## 当前进度

- ✅ Phase 1 — 前端框架
- ✅ Phase 2 — 后端 API + AI 脚本/代码生成
- ✅ Phase 3 — 自动截图 + 视频渲染
- ⬜ Phase 4 — 旁白 + TTS + 合成
- ⬜ Phase 5 — 前端实时进度 + 编辑
- ⬜ Phase 6 — 批量生成 + 模板管理
