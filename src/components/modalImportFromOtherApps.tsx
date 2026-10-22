import { JSX, useCallback } from "react";
import { View } from "react-native";
import { Text } from "./primitives/text";
import { GroupHeader } from "./groupHeader";
import { MenuItemWrapper } from "./menuItem";
import { IDispatch } from "../ducks/types";
import { Thunk_importHevyData } from "../ducks/thunks";
import { ISettings } from "../types";
import { FileImport_pickFile } from "../utils/fileImport";

interface IModalImportFromOtherAppsContentProps {
  settings: ISettings;
  onClose: () => void;
  dispatch: IDispatch;
}

export function ModalImportFromOtherAppsContent(props: IModalImportFromOtherAppsContentProps): JSX.Element {
  const onUploadHevy = useCallback(async () => {
    const contents = await FileImport_pickFile("csv");
    if (contents == null) {
      return;
    }
    props.onClose();
    // The pushed screen inherits the modal's bounded container if navigation happens before the
    // modal finishes closing, so delay the dispatch
    setTimeout(() => props.dispatch(Thunk_importHevyData(contents)), 50);
  }, [props.dispatch, props.onClose]);

  return (
    <View>
      <GroupHeader size="large" name="다른 앱의 운동 기록 가져오기" />
      <MenuItemWrapper name="Hevy CSV 파일 가져오기" onClick={onUploadHevy}>
        <Text className="py-3">Hevy CSV 파일 선택</Text>
      </MenuItemWrapper>
    </View>
  );
}
