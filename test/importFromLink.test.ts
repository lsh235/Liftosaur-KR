import "mocha";
import { expect } from "chai";
import { Encoder_encode } from "../src/utils/encoder";
import { ImportFromLink_importFromLink } from "../src/utils/importFromLink";

describe("ImportFromLink", () => {
  const noNetwork = (() => {
    throw new Error("Network must not be used by the inline-link tests");
  }) as unknown as Window["fetch"];

  it("returns a Korean recovery message for an invalid link", async () => {
    const result = await ImportFromLink_importFromLink("%invalid", noNetwork);
    expect(result).to.eql({ success: false, error: ["올바르지 않은 링크입니다. 링크를 확인해 주세요."] });
  });

  it("returns a Korean recovery message when a valid URL has no program data", async () => {
    const result = await ImportFromLink_importFromLink("https://liftosaur.com/not-a-program", noNetwork);
    expect(result).to.eql({
      success: false,
      error: ["링크에서 가져올 데이터를 찾지 못했습니다. 링크를 확인해 주세요."],
    });
  });

  it("returns a Korean recovery message for undecodable inline data", async () => {
    const result = await ImportFromLink_importFromLink("https://liftosaur.com/?data=not-base64", noNetwork);
    expect(result).to.eql({
      success: false,
      error: ["링크 데이터를 읽을 수 없습니다. 링크가 손상되지 않았는지 확인해 주세요."],
    });
  });

  it("still imports valid inline data without a network request", async () => {
    const encoded = await Encoder_encode("liftosaur://valid-program");
    const result = await ImportFromLink_importFromLink(`https://liftosaur.com/?data=${encodeURIComponent(encoded)}`, noNetwork);
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.decoded).to.equal("liftosaur://valid-program");
      expect(result.data.source).to.equal(undefined);
      expect(result.data.userid).to.equal(undefined);
    }
  });
});
