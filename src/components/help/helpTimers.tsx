import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";

export function HelpTimers(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">설정 - 타이머</Text>
      <Text className="pb-2 text-sm">워밍업 세트와 일반 세트 뒤에 사용할 휴식 시간을 설정할 수 있습니다.</Text>
      <Text className="pb-2 text-sm">
        워밍업 타이머는 워밍업 세트를 완료했을 때, 일반 타이머는 본 세트를 완료했을 때 시작됩니다.
      </Text>
      <Text className="pb-2 text-sm">
        타이머는 운동 화면에 표시됩니다. 종료 시 앱을 사용 중이면 소리나 진동으로 알려주고, 앱이 백그라운드에 있으면
        기기의 알림 권한과 설정에 따라 알림을 보냅니다. Android 13 이상에서는 앱 알림 권한을 허용해야 하며, Android 12
        이상에서는 정확한 시간에 알림을 보내기 위해 '알람 및 리마인더' 권한이 필요할 수 있습니다.
      </Text>
    </View>
  );
}
