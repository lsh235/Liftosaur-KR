/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import "mocha";
import { generateKeyPairSync, sign } from "node:crypto";
import { CloudflareAdmin_accountActivity, CloudflareAdmin_overview, CloudflareAdmin_staticAsset, CloudflareAccess_verifyJwt } from "../cloudflare/tigerfit/admin";
import { D1DynamoUtil } from "../cloudflare/tigerfit";
import { UserDao } from "../lambda/dao/userDao";
import { UserRow_pack } from "../lambda/utils/userRow";
import { McpActivity_sanitize } from "../lambda/utils/mcpActivity";
import type { IDI } from "../lambda/utils/di";

class SqliteD1Statement {
  private values: unknown[] = [];
  private readonly db: any;
  private readonly sql: string;
  constructor(db: any, sql: string) { this.db = db; this.sql = sql; }
  bind(...values: unknown[]): this { this.values = values; return this; }
  async all<T = Record<string, unknown>>(): Promise<{ success: boolean; results: T[] }> {
    return { success: true, results: this.db.prepare(this.sql).all(...this.values) as T[] };
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.prepare(this.sql).get(...this.values) as T | null;
  }
  async run(): Promise<unknown> { return this.db.prepare(this.sql).run(...this.values); }
}

function signedAccessAssertion(privateKey: any, audience: string, email = "lee88823@naver.com", now = Math.floor(Date.now() / 1000)) {
  const encode = (input: unknown) => Buffer.from(JSON.stringify(input)).toString("base64url");
  const header = encode({ alg: "RS256", kid: "test-key" });
  const payload = encode({ iss: "https://team.cloudflareaccess.com", aud: [audience], sub: "access-sub", email, iat: now, exp: now + 300 });
  const input = `${header}.${payload}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

describe("TigerFit MCP admin access and activity audit", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...(publicKey.export({ format: "jwk" }) as JsonWebKey), kid: "test-key", alg: "RS256", kty: "RSA" };
  const audience = "test-admin-audience";
  const now = Math.floor(Date.now() / 1000);

  it("validates Access JWT signature, issuer, audience, expiry, and the exact admin email", async () => {
    const valid = signedAccessAssertion(privateKey, audience);
    expect(await CloudflareAccess_verifyJwt(valid, { teamDomain: "team.cloudflareaccess.com", audience, keys: [jwk], nowSeconds: now })).to.have.property("sub", "access-sub");
    expect(await CloudflareAccess_verifyJwt(signedAccessAssertion(privateKey, "other"), { teamDomain: "team.cloudflareaccess.com", audience, keys: [jwk], nowSeconds: now })).to.equal(undefined);
    expect(await CloudflareAccess_verifyJwt(signedAccessAssertion(privateKey, audience, "attacker@example.com"), { teamDomain: "team.cloudflareaccess.com", audience, keys: [jwk], nowSeconds: now })).to.equal(undefined);
    const expired = signedAccessAssertion(privateKey, audience, "lee88823@naver.com", now - 500);
    expect(await CloudflareAccess_verifyJwt(expired, { teamDomain: "team.cloudflareaccess.com", audience, keys: [jwk], nowSeconds: now })).to.equal(undefined);
    const parts = valid.split(".");
    parts[1] = Buffer.from(JSON.stringify({ iss: "https://team.cloudflareaccess.com", aud: audience, email: "lee88823@naver.com", sub: "access-sub", iat: now, exp: now + 300 })).toString("base64url");
    expect(await CloudflareAccess_verifyJwt(parts.join("."), { teamDomain: "team.cloudflareaccess.com", audience, keys: [jwk], nowSeconds: now })).to.equal(undefined);
    expect(await CloudflareAccess_verifyJwt(valid, { teamDomain: "http://team.cloudflareaccess.com", audience, keys: [jwk], nowSeconds: now })).to.equal(undefined);
  });

  it("redacts nested credentials and bounds the stored request body", () => {
    const snapshot = McpActivity_sanitize({
      programText: "Bench Press / 3x5 / 100lb",
      nested: { apiKey: "never-store", sessionId: "workout-session-secret", privateKey: "private-material", note: "Bearer abcdefghijklmnop", text: "password=secret-value api_key=another-secret sk-proj-abcdefghijklmnopqrstuvwxyz0123456789" },
      oversize: "x".repeat(20_000),
    });
    expect(snapshot.requestJson.length).to.be.at.most(8_000);
    expect(snapshot.requestJson).to.include("Bench Press");
    expect(snapshot.requestJson).not.to.include("never-store");
    expect(snapshot.requestJson).not.to.include("workout-session-secret");
    expect(snapshot.requestJson).not.to.include("private-material");
    expect(snapshot.requestJson).not.to.include("secret-value");
    expect(snapshot.requestJson).not.to.include("another-secret");
    expect(snapshot.requestJson).not.to.include("sk-proj-abcdefghijklmnopqrstuvwxyz0123456789");
    expect(snapshot.requestJson).not.to.include("Bearer abcdefghijklmnop");
    expect(snapshot.redactedFields).to.be.at.least(3);
    expect(snapshot.truncated).to.equal(true);
  });

  it("serves account aggregates and sanitized request details only to a valid Access assertion", async () => {
    const DatabaseSync = (require("node:sqlite") as { DatabaseSync: new (path: string) => any }).DatabaseSync;
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE app_items (table_name TEXT NOT NULL, key_json TEXT NOT NULL, item_json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (table_name, key_json))");
    db.exec("CREATE TABLE mcp_activity (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, at INTEGER NOT NULL, tool_name TEXT NOT NULL, auth_type TEXT NOT NULL, request_json TEXT NOT NULL, truncated INTEGER NOT NULL, redacted_fields INTEGER NOT NULL)");
    db.exec("CREATE INDEX mcp_activity_by_user_time ON mcp_activity (user_id, at DESC)");
    const database = { prepare: (sql: string) => new SqliteD1Statement(db, sql), batch: async (items: any[]) => Promise.all(items.map((item) => item.run())) };
    const di = { dynamo: new D1DynamoUtil(database as any) } as unknown as IDI;
    (global as any).__ENV__ = "prod";
    await di.dynamo.put({ tableName: "lftUsers", item: UserRow_pack(UserDao.build("user_1", "member@example.com", { emailVerifiedAt: Date.now() })) as any });
    const current = Date.now();
    db.prepare("INSERT INTO mcp_activity VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("recent", "user_1", current, "get_history", "oauth", JSON.stringify({ start: "2026-10-01", sessionId: "[redacted]" }), 0, 1);
    db.prepare("INSERT INTO mcp_activity VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("old", "user_1", current - 31 * 24 * 60 * 60 * 1000, "get_program", "api_key", "{}", 0, 0);
    const bulkInsert = db.prepare("INSERT INTO mcp_activity VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (let index = 0; index < 501; index += 1) {
      bulkInsert.run(`bulk_${index}`, `bulk-user-${index}`, current - 1_000, "get_program", "oauth", "{}", 0, 0);
    }

    const originalFetch = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })) as typeof fetch;
    try {
      let assetSawAssertion = false;
      const env: any = { DB: database, STATIC_ASSETS: { fetch: async (request: Request) => {
        assetSawAssertion = request.headers.has("cf-access-jwt-assertion");
        return new Response("admin-ui");
      } }, CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", CF_ACCESS_AUD: audience };
      const request = new Request("https://tigerfit.aixtech.uk/api/admin/overview", { headers: { "cf-access-jwt-assertion": signedAccessAssertion(privateKey, audience) } });
      const overviewResponse = await CloudflareAdmin_overview(request, env, di);
      expect(overviewResponse.status).to.equal(200);
      const overview = await overviewResponse.json() as any;
      expect(overview.activeMcpAccounts).to.equal(502);
      expect(overview.totalMcpAccounts).to.equal(502);
      expect(overview.accountListLimit).to.equal(500);
      expect(overview.accountsTruncated).to.equal(true);
      expect(overview.accounts).to.have.length(500);
      expect(overview.accounts[0]).to.include({ userId: "user_1", email: "member@example.com", activityCount: 1, active: true });

      const validAsset = await CloudflareAdmin_staticAsset(new Request("https://tigerfit.aixtech.uk/admin/", { headers: { "cf-access-jwt-assertion": signedAccessAssertion(privateKey, audience) } }), env);
      expect(validAsset.status).to.equal(200);
      expect(validAsset.headers.get("cache-control")).to.equal("private, no-store");
      expect(assetSawAssertion).to.equal(false);

      const detail = await CloudflareAdmin_accountActivity(new Request("https://tigerfit.aixtech.uk/api/admin/accounts/user_1/activity", { headers: { "cf-access-jwt-assertion": signedAccessAssertion(privateKey, audience) } }), env, di, "user_1");
      expect(detail.status).to.equal(200);
      expect(await detail.json()).to.deep.include({ userId: "user_1", email: "member@example.com" });

      const wrong = signedAccessAssertion(privateKey, audience, "not-admin@example.com");
      expect((await CloudflareAdmin_overview(new Request("https://tigerfit.aixtech.uk/api/admin/overview", { headers: { "cf-access-jwt-assertion": wrong } }), env, di)).status).to.equal(403);
      expect((await CloudflareAdmin_overview(request, { ...env, CF_ACCESS_AUD: "" }, di)).status).to.equal(403);
      const asset = await CloudflareAdmin_staticAsset(new Request("https://tigerfit.aixtech.uk/admin/", { headers: { "cf-access-jwt-assertion": wrong } }), env);
      expect(asset.status).to.equal(403);
    } finally {
      global.fetch = originalFetch;
      db.close();
    }
  });
});
