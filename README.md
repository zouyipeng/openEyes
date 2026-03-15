# openEyes 👁️

一个互联网信息收集与整合平台，通过网页（支持移动端）每日整合展示来自多个信息源的内容，并使用 AI 进行智能总结。

## ✨ 功能特性

- **多源信息收集**
  - RSS 订阅解析
  - 网页爬虫（自定义 CSS 选择器）
  - 手动添加文章/链接
  - 社交媒体源（预留接口）

- **AI 智能处理**
  - 文章内容自动总结
  - 关键信息提取
  - 每日信息摘要生成

- **信息展示**
  - 今日信息汇总页面
  - 按信息源分组展示
  - 文章列表与搜索筛选
  - 移动端适配
  - 已读/收藏状态管理

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | Prisma + SQLite |
| 信息抓取 | RSS Parser + Cheerio + Axios |
| AI | OpenAI API |

## 📦 安装

```bash
# 克隆项目
git clone https://github.com/zouyipeng/openEyes.git
cd openEyes

# 安装依赖
npm install

# 初始化数据库
npx prisma generate
npx prisma db push

# 配置环境变量
cp .env .env.local
# 编辑 .env.local 填入你的 OPENAI_API_KEY
```

## ⚙️ 配置

在 `.env` 文件中配置以下环境变量：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# AI 服务
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL=""  # 可选，用于自定义 API 地址

# 抓取配置
CRON_SCHEDULE="0 8 * * *"  # 每天早上 8 点
```

## 🚀 运行

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

访问 http://localhost:3000 查看应用。

## 📖 使用说明

### 添加信息源

1. 访问 `/sources` 页面
2. 选择信息源类型：
   - **RSS 订阅**：输入 RSS/Atom 订阅地址
   - **网页爬虫**：输入网页 URL 和 CSS 选择器
   - **手动输入**：手动添加文章链接或内容
3. 点击"添加信息源"

### 抓取内容

- 点击首页的"立即抓取"按钮手动触发
- 或等待定时任务自动执行

### 管理文章

- 在首页查看今日信息汇总
- 在 `/articles` 页面查看全部文章
- 使用搜索和筛选功能过滤文章

## 📁 项目结构

```
openEyes/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── page.tsx        # 首页
│   │   ├── layout.tsx      # 全局布局
│   │   ├── sources/        # 信息源管理
│   │   ├── articles/       # 文章列表
│   │   └── api/            # API 路由
│   ├── components/         # React 组件
│   ├── lib/                # 工具库
│   │   ├── db.ts           # 数据库操作
│   │   ├── fetcher.ts      # 信息抓取
│   │   └── ai.ts           # AI 总结
│   └── types/              # TypeScript 类型
├── prisma/
│   └── schema.prisma       # 数据库模型
└── .env                    # 环境变量
```

## 🗄️ 数据模型

### Source（信息源）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| name | String | 信息源名称 |
| type | String | 类型（rss/crawler/manual/social） |
| url | String | 来源 URL |
| config | String? | JSON 配置 |
| active | Boolean | 是否启用 |

### Article（文章）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| sourceId | String | 关联信息源 |
| sourceName | String | 信息源名称 |
| title | String | 标题 |
| content | String? | 内容 |
| summary | String? | AI 总结 |
| url | String? | 原文链接 |
| isRead | Boolean | 是否已读 |
| isFavorite | Boolean | 是否收藏 |

## 📝 开发计划

- [ ] 定时任务自动抓取
- [ ] 文章详情页
- [ ] 社交媒体源支持
- [ ] 导出功能（PDF/EPUB）
- [ ] 离线阅读支持
- [ ] 多用户支持

## 📄 License

ISC

## 👥 Contributors

- Yipeng Zou <403650485@qq.com>
- Trae AI Assistant

---

**openEyes** - 让信息触手可及 👁️
