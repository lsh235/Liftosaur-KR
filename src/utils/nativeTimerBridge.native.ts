import { Alert, Linking, Platform } from "react-native";
import NativeLiftosaurTimer from "../specs/NativeLiftosaurTimer";
import { IWorkoutScheduleReminder } from "../types";
import { INativeTimerStartParams, ITimerBridge } from "./timerBridge";
import { WorkoutReminderScheduler, WorkoutReminderScheduler_buildPermissionHandlers } from "./workoutReminderScheduler";

export type { INativeTimerStartParams } from "./timerBridge";

const workoutReminderPermissionHandlers = WorkoutReminderScheduler_buildPermissionHandlers(
  Platform.OS,
  () => {
    Alert.alert(
      "운동 알림 권한이 필요합니다",
      "iPhone 설정에서 Liftosaur 알림을 허용하면 예약한 운동 알림을 받을 수 있습니다.",
      [
        { text: "나중에", style: "cancel" },
        {
          text: "설정 열기",
          onPress: () => {
            Linking.openSettings().catch((error) => console.warn("Could not open notification settings", error));
          },
        },
      ]
    );
  },
  (result) => {
    console.warn("NativeLiftosaurTimer.scheduleWorkoutReminders was not scheduled", result.missingPermission);
  }
);

const workoutReminderScheduler = new WorkoutReminderScheduler(
  (payload) => NativeLiftosaurTimer.scheduleWorkoutReminders(payload),
  workoutReminderPermissionHandlers.onUnscheduled,
  (error) => console.warn("NativeLiftosaurTimer.scheduleWorkoutReminders failed", error),
  workoutReminderPermissionHandlers.onScheduled
);

export class TimerBridge implements ITimerBridge {
  private readonly scheduledHandlers = new Set<() => void>();

  public startTimer(params: INativeTimerStartParams): void {
    NativeLiftosaurTimer.startTimer(params)
      .then((result) => {
        if (result?.scheduled) {
          this.scheduledHandlers.forEach((h) => h());
        }
      })
      .catch((e) => {
        console.warn("NativeLiftosaurTimer.startTimer failed", e);
      });
  }

  public stopTimer(): void {
    NativeLiftosaurTimer.stopTimer().catch(() => {});
  }

  public playSound(volume: number, vibration: boolean, sound: string): boolean {
    NativeLiftosaurTimer.playSound(volume, vibration, sound).catch(() => {});
    return true;
  }

  public subscribeOnScheduled(handler: () => void): () => void {
    this.scheduledHandlers.add(handler);
    return () => {
      this.scheduledHandlers.delete(handler);
    };
  }

  public scheduleReminder(duration: number, title: string, body: string): void {
    NativeLiftosaurTimer.scheduleReminder(duration, title, body).catch(() => {});
  }

  public cancelReminder(): void {
    NativeLiftosaurTimer.cancelReminder().catch(() => {});
  }

  public scheduleWorkoutReminders(reminders: IWorkoutScheduleReminder[]): void {
    workoutReminderScheduler.schedule(reminders).catch(() => {});
  }
}
