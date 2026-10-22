import { expect } from "chai";
import {
  ProgramSchedule_build,
  ProgramSchedule_buildReminderRequests,
  ProgramSchedule_completeSession,
  ProgramSchedule_getNextDate,
  ProgramSchedule_getSessionDate,
  ProgramSchedule_isValid,
  ProgramSchedule_skipSession,
} from "../src/models/programSchedule";
import { Program_create, Program_createExercise } from "../src/models/program";

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
    expect(ProgramSchedule_isValid(ProgramSchedule_build("2026-10-19", [1], 0, 0, "25:60"))).to.equal(false);
    expect(ProgramSchedule_isValid(ProgramSchedule_build("2026-10-19", [1], 0, 0, ""))).to.equal(true);
  });

  it("builds local-time notifications for remaining sessions with the day and lead exercise", () => {
    const program = {
      ...Program_create("알림 테스트", "schedule-reminders"),
      planner: {
        vtype: "planner" as const,
        name: "알림 테스트",
        weeks: [
          {
            name: "1주차",
            days: [
              { name: "월요일: 상체 파워", exerciseText: "바벨 벤치프레스 / 5x5\n랫풀다운 / 3x10" },
              { name: "수요일: 하체 파워", exerciseText: "바벨 스쿼트 / 5x5" },
            ],
          },
        ],
      },
      schedule: ProgramSchedule_build("2026-10-19", [1, 3], 0, 0, "19:00"),
    };
    const now = new Date(2026, 9, 18, 12, 0, 0).getTime();
    const reminders = ProgramSchedule_buildReminderRequests(program, now);

    expect(reminders).to.have.length(2);
    expect(reminders[0]).to.eql({
      id: 0,
      timestamp: new Date(2026, 9, 19, 19, 0, 0).getTime(),
      title: "1주차 · 월요일: 상체 파워",
      body: "바벨 벤치프레스 외 1종목 시작할 시간입니다!",
    });
    expect(reminders[1].timestamp).to.equal(new Date(2026, 9, 21, 19, 0, 0).getTime());
  });

  it("does not schedule past or completed workout sessions", () => {
    const program = {
      ...Program_create("알림 테스트", "schedule-reminders"),
      planner: {
        vtype: "planner" as const,
        name: "알림 테스트",
        weeks: [
          {
            name: "1주차",
            days: [
              { name: "월", exerciseText: "벤치프레스 / 3x5" },
              { name: "수", exerciseText: "스쿼트 / 3x5" },
            ],
          },
        ],
      },
      schedule: ProgramSchedule_build("2026-10-19", [1, 3], 1, 0, "19:00"),
    };
    const now = new Date(2026, 9, 20, 20, 0, 0).getTime();
    const reminders = ProgramSchedule_buildReminderRequests(program, now);
    expect(reminders).to.have.length(1);
    expect(reminders[0].timestamp).to.equal(new Date(2026, 9, 21, 19, 0, 0).getTime());
  });

  it("builds useful reminder details for non-planner programs", () => {
    const bench = { ...Program_createExercise("kg"), id: "bench", name: "바벨 벤치프레스" };
    const row = { ...Program_createExercise("kg"), id: "row", name: "바벨 로우" };
    const legacyProgram = {
      ...Program_create("레거시 일정", "legacy-reminders"),
      exercises: [bench, row],
      days: [
        { id: "upper", name: "월요일: 상체 파워", exercises: [{ id: "bench" }, { id: "row" }] },
        { id: "lower", name: "수요일: 하체 파워", exercises: [{ id: "bench" }] },
      ],
      weeks: [
        {
          id: "week-1",
          name: "1주 차",
          days: [{ id: "upper" }, { id: "lower" }],
        },
      ],
      schedule: ProgramSchedule_build("2026-10-19", [1, 3], 0, 0, "19:00"),
    };
    const now = new Date(2026, 9, 18, 12, 0, 0).getTime();

    const reminders = ProgramSchedule_buildReminderRequests(legacyProgram, now);

    expect(reminders[0]).to.eql({
      id: 0,
      timestamp: new Date(2026, 9, 19, 19, 0, 0).getTime(),
      title: "1주 차 · 월요일: 상체 파워",
      body: "바벨 벤치프레스 외 1종목 시작할 시간입니다!",
    });
    expect(reminders[1].title).to.equal("1주 차 · 수요일: 하체 파워");
  });
});
