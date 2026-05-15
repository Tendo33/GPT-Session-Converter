# GPT-Session-Converter

本地转换 ChatGPT 相关账号 JSON，支持网页端和 CLI。核心用途是把 `ChatGPT Web session`、`Codex auth.json` 或其他兼容账号 JSON，转换成可直接导入的目标格式。

## 项目来源

- 原始仓库：[Tendo33/GPT-Session-Converter](https://github.com/Tendo33/GPT-Session-Converter)
- 当前仓库在原始项目基础上增加了：
  - 更简洁的本地前端
  - `Codex auth.json` 输出
  - Node CLI
  - 基础自动化测试

## 支持的输入

页面和 CLI 都会自动尝试识别这些输入：

- ChatGPT Web session JSON
- 已导出的 `Codex auth.json`
- 数组形式的账号对象
- 嵌套在更大 JSON 里的 session/account 对象

识别规则的核心是：

- 能找到 `accessToken` / `access_token`
- 同时能找到用户或账号身份信息，例如 `user.email`、`email`、`account_id`、`chatgpt_account_id`

## 支持的输出格式

- `sub2api`
- `cpa`
- `cockpit`
- `9router`
- `codex-auth`

说明：

- `codex-auth` 输出对齐 Codex 的 `auth.json` 结构
- `ChatGPT Web session` 通常没有真实 `refresh_token`
- 当输入里没有真实 `id_token` 时，转换器会生成一个占位 claims token，方便目标格式解析

## 网页端使用

直接打开本地页面：

```bash
open index.html
```

或在浏览器里打开：

```text
file:///.../GPT-Session-Converter/index.html
```

使用流程：

1. 选择输出格式
2. 粘贴 JSON，或拖入 / 选择 `.json` 文件
3. 查看右侧转换结果
4. 复制输出，或下载 JSON

如果你需要原始 session，一般从这里获取：

```text
https://chatgpt.com/api/auth/session
```

## CLI

### 直接运行

```bash
node session-converter-cli.js --format codex-auth ./session.json
```

### 从 stdin 读取

```bash
cat session.json | node session-converter-cli.js --format sub2api
```

### 输出到文件

```bash
node session-converter-cli.js -f cockpit -o ./out.json ./session.json
```

### 读取多个文件

```bash
node session-converter-cli.js -f sub2api ./a.json ./b.json ./c.json
```

### 压缩输出

```bash
node session-converter-cli.js -f codex-auth --compact ./session.json
```

### 帮助

```bash
node session-converter-cli.js --help
```

## CLI 参数

```text
-f, --format <name>   输出格式：sub2api | cpa | cockpit | 9router | codex-auth
-o, --output <path>   输出到文件，传 - 表示强制输出到 stdout
    --pretty <n>      JSON 缩进空格数，默认 2
    --compact         输出压缩 JSON
    --stdin           即使传了文件路径，也额外从 stdin 读取
-h, --help            显示帮助
```

## 常见说明

### 1. 为什么没有 `refresh_token`

`ChatGPT Web session` 通常只给你 `accessToken` / `sessionToken` 一类信息，不会直接给真实 OAuth `refresh_token`。  
所以：

- 输入里有 `refresh_token`，转换器就保留
- 输入里没有，目标输出里通常会是空字符串或 `null`

### 2. 为什么 CPA / Cockpit 结构里有 `refresh_token`

因为那是目标格式支持的字段，不代表它一定能从 Web session 直接提取出来。  
这个项目的行为是“尽量透传已有字段”，不是“伪造真实 refresh token”。

### 3. `codex-auth` 适合什么场景

适合把已有 session/account 数据转成类似 Codex `auth.json` 的结构，用于本地配置、调试或导入流程。

## 开发

当前仓库没有前端构建步骤，页面是单文件 HTML，CLI 是原生 Node 脚本。

主要文件：

- [index.html](./index.html)  
  本地前端页面
- [session-converter.js](./session-converter.js)  
  核心转换逻辑，前端和 CLI 共用
- [session-converter-cli.js](./session-converter-cli.js)  
  命令行入口
- [session-converter.test.mjs](./session-converter.test.mjs)  
  核心转换测试
- [session-converter-cli.test.mjs](./session-converter-cli.test.mjs)  
  CLI 测试

## 测试

```bash
npm test
```

## 安全提醒

这些输入通常包含真实凭证，风险等同账号登录态：

- `accessToken`
- `sessionToken`
- `refresh_token`
- `id_token`

建议：

- 只在本机运行
- 不要把原始 JSON 发给别人
- 不要把真实 token 提交进 git
- 如果 token 泄露，尽快失效或轮换

## 许可与备注

如果你准备公开发布自己的改版，建议在 README 里继续保留原始仓库来源链接，避免上游来源丢失。
