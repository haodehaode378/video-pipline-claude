STYLEKIT_STYLE_REFERENCE
style_name: 杂志网格布局
style_slug: magazine-grid
style_source: /styles/magazine-grid

# Hard Prompt

请严格遵守以下风格规则并保持一致性，禁止风格漂移。

## 执行要求
- 优先保证风格一致性，其次再做创意延展。
- 遇到冲突时以禁止项为最高优先级。
- 输出前自检：颜色、排版、间距、交互是否仍属于该风格。

## Style Rules
# Magazine Grid (杂志网格布局) Design System

> 灵感来自印刷杂志的多栏网格布局，通过不同大小的内容块创造丰富的视觉层次，适合新闻、博客、内容聚合。

## 核心理念

Magazine Grid（杂志网格布局）借鉴传统印刷杂志的排版智慧，通过多栏和混合尺寸内容块创造专业的编辑效果。

核心理念：
- 视觉层级：大图抓眼球，小块填充细节
- 扫描友好：读者可快速浏览找到感兴趣的内容
- 空间节奏：大小交替创造阅读节奏
- 专业感：传递权威性和可信度

设计原则：
- 视觉一致性：所有组件必须遵循统一的视觉语言，从色彩到字体到间距保持谐调
- 层次分明：通过颜色深浅、字号大小、留白空间建立清晰的信息层级
- 交互反馈：每个可交互元素都必须有明确的 hover、active、focus 状态反馈
- 响应式适配：设计必须在移动端、平板、桌面端上保持一致的体验
- 无障碍性：确保色彩对比度符合 WCAG 2.1 AA 标准，所有交互元素可键盘访问

---

## Token 字典（精确 Class 映射）

### 边框
```
宽度: border
颜色: border-zinc-200
圆角: rounded-lg
```

### 阴影
```
小:   shadow-sm
中:   shadow-sm
大:   shadow-md
悬停: hover:shadow-md
聚焦: focus:shadow-sm
```

### 交互效果
```
悬停位移: undefined
过渡动画: transition-all duration-300
按下状态: active:scale-95
```

### 字体
```
标题: font-bold tracking-tight
正文: font-sans
```

### 字号
```
Hero:  text-3xl md:text-4xl lg:text-5xl
H1:    text-2xl md:text-3xl lg:text-4xl
H2:    text-xl md:text-2xl
H3:    text-lg md:text-xl
正文:  text-sm md:text-base
小字:  text-xs
```

### 间距
```
Section: py-8 md:py-12 lg:py-16
容器:    px-4 md:px-6 lg:px-8
卡片:    p-4 md:p-6
```

---

## [FORBIDDEN] 绝对禁止

以下 class 在本风格中**绝对禁止使用**，生成时必须检查并避免：

### 禁止的 Class
- `rounded-none`
- `border-4`
- `border-8`
- `shadow-2xl`
- `font-black`

### 禁止的模式
- 匹配 `^border-[48]`
- 匹配 `^shadow-2xl`

### 禁止原因
- `rounded-none`: Magazine Grid uses soft rounded corners for a polished editorial feel
- `border-4`: Magazine Grid uses thin subtle borders for elegant separation
- `shadow-2xl`: Magazine Grid uses subtle shadows, relying on layout for visual hierarchy

> WARNING: 如果你的代码中包含以上任何 class，必须立即替换。

---

## [REQUIRED] 必须包含

### 按钮必须包含
```
text-xs font-semibold uppercase tracking-wider
rounded
```

### 卡片必须包含
```
rounded-lg
overflow-hidden
group
```

### 输入框必须包含
```
bg-zinc-100
border-0
rounded-lg
focus:outline-none
focus:ring-2 focus:ring-red-500/30
```

---

## [COMPARE] 错误 vs 正确对比

### 按钮

[WRONG] **错误示例**（使用了圆角和模糊阴影）：
```html
<button class="rounded-lg shadow-lg bg-blue-500 text-white px-4 py-2 hover:bg-blue-600">
  点击我
</button>
```

[CORRECT] **正确示例**（使用硬边缘、无圆角、位移效果）：
```html
<button class="text-xs font-semibold uppercase tracking-wider rounded bg-[#ff006e] text-white px-4 py-2 md:px-6 md:py-3">
  点击我
</button>
```

### 卡片

[WRONG] **错误示例**（使用了渐变和圆角）：
```html
<div class="rounded-xl shadow-2xl bg-gradient-to-r from-purple-500 to-pink-500 p-6">
  <h3 class="text-xl font-semibold">标题</h3>
</div>
```

[CORRECT] **正确示例**（纯色背景、硬边缘阴影）：
```html
<div class="rounded-lg overflow-hidden group p-4 md:p-6">
  <h3 class="font-bold tracking-tight text-lg md:text-xl">标题</h3>
</div>
```

### 输入框

[WRONG] **错误示例**（灰色边框、圆角）：
```html
<input class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
```

[CORRECT] **正确示例**（黑色粗边框、聚焦阴影）：
```html
<input class="bg-zinc-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 px-3 py-2 md:px-4 md:py-3" placeholder="请输入..." />
```

---

## [TEMPLATES] 页面骨架模板

使用以下模板生成页面，只需替换 `{PLACEHOLDER}` 部分：

### 导航栏骨架
```html
<nav class="bg-white border-b-2 md:border-b-4 border-black px-4 md:px-8 py-3 md:py-4">
  <div class="flex items-center justify-between max-w-6xl mx-auto">
    <a href="/" class="font-black text-xl md:text-2xl tracking-wider">
      {LOGO_TEXT}
    </a>
    <div class="flex gap-4 md:gap-8 font-mono text-sm md:text-base">
      {NAV_LINKS}
    </div>
  </div>
</nav>
```

