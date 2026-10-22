import { lb } from "lens-shmens";
import {
  equipmentName,
  IExercise,
  Exercise_targetMuscles,
  Exercise_synergistMuscles,
  Exercise_get,
  Exercise_similarRating,
  Exercise_targetMusclesGroups,
  Exercise_eq,
  Exercise_toKey,
  Exercise_fromKey,
  Exercise_fullName,
} from "../../models/exercise";
import {
  Muscle_getAvailableMuscleGroups,
  Muscle_getMusclesFromScreenMuscle,
  Muscle_getScreenMusclesFromMuscle,
  Muscle_getMuscleGroupName,
} from "../../models/muscle";
import {
  IAllCustomExercises,
  ICustomExercise,
  IExercisePickerFilters,
  IExercisePickerProgramExercise,
  IExercisePickerState,
  IExerciseType,
  IEquipment,
  IMuscle,
  IScreenMuscle,
  ISettings,
} from "../../types";
import { ObjectUtils_filter } from "../../utils/object";
import { SetUtils_containsAnyValues } from "../../utils/setUtils";
import { StringUtils_capitalize } from "../../utils/string";
import { ILensDispatch } from "../../utils/useLensReducer";
import { IEvaluatedProgram } from "../../models/program";
import { PP_iterate2 } from "../../models/pp";
import { CollectionUtils_sort } from "../../utils/collection";
import { Equipment_getCurrentGym } from "../../models/equipment";

export function ExercisePickerUtils_getSelectedMuscleGroupNames(
  selectedValues: IMuscle[],
  settings: ISettings
): string[] {
  const currentGroups = Muscle_getAvailableMuscleGroups(settings).filter((muscleGroup) => {
    const muscles = Muscle_getMusclesFromScreenMuscle(muscleGroup, settings);
    return muscles.length > 0 && muscles.every((muscle) => selectedValues.includes(muscle));
  });
  const currentMuscles = selectedValues.filter((muscle) => {
    const group = Muscle_getScreenMusclesFromMuscle(muscle, settings)?.[0];
    return group && !currentGroups.includes(group);
  });
  return [
    ...currentGroups.map((g) => ExercisePickerUtils_getMuscleGroupName(g, settings)),
    ...currentMuscles.map((muscle) => ExercisePickerUtils_getMuscleName(muscle)),
  ];
}

