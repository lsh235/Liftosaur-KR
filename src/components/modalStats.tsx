import type { JSX } from "react";
import { View } from "react-native";

import { IDispatch } from "../ducks/types";
import { MenuItemEditable } from "./menuItemEditable";
import { ISettings, IStatsLength, IStatsPercentage, IStatsWeight } from "../types";
import {
  EditStats_toggleWeightStats,
  EditStats_toggleLengthStats,
  EditStats_togglePercentageStats,
} from "../models/editStats";
import { GroupHeader } from "./groupHeader";

interface IModalStatsProps {
  dispatch: IDispatch;
  settings: ISettings;
  isHidden: boolean;
  onClose: () => void;
}

export function ModalStatsContent(props: IModalStatsProps): JSX.Element {
  const statsEnabled = props.settings.statsEnabled;

  function saveWeight(name: keyof IStatsWeight): (v?: string) => void {
    return function (v?: string) {
      EditStats_toggleWeightStats(props.dispatch, name, v === "true");
    };
  }

  function saveLength(name: keyof IStatsLength): (v?: string) => void {
    return function (v?: string) {
      EditStats_toggleLengthStats(props.dispatch, name, v === "true");
    };
  }

  function savePercentage(name: keyof IStatsPercentage): (v?: string) => void {
    return function (v?: string) {
      EditStats_togglePercentageStats(props.dispatch, name, v === "true");
    };
  }

  return (
    <View className="py-4">
      <GroupHeader name="기록할 신체 측정 항목" />
      <View data-testid="modal-stats" testID="modal-stats">
        <MenuItemEditable
          onChange={saveWeight("weight")}
          name="체중"
          type="boolean"
          value={`${statsEnabled.weight.weight}`}
        />
        <MenuItemEditable
          onChange={savePercentage("bodyfat")}
          name="체지방률"
          type="boolean"
          value={`${statsEnabled.percentage.bodyfat}`}
        />
        <MenuItemEditable
          onChange={saveLength("neck")}
          name="목"
          type="boolean"
          value={`${statsEnabled.length.neck}`}
        />
        <MenuItemEditable
          onChange={saveLength("shoulders")}
          name="어깨"
          type="boolean"
          value={`${statsEnabled.length.shoulders}`}
        />
        <MenuItemEditable
          onChange={saveLength("bicepLeft")}
          name="왼쪽 이두근"
          type="boolean"
          value={`${statsEnabled.length.bicepLeft}`}
        />
        <MenuItemEditable
          onChange={saveLength("bicepRight")}
          name="오른쪽 이두근"
          type="boolean"
          value={`${statsEnabled.length.bicepRight}`}
        />
        <MenuItemEditable
          onChange={saveLength("forearmLeft")}
          name="왼쪽 전완근"
          type="boolean"
          value={`${statsEnabled.length.forearmLeft}`}
        />
        <MenuItemEditable
          onChange={saveLength("forearmRight")}
          name="오른쪽 전완근"
          type="boolean"
          value={`${statsEnabled.length.forearmRight}`}
        />
        <MenuItemEditable
          onChange={saveLength("chest")}
          name="가슴"
          type="boolean"
          value={`${statsEnabled.length.chest}`}
        />
        <MenuItemEditable
          onChange={saveLength("waist")}
          name="허리"
          type="boolean"
          value={`${statsEnabled.length.waist}`}
        />
        <MenuItemEditable
          onChange={saveLength("hips")}
          name="엉덩이"
          type="boolean"
          value={`${statsEnabled.length.hips}`}
        />
        <MenuItemEditable
          onChange={saveLength("thighLeft")}
          name="왼쪽 허벅지"
          type="boolean"
          value={`${statsEnabled.length.thighLeft}`}
        />
        <MenuItemEditable
          onChange={saveLength("thighRight")}
          name="오른쪽 허벅지"
          type="boolean"
          value={`${statsEnabled.length.thighRight}`}
        />
        <MenuItemEditable
          onChange={saveLength("calfLeft")}
          name="왼쪽 종아리"
          type="boolean"
          value={`${statsEnabled.length.calfLeft}`}
        />
        <MenuItemEditable
          onChange={saveLength("calfRight")}
          name="오른쪽 종아리"
          type="boolean"
          value={`${statsEnabled.length.calfRight}`}
        />
      </View>
    </View>
  );
}
