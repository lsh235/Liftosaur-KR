import { JSX, useState } from "react";
import { View } from "react-native";
import { TextInput } from "./primitives/textInput";
import { Text } from "./primitives/text";
import { Button } from "./button";
import { Tailwind_semantic } from "../utils/tailwindConfig";

interface IProps {
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function ModalNewGymContent(props: IProps): JSX.Element {
  const [value, setValue] = useState("");

  return (
    <View>
      <Text className="mb-2 text-lg font-bold">새 운동 장소</Text>
      <Text className="mb-4 text-xs text-text-secondary">
        운동 장소를 추가하고 장소별 운동 기구를 설정할 수 있습니다. 장소를 바꾸면 해당 장소의 기구 설정이 운동에 적용됩니다.
      </Text>
      <TextInput
        autoFocus
        placeholder="예: 집 운동방"
        placeholderTextColor={Tailwind_semantic().text.secondarysubtle}
        value={value}
        onChangeText={setValue}
        className="px-4 py-3 text-base border rounded-lg border-border-neutral bg-background-default text-text-primary"
      />
      <View className="flex-row justify-between gap-3 mt-4">
        <Button name="add-gym-cancel" kind="grayv2" onClick={props.onClose}>
          취소
        </Button>
        <Button
          name="add-gym-submit"
          kind="purple"
          onClick={() => {
            if (value) {
              props.onSelect(value);
            }
          }}
        >
          추가
        </Button>
      </View>
    </View>
  );
}
