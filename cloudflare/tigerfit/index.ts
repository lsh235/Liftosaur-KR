import { getMcpHandler, postMcpHandler, deleteMcpHandler } from "../../lambda/mcp/handler";
import {
  getProtectedResourceHandler,
  getAuthServerMetadataHandler,
  postOauthRegisterHandler,
  getOauthAuthorizeHandler,
  postOauthAuthorizeHandler,
  postOauthTokenHandler,
} from "../../lambda/mcp/oauth";
import mcpReferenceFiles from "./reference-data.json";
import { McpReference_setFiles } from "../../lambda/mcp/reference";
import { UserDao } from "../../lambda/dao/userDao";
import { PasswordHash_hash, PasswordHash_verify } from "../../lambda/utils/passwordHash";
import { UidFactory_generateUid } from "../../lambda/utils/generator";
import { NodeEncoder_decode } from "../../lambda/utils/nodeEncoder";
import { SyncAccountGuard_decide } from "../../lambda/utils/syncAccountGuard";
import { DirtySyncRead_args } from "../../lambda/utils/dirtySyncRead";
import { StorageDao } from "../../lambda/dao/storageDao";
import { EventDao } from "../../lambda/dao/eventDao";
import * as Cookie from "cookie";
import JWT from "jsonwebtoken";
import {
  getV1ProgramsHandler,
  getV1ProgramHandler,
  postV1ProgramHandler,
  putV1ProgramHandler,
  deleteV1ProgramHandler,
  postV1PlaygroundHandler,
  postV1ProgramStatsHandler,
} from "../../lambda/api/v1";
import type { IDynamoUtil } from "../../lambda/utils/dynamo";
import type { IDI } from "../../lambda/utils/di";

interface D1Result<T> {
  results?: T[];
  success: boolean;
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

interface R2ObjectLike {
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectLike | null>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: unknown): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }>;
}

interface Env {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  STATIC_ASSETS: { fetch(request: Request): Promise<Response> };
  COOKIE_SECRET: string;
  API_SECRET?: string;
  CRYPTO_SECRET?: string;
  HOST: string;
  MCP_BASE_URL: string;
  SESSION_COOKIE_DOMAIN: string;
  IS_DEV: string;
  IS_LOCAL: string;
  MCP_ALLOW_SELF_HOSTED: string;
  COMMIT_HASH: string;
  FROM_EMAIL?: string;
}

type Item = Record<string, unknown>;

McpReference_setFiles(mcpReferenceFiles as Record<string, string>);

const KEY_FIELDS: Record<string, string[]> = {
  lftUsers: ["id"],
  lftUserPrograms: ["id", "userId"],
  lftHistoryRecords: ["id", "userId"],
  lftStats: ["name", "userId"],
  lftEvents: ["timestamp", "userId"],
  lftApiKeys: ["key"],
  lftOauthClients: ["clientId"],
  lftOauthAuthCodes: ["code"],
  lftOauthTokens: ["token"],
  lftEmailAuthTokens: ["token"],
  lftEmailAuthAttempts: ["id"],
};

function stableJson(value: unknown): string {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const record = value as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]])));
}

function reviveItem<T>(raw: string): T {
  return JSON.parse(raw, (_key, value) => {
    if (value && value.type === "Buffer" && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }
    return value;
  }) as T;
}

function normalizeTable(name: string): string {
  return name.replace(/Dev$/, "");
}

function canonicalItem(item: Item): Item {
  return reviveItem<Item>(JSON.stringify(item));
}

