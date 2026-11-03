export interface IStoredWorkoutCoachSession {
  sessionId: string;
  userId: string;
  expiresAt: number;
  pollIntervalMs: number;
}

export function AiWorkoutCoachSession_subscribe(
  _listener: (session: IStoredWorkoutCoachSession | undefined) => void
): () => void {
  return () => undefined;
}

export async function AiWorkoutCoachSession_get(): Promise<IStoredWorkoutCoachSession | undefined> {
  return undefined;
}

export async function AiWorkoutCoachSession_set(_session: IStoredWorkoutCoachSession): Promise<void> {
  throw new Error("Codex 연결 대기는 Android 또는 iOS 앱에서 사용할 수 있습니다.");
}

export async function AiWorkoutCoachSession_clear(): Promise<void> {}
