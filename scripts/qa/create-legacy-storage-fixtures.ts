import * as fs from "fs";
import * as path from "path";
import { basicBeginnerProgram } from "../../src/programs/basicBeginnerProgram";
import { Program_nextHistoryRecord } from "../../src/models/program";
import { Reps_isCompletedSet } from "../../src/models/set";
import { Settings_build } from "../../src/models/settings";
import { Stats_getEmpty } from "../../src/models/stats";
import { Storage_get, Storage_getDefault } from "../../src/models/storage";
import { Weight_build } from "../../src/models/weight";
import { Tour_stepHelpFlag } from "../../src/components/tour/tourTypes";
import { IHistoryRecord, IProgram, IStorage } from "../../src/types";

function seenEveryTour(): string[] {
  // Keep in sync with the workout/program step IDs in tourConfigs. Importing
  // the JSX configs here would pull the React Native UI runtime into this
  // standalone Node fixture generator.
  const steps = {
    workout: [
      "howItWorks",
      "completingSets",
      "swipeSets",
      "whatIs1RM",
      "whatIsRPE",
      "equipment",
      "editingProgram",
      "progressionPreview",
    ],
    program: ["structure", "updates", "text", "liftoscript", "addExercise", "editExercise", "playground"],
  };
  return Object.entries(steps).flatMap(([tourId, stepIds]) =>
    stepIds.map((stepId) => Tour_stepHelpFlag(tourId, stepId))
  );
}

function stripPost158Fields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripPost158Fields);
  }
  if (value == null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "completedSessionDates")
      .map(([key, child]) => [key, stripPost158Fields(child)])
  );
}

function buildStorage(accountId: string, suffix: string, bodyweight: number): IStorage {
  const settings = Settings_build("kg");
  const planner = basicBeginnerProgram.planner;
  const firstWorkout = planner?.weeks[0]?.days[0];
  const originalRow = "Bent Over Row / 2x5, 1x5+ / 95lb";
  if (!planner || !firstWorkout?.exerciseText.includes(originalRow)) {
    throw new Error("Could not find the basic beginner first-workout row used by the legacy fixture");
  }
  const program: IProgram = {
    ...basicBeginnerProgram,
    name: `한국어 기록 보존 검증 ${suffix} - 장비와 운동 이름이 작은 화면에서 잘리는지 확인하기 위한 긴 루틴 제목`,
    // Keep the synthetic recorded 20 kg load at or above the programmed load.
    // Otherwise HistoryRecordSets correctly classifies it as an incomplete row.
    planner: {
      ...planner,
      weeks: planner.weeks.map((week, weekIndex) =>
        weekIndex !== 0
          ? week
          : {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex !== 0
                  ? day
                  : {
                      ...day,
                      exerciseText: day.exerciseText.replace(originalRow, "Bent Over Row / 2x5, 1x5+ / 20kg"),
                    }
              ),
            }
      ),
    },
  };
  const startTime = Date.parse("2026-10-20T09:30:00.000Z");
  const next = Program_nextHistoryRecord(program, settings, Stats_getEmpty(), 0);
  const record: IHistoryRecord = {
    ...next,
    id: startTime,
    vtype: "history_record",
    startTime,
    endTime: startTime + 42 * 60 * 1000,
    updatedAt: startTime + 42 * 60 * 1000,
    date: new Date(startTime).toISOString(),
    programName: program.name,
    entries: next.entries.map((entry, entryIndex) => ({
      ...entry,
      sets: entry.sets.map((set, setIndex) => ({
        ...set,
        isCompleted: setIndex < 2,
        ...(setIndex < 2
          ? {
              completedReps: 8,
              completedWeight: Weight_build(20 + entryIndex * 5, "kg"),
            }
          : {}),
      })),
    })),
  };
  if (!record.entries[0]?.sets.slice(0, 2).every(Reps_isCompletedSet)) {
    throw new Error("The first fixture history entry must contain two semantically completed sets");
  }

  const storage: IStorage = {
    ...Storage_getDefault(),
    tempUserId: accountId,
    currentProgramId: program.id,
    programs: [program],
    // Keep a separate in-progress workout so the emulator can open the workout
    // screen without relying on network-backed program import or UI timing.
    progress: [next],
    history: [record],
    stats: {
      ...Stats_getEmpty(),
      weight: {
        weight: [{ vtype: "stat", value: Weight_build(bodyweight, "kg"), timestamp: startTime }],
      },
    },
    settings: { ...settings, theme: "dark" },
    // Match test-render fixtures: the seeded first launch must reach app tabs
    // instead of opening onboarding or the hear-about-us survey over them.
    helps: seenEveryTour(),
    hearAboutUs: { done: true, requests: [] },
  };
  const compatible = stripPost158Fields(storage) as IStorage;
  const validated = Storage_get(compatible as unknown as Record<string, unknown>);
  if (!validated.success) {
    throw new Error(`Fixture ${accountId} is invalid for the current storage schema: ${validated.error.join("; ")}`);
  }
  return compatible;
}

const output = path.resolve(process.argv[2] ?? "qa-artifacts/legacy-fixtures");
fs.mkdirSync(output, { recursive: true });
const accounts = [
  { id: "qa-primary", suffix: "주계정", bodyweight: 68.4 },
  { id: "qa-secondary", suffix: "보조계정", bodyweight: 74.2 },
];
fs.writeFileSync(path.join(output, "current_account.json"), "qa-primary");
for (const account of accounts) {
  const storage = buildStorage(account.id, account.suffix, account.bodyweight);
  fs.writeFileSync(
    path.join(output, `liftosaur_${account.id}.json`),
    JSON.stringify({ storage }, null, 2)
  );
}
fs.writeFileSync(
  path.join(output, "fixture-manifest.json"),
  JSON.stringify(
    {
      provenance: "synthetic legacy fixture generated from current validated app models; not UI-created user data",
      primaryAccount: "qa-primary",
      secondaryAccount: "qa-secondary",
      programMarker: "한국어 기록 보존 검증 주계정",
      workoutStart: "2026-10-20T09:30:00.000Z",
      completedSetsPerExercise: 2,
      measurementsKg: { primary: 68.4, secondary: 74.2 },
      post158FieldRemoved: "completedSessionDates",
      onboarding: {
        completedTourHelpFlags: seenEveryTour().length,
        hearAboutUsDone: true,
      },
    },
    null,
    2
  )
);
