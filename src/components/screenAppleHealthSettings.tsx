import type { JSX } from "react";
import { View } from "react-native";
import { IDispatch } from "../ducks/types";
import { lb } from "lens-shmens";
import { MenuItemEditable } from "./menuItemEditable";
import { ISettings } from "../types";
import { INavCommon } from "../models/state";
import { useNavOptions } from "../navigation/useNavOptions";
import { Thunk_syncHealthKit } from "../ducks/thunks";

interface IProps {
  dispatch: IDispatch;
  settings: ISettings;
  navCommon: INavCommon;
}

export function ScreenAppleHealthSettings(props: IProps): JSX.Element {
  useNavOptions({ navTitle: "Apple 건강" });

  return (
    <View className="px-gutter">
      <MenuItemEditable
        name="운동 기록 동기화"
        type="boolean"
        value={props.settings.appleHealthSyncWorkout ? "true" : "false"}
        onChange={(newValue?: string) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("appleHealthSyncWorkout")
              .record(newValue === "true"),
            desc: "Toggle Apple Health workouts",
          });
        }}
      />
      <MenuItemEditable
        name="운동을 동기화할 때마다 확인"
        type="boolean"
        value={props.settings.healthConfirmation ? "true" : "false"}
        onChange={(newValue?: string) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("healthConfirmation")
              .record(newValue === "true"),
            desc: "Toggle Health workout confirmation",
          });
        }}
      />
      <MenuItemEditable
        name="신체 측정 기록 동기화"
        type="boolean"
        value={props.settings.appleHealthSyncMeasurements ? "true" : "false"}
        onChange={(newValue?: string) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("appleHealthSyncMeasurements")
              .record(newValue === "true"),
            desc: "Toggle Apple Health measurements",
          });
        }}
      />
      <MenuItemEditable
        name="수면·영양 기록 동기화"
        type="boolean"
        value={props.settings.appleHealthSyncSleepNutrition ? "true" : "false"}
        onChange={(newValue?: string) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("appleHealthSyncSleepNutrition")
              .record(newValue === "true"),
            desc: "Toggle Apple Health sleep & nutrition",
          });
          if (newValue === "true") {
            props.dispatch(Thunk_syncHealthKit());
          }
        }}
      />
    </View>
  );
}
