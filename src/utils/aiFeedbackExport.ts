import {
  Exercise_fullName,
  Exercise_get,
  Exercise_synergistMuscles,
  Exercise_targetMuscles,
  Exercise_targetMusclesGroups,
} from "../models/exercise";
import { IHistoryEntry, IHistoryRecord, IProgram, ISet, IScreenMuscle, ISettings, IWeight } from "../types";
import { DateUtils_firstDayOfWeekTimestamp, DateUtils_formatYYYYMMDD } from "./date";
import { Weight_build, Weight_convertTo } from "../models/weight";
import { Reps_avgUnilateralCompletedReps } from "../models/set";
import { ProgramSchedule_getDueSessionCount, ProgramSchedule_sessionCount } from "../models/programSchedule";
import { History_totalEntryWeight } from "../models/history";
import { Muscle_getMuscleGroupName } from "../models/muscle";

interface ILoggedSet {
  set: ISet;
  weight: IWeight;
  reps: number;
  e1rm: number;
}

interface ISessionVolume {
  weight?: IWeight;
  missingWeightSets: number;
}

function numberText(value: number): string {
  return Number(value.toFixed(1)).toString();
}

const markdownInlinePunctuation = new Set(Array.from("\\`*_{}[]<>#+-.!|~()"));

function markdownSingleLine(value: string): string {
  return value.replace(/\0/g, "\uFFFD").replace(/[\r\n\t]+/g, " ");
}

function markdownInline(value: string): string {
  return Array.from(markdownSingleLine(value), (character) =>
    markdownInlinePunctuation.has(character) ? "\\" + character : character
  ).join("");
}

