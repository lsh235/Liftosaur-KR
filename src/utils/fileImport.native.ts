import { pick, types } from "@react-native-documents/picker";
import { Platform } from "react-native";
import RNFS from "react-native-fs";
import { Dialog_alert, Dialog_confirm } from "./dialog";
import {
  FileImportLimits_decodeUtf8,
  FileImportLimits_readBoundedBinary,
  FileImportLimits_isTooLarge,
  FileImportLimits_sizeError,
  IFileImportOptions,
} from "./fileImportLimits";

export type IFileImportType = "json" | "csv" | "any";

export async function FileImport_pickFile(
  fileType: IFileImportType = "any",
  options: IFileImportOptions = {}
): Promise<string | undefined> {
  try {
    const acceptedTypes =
      fileType === "csv"
        ? [types.csv, types.plainText]
        : fileType === "json"
          ? [types.json, types.plainText]
          : [types.allFiles];
    const [result] = await pick({ type: acceptedTypes, allowMultiSelection: false });
    if (!result?.uri) {
      return undefined;
    }
    // Android returns a percent-encoded content:// uri whose temporary read grant is keyed to that exact
    // string - decoding it makes ContentResolver reject the read ("requires ACTION_OPEN_DOCUMENT"), so pass
    // it through untouched. iOS returns a file:// uri, but RNFS expects a decoded plain path there.
    const path = Platform.OS === "android" ? result.uri : decodeURIComponent(result.uri).replace(/^file:\/\//, "");
    if (options.maxSizeBytes != null) {
      let fileSize = result.size;
      if (fileSize == null) {
        try {
          fileSize = (await RNFS.stat(path)).size;
        } catch (_) {
          // Some document providers expose readable content streams without a local path for stat().
        }
      }
      if (FileImportLimits_isTooLarge(fileSize, options.maxSizeBytes)) {
        Dialog_alert(FileImportLimits_sizeError(options.maxSizeBytes));
        return undefined;
      }
    }
    if (options.maxSizeBytes != null) {
      // Bound the native read even when a document provider cannot report size or stat the content:// URI.
      // Read as ASCII so each returned JS character represents one byte, then decode the joined byte stream.
      const boundedRead = await FileImportLimits_readBoundedBinary(
        (length, position) => RNFS.read(path, length, position, "ascii"),
        options.maxSizeBytes
      );
      if (boundedRead.tooLarge) {
        Dialog_alert(FileImportLimits_sizeError(options.maxSizeBytes));
        return undefined;
      }
      return FileImportLimits_decodeUtf8(boundedRead.binary);
    }
    return await RNFS.readFile(path, "utf8");
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "DOCUMENT_PICKER_CANCELED" || err.code === "OPERATION_CANCELED") {
      return undefined;
    }
    Dialog_alert("파일을 가져오지 못했습니다: " + (err.message ?? "알 수 없는 오류"));
    return undefined;
  }
}

export async function FileImport_confirm(message: string): Promise<boolean> {
  return Dialog_confirm(message);
}
