# Tigerfit app and MCP on Cloudflare

This is a separate deployment of this fork. The web app and MCP use this Cloudflare account's Worker, D1 database, and R2 bucket; they do not call the upstream Liftosaur API or use its accounts or storage.

The app is at `https://tigerfit.aixtech.uk/app/` (the domain root redirects there). The MCP endpoint for Codex is `https://tigerfit.aixtech.uk/mcp`.

## Cloudflare resources

- Worker: `tigerfit-app-mcp`
- D1 database: `tigerfit-app`
- R2 bucket: `tigerfit-assets`
- Custom domain: `tigerfit.aixtech.uk`

Cloudflare creates the custom-domain DNS record and TLS certificate when the Worker is deployed with that domain. The Worker serves the built web assets and routes app, sync, MCP, and OAuth requests.

## Deploy

Set the session signing key once, then build, migrate, and deploy:

```sh
openssl rand -hex 48 | npx wrangler secret put COOKIE_SECRET --config cloudflare/tigerfit/wrangler.jsonc
npm run deploy:tigerfit:cloudflare
```

For later deployments, the existing `COOKIE_SECRET` is retained; run only `npm run deploy:tigerfit:cloudflare`. Do not commit the secret or `.dev.vars`.

The build publishes the web bundle and 69 bundled MCP reference files. D1 stores account, OAuth, event, and program records. R2 is configured for app snapshots and revisions.

## Codex connection

Register the remote server in the Codex CLI:

```sh
codex mcp add tigerfit --url https://tigerfit.aixtech.uk/mcp
codex mcp login tigerfit --oauth-client-registration dcr
codex mcp list
```

The login opens Tigerfit's sign-in and consent flow. Codex uses OAuth dynamic client registration and PKCE; the server stores clients, authorization codes, and tokens in its D1 database. In the approval page, sign in or create an account for this Tigerfit deployment.

## Current service boundary

- MCP reference tools are public. Tools that read or change an account require OAuth.
- The web app and MCP share the same Tigerfit account and D1-backed program storage.
- The current self-hosted login supports email and password. It does not send a verification email or password-reset email.
- External identity providers, payment processing, push notifications, and some upstream web pages or image routes are not configured by this Cloudflare Worker.
