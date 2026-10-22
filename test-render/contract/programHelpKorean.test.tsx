import { render, screen } from "@testing-library/react-native";
import { HelpEditProgramDaysList } from "../../src/components/help/helpEditProgramDaysList";
import { HelpEditProgramV2 } from "../../src/components/help/helpEditProgramV2";
import { HelpTimers } from "../../src/components/help/helpTimers";
import { HelpWorkout } from "../../src/components/help/helpWorkout";
import { ProgressStateChangesView } from "../../src/components/progressStateChanges";

describe("Korean workout and program help", () => {
  it("explains program editing and AI routine import in Korean", async () => {
    await render(<HelpEditProgramDaysList />);

    expect(screen.getByText("프로그램 편집")).toBeTruthy();
    expect(screen.getByText(/AI 운동 루틴 파일 가져오기/)).toBeTruthy();
    expect(screen.queryByText(/individual program file/)).toBeNull();
  });

  it("explains the program text editor without stray English copy", async () => {
    await render(<HelpEditProgramV2 />);

    expect(screen.getByText("프로그램 편집")).toBeTruthy();
    expect(screen.getByText(/Liftoscript/)).toBeTruthy();
    expect(screen.getByText(/주간 통계/)).toBeTruthy();
    expect(screen.queryByText("The ")).toBeNull();
  });

  it("describes foreground timers and permission-dependent background notifications", async () => {
    await render(<HelpTimers />);

    expect(screen.getByText("설정 - 타이머")).toBeTruthy();
    expect(screen.getByText(/앱이 백그라운드에 있으면/)).toBeTruthy();
    expect(screen.getByText(/Android 13 이상에서는 앱 알림 권한/)).toBeTruthy();
    expect(screen.getByText(/Android 12 이상에서는 정확한 시간에 알림/)).toBeTruthy();
    expect(screen.queryByText(/iOS.*지원하지 않/)).toBeNull();
  });

  it("explains workout recording and end-of-day progression in Korean", async () => {
    await render(<HelpWorkout />);

    expect(screen.getByText("운동 화면")).toBeTruthy();
    expect(screen.getByText(/운동 종료 스크립트/)).toBeTruthy();
    expect(screen.queryByText(/Workout screen/)).toBeNull();
  });

  it("renders progression changes and actions in Korean", async () => {
    await render(
      <ProgressStateChangesView
        diffVars={{ weight: "100kg" }}
        diffState={{ cycle: "2" }}
        onSuppressProgress={jest.fn()}
      />
    );

    expect(screen.getByText("운동 변수 변경")).toBeTruthy();
    expect(screen.getByText("프로그램 상태 변수 변경")).toBeTruthy();
    expect(screen.getByText("진행 변경 무시")).toBeTruthy();
    expect(screen.queryByText("Exercise Changes")).toBeNull();
    expect(screen.queryByText("Suppress")).toBeNull();
  });
});
