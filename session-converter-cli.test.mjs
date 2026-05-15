import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function encodeBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createUnsignedJwt(payload) {
  return `${encodeBase64UrlJson({ alg: "none", typ: "JWT" })}.${encodeBase64UrlJson(payload)}.`;
}

function buildSession(email, accountId, userId, planType, expiresAt) {
  return {
    user: {
      id: userId,
      email,
    },
    account: {
      id: accountId,
      planType,
    },
    accessToken: createUnsignedJwt({
      exp: Math.trunc(Date.parse(expiresAt) / 1000),
      email,
      "https://api.openai.com/auth": {
        chatgpt_account_id: accountId,
        chatgpt_plan_type: planType,
        chatgpt_user_id: userId,
        user_id: userId,
      },
    }),
  };
}

test("CLI converts a file to Codex auth.json output", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-converter-cli-"));
  const inputPath = path.join(tempDir, "session.json");
  const cliPath = path.resolve("session-converter-cli.js");

  fs.writeFileSync(inputPath, JSON.stringify(
    buildSession("mark@example.com", "account-123", "user-123", "plus", "2026-06-07T11:43:54.000Z"),
    null,
    2,
  ));

  const result = spawnSync(process.execPath, [cliPath, "--format", "codex-auth", inputPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");

  const output = JSON.parse(result.stdout);
  assert.equal(output.auth_mode, "chatgpt");
  assert.equal(output.tokens.account_id, "account-123");
  assert.equal(output.tokens.refresh_token, null);
});

test("CLI reads from stdin and writes sub2api output to a file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-converter-cli-"));
  const outputPath = path.join(tempDir, "sub2api.json");
  const cliPath = path.resolve("session-converter-cli.js");
  const payload = [
    buildSession("alpha@example.com", "account-alpha", "user-alpha", "plus", "2026-06-07T11:43:54.000Z"),
    buildSession("beta@example.com", "account-beta", "user-beta", "pro", "2026-07-07T11:43:54.000Z"),
  ];

  const result = spawnSync(process.execPath, [cliPath, "-f", "sub2api", "-o", outputPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: JSON.stringify(payload),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");

  const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(output.accounts.length, 2);
  assert.equal(output.accounts[0].credentials.chatgpt_account_id, "account-alpha");
  assert.equal(output.accounts[1].credentials.chatgpt_account_id, "account-beta");
});
