import { UserDao } from "../../lambda/dao/userDao";
import type { IDI } from "../../lambda/utils/di";

export const ADMIN_EMAIL = "lee88823@naver.com";
export const MCP_ACTIVITY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const MCP_ACTIVITY_ACTIVE_MS = 15 * 60 * 1000;

interface D1Result<T> { results?: T[]; success: boolean }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(sql: string): D1Statement }
interface AssetBinding { fetch(request: Request): Promise<Response> }
export interface CloudflareAdminEnv {
  DB: D1Database;
  STATIC_ASSETS: AssetBinding;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

interface JwtClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  email?: string;
}
interface AccessJwk extends JsonWebKey { kid?: string; alg?: string; kty?: string }

const keyCache = new Map<string, { expiresAt: number; keys: AccessJwk[] }>();

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function expectedIssuer(teamDomain: string): string | undefined {
  try {
    const url = new URL(teamDomain.includes("://") ? teamDomain : `https://${teamDomain}`);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch { return undefined; }
}

export async function CloudflareAccess_verifyJwt(
  assertion: string,
  options: { teamDomain: string; audience: string; keys: AccessJwk[]; nowSeconds?: number }
): Promise<JwtClaims | undefined> {
  const issuer = expectedIssuer(options.teamDomain);
  if (!issuer || !options.audience) return undefined;
  const parts = assertion.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as { alg?: string; kid?: string };
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as JwtClaims;
    if (header.alg !== "RS256" || !header.kid) return undefined;
    const key = options.keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA" && (!candidate.alg || candidate.alg === "RS256"));
    if (!key) return undefined;
    const cryptoKey = await crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const validSignature = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!validSignature) return undefined;
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== issuer || !audiences.includes(options.audience)) return undefined;
    if (!Number.isFinite(claims.exp) || (claims.exp as number) <= now) return undefined;
    if (!Number.isFinite(claims.iat) || (claims.iat as number) > now + 60) return undefined;
    if (claims.nbf != null && (!Number.isFinite(claims.nbf) || claims.nbf > now + 60)) return undefined;
    if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 512) return undefined;
    if (typeof claims.email !== "string" || claims.email.trim().toLowerCase() !== ADMIN_EMAIL) return undefined;
    return claims;
  } catch { return undefined; }
}

async function accessKeys(teamDomain: string, fetcher: typeof fetch): Promise<AccessJwk[] | undefined> {
  const issuer = expectedIssuer(teamDomain);
  if (!issuer) return undefined;
  const cached = keyCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  try {
    const response = await fetcher(`${issuer}/cdn-cgi/access/certs`, { headers: { accept: "application/json" } });
    if (!response.ok) return undefined;
    const body = await response.json() as { keys?: AccessJwk[] };
    if (!Array.isArray(body.keys) || body.keys.length === 0) return undefined;
    keyCache.set(issuer, { keys: body.keys, expiresAt: Date.now() + 5 * 60 * 1000 });
    return body.keys;
  } catch { return undefined; }
}

export async function CloudflareAdmin_authorized(request: Request, env: CloudflareAdminEnv): Promise<boolean> {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();
  // Missing Access setup is a closed gate, never a fallback to the app's email/password login.
  if (!teamDomain || !audience) return false;
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion || assertion.length > 16_384) return false;
  const keys = await accessKeys(teamDomain, fetch);
  if (!keys) return false;
  return !!(await CloudflareAccess_verifyJwt(assertion, { teamDomain, audience, keys }));
}

function noStoreJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}

function denied(): Response { return noStoreJson(403, { error: "admin_access_denied" }); }

