import { JSX, ReactNode } from "react";
import { View, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./primitives/text";
import { Path } from "./primitives/svg";
import { IconSvg } from "./icons/iconSvg";
import { IDispatch } from "../ducks/types";
import { ISettings } from "../types";
import { useNavOptions } from "../navigation/useNavOptions";
import { Thunk_importProgram, Thunk_pushScreen } from "../ducks/thunks";
import { IconDoc } from "./icons/iconDoc";
import { navigateToModal } from "../navigation/navigationService";
import { IconEditSquare } from "./icons/iconEditSquare";
import { IconLink } from "./icons/iconLink";
import { emptyProgramId, Program_selectProgramAndGoHome } from "../models/program";
import { IconEquipmentKettlebell } from "./icons/iconEquipmentKettlebell";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { BundledImages_resolve } from "../utils/bundledImages";
import { useTrackClick } from "../utils/clickTracking";
import { FileImport_pickFile } from "../utils/fileImport";
import { FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES } from "../utils/fileImportLimits";

interface IScreenProgramSelectProps {
  dispatch: IDispatch;
  settings: ISettings;
}

interface IOption {
  key: string;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

export function ScreenProgramSelect(props: IScreenProgramSelectProps): JSX.Element {
  useNavOptions({ navHidden: true });
  const insets = useSafeAreaInsets();
  const trackClick = useTrackClick();

  const options: IOption[] = [
    {
      key: "builtin",
      icon: <IconDoc width={24} height={24} />,
      title: "기본 프로그램 선택",
      description: "5/3/1, GZCLP 등 검증된 운동 루틴에서 선택합니다.",
      onClick: () => props.dispatch(Thunk_pushScreen("programs")),
    },
    {
      key: "create",
      icon: <IconEditSquare />,
      title: "프로그램 직접 만들기",
      description: "원하는 운동 루틴을 처음부터 구성합니다.",
      onClick: () => navigateToModal("createProgramModal"),
    },
    {
      key: "import",
      icon: <IconLink size={24} />,
      title: "링크로 가져오기",
      description: "프로그램 웹 편집기에서 복사한 링크를 붙여 넣습니다.",
      onClick: () => navigateToModal("importFromLinkModal"),
    },
    {
      key: "import-ai",
      icon: <IconLink size={24} />,
      title: "AI 운동 루틴 파일 가져오기",
      description: "외부 AI가 만든 JSON 또는 CSV 운동 계획을 불러옵니다.",
      onClick: async () => {
        const contents = await FileImport_pickFile("any", { maxSizeBytes: FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES });
        if (contents != null) {
          props.dispatch(Thunk_importProgram({ decoded: contents }));
        }
      },
    },
    {
      key: "adhoc",
      icon: <IconEquipmentKettlebell size={24} />,
      title: "프로그램 없이 시작",
      description: "자유 운동으로 시작하고 수행하면서 프로그램을 만들어 갑니다.",
      onClick: () => Program_selectProgramAndGoHome(props.dispatch, emptyProgramId),
    },
  ];

  return (
    <View
      className="flex flex-col flex-1 bg-background-default"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-1 px-gutter pt-8 pb-4">
        <View className="items-center p-4">
          <Image
            source={BundledImages_resolve("/images/tigerfit-mascot.png")}
            style={{ width: 208, height: 208 }}
            resizeMode="contain"
          />
        </View>
        <View className="px-2 -mt-1">
          <Text className="mb-2 text-xl font-bold text-center text-text-primary">운동 프로그램 선택</Text>
          <Text className="mb-6 text-sm text-center text-text-secondary">어떤 방식으로 운동을 시작할까요?</Text>

          <View className="gap-3">
            {options.map((opt) => (
              <Pressable
                key={opt.key}
                className="flex-row items-center w-full gap-3 px-4 py-4 border rounded-xl bg-background-subtlecardpurple border-border-cardpurple nm-program-select"
                data-testid={`program-select-${opt.key}`}
                testID={`program-select-${opt.key}`}
                onPress={() => {
                  trackClick(`program-select-${opt.key}`, `ls-onboarding-program-${opt.key}`);
                  opt.onClick();
                }}
              >
                <View>{opt.icon}</View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold">{opt.title}</Text>
                  <Text className="text-xs text-text-secondary">{opt.description}</Text>
                </View>
                <View>
                  <IconSvg width={16} height={16} viewBox="0 0 16 16" fill="none">
                    <Path
                      d="M6 4l4 4-4 4"
                      stroke={Tailwind_semantic().icon.neutral}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </IconSvg>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
