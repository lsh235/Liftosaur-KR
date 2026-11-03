import { IHistoryRecord, ISet } from "../../src/types";
import { ICoachAdjustment } from "../dao/coachSessionDao";
import { Weight_strictParse } from "../../src/models/weight";
import { WorkoutCoachVersion_get } from "../../src/utils/workoutCoachVersion";

export function WorkoutCoach_version(progress: IHistoryRecord): string {
  return WorkoutCoachVersion_get(progress);
}

export interface IWorkoutCoachChangeWithBase extends ICoachAdjustment {
  before: { reps?: number; weight?: string; isCompleted: boolean };
}

export function WorkoutCoach_validateChanges(
  progress: IHistoryRecord,
  changes: ICoachAdjustment[]
): { success: true; changes: IWorkoutCoachChangeWithBase[] } | { success: false; message: string } {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 80) {
    return { success: false, message: "Provide between 1 and 80 set changes." };
  }
  const setById = new Map<string, ISet>();
  for (const entry of progress.entries) for (const set of entry.sets) setById.set(set.id, set);
  const currentEntryIndex = Math.max(0, Math.min(progress.currentEntryIndex ?? 0, progress.entries.length - 1));
  const currentEntry = progress.entries[currentEntryIndex];
  const protectedSetIds = new Set<string>();
  const firstUncompleted = currentEntry?.sets.find((set) => !set.isCompleted)?.id;
  if (firstUncompleted) protectedSetIds.add(firstUncompleted);
  if (progress.setTimer?.setId) protectedSetIds.add(progress.setTimer.setId);
  if (progress.setTimerGetReady?.setId) protectedSetIds.add(progress.setTimerGetReady.setId);
  const amrapEntry = progress.amrapModal?.entryIndex;
  const amrapSet = progress.amrapModal?.setIndex;
  const amrapSetId = amrapEntry != null && amrapSet != null ? progress.entries[amrapEntry]?.sets[amrapSet]?.id : undefined;
  if (amrapSetId) protectedSetIds.add(amrapSetId);
  const seen = new Set<string>();
  const normalized: IWorkoutCoachChangeWithBase[] = [];
  for (const change of changes) {
    if (!change || typeof change.setId !== "string" || seen.has(change.setId)) {
      return { success: false, message: "Set changes must use unique setId values." };
    }
    seen.add(change.setId);
    const set = setById.get(change.setId);
    if (!set) return { success: false, message: `Set '${change.setId}' is not in the active workout.` };
    if (set.isCompleted || protectedSetIds.has(change.setId)) {
      return { success: false, message: "Completed sets and the currently selected set cannot be changed." };
    }
    if (change.reps == null && change.weight == null && !change.remove) {
      return { success: false, message: `Set '${change.setId}' has no adjustment.` };
    }
    if (change.reps != null && (!Number.isInteger(change.reps) || change.reps < 1 || change.reps > 500)) {
      return { success: false, message: "Repetitions must be a whole number from 1 to 500." };
    }
    if (change.weight != null && Weight_strictParse(change.weight) == null) {
      return { success: false, message: `Invalid weight for set '${change.setId}'. Use a value such as 20kg or 45lb.` };
    }
    if (change.remove && (change.reps != null || change.weight != null)) {
      return { success: false, message: "A set cannot be removed and adjusted at the same time." };
    }
    normalized.push({
      ...change,
      before: {
        reps: set.reps,
        weight: set.weight ? `${set.weight.value}${set.weight.unit}` : undefined,
        isCompleted: !!set.isCompleted,
      },
    });
  }
  return { success: true, changes: normalized };
}