const exercisePickerMuscleGroupNames: Partial<Record<IScreenMuscle, string>> = {
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

const exercisePickerMuscleNames: Record<IMuscle, string> = {
  "Adductor Brevis": "짧은모음근",
  "Adductor Longus": "긴모음근",
  "Adductor Magnus": "큰모음근",
  "Biceps Brachii": "위팔두갈래근",
  Brachialis: "위팔근",
  Brachioradialis: "위팔노근",
  "Deltoid Anterior": "앞어깨세모근",
  "Deltoid Lateral": "가쪽어깨세모근",
  "Deltoid Posterior": "뒤어깨세모근",
  "Erector Spinae": "척추세움근",
  Gastrocnemius: "장딴지근",
  "Gluteus Maximus": "큰볼기근",
  "Gluteus Medius": "중간볼기근",
  Hamstrings: "햄스트링",
  Iliopsoas: "엉덩허리근",
  Infraspinatus: "가시아래근",
  "Latissimus Dorsi": "넓은등근",
  "Levator Scapulae": "어깨올림근",
  Obliques: "배빗근",
  Pectineous: "두덩근",
  "Pectoralis Major Clavicular Head": "큰가슴근 빗장부분",
  "Pectoralis Major Sternal Head": "큰가슴근 복장부분",
  Quadriceps: "넙다리네갈래근",
  "Rectus Abdominis": "배곧은근",
  Sartorius: "넙다리빗근",
  "Serratus Anterior": "앞톱니근",
  Soleus: "가자미근",
  Splenius: "널판근",
  Sternocleidomastoid: "목빗근",
  "Tensor Fasciae Latae": "넙다리근막긴장근",
  "Teres Major": "큰원근",
  "Teres Minor": "작은원근",
  "Tibialis Anterior": "앞정강근",
  "Trapezius Lower Fibers": "등세모근 아래섬유",
  "Trapezius Middle Fibers": "등세모근 중간섬유",
  "Trapezius Upper Fibers": "등세모근 위섬유",
  "Triceps Brachii": "위팔세갈래근",
  "Wrist Extensors": "손목폄근",
  "Wrist Flexors": "손목굽힘근",
};

export function ExercisePickerUtils_getMuscleGroupName(
  muscleGroup: IScreenMuscle | string,
  settings: ISettings
): string {
  return (
    settings.muscleGroups.data[muscleGroup]?.name ??
    exercisePickerMuscleGroupNames[muscleGroup as IScreenMuscle] ??
    Muscle_getMuscleGroupName(muscleGroup as IScreenMuscle, settings)
  );
}

export function ExercisePickerUtils_getMuscleName(muscle: IMuscle): string {
  return exercisePickerMuscleNames[muscle];
}

const exercisePickerEquipmentNames: Record<string, string> = {
  barbell: "바벨",
  cable: "케이블",
  dumbbell: "덤벨",
  smith: "스미스 머신",
  band: "밴드",
  kettlebell: "케틀벨",
  bodyweight: "맨몸",
  leverageMachine: "레버 머신",
  medicineball: "메디신볼",
  ezbar: "EZ바",
  trapbar: "트랩바",
};

const exercisePickerExerciseKindNames: Record<string, string> = {
  core: "코어",
  pull: "당기기",
  push: "밀기",
  legs: "하체",
  upper: "상체",
  lower: "하체",
};

export function ExercisePickerUtils_getEquipmentName(equipment: IEquipment): string {
  return exercisePickerEquipmentNames[equipment] ?? equipmentName(equipment);
}

export function ExercisePickerUtils_getExerciseKindName(kind: string): string {
  return exercisePickerExerciseKindNames[kind] ?? StringUtils_capitalize(kind);
}

export function ExercisePickerUtils_getAllFilterNames(filters: IExercisePickerFilters, settings: ISettings): string[] {
  return [
    ...(filters.equipment || []).map((f) => ExercisePickerUtils_getEquipmentName(f)),
    ...(filters.type || []).map((m) => ExercisePickerUtils_getExerciseKindName(m)),
    ...ExercisePickerUtils_getSelectedMuscleGroupNames(filters.muscles || [], settings),
  ];
}

export function ExercisePickerUtils_getAllFilters(filters: IExercisePickerFilters): string[] {
  return [...(filters.equipment || []), ...(filters.type || []), ...(filters.muscles || [])];
}

export function ExercisePickerUtils_getCustomFilters(filters: IExercisePickerFilters): string[] {
  return [...(filters.type || []), ...(filters.muscles || [])];
}

export function ExercisePickerUtils_filterExercises(
  exercises: IExercise[],
  filters: IExercisePickerFilters,
  settings: ISettings
): IExercise[] {
  const allFilters = ExercisePickerUtils_getAllFilters(filters);
  if (allFilters.length === 0 && settings.workoutSettings.shouldShowInvisibleEquipment) {
    return exercises;
  }
  const gymEquipment = Equipment_getCurrentGym(settings).equipment;
  return exercises.filter((exercise) => {
    if (!exercise) {
      return false;
    }
    if (
      !settings.workoutSettings.shouldShowInvisibleEquipment &&
      exercise.equipment &&
      gymEquipment[exercise.equipment]?.isDeleted
    ) {
      return false;
    }
    const typeSet = new Set(filters.type || []);
    const equipmentSet = new Set(filters.equipment || []);
    const musclesSet = new Set(filters.muscles || []);
    let result = true;
    if (typeSet.size > 0) {
      result = result && SetUtils_containsAnyValues(new Set(exercise.types), typeSet);
    }
    if (equipmentSet.size > 0) {
      result = result && SetUtils_containsAnyValues(new Set([exercise.equipment]), equipmentSet);
    }
    if (musclesSet.size > 0) {
      const muscles = new Set(
        Exercise_targetMuscles(exercise, settings).concat(Exercise_synergistMuscles(exercise, settings))
      );
      result = result && SetUtils_containsAnyValues(muscles, musclesSet);
    }
    return result;
  });
}

export function ExercisePickerUtils_getSelectedMuscleGroups(
  selectedValues: IMuscle[],
  settings: ISettings
): IScreenMuscle[] {
  return Muscle_getAvailableMuscleGroups(settings).filter((muscleGroup) => {
    const muscles = Muscle_getMusclesFromScreenMuscle(muscleGroup, settings);
    return muscles.every((muscle) => selectedValues.includes(muscle));
  });
}

export type IExercisePickerSortCtx = Pick<IExercisePickerState, "filters" | "sort" | "exerciseType">;

export function ExercisePickerUtils_sortExercises(
  exercises: IExercise[],
  settings: ISettings,
  ctx: IExercisePickerSortCtx
): IExercise[] {
  return CollectionUtils_sort(exercises, (a, b) => {
    return ExercisePickerUtils_getSortRating(a, b, settings, ctx);
  });
}

export function ExercisePickerUtils_sortCustomExercises(
  customExercises: ICustomExercise[],
  settings: ISettings,
  ctx: IExercisePickerSortCtx
): ICustomExercise[] {
  return CollectionUtils_sort(customExercises, (aE, bE) => {
    const a = Exercise_get(aE, settings.exercises);
    const b = Exercise_get(bE, settings.exercises);
    return ExercisePickerUtils_getSortRating(a, b, settings, ctx);
  });
}

export function ExercisePickerUtils_getSortRating(
  a: IExercise,
  b: IExercise,
  settings: ISettings,
  ctx: IExercisePickerSortCtx
): number {
  const filters = ctx.filters;
  const sort = ctx.sort;
  const currentExerciseType = ctx.exerciseType;
  const exerciseType = currentExerciseType;
  if (sort === "similar_muscles" && exerciseType) {
    const aRating = Exercise_similarRating(exerciseType, a, settings);
    const bRating = Exercise_similarRating(exerciseType, b, settings);
    return bRating - aRating;
  } else if ((filters.muscles || []).length > 0) {
    const filterMuscleGroups = ExercisePickerUtils_getSelectedMuscleGroups(filters.muscles || [], settings);
    const aTargetMuscleGroups = Exercise_targetMusclesGroups(a, settings);
    const bTargetMuscleGroups = Exercise_targetMusclesGroups(b, settings);
    if (
      aTargetMuscleGroups.some((m) => filterMuscleGroups.indexOf(m) !== -1) &&
      bTargetMuscleGroups.every((m) => filterMuscleGroups.indexOf(m) === -1)
    ) {
      return -1;
    } else if (
      bTargetMuscleGroups.some((m) => filterMuscleGroups.indexOf(m) !== -1) &&
      aTargetMuscleGroups.every((m) => filterMuscleGroups.indexOf(m) === -1)
    ) {
      return 1;
    } else {
      return a.name.localeCompare(b.name);
    }
  } else {
    return a.name.localeCompare(b.name);
  }
}

export function ExercisePickerUtils_filterCustomExercises(
  customExercises: IAllCustomExercises,
  filters: IExercisePickerFilters
): IAllCustomExercises {
  const allFilters = ExercisePickerUtils_getCustomFilters(filters);
  if (allFilters.length === 0) {
    return customExercises;
  }
  return ObjectUtils_filter(customExercises, (_id, exercise) => {
    if (!exercise) {
      return false;
    }
    const typesSet = new Set(filters.type || []);
    const musclesSet = new Set(filters.muscles || []);
    let result = true;
    if (typesSet.size > 0) {
      result = result && SetUtils_containsAnyValues(new Set(exercise.types), typesSet);
    }
    if (musclesSet.size > 0) {
      const muscles = new Set(exercise.meta.targetMuscles.concat(exercise.meta.synergistMuscles));
      result = result && SetUtils_containsAnyValues(muscles, musclesSet);
    }
    return result;
  });
}

export function ExercisePickerUtils_chooseProgramExercise(
  dispatch: ILensDispatch<IExercisePickerState>,
  exerciseType: IExerciseType,
  week: number,
  dayInWeek: number,
  ctx: IExercisePickerChooseCtx
): void {
  const isMultiselect = ExercisePickerUtils_getIsMultiselect(ctx);
  const isInExercises = ctx.selectedExercises.some((e) => {
    return (
      "exerciseType" in e &&
      Exercise_eq(e.exerciseType, exerciseType) &&
      (e.type === "adhoc" || e.week !== week || e.dayInWeek !== dayInWeek)
    );
  });
  if (isMultiselect && isInExercises) {
    return;
  }
  dispatch(
    lb<IExercisePickerState>()
      .p("selectedExercises")
      .recordModify((exercises) => {
        if (
          exercises.some(
            (e) =>
              "exerciseType" in e &&
              Exercise_eq(e.exerciseType, exerciseType) &&
              e.type === "program" &&
              e.week === week &&
              e.dayInWeek === dayInWeek
          )
        ) {
          return exercises.filter((e) => e.type !== "program" || !Exercise_eq(e.exerciseType, exerciseType));
        } else {
          if (isMultiselect) {
            return [...exercises, { type: "program", exerciseType, week, dayInWeek }];
          } else {
            return [{ type: "program", exerciseType, week, dayInWeek }];
          }
        }
      }),
    `Toggle selection of program exercise ${Exercise_toKey(exerciseType)}[${week}:${dayInWeek}]`
  );
}

export type IExercisePickerMultiselectCtx = Pick<IExercisePickerState, "mode" | "exerciseType">;
export type IExercisePickerChooseCtx = Pick<
  IExercisePickerState,
  "mode" | "exerciseType" | "selectedExercises" | "label"
>;

// An `exerciseType` means the picker was opened *about* one exercise — replacing it, duplicating it,
// swapping a variation — and all of those answer with exactly one exercise. Without one it was
// opened to add, and adding several at once is the same gesture repeated. That holds in a program
// as much as in a workout, which is why the mode no longer comes into it.
export function ExercisePickerUtils_getIsMultiselect(ctx: IExercisePickerMultiselectCtx): boolean {
  return !ctx.exerciseType;
}

export function ExercisePickerUtils_chooseAdhocExercise(
  dispatch: ILensDispatch<IExercisePickerState>,
  key: string,
  ctx: IExercisePickerChooseCtx
): void {
  const selectedExercises = ctx.selectedExercises;
  const isMultiselect = ExercisePickerUtils_getIsMultiselect(ctx);
  const exerciseType = Exercise_fromKey(key);
  const isInProgramExercises = selectedExercises.some(
    (e) => e.type === "program" && Exercise_eq(e.exerciseType, exerciseType)
  );
  if (isMultiselect && isInProgramExercises) {
    return;
  }
  dispatch(
    lb<IExercisePickerState>()
      .p("selectedExercises")
      .recordModify((exercises) => {
        if (isMultiselect && exercises.some((e) => e.type === "adhoc" && Exercise_eq(e.exerciseType, exerciseType))) {
          return exercises.filter((e) => e.type !== "adhoc" || !Exercise_eq(e.exerciseType, exerciseType));
        } else {
          if (isMultiselect) {
            return [...exercises, { type: "adhoc", exerciseType, label: ctx.label }];
          } else {
            return [{ type: "adhoc", exerciseType, label: ctx.label }];
          }
        }
      }),
    `Toggle selection of ${key}`
  );
}

export function ExercisePickerUtils_getProgramExercisefullName(
  exercise: IExercisePickerProgramExercise,
  program: IEvaluatedProgram,
  settings: ISettings
): string {
  const exerciseType = Exercise_get(exercise.exerciseType, settings.exercises);
  if (!exerciseType) {
    return "";
  }
  const name = Exercise_fullName(exerciseType, settings);
  let count = 0;
  PP_iterate2(program.weeks, (e) => {
    if (e.exerciseType && Exercise_eq(e.exerciseType, exercise.exerciseType)) {
      count += 1;
    }
    if (count > 1) {
      return true;
    }
    return false;
  });
  const isMultipleInstances = count > 1;
  const suffix = [];
  if (isMultipleInstances) {
    if (program.weeks.length > 1) {
      suffix.push(exercise.week);
    }
    suffix.push(exercise.dayInWeek);
  }
  return `${name}${isMultipleInstances ? `[${suffix.join(":")}]` : ""}`;
}
