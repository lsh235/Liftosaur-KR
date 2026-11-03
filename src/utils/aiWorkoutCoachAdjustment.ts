import { IHistoryRecord, ISet, IWeight } from "../types";
import { Weight_strictParse } from "../models/weight";

export interface IWorkoutCoachSetChange {
  setId: string;
  reps?: number;
  weight?: string;
  remove?: boolean;
  before: { reps?: number; weight?: string; isCompleted: boolean };
}

function weightText(weight: IWeight | undefined): string | undefined {
  return weight == null ? undefined : `${weight.value}${weight.unit}`;
}

function beforeMatches(set: ISet, before: IWorkoutCoachSetChange["before"]): boolean {
  return (
    set.reps === before.reps &&
    weightText(set.weight) === before.weight &&
    !!set.isCompleted === before.isCompleted
  );
}

export function AiWorkoutCoachAdjustment_apply(
  progress: IHistoryRecord,
  changesValue: unknown
): { progress: IHistoryRecord; summary: string[] } | { error: string } {
  if (!Array.isArray(changesValue) || changesValue.length === 0) return { error: "변경 요청이 비어 있습니다." };
  const changes = changesValue as IWorkoutCoachSetChange[];
  if (changes.some((change) => !change || typeof change.setId !== "string" || !change.before)) {
    return { error: "변경 요청 형식을 확인할 수 없습니다." };
  }
  if (new Set(changes.map((change) => change.setId)).size !== changes.length) {
    return { error: "같은 세트를 여러 번 바꾸려는 요청은 적용할 수 없습니다." };
  }

  const setById = new Map(progress.entries.flatMap((entry) => entry.sets.map((set) => [set.id, set] as const)));
  for (const change of changes) {
    const set = setById.get(change.setId);
    if (!set) return { error: "운동이 바뀌어 요청한 세트를 찾지 못했습니다." };
    if (set.isCompleted || change.before.isCompleted || !beforeMatches(set, change.before)) {
      return { error: "요청 이후 운동 세트가 바뀌었습니다. 최신 기록을 확인해 주세요." };
    }
    if (change.remove && (change.reps != null || change.weight != null)) {
      return { error: "세트 제거 요청에 중량이나 반복 횟수 변경이 함께 포함되어 있습니다." };
    }
    if (change.reps != null && (!Number.isInteger(change.reps) || change.reps < 1 || change.reps > 1000)) {
      return { error: "세트 반복 횟수는 1에서 1000 사이의 정수여야 합니다." };
    }
    if (change.weight != null) {
      const parsedWeight = Weight_strictParse(change.weight);
      if (!parsedWeight || parsedWeight.value < 0 || parsedWeight.value > 2000) {
        return { error: `중량 형식을 확인해 주세요: ${change.weight}` };
      }
    }
  }

  const currentEntry = progress.entries[progress.currentEntryIndex ?? 0];
  const nextCurrentSet = currentEntry?.sets.find((set) => !set.isCompleted);
  if (nextCurrentSet && changes.some((change) => change.setId === nextCurrentSet.id)) {
    return { error: "현재 진행 중인 세트는 변경할 수 없습니다. 다음 세트부터 조정해 주세요." };
  }
  for (const entry of progress.entries) {
    if (
      entry.sets.length > 0 &&
      entry.sets.every((set) => changes.some((change) => change.setId === set.id && change.remove === true))
    ) {
      return { error: `운동 ${entry.index + 1}의 모든 세트를 제거할 수 없습니다.` };
    }
  }

  const entries = progress.entries.map((entry) => {
    const entryChanges = changes.filter((change) => entry.sets.some((set) => set.id === change.setId));
    if (entryChanges.length === 0) return entry;
    const updatedSets: ISet[] = [];
    for (const set of entry.sets) {
      const change = entryChanges.find((item) => item.setId === set.id);
      if (!change) {
        updatedSets.push(set);
        continue;
      }
      if (change.remove === true) continue;
      const updated: ISet = { ...set };
      if (change.reps != null) {
        updated.reps = change.reps;
      }
      if (change.weight != null) {
        const weight = Weight_strictParse(change.weight)!;
        updated.weight = weight;
        updated.originalWeight = weight;
      }
      updatedSets.push(updated);
    }
    return { ...entry, sets: updatedSets };
  });

  const matchedIds = new Set(entries.flatMap((entry) => entry.sets.map((set) => set.id)));
  const removedIds = new Set(changes.filter((change) => change.remove).map((change) => change.setId));
  for (const change of changes) {
    const originalSet = progress.entries.flatMap((entry) => entry.sets).find((set) => set.id === change.setId);
    if (!originalSet) return { error: "운동이 바뀌어 요청한 세트를 찾지 못했습니다." };
    if (!beforeMatches(originalSet, change.before)) return { error: "요청 이후 운동 세트가 바뀌었습니다. 최신 기록을 확인해 주세요." };
    if (!matchedIds.has(change.setId) && !removedIds.has(change.setId)) {
      return { error: "운동 세트를 안전하게 반영하지 못했습니다." };
    }
  }

  const summary = changes.map((change) => {
    const entry = progress.entries.find((item) => item.sets.some((set) => set.id === change.setId))!;
    const set = entry.sets.find((item) => item.id === change.setId)!;
    const exerciseName = `운동 ${entry.index + 1}`;
    if (change.remove) return `${exerciseName} · ${set.index + 1}세트 제거`;
    const parts = [];
    if (change.reps != null) parts.push(`반복 ${set.reps ?? "?"}회 → ${change.reps}회`);
    if (change.weight != null) parts.push(`중량 ${weightText(set.weight) ?? "미정"} → ${change.weight}`);
    return `${exerciseName} · ${set.index + 1}세트 ${parts.join(", ")}`;
  });
  return { progress: { ...progress, entries }, summary };
}

export function AiWorkoutCoachAdjustment_isApplied(progress: IHistoryRecord, changesValue: unknown): boolean {
  if (!Array.isArray(changesValue) || changesValue.length === 0) return false;
  const changes = changesValue as IWorkoutCoachSetChange[];
  for (const change of changes) {
    if (!change || typeof change.setId !== "string") return false;
    const set = progress.entries.flatMap((entry) => entry.sets).find((item) => item.id === change.setId);
    if (change.remove) {
      if (set) return false;
      continue;
    }
    if (!set || set.isCompleted) return false;
    if (change.reps != null && set.reps !== change.reps) return false;
    if (change.weight != null) {
      const expected = Weight_strictParse(change.weight);
      if (!expected || weightText(set.weight) !== weightText(expected)) return false;
    }
  }
  return true;
}
