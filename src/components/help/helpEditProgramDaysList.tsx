import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { IconCog2 } from "../icons/iconCog2";

export function HelpEditProgramDaysList(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">프로그램 편집</Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">프로그램</Text>은 여러{" "}
        <Text className="text-sm font-bold">운동일</Text>로 구성되고, 운동일마다{" "}
        <Text className="text-sm font-bold">종목</Text>을 추가합니다. 종목에는 세트, 반복 횟수와 중량·반복 횟수를
        조정하는 진행 규칙이 포함됩니다.
      </Text>
      <Text className="pb-2 text-sm">
        화면 위쪽에서 다음 운동의 <Text className="text-sm font-bold">운동일</Text>을 선택할 수 있습니다. 운동을 마치면
        자동으로 다음 운동일로 넘어가며, 필요하면 다른 날을 선택해 건너뛰거나 이전 운동일로 돌아갈 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        운동일과 종목을 만들고 각 운동일에 종목을 추가하세요. 운동일과 종목을 복사하면 프로그램을 빠르게 구성하거나
        수정할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">점 6개 모양의 손잡이를 끌어 운동일 순서를 바꿀 수 있습니다.</Text>
      <Text className="pb-2 text-sm">
        각 종목은 현재 중량이나 반복 횟수 같은 진행 상태를 따로 기록합니다. 같은 종목을 여러 운동일에 사용하면 이전
        수행에서 이어서 진행합니다.
      </Text>
      <View className="flex-row flex-wrap items-center pb-2">
        <Text className="text-sm">
          설정 화면의 <Text className="text-sm font-bold">프로그램 전체 텍스트 내보내기</Text>로 프로그램을 백업할 수
          있습니다. 외부 AI가 만든 JSON 또는 CSV 운동 루틴은 프로그램 선택 화면에서{" "}
          <Text className="text-sm font-bold">AI 운동 루틴 파일 가져오기</Text>를 선택해 불러오세요. 앱 데이터 백업은
          설정 화면의 가져오기/내보내기 항목을 이용합니다.{" "}
        </Text>
        <IconCog2 size={14} />
        <Text className="text-sm"> 아이콘은 화면 오른쪽 아래에 있습니다.</Text>
      </View>
    </View>
  );
}
