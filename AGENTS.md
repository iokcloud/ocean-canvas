# Ocean Canvas - 项目指引

## 项目概述
Ocean Canvas 深海画室 — 让用户手绘深海生物，AI识别评分后放入共享深海鱼缸观赏互动的Web应用。

## 技术栈
- **前端**: 纯 HTML/CSS/JS（无框架），Canvas 2D API
- **样式**: CSS变量 + 深海赛博朋克主题（Orbitron + JetBrains Mono字体）
- **AI**: Cloudflare Workers AI（@cf/meta/llama-3.2-11b-vision-instruct）
- **后端**: Cloudflare Pages Functions（/functions/api/）
- **托管**: Cloudflare Pages（Git push自动部署）
- **数据**: localStorage（MVP期）→ Supabase（增长期）
- **域名**: ocean.gameschats.com

## 项目结构
```
ocean-canvas/
├── index.html              # 绘制页（主页）
├── ocean.html              # 深海观赏页
├── rank.html               # 排行投票页
├── src/
│   ├── css/style.css       # 全局样式+深海主题
│   └── js/
│       ├── storage.js      # 数据存储+生物类型定义+内置示例
│       ├── draw.js         # 绘画引擎+AI评分交互
│       ├── ocean.js        # 深海动画引擎
│       ├── rank.js         # 排行投票逻辑
│       └── bubbles.js      # CSS气泡背景
├── functions/
│   └── api/
│       └── classify.js     # AI识别API（CF Pages Function）
├── worker/
│   └── index.js            # Worker源码（备用部署方式）
├── wrangler.toml           # Worker配置
└── .gitignore

ocean-canvas-docs/          # 文档仓库（与代码分离）
├── BP.md                   # 商业计划书
└── CONTRIBUTING.md         # 开发规范
```

## 开发命令
```bash
# 本地开发：直接用浏览器打开 index.html 即可
# 或用任意静态服务器：
npx serve .

# 部署：git push origin main（Cloudflare Pages自动部署）
# Worker部署（如需独立部署AI API）：
npx wrangler deploy
```

## 代码规范
- **语言**: 所有交互文本使用简体中文，代码注释使用简体中文
- **CSS**: 使用CSS变量（定义在:root），深海主题色板：
  - --neon-cyan: #00e5ff（主强调色）
  - --neon-magenta: #ff00ff（次强调色）
  - --neon-green: #00ff88（成功/通过）
  - --neon-gold: #ffd700（金色/警告）
  - --bg-deep: #050510（最深背景）
  - --bg-card: #0d0d2b（卡片背景）
- **JS**: IIFE模块模式，不使用ES模块（兼容性优先）
- **命名**: CSS用kebab-case，JS用camelCase，常量用UPPER_SNAKE_CASE
- **禁止**: 不添加注释除非被要求，不引入框架/构建工具

## AI功能
- API端点: POST /api/classify
- 请求: FormData { image: Blob, type: string }
- 响应: { similarity: 0-1, isMatch: bool, creativity: 0-100, feedback: string, suggestedType: string }
- 通过阈值: similarity >= 0.6
- 客户端自动检查: 停笔1.5秒后自动调用AI

## Feature Flags
在 localStorage 中设置：
- `oc_dev`: 'true' 开启开发模式
- `oc_ai_off`: 'true' 关闭AI识别（fallback模式）

## 关键业务逻辑
- 生物类型定义: CREATURE_TYPES（在storage.js中）
- 8种生物: fish, jellyfish, octopus, turtle, crab, whale, shark, seahorse
- 每种生物有独立的游泳参数: speed, wobble
- 默认5条示例生物在首次访问时自动生成（seedDefaultCreatures）

## 部署检查清单
- [ ] 本地测试三个页面均可正常工作
- [ ] Canvas绘画+AI评分流程通过
- [ ] 鱼缸动画流畅
- [ ] 排行投票正常
- [ ] 移动端触控正常
- [ ] git push后Cloudflare Pages部署成功
- [ ] ocean.gameschats.com可正常访问
