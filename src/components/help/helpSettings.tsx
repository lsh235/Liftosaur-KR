import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";

export function HelpSettings(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">설정</Text>
      <Text className="pb-2 text-sm">
        설정은 계정, 운동 등 주제별로 나뉘어 있습니다. 일부 항목은 로그인한 뒤 사용할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">계정</Text>에서 로그인하면 여러 기기 간 데이터를 동기화할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">보유 기구</Text>를 설정하세요. 원판 계산기가 보유한 기구로 만들 수 있는
        중량을 계산합니다. 예를 들어 <Text className="text-sm font-bold">45lb 원판 4장</Text>과 바만 있다면 150lb를
        만들 수 없으므로 실제로 만들 수 있는 중량 조합을 안내합니다.
      </Text>
      <Text className="pb-2 text-sm">
        <Text className="text-sm font-bold">가져오기 / 내보내기</Text>에서 앱 데이터를 JSON 파일로 백업하거나 다른
        기기에 옮길 수 있습니다. 외부 AI가 만든 운동 루틴 JSON 또는 CSV 파일은 프로그램 선택 화면의{" "}
        <Text className="text-sm font-bold">AI 운동 루틴 파일 가져오기</Text>에서 불러옵니다.
      </Text>
      <Text className="pb-2 text-sm">
        운동 기록은 CSV 파일로 내보내 스프레드시트 앱에서 분석할 수 있습니다.
      </Text>
    </View>
  );
}
