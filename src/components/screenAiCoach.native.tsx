import { diffLines } from "diff";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { Service } from "../api/service";
import { Button } from "./button";
import { GroupHeader } from "./groupHeader";
import { Text } from "./primitives/text";
import { useNavOptions } from "../navigation/useNavOptions";
import { IDispatch } from "../ducks/types";
import { INavCommon } from "../models/state";
import { Thunk_pushScreen } from "../ducks/thunks";
import { Dialog_confirm } from "../utils/dialog";
import { ChatGptPlan } from "../utils/chatgptPlan";
import {
  AiCoachMcpCredential_clear,
  AiCoachMcpCredential_get,
  AiCoachMcpCredential_set,
  ITigerfitMcpCredential,
} from "../utils/aiCoachSecureStore";
import {
  IMcpTool,
  TigerfitMcp_callTool,
  TigerfitMcp_listTools,
  TigerfitMcp_openAiTools,
} from "../utils/tigerfitMcpClient";
import {
  IOpenAiResponse,
  IOpenAiResponseOutput,
  OpenAiResponses_create,
  OpenAiResponses_getModel,
} from "../utils/openAiResponsesClient";

interface IProps {
  dispatch: IDispatch;
  navCommon: INavCommon;
  service: Service;
  userId?: string;
}

interface IChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface IProgramSource {
  id: string;
  name: string;
  text: string;
}

interface IPendingProgramUpdate {
  callId: string;
  args: Record<string, unknown>;
  program: IProgramSource;
  diff: string[];
  removedLineCount: number;
  addedLineCount: number;
  conversation: unknown[];
  tools: IMcpTool[];
  model: string;
  validationText: string;
}

const MCP_API_KEY_NAME = "TigerFit AI 운동 코치";
const SYSTEM_INSTRUCTIONS = `당신은 TigerFit 앱 안의 한국어 운동 코치입니다. 앱은 MCP로 현재 활성 프로그램과 최근 운동 기록을 전달합니다. 그 정보에 근거해 사용자의 요청을 도와주세요.

운동 프로그램 수정 원칙:
- 운동 기록과 현재 프로그램을 먼저 확인하고, 과도한 피로·통증·회복 상황에 맞춰 근거를 설명합니다.
- 사용자가 프로그램 변경을 요청하면 현재 활성 프로그램의 요청한 운동일만 최소한으로 조정하고, 다른 운동일·진행 방식·운동 기록은 그대로 둡니다.
- 프로그램을 수정하기 전 get_liftoscript_reference와 get_liftoscript_examples를 확인하고, 변경 후 run_playground로 검증합니다.
- update_program의 id는 반드시 "current"로 지정합니다. 앱은 저장 전에 현재 프로그램을 다시 확인하고 사용자 승인을 받습니다.
- 아직 사용자 승인을 받지 않았으므로 변경을 적용했다고 말하지 않습니다. 건강 상태나 통증 정보가 부족하면 먼저 질문합니다.
- 사용자가 요청하지 않은 프로그램 생성, 기록 수정·삭제, 측정값 수정은 하지 않습니다. 앱에 노출된 도구만 사용합니다.
- 운동은 건강 상태에 따라 조정될 수 있으므로, 심한 통증이나 부상이 의심되면 운동 중단과 전문가 상담을 권합니다.
- 간결하고 명확한 한국어로 말합니다.`;

