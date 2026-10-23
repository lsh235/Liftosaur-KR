import { Platform } from "react-native";
import { Distribution_isLocalOnly } from "./distribution";
import NativeLftUpdater from "../specs/NativeLftUpdater";

interface IRollbarShim {
  warning?: (msg: string, extra?: unknown) => void;
  warn?: (msg: string, extra?: unknown) => void;
}

function logRollbarWarn(msg: string, extra?: unknown): void {
  const r = (globalThis as unknown as { Rollbar?: IRollbarShim }).Rollbar;
  (r?.warning ?? r?.warn)?.(msg, extra);
}

// Cached for synchronous reads from the Rollbar frame-rewrite transform.
// Populated by Ota_init(); a kick-off promise also fires at module load so
// uncaught errors very early in the launch still get a best-effort label.
let cachedActiveBundleId: string | null = null;
if (!Distribution_isLocalOnly()) NativeLftUpdater.activeBundleId()
  .then((id) => {
    cachedActiveBundleId = id;
  })
  .catch(() => {});

export function Ota_activeBundleIdSync(): string | null {
  return cachedActiveBundleId;
}

export async function Ota_init(): Promise<void> {
  if (Distribution_isLocalOnly() || __DEV__) {
    return;
  }

  cachedActiveBundleId = await NativeLftUpdater.activeBundleId();

  setTimeout(() => {
    NativeLftUpdater.markLaunchSuccessful().catch(() => {});
  }, 5000);

  try {
    const result = await NativeLftUpdater.checkAndDownload();
    if (result?.status === "error") {
      logRollbarWarn("OTA check failed", { error: result.error, platform: Platform.OS });
    }
  } catch (e) {
    logRollbarWarn("OTA exception", { error: String(e), platform: Platform.OS });
  }
}

export async function Ota_activeBundleId(): Promise<string | null> {
  if (Distribution_isLocalOnly()) return null;
  return NativeLftUpdater.activeBundleId();
}

export async function Ota_revertToEmbedded(): Promise<void> {
  if (Distribution_isLocalOnly()) return;
  return NativeLftUpdater.revertToEmbedded();
}
