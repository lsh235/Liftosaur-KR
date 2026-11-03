export const TIGERFIT_MCP_URL = "https://tigerfit.aixtech.uk/mcp";
const PROTOCOL_VERSION = "2025-03-26";

export interface IMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
}

export interface IMcpCallResult {
  text: string;
  structuredContent?: Record<string, unknown>;
  isError: boolean;
}

interface IJsonRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

interface IToolCallResponse {
  content?: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

let nextId = 1;

async function rpc<T>(method: string, params?: Record<string, unknown>, apiKey?: string): Promise<T> {
  const id = nextId++;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "mcp-protocol-version": PROTOCOL_VERSION,
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(TIGERFIT_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("TigerFit MCP 인증이 만료되었습니다. 앱 계정을 다시 연결해 주세요.");
    if (response.status === 403) throw new Error("TigerFit MCP 사용에는 연결한 계정의 활성 구독이 필요합니다.");
    throw new Error(`TigerFit MCP 요청이 실패했습니다 (${response.status}).`);
  }
  const json = (await response.json()) as IJsonRpcResponse<T>;
  if (json.error) throw new Error(json.error.message || "TigerFit MCP 응답 오류입니다.");
  if (json.result == null) throw new Error("TigerFit MCP가 결과를 반환하지 않았습니다.");
  return json.result;
}

export async function TigerfitMcp_listTools(): Promise<IMcpTool[]> {
  await rpc("initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "TigerFit AI Coach", version: "1.0.0" },
  });
  await fetch(TIGERFIT_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "mcp-protocol-version": PROTOCOL_VERSION },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  const result = await rpc<{ tools?: IMcpTool[] }>("tools/list");
  return result.tools || [];
}

export async function TigerfitMcp_callTool(apiKey: string, name: string, args: Record<string, unknown>): Promise<IMcpCallResult> {
  const result = await rpc<IToolCallResponse>("tools/call", { name, arguments: args }, apiKey);
  const text = (result.content || [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
  return { text, structuredContent: result.structuredContent, isError: result.isError === true };
}

export function TigerfitMcp_openAiTools(tools: IMcpTool[]): Record<string, unknown>[] {
  const allowed = new Set([
    "get_history",
    "list_programs",
    "get_program",
    "get_liftoscript_reference",
    "get_liftoscript_examples",
    "get_program_design_guide",
    "run_playground",
    "update_program",
  ]);
  return tools
    .filter((tool) => allowed.has(tool.name))
    .map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      strict: false,
    }));
}
