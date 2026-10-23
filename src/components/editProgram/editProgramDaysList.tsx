import type { JSX } from "react";
import { View } from "react-native";
import { IDispatch } from "../../ducks/types";
import { INavCommon } from "../../models/state";
import { IProgram, ISettings } from "../../types";
import { useNavOptions } from "../../navigation/useNavOptions";
import { MigrationBanner } from "../migrationBanner";
import { Thunk_pushScreen } from "../../ducks/thunks";
import { GroupHeader } from "../groupHeader";
import { MenuItem } from "../menuItem";

interface IProps {
  editProgram: IProgram;
  dispatch: IDispatch;
  settings: ISettings;
  navCommon: INavCommon;
}

export function EditProgramDaysList(props: IProps): JSX.Element {
  useNavOptions({ navTitle: "프로그램 편집" });

  const fetchFn =
    typeof window !== "undefined"
      ? window.fetch.bind(window)
      : ((): Window["fetch"] => {
          return (input: RequestInfo | URL, init?: RequestInit) => fetch(input as RequestInfo, init);
        })();

  return (
    <View className="px-4">
      <MigrationBanner program={props.editProgram} settings={props.settings} client={fetchFn} />
      <GroupHeader name="현재 프로그램" />
      <MenuItem
        name="프로그램"
        value={props.editProgram.name}
        expandValue={true}
        shouldShowRightArrow={true}
        onClick={() => props.dispatch(Thunk_pushScreen("programs"))}
      />
    </View>
  );
}