function markdownTableCell(value: string): string {
  return markdownInline(value);
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
    if (
      set.completedWeight == null ||
      (set.isUnilateral && (set.completedReps == null || set.completedRepsLeft == null))
    ) {
      return [];
    }
    const reps = Reps_avgUnilateralCompletedReps(set) ?? 0;
    const weight = set.completedWeight;
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
  const actualReps = [set.completedReps, set.isUnilateral ? set.completedRepsLeft : undefined].filter(
    (reps): reps is number => reps != null
  );
  const targetReps = set.reps;
  const actualWeight = set.completedWeight ? Weight_convertTo(set.completedWeight, settings.units).value : undefined;
  const targetWeight = set.weight ? Weight_convertTo(set.weight, settings.units).value : undefined;
  if (actualReps.length === 0 && actualWeight == null) {
    return "미기록";
  }
  const missingParts: string[] = [];
  if ((targetWeight != null || set.askWeight) && actualWeight == null) {
    missingParts.push("중량 미기록");
  }
  if (targetReps != null && (set.completedReps == null || (set.isUnilateral && set.completedRepsLeft == null))) {
    missingParts.push(set.isUnilateral ? "좌우 반복 미기록" : "반복 미기록");
  }
  const under =
    (targetReps != null && actualReps.some((reps) => reps < targetReps)) ||
    (targetWeight != null && actualWeight != null && actualWeight < targetWeight);
  const over =
    (targetReps != null && actualReps.some((reps) => reps > targetReps)) ||
    (targetWeight != null && actualWeight != null && actualWeight > targetWeight);
  if (under && over) {
    return "⚠️ 목표 혼합" + (missingParts.length > 0 ? " · " + missingParts.join(" · ") : "");
  }
  if (under) {
    return "⚠️ 목표 미달" + (missingParts.length > 0 ? " · " + missingParts.join(" · ") : "");
  }
  if (over) {
    const status = missingParts.length > 0 ? "⚠️ 목표 초과" : "✅ 목표 초과";
    return status + (missingParts.length > 0 ? " · " + missingParts.join(" · ") : "");
  }
  if (missingParts.length > 0) {
    return "⚠️ " + missingParts.join(" · ");
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
  const reps = set.isUnilateral
    ? set.completedReps != null && set.completedRepsLeft != null
      ? set.completedRepsLeft + "/" + set.completedReps + "회"
      : (set.completedRepsLeft != null ? "L " + set.completedRepsLeft + "회" : "L 미기록") +
        " / " +
        (set.completedReps != null ? "R " + set.completedReps + "회" : "R 미기록")
    : set.completedReps == null
      ? "반복 미기록"
      : set.completedReps + "회";
  const rpe = set.completedRpe == null ? "" : " @RPE " + set.completedRpe;
  return weight + " × " + reps + rpe;
}

function sessionVolume(record: IHistoryRecord, settings: ISettings): ISessionVolume {
  let completedWeightedSets = 0;
  let missingWeightSets = 0;
  const entries = record.entries.map((entry) => ({
    ...entry,
    sets: entry.sets.filter((set) => {
      if (
        set.label?.toUpperCase() === "WARMUP" ||
        ((set.completedReps ?? 0) <= 0 && (set.completedRepsLeft ?? 0) <= 0)
      ) {
        return false;
      }
      if (set.completedWeight == null) {
        missingWeightSets += 1;
        return false;
      }
      completedWeightedSets += 1;
      return true;
    }),
  }));
  const volume = entries.reduce((total, entry) => total + History_totalEntryWeight(entry, settings).value, 0);
  return {
    weight: completedWeightedSets > 0 || missingWeightSets === 0 ? Weight_build(volume, settings.units) : undefined,
    missingWeightSets,
  };
}

const muscleGroupNamesKo: Partial<Record<IScreenMuscle, string>> = {
  shoulders: "어깨",
  triceps: "삼두근",
  back: "등",
  abs: "복근",
  glutes: "둔근",
  hamstrings: "햄스트링",
  quadriceps: "대퇴사두근",
  chest: "가슴",
  biceps: "이두근",
  calves: "종아리",
  forearms: "전완근",
};

function muscleGroupName(muscle: IScreenMuscle, settings: ISettings): string {
  return (
    settings.muscleGroups.data[muscle]?.name ??
    muscleGroupNamesKo[muscle] ??
    Muscle_getMuscleGroupName(muscle, settings)
  );
}

function weeklyMuscleSetSummary(records: IHistoryRecord[], settings: ISettings): string[] {
  const weeks = new Map<number, Map<IScreenMuscle, number>>();
  for (const record of records) {
    if (!Number.isFinite(record.startTime)) {
      continue;
    }
    const weekStart = DateUtils_firstDayOfWeekTimestamp(record.startTime, settings.startWeekFromMonday);
    let muscleSets = weeks.get(weekStart);
    if (muscleSets == null) {
      muscleSets = new Map<IScreenMuscle, number>();
      weeks.set(weekStart, muscleSets);
    }
    for (const entry of record.entries) {
      const targetMuscles = Exercise_targetMusclesGroups(entry.exercise, settings);
      if (targetMuscles.length === 0) {
        continue;
      }
      const recordedWorkingSets = entry.sets.filter(
        (set) =>
          set.label?.toUpperCase() !== "WARMUP" &&
          ((set.completedReps ?? 0) > 0 || (set.isUnilateral && (set.completedRepsLeft ?? 0) > 0))
      ).length;
      if (recordedWorkingSets === 0) {
        continue;
      }
      for (const muscle of targetMuscles) {
        muscleSets.set(muscle, (muscleSets.get(muscle) ?? 0) + recordedWorkingSets);
      }
    }
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([weekStart, muscleSets]) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return [...muscleSets.entries()]
        .sort(([a], [b]) => muscleGroupName(a, settings).localeCompare(muscleGroupName(b, settings)))
        .map(
          ([muscle, count]) =>
            "| " +
            DateUtils_formatYYYYMMDD(weekStart) +
            " ~ " +
            DateUtils_formatYYYYMMDD(weekEnd) +
            " | " +
            markdownTableCell(muscleGroupName(muscle, settings)) +
            " | " +
            count +
            " |"
        );
    });
}

