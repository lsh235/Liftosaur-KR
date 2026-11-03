const MAX_JSON_CHARS = 8_000;
const MAX_STRING_CHARS = 1_200;
const MAX_ARRAY_ITEMS = 40;
const MAX_OBJECT_KEYS = 60;
const MAX_DEPTH = 8;

const SENSITIVE_KEY = /(?:password|passphrase|secret|token|api[_-]?key|private[_-]?key|authorization|cookie|credential|session[_-]?id|claim[_-]?id|refresh)/i;
const SECRET_TEXT = /\b(?:Bearer\s+\S+|lft(?:sk|ot|rr)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16})\b/g;
const SECRET_ASSIGNMENT = /(password|passwd|secret|access[_-]?token|refresh[_-]?token|api[_-]?key|private[_-]?key|client[_-]?secret|authorization|cookie)\s*[:=]\s*["']?[^"'&\s,}]+/gi;

export interface IMcpActivitySnapshot {
  request: unknown;
  requestJson: string;
  truncated: boolean;
  redactedFields: number;
}

export function McpActivity_sanitize(value: unknown): IMcpActivitySnapshot {
  let redactedFields = 0;
  let truncated = false;

  const visit = (item: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) {
      truncated = true;
      return "[truncated: depth limit]";
    }
    if (typeof item === "string") {
      const cleaned = item
        .replace(SECRET_ASSIGNMENT, (_match, key: string) => {
          redactedFields += 1;
          return `${key}=[redacted]`;
        })
        .replace(SECRET_TEXT, () => {
          redactedFields += 1;
          return "[redacted]";
        });
      if (cleaned.length > MAX_STRING_CHARS) {
        truncated = true;
        return `${cleaned.slice(0, MAX_STRING_CHARS)}…[truncated]`;
      }
      return cleaned;
    }
    if (item == null || typeof item === "boolean" || typeof item === "number") return item;
    if (Array.isArray(item)) {
      const result = item.slice(0, MAX_ARRAY_ITEMS).map((child) => visit(child, depth + 1));
      if (item.length > MAX_ARRAY_ITEMS) {
        truncated = true;
        result.push(`[${item.length - MAX_ARRAY_ITEMS} more items truncated]`);
      }
      return result;
    }
    if (typeof item === "object") {
      const entries = Object.entries(item as Record<string, unknown>);
      const result: Record<string, unknown> = {};
      for (const [key, child] of entries.slice(0, MAX_OBJECT_KEYS)) {
        if (SENSITIVE_KEY.test(key)) {
          result[key] = "[redacted]";
          redactedFields += 1;
        } else {
          result[key] = visit(child, depth + 1);
        }
      }
      if (entries.length > MAX_OBJECT_KEYS) {
        truncated = true;
        result.__truncatedKeys = entries.length - MAX_OBJECT_KEYS;
      }
      return result;
    }
    return String(item);
  };

  let request = visit(value, 0);
  let requestJson = JSON.stringify(request);
  if (requestJson.length > MAX_JSON_CHARS) {
    truncated = true;
    request = { preview: requestJson.slice(0, MAX_JSON_CHARS - 40), __truncated: true };
    requestJson = JSON.stringify(request);
  }
  return { request, requestJson, truncated, redactedFields };
}
