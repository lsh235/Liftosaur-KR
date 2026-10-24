import {
  availableMuscles,
  IEquipment,
  IMuscle,
  IPlannerProgram,
  IPlannerProgramWeek,
  ISettings,
  IUnit,
} from "../types";
import { IExportedProgram, Program_evaluate, Program_getProgramDayUsedExercises } from "../models/program";
import { PlannerProgram_buildExportedProgram } from "../pages/planner/models/plannerProgram";
import { Settings_build } from "../models/settings";
import { UidFactory_generateUid } from "./generator";
import { IEither } from "./types";
import { Exercise_createCustomExercise, Exercise_findIdByName, Exercise_nameError } from "../models/exercise";
import type { IExerciseKind } from "../models/exercise";

const setTypes = ["WARMUP", "TOP", "BACKOFF", "STRAIGHT", "DROP"] as const;
type IAISetType = (typeof setTypes)[number];
const MAX_WORKOUTS = 7;
const MAX_EXERCISES_PER_WORKOUT = 100;
const MAX_WEEKLY_SETS_PER_EXERCISE = 100;
const MAX_TOTAL_SETS = 50000;

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

const equipmentNames: Record<string, IEquipment> = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  cable: "cable",
  smith: "smith",
  "smith machine": "smith",
  band: "band",
  "resistance band": "band",
  kettlebell: "kettlebell",
  bodyweight: "bodyweight",
  "body weight": "bodyweight",
  machine: "leverageMachine",
  "leverage machine": "leverageMachine",
  "medicine ball": "medicineball",
  "ez bar": "ezbar",
  "trap bar": "trapbar",
};

function normalizeExerciseLookupName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function getExerciseNameAndEquipment(name: string): {
  name: string;
  equipment?: IEquipment;
  hasUnsupportedQualifier?: boolean;
} {
  const commaIndex = name.lastIndexOf(",");
  if (commaIndex >= 0) {
    const baseName = name.slice(0, commaIndex).trim();
    const equipment = equipmentNames[normalizeExerciseLookupName(name.slice(commaIndex + 1))];
    return equipment ? { name: baseName, equipment } : { name: name.trim(), hasUnsupportedQualifier: true };
  }

  const normalizedName = normalizeExerciseLookupName(name);
  const paddedName = ` ${normalizedName} `;
  const equipmentName = Object.keys(equipmentNames)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => paddedName.includes(` ${candidate} `));
  return { name: name.trim(), equipment: equipmentName ? equipmentNames[equipmentName] : undefined };
}

const targetMuscleAliases: Record<string, IMuscle[]> = {
  chest: ["Pectoralis Major Clavicular Head", "Pectoralis Major Sternal Head"],
  pectorals: ["Pectoralis Major Clavicular Head", "Pectoralis Major Sternal Head"],
  back: ["Latissimus Dorsi", "Trapezius Lower Fibers", "Trapezius Middle Fibers"],
  shoulders: ["Deltoid Anterior", "Deltoid Lateral", "Deltoid Posterior"],
  deltoids: ["Deltoid Anterior", "Deltoid Lateral", "Deltoid Posterior"],
  biceps: ["Biceps Brachii", "Brachialis"],
  triceps: ["Triceps Brachii"],
  arms: ["Biceps Brachii", "Brachialis", "Triceps Brachii"],
  legs: ["Quadriceps", "Hamstrings", "Gluteus Maximus", "Gastrocnemius", "Soleus"],
  quads: ["Quadriceps"],
  quadriceps: ["Quadriceps"],
  hamstrings: ["Hamstrings"],
  glutes: ["Gluteus Maximus", "Gluteus Medius"],
  calves: ["Gastrocnemius", "Soleus"],
  core: ["Rectus Abdominis", "Obliques"],
  abs: ["Rectus Abdominis", "Obliques"],
  전완: ["Brachioradialis", "Wrist Flexors", "Wrist Extensors"],
  어깨: ["Deltoid Anterior", "Deltoid Lateral", "Deltoid Posterior"],
  가슴: ["Pectoralis Major Clavicular Head", "Pectoralis Major Sternal Head"],
  등: ["Latissimus Dorsi", "Trapezius Lower Fibers", "Trapezius Middle Fibers"],
  이두: ["Biceps Brachii", "Brachialis"],
  삼두: ["Triceps Brachii"],
  하체: ["Quadriceps", "Hamstrings", "Gluteus Maximus", "Gastrocnemius", "Soleus"],
  대퇴사두근: ["Quadriceps"],
  햄스트링: ["Hamstrings"],
  둔근: ["Gluteus Maximus", "Gluteus Medius"],
  종아리: ["Gastrocnemius", "Soleus"],
  복근: ["Rectus Abdominis", "Obliques"],
};