### Hero 区块骨架
```html
<section class="min-h-[60vh] md:min-h-[80vh] flex items-center px-4 md:px-8 py-12 md:py-0 bg-{ACCENT_COLOR} border-b-2 md:border-b-4 border-black">
  <div class="max-w-4xl mx-auto">
    <h1 class="font-black text-4xl md:text-6xl lg:text-8xl leading-tight tracking-tight mb-4 md:mb-6">
      {HEADLINE}
    </h1>
    <p class="font-mono text-base md:text-xl max-w-xl mb-6 md:mb-8">
      {SUBHEADLINE}
    </p>
    <button class="bg-black text-white font-black px-6 py-3 md:px-8 md:py-4 border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(255,0,110,1)] md:shadow-[8px_8px_0px_0px_rgba(255,0,110,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm md:text-base">
      {CTA_TEXT}
    </button>
  </div>
</section>
```

### 卡片网格骨架
```html
<section class="py-12 md:py-24 px-4 md:px-8">
  <div class="max-w-6xl mx-auto">
    <h2 class="font-black text-2xl md:text-4xl mb-8 md:mb-12">{SECTION_TITLE}</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <!-- Card template - repeat for each card -->
      <div class="bg-white border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 hover:shadow-[4px_4px_0px_0px_rgba(255,0,110,1)] md:hover:shadow-[8px_8px_0px_0px_rgba(255,0,110,1)] hover:-translate-y-1 transition-all">
        <h3 class="font-black text-lg md:text-xl mb-2">{CARD_TITLE}</h3>
        <p class="font-mono text-sm md:text-base text-gray-700">{CARD_DESCRIPTION}</p>
      </div>
    </div>
  </div>
</section>
```

### 页脚骨架
```html
<footer class="bg-black text-white py-12 md:py-16 px-4 md:px-8 border-t-2 md:border-t-4 border-black">
  <div class="max-w-6xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <span class="font-black text-xl md:text-2xl">{LOGO_TEXT}</span>
        <p class="font-mono text-sm mt-4 text-gray-400">{TAGLINE}</p>
      </div>
      <div>
        <h4 class="font-black text-lg mb-4">{COLUMN_TITLE}</h4>
        <ul class="space-y-2 font-mono text-sm text-gray-400">
          {FOOTER_LINKS}
        </ul>
      </div>
    </div>
  </div>
</footer>
```

---

## [CHECKLIST] 生成后自检清单

**在输出代码前，必须逐项验证以下每一条。如有违反，立即修正后再输出：**

### 1. 圆角检查
- [ ] 搜索代码中的 `rounded-`
- [ ] 确认只有 `rounded-none` 或无圆角
- [ ] 如果发现 `rounded-lg`、`rounded-md` 等，替换为 `rounded-none`

### 2. 阴影检查
- [ ] 搜索代码中的 `shadow-`
- [ ] 确认只使用 `shadow-[Xpx_Xpx_0px_0px_rgba(...)]` 格式
- [ ] 如果发现 `shadow-lg`、`shadow-xl` 等，替换为正确格式

### 3. 边框检查
- [ ] 搜索代码中的 `border-`
- [ ] 确认边框颜色是 `border-black`
- [ ] 如果发现 `border-gray-*`、`border-slate-*`，替换为 `border-black`

### 4. 交互检查
- [ ] 所有按钮都有 `hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]`
- [ ] 所有卡片都有 hover 效果（阴影变色或位移）
- [ ] 都包含 `transition-all`

### 5. 响应式检查
- [ ] 边框有 `border-2 md:border-4`
- [ ] 阴影有 `shadow-[4px...] md:shadow-[8px...]`
- [ ] 间距有 `p-4 md:p-6` 或类似的响应式值
- [ ] 字号有 `text-sm md:text-base` 或类似的响应式值

### 6. 字体检查
- [ ] 标题使用 `font-black`
- [ ] 正文使用 `font-mono`

> CRITICAL: **如果任何一项检查不通过，必须修正后重新生成代码。**

---

## [EXAMPLES] 示例 Prompt

### 1. 新闻首页

新闻网站的杂志风格首页

```
Create a news homepage with magazine grid:
1. 4-column grid on desktop, 2 on tablet, 1 on mobile
2. Featured story spanning 2x2 with image overlay
3. Regular articles in grid with thumbnail, category, title
4. Category tabs: All, Politics, Tech, Business, Sports
5. Breaking news banner at top
6. Load more button at bottom
7. Sidebar with trending stories (optional)
Clean, professional news design with red accent
```

### 2. 博客列表

博客文章的杂志布局

```
Create a blog listing with magazine grid:
1. Featured post with large image and gradient overlay
2. Regular posts in varied sizes (some 2-col wide)
3. Each post: image, category tag, title, excerpt, author
4. Mix of horizontal and vertical card layouts
5. Filter by category dropdown
6. Infinite scroll loading
7. Reading time indicator
Modern editorial style with serif headlines
```

### 3. 内容聚合页

多类型内容的聚合展示

```
Create a content hub with magazine grid:
1. Mix of content types: articles, videos, podcasts
2. Video cards with play button overlay
3. Podcast cards with audio duration
4. Featured content section at top
5. "Editor's Picks" sidebar section
6. Newsletter signup card in grid
7. Trending topics tags
Multi-format content with clear type indicators
```