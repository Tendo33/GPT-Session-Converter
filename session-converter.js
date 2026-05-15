function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function decodeBase64(value) {
  if (typeof atob === "function") {
    return atob(value);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("binary");
  }

  throw new Error("Base64 decode is not available in this environment.");
}

function encodeBase64Url(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }

  throw new Error("Base64 encode is not available in this environment.");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = decodeBase64(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64UrlJson(value) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function parseJwtPayload(token) {
  if (typeof token !== "string" || token.trim() === "") {
    return undefined;
  }

  const segments = token.split(".");
  if (segments.length < 2) {
    return undefined;
  }

  try {
    return JSON.parse(decodeBase64Url(segments[1]));
  } catch {
    return undefined;
  }
}

function getOpenAIAuthSection(payload) {
  if (!isPlainObject(payload)) {
    return {};
  }

  const auth = payload["https://api.openai.com/auth"];
  return isPlainObject(auth) ? auth : {};
}

function getOpenAIProfileSection(payload) {
  if (!isPlainObject(payload)) {
    return {};
  }

  const profile = payload["https://api.openai.com/profile"];
  return isPlainObject(profile) ? profile : {};
}

function normalizeTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 1e11 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function timestampFromUnixSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  const date = new Date(numeric * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function epochSecondsFromValue(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.trunc(numeric > 1e11 ? numeric / 1000 : numeric);
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed / 1000) : 0;
}

function buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt) {
  if (!accountId) {
    return undefined;
  }

  const now = Math.trunc(Date.now() / 1000);
  const authInfo = { chatgpt_account_id: accountId };
  const expires = epochSecondsFromValue(expiresAt) || now + 90 * 24 * 60 * 60;

  if (planType) {
    authInfo.chatgpt_plan_type = planType;
  }

  if (userId) {
    authInfo.chatgpt_user_id = userId;
    authInfo.user_id = userId;
  }

  const payload = {
    iat: now,
    exp: expires,
    "https://api.openai.com/auth": authInfo,
  };

  if (email) {
    payload.email = email;
  }

  return `${encodeBase64UrlJson({ alg: "none", typ: "JWT", cpa_synthetic: true })}.${encodeBase64UrlJson(payload)}.`;
}

function getExpiresIn(expiresAt, now = new Date()) {
  if (!expiresAt) {
    return undefined;
  }

  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) {
    return undefined;
  }

  return Math.max(0, Math.floor((expiresMs - now.getTime()) / 1000));
}

