import { JSX, useCallback } from "react";
import { View } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { MenuItemWrapper } from "./menuItem";
import { Thunk_importStorage } from "../ducks/thunks";
import { FileImport_pickFile, FileImport_confirm } from "../utils/fileImport";

interface IImporterStorageProps {
  dispatch: IDispatch;
}

export function ImporterStorage(props: IImporterStorageProps): JSX.Element {
  const onPress = useCallback(async () => {
    const contents = await FileImport_pickFile("json");
    if (contents == null) {
      return;
    }
    const ok = await FileImport_confirm(
      "가져오기를 진행하면 현재 앱 데이터가 삭제됩니다. 계속하기 전에 JSON 백업을 내보내세요. 확인을 누르면 가져오기를 진행합니다."
    );
    if (ok) {
      props.dispatch(Thunk_importStorage(contents));
    }
  }, [props.dispatch]);

  return (
    <MenuItemWrapper name="운동 데이터 JSON 복원" onClick={onPress}>
      <View className="py-3">
        <Text className="text-base text-text-primary">운동 데이터 JSON 백업 복원</Text>
      </View>
    </MenuItemWrapper>
  );
}
