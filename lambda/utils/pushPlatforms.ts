export type IPushPlatform = "ios" | "android";

// SNS platform applications have no CloudFormation resource (aws/aws-cdk#36681), so they are created once
// with `aws sns create-platform-application`. Self-hosted deployments must supply their own ARNs; they must
// never register device tokens with the upstream Liftosaur applications.
function platformArn(name: string, upstreamArn: string): string {
  return process.env.MCP_ALLOW_SELF_HOSTED === "true" ? process.env[name] || "" : upstreamArn;
}

export const PushPlatforms_arns: Record<"dev" | "prod", Record<IPushPlatform, string>> = {
  dev: {
    ios: platformArn("LIFTOSAUR_IOS_DEV_SNS_PLATFORM_ARN", "arn:aws:sns:us-west-2:366191129585:app/APNS_SANDBOX/LiftosaurIosDev"),
    android: platformArn("LIFTOSAUR_ANDROID_DEV_SNS_PLATFORM_ARN", "arn:aws:sns:us-west-2:366191129585:app/GCM/LiftosaurAndroid"),
  },
  prod: {
    ios: platformArn("LIFTOSAUR_IOS_SNS_PLATFORM_ARN", "arn:aws:sns:us-west-2:366191129585:app/APNS/LiftosaurIosProd"),
    android: platformArn("LIFTOSAUR_ANDROID_SNS_PLATFORM_ARN", "arn:aws:sns:us-west-2:366191129585:app/GCM/LiftosaurAndroid"),
  },
};

export function PushPlatforms_apnsKey(env: "dev" | "prod"): "APNS" | "APNS_SANDBOX" {
  return env === "dev" ? "APNS_SANDBOX" : "APNS";
}

export function PushPlatforms_isPlatform(value: unknown): value is IPushPlatform {
  return value === "ios" || value === "android";
}
