export interface ITigerfitMcpCredential {
  key: string;
  userId: string;
}

export async function AiCoachMcpCredential_get(): Promise<ITigerfitMcpCredential | undefined> {
  return undefined;
}

export async function AiCoachMcpCredential_set(_credential: ITigerfitMcpCredential): Promise<void> {
  throw new Error("앱 보안 저장소는 모바일 앱에서만 사용할 수 있습니다.");
}

export async function AiCoachMcpCredential_clear(): Promise<void> {
  return;
}
