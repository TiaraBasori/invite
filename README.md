# Invite

一个基于 Cloudflare Workers 的 Telegram 机器人，用于为指定群组的成员生成专属的永久邀请链接。

## ✨ 功能特点

- **私密操作**：用户通过私聊发送 `/start` 或 `/link` 命令申请邀请链接
- **权限验证**：自动验证用户是否为指定群组的成员
- **专属链接**：为每个用户生成唯一的永久邀请链接，可无限次使用
- **数据存储**：使用 Cloudflare KV 存储用户与邀请链接的映射关系
- **自动回复**：根据用户状态提供清晰的提示信息

## 📋 前置准备

### 1. 创建 Telegram 机器人
- 在 Telegram 中搜索 **@BotFather**
- 发送 `/newbot` 命令创建新机器人
- 设置机器人名称和用户名（必须以 `bot` 结尾）
- **保存 API Token**（格式类似 `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2. 获取群组 ID
- 将机器人添加为群组管理员
- 在群组中发送一条消息
- 访问以下 URL 查看群组 ID（替换 `YOUR_BOT_TOKEN`）：
  ```
  https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
  ```
- 群组 ID 通常为负数（如 `-1001234567890`）

## 🚀 部署方法

### 方法一：标准 CLI 部署（推荐）

#### 1. 安装 Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

#### 2. 创建 KV 命名空间
```bash
wrangler kv:namespace create "LINK_BOT_KV"
```

#### 3. 配置环境变量
创建 `wrangler.toml` 文件：
```toml
name = "telegram-link-bot"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "LINK_BOT_KV"
id = "你的KV命名空间ID"

[vars]
BOT_TOKEN = "你的Telegram Bot Token"
WHITELISTED_GROUP_ID = "你的群组ID"
BOT_USERNAME = "你的bot用户名"
```

#### 4. 部署代码
```bash
wrangler deploy
```

### 方法二：无 CLI 可视化部署（适合非技术用户）

#### 1. 创建 Cloudflare Worker
- 登录 https://dash.cloudflare.com/
- 进入 "Workers & Pages" 页面
- 点击 "Create Application" → "Create Worker"
- 将提供的 JavaScript 代码粘贴到代码编辑器中

#### 2. 设置环境变量
- 在 Worker 页面点击 "Settings" 标签
- 选择 "Variables" → "Environment Variables"
- 添加以下变量：
  - `BOT_TOKEN` = 你的Telegram Bot Token
  - `WHITELISTED_GROUP_ID` = 你的群组ID
  - 'BOT_USERNAME' = "你的bot用户名"

#### 3. 绑定 KV 命名空间
- 在 "Settings" 页面选择 "KV Namespace Bindings"
- 点击 "Add binding"
- 填写：
  - **Variable name**：`LINK_BOT_KV`
  - **KV namespace**：选择或创建新的命名空间
- 保存设置

#### 4. 部署更改
- 点击右上角 "Save and Deploy" 按钮
- 获取您的 Worker URL（格式如 `https://your-worker.your-subdomain.workers.dev`）

## ⚙️ 配置 Webhook

无论使用哪种部署方法，都需要设置 Webhook：

### 方法一：使用浏览器设置
直接在浏览器地址栏输入（替换 `YOUR_BOT_TOKEN` 和 `YOUR_WORKER_URL`）：
```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WORKER_URL
```

### 方法二：使用 curl 命令
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_WORKER_URL"}'
```

### 验证 Webhook 设置
访问以下 URL 检查是否设置成功：
```
https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
```

## 💬 使用方法

1. **用户私聊机器人**：在 Telegram 中搜索您的机器人用户名
2. **发送命令**：使用 `/start` 或 `/link`
3. **权限验证**：机器人自动验证用户群组身份
4. **获取链接**：
   - 首次使用：生成新的专属邀请链接
   - 再次使用：返回已存储的链接

## ⚠️ 重要提示

### 机器人权限配置
- 确保机器人在目标群组中具有**管理员权限**
- 开启**"生成邀请链接"**权限
- 建议开启**"查看聊天信息"**权限

### 环境变量检查
- `BOT_TOKEN` 格式应为 `数字:字母字符串`
- `WHITELISTED_GROUP_ID` 应为负数格式
- KV 命名空间绑定名称必须为 `LINK_BOT_KV`

### 故障排除
1. **机器人不响应**：检查 Webhook 是否设置正确
2. **权限错误**：确认机器人是群组管理员
3. **链接生成失败**：验证机器人是否有生成邀请链接的权限

## 🔧 自定义配置

您可以修改代码中的以下部分来自定义机器人行为：
- 修改回复消息文本
- 调整 KV 存储策略
- 更改邀请链接参数（有效期、使用次数等）

## 📞 技术支持

如果遇到问题：
1. 检查 Cloudflare Worker 日志
2. 验证环境变量配置
3. 确认 Telegram Bot 权限设置
4. 检查 KV 命名空间绑定

---

## 📄 许可证
本项目基于MIT许可证开源，可自由使用和修改。