function stripUnavailable(value) {
  if (Array.isArray(value)) {
    return value.map(stripUnavailable).filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, stripUnavailable(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return value;
}

function toEmailKey(email) {
  if (typeof email !== "string") {
    return undefined;
  }

  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectAuthJsonLike(item) {
  return isPlainObject(item)
    && isPlainObject(item.tokens)
    && Boolean(firstNonEmpty(item.tokens.access_token, item.tokens.accessToken))
    && (
      item.auth_mode !== undefined
      || item.authMode !== undefined
      || item.OPENAI_API_KEY !== undefined
      || item.last_refresh !== undefined
      || item.tokens?.account_id !== undefined
      || item.tokens?.id_token !== undefined
    );
}

function extractAccessToken(item) {
  return firstNonEmpty(
    item.accessToken,
    item.access_token,
    item.token?.accessToken,
    item.token?.access_token,
    item.credentials?.accessToken,
    item.credentials?.access_token,
    item.tokens?.accessToken,
    item.tokens?.access_token,
  );
}

function extractSessionToken(item) {
  return firstNonEmpty(
    item.sessionToken,
    item.session_token,
    item.token?.sessionToken,
    item.token?.session_token,
    item.credentials?.session_token,
    item.tokens?.sessionToken,
    item.tokens?.session_token,
  );
}

function extractRefreshToken(item) {
  return firstNonEmpty(
    item.refreshToken,
    item.refresh_token,
    item.token?.refreshToken,
    item.token?.refresh_token,
    item.credentials?.refresh_token,
    item.tokens?.refreshToken,
    item.tokens?.refresh_token,
  );
}

function extractIdToken(item) {
  return firstNonEmpty(
    item.idToken,
    item.id_token,
    item.token?.idToken,
    item.token?.id_token,
    item.credentials?.id_token,
    item.tokens?.idToken,
    item.tokens?.id_token,
  );
}

function extractIdentityHints(item, accessPayload, idPayload) {
  const accessAuth = getOpenAIAuthSection(accessPayload);
  const idAuth = getOpenAIAuthSection(idPayload);

  return firstNonEmpty(
    item.user?.email,
    item.email,
    item.name,
    item.providerSpecificData?.chatgptAccountId,
    item.providerSpecificData?.chatgpt_account_id,
    item.tokens?.account_id,
    accessPayload?.email,
    idPayload?.email,
    accessAuth.chatgpt_account_id,
    idAuth.chatgpt_account_id,
    item.id,
  );
}

function collectSessionLikeObjects(value, sourceName = "pasted-json") {
  const found = [];
  const visited = new WeakSet();

  function visit(item, path) {
    if (!isPlainObject(item) && !Array.isArray(item)) {
      return;
    }

    if (isPlainObject(item)) {
      if (visited.has(item)) {
        return;
      }
      visited.add(item);

      const accessToken = extractAccessToken(item);
      const idToken = extractIdToken(item);
      const accessPayload = parseJwtPayload(accessToken);
      const idPayload = parseJwtPayload(idToken);
      const hasIdentity = Boolean(
        isPlainObject(item.user)
        || extractIdentityHints(item, accessPayload, idPayload),
      );

      if (accessToken && hasIdentity) {
        found.push({ value: item, sourceName, path });
        return;
      }

      for (const [key, child] of Object.entries(item)) {
        if (
          key === "accessToken"
          || key === "access_token"
          || key === "sessionToken"
          || key === "session_token"
          || key === "refresh_token"
          || key === "id_token"
          || (key === "tokens" && detectAuthJsonLike(item))
        ) {
          continue;
        }
        visit(child, `${path}.${key}`);
      }
      return;
    }

    item.forEach((child, index) => visit(child, `${path}[${index}]`));
  }

  visit(value, "$");
  return found;
}

function convertSession(record, options = {}) {
  if (!isPlainObject(record)) {
    throw new Error("session 不是 JSON 对象");
  }

  const accessToken = extractAccessToken(record);
  if (!accessToken) {
    throw new Error("缺少 accessToken");
  }

  const sessionToken = extractSessionToken(record);
  const refreshToken = extractRefreshToken(record);
  const inputIdToken = extractIdToken(record);
  const payload = parseJwtPayload(accessToken);
  const idPayload = parseJwtPayload(inputIdToken);
  const auth = getOpenAIAuthSection(payload);
  const idAuth = getOpenAIAuthSection(idPayload);
  const profile = getOpenAIProfileSection(payload);
  const now = options.now || new Date();
  const exportedAt = normalizeTimestamp(now);
  const lastRefresh = normalizeTimestamp(record.last_refresh) || exportedAt;
  const expiresAt = firstNonEmpty(
    payload ? timestampFromUnixSeconds(payload.exp) : undefined,
    normalizeTimestamp(record.expires),
    normalizeTimestamp(record.expiresAt),
    normalizeTimestamp(record.expired),
    normalizeTimestamp(record.expires_at),
  );
  const email = firstNonEmpty(
    record.user?.email,
    record.email,
    record.credentials?.email,
    record.providerSpecificData?.email,
    profile.email,
    idPayload?.email,
    payload?.email,
  );
  const accountId = firstNonEmpty(
    record.account?.id,
    record.account_id,
    record.chatgptAccountId,
    record.providerSpecificData?.chatgptAccountId,
    record.providerSpecificData?.chatgpt_account_id,
    record.credentials?.chatgpt_account_id,
    record.tokens?.account_id,
    auth.chatgpt_account_id,
    idAuth.chatgpt_account_id,
    record.provider === "codex" ? record.id : undefined,
  );
  const userId = firstNonEmpty(
    record.user?.id,
    record.user_id,
    record.chatgptUserId,
    record.providerSpecificData?.chatgptUserId,
    record.providerSpecificData?.chatgpt_user_id,
    auth.chatgpt_user_id,
    auth.user_id,
    idAuth.chatgpt_user_id,
    idAuth.user_id,
  );
  const planType = firstNonEmpty(
    record.account?.planType,
    record.account?.plan_type,
    record.planType,
    record.plan_type,
    record.providerSpecificData?.chatgptPlanType,
    record.providerSpecificData?.chatgpt_plan_type,
    record.credentials?.plan_type,
    auth.chatgpt_plan_type,
    idAuth.chatgpt_plan_type,
  );
  const expiresIn = getExpiresIn(expiresAt, now);
  const sourceName = firstNonEmpty(options.sourceName, "pasted-json");
  const sourceType = record.provider === "codex" && record.authType === "oauth"
    ? "9router"
    : detectAuthJsonLike(record)
      ? "codex_auth_json"
      : "chatgpt_web_session";
  const name = firstNonEmpty(email, sourceName, "ChatGPT Account");
  const syntheticIdToken = !inputIdToken
    ? buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt)
    : undefined;
  const idToken = firstNonEmpty(inputIdToken, syntheticIdToken);

  const cpa = Object.fromEntries(Object.entries({
    type: "codex",
    account_id: accountId,
    chatgpt_account_id: accountId,
    email,
    name,
    plan_type: planType,
    chatgpt_plan_type: planType,
    id_token: idToken,
    id_token_synthetic: Boolean(syntheticIdToken) || undefined,
    access_token: accessToken,
    refresh_token: refreshToken || "",
    session_token: sessionToken,
    last_refresh: exportedAt,
    expired: expiresAt,
    disabled: Boolean(record.disabled) || undefined,
  }).filter(([, value]) => value !== undefined && value !== null));

  const cockpit = {
    type: "codex",
    id_token: idToken,
    access_token: accessToken,
    refresh_token: refreshToken || "",
    account_id: accountId,
    last_refresh: exportedAt,
    email,
    expired: expiresAt,
    account_note: firstNonEmpty(record.account_note, record.accountInfo, record.account_info, record.note, record.notes, record.remark),
  };

  const sub2apiAccount = stripUnavailable({
    name: firstNonEmpty(name, email, sourceName, "ChatGPT Account"),
    platform: "openai",
    type: "oauth",
    concurrency: 10,
    priority: 1,
    credentials: {
      access_token: accessToken,
      chatgpt_account_id: accountId,
      chatgpt_user_id: userId,
      email,
      expires_at: expiresAt,
      expires_in: expiresIn,
      plan_type: planType,
    },
    extra: {
      email,
      email_key: toEmailKey(email),
      name,
      auth_provider: firstNonEmpty(record.authProvider, record.auth_provider),
      source: sourceType,
      last_refresh: exportedAt,
    },
  });
  const priority = Number.isFinite(Number(record.priority)) ? Number(record.priority) : 9;
  const isActive = typeof record.isActive === "boolean" ? record.isActive : !Boolean(record.disabled);
  const createdAt = normalizeTimestamp(record.createdAt) || exportedAt;
  const updatedAt = normalizeTimestamp(record.updatedAt) || exportedAt;
  const nineRouter = stripUnavailable({
    accessToken,
    refreshToken,
    expiresAt,
    testStatus: firstNonEmpty(record.testStatus, record.test_status, "active"),
    expiresIn,
    providerSpecificData: {
      chatgptAccountId: accountId,
      chatgptPlanType: planType,
    },
    id: accountId,
    provider: "codex",
    authType: "oauth",
    name,
    email,
    priority,
    isActive,
    createdAt,
    updatedAt,
  });
  const codexAuth = {
    auth_mode: firstNonEmpty(record.auth_mode, record.authMode, "chatgpt") || "chatgpt",
    OPENAI_API_KEY: normalizeOptionalString(record.OPENAI_API_KEY),
    tokens: {
      id_token: idToken || null,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      account_id: accountId || null,
    },
    last_refresh: lastRefresh,
  };

  return {
    sourceName,
    sourcePath: options.sourcePath,
    email,
    name,
    expiresAt,
    cpa,
    cockpit,
    nineRouter,
    sub2apiAccount,
    codexAuth,
  };
}

function buildSub2apiDocument(converted, now = new Date()) {
  return {
    exported_at: normalizeTimestamp(now),
    proxies: [],
    accounts: converted.map((item) => item.sub2apiAccount),
  };
}

function buildOutputDocument(format, converted, now = new Date()) {
  if (format === "sub2api") {
    return buildSub2apiDocument(converted, now);
  }

  if (format === "cpa") {
    return converted.length === 1
      ? converted[0].cpa
      : converted.map((item) => item.cpa);
  }

  if (format === "cockpit") {
    return converted.length === 1
      ? converted[0].cockpit
      : converted.map((item) => item.cockpit);
  }

  if (format === "9router") {
    return converted.length === 1
      ? converted[0].nineRouter
      : converted.map((item) => item.nineRouter);
  }

  if (format === "codex-auth") {
    return converted.length === 1
      ? converted[0].codexAuth
      : converted.map((item) => item.codexAuth);
  }

  return buildSub2apiDocument(converted, now);
}

const SessionConverter = {
  normalizeTimestamp,
  collectSessionLikeObjects,
  convertSession,
  buildSub2apiDocument,
  buildOutputDocument,
};

if (typeof globalThis !== "undefined") {
  globalThis.SessionConverter = SessionConverter;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SessionConverter;
}
