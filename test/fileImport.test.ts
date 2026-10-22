import "mocha";
import { expect } from "chai";
import { FileImport_pickFile } from "../src/utils/fileImport";

type IReaderFailure = "error" | "abort" | "throw" | "cancel";

async function pickFileWithReaderFailure(
  failure: IReaderFailure
): Promise<{ result: string | undefined; alerts: string[] }> {
  const browserGlobals = globalThis as unknown as {
    document: Document;
    window: Window;
    FileReader: typeof FileReader;
  };
  const previousDocument = browserGlobals.document;
  const previousWindow = browserGlobals.window;
  const previousFileReader = browserGlobals.FileReader;
  const alerts: string[] = [];
  let onchange: HTMLInputElement["onchange"] = null;
  let oncancel: HTMLInputElement["oncancel"] = null;
  const input = {
    type: "",
    accept: "",
    style: { display: "" },
    files: [{ name: "program.json" }] as unknown as FileList,
    set onchange(handler: HTMLInputElement["onchange"]) {
      onchange = handler;
    },
    get onchange(): HTMLInputElement["onchange"] {
      return onchange;
    },
    set oncancel(handler: HTMLInputElement["oncancel"]) {
      oncancel = handler;
    },
    get oncancel(): HTMLInputElement["oncancel"] {
      return oncancel;
    },
    click() {
      if (failure === "cancel") {
        oncancel?.call(this as unknown as GlobalEventHandlers, {} as Event);
      } else {
        onchange?.call(this as unknown as GlobalEventHandlers, {} as Event);
      }
    },
  } as unknown as HTMLInputElement;

  class MockFileReader {
    public onload: FileReader["onload"] = null;
    public onerror: FileReader["onerror"] = null;
    public onabort: FileReader["onabort"] = null;

    public readAsText(_file: Blob): void {
      if (failure === "throw") {
        throw new Error("read failed");
      }
      if (failure === "error") {
        this.onerror?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      } else {
        this.onabort?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }
  }

  browserGlobals.document = { createElement: () => input } as unknown as Document;
  browserGlobals.window = { alert: (message: string) => alerts.push(message) } as unknown as Window;
  browserGlobals.FileReader = MockFileReader as unknown as typeof FileReader;

  try {
    const result = await FileImport_pickFile("any");
    return { result, alerts };
  } finally {
    browserGlobals.document = previousDocument;
    browserGlobals.window = previousWindow;
    browserGlobals.FileReader = previousFileReader;
  }
}

describe("web FileImport_pickFile", () => {
  it("shows a Korean error when the browser cannot read the selected file", async () => {
    const { result, alerts } = await pickFileWithReaderFailure("error");

    expect(result).to.equal(undefined);
    expect(alerts).to.eql(["파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인한 뒤 다시 시도하세요."]);
  });

  it("shows a Korean message when the file read is aborted", async () => {
    const { result, alerts } = await pickFileWithReaderFailure("abort");

    expect(result).to.equal(undefined);
    expect(alerts).to.eql(["파일 읽기가 중단되었습니다. 다시 시도하세요."]);
  });

  it("resolves and reports synchronous readAsText failures", async () => {
    const { result, alerts } = await pickFileWithReaderFailure("throw");

    expect(result).to.equal(undefined);
    expect(alerts).to.eql(["파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인한 뒤 다시 시도하세요."]);
  });

  it("resolves quietly when the user cancels the file picker", async () => {
    const { result, alerts } = await pickFileWithReaderFailure("cancel");

    expect(result).to.equal(undefined);
    expect(alerts).to.eql([]);
  });
});
