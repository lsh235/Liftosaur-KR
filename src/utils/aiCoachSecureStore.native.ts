import * as RNKeychain from "react-native-keychain";

const SERVICE = "com.tigerfit.ai-coach.mcp";
const ACCOUNT = "connection";

export interface ITigerfitMcpCredential {
  key: string;
  userId: string;
}

export async function AiCoachMcpCredential_get(): Promise<ITigerfitMcpCredential | undefined> {
  try {
    const result = await RNKeychain.getGenericPassword({ service: SERVICE });
    if (!result) return undefined;
    const credential = JSON.parse(result.password) as ITigerfitMcpCredential;
    if (!credential.key.startsWith("lftsk_") || !credential.userId) return undefined;
    return credential;
  } catch {
    return undefined;
  }
}

export async function AiCoachMcpCredential_set(credential: ITigerfitMcpCredential): Promise<void> {
  await RNKeychain.setGenericPassword(ACCOUNT, JSON.stringify(credential), {
    service: SERVICE,
    accessible: RNKeychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function AiCoachMcpCredential_clear(): Promise<void> {
  await RNKeychain.resetGenericPassword({ service: SERVICE });
}
