import { JSX, useState } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { MenuItemEditable } from "../menuItemEditable";
import { MarkdownEditorBorderless } from "../markdownEditorBorderless";
import { IEquipmentSetup, IUnit } from "../../types";
import { EquipmentSetup_convertUnit } from "../../models/equipmentSetup";
import { EquipmentSetupEdit_setRounding, EquipmentSetupEdit_unitChoice } from "../../models/equipmentSetupEdit";
import { Dialog_choice } from "../../utils/dialog";
import { EquipmentEditorCard, EquipmentEditorClose, IEquipmentEditorAction } from "./equipmentEditorParts";

interface IProps {
  setup: IEquipmentSetup;
  appUnit: IUnit;
  notes?: string;
  onUpdate: (setup: IEquipmentSetup) => void;
  onNotes: (notes: string) => void;
}

async function changeUnit(props: IProps, unit: IUnit): Promise<void> {
  if (unit === props.setup.unit) {
    return;
  }
  const choice = await Dialog_choice(`${unit} 단위로 변경`, "중량 값을 변환할까요, 숫자를 그대로 둘까요?", [
    `중량 변환 (45 lb → 20 kg)`,
    "숫자 유지",
    "취소",
  ]);
  const mode = EquipmentSetupEdit_unitChoice(choice);
  if (mode != null) {
    props.onUpdate(EquipmentSetup_convertUnit(props.setup, unit, mode));
  }
}

export function useEquipmentEditorCommon(props: IProps): { cards: JSX.Element; actions: IEquipmentEditorAction[] } {
  const [isUnitOpen, setIsUnitOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const { setup } = props;
  const isRoundingShown = setup.rounding != null;
  const isUnitShown = isUnitOpen || setup.unit !== props.appUnit;
  const isNotesShown = isNotesOpen || !!props.notes;

  const cards = (
    <View>
      {isRoundingShown && (
        <EquipmentEditorCard
          title="반올림 설정"
          right={
            <EquipmentEditorClose
              testID="equipment-rounding-remove"
              onPress={() => props.onUpdate(EquipmentSetupEdit_setRounding(setup, undefined))}
            />
          }
        >
          <MenuItemEditable
            name="반올림 기준"
            type="select"
            isBorderless={true}
            value={setup.rounding}
            values={[
              ["down", "내림"],
              ["nearest", "가장 가까운 값"],
            ]}
            underName={
              <Text className="text-xs text-text-secondary">
                {setup.rounding === "nearest"
                  ? "실제로 장착할 수 있는 가장 가까운 중량"
                  : "프로그램 목표 중량보다 무겁게 반올림하지 않습니다"}
              </Text>
            }
            onChange={(value) => props.onUpdate(EquipmentSetupEdit_setRounding(setup, value))}
          />
        </EquipmentEditorCard>
      )}
      {isUnitShown && (
        <EquipmentEditorCard
          title="중량 단위"
          right={
            <EquipmentEditorClose
              testID="equipment-unit-remove"
              onPress={async () => {
                await changeUnit(props, props.appUnit);
                setIsUnitOpen(false);
              }}
            />
          }
        >
          <MenuItemEditable
            name="중량 표시 단위"
            type="select"
            isBorderless={true}
            value={setup.unit}
            values={[
              ["lb", "lb"],
              ["kg", "kg"],
            ]}
            underName={<Text className="text-xs text-text-secondary">앱 기본 단위: {props.appUnit}</Text>}
            onChange={(value) => {
              if (value === "lb" || value === "kg") {
                changeUnit(props, value);
              }
            }}
          />
        </EquipmentEditorCard>
      )}
      {isNotesShown && (
        <EquipmentEditorCard
          title="메모"
          right={
            <EquipmentEditorClose
              testID="equipment-notes-remove"
              onPress={() => {
                props.onNotes("");
                setIsNotesOpen(false);
              }}
            />
          }
        >
          <View className="pb-2" style={{ marginLeft: -4, marginRight: -4 }}>
            <MarkdownEditorBorderless
              debounceMs={500}
              value={props.notes}
              placeholder="좌석 높이, 핀 위치, 참고 사항…"
              onChange={props.onNotes}
            />
          </View>
        </EquipmentEditorCard>
      )}
    </View>
  );

  const actions: IEquipmentEditorAction[] = [
    ...(isRoundingShown
      ? []
      : [
          {
            name: "equipment-add-rounding",
            label: "Change rounding",
            onClick: () => props.onUpdate(EquipmentSetupEdit_setRounding(setup, "down")),
          },
        ]),
    ...(isUnitShown
      ? []
      : [{ name: "equipment-add-unit", label: "Use a different unit", onClick: () => setIsUnitOpen(true) }]),
    ...(isNotesShown ? [] : [{ name: "equipment-add-notes", label: "Add notes", onClick: () => setIsNotesOpen(true) }]),
  ];

  return { cards, actions };
}
