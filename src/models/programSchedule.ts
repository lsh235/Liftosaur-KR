import { IProgram, IProgramSchedule } from "../types";

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value + "T00:00:00Z");
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function ProgramSchedule_isValid(schedule: IProgramSchedule): boolean {
  return (
    isValidDateString(schedule.startDate) &&
    schedule.weekdays.length > 0 &&
    schedule.weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) &&
    new Set(schedule.weekdays).size === schedule.weekdays.length &&
    Number.isInteger(schedule.completedSessions) &&
    schedule.completedSessions >= 0 &&
    Number.isInteger(schedule.shiftCount) &&
    schedule.shiftCount >= 0
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

export function ProgramSchedule_completeSession(schedule: IProgramSchedule): IProgramSchedule {
  return { ...schedule, completedSessions: schedule.completedSessions + 1 };
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
  shiftCount: number = 0
): IProgramSchedule {
  return { startDate, weekdays: [...new Set(weekdays)].sort((a, b) => a - b), completedSessions, shiftCount };
}
