import { JSX } from "react";
import { MenuItemEditable } from "../menuItemEditable";
import { IEquipmentSetup, IWeight } from "../../types";
import {
  EquipmentSetupEdit_bodyweightHelp,
  EquipmentSetupEdit_bodyweightPercent,
  EquipmentSetupEdit_setBodyweight,
  EquipmentSetupEdit_setBodyweightShare,
  IEquipmentBodyweightMode,
} from "../../models/equipmentSetupEdit";
import { EquipmentEditorCard, EquipmentEditorClose } from "./equipmentEditorParts";
import { EquipmentEditorNumberRow } from "./equipmentEditorShared";

interface IProps {
  setup: IEquipmentSetup;
  mode: IEquipmentBodyweightMode;
  bodyweight: IWeight;
  isBodyweightLogged: boolean;
  onChange: (setup: IEquipmentSetup) => void;
}

export function EquipmentEditorBodyweight(props: IProps): JSX.Element {
  const isAssisting = props.mode === "assists";
  return (
    <EquipmentEditorCard
      title={isAssisting ? "보조 중량 설정" : "체중 포함 중량 설정"}
      help={EquipmentSetupEdit_bodyweightHelp(props.setup, props.bodyweight, props.isBodyweightLogged)}
      right={
        <EquipmentEditorClose
          testID="equipment-bodyweight-remove"
          onPress={() => props.onChange(EquipmentSetupEdit_setBodyweight(props.setup, "none", false))}
        />
      }
    >
      {isAssisting ? (
        <MenuItemEditable
          name="프로그램 중량 기준"
          type="select"
          isBorderless={true}
          value={props.setup.bodyweight != null ? "total" : "load"}
          values={[
            ["load", "보조 중량만 표시 (음수)"],
            ["total", "체중 − 보조 중량"],
          ]}
          onChange={(value) =>
            props.onChange(EquipmentSetupEdit_setBodyweight(props.setup, "assists", value === "total"))
          }
        />
      ) : (
        <EquipmentEditorNumberRow
          label="체중 반영 비율"
          help="푸시업처럼 체중 일부만 사용하는 운동은 100%보다 낮게 설정하세요."
          unit="%"
          min={1}
          max={100}
          isLast={true}
          value={EquipmentSetupEdit_bodyweightPercent(props.setup)}
          testID="equipment-bodyweight-share"
          onChange={(value) => props.onChange(EquipmentSetupEdit_setBodyweightShare(props.setup, value))}
        />
      )}
    </EquipmentEditorCard>
  );
}
