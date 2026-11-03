import { expect } from "chai";
import { IHistoryRecord, ISet } from "../src/types";
import { Weight_build } from "../src/models/weight";
import { WorkoutCoach_validateChanges, WorkoutCoach_version } from "../lambda/utils/workoutCoach";
import { CoachSession_checkAccess, CoachSession_getActive } from "../lambda/api/coachSession";
import { coachSessionTableNames, ICoachSession } from "../lambda/dao/coachSessionDao";
import { userTableNames } from "../lambda/dao/userDao";
import { UserRow_pack } from "../lambda/utils/userRow";
import { IPartialStorage } from "../src/types";
import { IDI } from "../lambda/utils/di";
import { WorkoutCoachVersion_get } from "../src/utils/workoutCoachVersion";
import { AiWorkoutCoachAdjustment_apply } from "../src/utils/aiWorkoutCoachAdjustment";
import { reducer } from "../src/ducks/reducer";

function makeSet(id: string, isCompleted: boolean, reps = 8, weight = 40): ISet {
  return {
    vtype: "set",
    id,
    index: 0,
    reps,
    weight: Weight_build(weight, "kg"),
    completedReps: isCompleted ? reps : undefined,
    completedWeight: isCompleted ? Weight_build(weight, "kg") : undefined,
    isCompleted,
  };
}

function progress(): IHistoryRecord {
  return {
    vtype: "history_record",
    id: 100,
    date: "2026-11-03",
    programId: "program-1",
    programName: "Test program",
    day: 1,
    dayName: "Push",
    startTime: 100,
    entries: [
      {
        vtype: "history_entry",
        id: "benchPress_barbell",
        index: 0,
        exercise: { id: "benchPress", equipment: "barbell" },
        sets: [makeSet("done", true), makeSet("current", false), makeSet("later", false)],
      },
    ],
    currentEntryIndex: 0,
  } as IHistoryRecord;
}

describe("WorkoutCoach active workout changes", () => {
  it("allows changes to future incomplete sets and records their original targets", () => {
    const result = WorkoutCoach_validateChanges(progress(), [{ setId: "later", reps: 6, weight: "35kg" }]);

    expect(result.success).to.equal(true);
    if (!result.success) return;
    expect(result.changes).to.eql([
      {
        setId: "later",
        reps: 6,
        weight: "35kg",
        before: { reps: 8, weight: "40kg", isCompleted: false },
      },
    ]);
  });

  it("rejects edits to completed sets and the currently selected set", () => {
    expect(WorkoutCoach_validateChanges(progress(), [{ setId: "done", reps: 5 }]).success).to.equal(false);
    expect(WorkoutCoach_validateChanges(progress(), [{ setId: "current", reps: 5 }]).success).to.equal(false);
  });

  it("rejects unknown, duplicate, empty, and invalid set changes", () => {
    expect(WorkoutCoach_validateChanges(progress(), [{ setId: "missing", reps: 5 }]).success).to.equal(false);
    expect(
      WorkoutCoach_validateChanges(progress(), [
        { setId: "later", reps: 5 },
        { setId: "later", reps: 4 },
      ]).success
    ).to.equal(false);
    expect(WorkoutCoach_validateChanges(progress(), [{ setId: "later" }]).success).to.equal(false);
    expect(WorkoutCoach_validateChanges(progress(), [{ setId: "later", reps: 0 }]).success).to.equal(false);
    expect(WorkoutCoach_validateChanges(progress(), [{ setId: "later", weight: "not-a-weight" }]).success).to.equal(false);
    expect(WorkoutCoach_validateChanges(progress(), [{ setId: "later", reps: 5, remove: true }]).success).to.equal(false);
  });

  it("ignores local presentation fields but changes when workout targets or completion state changes", () => {
    const first = progress();
    const same = progress();
    expect(WorkoutCoachVersion_get(first)).to.equal(WorkoutCoachVersion_get(same));
    same.ui = { nativeNotificationScheduled: true, forceUpdateEntryIndex: true, isExternal: true };
    same.ui.editModal = { programExerciseId: "local-only", entryIndex: 1 };
    same.timerSince = 123456;
    expect(WorkoutCoachVersion_get(first)).to.equal(WorkoutCoachVersion_get(same));

    same.entries[0].sets[2].reps = 10;
    expect(WorkoutCoachVersion_get(first)).not.to.equal(WorkoutCoachVersion_get(same));
    const completionChanged = progress();
    completionChanged.entries[0].sets[2].isCompleted = true;
    completionChanged.entries[0].sets[2].completedReps = 8;
    expect(WorkoutCoachVersion_get(first)).not.to.equal(WorkoutCoachVersion_get(completionChanged));
    const entryChanged = progress();
    entryChanged.currentEntryIndex = 1;
    expect(WorkoutCoachVersion_get(first)).not.to.equal(WorkoutCoachVersion_get(entryChanged));
  });
});

