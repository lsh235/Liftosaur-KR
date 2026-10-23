import "mocha";
import { expect } from "chai";
import { TextLocalization_hasKorean } from "../src/utils/textLocalization";

describe("Korean font fallback detection", () => {
  it("detects Korean in Hangul-only and mixed labels", () => {
    expect(TextLocalization_hasKorean("운동 일정")).to.equal(true);
    expect(TextLocalization_hasKorean("운동 시간 알림 19:00")).to.equal(true);
  });

  it("ignores Latin-only labels and non-text React children", () => {
    expect(TextLocalization_hasKorean("19:00 / Barbell")).to.equal(false);
    expect(TextLocalization_hasKorean(19)).to.equal(false);
  });

  it("detects Korean inside nested text children", () => {
    expect(TextLocalization_hasKorean([{ props: { children: ["Set ", { props: { children: "완료" } }] } }])).to.equal(
      true
    );
  });
});