function progressionSummary(records: IHistoryRecord[], settings: ISettings): string[] {
  const exercises = new Map<
    string,
    {
      muscles: number;
      weeks: Map<string, { order: number; week?: number; sets: ILoggedSet[] }>;
    }
  >();
  const orderedRecords = records.slice().sort((a, b) => a.startTime - b.startTime);
  const programPositions = new Set(
    orderedRecords.map((record) =>
      record.week != null && record.dayInWeek != null
        ? `${record.week}:${record.dayInWeek}`
        : record.day > 0
          ? `day:${record.day}`
          : record.week != null
            ? `week:${record.week}`
            : undefined
    )
  );
  programPositions.delete(undefined);
  const hasSingleProgramPosition = programPositions.size === 1;
  let cycle = 0;
  let previousRecord: IHistoryRecord | undefined;
  let bucketOrder = 0;

  for (const record of orderedRecords) {
    if (previousRecord) {
      const dayRegressed =
        previousRecord.day > 0 &&
        record.day > 0 &&
        (record.day < previousRecord.day || (hasSingleProgramPosition && record.day === previousRecord.day));
      const weekRegressed = previousRecord.week != null && record.week != null && record.week < previousRecord.week;
      const dayInWeekRegressed =
        previousRecord.week != null &&
        record.week === previousRecord.week &&
        previousRecord.dayInWeek != null &&
        record.dayInWeek != null &&
        record.dayInWeek < previousRecord.dayInWeek;
      if (dayRegressed || weekRegressed || dayInWeekRegressed) {
        cycle += 1;
      }
    }

    for (const entry of record.entries) {
      const name = exerciseName(entry, settings);
      const exercise = exercises.get(name) || {
        muscles: new Set([
          ...Exercise_targetMuscles(entry.exercise, settings),
          ...Exercise_synergistMuscles(entry.exercise, settings),
        ]).size,
        weeks: new Map<string, { order: number; week?: number; sets: ILoggedSet[] }>(),
      };
      const key = record.week == null ? `${cycle}:record:${record.startTime}` : `${cycle}:week:${record.week}`;
      const sets = loggedSets(entry, settings);
      if (sets.length > 0) {
        let bucket = exercise.weeks.get(key);
        if (bucket == null) {
          bucket = { order: bucketOrder, week: record.week, sets: [] };
          bucketOrder += 1;
        }
        bucket.sets.push(...sets);
        exercise.weeks.set(key, bucket);
      }
      exercises.set(name, exercise);
    }
    previousRecord = record;
  }
  const rows: string[] = [];
  for (const [name, exercise] of exercises) {
    if (exercise.muscles < 2 || exercise.weeks.size === 0) {
      continue;
    }
    const weeks = [...exercise.weeks.values()].sort((a, b) => a.order - b.order);
    const firstBucket = weeks[0];
    const lastBucket = weeks[weeks.length - 1];
    const first = firstBucket && bestSet(firstBucket.sets);
    const last = lastBucket && bestSet(lastBucket.sets);
    if (!first || !last) {
      continue;
    }
    const change = first.e1rm > 0 ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : undefined;
    const firstLabel = firstBucket.week == null ? "첫 기록" : firstBucket.week + "주차";
    const lastLabel = lastBucket.week == null ? "마지막 기록" : lastBucket.week + "주차";
    rows.push(
      "| " +
        markdownTableCell(name) +
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
  reportTitle: string = "AI 운동 피드백 데이터",
  allPrograms: IProgram[] = [],
  selectedProgramId?: string
): string {
  const history = allHistory
    .filter(
      (record) =>
        record.vtype === "history_record" && (selectedProgramId == null || record.programId === selectedProgramId)
    )
    .slice()
    .sort((a, b) => a.startTime - b.startTime);
  const first = history[0];
  const last = history[history.length - 1];
  const scheduledPrograms = allPrograms.filter(
    (program) => program.schedule != null && (selectedProgramId == null || program.id === selectedProgramId)
  );
  const dueSessions = scheduledPrograms.reduce(
    (total, program) =>
      total +
      ProgramSchedule_getDueSessionCount(
        program.schedule!,
        ProgramSchedule_sessionCount(program),
        DateUtils_formatYYYYMMDD(generatedAt)
      ),
    0
  );
  const completedScheduledSessions = scheduledPrograms.reduce(
    (total, program) => total + Math.min(program.schedule!.completedSessions, ProgramSchedule_sessionCount(program)),
    0
  );
  const attendance =
    dueSessions > 0
      ? Math.round((Math.min(completedScheduledSessions, dueSessions) / dueSessions) * 100) + "%"
      : scheduledPrograms.length > 0
        ? "예정 세션 없음"
        : "일정 설정 없음";
  const shiftedSessions =
    scheduledPrograms.length > 0
      ? scheduledPrograms.reduce((total, program) => total + program.schedule!.shiftCount, 0)
      : undefined;
  const userNoteContent = userNote.trim()
    ? userNote
        .trim()
        .split(/\r\n?|\n/)
        .map(markdownInline)
        .join("\n")
    : "(메모 없음)";
  const lines = [
    "# " + markdownInline(reportTitle.trim() || "AI 운동 피드백 데이터"),
    "",
    "내보낸 날짜: " + DateUtils_formatYYYYMMDD(generatedAt),
    "프로그램 범위: " +
      (selectedProgramId == null
        ? "전체 프로그램"
        : markdownInline(allPrograms.find((program) => program.id === selectedProgramId)?.name || selectedProgramId)),
    "기록 기간: " +
      (first && last
        ? DateUtils_formatYYYYMMDD(first.startTime) + " ~ " + DateUtils_formatYYYYMMDD(last.startTime)
        : "운동 기록 없음"),
    "완료 세션 수: " + history.length,
    "출석률: " + attendance,
    "일정 밀림 횟수: " + (shiftedSessions == null ? "일정 설정 없음" : shiftedSessions + "회"),
    "",
    "## 사용자 메모",
    "",
    userNoteContent,
    "",
  ];

  const programGroups = new Map<string, IHistoryRecord[]>();
  for (const record of history) {
    const key = record.programId || record.programName;
    programGroups.set(key, [...(programGroups.get(key) || []), record]);
  }
  if (selectedProgramId != null && !programGroups.has(selectedProgramId)) {
    programGroups.set(selectedProgramId, []);
  }
  for (const records of programGroups.values()) {
    const programName =
      records[0]?.programName ||
      allPrograms.find((program) => program.id === selectedProgramId)?.name ||
      "이름 없는 프로그램";
    lines.push("## 프로그램: " + markdownInline(programName), "");
    const scheduledProgram = allPrograms.find((program) => program.id === (records[0]?.programId || selectedProgramId));
    if (scheduledProgram?.schedule) {
      const programDueSessions = ProgramSchedule_getDueSessionCount(
        scheduledProgram.schedule,
        ProgramSchedule_sessionCount(scheduledProgram),
        DateUtils_formatYYYYMMDD(generatedAt)
      );
      const programCompleted = Math.min(scheduledProgram.schedule.completedSessions, programDueSessions);
      const programAttendance =
        programDueSessions > 0 ? Math.round((programCompleted / programDueSessions) * 100) + "%" : "예정 세션 없음";
      lines.push(
        "일정: " +
          scheduledProgram.schedule.startDate +
          " 시작 · 완료 " +
          scheduledProgram.schedule.completedSessions +
          "/" +
          ProgramSchedule_sessionCount(scheduledProgram) +
          "회 · 미루기 " +
          scheduledProgram.schedule.shiftCount +
          "회 · 출석률 " +
          programAttendance,
        ""
      );
    }
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
    lines.push(
      "### 주차별 타겟 근육군 기록 세트",
      "",
      "주간 구간은 설정된 주 시작 요일을 따릅니다. 실제 반복이 기록된 비워밍업 세트를 집계하며, 단측 운동은 양쪽 반복을 합쳐 1세트로 계산하고 협력근은 제외합니다.",
      "",
      "| 주간 구간 | 타겟 근육군 | 기록 세트 수 |",
      "| --- | --- | ---: |"
    );
    const muscleSetRows = weeklyMuscleSetSummary(records, settings);
    lines.push(...(muscleSetRows.length > 0 ? muscleSetRows : ["| 집계 가능한 세트 없음 | - | 0 |"]), "");
    lines.push("### 세션별 기록", "");
    if (records.length === 0) {
      lines.push("선택한 프로그램의 완료 기록이 없습니다.", "");
    }
    for (const record of records) {
      const date = DateUtils_formatYYYYMMDD(record.startTime);
      const week = record.week == null ? "주차 미기록" : record.week + "주차";
      const volume = sessionVolume(record, settings);
      const volumeText =
        volume.weight == null
          ? "실제 중량 미기록"
          : numberText(Weight_convertTo(volume.weight, settings.units).value) + settings.units;
      const missingWeightNote =
        volume.missingWeightSets > 0 ? " (중량 미기록 " + volume.missingWeightSets + "세트 제외)" : "";
      lines.push(
        "#### " + date + " · " + week + " · " + markdownInline(record.dayName),
        "",
        "세션 볼륨(워밍업 제외, 실제 중량 기록 기준): " + volumeText + missingWeightNote,
        ""
      );
      if (record.notes?.trim()) {
        lines.push("세션 메모: " + markdownSingleLine(record.notes.trim()), "");
      }
      for (const entry of record.entries) {
        const name = exerciseName(entry, settings);
        lines.push("- **" + markdownInline(name) + "**");
        const sets = entry.sets.filter((set) => set.label?.toUpperCase() !== "WARMUP");
        if (sets.length === 0) {
          lines.push("  - 기록된 본 세트 없음");
        }
        for (const [index, set] of sets.entries()) {
          const label = set.label ? " " + markdownInline(set.label) : "";
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
          lines.push("  - 메모: " + markdownSingleLine(entry.notes.trim()));
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
