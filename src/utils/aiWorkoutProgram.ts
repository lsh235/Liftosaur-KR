import { IPlannerProgram, IPlannerProgramWeek, ISettings, IUnit } from "../types";
import { IExportedProgram } from "../models/program";
import { PlannerProgram_buildExportedProgram } from "../pages/planner/models/plannerProgram";
import { Settings_build } from "../models/settings";
import { UidFactory_generateUid } from "./generator";
import { IEither } from "./types";

const setTypes = ["WARMUP", "TOP", "BACKOFF", "STRAIGHT", "DROP"] as const;
type IAISetType = (typeof setTypes)[number];

interface IAISet {
  set_no: number;
  type: IAISetType;
  target_weight: number;
  target_reps: number;
}

interface IAIProgression {
  week: number;
  sets: IAISet[];
}

interface IAIExercise {
  order: number;
  name: string;
  target_muscle?: string;
  rest_seconds: number;
  weekly_progression: IAIProgression[];
}

interface IAIWorkout {
  day_index: number;
  day_name: string;
  exercises: IAIExercise[];
}

interface IAIProgram {
  program_name: string;
  description?: string;
  duration_weeks: number;
  days_per_week: number;
  weight_unit?: IUnit;
  workouts: IAIWorkout[];
}

type IOutcome =
  | { kind: "not-ai" }
  | { kind: "error"; errors: string[] }
  | { kind: "program"; program: IExportedProgram };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function pathLabel(path: string): string {
  return path.replace(/\[(\d+)\]/g, (_, index: string) => Number(index) + 1 + "번째").replace(/\./g, " / ");
}

function objectAt(value: unknown, path: string, errors: string[]): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    errors.push(pathLabel(path) + " 항목은 객체여야 합니다.");
    return undefined;
  }
  return value;
}

function arrayAt(value: unknown, path: string, errors: string[]): unknown[] | undefined {
  if (!Array.isArray(value)) {
    errors.push(pathLabel(path) + " 항목은 배열이어야 합니다.");
    return undefined;
  }
  return value;
}

function stringAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  options: { optional?: boolean; max?: number; plannerName?: boolean } = {}
): string | undefined {
  const value = record[key];
  if (value == null && options.optional) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(pathLabel(path + "." + key) + " 값은 비어 있지 않은 문자열이어야 합니다.");
    return undefined;
  }
  const result = value.trim();
  if (options.max != null && result.length > options.max) {
    errors.push(pathLabel(path + "." + key) + " 값은 " + options.max + "자 이하여야 합니다.");
  }
  if (options.plannerName && /[\n\r/#{}()[\]|!]/.test(result)) {
    errors.push(pathLabel(path + "." + key) + " 값에 Liftosaur 구분 문자는 사용할 수 없습니다.");
  }
  return result;
}

function numberAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  options: { integer?: boolean; min?: number; max?: number } = {}
): number | undefined {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(pathLabel(path + "." + key) + " 값은 유효한 숫자여야 합니다.");
    return undefined;
  }
  if (options.integer && !Number.isInteger(value)) {
    errors.push(pathLabel(path + "." + key) + " 값은 정수여야 합니다.");
  }
  if (options.min != null && value < options.min) {
    errors.push(pathLabel(path + "." + key) + " 값은 " + options.min + " 이상이어야 합니다.");
  }
  if (options.max != null && value > options.max) {
    errors.push(pathLabel(path + "." + key) + " 값은 " + options.max + " 이하여야 합니다.");
  }
  return value;
}

