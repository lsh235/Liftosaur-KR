import { cleanup, render, screen } from "@testing-library/react-native";
import { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScreenFirst } from "../../src/components/screenFirst";
import { Screen1RM } from "../../src/components/screen1RM";
import { ScreenSetupEquipment, ScreenSetupPlates } from "../../src/components/screenSetupEquipment";
import { ScreenUnitSelector } from "../../src/components/screenUnitSelector";
import { Fixture_build } from "../harness/fixture";
import { IDispatch } from "../../src/ducks/types";
import { IState } from "../../src/models/state";
import { Stats_getEmpty } from "../../src/models/stats";

jest.mock("../../src/navigation/useNavOptions", () => ({ useNavOptions: () => {} }));
jest.mock("../../src/utils/imagePreloader", () => ({
  ImagePreloader_preload: jest.fn(),
  ImagePreloader_uri: (path: string) => path,
}));

async function renderOnboarding(child: ReactElement): Promise<void> {
  await render(<SafeAreaProvider>{child}</SafeAreaProvider>);
}

describe("Korean onboarding screens", () => {
  afterEach(() => cleanup());

  it("shows Korean welcome copy and account actions", async () => {
    await renderOnboarding(<ScreenFirst dispatch={jest.fn() as unknown as IDispatch} />);

    expect(screen.getByText("시작하기")).toBeTruthy();
    expect(screen.getByText("이미 계정이 있어요")).toBeTruthy();
    expect(screen.getByText(/원하는 운동 프로그램을 만들고 운동 진행 상황을 기록하세요/)).toBeTruthy();
  });

  it("shows Korean unit choices and setup guidance", async () => {
    const state: IState = Fixture_build();
    await renderOnboarding(
      <ScreenUnitSelector dispatch={jest.fn() as unknown as IDispatch} settings={state.storage.settings} />
    );

    expect(screen.getByText("중량 단위를 선택하세요")).toBeTruthy();
    expect(screen.getByText("파운드 (lb)")).toBeTruthy();
    expect(screen.getByText("킬로그램 (kg)")).toBeTruthy();
    expect(screen.getByText("계속")).toBeTruthy();
    expect(screen.queryByText("Pick your units")).toBeNull();
    expect(screen.queryByText("Pounds (lb)")).toBeNull();
    expect(screen.queryByText("Kilograms (kg)")).toBeNull();
  });

  it("shows Korean equipment choices and setup actions", async () => {
    const state: IState = Fixture_build();
    await renderOnboarding(
      <ScreenSetupEquipment
        dispatch={jest.fn() as unknown as IDispatch}
        settings={state.storage.settings}
        selectedGymId={state.storage.settings.currentGymId}
        stats={Stats_getEmpty()}
        navCommon={{} as never}
      />
    );

    expect(screen.getByText("사용할 수 있는 운동 기구를 선택하세요.")).toBeTruthy();
    expect(screen.getByText("건너뛰기")).toBeTruthy();
    expect(screen.getByText("원판 설정")).toBeTruthy();
    expect(screen.getByText("바벨")).toBeTruthy();
    expect(screen.queryByText("Barbell")).toBeNull();
  });

  it("shows Korean plate setup copy and equipment descriptions", async () => {
    const state: IState = Fixture_build();
    await renderOnboarding(
      <ScreenSetupPlates
        dispatch={jest.fn() as unknown as IDispatch}
        settings={state.storage.settings}
        stats={Stats_getEmpty()}
        navCommon={{} as never}
      />
    );

    expect(screen.getByText("바와 원판을 설정하세요.")).toBeTruthy();
    expect(screen.getByText("새 기구 종류 추가")).toBeTruthy();
    expect(screen.getByText("계속")).toBeTruthy();
    expect(screen.getAllByText(/중량 스택/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Weight stack|Fixed weights|Add New Equipment Type/)).toBeNull();
  });

  it("shows Korean 1RM setup guidance and controls", async () => {
    const state: IState = Fixture_build();
    const program = state.storage.programs[0];
    if (!program) {
      throw new Error("The fixture must include a program");
    }
    await renderOnboarding(
      <Screen1RM
        dispatch={jest.fn() as unknown as IDispatch}
        settings={state.storage.settings}
        program={program}
        navCommon={{} as never}
      />
    );

    expect(screen.getByText(/선택한 프로그램은/)).toBeTruthy();
    expect(screen.getByText(/N회 최대 중량/)).toBeTruthy();
    expect(screen.getByText(/첫 운동 중에 입력할 수 있습니다/)).toBeTruthy();
    expect(screen.getByText("1회 최대 중량")).toBeTruthy();
    expect(screen.getByText("계속")).toBeTruthy();
    expect(screen.queryByText("Set 1 Rep Maxes")).toBeNull();
    expect(screen.queryByText("Exercise")).toBeNull();
    expect(screen.queryByText("Continue")).toBeNull();
  });
});
