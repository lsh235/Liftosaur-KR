import "mocha";
import { expect } from "chai";
import {
  AiWorkoutProgram_buildPhatSeedJson,
  AiWorkoutProgram_buildPromptTemplate,
  AiWorkoutProgram_tryImport,
} from "../src/utils/aiWorkoutProgram";
import { PlannerProgram_evaluate } from "../src/pages/planner/models/plannerProgram";
import { Settings_build } from "../src/models/settings";
import { ImportExporter_getExportedProgram } from "../src/lib/importexporter";

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

  it("reports incomplete weekly progression instead of importing a partial program", () => {
    const incomplete = JSON.parse(jsonProgram());
    incomplete.workouts[0].exercises[0].weekly_progression.pop();
    const result = AiWorkoutProgram_tryImport(JSON.stringify(incomplete));
    expect(result?.success).to.equal(false);
    if (result && !result.success) {
      expect(result.error.join("\n")).to.include("2주차 데이터가 없습니다");
    }
  });

  it("leaves native Liftosaur JSON on the existing import path", () => {
    expect(AiWorkoutProgram_tryImport(JSON.stringify({ program: { vtype: "program" }, version: "x" }))).to.equal(
      undefined
    );
  });

  it("provides a 6-week, 5-day PHAT sample and a Korean JSON-generation prompt", () => {
    const sample = AiWorkoutProgram_tryImport(AiWorkoutProgram_buildPhatSeedJson(), Settings_build("kg"));
    expect(sample?.success).to.equal(true);
    if (sample?.success) {
      const weeks = sample.data.program.planner?.weeks || [];
      expect(weeks).to.have.length(6);
      expect(weeks.every((week) => week.days.length === 5)).to.equal(true);
      expect(weeks[0].days[0].exerciseText).to.include("TOP");
      expect(weeks[0].days[0].exerciseText).to.include("?+");
    }
    const prompt = AiWorkoutProgram_buildPromptTemplate();
    expect(prompt).to.include("weekly_progression");
    expect(prompt).to.include("BACKOFF");
    expect(prompt).to.include("CSV로 만들 때는");
  });
});