function validateProgram(value: unknown): { program?: IAIProgram; errors: string[] } {
  const errors: string[] = [];
  const root = objectAt(value, "program", errors);
  if (!root) {
    return { errors };
  }
  const name = stringAt(root, "program_name", "program", errors, { max: 120 });
  const description = stringAt(root, "description", "program", errors, { optional: true, max: 2000 });
  const duration = numberAt(root, "duration_weeks", "program", errors, { integer: true, min: 1, max: 52 });
  const daysPerWeek = numberAt(root, "days_per_week", "program", errors, { integer: true, min: 1, max: 7 });
  let unit: IUnit | undefined;
  if (root.weight_unit != null) {
    if (root.weight_unit === "kg" || root.weight_unit === "lb") {
      unit = root.weight_unit;
    } else {
      errors.push("program / weight_unit 값은 kg 또는 lb여야 합니다.");
    }
  }

  const rawWorkouts = arrayAt(root.workouts, "program.workouts", errors) || [];
  const workouts: IAIWorkout[] = [];
  const dayIndexes = new Set<number>();
  for (const [wi, rawWorkout] of rawWorkouts.entries()) {
    const path = "program.workouts[" + wi + "]";
    const workout = objectAt(rawWorkout, path, errors);
    if (!workout) {
      continue;
    }
    const dayIndex = numberAt(workout, "day_index", path, errors, {
      integer: true,
      min: 1,
      max: daysPerWeek ?? 7,
    });
    const dayName = stringAt(workout, "day_name", path, errors, { max: 80 });
    const rawExercises = arrayAt(workout.exercises, path + ".exercises", errors) || [];
    const exercises: IAIExercise[] = [];
    const exerciseOrders = new Set<number>();
    for (const [ei, rawExercise] of rawExercises.entries()) {
      const exercisePath = path + ".exercises[" + ei + "]";
      const exercise = objectAt(rawExercise, exercisePath, errors);
      if (!exercise) {
        continue;
      }
      const order = numberAt(exercise, "order", exercisePath, errors, { integer: true, min: 1, max: 100 });
      const exerciseName = stringAt(exercise, "name", exercisePath, errors, {
        max: 100,
        plannerName: true,
      });
      const targetMuscle = stringAt(exercise, "target_muscle", exercisePath, errors, {
        optional: true,
        max: 80,
      });
      const rest = numberAt(exercise, "rest_seconds", exercisePath, errors, {
        integer: true,
        min: 0,
        max: 7200,
      });
      const rawWeeks = arrayAt(exercise.weekly_progression, exercisePath + ".weekly_progression", errors) || [];
      const progressions: IAIProgression[] = [];
      const weekNumbers = new Set<number>();
      for (const [pi, rawProgression] of rawWeeks.entries()) {
        const progressionPath = exercisePath + ".weekly_progression[" + pi + "]";
        const progression = objectAt(rawProgression, progressionPath, errors);
        if (!progression) {
          continue;
        }
        const week = numberAt(progression, "week", progressionPath, errors, {
          integer: true,
          min: 1,
          max: duration ?? 52,
        });
        const rawSets = arrayAt(progression.sets, progressionPath + ".sets", errors) || [];
        const sets: IAISet[] = [];
        const setNumbers = new Set<number>();
        for (const [si, rawSet] of rawSets.entries()) {
          const setPath = progressionPath + ".sets[" + si + "]";
          const set = objectAt(rawSet, setPath, errors);
          if (!set) {
            continue;
          }
          const setNo = numberAt(set, "set_no", setPath, errors, { integer: true, min: 1, max: 100 });
          const rawType = set.type;
          const type =
            typeof rawType === "string" && (setTypes as readonly string[]).includes(rawType.toUpperCase())
              ? (rawType.toUpperCase() as IAISetType)
              : undefined;
          if (!type) {
            errors.push(pathLabel(setPath + ".type") + " 값은 " + setTypes.join(", ") + " 중 하나여야 합니다.");
          }
          const weight = numberAt(set, "target_weight", setPath, errors, { min: 0, max: 2000 });
          const reps = numberAt(set, "target_reps", setPath, errors, { integer: true, min: 1, max: 1000 });
          if (setNo != null && setNumbers.has(setNo)) {
            errors.push(pathLabel(progressionPath + ".sets") + "에서 set_no " + setNo + "가 중복되었습니다.");
          }
          if (setNo != null) {
            setNumbers.add(setNo);
          }
          if (setNo != null && type != null && weight != null && reps != null) {
            sets.push({ set_no: setNo, type, target_weight: weight, target_reps: reps });
          }
        }
        if (sets.length === 0) {
          errors.push(pathLabel(progressionPath + ".sets") + "에는 적어도 한 세트가 있어야 합니다.");
        }
        if (week != null && weekNumbers.has(week)) {
          errors.push(pathLabel(exercisePath + ".weekly_progression") + "에서 " + week + "주차가 중복되었습니다.");
        }
        if (week != null) {
          weekNumbers.add(week);
          progressions.push({ week, sets: sets.sort((a, b) => a.set_no - b.set_no) });
        }
      }
      if (duration != null) {
        for (let week = 1; week <= duration; week += 1) {
          if (!weekNumbers.has(week)) {
            errors.push(pathLabel(exercisePath + ".weekly_progression") + "에 " + week + "주차 데이터가 없습니다.");
          }
        }
      }
      if (order != null && exerciseOrders.has(order)) {
        errors.push(pathLabel(path + ".exercises") + " 안에서 order " + order + "가 중복되었습니다.");
      }
      if (order != null) {
        exerciseOrders.add(order);
      }
      if (order != null && exerciseName != null && rest != null) {
        exercises.push({
          order,
          name: exerciseName,
          target_muscle: targetMuscle,
          rest_seconds: rest,
          weekly_progression: progressions.sort((a, b) => a.week - b.week),
        });
      }
    }
    if (exercises.length === 0) {
      errors.push(pathLabel(path + ".exercises") + "에는 적어도 한 운동이 있어야 합니다.");
    }
    if (dayIndex != null && dayIndexes.has(dayIndex)) {
      errors.push("program / workouts에서 day_index " + dayIndex + "가 중복되었습니다.");
    }
    if (dayIndex != null) {
      dayIndexes.add(dayIndex);
    }
    if (dayIndex != null && dayName != null) {
      workouts.push({ day_index: dayIndex, day_name: dayName, exercises: exercises.sort((a, b) => a.order - b.order) });
    }
  }
  if (daysPerWeek != null) {
    if (workouts.length !== daysPerWeek) {
      errors.push("workouts에는 days_per_week(" + daysPerWeek + ")와 같은 수의 운동일이 필요합니다.");
    }
    for (let day = 1; day <= daysPerWeek; day += 1) {
      if (!dayIndexes.has(day)) {
        errors.push("workouts에 " + day + "일차(day_index " + day + ")가 없습니다.");
      }
    }
  }
  if (name == null || duration == null || daysPerWeek == null) {
    return { errors };
  }
  return {
    errors,
    program: {
      program_name: name,
      description,
      duration_weeks: duration,
      days_per_week: daysPerWeek,
      weight_unit: unit,
      workouts: workouts.sort((a, b) => a.day_index - b.day_index),
    },
  };
}

