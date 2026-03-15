# openEyes 项目计划

## 项目概述
一个互联网信息收集与整合平台，通过网页（支持移动端）每日整合展示来自多个信息源的内容，并使用AI进行智能总结。

## 技术选型

### 前端框架
- **Next.js 14** (App Router) - React全栈框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 响应式设计，支持移动端

### 后端服务
- **Next.js API Routes** - 服务端接口
- **Prisma 5** - 数据库ORM
- **SQLite** - 轻量级数据库（单用户场景）

### 信息收集
- **RSS Parser** - RSS订阅解析
- **Cheerio + Axios** - 网页爬虫

### AI集成
- **OpenAI API** - 内容总结与分类

## 项目结构

```
openEyes/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # 首页（今日信息汇总）✅
│   │   ├── layout.tsx         # 全局布局 ✅
│   │   ├── globals.css        # 全局样式 ✅
│   │   ├── sources/           # 信息源管理页面 ✅
│   │   ├── articles/          # 文章列表页面 ✅
│   │   └── api/               # API路由 ✅
│   │       ├── sources/       # 信息源CRUD ✅
│   │       ├── articles/      # 文章操作 ✅
│   │       ├── fetch/         # 手动触发抓取 ✅
│   │       └── summarize/     # AI总结接口 ✅
│   ├── components/            # React组件 ✅
│   │   ├── ArticleCard.tsx   # 文章卡片 ✅
│   │   └── DailySummaryCard.tsx # AI总结面板 ✅
│   ├── lib/                   # 工具库 ✅
│   │   ├── db.ts             # 数据库操作 ✅
│   │   ├── fetcher.ts        # 信息抓取 ✅
│   │   └── ai.ts             # AI总结 ✅
│   └── types/                 # TypeScript类型定义 ✅
├── prisma/
│   └── schema.prisma         # 数据库模型 ✅
├── .env                       # 环境变量 ✅
├── package.json              # 项目配置 ✅
├── tailwind.config.ts        # Tailwind配置 ✅
└── tsconfig.json             # TypeScript配置 ✅
```

## 数据库模型

### Source (信息源)
- id: 唯一标识
- name: 信息源名称
- type: 类型 (rss/crawler/manual/social)
- url: 来源URL
- config: JSON配置（选择器、更新频率等）
- lastFetched: 最后抓取时间
- active: 是否启用

### Article (文章)
- id: 唯一标识
- sourceId: 关联信息源
- sourceName: 信息源名称（冗余存储，便于展示）
- sourceUrl: 信息源主页URL
- title: 标题
- content: 内容
- summary: AI总结
- url: 原文链接
- author: 作者
- publishedAt: 发布时间
- fetchedAt: 抓取时间
- isRead: 是否已读
- isFavorite: 是否收藏

> **重要**: 所有文章展示时必须显示信息源信息（来源名称、来源链接），确保信息可追溯。

## 核心功能模块

### 1. 信息源管理
- [x] 添加RSS订阅源
- [x] 配置网页爬虫（URL + CSS选择器）
- [x] 手动添加文章/链接
- [ ] 社交媒体源配置（预留接口）
- [x] 启用/禁用信息源
- [x] 编辑和删除信息源

### 2. 内容抓取
- [x] RSS订阅自动解析
- [x] 网页内容爬取（支持静态页面）
- [ ] 定时任务调度（每日自动抓取）
- [x] 手动触发抓取
- [x] 去重处理

### 3. AI智能处理
- [x] 文章内容总结
- [x] 关键信息提取
- [ ] 自动分类标签
- [x] 每日信息摘要生成

### 4. 信息展示
- [x] 今日信息汇总页面
- [x] 文章列表（按时间/来源分类）
- [ ] 文章详情页
- [x] 移动端适配
- [x] 已读/未读状态
- [x] 收藏功能
- [x] 搜索功能

### 5. 用户配置
- [ ] 抓取时间设置
- [ ] AI模型配置
- [ ] 显示偏好设置

## 开发阶段

### 第一阶段：项目初始化与基础架构 ✅
1. ✅ 初始化Next.js项目
2. ✅ 配置TypeScript、Tailwind CSS
3. ✅ 设置Prisma和SQLite数据库
4. ✅ 创建基础布局和路由

### 第二阶段：信息源管理 ✅
1. ✅ 实现信息源数据库模型
2. ✅ 开发信息源CRUD接口
3. ✅ 创建信息源管理页面

### 第三阶段：内容抓取 ✅
1. ✅ 实现RSS订阅解析
2. ✅ 开发网页爬虫功能
3. ⏳ 实现定时任务
4. ✅ 添加手动输入功能

### 第四阶段：AI集成 ✅
1. ✅ 集成OpenAI API
2. ✅ 实现内容总结功能
3. ✅ 开发每日摘要生成

### 第五阶段：前端展示 ✅
1. ✅ 开发首页信息汇总
2. ✅ 创建文章列表页
3. ✅ 实现移动端适配
4. ✅ 添加搜索和筛选功能

### 第六阶段：优化与部署 ⏳
1. ⏳ 性能优化
2. ⏳ 错误处理完善
3. ⏳ 部署配置

## 环境变量配置

```env
# 数据库
DATABASE_URL="file:./dev.db"

# AI服务
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL=""  # 可选，用于自定义API地址

# 抓取配置
CRON_SCHEDULE="0 8 * * *"  # 每天早上8点
```

## 使用说明

### 启动项目
```bash
npm run dev
```

### 添加信息源
1. 访问 http://localhost:3000/sources
2. 填写信息源名称、类型和URL
3. 对于爬虫类型，可配置CSS选择器

### 抓取内容
- 点击首页的"立即抓取"按钮手动触发
- 或等待定时任务自动执行

### 配置AI
在 `.env` 文件中设置 `OPENAI_API_KEY`

---

**计划状态**: ✅ 基础功能已完成
**创建时间**: 2026-03-15
**更新时间**: 2026-03-15
