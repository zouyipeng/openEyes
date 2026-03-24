# LKML Fetcher 🐧

一个专注于Linux Kernel Mailing List补丁抓取与展示的工具。

## ✨ 功能特性

- **LKML补丁抓取**
  - 自动抓取Linux Kernel邮件列表中的补丁
  - 智能识别补丁类型（Feature/Bugfix/Other）
  - 解析补丁详情（commit message、修改文件）
  - 支持并发抓取，自动限速避免429错误

- **AI智能总结**
  - 自动生成补丁摘要
  - 每日补丁动态总结
  - 支持OpenAI兼容API

- **信息展示**
  - 按类型分组展示补丁
  - 补丁统计信息
  - Markdown格式渲染
  - 移动端适配
  - 明亮主题

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 数据存储 | JSON 文件 |
| 信息抓取 | Axios + Cheerio |
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

编辑 `backend/sources-config.json`（默认已配置好LKML源）：

```json
{
  "sources": [
    {
      "id": "lkml-today",
      "name": "Linux Kernel Mailing List",
      "type": "lkml",
      "url": "https://lkml.org/",
      "category": "linux kernel",
      "active": true,
      "excludeAuthors": ["kernel test robot"],
      "lkmlDetailConcurrency": 12,
      "lkmlDetailTimeoutMs": 8000
    }
  ]
}
```

## 🚀 运行

### 开发模式

```bash
# 终端1：启动前端 (默认端口 3000)
npm run dev

# 终端2：抓取补丁
cd backend && npx tsx src/cli/index.ts fetch
```

### 生产部署

```bash
# 构建前端项目
npm run build

# 启动静态文件服务器 (默认端口 3000)
npx serve out
```

### 抓取命令

```bash
cd backend

# 抓取Linux kernel补丁
npx tsx src/cli/index.ts fetch

# 强制抓取（忽略已处理记录）
npx tsx src/cli/index.ts fetch --force

# 调试模式（限制抓取数量）
npx tsx src/cli/index.ts fetch --debug

# 生成补丁摘要
npx tsx src/cli/index.ts summary

# 列出所有信息源
npx tsx src/cli/index.ts list:sources

# 列出已处理的补丁 URL
npx tsx src/cli/index.ts list:processed

# 清除已处理的补丁记录
npx tsx src/cli/index.ts clear:processed
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
│   │       ├── fetcher.ts     # LKML 抓取
│   │       └── storage.ts     # JSON 存储
│   ├── config.json            # AI 配置
│   └── sources-config.json    # 信息源配置
├── public/                    # 静态资源和数据
│   ├── linux kernel-YYYY-MM-DD.json  # 补丁数据文件
│   ├── processed-articles.json # 已处理补丁记录
│   └── dates.json             # 可用日期索引
├── src/                       # 前端
│   ├── app/
│   │   ├── page.tsx          # 首页
│   │   └── layout.tsx        # 布局
│   ├── components/           # 组件
│   │   ├── LKMLPatchCard.tsx # 补丁卡片
│   │   ├── NewsDashboard.tsx # 主面板
│   │   └── PenguinIcon.tsx   # Linux企鹅图标
│   └── lib/
│       ├── api.ts            # 前端 API
│       └── lkmlAnchor.ts     # 锚点工具
└── README.md
```

## 📡 API 访问

### 按日期访问数据

应用支持多种方式访问不同日期的补丁数据：

#### 1. URL路径访问（推荐）

直接通过URL路径访问特定日期的数据：

```
https://localhost:3000/2026-03-24    # 访问2026-03-24的补丁数据
https://localhost:3000/2026-03-22    # 访问2026-03-22的补丁数据
https://localhost:3000/2026-03-21    # 访问2026-03-21的补丁数据
```

#### 2. 日期选择器

在页面顶部使用日期下拉选择器切换不同日期的数据。

#### 3. 编程接口

```typescript
// 获取可用日期列表
const dates = await dayDataApi.getAvailableDates()
// 返回: ["2026-03-24", "2026-03-22", "2026-03-21"]

// 获取指定日期的数据
const data = await dayDataApi.getDataByDate('2026-03-24')
// 返回: DayData对象

// 获取最新数据
const latestData = await dayDataApi.getLatestData()
```

### 数据文件格式

#### 补丁数据文件 (public/linux kernel-YYYY-MM-DD.json)

```json
{
  "date": "2026-03-24",
  "generatedAt": "2026-03-24T10:00:00Z",
  "summary": "## 今日社区动态\n...",
  "articles": [
    {
      "id": "patch-id",
      "title": "补丁标题",
      "url": "补丁链接",
      "author": "作者",
      "content": "补丁内容",
      "patchData": {
        "type": "feature",
        "commitMessage": "...",
        "changedFiles": ["file1.c", "file2.h"]
      }
    }
  ],
  "sources": [...]
}
```

## 📝 开发计划

- [x] LKML补丁抓取
- [x] 补丁类型识别
- [x] AI智能总结
- [x] 补丁分组展示
- [ ] 定时任务自动抓取
- [ ] 补丁详情页
- [ ] 搜索功能
- [ ] 订阅特定子系统

## 📄 License

ISC

## 👥 Contributors

- Yipeng Zou <403650485@qq.com>
- Trae AI Assistant

---

**LKML Fetcher** - 让Linux kernel补丁触手可及 🐧
