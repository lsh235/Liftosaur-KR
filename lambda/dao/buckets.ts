import { Utils_getEnv } from "../utils";

const resourcePrefix = process.env.LIFTOSAUR_RESOURCE_PREFIX?.toLowerCase();
if (resourcePrefix && !/^[a-z0-9-]{1,20}$/.test(resourcePrefix)) {
  throw new Error("LIFTOSAUR_RESOURCE_PREFIX must contain only lowercase letters, digits, and hyphens (max 20 chars)");
}

function bucketName(name: string): string {
  if (!resourcePrefix) {
    return name;
  }
  const privateName = name.replace(/^liftosaur/, "").replace(/^lft/, "");
  return `${resourcePrefix}-${privateName}`;
}

export const LftS3Buckets = {
  caches: bucketName("liftosaurcaches2"),
  stats: bucketName("liftosaurstats"),
  debugs: bucketName("liftosaurdebugs2"),
  exceptions: bucketName("liftosaurexceptions2"),
  storages: bucketName("liftosaurstorages"),
  programs: bucketName("liftosaurprograms"),
  assets: bucketName("liftosaurassets"),
  images: resourcePrefix ? bucketName("exerciseimages") : "liftosaurimages2",
  userimages: bucketName("liftosauruserimages"),
  static: bucketName("lftstatic"),
};

export function getUserImagesPrefix(): string {
  const host = process.env.HOST || (Utils_getEnv() === "dev" ? "https://stage.liftosaur.com" : "https://www.liftosaur.com");
  return `${host.replace(/\/$/, "")}/userimages/`;
}
