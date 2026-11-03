import { Linking } from "react-native";
import * as RNKeychain from "react-native-keychain";
import TcpSocket from "react-native-tcp-socket";
import QuickCrypto, { Buffer } from "react-native-quick-crypto";

const AUTH_SERVICE = "com.tigerfit.ai-coach.chatgpt";
const HOST_SERVICE = "com.tigerfit.ai-coach.host";
const ACCOUNT = "credentials";
const OPENAI_AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
const OPENAI_RESOURCE = "https://api.openai.com/v1";
const REQUIRED_SCOPE = "chatgpt.tokens.use.direct";

interface IChatGptCredentials {
  clientId: string;
  hostId: string;
  email?: string;
  subject: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}

interface IOAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface IJwtHeader {
  alg?: string;
  kid?: string;
}

interface IJwtClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  sub?: string;
  email?: string;
}

interface ILoopbackCallback {
  code?: string;
  state?: string;
  clientId?: string;
  scope?: string;
  error?: string;
  errorDescription?: string;
}

let refreshPromise: Promise<IChatGptCredentials> | undefined;

async function readCredentials(): Promise<IChatGptCredentials | undefined> {
  try {
    const result = await RNKeychain.getGenericPassword({ service: AUTH_SERVICE });
    if (!result) return undefined;
    const parsed = JSON.parse(result.password) as IChatGptCredentials;
    if (
      !parsed.accessToken ||
      !parsed.refreshToken ||
      !parsed.clientId ||
      !parsed.hostId ||
      !parsed.subject ||
      !Number.isFinite(parsed.expiresAt) ||
      !Array.isArray(parsed.scopes) ||
      parsed.scopes.some((scope) => typeof scope !== "string")
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

async function writeCredentials(credentials: IChatGptCredentials): Promise<void> {
  await RNKeychain.setGenericPassword(ACCOUNT, JSON.stringify(credentials), {
    service: AUTH_SERVICE,
    accessible: RNKeychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

async function getHostId(): Promise<string> {
  try {
    const existing = await RNKeychain.getGenericPassword({ service: HOST_SERVICE });
    if (existing && existing.password.startsWith("urn:uuid:")) return existing.password;
  } catch {
    // Generate a fresh host id if secure storage is unavailable or empty.
  }

  const bytes = QuickCrypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  const hostId = `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  await RNKeychain.setGenericPassword(ACCOUNT, hostId, {
    service: HOST_SERVICE,
    accessible: RNKeychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return hostId;
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? QuickCrypto.Buffer.from(value, "utf8") : QuickCrypto.Buffer.from(value);
  return bytes.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string): Buffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return QuickCrypto.Buffer.from(base64 + "=".repeat((4 - (base64.length % 4)) % 4), "base64");
}

function randomText(byteCount: number): string {
  return base64UrlEncode(QuickCrypto.randomBytes(byteCount));
}

function formBody(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

function oauthError(response: IOAuthTokenResponse, status: number): Error {
  if (response.error === "access_denied") return new Error("ChatGPT 사용 권한이 승인되지 않았습니다.");
  if (response.error === "invalid_grant") return new Error("ChatGPT 인증이 만료되었습니다. 다시 연결해 주세요.");
  return new Error(response.error_description || response.error || `ChatGPT 인증 요청이 실패했습니다 (${status}).`);
}

function startLoopbackListener(): Promise<{
  port: number;
  callback: Promise<ILoopbackCallback>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    let callbackResolve: (callback: ILoopbackCallback) => void;
    let callbackReject: (error: Error) => void;
    let completed = false;
    const callback = new Promise<ILoopbackCallback>((resolveCallback, rejectCallback) => {
      callbackResolve = resolveCallback;
      callbackReject = rejectCallback;
    });
    const server = TcpSocket.createServer((socket) => {
      let requestText = "";
      socket.on("data", (chunk) => {
        requestText += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        if (requestText.length > 32768) {
          socket.end("HTTP/1.1 413 Content Too Large\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
          if (!completed) {
            completed = true;
            callbackReject(new Error("인증 응답이 너무 큽니다."));
          }
          return;
        }
        const firstLine = requestText.split("\r\n", 1)[0];
        if (!firstLine || !firstLine.endsWith(" HTTP/1.1")) return;
        const match = /^GET ([^ ]+) HTTP\/1\.1$/.exec(firstLine);
        if (!match) return;
        const listeningAddress = server.address();
        const port = listeningAddress?.port;
        if (!port) return;
        let url: URL;
        try {
          url = new URL(match[1], `http://127.0.0.1:${port}`);
        } catch {
          return;
        }
        if (url.pathname !== "/auth/callback") {
          socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
          return;
        }

        const body = "TigerFit 인증이 완료되었습니다. 이 창을 닫고 앱으로 돌아가세요.";
        socket.end(
          `HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nConnection: close\r\nContent-Length: ${QuickCrypto.Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`
        );
        if (completed) return;
        completed = true;
        callbackResolve({
          code: url.searchParams.get("code") || undefined,
          state: url.searchParams.get("state") || undefined,
          clientId: url.searchParams.get("client_id") || undefined,
          scope: url.searchParams.get("scope") || undefined,
          error: url.searchParams.get("error") || undefined,
          errorDescription: url.searchParams.get("error_description") || undefined,
        });
      });
    });

    const close = (): void => {
      try {
        server.close();
      } catch {
        // Ignore an already-closed listener.
      }
    };
    server.once("error", (error) => {
      if (!completed) {
        completed = true;
        callbackReject(error);
      }
      reject(error);
    });
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        close();
        reject(new Error("ChatGPT 인증용 로컬 연결을 시작하지 못했습니다."));
        return;
      }
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          callbackReject(new Error("ChatGPT 인증 시간이 초과되었습니다. 다시 시도해 주세요."));
        }
        close();
      }, 5 * 60 * 1000);
      void callback.then(
        () => {
          clearTimeout(timeout);
          close();
        },
        () => {
          clearTimeout(timeout);
          close();
        }
      );
      resolve({ port: address.port, callback, close });
    });
    server.listen({ host: "127.0.0.1", port: 0 });
  });
}

