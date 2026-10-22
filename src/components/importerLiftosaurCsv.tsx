import { JSX, useCallback, useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { MenuItemWrapper } from "./menuItem";
import { Thunk_importCsvData } from "../ducks/thunks";
import { FileImport_pickFile } from "../utils/fileImport";
import { IconHelp } from "./icons/iconHelp";
import { InternalLink } from "../internalLink";

interface IImporterLiftosaurCsvProps {
  dispatch: IDispatch;
}

export function ImporterLiftosaurCsv(props: IImporterLiftosaurCsvProps): JSX.Element {
  const [showHelp, setShowHelp] = useState(false);

  const onPress = useCallback(async () => {
    const contents = await FileImport_pickFile("csv");
    if (contents == null) {
      return;
    }
    props.dispatch(Thunk_importCsvData(contents));
  }, [props.dispatch]);

  return (
    <MenuItemWrapper name="Liftosaur 운동 기록 CSV 가져오기">
      <View className="py-1">
        <View className="flex-row">
          <View className="flex-1">
            <Pressable className="py-2" onPress={onPress}>
              <Text className="text-base text-text-primary">Liftosaur 기록 CSV 가져오기</Text>
            </Pressable>
          </View>
          <View className="items-center justify-center ml-2">
            <Pressable className="p-2" onPress={() => setShowHelp(!showHelp)}>
              <IconHelp />
            </Pressable>
          </View>
        </View>
        {showHelp && (
          <View>
            <InternalLink
              name="download-example-csv"
              href="https://www.liftosaur.com/liftosaur_example_csv.zip"
              className="text-xs text-center font-bold underline text-text-link"
            >
              예시 CSV와 파일 작성 안내를 내려받습니다.
            </InternalLink>
          </View>
        )}
      </View>
    </MenuItemWrapper>
  );
}
