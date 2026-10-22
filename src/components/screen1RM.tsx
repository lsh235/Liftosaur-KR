import { JSX, useState } from "react";
import { View, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { IExerciseType, IProgram, ISettings } from "../types";
import { INavCommon } from "../models/state";
import { useNavOptions } from "../navigation/useNavOptions";
import { Thunk_pushScreen } from "../ducks/thunks";
import { Settings_getExercisesWithUnset1RMs, Settings_setOneRM } from "../models/settings";
import { Exercise_get, Exercise_onerm, Exercise_nameWithEquipment } from "../models/exercise";
import { ExerciseImage } from "./exerciseImage";
import { InputWeight2 } from "./inputWeight2";
import { Button } from "./button";
import { Weight_isPct } from "../models/weight";
import { Tailwind_colors, Tailwind_semantic } from "../utils/tailwindConfig";

function getFooterShadowStyle(): Record<string, unknown> {
  const semantic = Tailwind_semantic();
  const colors = Tailwind_colors();
  return Platform.select({
    ios: {
      shadowColor: semantic.background.default === colors.black ? colors.white : colors.black,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: { elevation: 4 },
    default: { boxShadow: "0 0 4px 0 rgba(0, 0, 0, 0.2)" },
  }) as Record<string, unknown>;
}

interface IScreen1RMProps {
  dispatch: IDispatch;
  settings: ISettings;
  program: IProgram;
  navCommon: INavCommon;
}

export function Screen1RM(props: IScreen1RMProps): JSX.Element {
  const [exerciseTypes] = useState<IExerciseType[]>(Settings_getExercisesWithUnset1RMs(props.program, props.settings));
  const insets = useSafeAreaInsets();

  useNavOptions({ navTitle: "1회 최대 중량(1RM) 설정" });

  return (
    <View className="flex-1 bg-background-default">
      <ScrollView
        className="flex-1 bg-background-default"
        contentContainerStyle={{ paddingBottom: 80 + (insets.bottom || 16) }}
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="interactive"
      >
        <View className="px-gutter pb-2">
          <Text className="text-sm">
            선택한 프로그램은 <Text className="text-sm font-bold">1RM(1회 최대 중량)</Text>을 기준으로 세트 중량을
            계산합니다.
          </Text>
        </View>
        <View className="px-gutter pb-2">
          <Text className="text-sm">
            아래 운동의 1RM을 입력하세요. 직접 모른다면 185lb로 5회만 할 수 있었던 것처럼{" "}
            <Text className="text-sm font-bold">N회 최대 중량</Text>을 아는 경우 키보드의 1RM 계산기를 사용하세요.
          </Text>
        </View>
        <View className="px-gutter pb-4">
          <Text className="text-sm font-bold text-text-secondary">
            건너뛰어도 됩니다. 첫 운동 중에 입력할 수 있습니다.
          </Text>
        </View>
        <View className="flex-row pb-1 border-b border-background-subtle">
          <View className="flex-1 pl-4">
            <Text className="text-xs text-text-secondary">운동</Text>
          </View>
          <View className="pr-4 w-scaled-36">
            <Text className="text-xs text-center text-text-secondary">1회 최대 중량</Text>
          </View>
        </View>
        {exerciseTypes.map((exerciseType) => {
          const exercise = Exercise_get(exerciseType, props.settings.exercises);
          const onerm = Exercise_onerm(exerciseType, props.settings);
          return (
            <View
              key={`${exerciseType.id}_${exerciseType.equipment}`}
              className="flex-row items-center py-1 border-b border-background-subtle"
            >
              <View className="flex-row items-center flex-1 pl-4" style={{ gap: 16 }}>
                <View className="w-scaled-12">
                  <ExerciseImage settings={props.settings} exerciseType={exerciseType} size="small" width={48} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold">
                    {Exercise_nameWithEquipment(exercise, props.settings)}
                  </Text>
                </View>
              </View>
              <View className="items-center justify-center pr-4 w-scaled-36">
                <InputWeight2
                  name="onerm-weight"
                  width={4}
                  exerciseType={exerciseType}
                  data-testid="onerm-weight"
                  testID="onerm-weight"
                  units={["lb", "kg"] as const}
                  inputCommitMode="blur"
                  onInput={(v) => {
                    if (v != null && !Weight_isPct(v)) {
                      Settings_setOneRM(props.dispatch, exerciseType, v, props.settings);
                    }
                  }}
                  onBlur={(v) => {
                    if (v != null && !Weight_isPct(v)) {
                      Settings_setOneRM(props.dispatch, exerciseType, v, props.settings);
                    }
                  }}
                  showUnitInside={true}
                  subscription={undefined}
                  value={onerm}
                  max={9999}
                  min={-9999}
                  settings={props.settings}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-background-default"
        style={[{ paddingBottom: insets.bottom || 16 }, getFooterShadowStyle()]}
      >
        <Button
          className="w-full"
          name="continue-1rms"
          kind="purple"
          buttonSize="lg"
          onClick={() => {
            props.dispatch(Thunk_pushScreen("main", undefined, { tab: "home" }));
          }}
          data-testid="continue-1rms"
          testID="continue-1rms"
        >
          계속
        </Button>
      </View>
    </View>
  );
}
