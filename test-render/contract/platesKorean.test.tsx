import { render, screen } from "@testing-library/react-native";
import { PlatesCalculator } from "../../src/components/inputWeight2";
import { HelpPlates } from "../../src/components/help/helpPlates";
import { Fixture_build } from "../harness/fixture";
import { Weight_build } from "../../src/models/weight";

describe("Korean plate equipment guidance", () => {
  it("explains fixed weights, plate-loaded equipment, and balanced plate counts in Korean", async () => {
    await render(<HelpPlates />);

    expect(screen.getByText("설정 - 기구")).toBeTruthy();
    expect(screen.getAllByText(/고정 중량/).length).toBeGreaterThan(0);
    expect(screen.getByText(/원판 덤벨/)).toBeTruthy();
    expect(screen.getByText(/짝수 개의 원판/)).toBeTruthy();
    expect(screen.queryByText("Settings - Equipment")).toBeNull();
  });

  it("uses Korean labels in the weight-input plate calculator", async () => {
    const settings = Fixture_build().storage.settings;
    await render(
      <PlatesCalculator
        weight={Weight_build(45, "lb")}
        settings={settings}
        exerciseType={{ id: "squat", equipment: "barbell" }}
      />
    );

    expect(screen.getByText("원판:")).toBeTruthy();
    expect(screen.getByTestId("plates-list")).toBeTruthy();
    expect(screen.queryByText("Plates:")).toBeNull();
  });
});
