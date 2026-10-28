export const Distribution_localOnlyMessage =
  "이 앱은 기기에 운동 기록을 저장하며 앱 내 결제는 제공하지 않습니다. TigerFit 계정에 로그인하면 기록과 프로그램을 계정에 동기화할 수 있습니다.";

export const Distribution_cloudSyncMessage =
  "MCP에 연결한 것과 같은 TigerFit 계정으로 로그인하세요. 동기화하면 Codex가 운동 기록을 읽고 프로그램을 조정합니다. 앱을 열어 두면 약 30초 안에 변경 사항이 반영됩니다.";

export class DistributionLocalOnlyError extends Error {
  public readonly code = "local_only_distribution";

  constructor() {
    super(Distribution_localOnlyMessage);
    this.name = "DistributionLocalOnlyError";
  }
}

// Recovery must stop before AppRoot mounts, so persistence never saves an empty replacement.
export class LocalStorageRecoveryError extends Error {
  constructor() {
    super("기기에 저장된 운동 기록을 읽지 못했습니다. 원본을 보존한 상태로 복구가 필요합니다.");
    this.name = "LocalStorageRecoveryError";
  }
}

function isCloudSyncRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  let requestUrl: string;
  let method = init?.method?.toUpperCase() ?? "GET";
  if (typeof input === "string") {
    requestUrl = input;
  } else if (input instanceof URL) {
    requestUrl = input.toString();
  } else {
    requestUrl = input.url;
    method = init?.method?.toUpperCase() ?? input.method.toUpperCase();
  }
  let path: string;
  try {
    path = new URL(requestUrl, "https://tigerfit.aixtech.uk").pathname;
  } catch {
    return false;
  }
  return (
    (method === "POST" &&
      ["/api/signup/email", "/api/signin/email", "/api/signout", "/api/sync2"].includes(path)) ||
    (method === "GET" && path === "/api/history")
  );
}

export function Distribution_createPolicy(localOnly: boolean, cloudSync = false): {
  Distribution_isLocalOnly(): boolean;
  Distribution_supportsCloudSync(): boolean;
  Distribution_requireRemoteServices(): void;
  Distribution_guardClient(client: Window["fetch"]): Window["fetch"];
} {
  const supportsCloudSync = !localOnly || cloudSync;
  const requireRemote = (): void => {
    if (localOnly) throw new DistributionLocalOnlyError();
  };
  return {
    Distribution_isLocalOnly: () => localOnly,
    Distribution_supportsCloudSync: () => supportsCloudSync,
    Distribution_requireRemoteServices: requireRemote,
    Distribution_guardClient: (client) => async (input, init) => {
      if (localOnly && !(supportsCloudSync && isCloudSyncRequest(input, init))) requireRemote();
      return client(input, init);
    },
  };
}
