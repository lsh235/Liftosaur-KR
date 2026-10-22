import { cleanup, render, screen } from "@testing-library/react-native";
import { ISet } from "../../src/types";
import { WorkoutExerciseSetTarget } from "../../src/components/workoutExerciseSetFields";
import { Weight_build } from "../../src/models/weight";

const setTypeColors = [
  ["WARMUP", "bg-background-subtlecardpurple"],
  ["TOP", "bg-background-lighterror"],
  ["BACKOFF", "bg-background-cardyellow"],
  ["STRAIGHT", "bg-background-success"],
  ["DROP", "bg-button-orangebackground"],
] as const;

function workoutSet(label: string): ISet {
  return {
    vtype: "set",
    id: label,
    index: 0,
    label,
    reps: 5,
    weight: Weight_build(80, "kg"),
  };
}

describe("workout set type badges", () => {
  afterEach(() => cleanup());

  for (const [label, background] of setTypeColors) {
    it(`gives ${label} its own colored badge`, async () => {
      await render(<WorkoutExerciseSetTarget setType="program" set={workoutSet(label)} />);

      const badge = screen.getByTestId("workout-set-label");
      expect(badge.props.className).toContain(background);
      expect(screen.getByText(label)).toBeTruthy();
    });
  }

  it("shows the generated warmup row as a Korean colored badge", async () => {
    await render(<WorkoutExerciseSetTarget setType="warmup" set={workoutSet("WARMUP")} />);

    const badge = screen.getByTestId("workout-set-label");
    expect(badge.props.className).toContain("bg-background-subtlecardpurple");
    expect(screen.getByText("워밍업")).toBeTruthy();
  });

  it("keeps custom set labels visible in a neutral badge", async () => {
    await render(<WorkoutExerciseSetTarget setType="program" set={workoutSet("myo")} />);

    expect(screen.getByTestId("workout-set-label").props.className).toContain("bg-background-neutral");
    expect(screen.getByText("myo")).toBeTruthy();
  });
});