describe("AiWorkoutCoachAdjustment_apply", () => {
  it("applies an approved change only to a still-matching future set and preserves completed sets", () => {
    const current = progress();
    const completed = current.entries[0].sets[0];
    const result = AiWorkoutCoachAdjustment_apply(current, [
      {
        setId: "later",
        reps: 6,
        weight: "35kg",
        before: { reps: 8, weight: "40kg", isCompleted: false },
      },
    ]);

    expect("error" in result).to.equal(false);
    if ("error" in result) return;
    expect(result.progress.entries[0].sets[0]).to.equal(completed);
    expect(result.progress.entries[0].sets.map((set) => set.id)).to.eql(["done", "current", "later"]);
    expect(result.progress.entries[0].sets[2]).to.include({ reps: 6 });
    expect(result.progress.entries[0].sets[2].weight).to.eql(Weight_build(35, "kg"));
    expect(result.summary[0]).to.include("6회");
  });

  it("rejects a proposal if its target changed after it was queued or is now completed", () => {
    const changed = progress();
    changed.entries[0].sets[2].reps = 9;
    const proposal = [
      { setId: "later", reps: 6, before: { reps: 8, weight: "40kg", isCompleted: false } },
    ];
    expect(AiWorkoutCoachAdjustment_apply(changed, proposal)).to.have.property("error");

    const completed = progress();
    completed.entries[0].sets[2].isCompleted = true;
    expect(AiWorkoutCoachAdjustment_apply(completed, proposal)).to.have.property("error");
  });

  it("treats a missing local completion flag as the server's false value", () => {
    const local = progress();
    local.entries[0].sets[2].isCompleted = undefined;
    const result = AiWorkoutCoachAdjustment_apply(local, [
      {
        setId: "later",
        reps: 6,
        before: { reps: 8, weight: "40kg", isCompleted: false },
      },
    ]);
    expect("error" in result).to.equal(false);
  });
});

describe("ApplyWorkoutCoachAdjustment reducer action", () => {
  it("updates the active storage record while leaving a separately selected history record untouched", () => {
    const activeWorkout = progress();
    const selectedHistoryRecord = { ...progress(), id: 200, programName: "Selected history" } as IHistoryRecord;
    const selectedBefore = JSON.parse(JSON.stringify(selectedHistoryRecord));
    const change = {
      setId: "later",
      reps: 6,
      before: { reps: 8, weight: "40kg", isCompleted: false },
    };
    const state = {
      storage: { progress: [activeWorkout] },
      progress: { 200: selectedHistoryRecord },
    } as any;

    const result = reducer(state, {
      type: "ApplyWorkoutCoachAdjustment",
      expectedVersion: WorkoutCoachVersion_get(activeWorkout),
      changes: [change],
    } as any, []);

    expect(result.storage.progress[0].entries[0].sets[2].reps).to.equal(6);
    expect(JSON.parse(JSON.stringify(result.progress[200]))).to.eql(selectedBefore);
    expect(result.storage.progress[0].id).to.equal(activeWorkout.id);
  });
});

describe("CoachSession_getActive access and expiry checks", () => {
  const ownerId = "owner-account";
  const otherId = "other-account";
  const now = Date.now();
  const sessionId = "opaque-session-identifier-123456";

  function fakeDi(session: ICoachSession, workout: IHistoryRecord): IDI {
    const user = {
      id: ownerId,
      email: "owner@example.test",
      createdAt: now - 1000,
      storage: { progress: [workout] } as IPartialStorage,
    };
    const packedUser = UserRow_pack(user as any);
    return {
      dynamo: {
        get: async (args: { tableName: string; key: Record<string, unknown> }) => {
          if (args.tableName === coachSessionTableNames.prod) return args.key.sessionId === sessionId ? session : undefined;
          if (args.tableName === userTableNames.prod.users) return args.key.id === ownerId ? packedUser : undefined;
          return undefined;
        },
      },
    } as unknown as IDI;
  }

  before(() => {
    (global as any).__ENV__ = "prod";
  });

  it("only returns an unexpired active session to its owning account", async () => {
    const session: ICoachSession = {
      sessionId,
      userId: ownerId,
      createdAt: now - 1000,
      expiresAt: now + 60_000,
      ttl: Math.floor((now + 60_000) / 1000),
      status: "active",
    };
    const di = fakeDi(session, progress());

    const result = await CoachSession_getActive(sessionId, ownerId, di);
    expect(result.success).to.equal(true);
    if (result.success) expect(result.version).to.equal(WorkoutCoach_version(progress()));

    const wrongAccount = await CoachSession_getActive(sessionId, otherId, di);
    expect(wrongAccount).to.include({ success: false, status: 404, code: "session_not_found" });

    const expired = await CoachSession_getActive(
      sessionId,
      ownerId,
      fakeDi({ ...session, expiresAt: now }, progress())
    );
    expect(expired).to.include({ success: false, status: 410, code: "session_expired" });
  });

  it("classifies closed, expired, and wrong-owner sessions as inaccessible", () => {
    const active: ICoachSession = {
      sessionId,
      userId: ownerId,
      createdAt: now - 1000,
      expiresAt: now + 60_000,
      ttl: Math.floor((now + 60_000) / 1000),
      status: "active",
    };
    expect(CoachSession_checkAccess(active, ownerId, now).ok).to.equal(true);
    expect(CoachSession_checkAccess({ ...active, status: "closed" }, ownerId, now)).to.have.nested.property(
      "response.statusCode",
      410
    );
    expect(CoachSession_checkAccess(active, otherId, now)).to.have.nested.property("response.statusCode", 404);
    expect(CoachSession_checkAccess(active, ownerId, active.expiresAt)).to.have.nested.property(
      "response.statusCode",
      410
    );
  });
});
