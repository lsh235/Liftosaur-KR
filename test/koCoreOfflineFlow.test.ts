import "mocha";
import { expect } from "chai";
import { ImportExporter_getExportedProgram } from "../src/lib/importexporter";
import { Program_evaluate, Program_nextHistoryRecord } from "../src/models/program";
import { History_finishProgramDay } from "../src/models/history";
import { Storage_getDefault } from "../src/models/storage";
import { Stats_getEmpty } from "../src/models/stats";
import { Weight_build } from "../src/models/weight";
import {
  ProgramSchedule_build,
  ProgramSchedule_buildReminderRequests,
  ProgramSchedule_completeSession,
  ProgramSchedule_getNextDate,
  ProgramSchedule_skipSession,
} from "../src/models/programSchedule";
import { AiWorkoutProgram_buildPhatSeedJson } from "../src/utils/aiWorkoutProgram";
import { AiFeedbackExport_buildMarkdown } from "../src/utils/aiFeedbackExport";
import { IPersistenceStore, Persistence } from "../src/utils/persistence";

// Exercise the real import/model/persistence/export path with a process-independent
// in-memory backing store. This proves serialization, not native disk durability.
class OfflineStore implements IPersistenceStore {
  public data = new Map<string, string>();
  public async get(key: string): Promise<unknown> {
    return this.data.get(key);
  }
  public async getAllKeys(): Promise<string[]> {
    return [...this.data.keys()];
  }
  public async setMany(pairs: Array<[string, string | undefined]>): Promise<void> {
    for (const [key, value] of pairs) {
      if (value == null) {
        this.data.delete(key);
      } else {
        this.data.set(key, value);
      }
    }
  }
}

describe("Korean core offline flow", () => {
  it("imports, shifts, records, reopens persisted data and exports AI notes without calling a network client", async () => {
    const storage = Storage_getDefault();
    let networkCalls = 0;
    const noNetwork = (async () => {
      networkCalls += 1;
      throw new Error("Network is unavailable");
    }) as unknown as Window["fetch"];
    const imported = await ImportExporter_getExportedProgram(
      noNetwork,
      AiWorkoutProgram_buildPhatSeedJson(),
      storage.settings
    );
    expect(imported.success).to.equal(true);
    if (!imported.success) {
      throw new Error("offline import failed");
    }
    storage.settings = {
      ...storage.settings,
      units: "kg",
      exercises: { ...storage.settings.exercises, ...imported.data.customExercises },
    };
    const program = {
      ...imported.data.program,
      schedule: ProgramSchedule_build("2026-10-19", [1, 2, 3, 4, 5], 0, 0, "19:00"),
    };
    program.schedule = ProgramSchedule_completeSession(ProgramSchedule_skipSession(program.schedule, 30), 30);
    const workout = Program_nextHistoryRecord(program, storage.settings, Stats_getEmpty(), 1);
    workout.startTime = new Date(2026, 9, 20, 19).getTime();
    workout.endTime = workout.startTime + 3600000;
    workout.notes = "손목 불편감 기록";
    workout.entries[0].sets[0] = {
      ...workout.entries[0].sets[0],
      completedReps: 4,
      completedWeight: Weight_build(90, "kg"),
      completedRpe: 8,
      isCompleted: true,
    };
    storage.programs = [program];
    storage.currentProgramId = program.id;
    storage.history = [
      History_finishProgramDay(
        workout,
        storage.settings,
        1,
        Program_evaluate(program, storage.settings),
        Stats_getEmpty(),
        workout.endTime
      ),
    ];
    const backing = new OfflineStore();
    await new Persistence(backing, "sharded").save("offline-flow", { storage });
    const restored = (await new Persistence(backing, "sharded").load("offline-flow"))?.storage;
    expect(restored).to.exist;
    if (!restored) {
      throw new Error("offline restore failed");
    }
    expect(restored.programs[0].schedule?.completedSessionDates).to.eql({ "0": "2026-10-20" });
    expect(ProgramSchedule_getNextDate(restored.programs[0].schedule!, 30)).to.equal("2026-10-21");
    expect(restored.history[0].entries[0].sets[0].completedWeight).to.eql(Weight_build(90, "kg"));
    const reminders = ProgramSchedule_buildReminderRequests(restored.programs[0], new Date(2026, 9, 20, 21).getTime());
    expect(reminders[0].localDate).to.equal("2026-10-21");
    const markdown = AiFeedbackExport_buildMarkdown(
      restored.history,
      restored.settings,
      "다음 루틴은 어깨 볼륨 확대",
      new Date(2026, 9, 21, 12).getTime(),
      "수행 총평",
      restored.programs,
      program.id
    );
    expect(markdown).to.include("다음 루틴은 어깨 볼륨 확대");
    expect(markdown).to.include("손목 불편감 기록");
    expect(markdown).to.include("목표 90kg × 4회");
    expect(markdown).to.include("→ 실제 90kg × 4회 @RPE 8");
    expect(markdown).to.include("일정 밀림 횟수: 1회");
    expect(networkCalls).to.equal(0);
  });
});
