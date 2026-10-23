import { JSX, memo, useState } from "react";
import { View } from "react-native";
import { TextInput } from "../primitives/textInput";
import { Text } from "../primitives/text";
import { IExercisePickerState } from "../../types";
import { ILensDispatch } from "../../utils/useLensReducer";
import { lb } from "lens-shmens";
import { Tailwind_semantic } from "../../utils/tailwindConfig";
import { Exercise_nameError } from "../../models/exercise";

interface IProps {
  templateName?: string;
  dispatch: ILensDispatch<IExercisePickerState>;
}

export const ExercisePickerTemplate = memo(function ExercisePickerTemplate(props: IProps): JSX.Element {
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  return (
    <View className="mx-4 mt-4 mb-4">
      <View className="mb-4">
        <Text className="text-sm font-bold">
          템플릿 이름<Text className="text-text-error"> *</Text>
        </Text>
        <TextInput
          data-testid="exercise-template-name"
          testID="exercise-template-name"
          defaultValue={props.templateName ?? ""}
          placeholder="나만의 운동 템플릿"
          placeholderTextColor={Tailwind_semantic().text.secondarysubtle}
          className="px-4 py-2 mt-1 text-base border rounded-lg min-h-scaled-10 bg-background-default border-border-prominent text-text-primary"
          onChangeText={(rawValue) => {
            const value = rawValue?.trim() || "";
            const error = Exercise_nameError(value);
            setNameError(error);
            if (error == null) {
              props.dispatch(
                lb<IExercisePickerState>().p("templateName").record(value),
                `Set template name to ${value}`
              );
            }
          }}
        />
        {nameError && <Text className="mt-1 text-xs text-text-error">{nameError}</Text>}
      </View>
      <Text className="my-2 text-sm">
        <Text className="text-sm">템플릿 이름은 자유롭게 정할 수 있으며 실제 운동에는 사용되지 않는 </Text>
        <Text className="text-sm font-bold">템플릿 운동</Text>
        <Text className="text-sm">으로 저장됩니다. 이 템플릿의 </Text>
        <Text className="text-sm font-bold">세트</Text>
        <Text className="text-sm">, </Text>
        <Text className="text-sm font-bold">워밍업</Text>
        <Text className="text-sm">, </Text>
        <Text className="text-sm font-bold">업데이트</Text>
        <Text className="text-sm">, </Text>
        <Text className="text-sm font-bold">진행 방식</Text>
        <Text className="text-sm">을 실제 운동에 재사용할 수 있습니다.</Text>
      </Text>
    </View>
  );
});
