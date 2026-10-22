import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { IconFilter } from "../icons/iconFilter";

export function HelpStats(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">측정값 추가</Text>
      <Text className="pb-2 text-sm">현재 체중이나 종아리·팔 둘레 등 기록할 측정값을 입력합니다.</Text>
      <View className="flex-row flex-wrap items-center pb-2">
        <Text className="text-sm">기록할 항목만 선택할 수 있습니다. 상단의 </Text>
        <IconFilter size={14} />
        <Text className="text-sm"> 아이콘을 눌러 입력 항목을 설정하세요.</Text>
      </View>
      <Text className="pb-2 text-sm">
        모든 항목은 선택 사항입니다. 입력하지 않은 항목은 이번 기록에 추가되지 않습니다.
      </Text>
    </View>
  );
}
