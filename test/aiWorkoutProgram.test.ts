import "mocha";
import { readFileSync } from "fs";
import { join } from "path";
import { expect } from "chai";
import {
  AiWorkoutProgram_buildPhatSeedJson,
  AiWorkoutProgram_buildPromptTemplate,
  AiWorkoutProgram_tryImport,
} from "../src/utils/aiWorkoutProgram";
import { PlannerProgram_evaluate } from "../src/pages/planner/models/plannerProgram";
import { PlannerProgramExercise_programWarmups } from "../src/pages/planner/models/plannerProgramExercise";
import { Exercise_getWarmupSets } from "../src/models/exercise";
import { Weight_build } from "../src/models/weight";
import { Settings_build } from "../src/models/settings";
import { ImportExporter_getExportedProgram } from "../src/lib/importexporter";
import { Program_evaluate, Program_nextHistoryRecord } from "../src/models/program";
import { Stats_getEmpty } from "../src/models/stats";
import { FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES } from "../src/utils/fileImportLimits";

function jsonProgram(): string {
  return JSON.stringify({
    program_name: "한국어 테스트 루틴",
    description: "가져오기 검증",
    duration_weeks: 2,
    days_per_week: 1,
    weight_unit: "kg",
    workouts: [
      {
        day_index: 1,
        day_name: "월요일: 상체 파워",
        exercises: [
          {
            order: 1,
            name: "Bench Press",
            target_muscle: "Chest",
            rest_seconds: 180,
            weekly_progression: [
              {
                week: 1,
                sets: [
                  { set_no: 1, type: "TOP", target_weight: 90, target_reps: 4 },
                  { set_no: 2, type: "BACKOFF", target_weight: 80, target_reps: 8 },
                  { set_no: 3, type: "WARMUP", target_weight: 50, target_reps: 8 },
                ],
              },
              {
                week: 2,
                sets: [{ set_no: 1, type: "DROP", target_weight: 70, target_reps: 12 }],
              },
            ],
          },
        ],
      },
    ],
  });
}

function withTurkishLocaleCaseMapping<T>(callback: () => T): T {
  const original = Object.getOwnPropertyDescriptor(String.prototype, "toLocaleLowerCase")!;
  String.prototype.toLocaleLowerCase = function (this: string): string {
    return Reflect.apply(original.value, this, ["tr"]) as string;
  };
  try {
    return callback();
  } finally {
    Object.defineProperty(String.prototype, "toLocaleLowerCase", original);
  }
}

