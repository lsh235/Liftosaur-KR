export const FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export interface IFileImportOptions {
  maxSizeBytes?: number;
}

export function FileImportLimits_isTooLarge(fileSize: number | undefined | null, maxSizeBytes: number): boolean {
  return fileSize != null && fileSize > maxSizeBytes;
}

export function FileImportLimits_isContentTooLarge(contents: string, maxSizeBytes: number): boolean {
  let byteLength = 0;
  for (const character of contents) {
    const codePoint = character.codePointAt(0)!;
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    if (byteLength > maxSizeBytes) {
      return true;
    }
  }
  return false;
}

export async function FileImportLimits_readBoundedBinary(
  read: (length: number, position: number) => Promise<string>,
  maxSizeBytes: number
): Promise<{ binary: string; tooLarge: boolean }> {
  if (!Number.isSafeInteger(maxSizeBytes) || maxSizeBytes < 0 || maxSizeBytes >= 0x7fffffff) {
    throw new RangeError("maxSizeBytes must be a non-negative integer supported by the native file reader");
  }
  const readLimit = maxSizeBytes + 1;
  const chunks: string[] = [];
  let bytesRead = 0;
  while (bytesRead < readLimit) {
    const chunk = await read(readLimit - bytesRead, bytesRead);
    if (chunk.length === 0) {
      break;
    }
    const boundedChunk = chunk.slice(0, readLimit - bytesRead);
    chunks.push(boundedChunk);
    bytesRead += boundedChunk.length;
  }
  return { binary: chunks.join(""), tooLarge: bytesRead > maxSizeBytes };
}

export function FileImportLimits_decodeUtf8(binary: string): string {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  return decodeURIComponent(escape(binary));
}

export function FileImportLimits_sizeError(maxSizeBytes: number): string {
  const megabytes = Math.max(1, Math.floor(maxSizeBytes / 1024 / 1024));
  return `파일이 너무 큽니다. 운동 프로그램은 최대 ${megabytes}MB까지 가져올 수 있습니다.`;
}
