import { expect } from "chai";
import { IHistoryRecord, ISet } from "../src/types";
import { Settings_build } from "../src/models/settings";
import { Exercise_getMetadata } from "../src/models/exercise";
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

function record(week: number, timestamp: number, weight: number, day: number = week): IHistoryRecord {
  return {
    vtype: "history_record",
    date: new Date(timestamp).toISOString().slice(0, 10),
    programId: "phat-program",
    programName: "PHAT 테스트",
    day,
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
  it("retains fractional imported targets, adjusted equipment loads and actual weights separately", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    workout.entries[0].sets = [set("fractional", 20, 12, "STRAIGHT")];
    const target = workout.entries[0].sets[0];
    target.originalWeight = Weight_build(21.25, "kg");
    target.completedWeight = Weight_build(23.75, "kg");
    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "");
    expect(markdown).to.include("목표 21.25kg × 12회 (기구 조정 20kg) → 실제 23.75kg × 12회 @RPE 8 · ✅ 목표 초과");
    expect(markdown).to.include("세션 볼륨(워밍업 제외, 실제 중량 기록 기준): 285kg");
    target.completedWeight = Weight_build(20, "kg");
    expect(AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "")).to.include("⚠️ 목표 미달");
  });
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
    expect(markdown).to.include("다음 루틴은 어깨 측면 볼륨을 늘려줘\\.");
    expect(markdown).to.include("1주차");
    expect(markdown).to.include("6주차");
    expect(markdown).to.include("93.3kg");
    expect(markdown).to.include("105kg");
    expect(markdown).to.include("목표 80kg × 5회 → 실제 80kg × 5회 @RPE 8");
    expect(markdown).to.include("오른쪽 손목이 약간 시큰거렸음.");
    expect(markdown).to.include("워밍업 제외");
  });

  it("compares the first and latest run when the same program is repeated", () => {
    const timestamps = [
      new Date("2026-01-05T10:00:00Z").getTime(),
      new Date("2026-02-09T10:00:00Z").getTime(),
      new Date("2026-03-23T10:00:00Z").getTime(),
      new Date("2026-04-27T10:00:00Z").getTime(),
    ];
    const records = [
      record(1, timestamps[0], 80, 1),
      record(6, timestamps[1], 100, 30),
      record(1, timestamps[2], 110, 1),
      record(6, timestamps[3], 90, 30),
    ];
    const markdown = AiFeedbackExport_buildMarkdown(records, Settings_build("kg"), "");
    const progressionRow = markdown.split("\n").find((line) => line.includes("| 1주차 "));

    expect(progressionRow).to.include("| 1주차 80kg × 5회 | 93.3kg | 6주차 90kg × 5회 | 105kg |");
  });

  it("compares separate repetitions of a one-week single-day program", () => {
    const firstTimestamp = new Date("2026-01-05T10:00:00Z").getTime();
    const latestTimestamp = new Date("2026-01-12T10:00:00Z").getTime();
    const markdown = AiFeedbackExport_buildMarkdown(
      [record(1, firstTimestamp, 80, 1), record(1, latestTimestamp, 90, 1)],
      Settings_build("kg"),
      ""
    );
    const progressionRow = markdown.split("\n").find((line) => line.includes("| 1주차 "));

    expect(progressionRow).to.include("| 1주차 80kg × 5회 | 93.3kg | 1주차 90kg × 5회 | 105kg |");
  });

  it("exports workout-level notes in the session log", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    workout.notes = "컨디션이 낮았음.\n오른쪽 어깨가 불편함.";

    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "");

    expect(markdown).to.include("세션 메모: 컨디션이 낮았음. 오른쪽 어깨가 불편함.");
  });

  it("keeps Markdown structure inside the user's note from creating report sections", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    const note = "벤치프레스는 좋았음.\n## 새 섹션\n| 데이터 | 값 |";

    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), note);

    expect(markdown).to.include("벤치프레스는 좋았음\\.\n\\#\\# 새 섹션\n\\| 데이터 \\| 값 \\|");
    expect(markdown.split("\n")).not.to.include("## 새 섹션");
  });

  it("counts both dumbbells in session volume and still excludes warmup sets", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    const entry = workout.entries[0];
    entry.exercise = { id: "shoulderPress", equipment: "dumbbell" };
    entry.sets = [set("work", 30, 10, "STRAIGHT"), set("warmup", 100, 10, "WARMUP")];

    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "");

    expect(markdown).to.include("세션 볼륨(워밍업 제외, 실제 중량 기록 기준): 600kg");
    expect(markdown).not.to.include("세션 볼륨(워밍업 제외, 실제 중량 기록 기준): 1600kg");
  });

  it("summarizes recorded working sets by calendar week and target muscle group", () => {
    const settings = Settings_build("kg");
    settings.startWeekFromMonday = true;
    settings.muscleGroups.data.chest = { name: "가슴 맞춤" };
    const sunday = record(1, new Date(2026, 0, 4, 12).getTime(), 80);
    sunday.entries[0].sets = [
      set("unilateral", 80, 5, "STRAIGHT"),
      set("unfinished", 80, 5, "STRAIGHT"),
      set("warmup-in-sets", 100, 10, "WARMUP"),
    ];
    sunday.entries[0].sets[0].isUnilateral = true;
    sunday.entries[0].sets[0].completedRepsLeft = 5;
    sunday.entries[0].sets[1].completedReps = 0;
    sunday.entries[0].sets[1].isCompleted = false;
    const monday = record(1, new Date(2026, 0, 5, 12).getTime(), 80);

    const markdown = AiFeedbackExport_buildMarkdown([sunday, monday], settings, "");
    const muscleRows = markdown.split("\n").filter((line) => line.startsWith("| 2025-") || line.startsWith("| 2026-"));

    expect(markdown).to.include("### 주차별 타겟 근육군 기록 세트");
    expect(muscleRows).to.deep.equal([
      "| 2025-12-29 ~ 2026-01-04 | 가슴 맞춤 | 1 |",
      "| 2026-01-05 ~ 2026-01-11 | 가슴 맞춤 | 2 |",
    ]);
  });

  it("keeps week boundaries on local calendar dates across daylight-saving time", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const settings = Settings_build("kg");
      settings.startWeekFromMonday = true;
      const sunday = record(10, new Date(2026, 2, 8, 12).getTime(), 80);

      const markdown = AiFeedbackExport_buildMarkdown([sunday], settings, "");

      expect(markdown).to.include("| 2026-03-02 ~ 2026-03-08 | 가슴 | 2 |");
    } finally {
      if (originalTimeZone == null) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    }
  });

  it("limits an export to the selected program and labels the scope", () => {
    const included = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    const excluded = record(1, new Date("2026-01-06T10:00:00Z").getTime(), 120);
    excluded.programId = "other-program";
    excluded.programName = "다른 프로그램";
    const programs = [Program_create("PHAT 테스트", "phat-program"), Program_create("다른 프로그램", "other-program")];

    const markdown = AiFeedbackExport_buildMarkdown(
      [included, excluded],
      Settings_build("kg"),
      "",
      new Date("2026-01-07T10:00:00Z").getTime(),
      "PHAT 수행 기록",
      programs,
      "phat-program"
    );

    expect(markdown).to.include("프로그램 범위: PHAT 테스트");
    expect(markdown).to.include("완료 세션 수: 1");
    expect(markdown).to.include("## 프로그램: PHAT 테스트");
    expect(markdown).not.to.include("다른 프로그램");
    expect(markdown).not.to.include("120kg");
  });

  it("includes scheduled programs with no workout history in the all-program attendance summary", () => {
    const program = {
      ...Program_create("아직 시작하지 않은 프로그램", "not-started-program"),
      planner: {
        vtype: "planner" as const,
        name: "아직 시작하지 않은 프로그램",
        weeks: [{ name: "1주차", days: [{ name: "1일차", exerciseText: "Bench Press / 3x5" }] }],
      },
      schedule: ProgramSchedule_build("2026-01-05", [1, 2, 3, 4, 5, 6, 7], 0, 2),
    };
    const markdown = AiFeedbackExport_buildMarkdown(
      [],
      Settings_build("kg"),
      "",
      new Date("2026-01-07T12:00:00Z").getTime(),
      "전체 운동 기록",
      [program]
    );

    expect(markdown).to.include("프로그램 범위: 전체 프로그램");
    expect(markdown).to.include("출석률: 0%");
    expect(markdown).to.include("일정 밀림 횟수: 2회");
  });

  it("reports when the selected program has no completed sessions", () => {
    const program = Program_create("비어 있는 프로그램", "empty-program");
    const markdown = AiFeedbackExport_buildMarkdown(
      [],
      Settings_build("kg"),
      "",
      Date.now(),
      "수행 기록",
      [program],
      program.id
    );

    expect(markdown).to.include("프로그램 범위: 비어 있는 프로그램");
    expect(markdown).to.include("## 프로그램: 비어 있는 프로그램");
    expect(markdown).to.include("선택한 프로그램의 완료 기록이 없습니다.");
  });

  it("exports both sides of unilateral reps and flags mixed target results", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    const unilateralSet = workout.entries[0].sets[0];
    unilateralSet.reps = 10;
    unilateralSet.completedReps = 12;
    unilateralSet.completedRepsLeft = 8;
    unilateralSet.isUnilateral = true;

    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "");

    expect(markdown).to.include("목표 80kg × 10회 → 실제 80kg × 8/12회");
    expect(markdown).to.include("⚠️ 목표 혼합");
  });

  it("does not mark a set complete when its target weight has no actual weight", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    workout.entries[0].sets = [set("top", 80, 5, "TOP")];
    workout.entries[0].sets[0].completedWeight = undefined;

    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "");

    expect(markdown).to.include("목표 80kg × 5회 → 실제 중량 미기록 × 5회");
    expect(markdown).to.include("⚠️ 중량 미기록");
    expect(markdown).not.to.include("✅ 목표 달성");
    expect(markdown).to.include("세션 볼륨(워밍업 제외, 실제 중량 기록 기준): 실제 중량 미기록");
    expect(markdown).to.include("비교 가능한 다관절 운동 기록 없음");
    expect(markdown).not.to.include("93.3kg");
  });

  it("labels a missing side in unilateral session records", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    workout.entries[0].sets = [set("unilateral", 80, 8, "STRAIGHT")];
    workout.entries[0].sets[0].isUnilateral = true;
    workout.entries[0].sets[0].reps = 5;
    workout.entries[0].sets[0].completedRepsLeft = undefined;

    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "");

    expect(markdown).to.include("실제 80kg × L 미기록 / R 8회");
    expect(markdown).to.include("⚠️ 목표 초과 · 좌우 반복 미기록");
    expect(markdown).to.include("비교 가능한 다관절 운동 기록 없음");
  });

  it("excludes a set with an unrecorded actual weight from reported session volume", () => {
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    const missingWeightSet = set("missing", 80, 5, "STRAIGHT");
    missingWeightSet.completedWeight = undefined;
    workout.entries[0].sets = [set("actual", 30, 10, "STRAIGHT"), missingWeightSet];

    const markdown = AiFeedbackExport_buildMarkdown([workout], Settings_build("kg"), "");

    expect(markdown).to.include("세션 볼륨(워밍업 제외, 실제 중량 기록 기준): 300kg (중량 미기록 1세트 제외)");
    expect(markdown).not.to.include("700kg");
  });

  it("preserves a literal backslash before an escaped pipe in progression table names", () => {
    const settings = Settings_build("kg");
    const exerciseId = "export-pipe-exercise";
    settings.exercises[exerciseId] = {
      vtype: "custom_exercise",
      id: exerciseId,
      name: String.raw`Press \| Variant`,
      isDeleted: false,
      meta: Exercise_getMetadata("benchPress"),
    };
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    workout.entries[0].exercise = { id: exerciseId, equipment: "barbell" };

    const markdown = AiFeedbackExport_buildMarkdown([workout], settings, "");
    const progressionRow = markdown.split("\n").find((line) => line.startsWith("| Press"));

    expect(progressionRow).to.include(String.raw`| Press \\\| Variant, 바벨 |`);
  });

  it("keeps imported names and titles from breaking the Markdown report structure", () => {
    const settings = Settings_build("kg");
    const exerciseId = "export-markdown-structure";
    settings.exercises[exerciseId] = {
      vtype: "custom_exercise",
      id: exerciseId,
      name: "Press *variant*\n# injected heading",
      isDeleted: false,
      meta: Exercise_getMetadata("benchPress"),
    };
    const workout = record(1, new Date("2026-01-05T10:00:00Z").getTime(), 80);
    workout.programName = "PHAT\n## injected section";
    workout.dayName = "월요일\n### injected session";
    workout.entries[0].exercise = { id: exerciseId, equipment: "barbell" };
    workout.entries[0].notes = "세트 메모\n# injected note heading";

    const markdown = AiFeedbackExport_buildMarkdown([workout], settings, "", Date.now(), "리포트\n# injected title");

    expect(markdown).to.include("# 리포트 \\# injected title");
    expect(markdown).to.include("## 프로그램: PHAT \\#\\# injected section");
    expect(markdown).to.include("월요일 \\#\\#\\# injected session");
    expect(markdown).to.include("- **Press \\*variant\\* \\# injected heading, 바벨**");
    expect(markdown).to.include("| Press \\*variant\\* \\# injected heading, 바벨 |");
    expect(markdown).to.include("세트 메모 # injected note heading");
    expect(markdown.split("\n")).not.to.include("# injected title");
    expect(markdown.split("\n")).not.to.include("## injected section");
    expect(markdown.split("\n")).not.to.include("### injected session");
    expect(markdown.split("\n")).not.to.include("# injected note heading");
  });
});