export async function CloudflareAdmin_overview(request: Request, env: CloudflareAdminEnv, di: IDI): Promise<Response> {
  if (!await CloudflareAdmin_authorized(request, env)) return denied();
  const now = Date.now();
  const cutoff = now - MCP_ACTIVITY_RETENTION_MS;
  const counts = await env.DB.prepare(
    "SELECT COUNT(DISTINCT CASE WHEN at >= ? THEN user_id END) AS activeMcpAccounts, COUNT(DISTINCT user_id) AS totalMcpAccounts FROM mcp_activity WHERE at >= ?"
  ).bind(now - MCP_ACTIVITY_ACTIVE_MS, cutoff).first<{ activeMcpAccounts: number; totalMcpAccounts: number }>();
  const result = await env.DB.prepare(
    "SELECT user_id AS userId, MAX(at) AS lastActivityAt, COUNT(*) AS activityCount FROM mcp_activity WHERE at >= ? GROUP BY user_id ORDER BY lastActivityAt DESC LIMIT 500"
  ).bind(cutoff).all<{ userId: string; lastActivityAt: number; activityCount: number }>();
  const users = await Promise.all((result.results ?? []).map(async (row) => {
    const user = await new UserDao(di).getLimitedById(row.userId);
    return {
      userId: row.userId,
      email: user?.email ?? "[account unavailable]",
      active: row.lastActivityAt >= now - MCP_ACTIVITY_ACTIVE_MS,
      lastActivityAt: row.lastActivityAt,
      activityCount: row.activityCount,
      activeUntil: row.lastActivityAt + MCP_ACTIVITY_ACTIVE_MS,
    };
  }));
  return noStoreJson(200, {
    generatedAt: now,
    activityWindowDays: 30,
    activeWindowMinutes: 15,
    activeMcpAccounts: counts?.activeMcpAccounts ?? 0,
    totalMcpAccounts: counts?.totalMcpAccounts ?? 0,
    accountListLimit: 500,
    accountsTruncated: (counts?.totalMcpAccounts ?? 0) > users.length,
    accounts: users,
  });
}

export async function CloudflareAdmin_accountActivity(
  request: Request,
  env: CloudflareAdminEnv,
  di: IDI,
  userId: string
): Promise<Response> {
  if (!await CloudflareAdmin_authorized(request, env)) return denied();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return noStoreJson(400, { error: "invalid_user_id" });
  const user = await new UserDao(di).getLimitedById(userId);
  if (!user) return noStoreJson(404, { error: "account_not_found" });
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isSafeInteger(requested) || requested < 1) return noStoreJson(400, { error: "invalid_limit" });
  const limit = Math.min(requested, 100);
  const cutoff = Date.now() - MCP_ACTIVITY_RETENTION_MS;
  const result = await env.DB.prepare(
    "SELECT at, tool_name AS toolName, auth_type AS authType, request_json AS requestJson, truncated, redacted_fields AS redactedFields FROM mcp_activity WHERE user_id = ? AND at >= ? ORDER BY at DESC LIMIT ?"
  ).bind(userId, cutoff, limit).all<{ at: number; toolName: string; authType: "oauth" | "api_key"; requestJson: string; truncated: number; redactedFields: number }>();
  const activities = (result.results ?? []).map((row) => ({
    at: row.at,
    toolName: row.toolName,
    authType: row.authType,
    request: JSON.parse(row.requestJson) as unknown,
    truncated: row.truncated === 1,
    redactedFields: row.redactedFields,
  }));
  return noStoreJson(200, { userId, email: user.email, activities, hasMore: activities.length === limit });
}

export async function CloudflareAdmin_staticAsset(request: Request, env: CloudflareAdminEnv): Promise<Response> {
  if (!await CloudflareAdmin_authorized(request, env)) return new Response("Forbidden", { status: 403, headers: { "cache-control": "private, no-store" } });
  const url = new URL(request.url);
  if (url.pathname === "/admin") return Response.redirect(new URL("/admin/", url).toString(), 302);
  const headers = new Headers(request.headers);
  headers.delete("cf-access-jwt-assertion");
  const response = await env.STATIC_ASSETS.fetch(new Request(request, { headers }));
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("cache-control", "private, no-store");
  responseHeaders.set("x-content-type-options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}
