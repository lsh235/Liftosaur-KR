import { Distribution_createPolicy } from "./distributionPolicy";
export { DistributionLocalOnlyError, Distribution_localOnlyMessage, LocalStorageRecoveryError } from "./distributionPolicy";

// Native KR builds are local-only; web/server preserve their upstream service contract.
export const {
  Distribution_isLocalOnly,
  Distribution_requireRemoteServices,
  Distribution_guardClient,
} = Distribution_createPolicy(true);
