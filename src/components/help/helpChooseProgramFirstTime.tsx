import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { Link } from "../link";

export function HelpChooseProgramFirstTime(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">프로그램 선택</Text>
      <Text className="pb-2 text-sm">이 화면에서 미리 만든 프로그램을 선택하거나 새 프로그램을 만들 수 있습니다.</Text>
      <Text className="pb-2 text-sm">
        운동 프로그램을 처음 사용한다면 새로 만들기 전에 미리 만든 프로그램부터 살펴보세요.
      </Text>
      <Text className="pb-2 text-sm">
        프로그램에는 운동일별 종목과 세트가 포함됩니다. 수행 결과에 따라 중량이나 반복 횟수를 조정하는 진행 규칙도
        설정할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        프로그램을 선택한 뒤 원하는 대로 수정할 수 있습니다.{" "}
        <Link className="text-sm" href="/doc">
          Liftoscript
        </Link>
        를 사용하면 반복 횟수와 중량의 진행 규칙도 바꿀 수 있습니다.
      </Text>
    </View>
  );
}
