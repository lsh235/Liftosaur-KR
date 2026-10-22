import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";

export function HelpMeasurements(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">측정 기록</Text>
      <Text className="pb-2 text-sm">
        체중, 팔·어깨·종아리 둘레 등 <Text className="text-sm font-bold">신체 측정값</Text>을 기록할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">그래프</Text> 화면에서 측정 기록과 운동 기록의 변화 흐름을 함께 비교할 수
        있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        화면 위쪽에서 측정 <Text className="text-sm font-bold">항목</Text>을 선택하면 해당 기록을 볼 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">기록이 4개 이상이면 그래프도 표시됩니다.</Text>
      <Text className="pb-2 text-sm">
        그래프 아래에서 기존 기록을 수정하거나 삭제할 수 있고, 화면 아래쪽의 버튼으로 새 기록을 추가할 수 있습니다.
      </Text>
    </View>
  );
}
