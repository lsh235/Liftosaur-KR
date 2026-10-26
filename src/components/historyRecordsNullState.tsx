import type { JSX } from "react";
import { Image, View } from "react-native";
import { Text } from "./primitives/text";
import { IconArrowDown3 } from "./icons/iconArrowDown3";
import { BundledImages_resolve } from "../utils/bundledImages";

export function HistoryRecordsNullState(): JSX.Element {
  return (
    <View className="flex-1">
      <View className="items-center justify-center flex-1">
        <Image
          source={BundledImages_resolve("/images/tigerfit-mascot.png")}
          style={{ width: 188, height: 240 }}
          resizeMode="contain"
          accessibilityLabel="TigerFit mascot"
        />
      </View>
      <View className="items-center w-full py-4 border border-border-cardpurple bg-background-cardpurple rounded-tl-2xl rounded-se-2xl">
        <Text className="py-2 text-base font-semibold">TigerFit에 오신 것을 환영합니다!</Text>
        <Text className="text-sm">여기를 눌러 운동을 시작하세요.</Text>
        <View className="py-2">
          <IconArrowDown3 />
        </View>
      </View>
    </View>
  );
}
