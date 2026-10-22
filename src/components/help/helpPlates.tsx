import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";

export function HelpPlates(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">설정 - 기구</Text>
      <Text className="pb-2 text-sm">여기에서 사용할 기구와 보유한 원판, 고정 중량을 설정합니다.</Text>
      <Text className="pb-2 text-sm">
        기구 종류별(바벨, 덤벨, 케이블 등)로 <Text className="text-sm font-bold">고정 중량</Text>을 사용할지{" "}
        <Text className="text-sm font-bold">원판</Text>을 사용할지 선택할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">고정 중량</Text>은 예를 들어 10lb, 15lb, 20lb, 25lb 덤벨을 각각 한 쌍씩
        보유한 경우입니다. 덤벨에 원판을 추가할 수 없으므로 보유한 덤벨 중량과 수량을 지정하면 앱이 그 범위에서 중량을
        선택합니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">원판 덤벨</Text>은 예를 들어 10lb 바와 2.5lb 원판 4쌍, 5lb 원판 2쌍, 10lb
        원판 2쌍으로 구성됩니다. 바 무게와 보유한 원판의 무게·수량을 설정하면 필요한 중량에 맞춰 원판 조합을 계산합니다.
      </Text>
      <Text className="pb-2 text-sm">
        바 양쪽의 균형을 맞춰야 하므로 <Text className="text-sm font-bold">짝수 개의 원판</Text>만 설정할 수 있습니다.
      </Text>
    </View>
  );
}
