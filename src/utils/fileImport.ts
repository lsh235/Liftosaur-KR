import { Dialog_alert, Dialog_confirm } from "./dialog";
import { FileImportLimits_isTooLarge, FileImportLimits_sizeError, IFileImportOptions } from "./fileImportLimits";

export type IFileImportType = "json" | "csv" | "any";

export async function FileImport_pickFile(
  fileType: IFileImportType = "any",
  options: IFileImportOptions = {}
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      fileType === "csv" ? ".csv,text/csv,text/plain" : fileType === "json" ? ".json,application/json,text/plain" : "";
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(undefined);
        return;
      }
      if (options.maxSizeBytes != null && FileImportLimits_isTooLarge(file.size, options.maxSizeBytes)) {
        Dialog_alert(FileImportLimits_sizeError(options.maxSizeBytes));
        resolve(undefined);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        resolve(typeof result === "string" ? result : undefined);
      };
      reader.onerror = () => {
        Dialog_alert("파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인한 뒤 다시 시도하세요.");
        resolve(undefined);
      };
      reader.onabort = () => {
        Dialog_alert("파일 읽기가 중단되었습니다. 다시 시도하세요.");
        resolve(undefined);
      };
      try {
        reader.readAsText(file);
      } catch (_) {
        Dialog_alert("파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인한 뒤 다시 시도하세요.");
        resolve(undefined);
      }
    };
    input.oncancel = () => resolve(undefined);
    input.click();
  });
}

export async function FileImport_confirm(message: string): Promise<boolean> {
  return Dialog_confirm(message);
}
