import { IWorkoutScheduleReminder } from "../types";

export interface IWorkoutReminderScheduleResult {
  scheduled: boolean;
  missingPermission?: string;
}

export interface IWorkoutReminderPermissionHandlers {
  onUnscheduled: (result: IWorkoutReminderScheduleResult) => void;
  onScheduled: () => void;
}

export function WorkoutReminderScheduler_buildPermissionHandlers(
  platform: string,
  showIosPermissionPrompt: () => void,
  reportUnscheduled: (result: IWorkoutReminderScheduleResult) => void
): IWorkoutReminderPermissionHandlers {
  let didShowIosPermissionPrompt = false;
  return {
    onUnscheduled: (result) => {
      if (platform === "ios" && result.missingPermission === "notifications") {
        if (!didShowIosPermissionPrompt) {
          didShowIosPermissionPrompt = true;
          showIosPermissionPrompt();
        }
      } else {
        reportUnscheduled(result);
      }
    },
    onScheduled: () => {
      didShowIosPermissionPrompt = false;
    },
  };
}

export class WorkoutReminderScheduler {
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly scheduleNative: (payload: string) => Promise<IWorkoutReminderScheduleResult>,
    private readonly onUnscheduled: (result: IWorkoutReminderScheduleResult) => void,
    private readonly onError: (error: unknown) => void,
    private readonly onScheduled: () => void = () => {}
  ) {}

  public schedule(reminders: IWorkoutScheduleReminder[]): Promise<void> {
    this.generation += 1;
    const generation = this.generation;
    const payload = JSON.stringify(reminders);
    const operation = this.queue.then(async () => {
      if (generation !== this.generation) {
        return;
      }

      try {
        const result = await this.scheduleNative(payload);
        if (generation === this.generation) {
          if (result.scheduled) {
            this.onScheduled();
          } else {
            this.onUnscheduled(result);
          }
        }
      } catch (error) {
        if (generation === this.generation) {
          this.onError(error);
        }
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
