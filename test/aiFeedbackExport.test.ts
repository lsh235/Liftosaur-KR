import { expect } from "chai";
import { IHistoryRecord, ISet } from "../src/types";
import { Settings_build } from "../src/models/settings";
import { Program_create } from "../src/models/program";
import { Weight_build } from "../src/models/weight";
import { AiFeedbackExport_buildMarkdown } from "../src/utils/aiFeedbackExport";
import { ProgramSchedule_build } from "../src/models/programSchedule";

function set(id: string, weight: number, reps: number, label?: string): ISet {
  return {
    vtype: "set",
    index: 0,
    id,
    reps,
    weight: Weight_build(weight, "kg"),
    completedReps: reps,
    completedWeight: Weight_build(weight, "kg"),
    completedRpe: 8,
    isCompleted: true,
    label,
  };
}

function record(week: number, timestamp: number, weight: number): IHistoryRecord {
  return {
    vtype: "history_record",
    date: new Date(timestamp).toISOString().slice(0, 10),
    programId: "phat-program",
    programName: "PHAT 테스트",
    day: 0,
    dayName: "월요일: 상체 파워",
    startTime: timestamp,
    endTime: timestamp + 60 * 60 * 1000,
    id: timestamp,
    week,
    entries: [
      {
        vtype: "history_entry",
        id: "benchPress_barbell",
        index: 0,
        exercise: { id: "benchPress", equipment: "barbell" },
        warmupSets: [set("warmup", 40, 8, "WARMUP")],
        sets: [set("top", weight, 5, "TOP"), set("backoff", weight - 10, 8, "BACKOFF")],
        notes: week === 6 ? "오른쪽 손목이 약간 시큰거렸음." : undefined,
      },
    ],
  };
}

describe("AI feedback Markdown export", () => {
  it("summarizes progression and exports detailed target-versus-actual logs with the user's note", () => {
    const firstTimestamp = new Date("2026-01-05T10:00:00Z").getTime();
    const finalTimestamp = new Date("2026-02-09T10:00:00Z").getTime();
    const scheduledProgram = {
      ...Program_create("PHAT 테스트", "phat-program"),
      schedule: ProgramSchedule_build("2026-01-05", [1, 2, 3, 4, 5], 2, 1),
      planner: {
        vtype: "planner" as const,
        name: "PHAT 테스트",
        weeks: Array.from({ length: 6 }, (_unusedWeek, weekIndex) => ({
          name: `${weekIndex + 1}주차`,
          days: Array.from({ length: 5 }, (_unusedDay, dayIndex) => ({
            name: `${dayIndex + 1}일차`,
            exerciseText: "Bench Press",
          })),
        })),
      },
    };
    const markdown = AiFeedbackExport_buildMarkdown(
      [record(1, firstTimestamp, 80), record(6, finalTimestamp, 90)],
      Settings_build("kg"),
      "다음 루틴은 어깨 측면 볼륨을 늘려줘.",
      new Date("2026-02-10T10:00:00Z").getTime(),
      "6주 PHAT 수행 총평",
      [scheduledProgram]
    );

    expect(markdown).to.include("# 6주 PHAT 수행 총평");
    expect(markdown).to.include("완료 세션 수: 2");
    expect(markdown).to.include("일정 밀림 횟수: 1회");
    expect(markdown).to.include("다음 루틴은 어깨 측면 볼륨을 늘려줘.");
    expect(markdown).to.include("1주차");
    expect(markdown).to.include("6주차");
    expect(markdown).to.include("93.3kg");
    expect(markdown).to.include("105kg");
    expect(markdown).to.include("목표 80kg × 5회 → 실제 80kg × 5회 @RPE 8");
    expect(markdown).to.include("오른쪽 손목이 약간 시큰거렸음.");
    expect(markdown).to.include("워밍업 제외");
  });
});