function getOutputText(response: IOpenAiResponse): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  return (response.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .map((item) => item.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function functionCalls(response: IOpenAiResponse): IOpenAiResponseOutput[] {
  return (response.output || []).filter((item) => item.type === "function_call");
}

function getFunctionArgs(call: IOpenAiResponseOutput): Record<string, unknown> {
  if (typeof call.arguments !== "string") throw new Error("AI가 보낸 도구 요청의 형식이 올바르지 않습니다.");
  const parsed = JSON.parse(call.arguments) as unknown;
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI가 보낸 도구 요청의 내용이 올바르지 않습니다.");
  }
  return parsed as Record<string, unknown>;
}

function getProgramSource(result: Awaited<ReturnType<typeof TigerfitMcp_callTool>>): IProgramSource {
  if (result.isError) throw new Error(String(result.structuredContent?.message || result.text || "활성 프로그램을 읽지 못했습니다."));
  const program = result.structuredContent as Partial<IProgramSource> | undefined;
  if (program?.id && program.name && program.text) return { id: program.id, name: program.name, text: program.text };
  try {
    const parsed = JSON.parse(result.text) as Partial<IProgramSource>;
    if (parsed.id && parsed.name && parsed.text) return { id: parsed.id, name: parsed.name, text: parsed.text };
  } catch {
    // Report the same simple message below for non-JSON or unsupported MCP responses.
  }
  throw new Error("현재 프로그램 정보를 읽을 수 없습니다. TigerFit 계정 연결을 확인해 주세요.");
}

function mcpResultForModel(result: Awaited<ReturnType<typeof TigerfitMcp_callTool>>): string {
  if (result.isError) {
    return JSON.stringify({ error: true, message: result.structuredContent?.message || result.text || "TigerFit MCP 오류" });
  }
  return result.structuredContent ? JSON.stringify(result.structuredContent) : result.text;
}

function makeProgramDiff(oldText: string, newText: string): { lines: string[]; removed: number; added: number } {
  const parts = diffLines(oldText, newText);
  const lines: string[] = [];
  let removed = 0;
  let added = 0;
  for (const part of parts) {
    if (!part.added && !part.removed) continue;
    const prefix = part.added ? "+ " : "− ";
    const partLines = part.value.replace(/\n$/, "").split("\n");
    if (part.added) added += partLines.length;
    if (part.removed) removed += partLines.length;
    lines.push(...partLines.map((line) => `${prefix}${line}`));
  }
  return { lines: lines.slice(0, 180), removed, added };
}

function responseErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "AI 요청 중 문제가 생겼습니다. 다시 시도해 주세요.";
}

