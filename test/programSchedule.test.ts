import { expect } from "chai";
import {
  ProgramSchedule_build,
  ProgramSchedule_completeSession,
  ProgramSchedule_getNextDate,
  ProgramSchedule_getSessionDate,
  ProgramSchedule_isValid,
  ProgramSchedule_skipSession,
} from "../src/models/programSchedule";

describe("ProgramSchedule", () => {
  it("maps weekdays and keeps weekend rest days out of the session calendar", () => {
    const schedule = ProgramSchedule_build("2026-10-19", [1, 2, 3, 4, 5]);
    expect(ProgramSchedule_getSessionDate(schedule, 0, 10)).to.equal("2026-10-19");
    expect(ProgramSchedule_getSessionDate(schedule, 4, 10)).to.equal("2026-10-23");
    expect(ProgramSchedule_getSessionDate(schedule, 5, 10)).to.equal("2026-10-26");
  });

  it("shifts the current and all later incomplete sessions when a weekday is skipped", () => {
    const beforeSkip = ProgramSchedule_build("2026-10-19", [1, 2, 3, 4, 5], 3);
    const afterSkip = ProgramSchedule_skipSession(beforeSkip, 30);

    expect(ProgramSchedule_getSessionDate(beforeSkip, 3, 30)).to.equal("2026-10-22");
    expect(ProgramSchedule_getSessionDate(afterSkip, 2, 30)).to.equal("2026-10-21");
    expect(ProgramSchedule_getSessionDate(afterSkip, 3, 30)).to.equal("2026-10-23");
    expect(ProgramSchedule_getSessionDate(afterSkip, 4, 30)).to.equal("2026-10-26");

    const afterCompletingShiftedSession = ProgramSchedule_completeSession(afterSkip);
    expect(ProgramSchedule_getNextDate(afterCompletingShiftedSession, 30)).to.equal("2026-10-26");
  });

  it("supports weekend workout days and finishes after the configured program sessions", () => {
    const schedule = ProgramSchedule_build("2026-10-24", [6, 7]);
    expect(ProgramSchedule_getNextDate(schedule, 2)).to.equal("2026-10-24");
    expect(ProgramSchedule_getSessionDate(schedule, 1, 2)).to.equal("2026-10-25");
    expect(
      ProgramSchedule_getNextDate(ProgramSchedule_completeSession(ProgramSchedule_completeSession(schedule)), 2)
    ).to.equal(undefined);
    expect(ProgramSchedule_skipSession(schedule, 2)).to.eql({ ...schedule, shiftCount: 1 });
  });

  it("rejects invalid dates and requires at least one workout weekday", () => {
    expect(ProgramSchedule_isValid(ProgramSchedule_build("2026-02-30", [1]))).to.equal(false);
    expect(ProgramSchedule_isValid(ProgramSchedule_build("2026-10-19", []))).to.equal(false);
    expect(ProgramSchedule_isValid(ProgramSchedule_build("2026-10-19", [1, 1]))).to.equal(true);
    expect(ProgramSchedule_build("2026-10-19", [1, 1]).weekdays).to.eql([1]);
  });
});