function resolveName(name: string, names?: Record<string, string>): string {
  return name.replace(/#[A-Za-z0-9_]+/g, (placeholder) => names?.[placeholder] ?? placeholder);
}

function valueAt(item: Item, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (value == null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, item);
}

function evaluateCondition(
  item: Item,
  expression: string | undefined,
  names: Record<string, string> | undefined,
  values: Record<string, unknown> | undefined
): boolean {
  if (!expression) return true;
  const resolved = resolveName(expression, names);
  const safeAnd = resolved.replace(/(\S+)\s+BETWEEN\s+(:[\w]+)\s+AND\s+(:[\w]+)/gi, "$1 BETWEEN $2 __AND__ $3");
  const clauses = safeAnd.replace(/[()]/g, " ").split(/\s+AND\s+/i)
    .map((part) => part.replace("__AND__", "AND").trim()).filter(Boolean);
  return clauses.every((clause) => {
    const exists = clause.match(/^attribute_exists\(([^)]+)\)$/i);
    if (exists) return valueAt(item, exists[1].trim()) !== undefined;
    const notExists = clause.match(/^attribute_not_exists\(([^)]+)\)$/i);
    if (notExists) return valueAt(item, notExists[1].trim()) === undefined;
    const contains = clause.match(/^contains\(([^,]+),\s*(:[A-Za-z0-9_]+)\)$/i);
    if (contains) {
      const current = valueAt(item, contains[1].trim());
      const wanted = values?.[contains[2]];
      return Array.isArray(current) ? current.includes(wanted) : typeof current === "string" && current.includes(String(wanted));
    }
    const between = clause.match(/^([\w.]+)\s+BETWEEN\s+(:[\w]+)\s+AND\s+(:[\w]+)$/i);
    if (between) {
      const current = valueAt(item, between[1]);
      const min = values?.[between[2]];
      const max = values?.[between[3]];
      return compare(current, min) >= 0 && compare(current, max) <= 0;
    }
    const inList = clause.match(/^([\w.]+)\s+IN\s*\((.+)\)$/i);
    if (inList) {
      const current = valueAt(item, inList[1]);
      const candidates = inList[2].split(",").map((key) => values?.[key.trim()]);
      return candidates.includes(current);
    }
    const compareMatch = clause.match(/^([\w.]+)\s*(=|<>|<=|>=|<|>)\s*(:[\w]+)$/);
    if (!compareMatch) {
      throw new Error(`Cloudflare D1 adapter does not support condition: ${clause}`);
    }
    const left = valueAt(item, compareMatch[1]);
    const right = values?.[compareMatch[3]];
    const compared = compare(left, right);
    switch (compareMatch[2]) {
      case "=": return left === right;
      case "<>": return left !== right;
      case "<": return compared < 0;
      case ">": return compared > 0;
      case "<=": return compared <= 0;
      default: return compared >= 0;
    }
  });
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function projectItem(item: Item, projection?: string, names?: Record<string, string>): Item {
  if (!projection) return item;
  const output: Item = {};
  for (const selector of projection.split(",").map((part) => resolveName(part.trim(), names))) {
    const value = valueAt(item, selector);
    if (value === undefined) continue;
    const path = selector.split(".");
    let destination = output;
    for (const [index, part] of path.entries()) {
      if (index === path.length - 1) destination[part] = value;
      else destination = (destination[part] ??= {}) as Item;
    }
  }
  return output;
}

class D1DynamoUtil implements IDynamoUtil {
  constructor(private readonly db: D1Database) {}

  private key(table: string, value: Item): string {
    const fields = KEY_FIELDS[normalizeTable(table)];
    if (!fields || fields.some((field) => value[field] == null)) {
      throw new Error(`No complete primary-key mapping for D1 table ${table}`);
    }
    return stableJson(Object.fromEntries(fields.map((field) => [field, value[field]])));
  }

  private async rows<T>(table: string): Promise<Array<{ key_json: string; item_json: string; item: T }>> {
    const result = await this.db.prepare("SELECT key_json, item_json FROM app_items WHERE table_name = ?")
      .bind(normalizeTable(table)).all<{ key_json: string; item_json: string }>();
    return (result.results ?? []).map((row) => ({ ...row, item: reviveItem<T>(row.item_json) }));
  }

