import "mocha";
import { expect } from "chai";
import { IWorkoutScheduleReminder } from "../src/types";
import {
  WorkoutReminderScheduler,
  WorkoutReminderScheduler_buildPermissionHandlers,
} from "../src/utils/workoutReminderScheduler";

function reminder(id: number): IWorkoutScheduleReminder {
  return {
    id,
    timestamp: 0,
    localDate: "2026-10-23",
    localTime: "19:00",
    title: `Workout ${id}`,
    body: `Routine ${id}`,
  };
}

describe("WorkoutReminderScheduler", () => {
  it("serializes native replacements and only runs the latest queued schedule", async () => {
    const calls: number[][] = [];
    let activeCalls = 0;
    let maximumActiveCalls = 0;
    let resolveFirst: ((result: { scheduled: boolean }) => void) | undefined;
    const scheduler = new WorkoutReminderScheduler(
      (payload) => {
        const ids = (JSON.parse(payload) as IWorkoutScheduleReminder[]).map(({ id }) => id);
        calls.push(ids);
        activeCalls += 1;
        maximumActiveCalls = Math.max(maximumActiveCalls, activeCalls);
        if (ids[0] === 1) {
          return new Promise<{ scheduled: boolean }>((resolve) => {
            resolveFirst = resolve;
          }).then((result) => {
            activeCalls -= 1;
            return result;
          });
        }
        activeCalls -= 1;
        return Promise.resolve({ scheduled: true });
      },
      () => {},
      () => {}
    );

    const first = scheduler.schedule([reminder(1)]);
    await Promise.resolve();
    expect(calls).to.eql([[1]]);

    const stale = scheduler.schedule([reminder(2)]);
    const latest = scheduler.schedule([reminder(3)]);
    expect(calls).to.eql([[1]]);

    resolveFirst?.({ scheduled: true });
    await Promise.all([first, stale, latest]);

    expect(calls).to.eql([[1], [3]]);
    expect(maximumActiveCalls).to.equal(1);
  });

  it("reports a failed result only when it belongs to the latest schedule", async () => {
    const unscheduled: string[] = [];
    const scheduler = new WorkoutReminderScheduler(
      async (payload) => ({ scheduled: false, missingPermission: payload }),
      (result) => unscheduled.push(result.missingPermission ?? "unknown"),
      () => {}
    );

    await Promise.all([scheduler.schedule([reminder(1)]), scheduler.schedule([reminder(2)])]);

    expect(unscheduled).to.eql([JSON.stringify([reminder(2)])]);
  });

  it("runs the scheduled callback only for the latest successful native replacement", async () => {
    let resolveFirst: ((result: { scheduled: boolean }) => void) | undefined;
    let scheduledCount = 0;
    const scheduler = new WorkoutReminderScheduler(
      (payload) => {
        const id = (JSON.parse(payload) as IWorkoutScheduleReminder[])[0]?.id;
        return id === 1
          ? new Promise<{ scheduled: boolean }>((resolve) => {
              resolveFirst = resolve;
            })
          : Promise.resolve({ scheduled: true });
      },
      () => {},
      () => {},
      () => {
        scheduledCount += 1;
      }
    );

    const first = scheduler.schedule([reminder(1)]);
    await Promise.resolve();
    const stale = scheduler.schedule([reminder(2)]);
    const latest = scheduler.schedule([reminder(3)]);
    resolveFirst?.({ scheduled: true });
    await Promise.all([first, stale, latest]);

    expect(scheduledCount).to.equal(1);
  });

  it("shows the iOS notification prompt once until a schedule succeeds", () => {
    let promptCount = 0;
    const reported: string[] = [];
    const handlers = WorkoutReminderScheduler_buildPermissionHandlers(
      "ios",
      () => {
        promptCount += 1;
      },
      (result) => reported.push(result.missingPermission ?? "unknown")
    );
    const denied = { scheduled: false, missingPermission: "notifications" };

    handlers.onUnscheduled(denied);
    handlers.onUnscheduled(denied);
    expect(promptCount).to.equal(1);

    handlers.onScheduled();
    handlers.onUnscheduled(denied);
    expect(promptCount).to.equal(2);

    handlers.onUnscheduled({ scheduled: false, missingPermission: "exactAlarm" });
    expect(reported).to.eql(["exactAlarm"]);
  });

  it("leaves Android notification permission guidance to the native alarm flow", () => {
    let promptCount = 0;
    const reported: string[] = [];
    const handlers = WorkoutReminderScheduler_buildPermissionHandlers(
      "android",
      () => {
        promptCount += 1;
      },
      (result) => reported.push(result.missingPermission ?? "unknown")
    );

    handlers.onUnscheduled({ scheduled: false, missingPermission: "notifications" });

    expect(promptCount).to.equal(0);
    expect(reported).to.eql(["notifications"]);
  });
});
