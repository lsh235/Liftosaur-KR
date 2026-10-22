import { expect } from "chai";
import { ISet } from "../src/types";
import { Weight_build } from "../src/models/weight";
import { WorkoutMetrics_epley, WorkoutMetrics_epleyForSet } from "../src/utils/workoutMetrics";

describe("WorkoutMetrics_epley", () => {
  it("calculates Epley estimated 1RM and preserves the weight unit", () => {
    expect(WorkoutMetrics_epley({ value: 100, unit: "kg" }, 5)).to.deep.equal({
      value: 100 * (1 + 5 / 30),
      unit: "kg",
    });
  });

  it("does not estimate a max without a positive weight and completed reps", () => {
    expect(WorkoutMetrics_epley(undefined, 5)).to.equal(undefined);
    expect(WorkoutMetrics_epley({ value: 100, unit: "lb" }, undefined)).to.equal(undefined);
    expect(WorkoutMetrics_epley({ value: 100, unit: "lb" }, 0)).to.equal(undefined);
    expect(WorkoutMetrics_epley({ value: 0, unit: "lb" }, 5)).to.equal(undefined);
  });

  it("waits for both sides before estimating unilateral sets", () => {
    const set: ISet = {
      vtype: "set",
      id: "unilateral",
      index: 0,
      reps: 10,
      weight: Weight_build(30, "kg"),
      completedWeight: Weight_build(30, "kg"),
      completedReps: 12,
      isUnilateral: true,
    };

    expect(WorkoutMetrics_epleyForSet(set)).to.equal(undefined);
    expect(WorkoutMetrics_epleyForSet({ ...set, completedRepsLeft: 8 })).to.deep.equal(Weight_build(40, "kg"));
  });

  it("does not use a planned load when a completed set has no actual load", () => {
    const set: ISet = {
      vtype: "set",
      id: "completed-no-load",
      index: 0,
      reps: 5,
      weight: Weight_build(80, "kg"),
      completedReps: 5,
      isCompleted: true,
    };

    expect(WorkoutMetrics_epleyForSet(set)).to.equal(undefined);
  });

  it("uses the planned load for an in-progress estimate until an actual load is entered", () => {
    const set: ISet = {
      vtype: "set",
      id: "in-progress",
      index: 0,
      reps: 8,
      weight: Weight_build(80, "kg"),
      completedReps: 5,
      isCompleted: false,
    };

    expect(WorkoutMetrics_epleyForSet(set)).to.deep.equal(Weight_build(80 * (1 + 5 / 30), "kg"));
  });
});
