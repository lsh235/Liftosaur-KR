import { JSX, useRef } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { TextInput } from "../primitives/textInput";
import { InputNumber2 } from "../inputNumber2";
import { MenuItemEditable } from "../menuItemEditable";
import { AddButton } from "../addButton";
import { IEquipmentHorn, IPlatesSetup } from "../../types";
import {
  EquipmentSetupEdit_addHorn,
  EquipmentSetupEdit_canAddHorn,
  EquipmentSetupEdit_hornPercents,
  EquipmentSetupEdit_defaultWarmupPlates,
  EquipmentSetupEdit_removeHorn,
  EquipmentSetupEdit_setHornName,
  EquipmentSetupEdit_setHornRatio,
  EquipmentSetupEdit_toggleWarmupPlate,
} from "../../models/equipmentSetupEdit";
import {
  EquipmentEditorActions,
  EquipmentEditorCard,
  EquipmentEditorPlateCounts,
  EquipmentEditorClose,
  EquipmentEditorRemove,
} from "./equipmentEditorParts";
import {
  EquipmentEditorBodyweightActions,
  EquipmentEditorBodyweightCard,
  EquipmentEditorNumberRow,
  IEquipmentEditorSectionProps,
} from "./equipmentEditorShared";

export function EquipmentEditorPlates(props: IEquipmentEditorSectionProps<IPlatesSetup>): JSX.Element {
  const { setup, onChange } = props;
  const horns = setup.horns ?? [];
  const percents = EquipmentSetupEdit_hornPercents(horns);
  return (
    <View>
      <EquipmentEditorCard>
        <EquipmentEditorNumberRow
          label="기본 중량"
          help="바, 벨트, 조끼 또는 빈 머신의 중량"
          unit={setup.unit}
          value={setup.base}
          testID="equipment-base"
          onChange={(base) => onChange({ ...setup, base })}
        />
        {setup.sides === 1 || setup.sides === 2 ? (
          <MenuItemEditable
            name="원판 장착 위치"
            type="select"
            isBorderless={true}
            value={`${setup.sides}`}
            values={[
              ["2", "양쪽"],
              ["1", "한쪽"],
            ]}
            onChange={(value) => onChange({ ...setup, sides: Number(value) })}
          />
        ) : (
          <EquipmentEditorNumberRow
            label="측면 수"
            isLast={true}
            value={setup.sides}
            testID="equipment-sides-count"
            onChange={(sides) => onChange({ ...setup, sides })}
          />
        )}
      </EquipmentEditorCard>
      <EquipmentEditorCard title="보유 원판 · 전체 개수">
        <EquipmentEditorPlateCounts
          plates={setup.plates}
          unit={setup.unit}
          testID="equipment-plates"
          addLabel="원판 무게 추가"
          onAdd={() => props.onAddWeight("plates")}
          onChange={(plates) => onChange({ ...setup, plates })}
        />
      </EquipmentEditorCard>
      {horns.length > 0 && (
        <EquipmentEditorCard
          title="원판 걸이 · 원판 공유"
          right={
            <EquipmentEditorClose
              testID="equipment-horns-remove"
              onPress={() => onChange({ ...setup, horns: undefined })}
            />
          }
          help={
            horns.length > 1
              ? "비율에 따라 원판을 걸이별로 나눕니다. 위 3, 가운데 1이면 가운데 원판 하나마다 위쪽에 세 개를 둡니다."
              : undefined
          }
        >
          {horns.map((horn, index) => (
            <EquipmentEditorHornRow
              key={`${index}-${horn.name}`}
              horn={horn}
              index={index}
              percent={horns.length > 1 ? percents[index] : undefined}
              onRename={(name) => onChange({ ...setup, horns: EquipmentSetupEdit_setHornName(horns, index, name) })}
              onRatio={(ratio) => onChange({ ...setup, horns: EquipmentSetupEdit_setHornRatio(horns, index, ratio) })}
              onRemove={() => onChange({ ...setup, horns: EquipmentSetupEdit_removeHorn(horns, index) })}
            />
          ))}
          {EquipmentSetupEdit_canAddHorn(horns) && (
            <AddButton
              name="equipment-add-horn"
              label="원판 걸이 추가"
              onClick={() => onChange({ ...setup, horns: EquipmentSetupEdit_addHorn(horns) })}
            />
          )}
        </EquipmentEditorCard>
      )}
      {setup.warmupPlates != null && (
        <EquipmentEditorCard
          title="워밍업에 사용할 원판"
          help="워밍업 세트에는 선택한 원판만 사용해 원판 교체를 줄입니다."
          right={
            <EquipmentEditorClose
              testID="equipment-warmup-remove"
              onPress={() => onChange({ ...setup, warmupPlates: undefined })}
            />
          }
        >
          {setup.plates.map((plate, index) => (
            <MenuItemEditable
              key={plate.weight}
              name={`${plate.weight} ${setup.unit}`}
              type="boolean"
              isBorderless={index === setup.plates.length - 1}
              value={setup.warmupPlates!.indexOf(plate.weight) !== -1 ? "true" : "false"}
              onChange={() =>
                onChange({
                  ...setup,
                  warmupPlates: EquipmentSetupEdit_toggleWarmupPlate(setup.warmupPlates!, plate.weight),
                })
              }
            />
          ))}
        </EquipmentEditorCard>
      )}
      <EquipmentEditorBodyweightCard {...props} />
      {props.extraCards}
      <EquipmentEditorActions
        actions={[
          ...(horns.length === 0
            ? [
                {
                  name: "equipment-add-horns",
                  label: "원판 걸이 추가 (다중 걸이 머신)",
                  onClick: () => onChange({ ...setup, horns: EquipmentSetupEdit_addHorn(horns) }),
                },
              ]
            : []),
          ...(setup.warmupPlates == null
            ? [
                {
                  name: "equipment-add-warmup",
                  label: "워밍업 원판 수 줄이기",
                  onClick: () =>
                    onChange({ ...setup, warmupPlates: EquipmentSetupEdit_defaultWarmupPlates(setup.plates) }),
                },
              ]
            : []),
          ...EquipmentEditorBodyweightActions(props, ["adds", "assists"]),
          ...props.extraActions,
        ]}
      />
    </View>
  );
}

