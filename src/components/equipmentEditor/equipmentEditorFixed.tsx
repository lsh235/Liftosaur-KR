import { JSX } from "react";
import { View } from "react-native";
import { IElectricSetup, IFixedSetup } from "../../types";
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

export function EquipmentEditorFixed(props: IEquipmentEditorSectionProps<IFixedSetup>): JSX.Element {
  const { setup, onChange } = props;
  return (
    <View>
      <EquipmentEditorCard title={`중량 · ${setup.unit}`}>
        <EquipmentEditorRanges
          ranges={setup.ranges}
          unit={setup.unit}
          testID="equipment-fixed"
          addLabel="중량 범위 추가"
          allowEmpty={true}
          onChange={(ranges) => onChange({ ...setup, ranges })}
        />
      </EquipmentEditorCard>
      <EquipmentEditorCard title="범위에 포함되지 않는 개별 중량">
        <EquipmentEditorValues
          values={setup.values}
          unit={setup.unit}
          testID="equipment-single"
          addLabel="개별 중량 추가"
          onAdd={() => props.onAddWeight("values")}
          onChange={(values) => onChange({ ...setup, values })}
        />
      </EquipmentEditorCard>
      {setup.addOn != null && (
        <EquipmentEditorCard
          title="추가 원판"
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
      <EquipmentEditorBodyweightCard {...props} />
      {props.extraCards}
      <EquipmentEditorActions
        actions={[
          ...(setup.addOn == null
            ? [
                {
                  name: "equipment-add-addon",
                  label: "추가 원판 설정 (소수 단위 원판)",
                  onClick: () => onChange({ ...setup, addOn: [] }),
                },
              ]
            : []),
          ...EquipmentEditorBodyweightActions(props, ["adds"]),
          ...props.extraActions,
        ]}
      />
    </View>
  );
}

export function EquipmentEditorElectric(props: IEquipmentEditorSectionProps<IElectricSetup>): JSX.Element {
  const { setup, onChange } = props;
  return (
    <View>
      <EquipmentEditorCard help={`Any weight from ${setup.min} to ${setup.max}, in ${setup.step} ${setup.unit} steps.`}>
        <EquipmentEditorNumberRow
          label="최소"
          unit={setup.unit}
          value={setup.min}
          testID="equipment-min"
          onChange={(min) => onChange({ ...setup, min })}
        />
        <EquipmentEditorNumberRow
          label="최대"
          unit={setup.unit}
          value={setup.max}
          testID="equipment-max"
          onChange={(max) => onChange({ ...setup, max })}
        />
        <EquipmentEditorNumberRow
          label="간격"
          unit={setup.unit}
          isLast={true}
          value={setup.step}
          testID="equipment-step"
          onChange={(step) => onChange({ ...setup, step })}
        />
      </EquipmentEditorCard>
      {props.extraCards}
      <EquipmentEditorActions actions={props.extraActions} />
    </View>
  );
}
