import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";

export function HelpExercises(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">운동 종목</Text>
      <Text className="pb-2 text-sm">
        현재 프로그램과 운동 기록에 포함된 종목, 사용자 지정 종목을 모아 볼 수 있습니다. 이름을 검색하거나 종목 종류와
        근육 그룹으로 목록을 필터링하세요.
      </Text>
      <Text className="pb-2 text-sm">
        종목을 선택하면 개인 기록과 운동 이력을 확인할 수 있습니다. 사용자 지정 종목은 이 목록에서 추가할 수 있습니다.
      </Text>
    </View>
  );
}