function getTargetMuscles(targetMuscle?: string): IMuscle[] {
  if (!targetMuscle) {
    return [];
  }
  const normalized = normalizeExerciseLookupName(targetMuscle);
  const exact = availableMuscles.find((muscle) => normalizeExerciseLookupName(muscle) === normalized);
  return exact ? [exact] : targetMuscleAliases[normalized] || [];
}

function getExerciseKinds(name: string, targetMuscle?: string): IExerciseKind[] {
  const description = `${name} ${targetMuscle || ""}`.toLowerCase();
  const kinds = new Set<IExerciseKind>();
  if (/(chest|shoulder|tricep|bicep|back|arm|가슴|어깨|등|팔|이두|삼두)/.test(description)) {
    kinds.add("upper");
  }
  if (/(chest|shoulder|tricep|가슴|어깨|삼두)/.test(description)) {
    kinds.add("push");
  }
  if (/(back|bicep|forearm|등|이두|전완)/.test(description)) {
    kinds.add("pull");
  }
  if (/(leg|quad|hamstring|glute|calf|하체|대퇴|햄스트링|둔근|종아리)/.test(description)) {
    kinds.add("lower");
    kinds.add("legs");
  }
  if (/(abs|abdominal|core|복근|복부)/.test(description)) {
    kinds.add("core");
  }
  return [...kinds];
}

