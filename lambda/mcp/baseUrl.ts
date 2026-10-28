import { Utils_getEnv, Utils_isLocal } from "../utils";

/** The public origin used in MCP OAuth discovery and WWW-Authenticate headers. */
export function McpBaseUrl_get(): string {
  const configured = process.env.MCP_BASE_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error("MCP_BASE_URL must be an origin without a path, query, or fragment");
    }
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "local.liftosaur.com") {
      throw new Error("MCP_BASE_URL must use HTTPS outside local development");
    }
    return url.origin;
  }

  if (Utils_isLocal()) {
    return "https://local.liftosaur.com:8080";
  }
  return Utils_getEnv() === "dev" ? "https://stage.liftosaur.com" : "https://www.liftosaur.com";
}
