import { ActionSheetIOS } from "react-native";
import { Dialog_confirm } from "../../src/utils/dialog";
import { Fixture_build } from "../harness/fixture";
import { RenderApp_mount } from "../harness/renderApp";
import { RenderEnv_build } from "../harness/renderEnv";

jest.mock("../../src/utils/dialog", () => ({
  ...jest.requireActual("../../src/utils/dialog"),
  Dialog_confirm: jest.fn().mockResolvedValue(false),
}));

describe("Korean workout menu copy", () => {
  it("asks for confirmation in Korean before deleting the current workout", async () => {
    const state = Fixture_build();
    const { env } = RenderEnv_build();
    const app = await RenderApp_mount(state, env);
    const showActionSheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions");
    showActionSheet.mockImplementation((options, callback) => {
      callback(options.options.indexOf("운동 기록 삭제"));
    });
    try {
      await app.press("workout-menu");

      expect(Dialog_confirm).toHaveBeenCalledWith("진행 중인 운동 기록을 삭제할까요?");
    } finally {
      showActionSheet.mockRestore();
      await app.unmount();
    }
  });
});
