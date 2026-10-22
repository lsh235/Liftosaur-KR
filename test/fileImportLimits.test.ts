import "mocha";
import { expect } from "chai";
import {
  FileImportLimits_decodeUtf8,
  FileImportLimits_isContentTooLarge,
  FileImportLimits_isTooLarge,
  FileImportLimits_readBoundedBinary,
  FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES,
} from "../src/utils/fileImportLimits";

describe("FileImportLimits", () => {
  it("checks the file-size boundary in bytes", () => {
    expect(
      FileImportLimits_isTooLarge(FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES, FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES)
    ).to.equal(false);
    expect(
      FileImportLimits_isTooLarge(FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES + 1, FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES)
    ).to.equal(true);
    expect(FileImportLimits_isTooLarge(undefined, FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES)).to.equal(false);
  });

  it("counts UTF-8 bytes for Korean text and supplementary characters", () => {
    expect(FileImportLimits_isContentTooLarge("가", 2)).to.equal(true);
    expect(FileImportLimits_isContentTooLarge("가", 3)).to.equal(false);
    expect(FileImportLimits_isContentTooLarge("🏋️", 6)).to.equal(true);
    expect(FileImportLimits_isContentTooLarge("🏋️", 7)).to.equal(false);
  });

  it("continues short reads but never requests more than one byte over the limit", async () => {
    const source = "0123456789abcdef";
    const calls: Array<{ length: number; position: number }> = [];
    const result = await FileImportLimits_readBoundedBinary(async (length, position) => {
      calls.push({ length, position });
      return source.slice(position, position + Math.min(length, 3));
    }, 7);

    expect(result).to.deep.equal({ binary: "01234567", tooLarge: true });
    expect(calls).to.deep.equal([
      { length: 8, position: 0 },
      { length: 5, position: 3 },
      { length: 2, position: 6 },
    ]);
  });

  it("joins split UTF-8 bytes before decoding a file within the limit", async () => {
    const expected = "가슴 프레스 🏋️";
    const binary = Array.from(new TextEncoder().encode(expected), (byte) => String.fromCharCode(byte)).join("");
    const result = await FileImportLimits_readBoundedBinary(async (length, position) => {
      return binary.slice(position, position + Math.min(length, 2));
    }, binary.length);

    expect(result.tooLarge).to.equal(false);
    expect(FileImportLimits_decodeUtf8(result.binary)).to.equal(expected);
  });
});
