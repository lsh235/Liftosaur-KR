import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { IconCog2 } from "../icons/iconCog2";

export function HelpWorkout(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">운동 화면</Text>
      <Text className="pb-2 text-sm">현재 운동의 종목과 세트별 수행 내용을 확인하고 기록하는 화면입니다.</Text>
      <Text className="pb-2 text-sm">
        세트를 완료하면 해당 세트의 사각형을 눌러 기록합니다. 잘못 기록했다면 다시 눌러 반복 횟수를 줄일 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        반복 횟수 뒤에 <Text className="text-sm font-bold">+</Text>가 붙은 <Text className="text-sm font-bold">5+</Text>
        는 <Text className="text-sm font-bold">AMRAP</Text>(가능한 만큼 반복) 세트입니다. 가능한 횟수만큼 수행하세요.
        목표 반복 횟수보다 적게 수행하면 해당 세트는 실패로 기록됩니다.
      </Text>
      <Text className="pb-2 text-sm">
        바벨 세트의 <Text className="text-sm font-bold">원판 계산기</Text>에서 목표 중량과 바 양쪽에 끼울 원판을 확인할
        수 있습니다. 예를 들어 <Text className="text-sm font-bold">185lb - 45/25</Text>는 185lb를 만들려면 바 양쪽에
        45lb 원판 한 장과 25lb 원판 한 장씩 끼운다는 뜻입니다. 중량을 누르면 이번 운동의 중량을 바꿀 수 있으며
        프로그램에 저장된 목표 중량은 바뀌지 않습니다.
      </Text>
      <View className="flex-row flex-wrap items-center pb-2">
        <Text className="text-sm">
          원판 계산기는 <Text className="text-sm font-bold">보유한 원판 조합</Text>을 기준으로 가능한 중량을 계산합니다.
          기구와 원판은 화면 오른쪽 아래의{" "}
        </Text>
        <IconCog2 size={14} />
        <Text className="text-sm">
          {" "}
          <Text className="text-sm font-bold">설정</Text>에서 지정하세요.
        </Text>
      </View>
      <Text className="pb-2 text-sm">
        종목과 세트의 수행 순서는 앱에서 강제하지 않습니다. 운동 사이에 휴식 시간을 두지 않고 여러 종목을 번갈아 하는
        슈퍼세트로 시간을 아낄 수도 있습니다.
      </Text>
      <Text className="text-sm">
        종목의 모든 세트를 마치면 그 종목에 설정된{" "}
        <Text className="text-sm font-bold">운동 종료 스크립트(Finish Day Script)</Text>가 실행됩니다. 프로그램의 진행
        규칙에 따라 다음 운동의 중량이나 반복 횟수가 바뀔 수 있으며, 변경 내용은{" "}
        <Text className="text-sm font-bold">운동 변수 변경</Text> 또는{" "}
        <Text className="text-sm font-bold">프로그램 상태 변수 변경</Text>에 표시됩니다.
      </Text>
    </View>
  );
}
