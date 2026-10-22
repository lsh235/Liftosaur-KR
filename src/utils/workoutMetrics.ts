import { ISet, IWeight } from "../types";
import { Weight_build } from "../models/weight";
import { Reps_avgUnilateralCompletedReps } from "../models/set";

export function WorkoutMetrics_epley(weight: IWeight | undefined, reps: number | undefined): IWeight | undefined {
  if (
    weight == null ||
    !Number.isFinite(weight.value) ||
    weight.value <= 0 ||
    reps == null ||
    !Number.isFinite(reps) ||
    reps <= 0
  ) {
    return undefined;
  }
  return Weight_build(weight.value * (1 + reps / 30), weight.unit);
}

export function WorkoutMetrics_epleyForSet(set: ISet): IWeight | undefined {
  if (set.isUnilateral && (set.completedReps == null || set.completedRepsLeft == null)) {
    return undefined;
  }
  const weight = set.completedWeight ?? (set.isCompleted ? undefined : set.weight);
  return WorkoutMetrics_epley(weight, Reps_avgUnilateralCompletedReps(set));
}
