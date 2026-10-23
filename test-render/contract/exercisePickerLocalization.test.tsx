import { render, screen } from "@testing-library/react-native";
import { ExercisePickerFilter } from "../../src/components/exercisePicker/exercisePickerFilter";
import { ExercisePickerCustomExercise } from "../../src/components/exercisePicker/exercisePickerCustomExercise";
import { ExercisePickerOptionsMuscles } from "../../src/components/exercisePicker/exercisePickerOptionsMuscles";
import { ExercisePickerExerciseItem } from "../../src/components/exercisePicker/exercisePickerExerciseItem";
import { Exercise_createCustomExercise } from "../../src/models/exercise";
import { Exercise_get } from "../../src/models/exercise";
import { Muscle_getMusclesFromScreenMuscle } from "../../src/models/muscle";
import { ExercisePickerUtils_getMuscleGroupName } from "../../src/components/exercisePicker/exercisePickerUtils";
import { ExercisePickerUtils_getSelectedMuscleGroupNames } from "../../src/components/exercisePicker/exercisePickerUtils";
import { ICustomExercise, IExercisePickerState } from "../../src/types";
import { ILensDispatch } from "../../src/utils/useLensReducer";
import { Fixture_build } from "../harness/fixture";

describe("exercise picker filter Korean labels", () => {
  it("shows Korean sort, availability, equipment, type, and muscle labels", async () => {
    const settings = Fixture_build().storage.settings;
    const state: IExercisePickerState = {
      screenStack: ["filter"],
      sort: "name_asc",
      filters: {
        equipment: ["barbell"],
        type: ["push"],
        muscles: Muscle_getMusclesFromScreenMuscle("chest", settings),
      },
      selectedExercises: [],
      mode: "workout",
    };

    await render(
      <ExercisePickerFilter
        settings={settings}
        state={state}
        dispatch={jest.fn() as unknown as ILensDispatch<IExercisePickerState>}
        onChangeSettings={() => undefined}
      />
    );

    expect(screen.getByText("종목 필터 및 정렬")).toBeTruthy();
    expect(screen.getAllByText("이름순").length).toBeGreaterThan(0);
    expect(screen.getByText("근육 유사도순")).toBeTruthy();
    expect(screen.getByText("종목 교체·편집 시에만 사용")).toBeTruthy();
    expect(screen.getByText("사용 가능한 기구만 표시")).toBeTruthy();
    expect(screen.getAllByText("바벨").length).toBeGreaterThan(0);
    expect(screen.getAllByText("밀기").length).toBeGreaterThan(0);
    expect(screen.getAllByText("가슴").length).toBeGreaterThan(0);
    expect(screen.getByText("근육 그룹")).toBeTruthy();
    expect(screen.getByText("근육")).toBeTruthy();
  });

  it("keeps a user's custom muscle group name", () => {
    const settings = Fixture_build().storage.settings;
    settings.muscleGroups.data.chest = { name: "사용자 지정 가슴", muscles: [] };

    expect(ExercisePickerUtils_getMuscleGroupName("chest", settings)).toBe("사용자 지정 가슴");
  });

  it("translates individual muscle names without changing automation IDs", async () => {
    const settings = Fixture_build().storage.settings;

    await render(
      <ExercisePickerOptionsMuscles
        selectedValues={[]}
        dontGroup={true}
        settings={settings}
        onSelect={() => undefined}
      />
    );

    expect(screen.getByText("위팔두갈래근")).toBeTruthy();
    expect(screen.getByText("넓은등근")).toBeTruthy();
    expect(screen.getByTestId("select-muscle-biceps-brachii")).toBeTruthy();
    expect(ExercisePickerUtils_getSelectedMuscleGroupNames(["Biceps Brachii"], settings)).toEqual(["위팔두갈래근"]);
  });

  it("uses the same Korean muscle and equipment names in exercise rows", async () => {
    const settings = Fixture_build().storage.settings;

    await render(
      <ExercisePickerExerciseItem
        exercise={Exercise_get({ id: "benchPress", equipment: "barbell" }, settings.exercises)}
        settings={settings}
        showMuscles={true}
        isEnabled={true}
      />
    );

    expect(screen.getAllByLabelText("벤치프레스, 바벨").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("주동근: 큰가슴근 복장부분")).toBeTruthy();
    expect(screen.getByLabelText("협력근: 앞어깨세모근, 큰가슴근 빗장부분, 위팔세갈래근")).toBeTruthy();
    expect(screen.queryByLabelText("Bench Press, Barbell")).toBeNull();
    expect(screen.getByTestId("custom-exercise-bench-press")).toBeTruthy();
  });

  it("shows Korean labels and the create title in the custom exercise form", async () => {
    const settings = Fixture_build().storage.settings;

    await render(
      <ExercisePickerCustomExercise
        settings={settings}
        screenStack={["customExercise"]}
        showMuscles={false}
        exercise={Exercise_createCustomExercise("테스트 운동", [], [], [])}
        isLoggedIn={false}
        dispatch={jest.fn() as unknown as ILensDispatch<ICustomExercise>}
        onGoBack={() => undefined}
        onClose={() => undefined}
        onChange={() => undefined}
      />
    );

    expect(screen.getByText("사용자 운동 추가")).toBeTruthy();
    expect(screen.getByText("저장")).toBeTruthy();
    expect(screen.getByText("다른 운동 복제")).toBeTruthy();
    expect(screen.getByText("근육 및 운동 유형 자동 입력")).toBeTruthy();
    expect(screen.getByText("주동근")).toBeTruthy();
    expect(screen.getByText("협력근")).toBeTruthy();
    expect(screen.getByText("운동 유형")).toBeTruthy();
    expect(screen.getByText("운동 메모")).toBeTruthy();
  });
});
