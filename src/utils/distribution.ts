import { Distribution_createPolicy } from "./distributionPolicy";
export {
  DistributionLocalOnlyError,
  Distribution_cloudSyncMessage,
  Distribution_localOnlyMessage,
  LocalStorageRecoveryError,
} from "./distributionPolicy";

// The web/server build keeps its upstream service contract.
export const {
  Distribution_isLocalOnly,
  Distribution_supportsCloudSync,
  Distribution_requireRemoteServices,
  Distribution_guardClient,
} = Distribution_createPolicy(false);
