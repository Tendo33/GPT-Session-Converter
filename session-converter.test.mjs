import test from "node:test";
import assert from "node:assert/strict";

import SessionConverter from "./session-converter.js";

const { buildOutputDocument, collectSessionLikeObjects, convertSession } = SessionConverter;

function encodeBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64url");
}

function createUnsignedJwt(payload) {
  return `${encodeBase64UrlJson({ alg: "none", typ: "JWT" })}.${encodeBase64UrlJson(payload)}.`;
}

test("convertSession builds Codex auth.json output from a ChatGPT web session", () => {
  const now = new Date("2026-05-15T00:00:00.000Z");
  const expiresAt = "2026-06-07T11:43:54.000Z";
  const accessToken = createUnsignedJwt({
    exp: Math.trunc(Date.parse(expiresAt) / 1000),
    email: "mark@example.com",
    "https://api.openai.com/auth": {
      chatgpt_account_id: "account-123",
      chatgpt_plan_type: "plus",
      chatgpt_user_id: "user-123",
      user_id: "user-123",
    },
  });

  const converted = convertSession({
    user: {
      id: "user-123",
      email: "mark@example.com",
    },
    account: {
      id: "account-123",
      planType: "plus",
    },
    accessToken,
  }, { now });

  assert.equal(converted.codexAuth.auth_mode, "chatgpt");
  assert.equal(converted.codexAuth.OPENAI_API_KEY, null);
  assert.equal(converted.codexAuth.tokens.access_token, accessToken);
  assert.equal(converted.codexAuth.tokens.refresh_token, null);
  assert.equal(converted.codexAuth.tokens.account_id, "account-123");
  assert.equal(converted.codexAuth.last_refresh, now.toISOString());
  assert.match(converted.codexAuth.tokens.id_token, /^[^.]+\.[^.]+\.$/u);
});

test("buildOutputDocument returns a single auth.json object for a single converted record", () => {
  const now = new Date("2026-05-15T00:00:00.000Z");
  const expiresAt = "2026-06-07T11:43:54.000Z";
  const accessToken = createUnsignedJwt({
    exp: Math.trunc(Date.parse(expiresAt) / 1000),
    email: "mark@example.com",
    "https://api.openai.com/auth": {
      chatgpt_account_id: "account-123",
      chatgpt_plan_type: "plus",
      chatgpt_user_id: "user-123",
      user_id: "user-123",
    },
  });

  const converted = convertSession({
    user: {
      id: "user-123",
      email: "mark@example.com",
    },
    account: {
      id: "account-123",
      planType: "plus",
    },
    accessToken,
  }, { now });

  const output = buildOutputDocument("codex-auth", [converted], now);
  assert.equal(output.auth_mode, "chatgpt");
  assert.equal(output.tokens.account_id, "account-123");
});

test("collectSessionLikeObjects also detects Codex auth.json input", () => {
  const idToken = createUnsignedJwt({
    email: "mark@example.com",
    "https://api.openai.com/auth": {
      chatgpt_account_id: "account-123",
    },
  });

  const found = collectSessionLikeObjects({
    auth_mode: "chatgpt",
    tokens: {
      access_token: createUnsignedJwt({ exp: 1780000000 }),
      id_token: idToken,
      account_id: "account-123",
    },
  }, "auth.json");

  assert.equal(found.length, 1);
  assert.equal(found[0].sourceName, "auth.json");
});
