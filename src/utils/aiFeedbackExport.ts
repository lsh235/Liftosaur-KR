import { Exercise_fullName, Exercise_get, Exercise_synergistMuscles, Exercise_targetMuscles } from "../models/exercise";
import { IHistoryEntry, IHistoryRecord, ISet, ISettings, IWeight } from "../types";
import { DateUtils_formatYYYYMMDD } from "./date";
import { Weight_convertTo } from "../models/weight";

interface ILoggedSet {
  set: ISet;
  weight: IWeight;
  reps: number;
  e1rm: number;
}

function numberText(value: number): string {
  return Number(value.toFixed(1)).toString();
}

function weightText(weight: IWeight | undefined, settings: ISettings): string {
  if (!weight) {
    return "중량 미기록";
  }
  const converted = Weight_convertTo(weight, settings.units);
  return numberText(converted.value) + converted.unit;
}

function loggedSets(entry: IHistoryEntry, settings: ISettings): ILoggedSet[] {
  return entry.sets.flatMap((set) => {
    const reps = set.completedReps ?? 0;
    const weight = set.completedWeight ?? set.weight;
    if (reps <= 0 || !weight || set.label?.toUpperCase() === "WARMUP") {
      return [];
    }
    const converted = Weight_convertTo(weight, settings.units);
    return [{ set, weight: converted, reps, e1rm: converted.value * (1 + reps / 30) }];
  });
}

function exerciseName(entry: IHistoryEntry, settings: ISettings): string {
  return Exercise_fullName(Exercise_get(entry.exercise, settings.exercises), settings);
}

function bestSet(sets: ILoggedSet[]): ILoggedSet | undefined {
  return sets.reduce<ILoggedSet | undefined>(
    (best, set) => (best == null || set.e1rm > best.e1rm ? set : best),
    undefined
  );
}

function statusForSet(set: ISet, settings: ISettings): string {
  const actualReps = set.completedReps;
  const targetReps = set.reps;
  const actualWeight = set.completedWeight ? Weight_convertTo(set.completedWeight, settings.units).value : undefined;
  const targetWeight = set.weight ? Weight_convertTo(set.weight, settings.units).value : undefined;
  if (actualReps == null && actualWeight == null) {
    return "미기록";
  }
  const under =
    (targetReps != null && actualReps != null && actualReps < targetReps) ||
    (targetWeight != null && actualWeight != null && actualWeight < targetWeight);
  const over =
    (targetReps != null && actualReps != null && actualReps > targetReps) ||
    (targetWeight != null && actualWeight != null && actualWeight > targetWeight);
  if (under && over) {
    return "⚠️ 목표 혼합";
  }
  if (under) {
    return "⚠️ 목표 미달";
  }
  if (over) {
    return "✅ 목표 초과";
  }
  return "✅ 목표 달성";
}

function targetText(set: ISet, settings: ISettings): string {
  const weight = set.weight ? weightText(set.weight, settings) : set.askWeight ? "중량 입력" : "중량 미지정";
  const reps = set.reps == null ? "반복 미지정" : set.reps + "회";
  return weight + " × " + reps;
}

function actualText(set: ISet, settings: ISettings): string {
  const weight = weightText(set.completedWeight, settings);
  const reps = set.completedReps == null ? "반복 미기록" : set.completedReps + "회";
  const rpe = set.completedRpe == null ? "" : " @RPE " + set.completedRpe;
  return weight + " × " + reps + rpe;
}

function sessionVolume(record: IHistoryRecord, settings: ISettings): number {
  return record.entries.reduce((total, entry) => {
    return (
      total +
      entry.sets.reduce((exerciseTotal, set) => {
        if (set.completedReps == null || set.label?.toUpperCase() === "WARMUP") {
          return exerciseTotal;
        }
        const weight = set.completedWeight ?? set.weight;
        if (!weight) {
          return exerciseTotal;
        }
        const converted = Weight_convertTo(weight, settings.units);
        const reps = set.isUnilateral ? set.completedReps + (set.completedRepsLeft ?? 0) : set.completedReps;
        return exerciseTotal + converted.value * reps;
      }, 0)
    );
  }, 0);
}

