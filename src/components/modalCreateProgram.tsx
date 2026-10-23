import { JSX, useRef, useState } from "react";
import { View } from "react-native";
import { Text } from "./primitives/text";
import { Button } from "./button";
import { Modal } from "./modal";
import { IconSpinner } from "./icons/iconSpinner";
import { Input, IInputHandle, IValidationError } from "./input";
import { IEither } from "../utils/types";

interface IProps {
  onSelect: (name: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  isHidden: boolean;
}

export function ModalCreateProgramContent(props: Omit<IProps, "isHidden">): JSX.Element {
  const [result, setResult] = useState<IEither<string, Set<IValidationError>>>();
  const inputHandle = useRef<IInputHandle>(null);

  return (
    <View>
      <Text className="pb-2 text-xl font-bold text-center">프로그램 만들기</Text>
      <Input
        identifier="modal-create-program"
        label="프로그램 이름"
        required={true}
        requiredMessage="프로그램 이름을 입력하세요"
        placeholder="나만의 운동 루틴"
        changeType="oninput"
        changeHandler={setResult}
        handleRef={inputHandle}
      />
      <View className="flex-row justify-center mt-4" style={{ gap: 12 }}>
        <Button name="modal-create-program-cancel" kind="grayv2" onClick={props.onClose}>
          취소
        </Button>
        <Button
          name="modal-create-program-submit"
          kind="purple"
          disabled={props.isLoading}
          onClick={() => {
            if (props.isLoading) {
              return;
            }
            if (result?.success) {
              props.onSelect(result.data);
            } else {
              inputHandle.current?.touch();
            }
          }}
        >
          {props.isLoading ? <IconSpinner color="white" width={18} height={18} /> : "만들기"}
        </Button>
      </View>
    </View>
  );
}

export function ModalCreateProgram(props: IProps): JSX.Element {
  return (
    <Modal zIndex={70} isHidden={props.isHidden} onClose={props.onClose} shouldShowClose={true}>
      <ModalCreateProgramContent onSelect={props.onSelect} onClose={props.onClose} isLoading={props.isLoading} />
    </Modal>
  );
}
