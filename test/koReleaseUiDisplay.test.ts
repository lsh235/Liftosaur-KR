import { expect } from "chai";
import {
  equipmentName,
  Exercise_equipmentNameForDisplay,
  Exercise_filterAndRankByQuery,
  Exercise_filterAndRankCustomByQuery,
  Exercise_matchesQuery,
  Exercise_fullName,
  Exercise_get,
  Exercise_nameForDisplay,
  Exercise_nameWithEquipment,
} from "../src/models/exercise";
import { Equipment_currentEquipment } from "../src/models/equipment";
import { Settings_build } from "../src/models/settings";
import { ScreenProgram_rangeForDisplay } from "../src/components/editProgram/programHeaderDisplay";

describe("Korean program header display", () => {
  it("formats empty and varying counts without non-finite values", () => {
    expect(ScreenProgram_rangeForDisplay([])).to.equal("0");
    expect(ScreenProgram_rangeForDisplay([5])).to.equal("5");
    expect(ScreenProgram_rangeForDisplay([5, 5])).to.equal("5");
    expect(ScreenProgram_rangeForDisplay([5, 6])).to.equal("5~6");
  });
});

describe("Korean display names preserve program identity", () => {
  it("keeps parser-facing names and IDs canonical while displaying the routine in Korean", () => {
    const settings = Settings_build("kg");
    const exercise = Exercise_get({ id: "benchPress", equipment: "barbell" }, settings.exercises);
    expect(Exercise_nameWithEquipment(exercise, settings)).to.equal("벤치프레스, 바벨");
    expect(Exercise_fullName(exercise, settings)).to.equal("Bench Press");
    expect(equipmentName(exercise.equipment)).to.equal("Barbell");
    expect(exercise.id).to.equal("benchPress");
    expect(exercise.name).to.equal("Bench Press");
  });

  it("preserves user names and custom gym equipment names", () => {
    const settings = Settings_build("kg");
    const exercise = Exercise_get({ id: "benchPress", equipment: "barbell" }, settings.exercises);
    const renamed = { ...exercise, name: "My bench recovery" };
    expect(Exercise_nameForDisplay(renamed)).to.equal("My bench recovery");
    expect(Exercise_nameWithEquipment(renamed, settings)).to.equal("My bench recovery, 바벨");
    const equipment = Equipment_currentEquipment(settings);
    equipment.barbell!.name = "헬스장 A 15kg 봉";
    expect(Exercise_equipmentNameForDisplay(exercise, settings)).to.equal("헬스장 A 15kg 봉");
    expect(equipmentName("barbell", equipment)).to.equal("헬스장 A 15kg 봉");
    equipment.barbell!.isDeleted = true;
    expect(Exercise_equipmentNameForDisplay(exercise, settings)).to.equal(undefined);
  });
});

describe("Korean exercise picker search", () => {
  it("matches the displayed name and equipment in either word order while preserving canonical records", () => {
    const settings = Settings_build("kg");
    const barbellBench = Exercise_get({ id: "benchPress", equipment: "barbell" }, settings.exercises);
    const dumbbellBench = Exercise_get({ id: "benchPress", equipment: "dumbbell" }, settings.exercises);
    const squat = Exercise_get({ id: "squat", equipment: "barbell" }, settings.exercises);
    const all = [squat, dumbbellBench, barbellBench];
    for (const query of [
      "바벨 벤치프레스",
      "벤치프레스 바벨",
      "벤치 프레스 바벨",
      "bench press 바벨",
      "벤치프레스 barbell",
      "barbell bench press",
    ]) {
      expect(Exercise_filterAndRankByQuery(all, query), query).to.eql([barbellBench]);
      expect(Exercise_matchesQuery(barbellBench, query), query).to.equal(true);
      expect(Exercise_matchesQuery(squat, query), query).to.equal(false);
    }
    expect(Exercise_filterAndRankByQuery(all, "bench press")[0]).to.equal(barbellBench);
    expect(Exercise_filterAndRankByQuery(all, "벤치프레스").map((entry) => entry.id)).to.eql([
      "benchPress",
      "benchPress",
    ]);
    expect(Exercise_filterAndRankByQuery(all, "존재하지않는종목")).to.eql([]);
    expect(barbellBench.name).to.equal("Bench Press");
  });

  it("filters real Korean custom names instead of treating Korean as an empty query", () => {
    const custom = {
      one: { id: "one", name: "손목 회복 운동" },
      two: { id: "two", name: "별도 하체 운동" },
    } as unknown as Parameters<typeof Exercise_filterAndRankCustomByQuery>[0];
    expect(Exercise_filterAndRankCustomByQuery(custom, "손목").map((entry) => entry.id)).to.eql(["one"]);
    expect(Exercise_matchesQuery({ name: "손목 회복 운동" }, "손목")).to.equal(true);
    expect(Exercise_matchesQuery({ name: "별도 하체 운동" }, "손목")).to.equal(false);
  });
});
