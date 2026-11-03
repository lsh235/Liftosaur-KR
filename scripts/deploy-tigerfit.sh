#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Tigerfit deploy preflight failed: %s\n' "$1" >&2
  exit 2
}

command -v aws >/dev/null 2>&1 || fail "AWS CLI is required and is not installed"
command -v node >/dev/null 2>&1 || fail "Node.js is required to create deployment secrets"
command -v npm >/dev/null 2>&1 || fail "npm is required to build the Lambda dependency layer"
if ! command -v docker >/dev/null 2>&1 && \
  { [[ "$(uname -s)" != "Linux" ]] || [[ "$(uname -m)" != "x86_64" ]]; }; then
  fail "Docker or a Linux x86_64 host is required to build the Lambda dependency layer"
fi
if [[ -z "${NODE_OPTIONS:-}" ]]; then
  export NODE_OPTIONS="--max-old-space-size=8192"
fi

secret_file=""
origin_secret_file=""
trap 'rm -f "${secret_file:-}" "${origin_secret_file:-}"' EXIT

export LIFTOSAUR_HOST="${LIFTOSAUR_HOST:-https://tigerfit.aixtech.uk}"
export LIFTOSAUR_API_HOST="${LIFTOSAUR_API_HOST:-https://api.tigerfit.aixtech.uk}"
export LIFTOSAUR_MCP_BASE_URL="${LIFTOSAUR_MCP_BASE_URL:-https://tigerfit.aixtech.uk}"
export LIFTOSAUR_SESSION_COOKIE_DOMAIN="${LIFTOSAUR_SESSION_COOKIE_DOMAIN:-.tigerfit.aixtech.uk}"
export AWS_DEFAULT_REGION="us-west-2"
export AWS_REGION="us-west-2"
export CDK_DEFAULT_REGION="us-west-2"

account_id="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" || \
  fail "AWS credentials are unavailable; configure an AWS SSO/profile or role for this workspace"
[[ "$account_id" =~ ^[0-9]{12}$ ]] || fail "AWS returned an invalid account ID"
[[ "$account_id" != "366191129585" ]] || fail "refusing to deploy into Liftosaur's upstream AWS account"
export CDK_DEFAULT_ACCOUNT="$account_id"
export LIFTOSAUR_RESOURCE_PREFIX="${LIFTOSAUR_RESOURCE_PREFIX:-tfit${account_id}}"

for name in LIFTOSAUR_API_CERT_ARN LIFTOSAUR_CLOUDFRONT_CERT_ARN LIFTOSAUR_FROM_EMAIL; do
  [[ -n "${!name:-}" ]] || fail "$name must be set to a verified resource in the target AWS account"
done

case "$LIFTOSAUR_API_CERT_ARN" in
  "arn:aws:acm:us-west-2:${account_id}:certificate/"*) ;;
  *) fail "LIFTOSAUR_API_CERT_ARN must be an ACM certificate in us-west-2 in account $account_id" ;;
esac
case "$LIFTOSAUR_CLOUDFRONT_CERT_ARN" in
  "arn:aws:acm:us-east-1:${account_id}:certificate/"*) ;;
  *) fail "LIFTOSAUR_CLOUDFRONT_CERT_ARN must be an ACM certificate in us-east-1 in account $account_id" ;;
esac

api_cert_status="$(aws acm describe-certificate --region us-west-2 \
  --certificate-arn "$LIFTOSAUR_API_CERT_ARN" --query Certificate.Status --output text 2>/dev/null)" || \
  fail "could not inspect the API Gateway certificate"
[[ "$api_cert_status" == "ISSUED" ]] || fail "API Gateway ACM certificate must be ISSUED in us-west-2"
api_cert_names="$(aws acm describe-certificate --region us-west-2 \
  --certificate-arn "$LIFTOSAUR_API_CERT_ARN" --query 'Certificate.SubjectAlternativeNames' --output text)"
[[ "$api_cert_names" == *"api.tigerfit.aixtech.uk"* ]] || \
  fail "API Gateway certificate must cover api.tigerfit.aixtech.uk"

cloudfront_cert_status="$(aws acm describe-certificate --region us-east-1 \
  --certificate-arn "$LIFTOSAUR_CLOUDFRONT_CERT_ARN" --query Certificate.Status --output text 2>/dev/null)" || \
  fail "could not inspect the CloudFront certificate"
[[ "$cloudfront_cert_status" == "ISSUED" ]] || fail "CloudFront ACM certificate must be ISSUED in us-east-1"
cloudfront_cert_names="$(aws acm describe-certificate --region us-east-1 \
  --certificate-arn "$LIFTOSAUR_CLOUDFRONT_CERT_ARN" --query 'Certificate.SubjectAlternativeNames' --output text)"
[[ "$cloudfront_cert_names" == *"tigerfit.aixtech.uk"* && "$cloudfront_cert_names" == *"api.tigerfit.aixtech.uk"* ]] || \
  fail "CloudFront certificate must cover tigerfit.aixtech.uk and api.tigerfit.aixtech.uk"

