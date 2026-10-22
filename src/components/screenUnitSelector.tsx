import type { JSX } from "react";
import { View, Pressable, Image } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { Button } from "./button";
import { updateSettings } from "../models/state";
import { ISettings } from "../types";
import { useNavOptions } from "../navigation/useNavOptions";
import { Thunk_pushScreen } from "../ducks/thunks";
import { lb } from "lens-shmens";
import { ImagePreloader_uri } from "../utils/imagePreloader";

interface IProps {
  dispatch: IDispatch;
  settings: ISettings;
}

export function ScreenUnitSelector(props: IProps): JSX.Element {
  const selectedButtonCls = "bg-button-primarybackground border-button-primarybackground";
  const unselectedButtonCls = "bg-background-default border-border-neutral";

  useNavOptions({ navHidden: true });

  return (
    <View className="flex flex-col flex-1 bg-background-default">
      <View className="flex-1 px-gutter pt-16 pb-4">
        <View className="w-full h-full border border-border-cardyellow rounded-2xl bg-background-cardyellow">
          <View className="items-center p-4">
            <Image
              source={{ uri: ImagePreloader_uri("/images/dinounit.png") }}
              style={{ width: 240, height: 192 }}
              resizeMode="contain"
            />
          </View>
          <Text className="px-6 pt-4 text-2xl font-semibold text-center">중량 단위를 선택하세요</Text>
          <Text className="px-6 py-4 text-base text-center">
            선택한 단위를 기본값으로 사용합니다. <Text className="font-bold">설정</Text>이나{" "}
            <Text className="font-bold">기구별 설정</Text>에서 언제든 변경할 수 있습니다.
          </Text>
          <View className="flex-row px-6">
            <Pressable
              className={`flex-1 px-2 py-3 border rounded-tl-lg rounded-bl-lg ${props.settings.units === "lb" ? selectedButtonCls : unselectedButtonCls}`}
              onPress={() => {
                updateSettings(props.dispatch, lb<ISettings>().p("units").record("lb"), "Set units to pounds");
              }}
            >
              <Text
                className={`text-sm font-semibold text-center ${props.settings.units === "lb" ? "text-text-alwayswhite" : "text-text-purple"}`}
              >
                파운드 (lb)
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 px-2 py-3 border rounded-tr-lg rounded-br-lg ${props.settings.units === "kg" ? selectedButtonCls : unselectedButtonCls}`}
              onPress={() => {
                updateSettings(props.dispatch, lb<ISettings>().p("units").record("kg"), "Set units to kilograms");
              }}
            >
              <Text
                className={`text-sm font-semibold text-center ${props.settings.units === "kg" ? "text-text-alwayswhite" : "text-text-purple"}`}
              >
                킬로그램 (kg)
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View className="pb-16 mx-4 mb-2">
        <Button
          className="w-full ls-onboarding-units"
          name="see-how-it-works"
          kind="purple"
          onClick={() => props.dispatch(Thunk_pushScreen("setupequipment"))}
        >
          계속
        </Button>
      </View>
    </View>
  );
}
