# WeWe RSS 部署指南

## 概述

WeWe RSS 是一个基于微信读书的微信公众号RSS生成服务，可以将微信公众号文章转换为标准RSS格式。

## 前置条件

### 安装 Docker Desktop（Windows）

如果尚未安装 Docker，请按以下步骤安装：

1. **下载 Docker Desktop**
   - 官方下载地址：https://www.docker.com/products/docker-desktop/
   - 或直接下载：https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe

2. **系统要求**
   - Windows 10/11 64位（专业版/企业版/教育版）
   - 家庭版需要使用 WSL2 后端
   - BIOS 中启用虚拟化（VT-x/AMD-V）

3. **安装步骤**
   ```
   1. 双击运行 Docker Desktop Installer.exe
   2. 勾选 "Use WSL 2 instead of Hyper-V"（推荐）
   3. 安装完成后重启电脑
   4. 启动 Docker Desktop，等待启动完成
   ```

4. **验证安装**
   ```powershell
   docker --version
   docker-compose --version
   ```

## 快速部署

### 方式一：Docker Compose（推荐）

1. 确保已安装 Docker 和 Docker Compose

2. 在项目根目录执行：
```bash
docker-compose -f docker-compose.wewe-rss.yml up -d
```

3. 访问 `http://localhost:4000` 进入管理界面

### 方式二：Docker 命令

```bash
docker run -d \
  --name wewe-rss \
  -p 4000:4000 \
  -e DATABASE_TYPE=sqlite \
  -e AUTH_CODE=openeyes2024 \
  -e TZ=Asia/Shanghai \
  -v ./wewe-rss-data:/app/data \
  cooderl/wewe-rss-sqlite:latest
```

## 使用步骤

### 1. 登录管理界面

- 访问：`http://localhost:4000`
- 授权码：`openeyes2024`（可在 docker-compose.wewe-rss.yml 中修改）

### 2. 添加微信读书账号

1. 点击「账号管理」→「添加账号」
2. 使用微信扫描二维码登录微信读书
3. **不要勾选**「24小时后自动退出」

### 3. 添加公众号订阅

1. 点击「公众号源」→「添加」
2. 提交微信公众号文章分享链接
   - 在微信中打开公众号文章
   - 点击右上角「...」→「复制链接」
   - 粘贴链接到添加框

### 4. 获取RSS链接

添加成功后，每个公众号会生成一个RSS链接：
```
http://localhost:4000/feeds/MP_WXS_xxxxxx.rss
```

### 5. 配置到 openEyes

将RSS链接添加到 `backend/sources-config.json`：

```json
{
  "id": "wechat-your-public-account",
  "name": "公众号名称",
  "type": "rss",
  "url": "http://localhost:4000/feeds/MP_WXS_xxxxxx.rss",
  "category": "微信",
  "active": true
}
```

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_TYPE | 数据库类型 | sqlite |
| AUTH_CODE | 管理界面授权码 | - |
| TZ | 时区 | Asia/Shanghai |
| FEED_MODE | 输出模式（fulltext=全文） | - |
| CRON_EXPRESSION | 定时更新Cron表达式 | 35 5,17 * * * |
| MAX_REQUEST_PER_MINUTE | 每分钟最大请求数 | 60 |

## 注意事项

1. **账号安全**：建议使用微信小号登录，避免主账号被封控
2. **添加频率**：不要频繁添加公众号，容易被封控
3. **小黑屋**：如果账号被封控，等待24小时后会自动恢复
4. **数据备份**：数据存储在 `wewe-rss-data` 目录，定期备份

## 故障排除

### 账号状态说明

| 状态 | 说明 | 解决方案 |
|------|------|----------|
| 今日小黑屋 | 账号被封控 | 等待24小时恢复 |
| 禁用 | 不使用该账号 | 手动启用 |
| 失效 | 登录状态失效 | 重新扫码登录 |

### 常见问题

**Q: RSS链接无法访问？**
A: 检查Docker容器是否正常运行，端口是否正确映射

**Q: 公众号文章不更新？**
A: 检查账号状态是否正常，Cron表达式是否正确

**Q: 如何修改授权码？**
A: 修改 docker-compose.wewe-rss.yml 中的 AUTH_CODE，重启容器

## 参考链接

- [WeWe RSS GitHub](https://github.com/cooderl/wewe-rss)
- [Docker 官方文档](https://docs.docker.com/)
