import { act } from "@testing-library/react-native";
import { Fixture_build } from "../harness/fixture";
import { IRenderApp, RenderApp_mount } from "../harness/renderApp";
import { RenderEnv_build } from "../harness/renderEnv";
import { ProgramSchedule_build, ProgramSchedule_today } from "../../src/models/programSchedule";
import { IDispatch } from "../../src/ducks/types";
import { IState } from "../../src/models/state";
import { lb } from "lens-shmens";
import { updateState } from "../../src/models/state";
import { IWorkoutScheduleReminder } from "../../src/types";

describe("scheduled workout reminders", () => {
  let app: IRenderApp;
  let initialState: IState;
  let rendered: ReturnType<typeof RenderEnv_build>;

  beforeEach(async () => {
    initialState = Fixture_build();
    const program = initialState.storage.programs[0];
    if (!program?.planner) {
      throw new Error("Fixture program must have a planner");
    }
    program.schedule = ProgramSchedule_build(
      ProgramSchedule_today(Date.now() + 24 * 60 * 60 * 1000),
      [1, 2, 3, 4, 5, 6, 7],
      0,
      0,
      "19:00"
    );
    rendered = RenderEnv_build();
    app = await RenderApp_mount(initialState, rendered.env);
  });

  afterEach(async () => {
    await app.unmount();
  });

  it("rebuilds future reminders when the routine changes but its schedule stays the same", async () => {
    const initialProgram = initialState.storage.programs[0];
    const initialSchedule = initialProgram.schedule;
    const planner = initialProgram.planner!;
    const updatedPlanner = {
      ...planner,
      weeks: planner.weeks.map((week, weekIndex) =>
        weekIndex === 0
          ? {
              ...week,
              days: week.days.map((day, dayIndex) =>
                dayIndex === 0 ? { ...day, exerciseText: "Changed Bench Press / 1x5 / 20lb" } : day
              ),
            }
          : week
      ),
    };
    const dispatch = (globalThis as unknown as { debugDispatch?: IDispatch }).debugDispatch;
    if (dispatch == null) {
      throw new Error("Development dispatch is required by the render test harness");
    }

    await act(async () => {
      updateState(
        dispatch,
        [lb<IState>().p("storage").p("programs").findBy("id", initialProgram.id).p("planner").record(updatedPlanner)],
        "Update scheduled workout routine"
      );
    });
    await app.settle();

    const reminderCalls = rendered.bridges.log.calls.filter(
      (call) => call.bridge === "timer" && call.method === "scheduleWorkoutReminders"
    );
    expect(reminderCalls).toHaveLength(2);
    expect(initialState.storage.programs[0].schedule).toBe(initialSchedule);
    const updatedReminders = reminderCalls[1].args[0] as IWorkoutScheduleReminder[];
    expect(updatedReminders[0]?.body).toContain("Changed Bench Press");
  });
});
