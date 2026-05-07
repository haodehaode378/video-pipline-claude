STYLEKIT_STYLE_REFERENCE
style_name: 赛博朋克霓虹
style_slug: cyberpunk-neon
style_source: /styles/cyberpunk-neon

# Hard Prompt

请严格遵守以下风格规则并保持一致性，禁止风格漂移。

## 执行要求
- 优先保证风格一致性，其次再做创意延展。
- 遇到冲突时以禁止项为最高优先级。
- 输出前自检：颜色、排版、间距、交互是否仍属于该风格。

## Style Rules
# Cyberpunk Neon (赛博朋克霓虹) Design System

> 未来感十足的赛博朋克风格，霓虹发光效果、深色背景、高科技感的 UI 元素。适合游戏、科技产品、创意工作室。

## 核心理念

Cyberpunk Neon 风格来源于赛博朋克科幻美学，通过霓虹发光、深色背景和高对比度创造未来感。

核心理念：
- 霓虹发光：核心元素使用发光效果突出
- 深色主导：近乎纯黑的背景让霓虹更加醒目
- 高科技感：使用网格、扫描线等元素增加科技感
- 色彩冲击：青色、品红、黄色等高饱和度颜色

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
颜色: border-cyan-400/30
圆角: rounded-lg
```

### 阴影
```
小:   shadow-[0_0_10px_rgba(0,255,255,0.3)]
中:   shadow-[0_0_15px_rgba(0,255,255,0.4)]
大:   shadow-[0_0_25px_rgba(0,255,255,0.5)]
悬停: shadow-[0_0_30px_rgba(0,255,255,0.6)]
聚焦: shadow-[0_0_20px_rgba(0,255,255,0.5)]
```

### 交互效果
```
悬停位移: undefined
过渡动画: transition-all duration-300
按下状态: active:scale-95
```

### 字体
```
标题: font-bold
正文: font-mono
```

### 字号
```
Hero:  text-4xl md:text-6xl lg:text-8xl
H1:    text-3xl md:text-5xl
H2:    text-2xl md:text-3xl
H3:    text-xl md:text-2xl
正文:  text-sm md:text-base
小字:  text-xs
```

### 间距
```
Section: py-16 md:py-24
容器:    px-4 md:px-8
卡片:    p-6
```

---

## [FORBIDDEN] 绝对禁止

以下 class 在本风格中**绝对禁止使用**，生成时必须检查并避免：

### 禁止的 Class
- `bg-white`
- `bg-gray-50`
- `bg-slate-50`
- `shadow-sm`
- `shadow-md`
- `shadow-lg`
- `text-gray-900`
- `rounded-2xl`
- `rounded-3xl`

### 禁止的模式
- 匹配 `^bg-white`
- 匹配 `^bg-gray-[1-3]`
- 匹配 `^bg-slate-[1-3]`
- 匹配 `^shadow-(?!\[)`
- 匹配 `^rounded-[23]xl`

### 禁止原因
- `bg-white`: Cyberpunk uses dark backgrounds only
- `shadow-md`: Use neon glow shadows: shadow-[0_0_20px_rgba(0,255,255,0.5)]
- `rounded-2xl`: Keep corners subtle (rounded-lg max)

> WARNING: 如果你的代码中包含以上任何 class，必须立即替换。

---

## [REQUIRED] 必须包含

### 按钮必须包含
```
px-6 py-3
rounded-lg
font-mono
uppercase tracking-wider
transition-all duration-300
```

### 卡片必须包含
```
bg-gray-950
border border-cyan-400/30
rounded-lg
```

### 输入框必须包含
```
bg-gray-950
border border-cyan-400/30
rounded-lg
text-cyan-400
font-mono
focus:border-cyan-400
focus:shadow-[0_0_15px_rgba(0,255,255,0.3)]
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
<button class="px-6 py-3 rounded-lg font-mono uppercase tracking-wider transition-all duration-300 bg-[#ff006e] text-white px-4 py-2 md:px-6 md:py-3">
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
<div class="bg-gray-950 border border-cyan-400/30 rounded-lg p-6">
  <h3 class="font-bold text-xl md:text-2xl">标题</h3>
</div>
```

### 输入框

[WRONG] **错误示例**（灰色边框、圆角）：
```html
<input class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
```

[CORRECT] **正确示例**（黑色粗边框、聚焦阴影）：
```html
<input class="bg-gray-950 border border-cyan-400/30 rounded-lg text-cyan-400 font-mono focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,255,255,0.3)] px-3 py-2 md:px-4 md:py-3" placeholder="请输入..." />
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

### 1. 游戏界面

生成赛博朋克风格游戏 UI

```
Create a game interface using Cyberpunk Neon style:
- Dark background with scan line effect
- Neon glowing HUD elements
- Stats cards with cyan borders and glow
- Action buttons with pulse animation
- Futuristic font-mono typography
- Magenta accent for alerts/warnings
```

### 2. SaaS 着陆页

生成 赛博朋克霓虹风格的 SaaS 产品着陆页

```
Create a SaaS landing page using Cyberpunk Neon style with hero section, feature grid, testimonials, pricing table, and footer.
```

### 3. 作品集展示

生成 赛博朋克霓虹风格的作品集页面

```
Create a portfolio showcase page using Cyberpunk Neon style with project grid, about section, contact form, and consistent visual language.
```