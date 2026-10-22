import { render, screen } from "@testing-library/react-native";
import { HelpAccount } from "../../src/components/help/helpAccount";
import { HelpChooseProgram } from "../../src/components/help/helpChooseProgram";
import { HelpChooseProgramFirstTime } from "../../src/components/help/helpChooseProgramFirstTime";
import { HelpExerciseStats } from "../../src/components/help/helpExerciseStats";
import { HelpExercises } from "../../src/components/help/helpExercises";
import { HelpGraphs } from "../../src/components/help/helpGraphs";
import { HelpMeasurements } from "../../src/components/help/helpMeasurements";
import { HelpMuscles } from "../../src/components/help/helpMuscles";
import { HelpMusclesDay } from "../../src/components/help/helpMusclesDay";
import { HelpStats } from "../../src/components/help/helpStats";

const HELP_PAGES = [
  ["설정 - 계정", HelpAccount],
  ["프로그램 선택 및 복제", HelpChooseProgram],
  ["프로그램 선택", HelpChooseProgramFirstTime],
  ["운동 종목 기록", HelpExerciseStats],
  ["운동 종목", HelpExercises],
  ["그래프", HelpGraphs],
  ["측정 기록", HelpMeasurements],
  ["근육 지도 - 프로그램", HelpMuscles],
  ["근육 지도 - 운동일", HelpMusclesDay],
  ["측정값 추가", HelpStats],
] as const;

describe("Korean help pages", () => {
  for (const [heading, HelpPage] of HELP_PAGES) {
    it("renders the Korean heading for " + heading, async () => {
      await render(<HelpPage />);
      expect(screen.getByText(heading)).toBeTruthy();
    });
  }

  it("documents the login providers available on each mobile platform", async () => {
    await render(<HelpAccount />);

    expect(screen.getByText(/Apple로 로그인/)).toBeTruthy();
    expect(screen.getByText(/Google로 로그인/)).toBeTruthy();
    expect(screen.queryByText(/only support.*Google/)).toBeNull();
  });

  it("describes the exercise list as a searchable list of workout exercises", async () => {
    await render(<HelpExercises />);

    expect(screen.getByText(/현재 프로그램과 운동 기록/)).toBeTruthy();
    expect(screen.getByText(/근육 그룹으로 목록을 필터링/)).toBeTruthy();
    expect(screen.queryByText(/available equipment/)).toBeNull();
  });

  it("matches the muscle-map calculation and its default synergist weighting", async () => {
    await render(<HelpMuscles />);

    expect(screen.getByText(/프로그램 첫 주차/)).toBeTruthy();
    expect(screen.getByText(/보조 근육은 기본적으로 주동 근육 가중치의 절반/)).toBeTruthy();
    expect(screen.queryByText(/3x/)).toBeNull();
  });
});