export function ScreenAiCoach(props: IProps): JSX.Element {
  const [mcpCredential, setMcpCredential] = useState<ITigerfitMcpCredential | undefined>(undefined);
  const [chatGptStatus, setChatGptStatus] = useState<{ email?: string } | undefined>(undefined);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [pendingUpdate, setPendingUpdate] = useState<IPendingProgramUpdate | undefined>(undefined);
  const conversationRef = useRef<unknown[]>([]);
  const mcpApiKey = mcpCredential && mcpCredential.userId === props.userId ? mcpCredential.key : undefined;
  const mcpCredentialForDifferentUser = Boolean(mcpCredential && mcpCredential.userId !== props.userId);
  const canUseCoach = mcpApiKey != null && chatGptStatus != null;

  useNavOptions({ navTitle: "AI 운동 코치" });

  useEffect(() => {
    let active = true;
    Promise.all([AiCoachMcpCredential_get(), ChatGptPlan.getStatus()])
      .then(([mcp, chatGpt]) => {
        if (!active) return;
        setMcpCredential(mcp);
        setChatGptStatus(chatGpt);
      })
      .finally(() => {
        if (active) setIsLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const connectMcp = async (): Promise<void> => {
    if (!props.userId) {
      props.dispatch(Thunk_pushScreen("account"));
      return;
    }
    setIsWorking(true);
    setError(undefined);
    try {
      const keys = await props.service.getApiKeys();
      const savedKey = keys.find((key) => key.name === MCP_API_KEY_NAME);
      const key = savedKey?.key || (await props.service.createApiKey(MCP_API_KEY_NAME))?.key;
      if (!key) throw new Error("TigerFit MCP 연결에 실패했습니다. 계정 로그인 상태를 확인해 주세요.");
      const credential = { key, userId: props.userId };
      await AiCoachMcpCredential_set(credential);
      setMcpCredential(credential);
    } catch (e) {
      setError(responseErrorText(e));
    } finally {
      setIsWorking(false);
    }
  };

  const disconnectMcp = async (): Promise<void> => {
    if (!mcpApiKey || !props.userId) return;
    const confirmed = await Dialog_confirm("AI 코치의 TigerFit 연결 키를 폐기할까요?");
    if (!confirmed) return;
    setIsWorking(true);
    setError(undefined);
    try {
      const deleted = await props.service.deleteApiKey(mcpApiKey);
      if (!deleted) throw new Error("연결 키 폐기에 실패했습니다. API 키 화면에서 확인해 주세요.");
      await AiCoachMcpCredential_clear();
      setMcpCredential(undefined);
    } catch (e) {
      setError(responseErrorText(e));
    } finally {
      setIsWorking(false);
    }
  };

  const connectChatGpt = async (): Promise<void> => {
    setIsWorking(true);
    setError(undefined);
    try {
      const status = await ChatGptPlan.signIn();
      setChatGptStatus(status);
    } catch (e) {
      setError(responseErrorText(e));
    } finally {
      setIsWorking(false);
    }
  };

  const disconnectChatGpt = async (): Promise<void> => {
    const confirmed = await Dialog_confirm("ChatGPT 연결을 끊고 이 기기에 저장된 AI 인증 정보를 지울까요?");
    if (!confirmed) return;
    setIsWorking(true);
    setError(undefined);
    try {
      const revoked = await ChatGptPlan.signOut();
      setChatGptStatus(undefined);
      setMessages([]);
      setPendingUpdate(undefined);
      conversationRef.current = [];
      if (!revoked) setError("기기에서는 연결을 지웠습니다. OpenAI 연결 폐기는 확인되지 않아 ChatGPT 설정에서 접근을 확인해 주세요.");
    } catch (e) {
      setError(responseErrorText(e));
    } finally {
      setIsWorking(false);
    }
  };

  const runAssistant = async (args: {
    conversation: unknown[];
    tools: IMcpTool[];
    model: string;
    apiKey: string;
    programId: string;
    programText: string;
  }): Promise<void> => {
    const availableTools = TigerfitMcp_openAiTools(args.tools);
    for (let pass = 0; pass < 10; pass += 1) {
      const response = await OpenAiResponses_create({
        accessToken: await ChatGptPlan.getAccessToken(),
        model: args.model,
        instructions: SYSTEM_INSTRUCTIONS,
        input: args.conversation,
        tools: availableTools,
      });
      const calls = functionCalls(response);
      if (calls.length === 0) {
        const answer = getOutputText(response);
        if (answer) setMessages((previous) => [...previous, { role: "assistant", text: answer }]);
        conversationRef.current = args.conversation;
        return;
      }

      args.conversation.push(...(response.output || []));
      for (const call of calls) {
        const name = call.name || "";
        const callId = call.call_id || "";
        let toolArgs: Record<string, unknown>;
        try {
          toolArgs = getFunctionArgs(call);
          if (!callId) throw new Error("AI 요청 식별자가 비어 있습니다.");
          if (name === "update_program") {
            const id = String(toolArgs.id || "");
            const nextText = typeof toolArgs.text === "string" ? toolArgs.text : "";
            if (id !== "current" && id !== args.programId) {
              throw new Error("AI 코치는 현재 활성 프로그램만 수정할 수 있습니다.");
            }
            if (!nextText.trim()) throw new Error("AI가 비어 있는 프로그램 수정을 요청했습니다.");
            const latest = getProgramSource(await TigerfitMcp_callTool(args.apiKey, "get_program", { id: "current" }));
            if (latest.id !== args.programId || latest.text !== args.programText) {
              throw new Error("AI가 프로그램을 읽은 뒤 앱의 프로그램이 바뀌었습니다. 최신 상태를 다시 읽고 요청해 주세요.");
            }
            await TigerfitMcp_callTool(args.apiKey, "get_liftoscript_reference", {});
            await TigerfitMcp_callTool(args.apiKey, "get_liftoscript_examples", {});
            const validation = await TigerfitMcp_callTool(args.apiKey, "run_playground", { programText: nextText });
            if (validation.isError) {
              throw new Error(String(validation.structuredContent?.message || validation.text || "변경된 프로그램 검증에 실패했습니다."));
            }
            const diff = makeProgramDiff(latest.text, nextText);
            if (diff.added === 0 && diff.removed === 0) throw new Error("현재 프로그램과 같은 내용이라 적용할 변경이 없습니다.");
            setPendingUpdate({
              callId,
              args: { id: "current", text: nextText },
              program: latest,
              diff: diff.lines,
              removedLineCount: diff.removed,
              addedLineCount: diff.added,
              conversation: args.conversation,
              tools: args.tools,
              model: args.model,
              validationText: validation.text,
            });
            return;
          }

          const result = await TigerfitMcp_callTool(args.apiKey, name, toolArgs);
          args.conversation.push({
            type: "function_call_output",
            call_id: callId,
            output: mcpResultForModel(result),
          });
        } catch (e) {
          args.conversation.push({
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: true, message: responseErrorText(e) }),
          });
        }
      }
    }
    throw new Error("AI가 여러 번 도구를 호출했지만 답을 마치지 못했습니다. 요청을 나누어 다시 시도해 주세요.");
  };

  const sendPrompt = async (): Promise<void> => {
    const userPrompt = prompt.trim();
    if (!userPrompt || !mcpApiKey || !chatGptStatus || isWorking || pendingUpdate) return;
    setPrompt("");
    setMessages((previous) => [...previous, { role: "user", text: userPrompt }]);
    setIsWorking(true);
    setError(undefined);
    try {
      const accessToken = await ChatGptPlan.getAccessToken();
      const tools = await TigerfitMcp_listTools();
      const currentProgramResult = await TigerfitMcp_callTool(mcpApiKey, "get_program", { id: "current" });
      const currentProgram = getProgramSource(currentProgramResult);
      const history = await TigerfitMcp_callTool(mcpApiKey, "get_history", { limit: "10" });
      if (history.isError) throw new Error(String(history.structuredContent?.message || history.text || "최근 운동 기록을 읽지 못했습니다."));
      const programs = await TigerfitMcp_callTool(mcpApiKey, "list_programs", {});
      if (programs.isError) throw new Error(String(programs.structuredContent?.message || programs.text || "프로그램 목록을 읽지 못했습니다."));
      const model = await OpenAiResponses_getModel(accessToken);
      const conversation = [...conversationRef.current];
      conversation.push({
        role: "developer",
        content: [
          `현재 앱 날짜: ${new Date().toLocaleDateString("sv-SE")}`,
          `현재 활성 프로그램(MCP get_program): ${JSON.stringify(currentProgram)}`,
          `사용자 프로그램 목록(MCP list_programs): ${mcpResultForModel(programs)}`,
          `최근 운동 기록 10개 이내(MCP get_history): ${mcpResultForModel(history)}`,
        ].join("\n\n"),
      });
      conversation.push({ role: "user", content: userPrompt });
      await runAssistant({
        conversation,
        tools,
        model,
        apiKey: mcpApiKey,
        programId: currentProgram.id,
        programText: currentProgram.text,
      });
    } catch (e) {
      setError(responseErrorText(e));
    } finally {
      setIsWorking(false);
    }
  };

  const approveProgramUpdate = async (): Promise<void> => {
    if (!pendingUpdate || !mcpApiKey || !chatGptStatus || isWorking) return;
    const confirmed = await Dialog_confirm(`활성 프로그램 “${pendingUpdate.program.name}”의 ${pendingUpdate.addedLineCount + pendingUpdate.removedLineCount}개 줄을 변경합니다. 검증된 내용을 저장할까요?`);
    if (!confirmed) return;
    setIsWorking(true);
    setError(undefined);
    try {
      const latest = getProgramSource(await TigerfitMcp_callTool(mcpApiKey, "get_program", { id: "current" }));
      if (latest.id !== pendingUpdate.program.id || latest.text !== pendingUpdate.program.text) {
        throw new Error("승인하는 동안 현재 프로그램이 바뀌었습니다. 최신 상태로 다시 요청해 주세요.");
      }
      const result = await TigerfitMcp_callTool(mcpApiKey, "update_program", pendingUpdate.args);
      if (result.isError) throw new Error(String(result.structuredContent?.message || result.text || "프로그램 저장에 실패했습니다."));
      const continuation = pendingUpdate.conversation;
      continuation.push({
        type: "function_call_output",
        call_id: pendingUpdate.callId,
        output: mcpResultForModel(result),
      });
      conversationRef.current = continuation;
      setPendingUpdate(undefined);
      setMessages((previous) => [...previous, { role: "assistant", text: "프로그램을 TigerFit에 저장했습니다. 앱에서 잠시 후 변경된 운동 내용을 확인할 수 있습니다." }]);
      await runAssistant({
        conversation: continuation,
        tools: pendingUpdate.tools,
        model: pendingUpdate.model,
        apiKey: mcpApiKey,
        programId: pendingUpdate.program.id,
        programText: String(pendingUpdate.args.text || ""),
      });
    } catch (e) {
      setError(responseErrorText(e));
    } finally {
      setIsWorking(false);
    }
  };

  const rejectProgramUpdate = (): void => {
    if (!pendingUpdate) return;
    pendingUpdate.conversation.push({
      type: "function_call_output",
      call_id: pendingUpdate.callId,
      output: JSON.stringify({ cancelled: true, message: "사용자가 프로그램 변경을 취소했습니다. 저장하지 않았습니다." }),
    });
    conversationRef.current = pendingUpdate.conversation;
    setPendingUpdate(undefined);
    setMessages((previous) => [...previous, { role: "assistant", text: "프로그램 변경을 취소했습니다. 앱에는 반영하지 않았습니다." }]);
  };

  const mcpConnectionLabel = useMemo(() => {
    if (!props.userId) return "TigerFit 계정 로그인 필요";
    if (mcpCredential && mcpCredential.userId !== props.userId) return "다른 TigerFit 계정에 연결됨";
    return mcpApiKey ? "TigerFit MCP 연결됨" : "TigerFit MCP 연결 필요";
  }, [props.userId, mcpCredential, mcpApiKey]);

  return (
    <View className="flex-1 px-gutter">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <GroupHeader name="AI 연결" />
        <View className="mb-4 rounded-lg border border-border-neutral bg-background-subtle p-4">
          <Text className="mb-1 font-semibold">TigerFit MCP</Text>
          <Text className="mb-3 text-sm text-text-secondary">{mcpConnectionLabel}</Text>
          {!props.userId ? (
            <Button kind="purple" name="ai-coach-login-tigerfit" onClick={() => props.dispatch(Thunk_pushScreen("account"))}>
              TigerFit 로그인
            </Button>
          ) : mcpCredentialForDifferentUser ? (
            <Button kind="grayv2" name="ai-coach-switch-account" onClick={() => props.dispatch(Thunk_pushScreen("account"))}>
              연결된 TigerFit 계정 선택
            </Button>
          ) : mcpApiKey ? (
            <Button kind="grayv2" name="ai-coach-disconnect-mcp" disabled={isWorking} onClick={disconnectMcp}>
              TigerFit MCP 연결 해제
            </Button>
          ) : (
            <Button kind="purple" name="ai-coach-connect-mcp" disabled={isWorking || isLoadingStatus} onClick={connectMcp}>
              TigerFit MCP 연결
            </Button>
          )}
          {mcpCredential && mcpCredential.userId !== props.userId && (
            <Text className="mt-2 text-xs text-text-secondary">저장된 키는 다른 계정용입니다. 해당 계정으로 전환해 연결을 해제하거나 API 키 화면에서 키를 폐기해 주세요.</Text>
          )}
        </View>

        <View className="mb-4 rounded-lg border border-border-neutral bg-background-subtle p-4">
          <Text className="mb-1 font-semibold">ChatGPT 요금제</Text>
          <Text className="mb-3 text-sm text-text-secondary">
            {chatGptStatus ? `연결됨${chatGptStatus.email ? ` · ${chatGptStatus.email}` : ""}` : "AI 요청을 위해 별도로 연결해야 합니다."}
          </Text>
          {chatGptStatus ? (
            <Button kind="grayv2" name="ai-coach-disconnect-chatgpt" disabled={isWorking} onClick={disconnectChatGpt}>
              ChatGPT 연결 해제
            </Button>
          ) : (
            <Button kind="purple" name="ai-coach-connect-chatgpt" disabled={isWorking || isLoadingStatus} onClick={connectChatGpt}>
              Continue with ChatGPT
            </Button>
          )}
        </View>

        <Text className="mb-4 text-xs text-text-secondary">
          요청 문장과 MCP에서 읽은 운동 기록·프로그램은 ChatGPT 요금제로 응답을 만들기 위해 OpenAI로 전송됩니다. 대화는 이 화면이 열려 있는 동안 기기에만 유지됩니다. 프로그램 저장은 변경 내용을 확인하고 승인해야 실행됩니다.
        </Text>

        <GroupHeader name="대화" topPadding={true} />
        {messages.length === 0 ? (
          <View className="mb-4 rounded-lg bg-background-subtle p-4">
            <Text className="mb-2 font-semibold">운동 기록을 바탕으로 요청하세요</Text>
            <Text className="text-sm text-text-secondary">예: “어제 운동한 피로가 너무 심해. 오늘 운동 프로그램을 확인하고 필요한 세트와 무게를 조정해줘.”</Text>
          </View>
        ) : (
          messages.map((message, index) => (
            <View key={`${index}-${message.role}`} className={`mb-3 max-w-[92%] rounded-xl p-3 ${message.role === "user" ? "ml-auto bg-background-purpledark" : "mr-auto bg-background-subtle"}`}>
              <Text className="text-sm">{message.text}</Text>
            </View>
          ))
        )}

        {pendingUpdate && (
          <View className="mb-4 rounded-lg border border-border-prominent bg-background-subtle p-4">
            <Text className="mb-1 font-semibold">프로그램 변경 승인</Text>
            <Text className="mb-2 text-sm text-text-secondary">{pendingUpdate.program.name} · 시뮬레이션 검증 완료</Text>
            <Text className="mb-2 text-xs text-text-secondary">− {pendingUpdate.removedLineCount}줄 · + {pendingUpdate.addedLineCount}줄</Text>
            <ScrollView className="mb-3 max-h-64 rounded bg-background-default p-2" nestedScrollEnabled={true}>
              {pendingUpdate.diff.map((line, index) => (
                <Text key={`${index}-${line}`} className={`font-mono text-xs ${line.startsWith("+") ? "text-text-success" : "text-text-error"}`}>
                  {line}
                </Text>
              ))}
              {pendingUpdate.removedLineCount + pendingUpdate.addedLineCount > pendingUpdate.diff.length && (
                <Text className="mt-1 text-xs text-text-secondary">나머지 변경 줄은 생략했습니다.</Text>
              )}
            </ScrollView>
            <Text className="mb-3 text-xs text-text-secondary">검증 결과: {pendingUpdate.validationText.slice(0, 240) || "프로그램 시뮬레이션이 완료되었습니다."}</Text>
            <View className="flex-row gap-2">
              <Button kind="purple" name="ai-coach-approve-program" disabled={isWorking} onClick={approveProgramUpdate}>
                앱에 적용
              </Button>
              <Button kind="grayv2" name="ai-coach-reject-program" disabled={isWorking} onClick={rejectProgramUpdate}>
                취소
              </Button>
            </View>
          </View>
        )}
        {isWorking && <Text className="mb-3 text-sm text-text-secondary">운동 기록을 확인하고 있습니다…</Text>}
        {error && <Text className="mb-3 text-sm text-text-error">{error}</Text>}
      </ScrollView>

      <View className="border-t border-border-neutral py-3">
        <TextInput
          className="mb-2 max-h-32 min-h-12 rounded-lg border border-border-neutral bg-background-subtle px-3 py-3 text-text-primary"
          placeholder="오늘 운동을 어떻게 조정할까요?"
          placeholderTextColor="#8A8A8A"
          multiline={true}
          value={prompt}
          onChangeText={setPrompt}
          editable={canUseCoach && !isWorking && pendingUpdate == null}
          testID="ai-coach-prompt"
          accessibilityLabel="AI 운동 코치 요청"
        />
        <Button
          kind="purple"
          name="ai-coach-send"
          disabled={!canUseCoach || !prompt.trim() || isWorking || pendingUpdate != null}
          onClick={sendPrompt}
        >
          AI에게 요청
        </Button>
      </View>
    </View>
  );
}