async function exchangeAuthorizationCode(args: {
  code: string;
  clientId: string;
  redirectUri: string;
  verifier: string;
}): Promise<IOAuthTokenResponse> {
  const response = await fetch(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "authorization_code",
      client_id: args.clientId,
      code: args.code,
      code_verifier: args.verifier,
      redirect_uri: args.redirectUri,
      resource: OPENAI_RESOURCE,
    }),
  });
  const body = (await response.json()) as IOAuthTokenResponse;
  if (!response.ok) throw oauthError(body, response.status);
  return body;
}

async function verifyIdToken(token: string, expected: { clientId: string; nonce: string }): Promise<IJwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("ChatGPT 인증 토큰 형식이 올바르지 않습니다.");
  const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf8")) as IJwtHeader;
  const claims = JSON.parse(base64UrlDecode(parts[1]).toString("utf8")) as IJwtClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("지원하지 않는 ChatGPT 인증서 형식입니다.");
  if (claims.iss !== "https://auth.openai.com") throw new Error("ChatGPT 인증 발급자가 일치하지 않습니다.");
  if (!(Array.isArray(claims.aud) ? claims.aud.includes(expected.clientId) : claims.aud === expected.clientId)) {
    throw new Error("ChatGPT 인증 앱 식별자가 일치하지 않습니다.");
  }
  if (!claims.exp || claims.exp * 1000 <= Date.now()) throw new Error("ChatGPT 인증 응답이 만료되었습니다.");
  if (claims.nonce !== expected.nonce || !claims.sub) throw new Error("ChatGPT 인증 응답 검증에 실패했습니다.");

  const jwksResponse = await fetch("https://auth.openai.com/.well-known/jwks.json");
  if (!jwksResponse.ok) throw new Error("ChatGPT 인증서를 가져오지 못했습니다.");
  const jwks = (await jwksResponse.json()) as { keys?: Record<string, unknown>[] };
  const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === "RSA" && key.use === "sig");
  if (!jwk) throw new Error("ChatGPT 서명 인증서를 찾지 못했습니다.");
  const publicKey = QuickCrypto.createPublicKey({ key: jwk, format: "jwk" });
  const signedPayload = QuickCrypto.Buffer.from(`${parts[0]}.${parts[1]}`, "utf8");
  const signature = base64UrlDecode(parts[2]);
  if (!QuickCrypto.verify("RSA-SHA256", signedPayload, publicKey, signature)) {
    throw new Error("ChatGPT 인증 서명이 유효하지 않습니다.");
  }
  return claims;
}

