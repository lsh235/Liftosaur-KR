import { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { MenuItemEditable } from "../menuItemEditable";
import { IStackSetup } from "../../types";
import { EquipmentSetupEdit_pinNumbersExample } from "../../models/equipmentSetupEdit";
import {
  EquipmentEditorActions,
  EquipmentEditorCard,
  EquipmentEditorPlateCounts,
  EquipmentEditorRanges,
  EquipmentEditorClose,
  EquipmentEditorValues,
} from "./equipmentEditorParts";
import {
  EquipmentEditorBodyweightActions,
  EquipmentEditorBodyweightCard,
  EquipmentEditorNumberRow,
  IEquipmentEditorSectionProps,
} from "./equipmentEditorShared";

const PULL_RATIOS: { ratio: number; label: string }[] = [
  { ratio: 1, label: "동일" },
  { ratio: 0.5, label: "절반" },
  { ratio: 0.25, label: "4분의 1" },
];

export function EquipmentEditorStack(props: IEquipmentEditorSectionProps<IStackSetup>): JSX.Element {
  const { setup, onChange } = props;
  const hasAddOns = setup.builtin != null || setup.addOn != null;
  return (
    <View>
      <EquipmentEditorCard
        title={setup.direction === "assists" ? `보조 중량 스택 · ${setup.unit}` : `중량 스택 · ${setup.unit}`}
      >
        <EquipmentEditorRanges
          ranges={setup.ranges}
          unit={setup.unit}
          testID="equipment-stack"
          addLabel="스택 일부에 다른 간격 추가"
          onChange={(ranges) => onChange({ ...setup, ranges })}
        />
      </EquipmentEditorCard>
      {setup.pullRatio != null && (
        <EquipmentEditorCard
          title="당김 비율"
          help={`잘 모르겠다면 "동일"을 선택하세요.`}
          right={
            <EquipmentEditorClose
              testID="equipment-ratio-remove"
              onPress={() => onChange({ ...setup, pullRatio: undefined })}
            />
          }
        >
          <MenuItemEditable
            name={`스택 표시가 100 ${setup.unit}일 때 실제 당기는 중량`}
            type="select"
            isBorderless={true}
            value={`${setup.pullRatio}`}
            values={PULL_RATIOS.map<[string, string]>((o) => [
              `${o.ratio}`,
              `${100 * o.ratio} ${setup.unit}, ${o.label}`,
            ])}
            onChange={(value) => onChange({ ...setup, pullRatio: Number(value) })}
          />
        </EquipmentEditorCard>
      )}
      {setup.stackCount != null && (
        <EquipmentEditorCard
          title="함께 연결된 스택 수"
          right={
            <EquipmentEditorClose
              testID="equipment-stacks-remove"
              onPress={() => onChange({ ...setup, stackCount: undefined })}
            />
          }
        >
          <EquipmentEditorNumberRow
            label="스택 수"
            help="각 스택에 같은 핀을 꽂습니다. 위 범위는 스택 하나 기준입니다."
            isLast={true}
            min={2}
            max={4}
            value={setup.stackCount}
            testID="equipment-stacks"
            onChange={(stackCount) => onChange({ ...setup, stackCount })}
          />
        </EquipmentEditorCard>
      )}
      {setup.showPinNumbers && (
        <EquipmentEditorCard
          title="중량 대신 핀 번호 표시"
          help={EquipmentSetupEdit_pinNumbersExample(setup)}
          right={
            <EquipmentEditorClose
              testID="equipment-pin-numbers-remove"
              onPress={() => onChange({ ...setup, showPinNumbers: undefined })}
            />
          }
        >
          <View className="pt-1" />
        </EquipmentEditorCard>
      )}
      {setup.base != null && (
        <EquipmentEditorCard
          right={
            <EquipmentEditorClose
              testID="equipment-base-remove"
              onPress={() => onChange({ ...setup, base: undefined })}
            />
          }
          title="스택과 항상 함께 드는 중량"
        >
          <EquipmentEditorNumberRow
            label="중량"
            help="스택 표시 중량에 포함되지 않는 손잡이나 이동 장치의 무게"
            unit={setup.unit}
            isLast={true}
            value={setup.base}
            testID="equipment-base"
            onChange={(base) => onChange({ ...setup, base })}
          />
        </EquipmentEditorCard>
      )}
      {setup.builtin != null && (
        <EquipmentEditorCard
          title="기본 중량 · 세트마다 하나 선택"
          right={
            <EquipmentEditorClose
              testID="equipment-builtin-remove"
              onPress={() => onChange({ ...setup, builtin: undefined })}
            />
          }
        >
          <EquipmentEditorValues
            values={setup.builtin}
            unit={setup.unit}
            testID="equipment-builtin"
            addLabel="기본 중량 추가"
            onAdd={() => props.onAddWeight("builtin")}
            onChange={(builtin) => onChange({ ...setup, builtin })}
          />
        </EquipmentEditorCard>
      )}
      {setup.addOn != null && (
        <EquipmentEditorCard
          title="추가 원판 · 함께 장착"
          right={
            <EquipmentEditorClose
              testID="equipment-addon-remove"
              onPress={() => onChange({ ...setup, addOn: undefined })}
            />
          }
        >
          <EquipmentEditorPlateCounts
            plates={setup.addOn}
            unit={setup.unit}
            testID="equipment-addon"
            addLabel="원판 무게 추가"
            onAdd={() => props.onAddWeight("addOn")}
            onChange={(addOn) => onChange({ ...setup, addOn })}
          />
        </EquipmentEditorCard>
      )}
      {hasAddOns && (
        <EquipmentEditorCard>
          <MenuItemEditable
            name="워밍업에는 추가 중량 제외"
            type="boolean"
            isBorderless={true}
            value={setup.skipAddOnsInWarmups ? "true" : "false"}
            underName={<Text className="text-xs text-text-secondary">워밍업에는 스택 중량만 사용합니다</Text>}
            onChange={(value) => onChange({ ...setup, skipAddOnsInWarmups: value === "true" || undefined })}
          />
        </EquipmentEditorCard>
      )}
      <EquipmentEditorBodyweightCard {...props} />
      {props.extraCards}
      <EquipmentEditorActions
        actions={[
          ...(setup.builtin == null
            ? [
                {
                  name: "equipment-add-builtin",
                  label: "Add built-in weights (lever, drop-down, knob)",
                  onClick: () => onChange({ ...setup, builtin: [] }),
                },
              ]
            : []),
          ...(setup.addOn == null
            ? [
                {
                  name: "equipment-add-addon",
                  label: "Add plates you add (magnets, small blocks)",
                  onClick: () => onChange({ ...setup, addOn: [] }),
                },
              ]
            : []),
          ...(setup.pullRatio == null
            ? [
                {
                  name: "equipment-add-ratio",
                  label: "Add pull ratio",
                  onClick: () => onChange({ ...setup, pullRatio: 1 }),
                },
              ]
            : []),
          ...(setup.stackCount == null
            ? [
                {
                  name: "equipment-add-stacks",
                  label: "Add a second stack pinned together",
                  onClick: () => onChange({ ...setup, stackCount: 2 }),
                },
              ]
            : []),
          ...(!setup.showPinNumbers
            ? [
                {
                  name: "equipment-add-pin-numbers",
                  label: "Show pin numbers instead of weights",
                  onClick: () => onChange({ ...setup, showPinNumbers: true }),
                },
              ]
            : []),
          ...(setup.base == null
            ? [
                {
                  name: "equipment-add-base",
                  label: "Add weight that always lifts with the stack",
                  onClick: () => onChange({ ...setup, base: 0 }),
                },
              ]
            : []),
          ...EquipmentEditorBodyweightActions(props, ["assists"]),
          ...props.extraActions,
        ]}
      />
    </View>
  );
}
