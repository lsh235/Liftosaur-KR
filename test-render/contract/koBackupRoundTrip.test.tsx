import { Alert } from "react-native";
import { ImportExporter_exportStorage } from "../../src/lib/importexporter";
import { reducer } from "../../src/ducks/reducer";
import { Thunk_importStorage } from "../../src/ducks/thunks";
import { IDispatch } from "../../src/ducks/types";
import { IEnv, IState } from "../../src/models/state";
import { Storage_getDefault } from "../../src/models/storage";
import { Program_nextHistoryRecord } from "../../src/models/program";
import { IStorage } from "../../src/types";
import { AiWorkoutProgram_buildPhatSeedJson, AiWorkoutProgram_tryImport } from "../../src/utils/aiWorkoutProgram";
import { Settings_build } from "../../src/models/settings";
import { Stats_getEmpty } from "../../src/models/stats";
import { Weight_build } from "../../src/models/weight";
import { Fixture_build } from "../harness/fixture";
import { Exporter_toFile } from "../../src/utils/exporter";

jest.mock("../../src/utils/exporter", () => ({ Exporter_toFile: jest.fn() }));

function buildBackupStorage(): IStorage {
  const settings = Settings_build("kg");
  const importedProgram = AiWorkoutProgram_tryImport(AiWorkoutProgram_buildPhatSeedJson(), settings);
  if (!importedProgram?.success) {
    throw new Error("The checked-in PHAT example could not be converted into a program fixture");
  }

  const program = {
    ...importedProgram.data.program,
    schedule: {
      startDate: "2026-10-05",
      weekdays: [1, 3, 5],
      completedSessions: 3,
      shiftCount: 2,
      completedSessionDates: {
        "0": "2026-10-05",
        "1": "2026-10-07",
        "2": "2026-10-09",
      },
    },
  };
  const storage = {
    ...Storage_getDefault(),
    tempUserId: "backup-round-trip-user",
    currentProgramId: program.id,
    settings,
    programs: [program],
  };
  const completed = Program_nextHistoryRecord(program, settings, Stats_getEmpty(), 0);
  completed.vtype = "history_record";
  completed.id = 21001;
  completed.endTime = completed.startTime + 45 * 60 * 1000;
  completed.notes = "완료 기록 메모";
  completed.entries[0].sets[0] = {
    ...completed.entries[0].sets[0],
    weight: Weight_build(48.9, "kg"),
    completedWeight: Weight_build(47.35, "kg"),
    completedReps: 7,
    isCompleted: true,
  };

  const ongoing = Program_nextHistoryRecord(program, settings, Stats_getEmpty(), 1);
  ongoing.id = 21002;
  ongoing.notes = "진행 중 기록 메모";
  ongoing.entries[0].sets[0] = {
    ...ongoing.entries[0].sets[0],
    weight: Weight_build(51.25, "kg"),
    completedWeight: Weight_build(50.75, "kg"),
    completedReps: 5,
    isCompleted: true,
  };
  storage.history = [completed];
  storage.progress = [ongoing];
  return storage;
}

function makeDispatch(initialStorage: ReturnType<typeof buildBackupStorage>): {
  dispatch: IDispatch;
  getState: () => IState;
} {
  let state: IState = { ...Fixture_build(), storage: initialStorage };
  const dispatch = (async (action: unknown): Promise<void> => {
    if (typeof action === "function") {
      // Ignore the analytics-only post-event thunk. The tested import thunk still
      // emits its real UpdateState action, which is applied by the production reducer.
      return;
    }
    state = reducer(state, action as never, []);
  }) as IDispatch;
  return { dispatch, getState: () => state };
}

describe("local JSON backup round trip", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it("exports through the real serializer and restores PHAT, weights, records, notes, and schedule state", async () => {
    const exportedStorage = buildBackupStorage();
    ImportExporter_exportStorage(exportedStorage);
    const exportCall = (Exporter_toFile as jest.Mock).mock.calls[0];
    expect(exportCall).toBeDefined();
    expect(exportCall[0]).toMatch(/^liftosaur-\d{4}-\d{2}-\d{2}\.json$/);
    const backupJson = exportCall[1] as string;
    const decoded = JSON.parse(backupJson) as typeof exportedStorage;
    expect(decoded.programs[0].name).toContain("PHAT");
    expect(JSON.stringify(exportedStorage.programs)).toContain("48.9");

    const originalStorage = Storage_getDefault();
    originalStorage.tempUserId = "existing-account-that-must-not-survive-success";
    const { dispatch, getState } = makeDispatch(originalStorage);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await Thunk_importStorage(backupJson)(dispatch, getState, {} as IEnv);

    const restored = getState().storage;
    expect(restored.tempUserId).toBe("backup-round-trip-user");
    expect(restored.programs).toEqual(exportedStorage.programs);
    expect(restored.programs[0].name).toContain("PHAT");
    expect(restored.programs[0].schedule).toEqual(exportedStorage.programs[0].schedule);
    expect(restored.programs[0].schedule?.shiftCount).toBe(2);
    expect(restored.programs[0].schedule?.completedSessionDates?.["2"]).toBe("2026-10-09");
    expect(restored.history).toHaveLength(1);
    expect(restored.history[0].notes).toBe("완료 기록 메모");
    expect(restored.history[0].entries[0].sets[0].weight).toEqual(Weight_build(48.9, "kg"));
    expect(restored.history[0].entries[0].sets[0].completedWeight).toEqual(Weight_build(47.35, "kg"));
    expect(restored.history[0].entries[0].sets[0].completedReps).toBe(7);
    expect(restored.progress).toHaveLength(1);
    expect(restored.progress[0].notes).toBe("진행 중 기록 메모");
    expect(restored.progress[0].entries[0].sets[0].weight).toEqual(Weight_build(51.25, "kg"));
    expect(restored.progress[0].entries[0].sets[0].completedWeight).toEqual(Weight_build(50.75, "kg"));
    expect(restored.progress[0].entries[0].sets[0].completedReps).toBe(5);
    expect(alert).toHaveBeenCalledWith("", "운동 데이터를 가져왔습니다.");
  });

  it("does not replace current storage when JSON is malformed or parses to a non-storage value", async () => {
    const originalStorage = Storage_getDefault();
    originalStorage.tempUserId = "preserved-current-account";
    const { dispatch, getState } = makeDispatch(originalStorage);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    // Storage_get logs caught migration failures for parseable non-storage shapes;
    // keep this focused regression output readable while asserting the actual contract.
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);

    const malformedProgram = JSON.parse(JSON.stringify(buildBackupStorage())) as IStorage;
    (malformedProgram.history[0].entries[0].sets[0] as unknown as { completedReps: unknown }).completedReps = "seven";
    const invalidInputs = [
      "{broken",
      "null",
      "[]",
      '"not a storage object"',
      "42",
      "{}",
      '{"programs":"invalid"}',
      JSON.stringify(malformedProgram),
    ];
    for (const raw of invalidInputs) {
      await expect(Thunk_importStorage(raw)(dispatch, getState, {} as IEnv)).resolves.toBeUndefined();
      expect(getState().storage).toBe(originalStorage);
    }

    expect(alert).toHaveBeenCalledTimes(invalidInputs.length);
    expect(alert.mock.calls[0]?.[1]).toContain("JSON을 읽을 수 없습니다");
    for (const call of alert.mock.calls.slice(1)) {
      expect(call[1]).toContain("운동 데이터를 가져오지 못했습니다. 오류:");
    }
  });
});