async function signIn(): Promise<{ email?: string }> {
  const existing = await readCredentials();
  const hostId = existing?.hostId || (await getHostId());
  const verifier = randomText(48);
  const challenge = base64UrlEncode(QuickCrypto.createHash("sha256").update(verifier).digest());
  const state = randomText(24);
  const nonce = randomText(24);
  const listener = await startLoopbackListener();
  const redirectUri = `http://127.0.0.1:${listener.port}/auth/callback`;
  const clientId = existing?.clientId || "dynamic_agent_client";
  const params: Record<string, string> = {
    client_id: clientId,
    ext_agent_host_id: hostId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
    resource: OPENAI_RESOURCE,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: challenge,
  };
  if (!existing) params.agent_name_hint = "TigerFit";
  if (existing?.idToken) params.id_token_hint = existing.idToken;
  if (existing?.email) params.login_hint = existing.email;

  try {
    await Linking.openURL(`${OPENAI_AUTHORIZE_URL}?${new URLSearchParams(params).toString()}`);
    const callback = await listener.callback;
    if (callback.state !== state) throw new Error("ChatGPT 인증 상태가 일치하지 않습니다.");
    if (callback.error) {
      throw new Error(callback.errorDescription || (callback.error === "access_denied" ? "ChatGPT 사용 권한이 승인되지 않았습니다." : callback.error));
    }
    if (!callback.code) throw new Error("ChatGPT 인증 코드가 돌아오지 않았습니다.");
    const issuedClientId = callback.clientId || existing?.clientId;
    if (!issuedClientId || issuedClientId === "dynamic_agent_client") {
      throw new Error("ChatGPT 앱 등록이 완료되지 않았습니다. 다시 연결해 주세요.");
    }
    if (existing && issuedClientId !== existing.clientId) {
      throw new Error("이 ChatGPT 계정의 앱 등록 정보가 달라 인증을 중단했습니다.");
    }

    const tokens = await exchangeAuthorizationCode({
      code: callback.code,
      clientId: issuedClientId,
      redirectUri,
      verifier,
    });
    if (!tokens.access_token || !tokens.refresh_token || !tokens.id_token) {
      throw new Error("ChatGPT가 필요한 인증 정보를 반환하지 않았습니다.");
    }
    const claims = await verifyIdToken(tokens.id_token, { clientId: issuedClientId, nonce });
    if (existing && claims.sub !== existing.subject) {
      throw new Error("기존 ChatGPT 계정과 인증된 계정이 달라 연결을 중단했습니다.");
    }
    const scopes = (tokens.scope || callback.scope || "").split(/\s+/).filter(Boolean);
    if (!scopes.includes(REQUIRED_SCOPE)) {
      throw new Error("ChatGPT 요금제 사용 권한이 승인되지 않았습니다. 연결 권한을 확인해 주세요.");
    }
    const credentials: IChatGptCredentials = {
      clientId: issuedClientId,
      hostId,
      email: claims.email,
      subject: claims.sub!,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      scopes,
    };
    await writeCredentials(credentials);
    return { email: credentials.email };
  } finally {
    listener.close();
  }
}

async function refreshCredentials(credentials: IChatGptCredentials): Promise<IChatGptCredentials> {
  const response = await fetch(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "refresh_token",
      client_id: credentials.clientId,
      refresh_token: credentials.refreshToken,
      resource: OPENAI_RESOURCE,
    }),
  });
  const body = (await response.json()) as IOAuthTokenResponse;
  if (!response.ok) throw oauthError(body, response.status);
  if (!body.access_token || !body.refresh_token) throw new Error("ChatGPT 인증 갱신 응답이 올바르지 않습니다.");
  const updated = {
    ...credentials,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
    scopes: (body.scope || credentials.scopes.join(" ")).split(/\s+/).filter(Boolean),
  };
  if (!updated.scopes.includes(REQUIRED_SCOPE)) throw new Error("ChatGPT 요금제 사용 권한이 더 이상 활성화되어 있지 않습니다.");
  await writeCredentials(updated);
  return updated;
}

async function getAccessToken(): Promise<string> {
  const credentials = await readCredentials();
  if (!credentials) throw new Error("먼저 ChatGPT 계정을 연결해 주세요.");
  if (!credentials.scopes.includes(REQUIRED_SCOPE)) throw new Error("ChatGPT 요금제 사용 권한을 다시 승인해 주세요.");
  if (credentials.expiresAt > Date.now() + 60_000) return credentials.accessToken;
  if (!refreshPromise) {
    refreshPromise = refreshCredentials(credentials).finally(() => {
      refreshPromise = undefined;
    });
  }
  return (await refreshPromise).accessToken;
}

async function signOut(): Promise<boolean> {
  const credentials = await readCredentials();
  if (!credentials) return true;
  let revoked = false;
  try {
    const discovery = await fetch("https://auth.openai.com/.well-known/openid-configuration");
    const config = (await discovery.json()) as { revocation_endpoint?: string };
    if (discovery.ok && config.revocation_endpoint) {
      const response = await fetch(config.revocation_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody({
          token: credentials.refreshToken,
          token_type_hint: "refresh_token",
          client_id: credentials.clientId,
        }),
      });
      revoked = response.status === 200;
    }
  } catch {
    // Local sign-out must still work when OpenAI is unreachable.
  }
  await RNKeychain.resetGenericPassword({ service: AUTH_SERVICE });
  return revoked;
}

export const ChatGptPlan = {
  getStatus: async (): Promise<{ email?: string } | undefined> => {
    const credentials = await readCredentials();
    return credentials ? { email: credentials.email } : undefined;
  },
  signIn,
  getAccessToken,
  signOut,
};