function progressionSummary(records: IHistoryRecord[], settings: ISettings): string[] {
  const exercises = new Map<string, { muscles: number; weeks: Map<number, ILoggedSet[]> }>();
  for (const record of records) {
    for (const entry of record.entries) {
      const name = exerciseName(entry, settings);
      const exercise = exercises.get(name) || {
        muscles: new Set([
          ...Exercise_targetMuscles(entry.exercise, settings),
          ...Exercise_synergistMuscles(entry.exercise, settings),
        ]).size,
        weeks: new Map<number, ILoggedSet[]>(),
      };
      const week = record.week ?? record.startTime;
      exercise.weeks.set(week, [...(exercise.weeks.get(week) || []), ...loggedSets(entry, settings)]);
      exercises.set(name, exercise);
    }
  }
  const rows: string[] = [];
  for (const [name, exercise] of exercises) {
    if (exercise.muscles < 2 || exercise.weeks.size === 0) {
      continue;
    }
    const weeks = [...exercise.weeks.keys()].sort((a, b) => a - b);
    const first = bestSet(exercise.weeks.get(weeks[0]) || []);
    const last = bestSet(exercise.weeks.get(weeks[weeks.length - 1]) || []);
    if (!first || !last) {
      continue;
    }
    const change = first.e1rm > 0 ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : undefined;
    const firstLabel = weeks[0] > 52 ? "첫 기록" : weeks[0] + "주차";
    const lastLabel = weeks[weeks.length - 1] > 52 ? "마지막 기록" : weeks[weeks.length - 1] + "주차";
    rows.push(
      "| " +
        name.replace(/\|/g, "\\|") +
        " | " +
        firstLabel +
        " " +
        numberText(first.weight.value) +
        settings.units +
        " × " +
        first.reps +
        "회" +
        " | " +
        numberText(first.e1rm) +
        settings.units +
        " | " +
        lastLabel +
        " " +
        numberText(last.weight.value) +
        settings.units +
        " × " +
        last.reps +
        "회" +
        " | " +
        numberText(last.e1rm) +
        settings.units +
        " | " +
        (change == null ? "계산 불가" : (change > 0 ? "+" : "") + numberText(change) + "%") +
        " |"
    );
  }
  return rows;
}

export function AiFeedbackExport_buildMarkdown(
  allHistory: IHistoryRecord[],
  settings: ISettings,
  userNote: string,
  generatedAt: number = Date.now(),
  reportTitle: string = "AI 운동 피드백 데이터"
): string {
  const history = allHistory
    .filter((record) => record.vtype === "history_record")
    .slice()
    .sort((a, b) => a.startTime - b.startTime);
  const first = history[0];
  const last = history[history.length - 1];
  const lines = [
    "# " + (reportTitle.trim() || "AI 운동 피드백 데이터").replace(/\n/g, " "),
    "",
    "내보낸 날짜: " + DateUtils_formatYYYYMMDD(generatedAt),
    "기록 기간: " +
      (first && last
        ? DateUtils_formatYYYYMMDD(first.startTime) + " ~ " + DateUtils_formatYYYYMMDD(last.startTime)
        : "운동 기록 없음"),
    "완료 세션 수: " + history.length,
    "출석률: 예정 운동일 달력 데이터가 없어 계산하지 않음",
    "일정 밀림 횟수: 현재 기록 형식에서 추적하지 않음",
    "",
    "## 사용자 메모",
    "",
    userNote.trim() || "(메모 없음)",
    "",
  ];

  const programGroups = new Map<string, IHistoryRecord[]>();
  for (const record of history) {
    const key = record.programId || record.programName;
    programGroups.set(key, [...(programGroups.get(key) || []), record]);
  }
  for (const records of programGroups.values()) {
    const programName = records[0].programName || "이름 없는 프로그램";
    lines.push("## 프로그램: " + programName, "");
    lines.push("### 주요 운동 진행 요약", "");
    lines.push(
      "| 운동 | 첫 기록 | 첫 e1RM | 마지막 기록 | 마지막 e1RM | 변화율 |",
      "| --- | --- | ---: | --- | ---: | ---: |"
    );
    const progressionRows = progressionSummary(records, settings);
    lines.push(
      ...(progressionRows.length > 0 ? progressionRows : ["| 비교 가능한 다관절 운동 기록 없음 | - | - | - | - | - |"]),
      ""
    );
    lines.push("### 세션별 기록", "");
    for (const record of records) {
      const date = DateUtils_formatYYYYMMDD(record.startTime);
      const week = record.week == null ? "주차 미기록" : record.week + "주차";
      const volume = numberText(sessionVolume(record, settings)) + settings.units;
      lines.push("#### " + date + " · " + week + " · " + record.dayName, "", "세션 볼륨(워밍업 제외): " + volume, "");
      for (const entry of record.entries) {
        const name = exerciseName(entry, settings);
        lines.push("- **" + name.replace(/\|/g, "\\|") + "**");
        const sets = entry.sets.filter((set) => set.label?.toUpperCase() !== "WARMUP");
        if (sets.length === 0) {
          lines.push("  - 기록된 본 세트 없음");
        }
        for (const [index, set] of sets.entries()) {
          const label = set.label ? " " + set.label : "";
          lines.push(
            "  - " +
              (index + 1) +
              label +
              ": 목표 " +
              targetText(set, settings) +
              " → 실제 " +
              actualText(set, settings) +
              " · " +
              statusForSet(set, settings)
          );
        }
        if (entry.notes?.trim()) {
          lines.push("  - 메모: " + entry.notes.trim().replace(/\n/g, " "));
        }
      }
      lines.push("");
    }
  }

  lines.push(
    "---",
    "e1RM은 Epley 공식(중량 × (1 + 반복 수 / 30))으로 계산했습니다. 다관절 운동 표시는 앱의 주요 타겟 근육이 2개 이상인 운동을 기준으로 했습니다."
  );
  return lines.join("\n");
}
