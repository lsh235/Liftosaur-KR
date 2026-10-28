import "mocha";
import { expect } from "chai";
import { gzipSync } from "fflate";
import { NodeEncoder_decode } from "../lambda/utils/nodeEncoder";

describe("NodeEncoder_decode", () => {
  it("decodes compressed payloads without a Web Worker global", async () => {
    const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
    // Cloudflare Workers do not expose the browser Web Worker constructor.
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: undefined });
    try {
      const content = JSON.stringify({ storageUpdate: { history: [{ startTime: 123 }] } });
      const dataUrl = `data:application/octet-stream;base64,${Buffer.from(gzipSync(Buffer.from(content))).toString("base64")}`;
      const encoded = Buffer.from(dataUrl).toString("base64");

      expect(await NodeEncoder_decode(encoded)).to.equal(content);
    } finally {
      if (workerDescriptor) {
        Object.defineProperty(globalThis, "Worker", workerDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "Worker");
      }
    }
  });
});
