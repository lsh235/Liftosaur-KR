import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { ScreenImportPreview } from "../../src/components/screenImportPreview";
import { IDispatch } from "../../src/ducks/types";
import { Settings_build } from "../../src/models/settings";
import { IImportPreview } from "../../src/models/state";

jest.mock("../../src/navigation/useNavOptions", () => ({ useNavOptions: () => {} }));

describe("Korean import preview", () => {
  afterEach(() => cleanup());

  it("shows parsed record counts and row errors in Korean", async () => {
    const preview: IImportPreview = {
      source: "hevy",
      result: {
        historyRecords: [],
        customExercises: {},
        errors: [{ row: 2, message: "운동 이름이 없습니다." }],
        warnings: [],
      },
    };

    await render(
      <ScreenImportPreview
        dispatch={jest.fn() as unknown as IDispatch}
        preview={preview}
        history={[]}
        settings={Settings_build("kg")}
      />
    );

    expect(screen.getByText("가져올 운동 기록 0개")).toBeTruthy();
    expect(screen.getByText(/해석할 수 없어 건너뛴 행 1개/)).toBeTruthy();
    expect(screen.getByText("자세히")).toBeTruthy();
    expect(screen.queryByText("Import Preview")).toBeNull();
    expect(screen.queryByText("Show")).toBeNull();

    await fireEvent.press(screen.getByText("자세히"));

    expect(screen.getByText("2행: 운동 이름이 없습니다.")).toBeTruthy();
    expect(screen.getByText("숨기기")).toBeTruthy();
  });
});
