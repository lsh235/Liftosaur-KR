import { cleanup, render, screen } from "@testing-library/react-native";
import { ScreenTimers } from "../../src/components/screenTimers";
import { IDispatch } from "../../src/ducks/types";

jest.mock("../../src/navigation/useNavOptions", () => ({ useNavOptions: () => {} }));

describe("Korean timer settings", () => {
  afterEach(() => cleanup());

  it("shows localized timer labels and units", async () => {
    await render(
      <ScreenTimers
        dispatch={jest.fn() as unknown as IDispatch}
        timers={{ warmup: 60, workout: 90, superset: 120, getReady: 10, reminder: 900 }}
        navCommon={{} as never}
      />
    );

    expect(screen.getByText("세트 간 휴식 시간")).toBeTruthy();
    expect(screen.getByText("워밍업 세트")).toBeTruthy();
    expect(screen.getByText("일반 세트")).toBeTruthy();
    expect(screen.getByText("슈퍼세트")).toBeTruthy();
    expect(screen.getByText("시간 지정 세트")).toBeTruthy();
    expect(screen.getByText("시작 전 준비 시간")).toBeTruthy();
    expect(screen.getByText("운동 알림")).toBeTruthy();
    expect(screen.getByText("운동 종료 확인 알림")).toBeTruthy();
    expect(screen.getAllByText("초")).toHaveLength(5);
    expect(screen.queryByText("Rest Timers between sets")).toBeNull();
    expect(screen.queryByText("Reminders")).toBeNull();
    expect(screen.queryByText("sec")).toBeNull();
  });
});