function addUnknownExercisesAsCustom(input: IAIProgram, settings: ISettings): ISettings {
  let nextSettings = settings;
  for (const workout of input.workouts) {
    for (const exercise of workout.exercises) {
      const parsedName = getExerciseNameAndEquipment(exercise.name);
      if (Exercise_findIdByName(parsedName.name, nextSettings.exercises) != null) {
        continue;
      }
      const customExercise = Exercise_createCustomExercise(
        parsedName.name,
        getTargetMuscles(exercise.target_muscle),
        [],
        getExerciseKinds(exercise.name, exercise.target_muscle)
      );
      customExercise.defaultEquipment = parsedName.equipment;
      nextSettings = {
        ...nextSettings,
        exercises: { ...nextSettings.exercises, [customExercise.id]: customExercise },
      };
    }
  }
  return nextSettings;
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
  if (options.plannerName && /[\n\r\t/#{}()[\]|!:]/.test(result)) {
    errors.push(pathLabel(path + "." + key) + " 값에 Liftosaur 구분 문자는 사용할 수 없습니다.");
  }
  if (options.plannerName && Exercise_nameError(result)) {
    errors.push(pathLabel(path + "." + key) + " 값에 Liftosaur 운동 이름으로 사용할 수 없는 문자가 있습니다.");
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
  let valid = true;
  if (options.integer && !Number.isInteger(value)) {
    errors.push(pathLabel(path + "." + key) + " 값은 정수여야 합니다.");
    valid = false;
  }
  if (options.min != null && value < options.min) {
    errors.push(pathLabel(path + "." + key) + " 값은 " + options.min + " 이상이어야 합니다.");
    valid = false;
  }
  if (options.max != null && value > options.max) {
    errors.push(pathLabel(path + "." + key) + " 값은 " + options.max + " 이하여야 합니다.");
    valid = false;
  }
  return valid ? value : undefined;
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
  if (rawWorkouts.length > MAX_WORKOUTS) {
    return { errors: [`workouts는 최대 ${MAX_WORKOUTS}개까지 입력할 수 있습니다.`] };
  }
  const workouts: IAIWorkout[] = [];
  const dayIndexes = new Set<number>();
  let totalSetCount = 0;
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
    if (rawExercises.length > MAX_EXERCISES_PER_WORKOUT) {
      errors.push(pathLabel(path + ".exercises") + `에는 최대 ${MAX_EXERCISES_PER_WORKOUT}개 운동만 넣을 수 있습니다.`);
      continue;
    }
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
      if (exerciseName) {
        const parsedName = getExerciseNameAndEquipment(exerciseName);
        if (parsedName.hasUnsupportedQualifier) {
          errors.push(pathLabel(exercisePath + ".name") + " 뒤에 쉼표를 쓰면 지원하는 기구 이름을 적어야 합니다.");
        } else if (!parsedName.name) {
          errors.push(pathLabel(exercisePath + ".name") + "에 운동 이름이 없습니다.");
        }
      }
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
      if (rawWeeks.length > 52) {
        errors.push(pathLabel(exercisePath + ".weekly_progression") + "에는 최대 52주까지만 입력할 수 있습니다.");
        continue;
      }
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
        if (rawSets.length > MAX_WEEKLY_SETS_PER_EXERCISE) {
          errors.push(
            pathLabel(progressionPath + ".sets") +
              `에는 한 주에 최대 ${MAX_WEEKLY_SETS_PER_EXERCISE}세트까지 입력할 수 있습니다.`
          );
          continue;
        }
        totalSetCount += rawSets.length;
        if (totalSetCount > MAX_TOTAL_SETS) {
          return { errors: [`운동 계획 전체 세트 수는 최대 ${MAX_TOTAL_SETS}개까지 입력할 수 있습니다.`] };
        }
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
      const isUnloadedBodyweight = getExerciseNameAndEquipment(exercise.name).equipment === "bodyweight";
      const weight =
        set.target_weight === 0 && !isUnloadedBodyweight ? "?+" : Number(set.target_weight.toFixed(3)) + unit;
      const rest = " " + exercise.rest_seconds + "s";
      return "1x" + set.target_reps + " (" + set.type + ") " + weight + rest;
    });
  const warmupGroups = new Map<string, { count: number; reps: number; weight?: number }>();
  for (const set of warmups) {
    const targetWeight = set.target_weight > 0 ? set.target_weight : undefined;
    const key = set.target_reps + ":" + (targetWeight ?? "");
    const group = warmupGroups.get(key) || { count: 0, reps: set.target_reps, weight: targetWeight };
    group.count += 1;
    warmupGroups.set(key, group);
  }
  const warmupText = [...warmupGroups.values()]
    .map((set) => {
      const weight = set.weight == null ? "" : " " + Number(set.weight.toFixed(3)) + unit;
      return set.count + "x" + set.reps + weight;
    })
    .join(", ");
  const workSection = workSets.length > 0 ? " / " + workSets.join(", ") : "";
  const warmupSection = warmupText ? " / warmup: " + warmupText : "";
  const muscleNote = exercise.target_muscle ? "\n/// 목표 근육: " + exercise.target_muscle.replace(/[\r\n]/g, " ") : "";
  return exercise.name + workSection + warmupSection + muscleNote;
}