interface IHornRowProps {
  horn: IEquipmentHorn;
  index: number;
  percent?: number;
  onRename: (name: string) => void;
  onRatio: (ratio: number) => void;
  onRemove: () => void;
}

function EquipmentEditorHornRow(props: IHornRowProps): JSX.Element {
  const { horn, index } = props;
  const nameRef = useRef(horn.name);
  return (
    <View className="py-2 border-b border-border-cardpurple">
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <TextInput
          className="flex-1 px-2 text-sm border rounded h-scaled-6 border-border-prominent bg-background-default text-text-primary"
          style={{ paddingVertical: 0, includeFontPadding: false }}
          testID={`equipment-horn-name-${index}`}
          data-testid={`equipment-horn-name-${index}`}
          defaultValue={horn.name}
          onChangeText={(text) => {
            nameRef.current = text;
          }}
          onBlur={() => props.onRename(nameRef.current)}
        />
        <Text className="text-sm text-text-secondary">ratio</Text>
        <InputNumber2
          name={`equipment-horn-ratio-${index}`}
          testID={`equipment-horn-ratio-${index}`}
          width={3}
          min={0}
          value={horn.ratio}
          onBlur={(ratio) => {
            if (ratio != null) {
              props.onRatio(ratio);
            }
          }}
        />
        <EquipmentEditorRemove testID={`equipment-horn-remove-${index}`} onPress={props.onRemove} />
      </View>
      {props.percent != null && (
        <Text className="mt-1 text-xs text-text-secondary">{props.percent}% of the plates</Text>
      )}
    </View>
  );
}
