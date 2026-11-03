import { Alert } from "react-native";
import RNFS from "react-native-fs";
import Share from "react-native-share";

function mimeTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".csv")) {
    return "text/csv";
  }
  return "text/plain";
}

export function Exporter_toFile(filename: string, contents: string): void {
  void Exporter_toFileAsync(filename, contents);
}

export async function Exporter_toFileAsync(filename: string, contents: string): Promise<boolean> {
  const tempPath = `${RNFS.CachesDirectoryPath}/${filename}`;
  try {
    await RNFS.writeFile(tempPath, contents, "utf8");
    const shareResult = await Share.open({
      url: `file://${tempPath}`,
      type: mimeTypeFromFilename(filename),
      filename,
      failOnCancel: false,
    });
    return shareResult?.success !== false && !shareResult?.dismissedAction;
  } catch (e) {
    const err = e as { message?: string };
    if (err.message && /cancel|cancelled|user did not share/i.test(err.message)) {
      return false;
    }
    Alert.alert("파일을 내보내지 못했습니다", err.message ?? "알 수 없는 오류");
    return false;
  } finally {
    try {
      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath);
      }
    } catch {}
  }
}