function buildProgram(input: IAIProgram, settings?: ISettings): IOutcome {
  const unit = input.weight_unit || "kg";
  const programSettings = addUnknownExercisesAsCustom(input, settings || Settings_build(unit));
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
    const exported = PlannerProgram_buildExportedProgram(UidFactory_generateUid(8), planner, programSettings);
    exported.program.name = input.program_name;
    exported.program.description = input.description || "AI에서 가져온 운동 루틴";
    exported.program.isMultiweek = input.duration_weeks > 1;
    const evaluatedProgram = Program_evaluate(exported.program, programSettings);
    const missingExercises: string[] = [];
    for (let weekIndex = 0; weekIndex < input.duration_weeks; weekIndex += 1) {
      for (const [dayIndex, workout] of input.workouts.entries()) {
        const evaluatedDay = evaluatedProgram.weeks[weekIndex]?.days[dayIndex];
        const evaluatedExerciseCount = evaluatedDay ? Program_getProgramDayUsedExercises(evaluatedDay).length : 0;
        if (evaluatedExerciseCount !== workout.exercises.length) {
          missingExercises.push(
            `${weekIndex + 1}주차 ${workout.day_name}: ${evaluatedExerciseCount}/${workout.exercises.length}개`
          );
        }
      }
    }
    if (evaluatedProgram.errors.length > 0 || missingExercises.length > 0) {
      const details = evaluatedProgram.errors.slice(0, 3).map((error) => error.error.message);
      return {
        kind: "error",
        errors: [
          "운동 이름이나 계획 형식을 해석하지 못해 일부 종목이 누락되었습니다. 운동 이름과 기구 표기를 확인하세요.",
          ...details,
          ...missingExercises.slice(0, 3),
        ],
      };
    }
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
  if (
    !isRecord(value) ||
    !("program_name" in value || "duration_weeks" in value || "days_per_week" in value || "workouts" in value)
  ) {
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
  let afterQuote = false;
  const text = contents.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        cell += char;
      }
    } else if (afterQuote && char === ",") {
      row.push(cell);
      cell = "";
      afterQuote = false;
    } else if (afterQuote && (char === "\n" || char === "\r")) {
      row.push(cell);
      if (row.some((item) => item.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      afterQuote = false;
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
    } else if (afterQuote) {
      return { error: "CSV 파일의 닫는 따옴표 뒤에는 쉼표나 줄바꿈만 올 수 있습니다." };
    } else if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === '"') {
      return { error: "CSV 파일에서 따옴표로 묶이지 않은 필드 안에는 따옴표를 쓸 수 없습니다." };
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
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
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseCsv(contents: string, settings?: ISettings): IOutcome {
  const parsed = parseCsvRows(contents);
  if (parsed.error) {
    return { kind: "error", errors: [parsed.error] };
  }
  const rows = parsed.rows || [];
  if (rows.length === 0) {
    return { kind: "not-ai" };
  }
  const headers = rows[0].map(normalizeHeader);
  const indexes: Record<string, number> = {};
  let recognizedHeaderCount = 0;
  for (const [field, aliases] of Object.entries(csvAliases)) {
    const matchingIndexes = headers.flatMap((header, index) =>
      aliases.some((alias) => normalizeHeader(alias) === header) ? [index] : []
    );
    if (matchingIndexes.length > 1) {
      return { kind: "error", errors: ["CSV 헤더에 " + field + " 열이 여러 번 있습니다."] };
    }
    if (matchingIndexes.length === 1) {
      indexes[field] = matchingIndexes[0];
      recognizedHeaderCount += 1;
    }
  }
  if (recognizedHeaderCount === 0) {
    return { kind: "not-ai" };
  }
  if (rows.length < 2) {
    return { kind: "error", errors: ["CSV에 운동 세트 데이터 행이 없습니다."] };
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
  const data: Record<string, unknown> = {};
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
  const metadataNumber = (field: string): number => {
    const value = metadata.get(field);
    return value == null ? NaN : Number(value);
  };
  data.program_name = metadata.get("program_name") || "";
  data.duration_weeks = metadataNumber("duration_weeks");
  data.days_per_week = metadataNumber("days_per_week");
  data.weight_unit = metadata.get("weight_unit") || undefined;
  data.workouts = [...workoutMap.values()].sort((a, b) => Number(a.day_index) - Number(b.day_index));
  const validation = validateProgram(data);
  if (validation.errors.length > 0 || !validation.program) {
    return { kind: "error", errors: validation.errors };
  }
  return buildProgram(validation.program, settings);
}

function unwrapMarkdownCodeFence(contents: string): { contents: string; wrapped: boolean } {
  const normalized = contents.replace(/^\uFEFF/, "");
  const trimmed = normalized.trim();
  const match = trimmed.match(/^```(?:json|csv)?(?:[ \t]*\r?\n|[ \t]+)([\s\S]*?)(?:\r?\n)?```$/i);
  return match ? { contents: match[1], wrapped: true } : { contents: normalized, wrapped: false };
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
  const unwrapped = unwrapMarkdownCodeFence(contents);
  if (!unwrapped.wrapped && unwrapped.contents.includes("```")) {
    return undefined;
  }
  const normalized = unwrapped.contents;
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
    "- 파일 크기는 UTF-8 기준 10MB 이하로 만들고, 하루 운동은 최대 100종목, 종목당 주간 세트는 최대 100개, 전체 루틴 세트는 최대 50,000개로 제한해.",
    "- weight_unit: kg 또는 lb. 생략하면 kg",
    "- workouts[]: day_index(1부터 시작), day_name, exercises[]",
    "- exercises[]: order, name, target_muscle, rest_seconds, weekly_progression[]",
    "- weekly_progression[]: week, sets[]",
    "- sets[]: set_no, type, target_weight, target_reps",
    "- type은 WARMUP, TOP, BACKOFF, STRAIGHT, DROP 중 하나",
    "- 중량은 weight_unit을 사용하고, 개인 중량을 모르면 target_weight를 0으로 둬. 앱에서 운동 중량을 입력하도록 처리한다.",
    "- 한 세트마다 고유한 set_no를 사용하고 목표 반복 수는 양의 정수로 적는다.",
    "- 주차별 과부하 계획을 weekly_progression에 실제 숫자로 표현해. 의도한 경우가 아니라면 모든 주차에 같은 목표를 복사하지 마.",
    "- target_weight에는 해당 주차의 절대 중량만 적어. 1RM이나 최근 기록이 없으면 백분율을 임의의 kg/lb 중량으로 바꾸지 말고 0을 사용해.",
    "- 실제 수행 결과에 따라 증량 여부가 달라지는 프로그램은 description에 정확한 유지·증량·반복 초기화 기준을 적어. 앱은 기록만으로 다음 주차 중량을 자동 변경하지 않아.",
    "- 예: PHAT 파워 운동은 3–5회 이중 진행을 쓸 수 있어. 모든 세트에서 5회를 달성하면 가능한 최소 단위로 증량하고 3회로 초기화하며, 목표를 못 채우면 중량과 반복 목표를 유지해.",
    "- 예: PHAT 근비대 운동은 정한 반복 범위의 아래쪽에서 시작해 반복 수를 올리고, 모든 세트에서 상단을 달성한 뒤 최소 단위로 증량하고 범위 아래쪽으로 초기화해.",
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

// Targets below preserve the user's supplied six-week routine. This is an editable
// example with explicit loads, not an individualized recommendation or automatic progression.
type ISixWeeks = [number, number, number, number, number, number];
interface ISeedSetGroup {
  type: IAISetType;
  reps: ISixWeeks;
  weights: ISixWeeks;
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

function seedExercise(
  name: string,
  target_muscle: string,
  rest_seconds: number,
  count: number,
  weights: ISixWeeks,
  reps: ISixWeeks
): ISeedExercise {
  return { name, target_muscle, rest_seconds, sets: [{ type: "STRAIGHT", count, weights, reps }] };
}

const seedWorkouts: ISeedWorkout[] = [
  {
    day_name: "월요일: 상체 파워",
    exercises: [
      {
        name: "Bench Press, Barbell",
        target_muscle: "가슴",
        rest_seconds: 180,
        sets: [
          { type: "TOP", count: 2, weights: [90, 90, 92.5, 92.5, 95, 95], reps: [4, 5, 4, 5, 4, 5] },
          { type: "BACKOFF", count: 3, weights: [80, 80, 82.5, 82.5, 85, 85], reps: [8, 9, 8, 9, 8, 9] },
        ],
      },
      {
        name: "Bent Over Row, Barbell",
        target_muscle: "등",
        rest_seconds: 180,
        sets: [
          { type: "TOP", count: 2, weights: [60, 60, 65, 65, 70, 70], reps: [5, 6, 5, 6, 5, 6] },
          { type: "BACKOFF", count: 3, weights: [50, 50, 55, 55, 60, 60], reps: [8, 9, 8, 9, 8, 9] },
        ],
      },
      seedExercise("Overhead Press, Barbell", "어깨", 150, 4, [37.5, 37.5, 40, 40, 42.5, 42.5], [6, 7, 6, 7, 5, 6]),
      seedExercise("Lat Pulldown, Cable", "등", 120, 3, [56, 56, 63, 63, 63, 70], [6, 8, 6, 7, 8, 6]),
      seedExercise("Bicep Curl, Barbell", "이두", 90, 3, [30, 30, 30, 32.5, 32.5, 35], [8, 9, 10, 8, 9, 8]),
      seedExercise("Skullcrusher, EZ Bar", "삼두", 90, 3, [30, 30, 30, 32.5, 32.5, 35], [8, 9, 10, 8, 9, 8]),
    ],
  },
  {
    day_name: "화요일: 하체 파워",
    exercises: [
      {
        name: "Squat, Barbell",
        target_muscle: "대퇴사두근",
        rest_seconds: 210,
        sets: [
          { type: "TOP", count: 2, weights: [100, 100, 105, 105, 110, 110], reps: [4, 5, 4, 5, 4, 5] },
          { type: "BACKOFF", count: 3, weights: [85, 85, 90, 90, 95, 95], reps: [8, 9, 8, 9, 8, 9] },
        ],
      },
      seedExercise("Romanian Deadlift, Barbell", "햄스트링", 150, 4, [80, 80, 85, 85, 90, 90], [6, 8, 6, 8, 6, 8]),
      seedExercise(
        "Leg Press, Leverage Machine",
        "대퇴사두근",
        120,
        3,
        [160, 160, 180, 180, 200, 200],
        [8, 10, 8, 10, 8, 10]
      ),
      seedExercise(
        "Lying Leg Curl, Leverage Machine",
        "햄스트링",
        90,
        3,
        [40, 40, 45, 45, 50, 50],
        [10, 12, 10, 12, 10, 12]
      ),
      seedExercise(
        "Standing Calf Raise, Leverage Machine",
        "종아리",
        90,
        4,
        [60, 60, 70, 70, 80, 80],
        [12, 15, 12, 15, 12, 15]
      ),
    ],
  },
  {
    day_name: "수요일: 당기기 근비대",
    exercises: [
      seedExercise("Lat Pulldown, Cable", "등", 120, 4, [48.9, 48.9, 48.9, 56, 56, 56], [10, 11, 12, 8, 9, 10]),
      seedExercise("Seated Row, Cable", "등", 120, 4, [48.9, 48.9, 48.9, 56, 56, 56], [10, 11, 12, 8, 9, 10]),
      seedExercise(
        "케이블 암 풀다운, Cable",
        "등",
        90,
        2,
        [23.75, 26.25, 26.25, 28.75, 28.75, 28.75],
        [15, 12, 15, 12, 14, 15]
      ),
      seedExercise("Reverse Fly, Leverage Machine", "어깨", 90, 4, [30, 30, 35, 35, 40, 40], [12, 15, 12, 15, 12, 15]),
      seedExercise("Incline Curl, Dumbbell", "이두", 90, 3, [12, 12, 14, 14, 14, 16], [10, 12, 10, 11, 12, 10]),
      seedExercise("Hammer Curl, Dumbbell", "이두", 90, 3, [12, 14, 14, 16, 16, 16], [12, 10, 12, 10, 11, 12]),
    ],
  },
  {
    day_name: "목요일: 밀기 근비대",
    exercises: [
      seedExercise("Incline Bench Press, Dumbbell", "가슴", 120, 4, [26, 28, 28, 30, 30, 32], [10, 8, 10, 8, 10, 8]),
      seedExercise("Chest Dip, Bodyweight", "가슴", 120, 4, [0, 0, 0, 0, 4, 4], [8, 9, 10, 12, 8, 10]),
      seedExercise("Chest Fly, Leverage Machine", "가슴", 90, 3, [40, 45, 45, 50, 50, 50], [12, 10, 12, 10, 11, 12]),
      seedExercise("Lateral Raise, Dumbbell", "어깨", 90, 4, [10, 10, 10, 12, 12, 12], [15, 18, 20, 12, 14, 15]),
      seedExercise(
        "Triceps Pushdown, Cable",
        "삼두",
        90,
        3,
        [21.25, 21.25, 23.75, 23.75, 26.25, 26.25],
        [12, 15, 12, 15, 12, 15]
      ),
      seedExercise(
        "Triceps Extension, Cable",
        "삼두",
        90,
        3,
        [21.25, 21.25, 26.25, 26.25, 28.75, 28.75],
        [12, 15, 12, 15, 12, 15]
      ),
    ],
  },
  {
    day_name: "금요일: 하체 근비대",
    exercises: [
      seedExercise(
        "Hack Squat, Leverage Machine",
        "대퇴사두근",
        150,
        4,
        [80, 80, 90, 90, 100, 100],
        [10, 12, 10, 12, 10, 12]
      ),
      seedExercise(
        "Bulgarian Split Squat, Dumbbell",
        "하체",
        120,
        3,
        [12, 12, 16, 16, 20, 20],
        [10, 12, 10, 12, 10, 12]
      ),
      seedExercise(
        "Leg Extension, Leverage Machine",
        "대퇴사두근",
        90,
        3,
        [45, 45, 50, 50, 55, 55],
        [12, 15, 12, 15, 12, 15]
      ),
      seedExercise(
        "Seated Leg Curl, Leverage Machine",
        "햄스트링",
        90,
        4,
        [40, 40, 45, 45, 50, 50],
        [12, 15, 12, 15, 12, 15]
      ),
      seedExercise(
        "Seated Calf Raise, Leverage Machine",
        "종아리",
        60,
        3,
        [40, 40, 45, 45, 50, 50],
        [15, 18, 15, 18, 15, 18]
      ),
      seedExercise("Hanging Leg Raise, Bodyweight", "복근", 60, 3, [0, 0, 0, 0, 0, 0], [15, 15, 18, 18, 20, 20]),
    ],
  },
];

export function AiWorkoutProgram_buildPhatSeedJson(): string {
  const program: IAIProgram = {
    program_name: "6주 완성 PHAT 변형 루틴 (평일 5일)",
    description:
      "사용자가 제공한 상·하체 파워(TOP/BACKOFF)와 3분할 근비대(STRAIGHT) 6주 30세션 예시입니다. 주차별 중량·반복·세트·휴식 시간을 원안대로 포함합니다. 개인 권장 중량이 아니므로 시작 전 본인 기록과 사용 기구에 맞게 조정하세요. 맨몸 종목의 0kg은 추가 중량 없음을 뜻합니다. 앱은 이 계획을 자동 증량하거나 4주차 회복 주간으로 변경하지 않습니다.",
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
          let setNo = 0;
          return {
            week: weekIndex + 1,
            sets: exercise.sets.flatMap((group) =>
              Array.from({ length: group.count }, () => ({
                set_no: ++setNo,
                type: group.type,
                target_weight: group.weights[weekIndex],
                target_reps: group.reps[weekIndex],
              }))
            ),
          };
        }),
      })),
    })),
  };
  return JSON.stringify(program, null, 2);
}
