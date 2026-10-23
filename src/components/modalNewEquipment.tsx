import { JSX, useRef, useState } from "react";
import { View } from "react-native";
import { Text } from "./primitives/text";
import { Button } from "./button";
import { Input, IInputHandle, IValidationError } from "./input";
import { IEither } from "../utils/types";
import { IEquipmentSetup } from "../types";
import { MenuItemEditable } from "./menuItemEditable";
import {
  EquipmentSetupEdit_parseType,
  EquipmentSetupEdit_typeDescription,
  EquipmentSetupEdit_types,
} from "../models/equipmentSetupEdit";

interface IProps {
  onSelect: (name: string, type: IEquipmentSetup["type"]) => void;
  onClose: () => void;
}

export function ModalNewEquipmentContent(props: IProps): JSX.Element {
  const [result, setResult] = useState<IEither<string, Set<IValidationError>>>();
  const [type, setType] = useState<IEquipmentSetup["type"]>("plates");
  const inputHandle = useRef<IInputHandle>(null);

  return (
    <View>
      <Text className="mb-4 text-lg font-bold">새 운동 기구</Text>
      <Input
        identifier="equipment-name"
        label="기구 이름"
        required={true}
        requiredMessage="기구 이름을 입력하세요"
        type="text"
        placeholder="예: 파워랙"
        changeType="oninput"
        changeHandler={setResult}
        handleRef={inputHandle}
      />
      <View className="mt-2">
        <MenuItemEditable
          name="종류"
          type="select"
          value={type}
          values={EquipmentSetupEdit_types.map<[string, string]>((t) => [t.type, t.label])}
          underName={<Text className="text-xs text-text-secondary">{EquipmentSetupEdit_typeDescription(type)}</Text>}
          onChange={(value) => setType(EquipmentSetupEdit_parseType(value) ?? type)}
        />
      </View>
      <View className="flex-row justify-between gap-3 mt-4">
        <Button name="add-equipment-cancel" kind="grayv2" onClick={props.onClose}>
          취소
        </Button>
        <Button
          name="add-equipment-submit"
          kind="purple"
          onClick={() => {
            if (result?.success) {
              props.onSelect(result.data, type);
            } else {
              inputHandle.current?.touch();
            }
          }}
        >
          추가
        </Button>
      </View>
    </View>
  );
}
