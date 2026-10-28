import { Distribution_createPolicy } from "./distributionPolicy";
export {
  DistributionLocalOnlyError,
  Distribution_cloudSyncMessage,
  Distribution_localOnlyMessage,
  LocalStorageRecoveryError,
} from "./distributionPolicy";

// Keep billing and analytics disabled in the native KR app while allowing its TigerFit account to sync.
export const {
  Distribution_isLocalOnly,
  Distribution_supportsCloudSync,
  Distribution_requireRemoteServices,
  Distribution_guardClient,
} = Distribution_createPolicy(true, true);
