import { IHistoryRecord } from "../types";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

/**
 * Cross-platform version token for coach proposals. Include only workout state that can affect
 * the workout or set selection; omit local presentation state and ticking rest-timer counters.
 * The JSON itself is the opaque version so both React Native and the server use identical code.
 */
export function WorkoutCoachVersion_get(progress: IHistoryRecord): string {
  const projection = {
    startTime: progress.startTime,
    programId: progress.programId,
    day: progress.day,
    week: progress.week,
    dayInWeek: progress.dayInWeek,
    currentEntryIndex: progress.currentEntryIndex,
    amrapModal: progress.amrapModal && { entryIndex: progress.amrapModal.entryIndex, setIndex: progress.amrapModal.setIndex },
    setTimer: progress.setTimer && { setId: progress.setTimer.setId, startedAt: progress.setTimer.startedAt, side: progress.setTimer.side },
    setTimerGetReady: progress.setTimerGetReady && { setId: progress.setTimerGetReady.setId, startedAt: progress.setTimerGetReady.startedAt, side: progress.setTimerGetReady.side },
    entries: progress.entries.map((entry) => ({
      id: entry.id,
      exercise: entry.exercise,
      notes: entry.notes,
      superset: entry.superset,
      sets: entry.sets.map((set) => ({
        id: set.id,
        index: set.index,
        reps: set.reps,
        minReps: set.minReps,
        weight: set.weight,
        originalWeight: set.originalWeight,
        rpe: set.rpe,
        isAmrap: set.isAmrap,
        timer: set.timer,
        setTimer: set.setTimer,
        // Optional false and omitted are the same unfinished state across RN/server serializers.
        isCompleted: set.isCompleted === true,
        completedReps: set.completedReps,
        completedRepsLeft: set.completedRepsLeft,
        completedWeight: set.completedWeight,
        completedRpe: set.completedRpe,
        completedSetTimer: set.completedSetTimer,
        completedSetTimerLeft: set.completedSetTimerLeft,
      })),
    })),
  };
  return JSON.stringify(stable(projection));
}
