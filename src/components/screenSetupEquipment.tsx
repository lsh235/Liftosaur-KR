import { JSX } from "react";
import { View, Image, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./primitives/text";
import { Switch } from "./primitives/switch";
import { IDispatch } from "../ducks/types";
import { ISettings, IStats } from "../types";
import { INavCommon, IState } from "../models/state";
import { useNavOptions } from "../navigation/useNavOptions";
import { Thunk_pushScreen } from "../ducks/thunks";
import { Button } from "./button";
import { EquipmentList, equipmentToIcon } from "./equipmentList";
import { Equipment_getCurrentGym, Equipment_getEquipmentData, Equipment_getEquipmentOfGym } from "../models/equipment";
import { lb } from "lens-shmens";
import { ObjectUtils_keys } from "../utils/object";
import { ImagePreloader_uri } from "../utils/imagePreloader";
import { Tailwind_colors, Tailwind_semantic } from "../utils/tailwindConfig";
import { navigateToModal } from "../navigation/navigationService";
import { ExercisePickerUtils_getEquipmentName } from "./exercisePicker/exercisePickerUtils";

function getFooterShadowStyle(): Record<string, unknown> {
  const semantic = Tailwind_semantic();
  const colors = Tailwind_colors();
  return Platform.select({
    ios: {
      shadowColor: semantic.background.default === colors.black ? colors.white : colors.black,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: { elevation: 4 },
    default: { boxShadow: "0 0 4px 0 rgba(0, 0, 0, 0.2)" },
  }) as Record<string, unknown>;
}

interface IScreenSetupEquipmentProps {
  dispatch: IDispatch;
  settings: ISettings;
  selectedGymId?: string;
  stats: IStats;
  navCommon: INavCommon;
}

export function ScreenSetupEquipment(props: IScreenSetupEquipmentProps): JSX.Element {
  const currentGym = Equipment_getCurrentGym(props.settings);
  const allEquipment = Equipment_getEquipmentOfGym(props.settings, props.selectedGymId);
  const insets = useSafeAreaInsets();

  useNavOptions({ navHidden: true });

  return (
    <View className="flex flex-col flex-1 bg-background-default" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-8 pb-4">
        <View className="items-center p-4">
          <Image
            source={{ uri: ImagePreloader_uri("/images/dinoequipment.png") }}
            className="h-60"
            style={{ width: 240, height: 240 }}
            resizeMode="contain"
          />
        </View>
        <View className="px-2 -mt-1">
          <Text className="mb-2 text-xl font-bold text-center text-text-primary">
            사용할 수 있는 운동 기구를 선택하세요.
          </Text>
          <Text className="mb-4 text-sm text-center text-text-secondary">
            운동할 때 사용할 수 있는 기구를 켜세요. 설정한 기구와 원판에 맞춰 실제로 들 수 있는 중량을 계산합니다.
          </Text>

          <View style={{ gap: 8 }}>
            {ObjectUtils_keys(allEquipment).map((eqid) => {
              const equipmentData = Equipment_getEquipmentData(props.settings, eqid);
              const isEnabled = equipmentData && !equipmentData.isDeleted;
              const name = equipmentData?.name?.trim() || ExercisePickerUtils_getEquipmentName(eqid);
              const icon = equipmentToIcon[eqid] ? equipmentToIcon[eqid]() : null;
              return (
                <Pressable
                  key={eqid}
                  testID={`equipment-toggle-${eqid}`}
                  data-testid={`equipment-toggle-${eqid}`}
                  className={`flex-row items-center px-4 py-3 border rounded-xl ${
                    isEnabled
                      ? "bg-background-subtlecardpurple border-border-cardpurple"
                      : "bg-background-default border-border-neutral"
                  }`}
                  style={{ gap: 12 }}
                  onPress={() => {
                    props.dispatch({
                      type: "UpdateState",
                      lensRecording: [
                        lb<IState>()
                          .p("storage")
                          .p("settings")
                          .p("gyms")
                          .findBy("id", currentGym.id)
                          .p("equipment")
                          .pi(eqid)
                          .p("isDeleted")
                          .record(!isEnabled ? false : true),
                      ],
                      desc: `Toggle equipment ${eqid}`,
                    });
                  }}
                >
                  {icon && <View>{icon}</View>}
                  <Text className="flex-1 text-sm font-semibold">{name}</Text>
                  <Switch
                    value={!!isEnabled}
                    onValueChange={() => {
                      props.dispatch({
                        type: "UpdateState",
                        lensRecording: [
                          lb<IState>()
                            .p("storage")
                            .p("settings")
                            .p("gyms")
                            .findBy("id", currentGym.id)
                            .p("equipment")
                            .pi(eqid)
                            .p("isDeleted")
                            .record(!isEnabled ? false : true),
                        ],
                        desc: `Toggle equipment ${eqid}`,
                      });
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <View className="bg-background-default" style={[{ paddingBottom: insets.bottom || 8 }, getFooterShadowStyle()]}>
        <View className="flex-row px-gutter pt-2 pb-2" style={{ gap: 8 }}>
          <Button
            className="flex-1 ls-onboarding-equipment-skip"
            name="setup-equipment-skip"
            kind="lightgrayv3"
            buttonSize="lg"
            data-testid="setup-equipment-skip"
            testID="setup-equipment-skip"
            onClick={() => props.dispatch(Thunk_pushScreen("hearaboutus"))}
          >
            건너뛰기
          </Button>
          <Button
            className="flex-1 ls-onboarding-equipment-setup"
            name="setup-equipment-continue"
            kind="purple"
            buttonSize="lg"
            data-testid="setup-equipment-continue"
            testID="setup-equipment-continue"
            onClick={() => props.dispatch(Thunk_pushScreen("setupplates"))}
          >
            원판 설정
          </Button>
        </View>
      </View>
    </View>
  );
}

interface IScreenSetupPlatesProps {
  dispatch: IDispatch;
  settings: ISettings;
  stats: IStats;
  navCommon: INavCommon;
}

export function ScreenSetupPlates(props: IScreenSetupPlatesProps): JSX.Element {
  const currentGym = Equipment_getCurrentGym(props.settings);
  const insets = useSafeAreaInsets();

  useNavOptions({ navTitle: "원판 설정" });

  return (
    <View className="flex flex-col flex-1 bg-background-default" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1 bg-background-default"
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="never"
        keyboardDismissMode="interactive"
      >
        <View className="items-center p-4">
          <Image
            source={{ uri: ImagePreloader_uri("/images/dinoplates.png") }}
            style={{ width: 220, height: 208 }}
            resizeMode="contain"
          />
        </View>
        <View className="px-gutter pb-4">
          <Text className="mb-2 text-xl font-bold text-center text-text-primary">바와 원판을 설정하세요.</Text>
          <Text className="text-sm text-center text-text-secondary">
            기구를 눌러 <Text className="text-sm font-bold text-text-secondary">바와 원판</Text> 또는 중량 스택을
            설정하세요. 설정한 기구로 실제 장착할 수 있는 중량을 계산합니다.
          </Text>
        </View>
        <EquipmentList
          gymId={currentGym.id}
          allEquipment={currentGym.equipment}
          settings={props.settings}
          dispatch={props.dispatch}
          onOpen={(equipmentId) =>
            props.dispatch(Thunk_pushScreen("equipmentDetail", { gymId: currentGym.id, equipmentId }))
          }
          onAdd={() => navigateToModal("newEquipmentModal", { gymId: currentGym.id })}
        />
      </ScrollView>
      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4 bg-background-default"
        style={[{ paddingBottom: insets.bottom || 16 }, getFooterShadowStyle()]}
      >
        <Button
          className="w-full ls-onboarding-plates"
          name="setup-plates-continue"
          kind="purple"
          buttonSize="lg"
          onClick={() => props.dispatch(Thunk_pushScreen("hearaboutus"))}
          data-testid="setup-plates-continue"
          testID="setup-plates-continue"
        >
          계속
        </Button>
      </View>
    </View>
  );
}