function buildExerciseText(exercise: IAIExercise, week: number, unit: IUnit): string {
  const progression = exercise.weekly_progression.find((item) => item.week === week)!;
  const warmups = progression.sets.filter((set) => set.type === "WARMUP");
  const workSets = progression.sets
    .filter((set) => set.type !== "WARMUP")
    .map((set) => {
      const weight = set.target_weight === 0 ? "?+" : Number(set.target_weight.toFixed(3)) + unit;
      const rest = exercise.rest_seconds > 0 ? " " + exercise.rest_seconds + "s" : "";
      return "1x" + set.target_reps + " (" + set.type + ") " + weight + rest;
    });
  const warmupGroups = new Map<string, { count: number; reps: number; weight: number }>();
  for (const set of warmups) {
    const key = set.target_reps + ":" + set.target_weight;
    const group = warmupGroups.get(key) || { count: 0, reps: set.target_reps, weight: set.target_weight };
    group.count += 1;
    warmupGroups.set(key, group);
  }
  const warmupText = [...warmupGroups.values()]
    .map((set) => set.count + "x" + set.reps + " " + Number(set.weight.toFixed(3)) + unit)
    .join(", ");
  const workSection = workSets.length > 0 ? " / " + workSets.join(", ") : "";
  const warmupSection = warmupText ? " / warmup: " + warmupText : "";
  const muscleNote = exercise.target_muscle ? "\n/// 목표 근육: " + exercise.target_muscle.replace(/[\r\n]/g, " ") : "";
  return exercise.name + workSection + warmupSection + muscleNote;
}

function buildProgram(input: IAIProgram, settings?: ISettings): IOutcome {
  const unit = input.weight_unit || "kg";
  const weeks: IPlannerProgramWeek[] = [];
  for (let week = 1; week <= input.duration_weeks; week += 1) {
    weeks.push({
      name: week + "주차",
      days: input.workouts.map((workout) => ({
        name: workout.day_name,
        exerciseText: workout.exercises.map((exercise) => buildExerciseText(exercise, week, unit)).join("\n"),
      })),
    });
  }
  const planner: IPlannerProgram = { vtype: "planner", name: input.program_name, weeks };
  try {
    const exported = PlannerProgram_buildExportedProgram(
      UidFactory_generateUid(8),
      planner,
      settings || Settings_build(unit)
    );
    exported.program.name = input.program_name;
    exported.program.description = input.description || "AI에서 가져온 운동 루틴";
    exported.program.isMultiweek = input.duration_weeks > 1;
    return { kind: "program", program: exported };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "error", errors: ["루틴 문법을 확인할 수 없습니다: " + message] };
  }
}

