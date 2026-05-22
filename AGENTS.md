# Ocean Canvas - 项目指引

> 这是AI助手的唯一入口文件。开始工作时只需读此文件，按需读取引用的其他文件。

## 项目概述
Ocean Canvas 深海画室 — 手绘深海生物 + AI识别评分 + 共享深海鱼缸观赏互动

## 当前状态
- **阶段**: 生产打磨中（staging 验证 → main 发布）
- **线上地址**: https://ocean.gameschats.com
- **代码仓库**: https://github.com/iokcloud/ocean-canvas
- **文档仓库**: ../ocean-canvas-docs/
- **部署方式**: 本地验证→PR到staging→预览确认→合并main→Cloudflare自动部署

## 项目结构
```
ocean-canvas/
├── index.html              # 绘制页
├── ocean.html              # 深海观赏页
├── rank.html               # 排行投票页
├── src/css/style.css       # 全局样式
├── src/js/
│   ├── storage.js          # 数据存储+生物类型+Feature Flags
│   ├── global-pool.js      # 全球池（Supabase 主数据源+缓存）
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
| 需求变更流程 | change-management.md | ocean-canvas-docs/ |
| 查迭代规划 | roadmap.md | ocean-canvas-docs/ |
| 提变更请求 | change-template.md | ocean-canvas-docs/ |
| 查变更列表 | changes/ | ocean-canvas-docs/changes/ |
| 自动化系统 | autoflow.md | ocean-canvas-docs/ |

## 技术栈
- 前端: 纯HTML/CSS/JS + Canvas 2D（无框架）
- AI: Cloudflare Workers AI（Llama 3.2 Vision）
- 托管: Cloudflare Pages
- 数据: Supabase 全球池（默认）+ localStorage 缓存/离线降级

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
FEATURES.globalPool        // supabase-config.js 已配置时自动开启
```

## 开发命令
```bash
# 本地验证（支持AI Functions）
npm install && npm run dev       # http://localhost:8788

# 冒烟测试
# 打开 http://localhost:8788/smoketest.html

# 发布流程
git push -u origin feat/xxx     # 推功能分支
gh pr create --base staging     # PR→预览URL自动生成
# 预览确认后 → merge staging → merge main → 自动上线
```

## 部署检查
1. 本地`npm run dev` + smoketest通过 → 2. PR到staging → 3. 预览URL验证 → 4. 合并main → 5. 验证ocean.gameschats.com
