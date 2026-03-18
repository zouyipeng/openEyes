# openEyes 👁️

一个互联网信息收集与整合平台，通过网页（支持移动端）每日整合展示来自多个信息源的内容，并使用 AI 进行智能总结。

## ✨ 功能特性

- **多源信息收集**
  - RSS 订阅解析
  - 网页爬虫（自定义 CSS 选择器）
  - 信息源 JSON 配置管理

- **AI 智能处理**
  - 文章内容自动总结
  - 每日信息摘要生成
  - 支持 OpenAI 兼容 API（如 MiniMax）
  - 可配置 maxTokens 参数

- **信息展示**
  - 今日信息汇总页面
  - 按分类分组展示
  - Markdown 格式渲染
  - 移动端适配
  - 暗色主题

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 数据存储 | JSON 文件 |
| 信息抓取 | RSS Parser + Cheerio + Axios |
| AI | OpenAI API (兼容 MiniMax 等) |

## 📦 安装

```bash
# 克隆项目
git clone https://github.com/zouyipeng/openEyes.git
cd openEyes

# 安装前端依赖
npm install

# 安装后端依赖
cd backend && npm install && cd ..
```

## ⚙️ 配置

### 1. 配置 AI 服务

创建 `backend/config.json`：

```json
{
  "openai": {
    "apiKey": "your-api-key",
    "baseURL": "https://api.openai.com/v1",
    "model": "gpt-3.5-turbo",
    "maxTokens": 4096
  }
}
```

支持 OpenAI 兼容的 API（如 MiniMax）：

```json
{
  "openai": {
    "apiKey": "your-minimax-key",
    "baseURL": "https://api.minimaxi.com/v1",
    "model": "MiniMax-M2.7",
    "maxTokens": 4096
  }
}
```

### 2. 配置信息源

编辑 `backend/sources-config.json`：

```json
{
  "sources": [
    {
      "id": "36kr-ai",
      "name": "36氪",
      "type": "rss",
      "url": "https://36kr.com/feed",
      "category": "AI",
      "active": true
    }
  ]
}
```

## 🚀 运行

### 开发模式

```bash
# 终端1：启动前端
npm run dev

# 终端2：抓取信息
cd backend && npx tsx src/cli/index.ts fetch
```

### 抓取命令

```bash
cd backend

# 抓取所有信息源
npx tsx src/cli/index.ts fetch

# 列出所有信息源
npx tsx src/cli/index.ts list:sources
```

访问 http://localhost:3000 查看应用。

## 📁 项目结构

```
openEyes/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── cli/               # CLI 命令
│   │   │   └── index.ts       # 抓取、摘要等命令
│   │   └── lib/               # 工具库
│   │       ├── ai.ts          # AI 总结
│   │       ├── fetcher.ts     # 信息抓取
│   │       └── storage.ts     # JSON 存储
│   ├── config.json            # AI 配置
│   └── sources-config.json    # 信息源配置
├── public/                    # 静态资源和数据
│   └── YYYY-MM-DD.json        # 每日数据文件
├── src/                       # 前端
│   ├── app/
│   │   ├── page.tsx          # 首页
│   │   └── layout.tsx        # 布局
│   ├── components/           # 组件
│   │   └── ArticleCard.tsx   # 文章卡片
│   └── lib/
│       └── api.ts            # 前端 API
└── README.md
```

## 📄 数据格式

### 每日数据文件 (public/YYYY-MM-DD.json)

```json
{
  "date": "2026-03-18",
  "generatedAt": "2026-03-18T15:00:00Z",
  "summary": "## 每日信息摘要\n...",
  "articles": [
    {
      "id": "article-id",
      "sourceId": "source-id",
      "sourceName": "信息源名称",
      "title": "文章标题",
      "content": "文章内容",
      "summary": "AI 摘要",
      "url": "原文链接"
    }
  ],
  "sources": [...]
}
```

## 📝 开发计划

- [x] 移除 SQLite，改用 JSON 存储
- [x] 信息源 JSON 配置
- [x] AI 总结清理优化
- [x] 数据文件直接保存到 public 目录
- [ ] 定时任务自动抓取
- [ ] 文章详情页
- [ ] 社交媒体源支持

## 📄 License

ISC

## 👥 Contributors

- Yipeng Zou <403650485@qq.com>
- Trae AI Assistant

---

**openEyes** - 让信息触手可及 👁️