  private filter<T>(rows: Array<{ key_json: string; item_json: string; item: T }>, expression?: string,
    names?: Record<string, string>, values?: Record<string, unknown>): T[] {
    return rows.map((row) => row.item as Item)
      .filter((item) => evaluateCondition(item, expression, names, values)) as T[];
  }

  private sort<T>(items: T[], table: string, forward = true): T[] {
    const fields = KEY_FIELDS[normalizeTable(table)] ?? [];
    const sortField = fields.find((field) => field !== "userId") ?? fields[fields.length - 1];
    if (!sortField) return items;
    return items.sort((a, b) => compare((a as Item)[sortField], (b as Item)[sortField]) * (forward ? 1 : -1));
  }

  async query<T>(args: { tableName: string; expression: string; filterExpression?: string; indexName?: string;
    scanIndexForward?: boolean; attrs?: Record<string, string>; values?: Record<string, unknown>; limit?: number;
    projection?: string }): Promise<T[]> {
    let items = this.filter(await this.rows<T>(args.tableName), args.expression, args.attrs, args.values);
    items = this.filter(items.map((item) => ({ key_json: "", item_json: "", item })), args.filterExpression,
      args.attrs, args.values);
    this.sort(items, args.tableName, args.scanIndexForward !== false);
    if (args.limit != null) items = items.slice(0, args.limit);
    return items.map((item) => projectItem(item as Item, args.projection, args.attrs) as T);
  }

  async scan<T>(args: { tableName: string; filterExpression?: string; names?: Record<string, string>;
    values?: Record<string, unknown>; limit?: number }): Promise<T[]> {
    let items = this.filter(await this.rows<T>(args.tableName), args.filterExpression, args.names, args.values);
    if (args.limit != null) items = items.slice(0, args.limit);
    return items;
  }

  async *streamingQuery<T>(args: Parameters<IDynamoUtil["query"]>[0]): AsyncGenerator<T[], void, unknown> {
    const items = await this.query<T>({ ...args, tableName: args.tableName, expression: args.expression });
    if (items.length) yield items;
  }

  async *streamingScan<T>(args: Parameters<IDynamoUtil["scan"]>[0]): AsyncGenerator<T[], void, unknown> {
    const items = await this.scan<T>(args);
    if (items.length) yield items;
  }

  async get<T>(args: { tableName: string; key: Item }): Promise<T | undefined> {
    const keyJson = this.key(args.tableName, args.key);
    const row = await this.db.prepare("SELECT item_json FROM app_items WHERE table_name = ? AND key_json = ?")
      .bind(normalizeTable(args.tableName), keyJson).first<{ item_json: string }>();
    return row ? reviveItem<T>(row.item_json) : undefined;
  }

  async put(args: { tableName: string; item: Item }): Promise<void> {
    const table = normalizeTable(args.tableName);
    const item = canonicalItem(args.item);
    const keyJson = this.key(table, item);
    await this.db.prepare("INSERT INTO app_items(table_name, key_json, item_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(table_name, key_json) DO UPDATE SET item_json = excluded.item_json, updated_at = excluded.updated_at")
      .bind(table, keyJson, JSON.stringify(item), Date.now()).run();
  }

  async putIfNotExists(args: { tableName: string; item: Item; partitionKey: string; sortKey?: string }): Promise<boolean> {
    const item = canonicalItem(args.item);
    const fields = [args.partitionKey, ...(args.sortKey ? [args.sortKey] : [])];
    const keyJson = stableJson(Object.fromEntries(fields.map((field) => [field, item[field]])));
    const result = await this.db.prepare("INSERT INTO app_items(table_name, key_json, item_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(table_name, key_json) DO NOTHING")
      .bind(normalizeTable(args.tableName), keyJson, JSON.stringify(item), Date.now()).run() as { meta?: { changes?: number } };
    return result.meta?.changes === 1;
  }