function parseJson(contents: string, settings?: ISettings): IOutcome {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (_) {
    return { kind: "not-ai" };
  }
  if (!isRecord(value) || !("program_name" in value)) {
    return { kind: "not-ai" };
  }
  const validation = validateProgram(value);
  if (validation.errors.length > 0 || !validation.program) {
    return { kind: "error", errors: validation.errors };
  }
  return buildProgram(validation.program, settings);
}

function parseCsvRows(contents: string): { rows?: string[][]; error?: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = contents.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (quoted) {
        quoted = false;
      } else if (cell.length === 0) {
        quoted = true;
      } else {
        cell += char;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(cell);
      if (row.some((item) => item.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) {
    return { error: "CSV 파일에 닫히지 않은 따옴표가 있습니다." };
  }
  row.push(cell);
  if (row.some((item) => item.trim() !== "")) {
    rows.push(row);
  }
  return { rows };
}

const csvAliases: Record<string, string[]> = {
  program_name: ["program_name", "프로그램명"],
  duration_weeks: ["duration_weeks", "기간_주"],
  days_per_week: ["days_per_week", "주당_운동일수"],
  weight_unit: ["weight_unit", "중량_단위"],
  day_index: ["day_index", "일차"],
  day_name: ["day_name", "요일명"],
  exercise_order: ["exercise_order", "운동_순서"],
  exercise_name: ["exercise_name", "운동명"],
  target_muscle: ["target_muscle", "타겟_근육"],
  rest_seconds: ["rest_seconds", "휴식_초"],
  week: ["week", "주차"],
  set_no: ["set_no", "세트_번호"],
  set_type: ["set_type", "세트_유형"],
  target_weight: ["target_weight", "목표_중량"],
  target_reps: ["target_reps", "목표_횟수"],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseCsv(contents: string, settings?: ISettings): IOutcome {
  const parsed = parseCsvRows(contents);
  if (parsed.error) {
    return { kind: "error", errors: [parsed.error] };
  }
  const rows = parsed.rows || [];
  if (rows.length < 2) {
    return { kind: "not-ai" };
  }
  const headers = rows[0].map(normalizeHeader);
  const indexes: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(csvAliases)) {
    const index = headers.findIndex((header) => aliases.some((alias) => normalizeHeader(alias) === header));
    if (index >= 0) {
      indexes[field] = index;
    }
  }
  const signature = ["program_name", "day_index", "exercise_name", "week", "set_no", "target_reps"];
  if (!signature.every((field) => indexes[field] != null)) {
    return { kind: "not-ai" };
  }
  const required = [
    "program_name",
    "duration_weeks",
    "days_per_week",
    "day_index",
    "day_name",
    "exercise_order",
    "exercise_name",
    "rest_seconds",
    "week",
    "set_no",
    "set_type",
    "target_weight",
    "target_reps",
  ];
  const missing = required.filter((field) => indexes[field] == null);
  if (missing.length > 0) {
    return { kind: "error", errors: ["CSV 헤더에 필수 열이 없습니다: " + missing.join(", ")] };
  }
  const get = (cells: string[], field: string): string => cells[indexes[field]]?.trim() ?? "";
  const numeric = (cells: string[], field: string): number => {
    const value = get(cells, field);
    return value === "" ? NaN : Number(value);
  };
  const first = rows[1];
  const data: Record<string, unknown> = {
    program_name: get(first, "program_name"),
    duration_weeks: numeric(first, "duration_weeks"),
    days_per_week: numeric(first, "days_per_week"),
    weight_unit: get(first, "weight_unit") || undefined,
  };
  const workoutMap = new Map<number, Record<string, unknown>>();
  const exerciseMap = new Map<string, Record<string, unknown>>();
  const metadata = new Map<string, string>();
  const errors: string[] = [];
  for (const [rowIndex, cells] of rows.slice(1).entries()) {
    if (cells.length !== headers.length) {
      errors.push("CSV " + (rowIndex + 2) + "번째 줄의 열 수가 헤더와 다릅니다.");
      continue;
    }
    for (const field of ["program_name", "duration_weeks", "days_per_week", "weight_unit"]) {
      const value = get(cells, field);
      if (value !== "") {
        const normalized = field === "weight_unit" ? value.toLowerCase() : value;
        if (metadata.has(field) && metadata.get(field) !== normalized) {
          errors.push("CSV " + (rowIndex + 2) + "번째 줄의 " + field + " 값이 다른 행과 다릅니다.");
        } else {
          metadata.set(field, normalized);
        }
      }
    }
    const day = numeric(cells, "day_index");
    let workout = workoutMap.get(day);
    if (!workout) {
      workout = { day_index: day, day_name: get(cells, "day_name"), exercises: [] as unknown[] };
      workoutMap.set(day, workout);
    } else if (workout.day_name !== get(cells, "day_name")) {
      errors.push("CSV " + (rowIndex + 2) + "번째 줄의 day_name이 같은 운동일의 다른 행과 다릅니다.");
    }
    const order = numeric(cells, "exercise_order");
    const key = day + ":" + order;
    let exercise = exerciseMap.get(key);
    if (!exercise) {
      exercise = {
        order,
        name: get(cells, "exercise_name"),
        target_muscle: get(cells, "target_muscle") || undefined,
        rest_seconds: numeric(cells, "rest_seconds"),
        weekly_progression: [] as unknown[],
      };
      exerciseMap.set(key, exercise);
      (workout.exercises as unknown[]).push(exercise);
    } else if (
      exercise.name !== get(cells, "exercise_name") ||
      exercise.rest_seconds !== numeric(cells, "rest_seconds") ||
      exercise.target_muscle !== (get(cells, "target_muscle") || undefined)
    ) {
      errors.push("CSV " + (rowIndex + 2) + "번째 줄의 운동 정보가 같은 운동의 다른 행과 다릅니다.");
    }
    const week = numeric(cells, "week");
    const progressions = exercise.weekly_progression as Record<string, unknown>[];
    let progression = progressions.find((item) => item.week === week);
    if (!progression) {
      progression = { week, sets: [] as unknown[] };
      progressions.push(progression);
    }
    (progression.sets as unknown[]).push({
      set_no: numeric(cells, "set_no"),
      type: get(cells, "set_type").toUpperCase(),
      target_weight: numeric(cells, "target_weight"),
      target_reps: numeric(cells, "target_reps"),
    });
  }
  if (errors.length > 0) {
    return { kind: "error", errors };
  }
  data.workouts = [...workoutMap.values()].sort((a, b) => Number(a.day_index) - Number(b.day_index));
  const validation = validateProgram(data);
  if (validation.errors.length > 0 || !validation.program) {
    return { kind: "error", errors: validation.errors };
  }
  return buildProgram(validation.program, settings);
}

function toEither(outcome: IOutcome): IEither<IExportedProgram, string[]> | undefined {
  if (outcome.kind === "not-ai") {
    return undefined;
  }
  if (outcome.kind === "error") {
    return { success: false, error: outcome.errors };
  }
  return { success: true, data: outcome.program };
}

export function AiWorkoutProgram_tryImport(
  contents: string,
  settings?: ISettings
): IEither<IExportedProgram, string[]> | undefined {
  const normalized = contents.replace(/^\uFEFF/, "");
  const trimmed = normalized.trimStart();
  if (trimmed.startsWith("{")) {
    return toEither(parseJson(normalized, settings));
  }
  if (trimmed.includes(",")) {
    return toEither(parseCsv(normalized, settings));
  }
  return undefined;
}

export function AiWorkoutProgram_buildPromptTemplate(): string {
  return [
    "# Liftosaur 한국어 운동 프로그램 생성 요청",
    "",
    "운동 프로그램을 설계하는 코치로서 아래 JSON 규격을 지켜 프로그램을 만들어 줘. Liftosaur 앱은 파일을 로컬에서 가져오며 앱 내부에서 AI API를 호출하지 않아.",
    "응답은 JSON 객체 하나만 출력하고 Markdown 코드 펜스나 설명은 붙이지 마.",
    "workouts에는 days_per_week와 같은 수의 운동일을 넣고, 각 운동의 weekly_progression에는 1주차부터 duration_weeks까지 모든 주를 빠짐없이 넣어.",
    "",
    "필드 규칙:",
    "- program_name, description: 문자열",
    "- duration_weeks: 1~52 정수, days_per_week: 1~7 정수",
    "- weight_unit: kg 또는 lb. 생략하면 kg",
    "- workouts[]: day_index(1부터 시작), day_name, exercises[]",
    "- exercises[]: order, name, target_muscle, rest_seconds, weekly_progression[]",
    "- weekly_progression[]: week, sets[]",
    "- sets[]: set_no, type, target_weight, target_reps",
    "- type은 WARMUP, TOP, BACKOFF, STRAIGHT, DROP 중 하나",
    "- 중량은 weight_unit을 사용하고, 개인 중량을 모르면 target_weight를 0으로 둬. 앱에서 운동 중량을 입력하도록 처리한다.",
    "- 한 세트마다 고유한 set_no를 사용하고 목표 반복 수는 양의 정수로 적는다.",
    "",
    "예시 형식(예시는 첫 주 일부만 보여 줌. 실제 응답에는 전체 주차와 모든 운동일을 채워):",
    "{",
    '  "program_name": "6주 PHAT 변형 루틴",',
    '  "description": "상하체 파워와 근비대",',
    '  "duration_weeks": 6,',
    '  "days_per_week": 5,',
    '  "weight_unit": "kg",',
    '  "workouts": [{',
    '    "day_index": 1,',
    '    "day_name": "월요일: 상체 파워",',
    '    "exercises": [{',
    '      "order": 1,',
    '      "name": "Bench Press",',
    '      "target_muscle": "Chest",',
    '      "rest_seconds": 180,',
    '      "weekly_progression": [{',
    '        "week": 1,',
    '        "sets": [',
    '          { "set_no": 1, "type": "TOP", "target_weight": 0, "target_reps": 5 },',
    '          { "set_no": 2, "type": "BACKOFF", "target_weight": 0, "target_reps": 8 }',
    "        ]",
    "      }]",
    "    }]",
    "  }]",
    "}",
    "",
    "CSV로 만들 때는 한 행을 한 세트로 작성하고 이 헤더를 사용해:",
    "program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps",
  ].join("\n");
}

interface ISeedSetGroup {
  type: IAISetType;
  reps: number;
  count: number;
}

interface ISeedExercise {
  name: string;
  target_muscle: string;
  rest_seconds: number;
  sets: ISeedSetGroup[];
}

interface ISeedWorkout {
  day_name: string;
  exercises: ISeedExercise[];
}

const seedWorkouts: ISeedWorkout[] = [
  {
    day_name: "월요일: 상체 파워 (Upper Power)",
    exercises: [
      {
        name: "Bench Press",
        target_muscle: "가슴",
        rest_seconds: 180,
        sets: [
          { type: "TOP", reps: 4, count: 2 },
          { type: "BACKOFF", reps: 8, count: 3 },
        ],
      },
      {
        name: "Bent Over Row",
        target_muscle: "등",
        rest_seconds: 180,
        sets: [
          { type: "TOP", reps: 5, count: 2 },
          { type: "BACKOFF", reps: 8, count: 2 },
        ],
      },
      {
        name: "Overhead Press",
        target_muscle: "어깨",
        rest_seconds: 150,
        sets: [
          { type: "TOP", reps: 5, count: 1 },
          { type: "BACKOFF", reps: 8, count: 3 },
        ],
      },
      { name: "Lat Pulldown", target_muscle: "등", rest_seconds: 120, sets: [{ type: "STRAIGHT", reps: 8, count: 3 }] },
      {
        name: "Barbell Curl",
        target_muscle: "이두",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 8, count: 3 }],
      },
    ],
  },
  {
    day_name: "화요일: 하체 파워 (Lower Power)",
    exercises: [
      {
        name: "Squat",
        target_muscle: "대퇴사두근",
        rest_seconds: 210,
        sets: [
          { type: "TOP", reps: 4, count: 2 },
          { type: "BACKOFF", reps: 8, count: 3 },
        ],
      },
      {
        name: "Deadlift",
        target_muscle: "둔근·햄스트링",
        rest_seconds: 210,
        sets: [
          { type: "TOP", reps: 4, count: 1 },
          { type: "BACKOFF", reps: 6, count: 2 },
        ],
      },
      {
        name: "Leg Press",
        target_muscle: "대퇴사두근",
        rest_seconds: 150,
        sets: [{ type: "STRAIGHT", reps: 8, count: 3 }],
      },
      {
        name: "Standing Calf Raise",
        target_muscle: "종아리",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 10, count: 3 }],
      },
      { name: "Ab Wheel", target_muscle: "복근", rest_seconds: 90, sets: [{ type: "STRAIGHT", reps: 10, count: 3 }] },
    ],
  },
  {
    day_name: "수요일: 등·어깨 근비대 (Back & Shoulder Hypertrophy)",
    exercises: [
      {
        name: "Seated Cable Row",
        target_muscle: "등",
        rest_seconds: 120,
        sets: [{ type: "STRAIGHT", reps: 12, count: 4 }],
      },
      {
        name: "Lat Pulldown",
        target_muscle: "등",
        rest_seconds: 120,
        sets: [{ type: "STRAIGHT", reps: 12, count: 3 }],
      },
      {
        name: "Face Pull",
        target_muscle: "후면 삼각근",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 15, count: 3 }],
      },
      {
        name: "Lateral Raise",
        target_muscle: "측면 삼각근",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 15, count: 4 }],
      },
      {
        name: "Dumbbell Curl",
        target_muscle: "이두",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 12, count: 3 }],
      },
    ],
  },
  {
    day_name: "목요일: 가슴·팔 근비대 (Chest & Arms Hypertrophy)",
    exercises: [
      {
        name: "Incline Bench Press",
        target_muscle: "상부 가슴",
        rest_seconds: 120,
        sets: [{ type: "STRAIGHT", reps: 10, count: 4 }],
      },
      { name: "Chest Fly", target_muscle: "가슴", rest_seconds: 90, sets: [{ type: "STRAIGHT", reps: 12, count: 3 }] },
      {
        name: "Triceps Pushdown",
        target_muscle: "삼두",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 12, count: 3 }],
      },
      {
        name: "Overhead Triceps Extension",
        target_muscle: "삼두",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 12, count: 3 }],
      },
      {
        name: "Hammer Curl",
        target_muscle: "이두·전완",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 12, count: 3 }],
      },
    ],
  },
  {
    day_name: "금요일: 하체 근비대 (Leg Hypertrophy)",
    exercises: [
      {
        name: "Leg Press",
        target_muscle: "대퇴사두근",
        rest_seconds: 150,
        sets: [{ type: "STRAIGHT", reps: 12, count: 4 }],
      },
      {
        name: "Leg Extension",
        target_muscle: "대퇴사두근",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 15, count: 3 }],
      },
      {
        name: "Leg Curl",
        target_muscle: "햄스트링",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 15, count: 3 }],
      },
      {
        name: "Hip Thrust",
        target_muscle: "둔근",
        rest_seconds: 120,
        sets: [{ type: "STRAIGHT", reps: 10, count: 3 }],
      },
      {
        name: "Seated Calf Raise",
        target_muscle: "종아리",
        rest_seconds: 90,
        sets: [{ type: "STRAIGHT", reps: 15, count: 3 }],
      },
    ],
  },
];

