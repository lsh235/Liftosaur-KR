import type { JSX } from "react";
import { Platform, View } from "react-native";
import { IDispatch } from "../ducks/types";
import { Lens, lb } from "lens-shmens";
import { MenuItemEditable } from "./menuItemEditable";
import { ISettingsTimers, ISettings } from "../types";
import { INavCommon } from "../models/state";
import { useNavOptions } from "../navigation/useNavOptions";
import { GroupHeader } from "./groupHeader";

interface IProps {
  dispatch: IDispatch;
  timers: ISettingsTimers;
  navCommon: INavCommon;
}

export function ScreenTimers(props: IProps): JSX.Element {
  const onChange = (key: keyof ISettingsTimers) => {
    return (newValue?: string) => {
      const v = newValue != null && newValue !== "" ? parseInt(newValue, 10) : undefined;
      if (v != null && isNaN(v)) {
        return;
      }
      const lensRecording = Lens.buildLensRecording(lb<ISettings>().p("timers").p(key), v);
      props.dispatch({ type: "UpdateSettings", lensRecording, desc: `Update ${key} timer` });
    };
  };

  useNavOptions({ navTitle: "타이머 설정", navHelpKey: "timers" });

  return (
    <View className="px-gutter">
      <GroupHeader name="세트 간 휴식 시간" />
      <MenuItemEditable
        name="워밍업 세트"
        type="number"
        value={props.timers.warmup?.toString() || undefined}
        valueUnits="초"
        onChange={onChange("warmup")}
      />
      <MenuItemEditable
        name="일반 세트"
        type="number"
        value={props.timers.workout?.toString() || undefined}
        valueUnits="초"
        onChange={onChange("workout")}
      />
      <MenuItemEditable
        name="슈퍼세트"
        type="number"
        value={props.timers.superset?.toString()}
        valueUnits="초"
        onChange={onChange("superset")}
      />
      <GroupHeader name="시간 지정 세트" topPadding={true} />
      <MenuItemEditable
        name="시작 전 준비 시간"
        type="number"
        value={props.timers.getReady?.toString()}
        valueUnits="초"
        onChange={onChange("getReady")}
      />
      {(Platform.OS === "ios" || Platform.OS === "android") && (
        <>
          <GroupHeader name="운동 알림" topPadding={true} />
          <MenuItemEditable
            name="운동 종료 확인 알림"
            type="number"
            value={props.timers.reminder?.toString() || undefined}
            valueUnits="초"
            onChange={onChange("reminder")}
          />
        </>
      )}
    </View>
  );
}
