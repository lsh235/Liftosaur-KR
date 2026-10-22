import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../../components/primitives/text";
import { useAppState } from "../StateContext";
import { MenuItemEditable } from "../../components/menuItemEditable";
import { Settings_changePickerSettings } from "../../models/settings";
import { FormSheet } from "../FormSheet";

export function NavModalExercisePickerSettings(): JSX.Element {
  const { state, dispatch } = useAppState();
  return (
    <FormSheet>
      <View className="pb-4 bg-background-default">
        <Text className="pb-3 text-base font-semibold text-center">운동 선택 설정</Text>
        <MenuItemEditable
          type="boolean"
          name="종목 변경 후에도 기존 프로그램 진행 규칙 유지"
          value={state.storage.settings.workoutSettings.shouldKeepProgramExerciseId ? "true" : "false"}
          onChange={(v) => {
            Settings_changePickerSettings(dispatch, { shouldKeepProgramExerciseId: v === "true" });
          }}
        />
      </View>
    </FormSheet>
  );
}
