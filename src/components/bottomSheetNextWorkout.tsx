import { JSX, useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./primitives/text";
import { IProgram, ISettings, IStats } from "../types";
import {
  emptyProgramId,
  Program_evaluate,
  Program_getProgramDay,
  Program_nextHistoryRecord,
  Program_isEmpty,
} from "../models/program";
import { HistoryRecordView } from "./historyRecord";
import { IDispatch } from "../ducks/types";
import { LinkButton } from "./linkButton";
import { IconSwap } from "./icons/iconSwap";
import { Tailwind_colors } from "../utils/tailwindConfig";
import { IconPlus2 } from "./icons/iconPlus2";
import { Thunk_setProgramSchedule, Thunk_skipProgramSchedule, Thunk_startProgramDay } from "../ducks/thunks";
import { navigateToModal } from "../navigation/navigationService";
import { DatePicker } from "./datePicker";
import { Button } from "./button";
import { TextInput } from "./primitives/textInput";
import {
  ProgramSchedule_getNextDate,
  ProgramSchedule_sessionCount,
  ProgramSchedule_timestampFromDate,
  ProgramSchedule_today,
} from "../models/programSchedule";

const weekdays: [number, string][] = [
  [1, "월"],
  [2, "화"],
  [3, "수"],
  [4, "목"],
  [5, "금"],
  [6, "토"],
  [7, "일"],
];
const supportsWorkoutNotifications = Platform.OS === "ios" || Platform.OS === "android";

export interface IBottomSheetNextWorkoutContentProps {
  currentProgram?: IProgram;
  allPrograms: IProgram[];
  settings: ISettings;
  stats: IStats;
  dispatch: IDispatch;
  onClose: () => void;
}

export function BottomSheetNextWorkoutContent(props: IBottomSheetNextWorkoutContentProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState(
    props.currentProgram?.schedule?.startDate ?? ProgramSchedule_today()
  );
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(
    props.currentProgram?.schedule?.weekdays ?? [1, 2, 3, 4, 5]
  );
  const [reminderTime, setReminderTime] = useState(props.currentProgram?.schedule?.reminderTime ?? "19:00");
  useEffect(() => {
    setScheduleStartDate(props.currentProgram?.schedule?.startDate ?? ProgramSchedule_today());
    setSelectedWeekdays(props.currentProgram?.schedule?.weekdays ?? [1, 2, 3, 4, 5]);
    setReminderTime(supportsWorkoutNotifications ? (props.currentProgram?.schedule?.reminderTime ?? "19:00") : "");
  }, [props.currentProgram?.id, props.currentProgram?.schedule]);
  const evaluatedProgram = props.currentProgram ? Program_evaluate(props.currentProgram, props.settings) : undefined;

  const programDay = evaluatedProgram ? Program_getProgramDay(evaluatedProgram, evaluatedProgram.nextDay) : undefined;
  const nextHistoryRecord = props.currentProgram
    ? Program_nextHistoryRecord(props.currentProgram, props.settings, props.stats)
    : undefined;

  const doesProgressNotMatchProgram =
    nextHistoryRecord &&
    (nextHistoryRecord.programId !== props.currentProgram?.id ||
      nextHistoryRecord.day !== props.currentProgram.nextDay);
  const totalSessions = props.currentProgram ? ProgramSchedule_sessionCount(props.currentProgram) : 0;
  const schedule = props.currentProgram?.schedule;
  const nextScheduleDate = schedule ? ProgramSchedule_getNextDate(schedule, totalSessions) : undefined;
  const canSkipScheduledWorkout = nextScheduleDate != null && nextScheduleDate <= ProgramSchedule_today();

  const toggleWeekday = (weekday: number): void => {
    setSelectedWeekdays((current) =>
      current.includes(weekday)
        ? current.length > 1
          ? current.filter((day) => day !== weekday)
          : current
        : current.concat(weekday).sort((a, b) => a - b)
    );
  };

  const saveSchedule = (): void => {
    if (props.currentProgram) {
      props.dispatch(
        Thunk_setProgramSchedule(
          props.currentProgram.id,
          scheduleStartDate,
          selectedWeekdays,
          supportsWorkoutNotifications ? reminderTime : undefined
        )
      );
      setIsEditingSchedule(false);
    }
  };

  return (
    <View>
      <Text className="pb-4 text-lg font-semibold text-center">새 운동</Text>
      {doesProgressNotMatchProgram && (
        <Text className="mb-1 text-xs text-center text-text-secondary">
          현재 진행 중인 운동이 있습니다. 완료한 뒤 선택한 프로그램이나 다른 운동일을 확인하세요.
        </Text>
      )}
      {Program_isEmpty(props.currentProgram) && (
        <Text className="mb-1 text-xs text-center text-text-secondary">선택된 프로그램이 없습니다.</Text>
      )}
      {programDay && nextHistoryRecord && (
        <HistoryRecordView
          historyRecord={nextHistoryRecord}
          programDay={programDay}
          isOngoing={false}
          settings={props.settings}
          dispatch={props.dispatch}
        />
      )}
      {props.currentProgram && !Program_isEmpty(props.currentProgram) && totalSessions > 0 && (
        <View className="mt-4 rounded-lg bg-background-subtle p-3">
          <Text className="pb-2 text-base font-semibold text-text-primary">운동 일정</Text>
          {schedule ? (
            <>
              <Text className="text-sm text-text-secondary">
                {nextScheduleDate ? "다음 운동 예정일: " + nextScheduleDate : "프로그램의 모든 세션을 완료했습니다."}
              </Text>
              <Text className="pt-1 text-xs text-text-secondary">
                완료 {schedule.completedSessions}/{totalSessions}회 · 일정 미루기 {schedule.shiftCount}회 · 운동 요일{" "}
                {schedule.weekdays.map((day) => weekdays.find(([number]) => number === day)?.[1]).join("·")} · 알림{" "}
                {schedule.reminderTime || "꺼짐"}
              </Text>
              <View className="mt-3 flex-row flex-wrap items-center gap-4">
                <LinkButton name="edit-workout-schedule" onClick={() => setIsEditingSchedule((value) => !value)}>
                  {isEditingSchedule ? "일정 설정 닫기" : "시작일·운동 요일 변경"}
                </LinkButton>
                <Button
                  name="skip-and-shift-schedule"
                  kind="lightgrayv3"
                  buttonSize="sm"
                  disabled={!canSkipScheduledWorkout}
                  onClick={() => props.dispatch(Thunk_skipProgramSchedule(props.currentProgram!.id))}
                >
                  현재 세션 미루기
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text className="text-sm text-text-secondary">
                운동 시작일과 요일을 정하면 휴식일을 건너뛰며 일정을 계산합니다.
              </Text>
              <View className="mt-2">
                <LinkButton name="configure-workout-schedule" onClick={() => setIsEditingSchedule(true)}>
                  일정 설정하기
                </LinkButton>
              </View>
            </>
          )}
          {isEditingSchedule && (
            <View className="mt-3 border-t border-background-default pt-3">
              <Text className="pb-1 text-sm text-text-secondary">시작일</Text>
              <DatePicker
                testID="workout-schedule-start-date"
                value={ProgramSchedule_timestampFromDate(scheduleStartDate)}
                onChange={(timestamp) => {
                  const date = new Date(timestamp);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  setScheduleStartDate(year + "-" + month + "-" + day);
                }}
              />
              <Text className="pb-2 pt-2 text-sm text-text-secondary">운동 요일</Text>
              <View className="flex-row flex-wrap gap-2">
                {weekdays.map(([weekday, label]) => {
                  const selected = selectedWeekdays.includes(weekday);
                  return (
                    <Pressable
                      key={weekday}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`h-9 w-9 items-center justify-center rounded-full ${selected ? "bg-button-primarybackground" : "bg-background-default"}`}
                      onPress={() => toggleWeekday(weekday)}
                    >
                      <Text
                        className={`text-sm font-semibold ${selected ? "text-text-alwayswhite" : "text-text-secondary"}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {supportsWorkoutNotifications && (
                <>
                  <Text className="pb-1 pt-3 text-sm text-text-secondary">운동 시간 알림 (iOS/Android)</Text>
                  <TextInput
                    accessibilityLabel="운동 알림 시간"
                    className="rounded bg-background-default px-3 py-2 text-text-primary"
                    value={reminderTime}
                    onChangeText={setReminderTime}
                    placeholder="19:00"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                  <Text className="pt-1 text-xs text-text-secondary">
                    HH:MM 형식으로 입력하세요. 비우면 알림이 꺼집니다.
                  </Text>
                </>
              )}
              <Button
                name="save-workout-schedule"
                kind="purple"
                buttonSize="md"
                className="mt-3"
                onClick={saveSchedule}
              >
                일정 저장
              </Button>
            </View>
          )}
        </View>
      )}
      <View
        className="flex-row flex-wrap justify-around pt-4 gap-x-3 gap-y-2 bg-background-default"
        style={{ paddingBottom: insets.bottom }}
      >
        <LinkButton
          name="change-next-day"
          data-testid="change-next-day"
          testID="change-next-day"
          onClick={() => navigateToModal("changeNextDayModal")}
        >
          <View className="flex-row items-center">
            <IconSwap color={Tailwind_colors().blue[400]} size={16} />
            <Text className="pl-1 text-sm font-bold underline text-text-link">다음 운동 선택</Text>
          </View>
        </LinkButton>
        <LinkButton
          name="start-empty-workout"
          data-testid="start-empty-workout"
          testID="start-empty-workout"
          onClick={() => {
            props.dispatch(Thunk_startProgramDay(emptyProgramId));
          }}
        >
          <View className="flex-row items-center">
            <IconPlus2 color={Tailwind_colors().blue[400]} size={16} />
            <Text className="pl-1 text-sm font-bold underline text-text-link">자유 운동</Text>
          </View>
        </LinkButton>
      </View>
    </View>
  );
}