if [[ -z "${LIFTOSAUR_SECRETS_ARN:-}" ]]; then
  if secret_arn="$(aws secretsmanager describe-secret --secret-id tigerfit/lftAppSecrets \
    --query ARN --output text 2>/dev/null)"; then
    export LIFTOSAUR_SECRETS_ARN="$secret_arn"
  else
    secret_file="$(mktemp)"
    chmod 600 "$secret_file"
    node -e 'const crypto = require("crypto"); process.stdout.write(JSON.stringify({apiKey: crypto.randomBytes(32).toString("hex"), cookieSecret: crypto.randomBytes(32).toString("hex"), cryptoKey: crypto.randomBytes(32).toString("hex")}));' >"$secret_file"
    export LIFTOSAUR_SECRETS_ARN="$(aws secretsmanager create-secret \
      --name tigerfit/lftAppSecrets --description "Private app secrets for the Tigerfit fork" \
      --secret-string "file://$secret_file" --query ARN --output text)" || \
      fail "could not create the Tigerfit app secret"
  fi
fi
case "$LIFTOSAUR_SECRETS_ARN" in
  "arn:aws:secretsmanager:us-west-2:${account_id}:secret:"*) ;;
  *) fail "LIFTOSAUR_SECRETS_ARN must be a Secrets Manager secret in us-west-2 in account $account_id" ;;
esac

if [[ -z "${LFT_ORIGIN_VERIFY_SECRET:-}" ]]; then
  if [[ -n "${LIFTOSAUR_ORIGIN_VERIFY_SECRET_ARN:-}" ]]; then
    case "$LIFTOSAUR_ORIGIN_VERIFY_SECRET_ARN" in
      "arn:aws:secretsmanager:us-west-2:${account_id}:secret:"*) ;;
      *) fail "LIFTOSAUR_ORIGIN_VERIFY_SECRET_ARN must be a Secrets Manager secret in this AWS account and us-west-2" ;;
    esac
    export LFT_ORIGIN_VERIFY_SECRET="$(aws secretsmanager get-secret-value \
      --secret-id "$LIFTOSAUR_ORIGIN_VERIFY_SECRET_ARN" --query SecretString --output text)" || \
      fail "could not read the CloudFront origin verification secret"
  else
    if ! origin_secret_arn="$(aws secretsmanager describe-secret --secret-id tigerfit/lftOriginVerify \
      --query ARN --output text 2>/dev/null)"; then
      origin_secret_file="$(mktemp)"
      chmod 600 "$origin_secret_file"
      node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"));' >"$origin_secret_file"
      origin_secret_arn="$(aws secretsmanager create-secret \
        --name tigerfit/lftOriginVerify --description "CloudFront origin verification for Tigerfit" \
        --secret-string "file://$origin_secret_file" --query ARN --output text)" || \
        fail "could not create the CloudFront origin verification secret"
    fi
    export LFT_ORIGIN_VERIFY_SECRET="$(aws secretsmanager get-secret-value \
      --secret-id "$origin_secret_arn" --query SecretString --output text)" || \
      fail "could not read the CloudFront origin verification secret"
  fi
fi
[[ -n "$LFT_ORIGIN_VERIFY_SECRET" ]] || fail "origin verification secret is empty"

printf 'Building the Tigerfit fork and its private MCP backend for AWS account %s in us-west-2\n' "$account_id"
if command -v taskset >/dev/null 2>&1; then
  affinity="$(taskset -pc "$$")"
  allowed_cpus="${affinity##*: }"
  build_cpus="$(node -e '
    const available = process.argv[1].split(",");
    const selected = [];
    for (const range of available) {
      const [start, end = start] = range.split("-").map(Number);
      for (let cpu = start; cpu <= end && selected.length < 4; cpu += 1) selected.push(cpu);
      if (selected.length === 4) break;
    }
    process.stdout.write(selected.join(","));
  ' "$allowed_cpus")"
  if [[ -n "$build_cpus" ]]; then
    printf 'Limiting the production web build to CPUs %s to control memory use.\n' "$build_cpus"
    taskset -c "$build_cpus" npm run build:prepare
  else
    npm run build:prepare
  fi
else
  npm run build:prepare
fi
npm run build:lambda

printf 'Preparing CDK deployment resources in us-east-1 and us-west-2.\n'
npx cdk bootstrap "aws://$account_id/us-east-1" "aws://$account_id/us-west-2"

printf 'Deploying the private Tigerfit WAF in us-east-1.\n'
npx cdk deploy TigerfitWaf --require-approval never
export LIFTOSAUR_WAF_WEB_ACL_ARN="$(aws cloudformation describe-stacks --region us-east-1 \
  --stack-name TigerfitWaf \
  --query "Stacks[0].Outputs[?OutputKey=='WafWebAclArn'].OutputValue | [0]" --output text)"
[[ -n "$LIFTOSAUR_WAF_WEB_ACL_ARN" && "$LIFTOSAUR_WAF_WEB_ACL_ARN" != "None" ]] || \
  fail "could not read WAF ARN from TigerfitWaf stack outputs"

printf 'Deploying the independent Tigerfit app and MCP backend in us-west-2.\n'
npx cdk deploy TigerfitStack --require-approval never
printf 'Deployment finished. Read MainDistributionDomain from the TigerfitStack outputs and create Cloudflare DNS-only CNAME records for tigerfit and api.\n'
