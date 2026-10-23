import { cleanup, render, screen } from "@testing-library/react-native";
import type { ComponentType } from "react";
import { ISet } from "../../src/types";
import { WorkoutExerciseSetCompact } from "../../src/components/workoutExerciseSetCompact";
import { WorkoutExerciseSetExpanded } from "../../src/components/workoutExerciseSetExpanded";
import { IWorkoutExerciseSetBodyProps } from "../../src/components/workoutExerciseSet";
import { Settings_build } from "../../src/models/settings";
import { Weight_build } from "../../src/models/weight";

function unilateralSet(): ISet {
  return {
    vtype: "set",
    id: "unilateral-test-set",
    index: 0,
    reps: 8,
    completedRepsLeft: 7,
    completedReps: 8,
    weight: Weight_build(12, "kg"),
    completedWeight: Weight_build(12, "kg"),
    isUnilateral: true,
  };
}

function props(): IWorkoutExerciseSetBodyProps {
  return {
    set: unilateralSet(),
    type: "workout",
    setType: "program",
    setIndex: 0,
    isNext: false,
    isUnilateral: true,
    labelW: 16,
    repsInputWidth: 2.75,
    weightInputWidth: 3.25,
    columnWidths: { set: 32, reps: 60, separator: 16, weight: 52, rpe: 0, check: 40 },
    placeholderReps: "8",
    placeholderWeight: "12",
    completedRpeValue: undefined,
    borderColor: "border-border-divider",
    isRoundedWeight: false,
    settings: Settings_build("kg"),
    exerciseType: { id: "dumbbellBenchPress", equipment: "dumbbell" },
    onInputLeftReps: jest.fn(),
    onBlurLeftReps: jest.fn(),
    onInputReps: jest.fn(),
    onBlurReps: jest.fn(),
    onInputWeight: jest.fn(),
    onBlurWeight: jest.fn(),
    onCompleteSet: jest.fn(),
    onOpenRoundingInfo: jest.fn(),
    onDeleteSet: jest.fn(),
    onOpenSubscription: jest.fn(),
  };
}

describe("Korean unilateral repetition labels", () => {
  afterEach(() => cleanup());

  async function expectLocalizedRow(Component: ComponentType<IWorkoutExerciseSetBodyProps>): Promise<void> {
    const componentProps = props();
    await render(<Component {...componentProps} />);

    expect(screen.getByText("좌:")).toBeTruthy();
    expect(screen.getByText("우:")).toBeTruthy();
    const left = screen.getByTestId("input-set-left-reps-field");
    const right = screen.getByTestId("input-set-reps-field");
    expect(left.props.accessibilityLabel ?? left.props["aria-label"]).toBe("왼쪽 반복");
    expect(right.props.accessibilityLabel ?? right.props["aria-label"]).toBe("오른쪽 반복");
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByTestId("set-nonstarted")).toBeTruthy();
  }

  it("renders Korean labels and accessible names in the compact row", async () => {
    await expectLocalizedRow(WorkoutExerciseSetCompact);
  });

  it("renders Korean labels and accessible names in the expanded row", async () => {
    await expectLocalizedRow(WorkoutExerciseSetExpanded);
  });
});
