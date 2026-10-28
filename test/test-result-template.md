# TigerFit CSV to MCP Test Results

## Run metadata

- Date: 2026-10-28
- Candidate: `v162.0`
- Base release: `v161.0`
- Data source: user-supplied CSV; used only in isolated local app and D1 storage
- Production account changed: no
- CSV copied into repository or release assets: no

## Results

| Check | Result | Evidence |
|---|---|---|
| Feature-spec smoke bundle | PASS | `node test/run-spec-smoke.mjs` loaded 25 cases and passed. |
| TypeScript | PASS | `npm run check` |
| Full unit suite | PASS | `npm test` — 2,856 passing. |
| Worker-safe compressed payload decode | PASS | `npx mocha -r ts-node/register --timeout 0 test/nodeEncoder.test.ts` — 1 passing. |
| Cloudflare web bundle | PASS | `npm run build:tigerfit:cloudflare` completed. |
| Worker deploy dry run | PASS | `npx wrangler deploy --dry-run --config cloudflare/tigerfit/wrangler.jsonc --outdir /tmp/tigerfit-worker-release` — exit 0; D1, R2, and static-asset bindings detected. |
| CSV UI import | PASS | Local TigerFit account previewed and imported 2 workout records; sync requests returned HTTP 200. |
| OAuth + MCP history read | PASS | Local dynamic registration, S256 PKCE, consent, token exchange, `initialize`, `tools/list`, and `get_history` all succeeded; MCP returned 2 records. |
| Production endpoint read-only checks | PASS | `/app/`, OAuth metadata, and protected-resource metadata returned HTTP 200; unauthenticated `/mcp` returned expected HTTP 401. Remote D1 reported no unapplied migrations. |
| GitHub tag workflow | PENDING | Runs after pushing `v162.0`; release is complete only if its Android unit, APK, and emulator gates pass. |

## Issues found and fixed

- Cloudflare Worker decompression used `fflate`'s asynchronous browser-worker path, which failed because the Worker runtime has no global `Worker`; switched to `gunzipSync` and added a regression test.
- The D1 adapter passed empty statement arrays to `D1.batch`, which returns an error; empty batch writes/deletes now return successfully. The CSV import and account sync then completed in the local Worker flow.

## Scope limits

- The browser/MCP run used a local-only test account and local D1/R2 persistence; no real TigerFit account or production workout data was changed.
- Android unit/emulator release gates run in the tag-triggered GitHub Actions workflow, not on this host.
- Existing duplicate exercise switch cases and bundle-size advisories remain build warnings; the Cloudflare bundle and dry run still completed successfully.
