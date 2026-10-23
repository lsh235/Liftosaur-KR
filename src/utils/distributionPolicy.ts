export const Distribution_localOnlyMessage =
  "이 한국어 버전은 기기에 운동 기록을 저장합니다. 계정 로그인, 클라우드 동기화와 결제는 제공하지 않습니다. 파일 백업과 AI 루틴 가져오기·내보내기를 이용해 주세요.";

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

export function Distribution_createPolicy(localOnly: boolean): {
  Distribution_isLocalOnly(): boolean;
  Distribution_requireRemoteServices(): void;
  Distribution_guardClient(client: Window["fetch"]): Window["fetch"];
} {
  const requireRemote = (): void => {
    if (localOnly) throw new DistributionLocalOnlyError();
  };
  return {
    Distribution_isLocalOnly: () => localOnly,
    Distribution_requireRemoteServices: requireRemote,
    Distribution_guardClient: (client) => async (...args) => {
      requireRemote();
      return client(...args);
    },
  };
}
