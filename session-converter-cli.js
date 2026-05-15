#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const {
  buildOutputDocument,
  collectSessionLikeObjects,
  convertSession,
} = require("./session-converter.js");

const SUPPORTED_FORMATS = new Set(["sub2api", "cpa", "cockpit", "9router", "codex-auth"]);

function printHelp() {
  process.stdout.write(`GPT Session Converter CLI

Usage:
  node session-converter-cli.js [options] <input.json ...>
  cat session.json | node session-converter-cli.js [options]

Options:
  -f, --format <name>   Output format: sub2api | cpa | cockpit | 9router | codex-auth
  -o, --output <path>   Write output to a file. Use "-" to force stdout.
      --pretty <n>      JSON indentation width. Default: 2
      --compact         Output minified JSON
      --stdin           Read JSON from stdin even if input paths are also present
  -h, --help            Show this help message
`);
}

function parseArgs(argv) {
  const options = {
    format: "sub2api",
    outputPath: null,
    pretty: 2,
    readStdin: false,
    inputs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "-f" || arg === "--format") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("缺少 --format 的值。");
      }
      options.format = value;
      index += 1;
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("缺少 --output 的值。");
      }
      options.outputPath = value;
      index += 1;
      continue;
    }

    if (arg === "--pretty") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("缺少 --pretty 的值。");
      }

      const pretty = Number.parseInt(value, 10);
      if (!Number.isInteger(pretty) || pretty < 0 || pretty > 8) {
        throw new Error("--pretty 只能是 0 到 8 之间的整数。");
      }

      options.pretty = pretty;
      index += 1;
      continue;
    }

    if (arg === "--compact") {
      options.pretty = 0;
      continue;
    }

    if (arg === "--stdin") {
      options.readStdin = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`未知参数：${arg}`);
    }

    options.inputs.push(arg);
  }

  if (!SUPPORTED_FORMATS.has(options.format)) {
    throw new Error(`不支持的输出格式：${options.format}`);
  }

  return options;
}

function readJsonTextFromStdin() {
  return new Promise((resolve, reject) => {
    let buffer = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
    });
    process.stdin.on("end", () => {
      resolve(buffer);
    });
    process.stdin.on("error", reject);
  });
}

function parseSourcesFromText(text, sourceName) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${sourceName} JSON 解析失败：${error.message}`);
  }

  const sources = collectSessionLikeObjects(parsed, sourceName);
  if (!sources.length) {
    throw new Error(`${sourceName} 未找到包含 accessToken 和 user/email 的 session 对象。`);
  }

  return sources;
}

function convertSources(sources, now) {
  const converted = [];
  const skipped = [];

  sources.forEach((item, index) => {
    try {
      converted.push(convertSession(item.value, {
        now,
        sourceName: item.sourceName,
        sourcePath: item.path || `$[${index}]`,
      }));
    } catch (error) {
      skipped.push({
        sourceName: item.sourceName,
        path: item.path || `$[${index}]`,
        reason: error instanceof Error ? error.message : "无法转换",
      });
    }
  });

  return { converted, skipped };
}

function writeOutput(text, outputPath) {
  if (!outputPath || outputPath === "-") {
    process.stdout.write(`${text}\n`);
    return;
  }

  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${text}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const documents = [];
  const shouldReadStdin = options.readStdin || !options.inputs.length;

  if (shouldReadStdin && process.stdin.isTTY) {
    throw new Error("没有收到输入。请提供 JSON 文件路径，或通过 stdin 传入 JSON。");
  }

  if (shouldReadStdin) {
    const text = await readJsonTextFromStdin();
    if (!text.trim()) {
      throw new Error("没有收到输入。请提供 JSON 文件路径，或通过 stdin 传入 JSON。");
    }
    documents.push(...parseSourcesFromText(text, "stdin"));
  }

  options.inputs.forEach((inputPath) => {
    const absoluteInputPath = path.resolve(process.cwd(), inputPath);
    const text = fs.readFileSync(absoluteInputPath, "utf8");
    documents.push(...parseSourcesFromText(text, inputPath));
  });

  const now = new Date();
  const { converted, skipped } = convertSources(documents, now);
  if (!converted.length) {
    const details = skipped.map((item) => `${item.sourceName} ${item.path}: ${item.reason}`).join("\n");
    throw new Error(details || "没有可转换账号。");
  }

  const outputDocument = buildOutputDocument(options.format, converted, now);
  const outputText = JSON.stringify(outputDocument, null, options.pretty || 0);
  writeOutput(outputText, options.outputPath);

  if (skipped.length) {
    process.stderr.write(`已跳过 ${skipped.length} 项。\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
