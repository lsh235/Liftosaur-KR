#!/usr/bin/env node

// Serve the already-built dist tree with explicit UTF-8 MIME headers, then
// verify that its production /app entry and bundles parse and mount in Chrome.
// This does not rebuild dist and aborts all non-local requests.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve(process.env.DIST_DIR || "dist");
const chromePath = process.env.CHROME_BIN || "/opt/google/chrome/chrome";
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};
const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/geo") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end('{"consentMode":"none"}');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end("Bad path");
    return;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = resolve(root, `.${pathname}`);
  if (!filePath.startsWith(`${root}${sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  const body = readFileSync(filePath);
  response.writeHead(200, {
    "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "content-length": body.length,
  });
  response.end(body);
});

const listen = () => new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const close = () => new Promise((resolveClose) => server.close(resolveClose));
const sha256 = (body) => createHash("sha256").update(body).digest("hex");

let browser;
try {
  await listen();
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(chromePath) ? { executablePath: chromePath } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  const exceptions = [];
  const blockedRequests = [];
  const responses = [];
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    exceptions.push({
      className: exceptionDetails.exception?.className,
      description: exceptionDetails.exception?.description,
      url: exceptionDetails.url,
      lineNumber: exceptionDetails.lineNumber,
      columnNumber: exceptionDetails.columnNumber,
    });
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.startsWith(origin)) return;
    const contentType = response.headers()["content-type"] || "";
    if (url.includes("/app/") || /\/(?:app|vendors|consent)\.js(?:\?|$)/.test(url)) {
      try {
        const body = await response.body();
        responses.push({
          url,
          status: response.status(),
          contentType,
          bytes: body.length,
          sha256: sha256(body),
        });
      } catch (error) {
        responses.push({ url, status: response.status(), contentType, bodyError: String(error) });
      }
    }
  });
  await cdp.send("Runtime.enable");
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    // The runtime check is for static bundle parse/mount, not API behavior.
    if (url.hostname === "api3.liftosaur.com" && url.pathname === "/api/log") {
      return route.fulfill({ status: 204, body: "" });
    }
    blockedRequests.push(url.href);
    return route.abort();
  });

  const entryUrl = `${origin}/app/?skipintro=1&nosync=true`;
  const entryResponse = await page.goto(entryUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  const mountedHtml = await page.locator("#app").innerHTML();
  const result = {
    entryUrl,
    entryStatus: entryResponse?.status(),
    responses,
    appChildCount: await page.locator("#app").locator(":scope > *").count(),
    mountedHtmlBytes: Buffer.byteLength(mountedHtml),
    exceptions,
    blockedExternalRequestCount: blockedRequests.length,
    blockedExternalHosts: [...new Set(blockedRequests.map((url) => new URL(url).host))],
  };
  console.log(JSON.stringify(result, null, 2));

  const required = ["/app/", "/vendors.js", "/app.js"];
  const missing = required.filter((part) => !responses.some((response) => response.url.includes(part) && response.status === 200));
  const parseError = exceptions.find((exception) => exception.className === "SyntaxError");
  if (entryResponse?.status() !== 200 || missing.length || parseError || !result.mountedHtmlBytes || !result.appChildCount) {
    console.error(JSON.stringify({ missingResponses: missing, parseError: parseError || null }));
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  await close();
}
