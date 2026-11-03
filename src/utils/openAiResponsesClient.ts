export interface IOpenAiFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

export interface IOpenAiResponseOutput {
  type?: string;
  role?: string;
  content?: { type?: string; text?: string }[];
  call_id?: string;
  name?: string;
  arguments?: string;
  [key: string]: unknown;
}

export interface IOpenAiResponse {
  id?: string;
  status?: string;
  output?: IOpenAiResponseOutput[];
  output_text?: string;
  error?: { code?: string; message?: string };
  incomplete_details?: { reason?: string };
}

interface IOpenAiModel {
  slug: string;
  display_name?: string;
  visibility?: string;
}

interface IOpenAiModelsResponse {
  models?: IOpenAiModel[];
}

function extractText(response: IOpenAiResponse): string {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n");
}

export async function OpenAiResponses_getModel(accessToken: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as IOpenAiModelsResponse;
  if (!response.ok) throw new Error(`ChatGPT 모델 목록을 가져오지 못했습니다 (${response.status}).`);
  const models = (body.models || []).filter((model) => model.visibility === "list" && model.slug);
  if (models.length === 0) throw new Error("이 ChatGPT 계정에서 사용할 수 있는 모델이 없습니다.");
  return models.find((model) => model.slug === "gpt-6.1-sol")?.slug || models[0].slug;
}

export function OpenAiResponses_create(args: {
  accessToken: string;
  model: string;
  instructions: string;
  input: unknown[];
  tools: Record<string, unknown>[];
}): Promise<IOpenAiResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let consumedLength = 0;
    let pendingText = "";
    let completed = false;

    const finishWithError = (error: Error): void => {
      if (completed) return;
      completed = true;
      reject(error);
    };

    const processBlock = (block: string): void => {
      const lines = block.split(/\r?\n/);
      const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!eventName || !data || data === "[DONE]") return;
      let payload: { response?: IOpenAiResponse; error?: { message?: string; code?: string } };
      try {
        payload = JSON.parse(data) as typeof payload;
      } catch {
        finishWithError(new Error("ChatGPT 응답을 읽지 못했습니다."));
        return;
      }
      if (eventName === "response.completed") {
        const result = payload.response;
        if (!result || result.status !== "completed") {
          finishWithError(new Error("ChatGPT 응답이 완료되지 않았습니다."));
          return;
        }
        completed = true;
        resolve({ ...result, output_text: extractText(result) });
      } else if (eventName === "response.failed" || eventName === "error") {
        finishWithError(new Error(payload.response?.error?.message || payload.error?.message || "ChatGPT 요청이 실패했습니다."));
      } else if (eventName === "response.incomplete") {
        const reason = payload.response?.incomplete_details?.reason;
        finishWithError(new Error(reason ? `ChatGPT 응답이 중단되었습니다 (${reason}).` : "ChatGPT 응답이 중단되었습니다."));
      }
    };

    const consumeResponse = (): void => {
      const responseText = xhr.responseText || "";
      const nextText = responseText.slice(consumedLength);
      consumedLength = responseText.length;
      pendingText += nextText;
      while (true) {
        const separator = /\r?\n\r?\n/.exec(pendingText);
        if (!separator || separator.index == null) break;
        const block = pendingText.slice(0, separator.index);
        pendingText = pendingText.slice(separator.index + separator[0].length);
        processBlock(block);
        if (completed) return;
      }
    };

    xhr.open("POST", "https://api.openai.com/v1/responses");
    xhr.timeout = 180_000;
    xhr.setRequestHeader("Authorization", `Bearer ${args.accessToken}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onprogress = consumeResponse;
    xhr.onerror = () => finishWithError(new Error("인터넷 연결을 확인해 주세요."));
    xhr.ontimeout = () => finishWithError(new Error("ChatGPT 응답 시간이 초과되었습니다."));
    xhr.onload = () => {
      consumeResponse();
      if (completed) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `ChatGPT 요청이 실패했습니다 (${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          // Keep the status-only message for a non-JSON response.
        }
        finishWithError(new Error(message));
        return;
      }
      if (pendingText.trim()) processBlock(pendingText);
      if (!completed) finishWithError(new Error("ChatGPT 응답 스트림이 완료되지 않았습니다."));
    };
    xhr.send(
      JSON.stringify({
        model: args.model,
        instructions: args.instructions,
        input: args.input,
        tools: args.tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        store: false,
        stream: true,
      })
    );
  });
}
