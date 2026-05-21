# Ocean Canvas - 项目指引

> 这是AI助手的唯一入口文件。开始工作时只需读此文件，按需读取引用的其他文件。

## 项目概述
Ocean Canvas 深海画室 — 手绘深海生物 + AI识别评分 + 共享深海鱼缸观赏互动

## 当前状态
- **阶段**: MVP已上线，Phase 1验证期
- **线上地址**: https://ocean.gameschats.com
- **代码仓库**: https://github.com/iokcloud/ocean-canvas
- **文档仓库**: ../ocean-canvas-docs/
- **部署方式**: git push origin main → Cloudflare Pages自动部署

## 项目结构
```
ocean-canvas/
├── index.html              # 绘制页
├── ocean.html              # 深海观赏页
├── rank.html               # 排行投票页
├── src/css/style.css       # 全局样式
├── src/js/
│   ├── storage.js          # 数据存储+生物类型+Feature Flags
│   ├── draw.js             # 绘画引擎+AI评分
│   ├── ocean.js            # 深海动画引擎
│   ├── rank.js             # 排行投票
│   ├── bubbles.js          # 气泡背景
│   └── analytics.js        # 前端监控
├── functions/api/classify.js  # AI识别API
├── worker/index.js         # Worker备用
└── AGENTS.md               # ← 本文件
```

## 按需知识库
以下文件不要预读，根据任务需要时再读：

| 需要时 | 读哪个文件 | 位置 |
|--------|-----------|------|
| 改CSS/主题 | design-system.md | ocean-canvas-docs/ |
| 改AI逻辑 | ai-system.md | ocean-canvas-docs/ |
| 加新生物 | creature-guide.md | ocean-canvas-docs/ |
| 了解商业 | BP.md | ocean-canvas-docs/ |
| 开发规范 | CONTRIBUTING.md | ocean-canvas-docs/ |
| 改部署 | deploy.md | ocean-canvas-docs/ |
| 查历史决策 | decisions.md | ocean-canvas-docs/ |

## 技术栈
- 前端: 纯HTML/CSS/JS + Canvas 2D（无框架）
- AI: Cloudflare Workers AI（Llama 3.2 Vision）
- 托管: Cloudflare Pages
- 数据: localStorage → Supabase(Phase2)

## 关键约定
- 语言: 简体中文（交互文本+代码注释）
- CSS: 只用CSS变量中的颜色，禁止硬编码
- JS: IIFE模块模式，不使用ES模块
- 命名: CSS kebab-case, JS camelCase
- 不添加注释除非被要求

## Feature Flags
```javascript
FEATURES.aiClassification  // oc_ai_off=true关闭
FEATURES.devMode           // oc_dev=true开启
FEATURES.decorationShop    // oc_deco=off关闭
FEATURES.socialFeatures    // oc_social=off关闭
FEATURES.analytics         // oc_analytics_off=true关闭
```

## 开发命令
```bash
# 本地: 直接打开index.html 或 npx serve .
# 部署: git push origin main
# Worker: npx wrangler deploy
```

## 部署检查
1. 本地三页测试 → 2. git push → 3. 等CF部署(30秒) → 4. 验证ocean.gameschats.com
