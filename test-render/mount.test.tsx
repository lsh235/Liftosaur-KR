import { screen } from "@testing-library/react-native";
import { Fixture_build } from "./harness/fixture";
import { IRenderApp, RenderApp_mount } from "./harness/renderApp";
import { IRenderEnv, RenderEnv_build } from "./harness/renderEnv";
import { DesiredHeartRateWorkout_fromProgress } from "../src/models/desiredHeartRateWorkout";
import { Progress_getCurrentProgress } from "../src/models/progress";
import { Subscriptions_hasSubscription } from "../src/utils/subscriptions";

describe("the real app mounts headlessly", () => {
  let app: IRenderApp;
  let rendered: IRenderEnv;
  let initialState: ReturnType<typeof Fixture_build>;

  beforeEach(async () => {
    rendered = RenderEnv_build();
    initialState = Fixture_build();
    app = await RenderApp_mount(initialState, rendered.env);
  });

  afterEach(async () => {
    await app.unmount();
  });

  it("lands on the workout screen with its rows and controls", () => {
    expect(rendered.env.getCurrentScreenData?.()?.name).toBe("progress");
    expect(screen.getAllByTestId("complete-set").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("set-nonstarted").length).toBeGreaterThan(0);
  });

  it("mirrors storage, initializes reminders and sends the desired heart-rate workout on mount", () => {
    const names = Array.from(new Set(rendered.bridges.log.names())).sort();
    expect(names).toEqual(
      ["mirroring.setDesiredWorkout", "timer.scheduleWorkoutReminders", "watch.sendStorageToWatch"].sort()
    );
    const desiredWorkoutCall = rendered.bridges.log.calls.find(
      (call) => call.bridge === "mirroring" && call.method === "setDesiredWorkout"
    );
    const reminderCall = rendered.bridges.log.calls.find(
      (call) => call.bridge === "timer" && call.method === "scheduleWorkoutReminders"
    );
    const expected = DesiredHeartRateWorkout_fromProgress(
      Progress_getCurrentProgress(initialState),
      Subscriptions_hasSubscription(initialState.storage.subscription)
    );
    expect(desiredWorkoutCall?.args).toEqual([expected]);
    expect(reminderCall?.args).toEqual([[]]);
  });
});
