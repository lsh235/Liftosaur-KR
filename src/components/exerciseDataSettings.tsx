import { JSX, memo } from "react";
import { View } from "react-native";
import { Text } from "./primitives/text";
import { lb } from "lens-shmens";
import { IDispatch } from "../ducks/types";
import {
  localizedEquipmentName,
  IExercise,
  Exercise_defaultRounding,
  Exercise_getIsUnilateral,
  Exercise_getVolumeMultiplier,
  Exercise_toKey,
} from "../models/exercise";
import { updateState, IState, updateSettings } from "../models/state";
import { Weight_build } from "../models/weight";
import { ISettings } from "../types";
import { ObjectUtils_keys } from "../utils/object";
import { ExerciseRM } from "./exerciseRm";
import { GroupHeader } from "./groupHeader";
import { InputNumber } from "./inputNumber";
import { MenuItemEditable } from "./menuItemEditable";
import {
  EditEquipment_setDefaultRoundingForExercise,
  EditEquipment_setEquipmentForExercise,
} from "../models/editEquipment";
import { Equipment_getEquipmentIdForExerciseType } from "../models/equipment";

interface IExerciseDataSettingsProps {
  settings: ISettings;
  dispatch: IDispatch;
  programExerciseIds: string[];
  fullExercise: IExercise;
  show1RM: boolean;
}

function ExerciseDataSettingsInner(props: IExerciseDataSettingsProps): JSX.Element {
  const fullExercise = props.fullExercise;

  return (
    <View className="my-2">
      <InputNumber
        type="number"
        label="기본 중량 조정 단위"
        min={0}
        step={0.5}
        max={100}
        value={Exercise_defaultRounding(fullExercise, props.settings)}
        onUpdate={(value) => {
          EditEquipment_setDefaultRoundingForExercise(props.dispatch, fullExercise, value);
        }}
      />
      <Text className="text-xs text-right text-text-secondary">기구를 지정하지 않았을 때 적용합니다</Text>
      {props.settings.gyms.length > 1 && (
        <View className="mt-2">
          <GroupHeader name="헬스장별 기구" />
        </View>
      )}
      {props.settings.gyms.map((gym, i) => {
        const equipment = Equipment_getEquipmentIdForExerciseType(props.settings, props.fullExercise, gym.id);
        const values: [string, string][] = [
          ["", "미지정"],
          ...ObjectUtils_keys(gym.equipment)
            .filter((e) => !gym.equipment[e]?.isDeleted)
            .map<[string, string]>((id) => [id, localizedEquipmentName(id, gym.equipment)]),
        ];
        return (
          <MenuItemEditable
            key={gym.id}
            type="select"
            name={props.settings.gyms.length > 1 ? gym.name : "기구"}
            underName={
              props.settings.gyms.length > 1 && props.settings.currentGymId === gym.id ? (
                <Text className="text-xs leading-none text-text-secondary">현재 헬스장</Text>
              ) : undefined
            }
            value={equipment ?? ""}
            values={values}
            onChange={(value) => {
              EditEquipment_setEquipmentForExercise(
                fullExercise,
                value,
                props.programExerciseIds,
                props.dispatch,
                props.settings,
                gym.id
              );
            }}
          />
        );
      })}
      <MenuItemEditable
        type="boolean"
        name="편측 운동"
        value={Exercise_getIsUnilateral(fullExercise, props.settings) ? "true" : "false"}
        onChange={(value) => {
          const isUnilateral = value === "true";
          updateSettings(
            props.dispatch,
            lb<ISettings>()
              .p("exerciseData")
              .recordModify((exerciseData) => {
                const k = Exercise_toKey(fullExercise);
                return { ...exerciseData, [k]: { ...exerciseData[k], isUnilateral } };
              }),
            "Set exercise unilateral setting"
          );
        }}
      />
      <MenuItemEditable
        type="boolean"
        name="양쪽 중량을 합산해 볼륨 계산"
        value={Exercise_getVolumeMultiplier(fullExercise, props.settings) === 2 ? "true" : "false"}
        onChange={(value) => {
          const volumeMultiplier = value === "true" ? 2 : 1;
          updateSettings(
            props.dispatch,
            lb<ISettings>()
              .p("exerciseData")
              .recordModify((exerciseData) => {
                const k = Exercise_toKey(fullExercise);
                return { ...exerciseData, [k]: { ...exerciseData[k], volumeMultiplier } };
              }),
            "Set exercise two-weights setting"
          );
        }}
      />

      {props.show1RM && (
        <ExerciseRM
          name="1회 최대 중량 (1RM)"
          rmKey="rm1"
          exercise={fullExercise}
          settings={props.settings}
          onEditVariable={(value) => {
            updateState(
              props.dispatch,
              [
                lb<IState>()
                  .p("storage")
                  .p("settings")
                  .p("exerciseData")
                  .recordModify((data) => {
                    const k = Exercise_toKey(fullExercise);
                    return { ...data, [k]: { ...data[k], rm1: Weight_build(value, props.settings.units) } };
                  }),
              ],
              "Update 1RM for exercise"
            );
          }}
        />
      )}
    </View>
  );
}

export const ExerciseDataSettings = memo(ExerciseDataSettingsInner);
