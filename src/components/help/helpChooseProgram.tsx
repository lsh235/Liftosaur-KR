import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { Link } from "../link";

export function HelpChooseProgram(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">프로그램 선택 및 복제</Text>
      <Text className="pb-2 text-sm">
        이 화면에서 내 프로그램을 선택하거나 미리 만든 프로그램을 <Text className="text-sm font-bold">복제</Text>할 수
        있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        내 프로그램을 누르면 다음 운동에 사용할 프로그램으로 선택됩니다. 프로그램을{" "}
        <Text className="text-sm font-bold">수정</Text>하거나 <Text className="text-sm font-bold">삭제</Text>하려면
        오른쪽의 편집 버튼을 누르세요.
      </Text>
      <Text className="pb-2 text-sm">
        미리 만든 프로그램을 <Text className="text-sm font-bold">복제</Text>하면 내 프로그램 목록에 사본이 추가됩니다.
      </Text>
      <Text className="pb-2 text-sm">
        프로그램에는 운동일별 종목과 세트, 수행 결과에 따라 중량이나 반복 횟수를 조정하는 진행 규칙이 포함됩니다.
      </Text>
      <Text className="pb-2 text-sm">
        복제한 프로그램은 원하는 대로 수정할 수 있습니다.{" "}
        <Link className="text-sm" href="/doc">
          Liftoscript
        </Link>
        를 사용하면 중량과 반복 횟수의 진행 규칙도 바꿀 수 있습니다.
      </Text>
    </View>
  );
}