export function AiWorkoutProgram_buildPhatSeedJson(): string {
  const program: IAIProgram = {
    program_name: "6주 완성 PHAT 변형 루틴 (평일 5일)",
    description:
      "상하체 파워와 3분할 근비대를 결합한 예시 프리셋입니다. 개인별 중량 정보가 없어 목표 중량은 비워 두었습니다. 본인에게 맞는 안전한 중량을 앱에서 입력하세요. 4주차는 반복 수를 낮춘 회복 주간 예시입니다.",
    duration_weeks: 6,
    days_per_week: 5,
    weight_unit: "kg",
    workouts: seedWorkouts.map((workout, dayIndex) => ({
      day_index: dayIndex + 1,
      day_name: workout.day_name,
      exercises: workout.exercises.map((exercise, exerciseIndex) => ({
        order: exerciseIndex + 1,
        name: exercise.name,
        target_muscle: exercise.target_muscle,
        rest_seconds: exercise.rest_seconds,
        weekly_progression: Array.from({ length: 6 }, (_, weekIndex) => {
          const week = weekIndex + 1;
          let setNo = 0;
          return {
            week,
            sets: exercise.sets.flatMap((group) =>
              Array.from({ length: group.count }, () => {
                setNo += 1;
                return {
                  set_no: setNo,
                  type: group.type,
                  target_weight: 0,
                  target_reps: week === 4 ? Math.max(1, Math.round(group.reps * 0.8)) : group.reps,
                };
              })
            ),
          };
        }),
      })),
    })),
  };
  return JSON.stringify(program, null, 2);
}
