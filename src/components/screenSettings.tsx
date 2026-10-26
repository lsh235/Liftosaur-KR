import { JSX, memo, useEffect, useRef, useState } from "react";
import { Distribution_isLocalOnly, Distribution_localOnlyMessage } from "../utils/distribution";
import { Dialog_alert } from "../utils/dialog";
import { View, Pressable, Linking, Platform } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { MenuItem, MenuItemWrapper } from "./menuItem";
import {
  Thunk_pushScreen,
  Thunk_exportStorage,
  Thunk_exportHistoryToCSV,
  Thunk_exportProgramsToText,
  Thunk_exportAiFeedbackMarkdown,
} from "../ducks/thunks";
import { MenuItemEditable } from "./menuItemEditable";
import { lb } from "lens-shmens";
import { InternalLink } from "../internalLink";
import { IUser } from "../models/user";
import { ClipboardUtils_copy } from "../utils/clipboard";
import { Share_generateProfileLink } from "../models/share";
import { IImportSession, ILengthUnit, IProgram, ISettings, IStats, ISubscription, IUnit } from "../types";
import { WhatsNew_showWhatsNew } from "../models/whatsnewUtils";
import { ImporterStorage } from "./importerStorage";
import { ImporterProgram } from "./importerProgram";
import { useNavOptions } from "../navigation/useNavOptions";
import { GroupHeader } from "./groupHeader";
import { StringUtils_truncate } from "../utils/string";
import { IconDiscord } from "./icons/iconDiscord";
import { IconSpeaker } from "./icons/iconSpeaker";
import { ImporterLiftosaurCsv } from "./importerLiftosaurCsv";
import { navigateToModal } from "../navigation/navigationService";
import { Subscriptions_hasSubscription } from "../utils/subscriptions";
import { HealthSync_eligibleForAppleHealth, HealthSync_eligibleForGoogleHealth } from "../lib/healthSync";
import { INavCommon } from "../models/state";
import { Stats_getCurrentBodyweight, Stats_getCurrentBodyfat } from "../models/stats";
import { Weight_print } from "../models/weight";
import { Settings_getTextSize, TEXT_SIZE_MIN, TEXT_SIZE_MAX, TEXT_SIZE_STEP } from "../models/settings";
import { TextSize_apply } from "../utils/textSize";
import { useOsFontScale } from "../utils/fontScale";
import { LinkButton } from "./linkButton";
import { Features_isEnabled } from "../utils/features";
import { Slider } from "./primitives/slider";
import { usePerfRenderCount } from "../utils/usePerfRenderCount";
import { useModal } from "../navigation/ModalStateContext";

interface IProps {
  dispatch: IDispatch;
  subscription: ISubscription;
  tempUserId?: string;
  stats: IStats;
  user?: IUser;
  currentProgramName?: string;
  settings: ISettings;
  importSessions?: IImportSession[];
  programs: IProgram[];
  navCommon: INavCommon;
}

function openExternal(url: string): void {
  Linking.openURL(url).catch(() => undefined);
}

