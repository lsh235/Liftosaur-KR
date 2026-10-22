import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";

export function HelpAccount(): JSX.Element {
  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">설정 - 계정</Text>
      <Text className="pb-2 text-sm">이 화면에서 계정에 로그인하거나 로그아웃할 수 있습니다.</Text>
      <Text className="pb-2 text-sm">
        사용할 수 있는 로그인 방법은 기기에 따라 다릅니다. iOS에서는{" "}
        <Text className="text-sm font-bold">Apple로 로그인</Text>, Android에서는{" "}
        <Text className="text-sm font-bold">Google로 로그인</Text>할 수 있습니다.
      </Text>
      <Text className="pb-2 text-sm">
        로그인하면 운동 기록과 프로그램이 클라우드와 동기화됩니다. 다른 기기에서 같은 계정으로 로그인하면 데이터를
        이어서 사용할 수 있습니다.
      </Text>
    </View>
  );
}
