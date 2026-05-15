# GPT-Session-Converter

本地转换 ChatGPT session JSON，支持网页端和 CLI。

## CLI

直接用 Node：

```bash
node session-converter-cli.js --format codex-auth ./session.json
```

也可以走 stdin：

```bash
cat session.json | node session-converter-cli.js --format sub2api
```

输出到文件：

```bash
node session-converter-cli.js -f cockpit -o ./out.json ./session.json
```

可选格式：

- `sub2api`
- `cpa`
- `cockpit`
- `9router`
- `codex-auth`

帮助：

```bash
node session-converter-cli.js --help
```

测试：

```bash
npm test
```
