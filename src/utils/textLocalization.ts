const koreanCharacterPattern = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;

export function TextLocalization_hasKorean(text: unknown): boolean {
  if (typeof text === "string") {
    return koreanCharacterPattern.test(text);
  }
  if (Array.isArray(text)) {
    return text.some(TextLocalization_hasKorean);
  }
  if (text != null && typeof text === "object" && "props" in text) {
    return TextLocalization_hasKorean((text as { props?: { children?: unknown } }).props?.children);
  }
  return false;
}
