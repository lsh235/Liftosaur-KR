import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { IconFilter } from "../icons/iconFilter";
import { Link } from "../link";

export function HelpGraphs(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">그래프</Text>
      <Text className="pb-2 text-sm">
        이 화면에서 운동 기록과 <Text className="text-sm font-bold">측정 기록 그래프</Text>(체중, 팔둘레 등)를 확인할 수
        있습니다.
      </Text>
      <View className="flex-row flex-wrap items-center pb-2">
        <Text className="text-sm">오른쪽 위의 </Text>
        <IconFilter size={14} />
        <Text className="text-sm"> 아이콘을 눌러 표시할 그래프와 옵션을 설정하세요.</Text>
      </View>
      <View className="pb-2">
        <View className="flex-row pb-1 ml-6">
          <Text className="text-sm">{"• "}</Text>
          <Text className="flex-1 text-sm">
            <Text className="text-sm font-bold">모든 그래프의 가로축 범위 통일</Text>을 켜면 그래프마다 다른 기간을 같은
            시간 범위에서 비교할 수 있습니다. 기본 설정에서는 각 그래프가 해당 기록의 첫 날짜부터 마지막 날짜까지
            표시됩니다.
          </Text>
        </View>
        <View className="flex-row pb-1 ml-6">
          <Text className="text-sm">{"• "}</Text>
          <Text className="flex-1 text-sm">
            <Text className="text-sm font-bold">체중 그래프 겹쳐 보기</Text>를 켜면 운동 그래프 위에 체중 변화를 함께
            표시할 수 있습니다.
          </Text>
        </View>
        <View className="flex-row pb-1 ml-6">
          <Text className="text-sm">{"• "}</Text>
          <Text className="flex-1 text-sm">
            <Text className="text-sm font-bold">추정 1RM 그래프</Text>를 켜면 중량과 반복 횟수로 추정한 1회 최대 중량을
            함께 볼 수 있습니다. 추정에는{" "}
            <Link className="text-sm" href="https://en.wikipedia.org/wiki/One-repetition_maximum">
              에플리 공식
            </Link>
            을 사용합니다. 세트마다 중량이나 반복 횟수가 달라도 근력 변화를 비교하는 데 도움이 됩니다.
          </Text>
        </View>
      </View>
      <Text className="pb-2 text-sm">
        그래프를 터치하거나 포인터를 움직이면 해당 지점의 날짜와 값을 확인할 수 있습니다.
      </Text>
    </View>
  );
}
