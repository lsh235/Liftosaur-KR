import * as RNKeychain from "react-native-keychain";

const SERVICE = "com.tigerfit.ai-coach.workout-session";
const ACCOUNT = "active-session";
const listeners = new Set<(session: IStoredWorkoutCoachSession | undefined) => void>();

function notify(session: IStoredWorkoutCoachSession | undefined): void {
  listeners.forEach((listener) => listener(session));
}

export function AiWorkoutCoachSession_subscribe(
  listener: (session: IStoredWorkoutCoachSession | undefined) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface IStoredWorkoutCoachSession {
  sessionId: string;
  userId: string;
  expiresAt: number;
  pollIntervalMs: number;
}

export async function AiWorkoutCoachSession_get(): Promise<IStoredWorkoutCoachSession | undefined> {
  try {
    const result = await RNKeychain.getGenericPassword({ service: SERVICE });
    if (!result) return undefined;
    const session = JSON.parse(result.password) as IStoredWorkoutCoachSession;
    if (!session.sessionId || !session.userId || !Number.isFinite(session.expiresAt)) return undefined;
    if (session.expiresAt <= Date.now()) {
      await AiWorkoutCoachSession_clear();
      return undefined;
    }
    return session;
  } catch {
    return undefined;
  }
}

export async function AiWorkoutCoachSession_set(session: IStoredWorkoutCoachSession): Promise<void> {
  await RNKeychain.setGenericPassword(ACCOUNT, JSON.stringify(session), {
    service: SERVICE,
    accessible: RNKeychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  notify(session);
}

export async function AiWorkoutCoachSession_clear(): Promise<void> {
  try {
    await RNKeychain.resetGenericPassword({ service: SERVICE });
  } catch {
    // Session metadata is non-secret; clearing is best-effort during expiry/logout.
  } finally {
    notify(undefined);
  }
}
