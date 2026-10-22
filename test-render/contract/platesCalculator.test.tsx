import { fireEvent, screen } from "@testing-library/react-native";
import { Fixture_build } from "../harness/fixture";
import { IRenderApp, RenderApp_mount } from "../harness/renderApp";
import { RenderEnv_build } from "../harness/renderEnv";
import { IState } from "../../src/models/state";

describe("workout plate calculator", () => {
  let app: IRenderApp;

  beforeEach(async () => {
    const state: IState = Fixture_build();
    state.storage.settings.workoutSettings.targetType = "platescalculator";
    const { env } = RenderEnv_build();
    app = await RenderApp_mount(state, env);
  });

  afterEach(async () => {
    await app.unmount();
  });

  it("opens the plate breakdown from a workout set and closes it", async () => {
    await app.press("plates-list");

    expect(screen.getByText("원판 계산기")).toBeTruthy();
    expect(screen.getByText(/목표 중량:/)).toBeTruthy();
    expect(screen.getByText(/한쪽에 끼울 원판 조합|기구 설정에 맞는 중량/)).toBeTruthy();

    await fireEvent.press(screen.getByText("닫기"));
    expect(screen.queryByText("원판 계산기")).toBeNull();
  });
});
