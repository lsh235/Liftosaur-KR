import { IProgram, IProgramSchedule, IWorkoutScheduleReminder } from "../types";

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value + "T00:00:00Z");
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function ProgramSchedule_isValid(schedule: IProgramSchedule): boolean {
  const reminderTimeIsValid =
    schedule.reminderTime == null ||
    schedule.reminderTime === "" ||
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.reminderTime);
  return (
    isValidDateString(schedule.startDate) &&
    schedule.weekdays.length > 0 &&
    schedule.weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) &&
    new Set(schedule.weekdays).size === schedule.weekdays.length &&
    Number.isInteger(schedule.completedSessions) &&
    schedule.completedSessions >= 0 &&
    Number.isInteger(schedule.shiftCount) &&
    schedule.shiftCount >= 0 &&
    reminderTimeIsValid
  );
}

export function ProgramSchedule_sessionCount(program: IProgram): number {
  if (program.planner) {
    return program.planner.weeks.reduce((total, week) => total + week.days.length, 0);
  }
  if (program.weeks.length > 0) {
    return program.weeks.reduce((total, week) => total + week.days.length, 0);
  }
  return program.days.length;
}

function workoutDateAtSlot(schedule: IProgramSchedule, slotIndex: number): string | undefined {
  if (!ProgramSchedule_isValid(schedule) || !Number.isInteger(slotIndex) || slotIndex < 0) {
    return undefined;
  }
  const weekdays = new Set(schedule.weekdays);
  const start = new Date(schedule.startDate + "T00:00:00Z");
  let slot = 0;
  for (let dayOffset = 0; dayOffset < (slotIndex + 1) * 7; dayOffset += 1) {
    const date = new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const isoWeekday = ((date.getUTCDay() + 6) % 7) + 1;
    if (weekdays.has(isoWeekday)) {
      if (slot === slotIndex) {
        return date.toISOString().slice(0, 10);
      }
      slot += 1;
    }
  }
  return undefined;
}

export function ProgramSchedule_getSessionDate(
  schedule: IProgramSchedule,
  sessionIndex: number,
  totalSessions: number
): string | undefined {
  if (
    !Number.isInteger(sessionIndex) ||
    sessionIndex < 0 ||
    sessionIndex >= totalSessions ||
    !Number.isInteger(totalSessions) ||
    totalSessions < 0
  ) {
    return undefined;
  }
  const skippedSlots = sessionIndex >= schedule.completedSessions ? schedule.shiftCount : 0;
  return workoutDateAtSlot(schedule, sessionIndex + skippedSlots);
}

export function ProgramSchedule_getNextDate(schedule: IProgramSchedule, totalSessions: number): string | undefined {
  return ProgramSchedule_getSessionDate(schedule, schedule.completedSessions, totalSessions);
}

export function ProgramSchedule_getDueSessionCount(
  schedule: IProgramSchedule,
  totalSessions: number,
  throughDate: string
): number {
  let due = 0;
  for (let sessionIndex = 0; sessionIndex < totalSessions; sessionIndex += 1) {
    const date = ProgramSchedule_getSessionDate(schedule, sessionIndex, totalSessions);
    if (date != null && date <= throughDate) {
      due += 1;
    }
  }
  return due;
}

export function ProgramSchedule_completeSession(schedule: IProgramSchedule, totalSessions?: number): IProgramSchedule {
  return {
    ...schedule,
    completedSessions: Math.min(schedule.completedSessions + 1, totalSessions ?? Number.MAX_SAFE_INTEGER),
  };
}

export function ProgramSchedule_skipSession(schedule: IProgramSchedule, totalSessions: number): IProgramSchedule {
  if (ProgramSchedule_getNextDate(schedule, totalSessions) == null) {
    return schedule;
  }
  return { ...schedule, shiftCount: schedule.shiftCount + 1 };
}

export function ProgramSchedule_dateFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function ProgramSchedule_timestampFromDate(date: string): number {
  return new Date(date + "T12:00:00").getTime();
}

export function ProgramSchedule_today(now: number = Date.now()): string {
  return ProgramSchedule_dateFromTimestamp(now);
}

export function ProgramSchedule_build(
  startDate: string,
  weekdays: number[],
  completedSessions: number = 0,
  shiftCount: number = 0,
  reminderTime?: string
): IProgramSchedule {
  return {
    startDate,
    weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
    completedSessions,
    shiftCount,
    reminderTime,
  };
}

function sessionInfo(
  program: IProgram,
  sessionIndex: number
): { week: string; day: string; exercise: string; exerciseCount: number } {
  let dayIndex = 0;
  for (const week of program.planner?.weeks || []) {
    for (const day of week.days) {
      if (dayIndex === sessionIndex) {
        const exerciseLines = day.exerciseText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("///"));
        const exercise = exerciseLines[0]?.split(" / ")[0]?.trim() || "운동";
        return { week: week.name, day: day.name, exercise, exerciseCount: exerciseLines.length };
      }
      dayIndex += 1;
    }
  }

  const describeProgramDay = (
    dayId: string,
    weekName: string,
    fallbackDayName: string
  ): { week: string; day: string; exercise: string; exerciseCount: number } => {
    const day = program.days.find((candidate) => candidate.id === dayId);
    const exercises = (day?.exercises || [])
      .map((exerciseRef) => program.exercises.find((exercise) => exercise.id === exerciseRef.id))
      .filter((exercise) => exercise != null);
    return {
      week: weekName,
      day: day?.name || fallbackDayName,
      exercise: exercises[0]?.name || "운동",
      exerciseCount: exercises.length,
    };
  };

  dayIndex = 0;
  for (const week of program.weeks) {
    for (const dayRef of week.days) {
      if (dayIndex === sessionIndex) {
        return describeProgramDay(dayRef.id, week.name, String(sessionIndex + 1) + "일차");
      }
      dayIndex += 1;
    }
  }

  const day = program.days[sessionIndex];
  if (day) {
    return describeProgramDay(day.id, "운동", day.name);
  }
  return { week: "운동", day: String(sessionIndex + 1) + "일차", exercise: "운동", exerciseCount: 1 };
}

function timestampAtLocalDateAndTime(date: string, time: string): number | undefined {
  const dateParts = date.split("-").map(Number);
  const timeParts = time.split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length !== 2) {
    return undefined;
  }
  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  const timestamp = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
  return isNaN(timestamp) ? undefined : timestamp;
}

export function ProgramSchedule_buildReminderRequests(
  program: IProgram,
  now: number = Date.now()
): IWorkoutScheduleReminder[] {
  const schedule = program.schedule;
  if (!schedule?.reminderTime || !ProgramSchedule_isValid(schedule)) {
    return [];
  }
  const totalSessions = ProgramSchedule_sessionCount(program);
  const reminders: IWorkoutScheduleReminder[] = [];
  for (let sessionIndex = schedule.completedSessions; sessionIndex < totalSessions; sessionIndex += 1) {
    if (reminders.length >= 60) {
      break;
    }
    const date = ProgramSchedule_getSessionDate(schedule, sessionIndex, totalSessions);
    if (date == null) {
      continue;
    }
    const timestamp = timestampAtLocalDateAndTime(date, schedule.reminderTime);
    if (timestamp == null || timestamp <= now) {
      continue;
    }
    const info = sessionInfo(program, sessionIndex);
    const title = info.week + " · " + info.day;
    const body =
      info.exercise +
      (info.exerciseCount > 1 ? " 외 " + (info.exerciseCount - 1) + "종목" : "") +
      " 시작할 시간입니다!";
    reminders.push({ id: reminders.length, timestamp, title, body });
  }
  return reminders;
}