  async update(args: { tableName: string; key: Item; expression: string; attrs?: Record<string, string>;
    values?: Record<string, unknown>; returnValues?: "ALL_NEW" | "UPDATED_NEW" }): Promise<Item | undefined> {
    const current = (await this.get<Item>({ tableName: args.tableName, key: args.key })) ?? { ...args.key };
    const expr = resolveName(args.expression, args.attrs);
    const setClause = expr.match(/(?:^|\s)SET\s+(.+?)(?=\s+(?:REMOVE|ADD|DELETE)\s+|$)/i)?.[1];
    const removeClause = expr.match(/(?:^|\s)REMOVE\s+(.+?)(?=\s+(?:SET|ADD|DELETE)\s+|$)/i)?.[1];
    if (setClause) {
      for (const assignment of setClause.split(/,\s*(?=[#\w.]+\s*=)/)) {
        const match = assignment.match(/^([\w.]+)\s*=\s*(:[\w]+)$/);
        if (!match) throw new Error(`Unsupported D1 update assignment: ${assignment}`);
        const path = match[1].split(".");
        let target = current;
        for (const segment of path.slice(0, -1)) target = (target[segment] ??= {}) as Item;
        target[path[path.length - 1]] = args.values?.[match[2]];
      }
    }
    if (removeClause) {
      for (const field of removeClause.split(",").map((part) => part.trim())) delete current[field];
    }
    await this.put({ tableName: args.tableName, item: current });
    return args.returnValues ? current : undefined;
  }

  async remove(args: { tableName: string; key: Item; condition?: { expression: string; attrs?: Record<string, string>;
    values?: Record<string, unknown> } }): Promise<boolean> {
    const current = await this.get<Item>({ tableName: args.tableName, key: args.key });
    if (!current || !evaluateCondition(current, args.condition?.expression, args.condition?.attrs, args.condition?.values)) {
      return false;
    }
    await this.db.prepare("DELETE FROM app_items WHERE table_name = ? AND key_json = ?")
      .bind(normalizeTable(args.tableName), this.key(args.tableName, args.key)).run();
    return true;
  }

  async batchGet<T>(args: { tableName: string; keys: Item[]; consistentRead?: boolean; projection?: string;
    attrs?: Record<string, string> }): Promise<T[]> {
    const items = await Promise.all(args.keys.map((key) => this.get<T>({ tableName: args.tableName, key })));
    return (items.filter((item) => item != null) as T[])
      .map((item) => projectItem(item as Item, args.projection, args.attrs) as T);
  }

  async batchDelete(args: { tableName: string; keys: Item[] }): Promise<void> {
    if (args.keys.length === 0) return;
    await this.db.batch(args.keys.map((key) => this.db.prepare("DELETE FROM app_items WHERE table_name = ? AND key_json = ?")
      .bind(normalizeTable(args.tableName), this.key(args.tableName, key))));
  }

  async batchPut(args: { tableName: string; items: Item[] }): Promise<void> {
    if (args.items.length === 0) return;
    await this.db.batch(args.items.map((item) => {
      const canonical = canonicalItem(item);
      return this.db.prepare("INSERT INTO app_items(table_name, key_json, item_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(table_name, key_json) DO UPDATE SET item_json = excluded.item_json, updated_at = excluded.updated_at")
        .bind(normalizeTable(args.tableName), this.key(args.tableName, canonical), JSON.stringify(canonical), Date.now());
    }));
  }
}

function buildDi(env: Env): IDI {
  const log = {
    id: crypto.randomUUID().slice(0, 4),
    log: (...values: unknown[]) => console.log(...values),
    setUser: (_userId: string) => undefined,
  };
  const r2 = {
    listObjects: async ({ bucket, prefix }: { bucket: string; prefix: string }) => {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await env.ASSETS_BUCKET.list({ prefix: `${bucket}/${prefix}`, cursor, limit: 1000 });
        keys.push(...page.objects.map((object) => object.key.slice(bucket.length + 1)));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
    getObject: async ({ bucket, key }: { bucket: string; key: string }) => {
      const object = await env.ASSETS_BUCKET.get(`${bucket}/${key}`);
      return object ? Buffer.from(await object.arrayBuffer()) : undefined;
    },
    putObject: async ({ bucket, key, body, opts }: { bucket: string; key: string; body: string | Buffer | Uint8Array;
      opts?: { contentType?: string } }) => {
      await env.ASSETS_BUCKET.put(`${bucket}/${key}`, body, opts?.contentType ? { httpMetadata: { contentType: opts.contentType } } : undefined);
    },
    deleteObject: async ({ bucket, key }: { bucket: string; key: string }) => env.ASSETS_BUCKET.delete(`${bucket}/${key}`),
    getPresignedUploadUrl: async () => { throw new Error("Direct upload URLs are not enabled on this Cloudflare deployment"); },
    getPresignedDownloadUrl: async ({ bucket, key }: { bucket: string; key: string }) =>
      `${env.HOST}/assets/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`,
  };
  const secrets = {
    getCookieSecret: async () => env.COOKIE_SECRET,
    getCryptoKey: async () => env.CRYPTO_SECRET || env.COOKIE_SECRET,
    getApiKey: async () => env.API_SECRET || env.COOKIE_SECRET,
    getWebpushrKey: async () => "",
    getWebpushrAuthToken: async () => "",
    getAppleAppSharedSecret: async () => "",
    getApplePrivateKey: async () => "",
    getAppleKeyId: async () => "",
    getAppleIssuerId: async () => "",
    getGoogleServiceAccountPubsub: async () => ({}),
    getOpenAiKey: async () => "",
    getAnthropicKey: async () => "",
    getApplePromotionalOfferKeyId: async () => "",
    getApplePromotionalOfferPrivateKey: async () => "",
    getUpdatesPrivateKey: async () => "",
  };
  return {
    dynamo: new D1DynamoUtil(env.DB),
    s3: r2 as IDI["s3"],
    secrets: secrets as IDI["secrets"],
    log,
    fetch: globalThis.fetch,
    ses: { sendEmail: async () => { throw new Error("Email delivery is not configured for this self-hosted account"); } },
    lambda: { invoke: async () => undefined },
    cloudwatch: { getLogs: async () => undefined },
    sns: {
      createPlatformEndpoint: async () => { throw new Error("Push delivery is disabled"); },
      setEndpoint: async () => "disabled",
      publish: async () => "disabled",
      deleteEndpoint: async () => undefined,
    },
  } as unknown as IDI;
}

function toApiEvent(request: Request): any {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => { headers[name] = value; });
  const queryStringParameters: Record<string, string> = {};
  url.searchParams.forEach((value, name) => { queryStringParameters[name] = value; });
  return {
    resource: url.pathname,
    path: url.pathname,
    httpMethod: request.method,
    headers,
    multiValueHeaders: {},
    queryStringParameters,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: { requestId: crypto.randomUUID(), identity: { sourceIp: "cloudflare" } },
    body: undefined,
    isBase64Encoded: false,
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function page(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
}

function responseFromApi(result: { statusCode: number; headers?: Record<string, string | number | boolean>; body?: string;
  isBase64Encoded?: boolean }): Response {
  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers ?? {})) headers.set(name, String(value));
  const body = result.isBase64Encoded && result.body
    ? Uint8Array.from(atob(result.body), (char) => char.charCodeAt(0))
    : result.body;
  return new Response(body, { status: result.statusCode, headers });
}

async function callHandler(handler: (args: any) => any, event: any, env: Env, params: Record<string, string> = {}) {
  return responseFromApi(await Promise.resolve(handler({ payload: { event, di: buildDi(env) }, match: { params } })));
}

async function userFromCookie(event: any, env: Env): Promise<string | undefined> {
  const cookies = Cookie.parse(event.headers.cookie ?? event.headers.Cookie ?? "");
  return new UserDao(buildDi(env)).getCurrentUserIdFromCookie(cookies);
}

function safeReturnUrl(value: string | null, origin: string): string {
  if (!value) return `${origin}/app/`;
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? url.toString() : `${origin}/app/`;
  } catch {
    return `${origin}/app/`;
  }
}

function loginPage(origin: string, returnTo: string): string {
  const safeReturn = safeReturnUrl(returnTo, origin);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tigerfit sign in</title>
  <style>body{font:16px system-ui;background:#101414;color:#e7ece8;display:grid;min-height:100vh;place-items:center;margin:0}.card{width:min(420px,calc(100% - 40px));background:#1a2220;padding:28px;border-radius:16px}h1{margin-top:0}label{display:block;margin:16px 0 6px}input{box-sizing:border-box;width:100%;padding:12px;border-radius:8px;border:1px solid #45534e;background:#111816;color:inherit}button{width:100%;padding:12px;margin-top:12px;border:0;border-radius:8px;background:#b4f36b;color:#111;font-weight:700;cursor:pointer}.secondary{background:#35433d;color:#e7ece8}#message{min-height:1.5em;color:#ffbf8a}</style>
  <main class="card"><h1>Tigerfit</h1><p>Sign in to connect your training account to Codex.</p><form id="form"><label>Email</label><input name="email" type="email" autocomplete="username" required><label>Password</label><input name="password" type="password" autocomplete="current-password" minlength="8" required><button name="action" value="signin">Sign in</button><button class="secondary" name="action" value="signup">Create account</button><p id="message" role="status"></p></form></main>
  <script>const form=document.querySelector('#form');form.addEventListener('submit',async e=>{e.preventDefault();const action=e.submitter?.value==='signup'?'signup':'signin';const data=Object.fromEntries(new FormData(form));const message=document.querySelector('#message');message.textContent='Please wait…';try{const res=await fetch('/api/'+action+'/email',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const body=await res.json();if(!res.ok)throw new Error(body.error||'Sign in failed');location.assign(${JSON.stringify(safeReturn)});}catch(err){message.textContent=err.message||'Could not sign in.';}});</script></html>`;
}

function sessionCookie(token: string, origin: string, clear = false): string {
  const hostname = new URL(origin).hostname;
  return `session=${clear ? "" : encodeURIComponent(token)}; Path=/; Domain=${hostname}; HttpOnly; Secure; SameSite=Lax; Expires=${clear ? "Thu, 01 Jan 1970 00:00:00 GMT" : "Fri, 01 Jan 2037 00:00:00 GMT"}`;
}

async function emailAuth(request: Request, env: Env, signUp: boolean): Promise<Response> {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return json(400, { error: "invalid_email" });
  if (password.length < 8 || password.length > 256) return json(400, { error: "invalid_password" });
  const di = buildDi(env);
  const userDao = new UserDao(di);
  const candidates = await userDao.getAllByEmail(email);
  let user;
  if (signUp) {
    if (candidates.length > 0) return json(400, { error: "account_exists" });
    const id = UidFactory_generateUid(12);
    user = UserDao.build(id, email, { passwordHash: await PasswordHash_hash(password), emailVerifiedAt: Date.now() });
    if (!(await userDao.create(user))) return json(409, { error: "account_exists" });
  } else {
    const candidate = candidates.find((row) => row.passwordHash != null);
    if (!candidate?.passwordHash || !(await PasswordHash_verify(password, candidate.passwordHash))) {
      return json(403, { error: "invalid_credentials" });
    }
    user = await userDao.getById(candidate.id, { historyLimit: 20 });
    if (!user) return json(403, { error: "account_not_found" });
  }
  const token = JWT.sign({ userId: user.id }, env.COOKIE_SECRET);
  const native = (request.headers.get("x-client") ?? "").startsWith("liftosaur-native");
  return json(200, {
    email: user.email,
    user_id: user.id,
    storage: user.storage,
    is_new_user: signUp,
    ...(native ? { session: token } : {}),
  }, { "set-cookie": sessionCookie(token, env.HOST) });
}

async function sync2(request: Request, event: any, env: Env): Promise<Response> {
  const userId = await userFromCookie(event, env);
  if (!userId) return json(401, { type: "error", error: "not_authorized" });
  const di = buildDi(env);
  const userDao = new UserDao(di);
  const limitedUser = await userDao.getLimitedById(userId);
  if (!limitedUser) return json(401, { type: "error", error: "not_authorized" });
  const outer = await request.json().catch(() => ({})) as Record<string, unknown>;
  const data = typeof outer.data === "string" ? JSON.parse(await NodeEncoder_decode(outer.data)) : outer;
  const update = data.storageUpdate as any;
  if (!update || typeof update !== "object") return json(400, { type: "error", error: "invalid_storage_update" });
  const tempUserId = new URL(request.url).searchParams.get("tempuserid") ?? undefined;
  let guard = SyncAccountGuard_decide({ cookieUserId: userId, tempUserId });
  if (guard === "lookup" && tempUserId) {
    guard = SyncAccountGuard_decide({ cookieUserId: userId, tempUserId, tempUserIsAccount: !!(await userDao.getLimitedById(tempUserId)) });
  }
  if (guard === "mismatch") return json(409, { type: "error", error: "account_mismatch", email: limitedUser.email, user_id: userId });
  const deviceId = typeof data.deviceId === "string" ? data.deviceId : "unidentified";
  const result = await userDao.applySafeSync2(limitedUser, update, deviceId);
  if (result.success === false) return json(400, { type: "error", error: result.error });
  await Promise.all([
    new StorageDao(di).store(userId, result.data.newStorage, update.storage),
    userDao.maybeSaveProgramRevision(userId, update),
  ]);
  if (update.originalId != null && limitedUser.storage.originalId === update.originalId) {
    return json(200, { type: "clean", new_original_id: result.data.originalId, email: limitedUser.email, user_id: userId });
  }
  const historylimit = Number(data.historylimit) || 20;
  const fullUser = await userDao.getById(userId, DirtySyncRead_args({ hasMergeWrite: result.data.didWrite, historylimit, isWatch: !!data.isWatch }));
  if (!fullUser) return json(401, { type: "error", error: "not_authorized" });
  if (fullUser.storage.tempUserId !== userId) fullUser.storage.tempUserId = userId;
  if (fullUser.storage.history) fullUser.storage.history = fullUser.storage.history.slice(0, historylimit);
  await new EventDao(di).post({
    type: "event", userId, timestamp: Number(data.timestamp) || Date.now(), name: "cloudflare-sync2",
    commithash: env.COMMIT_HASH, extra: { update: EventDao.prepareStorageUpdateForEvent(update) },
  });
  return json(200, { type: "dirty", storage: fullUser.storage, email: limitedUser.email, user_id: userId });
}

async function dispatch(request: Request, env: Env, event: any): Promise<Response | undefined> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/mcp") {
    if (request.method === "POST") return callHandler(postMcpHandler, event, env);
    if (request.method === "GET") return callHandler(getMcpHandler, event, env);
    if (request.method === "DELETE") return callHandler(deleteMcpHandler, event, env);
  }
  if (path === "/.well-known/oauth-protected-resource" || path === "/.well-known/oauth-protected-resource/mcp") {
    return callHandler(getProtectedResourceHandler, event, env);
  }
  if (path === "/.well-known/oauth-authorization-server") return callHandler(getAuthServerMetadataHandler, event, env);
  if (path === "/oauth/register" && request.method === "POST") return callHandler(postOauthRegisterHandler, event, env);
  if (path === "/oauth/authorize" && request.method === "GET") {
    const params = Object.fromEntries(url.searchParams) as Record<string, string>;
    return callHandler(getOauthAuthorizeHandler, event, env, params);
  }
  if (path === "/oauth/authorize" && request.method === "POST") return callHandler(postOauthAuthorizeHandler, event, env);
  if (path === "/oauth/token" && request.method === "POST") return callHandler(postOauthTokenHandler, event, env);
  if (path === "/login" && request.method === "GET") {
    const signedIn = await userFromCookie(event, env);
    if (signedIn) return Response.redirect(safeReturnUrl(url.searchParams.get("url"), env.HOST), 302);
    return page(200, loginPage(env.HOST, url.searchParams.get("url") ?? ""));
  }
  if (path === "/logout" || (path === "/api/signout" && request.method === "POST")) {
    return json(200, { success: true }, { "set-cookie": sessionCookie("", env.HOST, true) });
  }
  if (path === "/api/signup/email" && request.method === "POST") return emailAuth(request, env, true);
  if (path === "/api/signin/email" && request.method === "POST") return emailAuth(request, env, false);
  if (path === "/api/sync2" && request.method === "POST") return sync2(request, event, env);
  if (path === "/api/v1/programs" && request.method === "GET") return callHandler(getV1ProgramsHandler, event, env);
  if (path === "/api/v1/programs" && request.method === "POST") return callHandler(postV1ProgramHandler, event, env);
  const program = path.match(/^\/api\/v1\/programs\/([^/]+)$/);
  if (program && request.method === "GET") return callHandler(getV1ProgramHandler, event, env, { id: decodeURIComponent(program[1]) });
  if (program && request.method === "PUT") return callHandler(putV1ProgramHandler, event, env, { id: decodeURIComponent(program[1]) });
  if (program && request.method === "DELETE") return callHandler(deleteV1ProgramHandler, event, env, { id: decodeURIComponent(program[1]) });
  if (path === "/api/v1/playground" && request.method === "POST") return callHandler(postV1PlaygroundHandler, event, env);
  if (path === "/api/v1/program-stats" && request.method === "POST") return callHandler(postV1ProgramStatsHandler, event, env);
  return undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return Response.redirect(new URL("/app/", url).toString(), 302);
    }
    const processShim = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process;
    if (processShim) {
      Object.assign(processShim.env, {
        IS_DEV: env.IS_DEV,
        IS_LOCAL: env.IS_LOCAL,
        MCP_ALLOW_SELF_HOSTED: env.MCP_ALLOW_SELF_HOSTED,
        COMMIT_HASH: env.COMMIT_HASH,
        COOKIE_SECRET: env.COOKIE_SECRET,
        API_SECRET: env.API_SECRET,
        CRYPTO_SECRET: env.CRYPTO_SECRET,
        FROM_EMAIL: env.FROM_EMAIL,
        LIFTOSAUR_HOST: env.HOST,
        HOST: env.HOST,
        MCP_BASE_URL: env.MCP_BASE_URL,
        SESSION_COOKIE_DOMAIN: env.SESSION_COOKIE_DOMAIN,
      });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": env.HOST,
        "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
        "access-control-allow-methods": "OPTIONS,GET,POST,PUT,DELETE",
        "access-control-allow-credentials": "true",
      } });
    }
    const dynamicPath = url.pathname.startsWith("/api/") || url.pathname.startsWith("/oauth/") ||
      url.pathname.startsWith("/.well-known/") || url.pathname === "/mcp" || url.pathname === "/login" ||
      url.pathname === "/logout";
    if (dynamicPath) {
      const event = toApiEvent(request);
      if (request.method !== "GET" && request.method !== "HEAD") event.body = await request.clone().text();
      const result = await dispatch(request, env, event);
      if (result) return result;
    }
    return env.STATIC_ASSETS.fetch(request);
  },
};