describe("AI workout program import", () => {
  it("converts a complete JSON routine to Liftosaur planner weeks and set targets", () => {
    const result = AiWorkoutProgram_tryImport(jsonProgram(), Settings_build("kg"));
    expect(result?.success).to.equal(true);
    if (!result || !result.success) {
      return;
    }
    const planner = result.data.program.planner;
    expect(planner?.weeks).to.have.length(2);
    expect(planner?.weeks[0].days).to.have.length(1);
    expect(planner?.weeks[0].days[0].name).to.equal("월요일: 상체 파워");
    expect(planner?.weeks[0].days[0].exerciseText).to.include("1x4 (TOP) 90kg 180s");
    expect(planner?.weeks[0].days[0].exerciseText).to.include("warmup: 1x8 50kg");

    const evaluated = PlannerProgram_evaluate(planner!, Settings_build("kg"));
    expect(evaluated.evaluatedWeeks[0][0].success).to.equal(true);
    if (evaluated.evaluatedWeeks[0][0].success) {
      const sets = evaluated.evaluatedWeeks[0][0].data[0].evaluatedSetVariations[0].sets;
      const nextWeekSets = evaluated.evaluatedWeeks[1][0];
      expect(sets.map((set) => set.label)).to.eql(["TOP", "BACKOFF"]);
      expect(sets[0].weight?.value).to.equal(90);
      expect(sets[0].timer).to.equal(180);
      expect(evaluated.evaluatedWeeks[0][0].data[0].warmupSets).to.have.length(1);
      expect(nextWeekSets.success).to.equal(true);
      if (nextWeekSets.success) {
        expect(nextWeekSets.data[0].evaluatedSetVariations[0].sets[0].label).to.equal("DROP");
      }
    }
  });

  it("preserves explicitly disabled rest timers instead of inheriting the app default", () => {
    const routine = JSON.parse(jsonProgram());
    routine.workouts[0].exercises[0].rest_seconds = 0;
    const settings = Settings_build("kg");
    const imported = AiWorkoutProgram_tryImport(JSON.stringify(routine), settings);
    expect(imported?.success).to.equal(true);
    if (!imported?.success) {
      throw new Error("zero-rest import failed");
    }
    const record = Program_nextHistoryRecord(imported.data.program, settings, Stats_getEmpty(), 1);
    expect(record.entries[0].sets[0].timer).to.equal(0);
  });

  it("imports valid JSON wrapped in a Markdown json code fence", () => {
    const result = AiWorkoutProgram_tryImport("```json\n" + jsonProgram() + "\n```");

    expect(result?.success).to.equal(true);
    if (result?.success) {
      expect(result.data.program.name).to.equal("한국어 테스트 루틴");
      expect(result.data.program.planner?.weeks).to.have.length(2);
    }
  });

  it("imports the documented one-row-per-set CSV format, including quoted Korean cells", () => {
    const csv = [
      "program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps",
      'CSV 루틴,1,1,kg,1,"월요일: 상체, 파워",1,Bench Press,Chest,180,1,1,TOP,90,4',
      'CSV 루틴,1,1,kg,1,"월요일: 상체, 파워",1,Bench Press,Chest,180,1,2,BACKOFF,80,8',
    ].join("\n");
    const result = AiWorkoutProgram_tryImport(csv, Settings_build("kg"));
    expect(result?.success).to.equal(true);
    if (result?.success) {
      expect(result.data.program.planner?.weeks[0].days[0].name).to.equal("월요일: 상체, 파워");
      expect(result.data.program.planner?.weeks[0].days[0].exerciseText).to.include("1x8 (BACKOFF) 80kg 180s");
    }
  });

  it("imports CSV wrapped in a Markdown csv code fence", () => {
    const csv = [
      "program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps",
      "CSV fenced,1,1,kg,1,월요일,1,Bench Press,Chest,180,1,1,TOP,90,4",
    ].join("\r\n");
    const result = AiWorkoutProgram_tryImport("```csv\r\n" + csv + "\r\n```");

    expect(result?.success).to.equal(true);
    if (result?.success) {
      expect(result.data.program.name).to.equal("CSV fenced");
    }
  });

  it("reports a missing required AI CSV column instead of falling through to a generic parse error", async () => {
    const csv = [
      "program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight",
      "CSV 루틴,1,1,kg,1,월요일,1,Bench Press,Chest,180,1,1,TOP,90",
    ].join("\n");

    const result = await ImportExporter_getExportedProgram(
      globalThis.fetch as unknown as Window["fetch"],
      csv,
      Settings_build("kg")
    );

    expect(result.success).to.equal(false);
    if (!result.success) {
      expect(result.error.join("\n")).to.include("CSV 헤더에 필수 열이 없습니다");
      expect(result.error.join("\n")).to.include("target_reps");
    }
  });

  it("rejects duplicate recognized fields in an AI CSV header", () => {
    const csv = [
      "program_name,프로그램명,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps",
      "CSV 루틴,CSV 루틴,1,1,kg,1,월요일,1,Bench Press,Chest,180,1,1,TOP,90,4",
    ].join("\n");

    const result = AiWorkoutProgram_tryImport(csv, Settings_build("kg"));

    expect(result?.success).to.equal(false);
    if (result && !result.success) {
      expect(result.error.join("\n")).to.include("program_name 열이 여러 번");
    }
  });

  it("does not import a code-fenced routine with prose outside the fence", () => {
    const result = AiWorkoutProgram_tryImport("Here is your routine:\n```json\n" + jsonProgram() + "\n```");

    expect(result).to.equal(undefined);
  });

  it("reads CSV program metadata from later rows when repeated cells are blank", () => {
    const csv = [
      "program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps",
      ",,,,1,월요일,1,Bench Press,Chest,180,1,1,TOP,90,4",
      "Sparse metadata,1,1,lb,1,월요일,1,Bench Press,Chest,180,1,2,BACKOFF,80,8",
    ].join("\n");

    const result = AiWorkoutProgram_tryImport(csv, Settings_build("kg"));

    expect(result?.success).to.equal(true);
    if (result?.success) {
      expect(result.data.program.name).to.equal("Sparse metadata");
      expect(result.data.program.planner?.weeks[0].days[0].exerciseText).to.include("90lb");
    }
  });

  it("rejects CSV quote syntax that would silently alter a field", () => {
    const header =
      "program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps";
    const invalidRows = [
      '"CSV 루틴"x,1,1,kg,1,월요일,1,Bench Press,Chest,180,1,1,TOP,90,4',
      'CSV "루틴,1,1,kg,1,월요일,1,Bench Press,Chest,180,1,1,TOP,90,4',
    ];

    for (const invalidRow of invalidRows) {
      const result = AiWorkoutProgram_tryImport([header, invalidRow].join("\n"), Settings_build("kg"));
      expect(result?.success).to.equal(false);
      if (result && !result.success) {
        expect(result.error.join("\n")).to.include("따옴표");
      }
    }
  });

  it("accepts escaped double quotes inside quoted CSV fields", () => {
    const csv = [
      "program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps",
      '"CSV ""루틴""",1,1,kg,1,월요일,1,Bench Press,Chest,180,1,1,TOP,90,4',
    ].join("\n");

    const result = AiWorkoutProgram_tryImport(csv, Settings_build("kg"));

    expect(result?.success).to.equal(true);
    if (result?.success) {
      expect(result.data.program.name).to.equal('CSV "루틴"');
    }
  });

  it("treats zero-weight imported warmups as unspecified instead of zero load", () => {
    const input = JSON.parse(jsonProgram());
    input.workouts[0].exercises[0].weekly_progression[0].sets[2].target_weight = 0;
    const settings = Settings_build("kg");
    const result = AiWorkoutProgram_tryImport(JSON.stringify(input), settings);

    expect(result?.success).to.equal(true);
    if (!result?.success) {
      return;
    }
    const planner = result.data.program.planner!;
    const exerciseText = planner.weeks[0].days[0].exerciseText;
    expect(exerciseText).to.include("warmup: 1x8");
    expect(exerciseText).not.to.include("warmup: 1x8 0kg");

    const evaluated = PlannerProgram_evaluate(planner, settings).evaluatedWeeks[0][0];
    expect(evaluated.success).to.equal(true);
    if (evaluated.success) {
      const exercise = evaluated.data[0];
      const programWarmups = PlannerProgramExercise_programWarmups(exercise, settings);
      expect(programWarmups?.[0].value).to.be.a("number").greaterThan(0).lessThan(1);
      expect(exercise.exerciseType).to.exist;
      if (exercise.exerciseType) {
        const warmupSets = Exercise_getWarmupSets(
          exercise.exerciseType,
          Weight_build(90, "kg"),
          settings,
          programWarmups
        );
        expect(warmupSets[0].weight?.value).to.be.greaterThan(0).and.lessThan(90);
      }
    }
  });

  it("routes the AI routine through the app's existing import validation", async () => {
    const result = await ImportExporter_getExportedProgram(
      globalThis.fetch as unknown as Window["fetch"],
      jsonProgram(),
      Settings_build("kg")
    );
    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.program.name).to.equal("한국어 테스트 루틴");
      expect(result.data.program.planner?.weeks).to.have.length(2);
    }
  });

  it("routes Markdown-wrapped AI output through the app's existing import validation", async () => {
    const result = await ImportExporter_getExportedProgram(
      globalThis.fetch as unknown as Window["fetch"],
      "```json\n" + jsonProgram() + "\n```",
      Settings_build("kg")
    );

    expect(result.success).to.equal(true);
    if (result.success) {
      expect(result.data.program.name).to.equal("한국어 테스트 루틴");
      expect(result.data.program.planner?.weeks).to.have.length(2);
    }
  });

  it("rejects oversized program files before parsing them", async () => {
    const contents = " ".repeat(FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES + 1);
    const result = await ImportExporter_getExportedProgram(globalThis.fetch as unknown as Window["fetch"], contents);

    expect(result.success).to.equal(false);
    if (!result.success) {
      expect(result.error.join(" ")).to.include("최대 10MB");
    }
  });

  it("rejects a weekly progression with more than 100 sets before parsing every set", () => {
    const input = JSON.parse(jsonProgram());
    input.workouts[0].exercises[0].weekly_progression[0].sets = Array.from({ length: 101 }, (_, index) => ({
      set_no: index + 1,
      type: "STRAIGHT",
      target_weight: 80,
      target_reps: 8,
    }));

    const result = AiWorkoutProgram_tryImport(JSON.stringify(input), Settings_build("kg"));

    expect(result?.success).to.equal(false);
    if (result && !result.success) {
      expect(result.error.join(" ")).to.include("최대 100세트까지");
    }
  });

  it("rejects a program whose total set count exceeds the import budget", () => {
    const input = {
      program_name: "대용량 루틴",
      duration_weeks: 1,
      days_per_week: 7,
      workouts: Array.from({ length: 7 }, (_workoutUnused, dayIndex) => ({
        day_index: dayIndex + 1,
        day_name: `${dayIndex + 1}일차`,
        exercises: Array.from({ length: 100 }, (_exerciseUnused, exerciseIndex) => ({
          order: exerciseIndex + 1,
          name: `Custom Exercise ${dayIndex}-${exerciseIndex}`,
          rest_seconds: 60,
          weekly_progression: [
            {
              week: 1,
              sets: Array.from({ length: 72 }, (_setUnused, setIndex) => ({
                set_no: setIndex + 1,
                type: "TOP",
                target_weight: 80,
                target_reps: 8,
              })),
            },
          ],
        })),
      })),
    };

    const result = AiWorkoutProgram_tryImport(JSON.stringify(input), Settings_build("kg"));

    expect(result?.success).to.equal(false);
    if (result && !result.success) {
      expect(result.error.join(" ")).to.include("전체 세트 수는 최대 50000개");
    }
  });

  it("reports incomplete weekly progression instead of importing a partial program", () => {
    const incomplete = JSON.parse(jsonProgram());
    incomplete.workouts[0].exercises[0].weekly_progression.pop();
    const result = AiWorkoutProgram_tryImport(JSON.stringify(incomplete));
    expect(result?.success).to.equal(false);
    if (result && !result.success) {
      expect(result.error.join("\n")).to.include("2주차 데이터가 없습니다");
    }
  });

  it("reports missing AI schema fields when the JSON contains AI program markers", () => {
    const result = AiWorkoutProgram_tryImport(JSON.stringify({ duration_weeks: 6, days_per_week: 5, workouts: [] }));

    expect(result?.success).to.equal(false);
    if (result && !result.success) {
      expect(result.error.join("\n")).to.include("program_name");
      expect(result.error.join("\n")).to.include("workouts에는 days_per_week");
    }
  });

  it("leaves native Liftosaur JSON on the existing import path", () => {
    expect(AiWorkoutProgram_tryImport(JSON.stringify({ program: { vtype: "program" }, version: "x" }))).to.equal(
      undefined
    );
  });

  it("preserves equipment-qualified names when creating custom exercises", () => {
    const input = JSON.parse(jsonProgram());
    input.workouts[0].exercises[0].name = "Seated Cable Row, Cable";

    const baseSettings = Settings_build("kg");
    const result = AiWorkoutProgram_tryImport(JSON.stringify(input), baseSettings);

    expect(result?.success).to.equal(true);
    if (!result?.success) {
      return;
    }
    const customExercise = Object.values(result.data.customExercises).find(
      (exercise) => exercise?.name === "Seated Cable Row"
    );
    expect(customExercise?.defaultEquipment).to.equal("cable");
    const importedSettings = {
      ...baseSettings,
      exercises: { ...baseSettings.exercises, ...result.data.customExercises },
    };
    expect(Program_evaluate(result.data.program, importedSettings).errors).to.have.length(0);
    expect(
      Program_nextHistoryRecord(result.data.program, importedSettings, Stats_getEmpty(), 1).entries
    ).to.have.length(1);
  });

  it("normalizes equipment names and muscle aliases independently of the device locale", () => {
    withTurkishLocaleCaseMapping(() => {
      const input = JSON.parse(jsonProgram());
      input.workouts[0].exercises[0].name = "SMITH MACHINE AI Regression Curl";
      input.workouts[0].exercises[0].target_muscle = "BICEPS";

      const result = AiWorkoutProgram_tryImport(JSON.stringify(input), Settings_build("kg"));

      expect(result?.success).to.equal(true);
      if (result?.success) {
        const exercise = Object.values(result.data.customExercises).find(
          (candidate) => candidate?.name === "SMITH MACHINE AI Regression Curl"
        );
        expect(exercise?.defaultEquipment).to.equal("smith");
        expect(exercise?.meta.targetMuscles).to.include("Biceps Brachii");
        expect(exercise?.types).to.include.members(["upper", "pull"]);
      }
    });
  });

  it("accepts uppercase CSV schema headers independently of the device locale", () => {
    withTurkishLocaleCaseMapping(() => {
      const headers = [
        "program_name",
        "duration_weeks",
        "days_per_week",
        "weight_unit",
        "day_index",
        "day_name",
        "exercise_order",
        "exercise_name",
        "target_muscle",
        "rest_seconds",
        "week",
        "set_no",
        "set_type",
        "target_weight",
        "target_reps",
      ];
      const values = [
        "CSV 루틴",
        "1",
        "1",
        "kg",
        "1",
        "월요일",
        "1",
        "Bench Press",
        "Chest",
        "180",
        "1",
        "1",
        "TOP",
        "90",
        "4",
      ];
      const result = AiWorkoutProgram_tryImport(
        [headers.map((header) => header.toUpperCase()).join(","), values.join(",")].join("\n"),
        Settings_build("kg")
      );

      expect(result?.success).to.equal(true);
    });
  });

  it("preserves all 30 sessions of the user's six-week PHAT targets through import and engine evaluation", () => {
    const baseSettings = Settings_build("kg");
    const seedJson = AiWorkoutProgram_buildPhatSeedJson();
    const seed = JSON.parse(seedJson);
    expect(readFileSync(join(__dirname, "../examples/phat-6week-kr.json"), "utf8").trim()).to.equal(seedJson);
    expect(seed.workouts.map((workout: { exercises: unknown[] }) => workout.exercises.length)).to.eql([6, 5, 6, 6, 6]);
    // Reference: user's Week 1..6 Liftoscript supplied in this chat, transcribed
    // independently by day/order as first work-set load/reps. Power backoffs below.
    const reference = [
      [
        "90/4 90/5 92.5/4 92.5/5 95/4 95/5",
        "60/5 60/6 65/5 65/6 70/5 70/6",
        "37.5/6 37.5/7 40/6 40/7 42.5/5 42.5/6",
        "56/6 56/8 63/6 63/7 63/8 70/6",
        "30/8 30/9 30/10 32.5/8 32.5/9 35/8",
        "30/8 30/9 30/10 32.5/8 32.5/9 35/8",
      ],
      [
        "100/4 100/5 105/4 105/5 110/4 110/5",
        "80/6 80/8 85/6 85/8 90/6 90/8",
        "160/8 160/10 180/8 180/10 200/8 200/10",
        "40/10 40/12 45/10 45/12 50/10 50/12",
        "60/12 60/15 70/12 70/15 80/12 80/15",
      ],
      [
        "48.9/10 48.9/11 48.9/12 56/8 56/9 56/10",
        "48.9/10 48.9/11 48.9/12 56/8 56/9 56/10",
        "23.75/15 26.25/12 26.25/15 28.75/12 28.75/14 28.75/15",
        "30/12 30/15 35/12 35/15 40/12 40/15",
        "12/10 12/12 14/10 14/11 14/12 16/10",
        "12/12 14/10 14/12 16/10 16/11 16/12",
      ],
      [
        "26/10 28/8 28/10 30/8 30/10 32/8",
        "0/8 0/9 0/10 0/12 4/8 4/10",
        "40/12 45/10 45/12 50/10 50/11 50/12",
        "10/15 10/18 10/20 12/12 12/14 12/15",
        "21.25/12 21.25/15 23.75/12 23.75/15 26.25/12 26.25/15",
        "21.25/12 21.25/15 26.25/12 26.25/15 28.75/12 28.75/15",
      ],
      [
        "80/10 80/12 90/10 90/12 100/10 100/12",
        "12/10 12/12 16/10 16/12 20/10 20/12",
        "45/12 45/15 50/12 50/15 55/12 55/15",
        "40/12 40/15 45/12 45/15 50/12 50/15",
        "40/15 40/18 45/15 45/18 50/15 50/18",
        "0/15 0/15 0/18 0/18 0/20 0/20",
      ],
    ];
    const backoffReference = [
      "80/8 80/9 82.5/8 82.5/9 85/8 85/9",
      "50/8 50/9 55/8 55/9 60/8 60/9",
      "85/8 85/9 90/8 90/9 95/8 95/9",
    ];
    const counts = [
      [5, 5, 4, 3, 3, 3],
      [5, 4, 3, 3, 4],
      [4, 4, 2, 4, 3, 3],
      [4, 4, 3, 4, 3, 3],
      [4, 3, 3, 4, 3, 3],
    ];
    const rests = [
      [180, 180, 150, 120, 90, 90],
      [210, 150, 120, 90, 90],
      [120, 120, 90, 90, 90, 90],
      [120, 120, 90, 90, 90, 90],
      [150, 120, 90, 90, 60, 60],
    ];
    const sample = AiWorkoutProgram_tryImport(seedJson, baseSettings);
    expect(sample?.success).to.equal(true);
    if (!sample?.success) {
      throw new Error("seed import failed");
    }
    const importedSettings = {
      ...baseSettings,
      exercises: { ...baseSettings.exercises, ...sample.data.customExercises },
    };
    const evaluated = Program_evaluate(sample.data.program, importedSettings);
    expect(evaluated.errors).to.have.length(0);
    let totalSets = 0;
    for (let week = 0; week < 6; week += 1) {
      for (let day = 0; day < 5; day += 1) {
        const record = Program_nextHistoryRecord(
          sample.data.program,
          importedSettings,
          Stats_getEmpty(),
          week * 5 + day + 1
        );
        expect(record.entries, `week ${week + 1} day ${day + 1}`).to.have.length(counts[day].length);
        for (const [index, entry] of record.entries.entries()) {
          const [weight, reps] = reference[day][index].split(" ")[week].split("/").map(Number);
          const powerIndex = day === 0 && index < 2 ? index : day === 1 && index === 0 ? 2 : -1;
          expect(entry.sets.length).to.equal(counts[day][index]);
          totalSets += entry.sets.length;
          for (const [setIndex, set] of entry.sets.entries()) {
            const [expectedWeight, expectedReps] =
              powerIndex >= 0 && setIndex >= 2
                ? backoffReference[powerIndex].split(" ")[week].split("/").map(Number)
                : [weight, reps];
            expect(set.originalWeight, `w${week + 1} d${day + 1} ex${index + 1} set${setIndex + 1}`).to.eql(
              Weight_build(expectedWeight, "kg")
            );
            expect(set.reps).to.equal(expectedReps);
            expect(set.timer).to.equal(rests[day][index]);
            expect(set.label).to.equal(powerIndex >= 0 ? (setIndex < 2 ? "TOP" : "BACKOFF") : "STRAIGHT");
            expect(set.askWeight).to.equal(false);
          }
        }
      }
    }
    expect(totalSets).to.equal(618);
    const dips = Program_nextHistoryRecord(sample.data.program, importedSettings, Stats_getEmpty(), 4).entries[1]
      .sets[0];
    expect(dips.originalWeight).to.eql(Weight_build(0, "kg"));
    expect(dips.weight).to.eql(Weight_build(0, "kg"));
    const weightedDips = Program_nextHistoryRecord(sample.data.program, importedSettings, Stats_getEmpty(), 24)
      .entries[1].sets[0];
    expect(weightedDips.originalWeight).to.eql(Weight_build(4, "kg"));
    const cableTarget = Program_nextHistoryRecord(sample.data.program, importedSettings, Stats_getEmpty(), 3).entries[0]
      .sets[0];
    expect(cableTarget.originalWeight).to.eql(Weight_build(48.9, "kg"));
    expect(cableTarget.weight).not.to.eql(cableTarget.originalWeight); // Equipment availability can round the working load.
    const prompt = AiWorkoutProgram_buildPromptTemplate();
    expect(prompt).to.include("weekly_progression");
    expect(prompt).to.include("BACKOFF");
    expect(prompt).to.include("앱은 기록만으로 다음 주차 중량을 자동 변경하지 않아");
    expect(prompt).to.include("전체 루틴 세트는 최대 50,000개");
  });
});