function ScreenSettingsInner(props: IProps): JSX.Element {
  usePerfRenderCount("ScreenSettings");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const selectedAiFeedbackProgramId = useRef<string | undefined>(undefined);
  const openAiFeedbackExport = useModal("editDetailsModal", (details) => {
    props.dispatch(
      Thunk_exportAiFeedbackMarkdown(details.name, details.description || "", selectedAiFeedbackProgramId.current)
    );
    selectedAiFeedbackProgramId.current = undefined;
  });
  const openAiFeedbackProgramSelect = useModal("inputSelectModal", (value) => {
    selectedAiFeedbackProgramId.current = value === "all" ? undefined : value || undefined;
    const selectedProgram = props.programs.find((program) => program.id === selectedAiFeedbackProgramId.current);
    openAiFeedbackExport({
      title: "AI 피드백용 Markdown 내보내기",
      nameLabel: "보고서 제목",
      namePlaceholder: "예: 6주 PHAT 수행 기록",
      descriptionPlaceholder: "프로그램 총평, 통증이나 불편 부위, 다음 루틴에 반영할 요청을 적어 주세요.",
      submitLabel: "Markdown 내보내기",
      cancelLabel: "취소",
      requiredMessage: "보고서 제목을 입력해 주세요.",
      dataCyPrefix: "ai-feedback-export",
      name: selectedProgram ? selectedProgram.name + " 수행 기록" : "AI 운동 수행 기록",
    });
  });
  const osFontScale = useOsFontScale();
  // This screen reads settings via `untrack`, so it doesn't re-render when `theme` changes.
  // Track the choice locally so the select shows the tap instead of snapping back.
  const [theme, setTheme] = useState<"dark" | "light" | undefined>(props.settings.theme);
  useEffect(() => {
    setTheme(props.settings.theme);
  }, [props.settings]);
  const currentBodyweight = Stats_getCurrentBodyweight(props.stats);
  const currentBodyfat = Stats_getCurrentBodyfat(props.stats);

  useNavOptions({ navTitle: "내 정보", navHelpKey: "settings" });
  const localOnly = Distribution_isLocalOnly();
  const policyPending = (): void => {
    Dialog_alert("한국 배포용 운영자 정보와 정식 정책은 준비 중입니다. 현재 후보는 계정·클라우드·결제를 제공하지 않으며, 운동 이미지 조회와 사용자가 여는 외부 링크는 인터넷을 이용할 수 있습니다. 앱 삭제 전 전체 데이터를 파일로 백업해 주세요.");
  };

  return (
    <View className="px-gutter">
      <MenuItem
        shouldShowRightArrow={true}
        name="프로그램"
        value={props.currentProgramName}
        onClick={() => {
          props.dispatch(Thunk_pushScreen("programs"));
        }}
      />
      <GroupHeader name="계정" topPadding={true} />
      {localOnly && <Text className="py-3 text-sm text-text-secondary">{Distribution_localOnlyMessage}</Text>}
      <MenuItem
        name="계정"
        value={
          localOnly ? "기기에 저장" : props.user?.email == null ? (
            <Text className="text-text-error">로그인되지 않음</Text>
          ) : props.user?.email === "noemail@example.com" ? (
            "로그인됨"
          ) : (
            StringUtils_truncate(props.user?.email || "", 30)
          )
        }
        shouldShowRightArrow={true}
        onClick={() => props.dispatch(Thunk_pushScreen("account"))}
      />
      <MenuItemEditable
        type="text"
        name="별명"
        value={props.settings.nickname || ""}
        nextLine={
          <View className="pb-1" style={{ marginTop: -8 }}>
            <Text className="text-xs text-text-secondary">{localOnly ? "이 기기에 저장되는 이름입니다." : "로그인하면 공개 프로필 페이지에 표시됩니다."}</Text>
          </View>
        }
        onChange={(newValue) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("nickname")
              .record(newValue ? newValue : undefined),
            desc: "Update nickname",
          });
        }}
      />
      {!localOnly && props.user && (
        <MenuItemEditable
          type="boolean"
          name="프로필 페이지 공개"
          value={props.settings.isPublicProfile ? "true" : "false"}
          nextLine={
            props.user?.id && props.settings.isPublicProfile ? (
              <View className="pb-1" style={{ marginTop: -8 }}>
                <View className="flex-row">
                  <Pressable
                    className="mr-auto"
                    onPress={() => {
                      const text = Share_generateProfileLink(props.user!.id);
                      if (text != null) {
                        ClipboardUtils_copy(text);
                        setIsCopied(true);
                      }
                    }}
                  >
                    <Text className="text-xs underline text-text-link">프로필 링크 복사</Text>
                  </Pressable>
                  <View className="ml-4">
                    <InternalLink
                      name="public-profile-page"
                      href={`/profile/${props.user.id}`}
                      className="text-xs underline text-text-link"
                    >
                      공개 프로필 열기
                    </InternalLink>
                  </View>
                </View>
                {isCopied && <Text className="text-xs italic text-text-success">복사했습니다.</Text>}
              </View>
            ) : undefined
          }
          onChange={(newValue) => {
            if (props.user != null) {
              props.dispatch({
                type: "UpdateSettings",
                lensRecording: lb<ISettings>()
                  .p("isPublicProfile")
                  .record(newValue === "true"),
                desc: "Toggle public profile",
              });
            }
          }}
        />
      )}

      {!localOnly && <MenuItem name="API 키" shouldShowRightArrow={true} onClick={() => props.dispatch(Thunk_pushScreen("apiKeys"))} />}

      <GroupHeader name="신체 정보" topPadding={true} />
      {currentBodyweight && (
        <MenuItem
          name="체중"
          value={Weight_print(currentBodyweight)}
          shouldShowRightArrow={true}
          onClick={() => props.dispatch(Thunk_pushScreen("measurements", { key: "weight" }))}
        />
      )}
      {currentBodyfat && (
        <MenuItem
          name="체지방률"
          value={Weight_print(currentBodyfat)}
          shouldShowRightArrow={true}
          onClick={() => props.dispatch(Thunk_pushScreen("measurements", { key: "bodyfat" }))}
        />
      )}
      <MenuItem
        name="측정 기록"
        shouldShowRightArrow={true}
        onClick={() => props.dispatch(Thunk_pushScreen("measurements"))}
      />
      <MenuItem
        name="수면 및 영양"
        shouldShowRightArrow={true}
        onClick={() => props.dispatch(Thunk_pushScreen("sleepNutrition"))}
      />

      <GroupHeader name="운동" topPadding={true} />
      <MenuItem
        name="운동 종목"
        onClick={() => props.dispatch(Thunk_pushScreen("exercises"))}
        shouldShowRightArrow={true}
      />
      <MenuItem
        name="근육 그룹"
        onClick={() => props.dispatch(Thunk_pushScreen("muscleGroups"))}
        shouldShowRightArrow={true}
      />
      <MenuItem name="타이머" onClick={() => props.dispatch(Thunk_pushScreen("timers"))} shouldShowRightArrow={true} />
      {props.settings.gyms.length > 1 && (
        <MenuItemEditable
          type="select"
          name="현재 운동 장소"
          value={props.settings.currentGymId ?? props.settings.gyms[0].id}
          values={props.settings.gyms.map((g) => [g.id, g.name])}
          onChange={(newValue) => {
            if (newValue != null) {
              props.dispatch({
                type: "UpdateSettings",
                lensRecording: lb<ISettings>().p("currentGymId").record(newValue),
                desc: "Change current gym",
              });
            }
          }}
        />
      )}
      <MenuItem
        shouldShowRightArrow={true}
        name="운동 기구 설정"
        onClick={() => {
          if (props.settings.gyms.length > 1) {
            props.dispatch(Thunk_pushScreen("gyms"));
          } else {
            props.dispatch(Thunk_pushScreen("plates"));
          }
        }}
      />
      <MenuItemEditable
        type="select"
        name="중량 단위"
        value={props.settings.units}
        values={[
          ["kg", "kg"],
          ["lb", "lb"],
        ]}
        onChange={(newValue) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("units")
              .record(newValue as IUnit),
            desc: "Change weight units",
          });
        }}
      />
      <MenuItemEditable
        type="select"
        name="길이 단위"
        value={props.settings.lengthUnits}
        values={[
          ["cm", "cm"],
          ["in", "in"],
        ]}
        onChange={(newValue) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("lengthUnits")
              .record(newValue as ILengthUnit),
            desc: "Change length units",
          });
        }}
      />
      <MenuItemEditable
        type="select"
        name="한 주 시작 요일"
        value={props.settings.startWeekFromMonday ? "true" : "false"}
        values={[
          ["false", "일요일"],
          ["true", "월요일"],
        ]}
        onChange={(newValue) => {
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>()
              .p("startWeekFromMonday")
              .record(newValue === "true"),
            desc: "Toggle week start day",
          });
        }}
      />
      {(Platform.OS === "ios" || Platform.OS === "android") && (
        <MenuItemEditable
          type="boolean"
          name="화면 항상 켜기"
          value={props.settings.alwaysOnDisplay ? "true" : "false"}
          onChange={(newValue) => {
            props.dispatch({
              type: "UpdateSettings",
              lensRecording: lb<ISettings>()
                .p("alwaysOnDisplay")
                .record(newValue === "true"),
              desc: "Toggle always-on display",
            });
          }}
        />
      )}
      {(Platform.OS === "ios" || Platform.OS === "android") && (
        <View>
          <GroupHeader name="알림 및 소리" topPadding={true} />
          <MenuItemEditable
            type="boolean"
            name="진동"
            value={props.settings.vibration ? "true" : "false"}
            onChange={(newValue) => {
              props.dispatch({
                type: "UpdateSettings",
                lensRecording: lb<ISettings>()
                  .p("vibration")
                  .record(newValue === "true"),
                desc: "Toggle vibration",
              });
            }}
          />
          <MenuItemWrapper name="volume">
            <View className="flex-row items-center py-2">
              <View className="mr-2">
                <IconSpeaker />
              </View>
              <View className="flex-row flex-1">
                <Slider
                  value={props.settings.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) => {
                    props.dispatch({
                      type: "UpdateSettings",
                      lensRecording: lb<ISettings>().p("volume").record(value),
                      desc: "Change volume",
                    });
                  }}
                />
              </View>
            </View>
          </MenuItemWrapper>
          {Subscriptions_hasSubscription(props.subscription) && Platform.OS === "android" && (
            <MenuItemEditable
              type="boolean"
              name="방해 금지 모드 무시"
              value={props.settings.ignoreDoNotDisturb ? "true" : "false"}
              nextLine={
                <View className="mb-2" style={{ marginTop: -8 }}>
                  <Text className="text-xs text-text-secondary">
                    무음 또는 방해 금지 모드에서도 운동 알림 소리가 재생됩니다.
                  </Text>
                </View>
              }
              onChange={(newValue) => {
                props.dispatch({
                  type: "UpdateSettings",
                  lensRecording: lb<ISettings>()
                    .p("ignoreDoNotDisturb")
                    .record(newValue === "true"),
                  desc: "Toggle ignore DND",
                });
              }}
            />
          )}
        </View>
      )}
      {(HealthSync_eligibleForAppleHealth() || HealthSync_eligibleForGoogleHealth()) && (
        <>
          <GroupHeader name="건강 데이터 연동" topPadding={true} />
          {HealthSync_eligibleForGoogleHealth() && (
            <MenuItem
              shouldShowRightArrow={true}
              name="Google Health Connect"
              onClick={() => props.dispatch(Thunk_pushScreen("googleHealth"))}
            />
          )}
          {HealthSync_eligibleForAppleHealth() && (
            <MenuItem
              shouldShowRightArrow={true}
              name="Apple Health"
              onClick={() => props.dispatch(Thunk_pushScreen("appleHealth"))}
            />
          )}
        </>
      )}
      <GroupHeader name="화면 설정" topPadding={true} />
      <MenuItemWrapper name="text-size">
        <View className="py-2">
          <View className="flex-row items-center">
            <View className="flex-row items-baseline mr-2">
              <Text className="text-xs">A</Text>
              <Text className="text-lg">A</Text>
            </View>
            <View className="flex-row flex-1">
              <Slider
                value={Settings_getTextSize(props.settings, osFontScale)}
                min={TEXT_SIZE_MIN}
                max={TEXT_SIZE_MAX}
                step={TEXT_SIZE_STEP}
                onChange={(value) => {
                  TextSize_apply(value);
                  props.dispatch({
                    type: "UpdateSettings",
                    lensRecording: lb<ISettings>().p("textSize").record(value),
                    desc: "Change text size",
                  });
                }}
              />
            </View>
          </View>
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-xs text-text-secondary">
              {props.settings.textSize == null ? "기기 글자 크기와 동일" : "앱에서 글자 크기 설정"}
            </Text>
            {props.settings.textSize != null && (
              <LinkButton
                name="text-size-reset"
                className="text-xs font-normal"
                onClick={() => {
                  TextSize_apply(Settings_getTextSize({ ...props.settings, textSize: undefined }, osFontScale));
                  props.dispatch({
                    type: "UpdateSettings",
                    lensRecording: lb<ISettings>().p("textSize").record(undefined),
                    desc: "Follow device text size",
                  });
                }}
              >
                기기 설정 사용
              </LinkButton>
            )}
          </View>
        </View>
      </MenuItemWrapper>
      <MenuItemEditable
        type="select"
        name="화면 테마"
        value={theme ?? "system"}
        values={[
          ["system", "기기 설정 따르기"],
          ["light", "밝게"],
          ["dark", "어둡게"],
        ]}
        onChange={(newValue) => {
          const newTheme = newValue === "dark" || newValue === "light" ? newValue : undefined;
          setTheme(newTheme);
          props.dispatch({
            type: "UpdateSettings",
            lensRecording: lb<ISettings>().p("theme").record(newTheme),
            desc: "Change theme",
          });
        }}
      />
      {!localOnly && Features_isEnabled("affiliates", props.user?.id ?? props.tempUserId) && (
        <>
          <GroupHeader name="TigerFit 제휴 프로그램" topPadding={true} />
          <MenuItem
            expandName={true}
            name="제휴 프로그램 참여"
            onClick={() => navigateToModal("affiliateModal")}
            value={props.settings.affiliateEnabled ? "사용" : "사용 안 함"}
            shouldShowRightArrow={true}
          />
        </>
      )}
      <GroupHeader name="가져오기 / 내보내기" topPadding={true} />
      <MenuItemWrapper name="운동 데이터 JSON 백업" onClick={() => props.dispatch(Thunk_exportStorage())}>
        <View className="py-3">
          <Text className="text-base text-text-primary">운동 데이터 JSON으로 백업</Text>
        </View>
      </MenuItemWrapper>
      <MenuItemWrapper name="운동 기록 CSV 내보내기" onClick={() => props.dispatch(Thunk_exportHistoryToCSV())}>
        <View className="py-3">
          <Text className="text-base text-text-primary">운동 기록을 CSV로 내보내기</Text>
        </View>
      </MenuItemWrapper>
      <MenuItemWrapper
        name="AI 피드백용 운동 기록 Markdown 내보내기"
        onClick={() =>
          openAiFeedbackProgramSelect({
            name: "ai-feedback-export-program",
            hint: "내보낼 기록의 범위를 선택하세요.",
            values: [
              ["all", "전체 프로그램 기록"],
              ...props.programs.map((program): [string, string] => [program.id, program.name]),
            ],
            selectedValue: "all",
          })
        }
      >
        <View className="py-3">
          <Text className="text-base text-text-primary">AI 피드백용 Markdown 내보내기</Text>
          <Text className="pt-1 text-sm text-text-secondary">
            전체 기록 또는 선택한 프로그램의 기록과 총평 메모를 LLM 분석용 파일로 저장합니다.
          </Text>
        </View>
      </MenuItemWrapper>
      <MenuItemWrapper
        name="전체 프로그램 텍스트 내보내기"
        onClick={() => props.dispatch(Thunk_exportProgramsToText())}
      >
        <View className="py-3">
          <Text className="text-base text-text-primary">전체 프로그램을 텍스트로 내보내기</Text>
        </View>
      </MenuItemWrapper>
      <ImporterLiftosaurCsv dispatch={props.dispatch} />
      <ImporterStorage dispatch={props.dispatch} />
      <ImporterProgram dispatch={props.dispatch} />
      <MenuItemWrapper name="다른 앱의 운동 기록 가져오기" onClick={() => navigateToModal("importFromOtherAppsModal")}>
        <View className="py-3">
          <Text className="text-base text-text-primary">다른 앱의 운동 기록 가져오기</Text>
        </View>
      </MenuItemWrapper>
      {(props.importSessions ?? []).length > 0 && (
        <MenuItem
          shouldShowRightArrow={true}
          name="최근 가져온 기록"
          onClick={() => props.dispatch(Thunk_pushScreen("recentImports"))}
        />
      )}

      <GroupHeader name="기타" topPadding={true} />
      <MenuItem name="업데이트 내역" onClick={() => WhatsNew_showWhatsNew(props.dispatch)} />
      <Pressable
        className="py-3 border-b border-border-neutral"
        onPress={() => openExternal(localOnly ? "https://github.com/lsh235/Liftosaur-KR/issues" : "mailto:info@liftosaur.com")}
      >
        <Text className="text-base text-text-primary">문의하기</Text>
      </Pressable>
      <Pressable
        className="py-3 border-b border-border-neutral"
        onPress={() => openExternal(localOnly ? "https://github.com/lsh235/Liftosaur-KR" : "https://discord.com/invite/AAh3cvdBRs")}
      >
        <View className="flex-row items-center">
          <View className="pr-2">
            <IconDiscord />
          </View>
          <Text className="text-base text-text-primary">{localOnly ? "프로젝트 저장소" : "Discord 커뮤니티"}</Text>
        </View>
      </Pressable>
      <Pressable
        className="py-3 border-b border-border-neutral"
        onPress={() => localOnly ? policyPending() : openExternal("https://www.liftosaur.com/privacy.html")}
      >
        <Text className="text-base text-text-primary">개인정보 처리방침</Text>
      </Pressable>
      <Pressable
        className="py-3 border-b border-border-neutral"
        onPress={() => localOnly ? policyPending() : openExternal("https://www.liftosaur.com/terms.html")}
      >
        <Text className="text-base text-text-primary">이용 약관</Text>
      </Pressable>
      {localOnly ? (
        <>
          <Pressable
            className="py-3 border-b border-border-neutral"
            onPress={() => openExternal("https://github.com/lsh235/Liftosaur-KR/blob/master/LICENSE")}
          >
            <Text className="text-base text-text-primary">앱 코드 라이선스</Text>
          </Pressable>
          <Pressable
            className="py-3 border-b border-border-neutral"
            onPress={() => openExternal("https://github.com/lsh235/Liftosaur-KR/blob/master/src/licenses.html")}
          >
            <Text className="text-base text-text-primary">제삼자 라이선스 고지</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          className="py-3 border-b border-border-neutral"
          onPress={() => openExternal("https://www.liftosaur.com/licenses.html")}
        >
          <Text className="text-base text-text-primary">오픈소스 라이선스</Text>
        </Pressable>
      )}
      <Pressable
        className="py-3 border-b border-border-neutral"
        onPress={() => openExternal("https://www.liftosaur.com/doc")}
      >
        <Text className="text-base text-text-primary">문서</Text>
      </Pressable>
      <Pressable
        className="py-3 border-b border-border-neutral"
        onPress={() => openExternal("https://github.com/astashov/liftosaur")}
      >
        <Text className="text-base text-text-primary">GitHub 소스 코드</Text>
      </Pressable>
      <Pressable
        className="py-3 border-b border-border-neutral"
        onPress={() => openExternal("https://github.com/astashov/liftosaur/discussions")}
      >
        <Text className="text-base text-text-primary">📍 개발 로드맵</Text>
      </Pressable>
    </View>
  );
}

export const ScreenSettings = memo(ScreenSettingsInner);
