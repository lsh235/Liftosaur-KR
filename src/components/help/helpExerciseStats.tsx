import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { IconFilter } from "../icons/iconFilter";

export function HelpExerciseStats(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">운동 종목 기록</Text>
      <Text className="pb-2 text-sm">
        이 화면에서 선택한 종목의 진행 그래프, 개인 기록, 운동 이력을 확인할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">화면 위쪽의 선택 메뉴에서 다른 종목으로 이동할 수 있습니다.</Text>
      <Text className="pb-2 text-sm">개인 기록이나 운동 이력을 누르면 해당 기록이 만들어진 운동으로 이동합니다.</Text>
      <View className="flex-row flex-wrap items-center pb-2">
        <Text className="text-sm">이력 목록 오른쪽의 </Text>
        <IconFilter size={14} />
        <Text className="text-sm"> 아이콘을 눌러 날짜순으로 정렬하거나 이력을 필터링할 수 있습니다.</Text>
      </View>
    </View>
  );
}
