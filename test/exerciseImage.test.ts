import "mocha";
import { expect } from "chai";
import { Exercise_createCustomExercise } from "../src/models/exercise";
import { ExerciseImageUtils_existsCustom, ExerciseImageUtils_url } from "../src/models/exerciseImage";
import { Settings_build } from "../src/models/settings";

describe("localized custom exercise images", () => {
  it("reuses built-in exercise images for Korean imported exercise names", () => {
    const baseSettings = Settings_build("kg");
    const examples = [
      ["바벨 벤치프레스", "barbell", "benchpress_barbell"],
      ["바벨 벤트오버 로우", "barbell", "bentoverrow_barbell"],
      ["바벨 로우", "barbell", "bentoverrow_barbell"],
      ["바벨 오버헤드 프레스", "barbell", "overheadpress_barbell"],
      ["오버헤드 프레스", "barbell", "overheadpress_barbell"],
      ["케이블 랫풀다운", "cable", "latpulldown_cable"],
      ["와이드 랫풀다운 (고중량)", "cable", "latpulldown_cable"],
      ["바벨 컬", "barbell", "bicepcurl_barbell"],
      ["EZ 바 스컬크러셔", "ezbar", "skullcrusher_ezbar"],
      ["스컬크러셔", "ezbar", "skullcrusher_ezbar"],
      ["바벨 백 스쿼트", "barbell", "squat_barbell"],
      ["루마니안 데드리프트", "barbell", "romaniandeadlift_barbell"],
      ["레그 프레스", "leverageMachine", "legpress_leveragemachine"],
      ["라잉 레그 컬", "leverageMachine", "lyinglegcurl_leveragemachine"],
      ["스탠딩 카프 레이즈", "leverageMachine", "standingcalfraise_leveragemachine"],
      ["시티드 케이블 로우", "cable", "seatedrow_cable"],
      ["리어 델트 플라이", "leverageMachine", "reversefly_leveragemachine"],
      ["인클라인 덤벨 컬", "dumbbell", "inclinecurl_dumbbell"],
      ["덤벨 해머 컬", "dumbbell", "hammercurl_dumbbell"],
      ["인클라인 덤벨 프레스", "dumbbell", "inclinebenchpress_dumbbell"],
      ["체스트 딥스", "bodyweight", "chestdip_bodyweight"],
      ["펙 덱 플라이", "leverageMachine", "chestfly_leveragemachine"],
      ["사이드 레터럴 레이즈", "dumbbell", "lateralraise_dumbbell"],
      ["케이블 푸쉬다운", "cable", "tricepspushdown_cable"],
      ["오버헤드 삼두 익스텐션", "cable", "tricepsextension_cable"],
      ["불가리안 스플릿 스쿼트", "dumbbell", "bulgariansplitsquat_dumbbell"],
      ["레그 익스텐션", "leverageMachine", "legextension_leveragemachine"],
      ["시티드 레그 컬", "leverageMachine", "seatedlegcurl_leveragemachine"],
      ["시티드 카프 레이즈", "leverageMachine", "seatedcalfraise_leveragemachine"],
      ["행잉 레그 레이즈", "bodyweight", "hanginglegraise_bodyweight"],
    ];

    for (const [name, equipment, imageId] of examples) {
      const customExercise = Exercise_createCustomExercise(name, [], [], []);
      customExercise.defaultEquipment = equipment;
      const settings = {
        ...baseSettings,
        exercises: { ...baseSettings.exercises, [customExercise.id]: customExercise },
      };
      const exerciseType = { id: customExercise.id, equipment };

      expect(ExerciseImageUtils_existsCustom(exerciseType, "small", true, settings), name).to.equal(true);
      expect(ExerciseImageUtils_url(exerciseType, "small", settings), name).to.equal(
        `/externalimages/exercises/single/small/${imageId}_single_small.png`
      );
    }
  });
});
