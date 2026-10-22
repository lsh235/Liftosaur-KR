import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";

export function HelpMuscles(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">근육 지도 - 프로그램</Text>
      <Text className="pb-2 text-sm">
        프로그램 첫 주차의 운동을 기준으로 근육별 운동량을 보여줍니다. 주간 계획에서 근육별 운동량이 치우치는지 살펴볼
        수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">근력</Text>과 <Text className="text-sm font-bold">근비대</Text> 운동량을
        나누어 계산합니다. 반복 횟수가 8회 미만인 세트는 근력, 8회 이상인 세트는 근비대 운동량에 반영합니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">근육별 상대 사용량</Text>은 운동 세트와 반복 횟수를 합산한 뒤 가장 큰 값을
        100%로 환산합니다. 보조 근육은 기본적으로 주동 근육 가중치의 절반으로 계산하며, 종목별로 설정한 가중치가 있으면
        그 값을 사용합니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">종목 목록</Text>에서는 각 종목의 주동 근육과 보조 근육, 근육별 상대 사용량을
        확인할 수 있습니다. 이 수치는 앱에서 운동량을 비교하기 위해 적용한 가중치이며 실제 근육 활성도를 측정한 값은
        아닙니다.
      </Text>
    </View>
  );
}
