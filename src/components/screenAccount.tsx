import { JSX, useEffect, useState } from "react";
import { Distribution_isLocalOnly, Distribution_localOnlyMessage } from "../utils/distribution";
import { View, Pressable, Platform, AppState } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import {
  Thunk_logOut,
  Thunk_googleSignIn,
  Thunk_appleSignIn,
  Thunk_switchAccount,
  Thunk_deleteAccount,
  Thunk_createAccount,
  Thunk_deleteAccountRemote,
  Thunk_pushScreen,
  Thunk_openManageSubscriptions,
  Thunk_iapRefreshActiveSubscriptions,
  Thunk_fetchAccounts,
} from "../ducks/thunks";
import { INavCommon } from "../models/state";
import { useNavOptions } from "../navigation/useNavOptions";
import { Button } from "./button";
import { IAccount } from "../models/account";
import { AdminDebug_isDebugAccountId } from "../models/adminDebug";
import { IPartialStorage } from "../types";
import { GroupHeader } from "./groupHeader";
import { MenuItem } from "./menuItem";
import { IconDoc } from "./icons/iconDoc";
import { IconDumbbell } from "./icons/iconDumbbell";
import { IconGoogle } from "./icons/iconGoogle";
import { LinkButton } from "./linkButton";
import { IconTrash } from "./icons/iconTrash";
import { IconApple } from "./icons/iconApple";
import { IconSpinner } from "./icons/iconSpinner";
import { Dialog_confirm, Dialog_prompt, Dialog_alert } from "../utils/dialog";
import { EmailAuthButton } from "./account";
import { navigateToModal } from "../navigation/navigationService";
import { Tailwind_colors, Tailwind_semantic } from "../utils/tailwindConfig";
import { IIapActiveSubscription } from "../utils/iapAdapter";
import { SubscriptionPlan_derive, ISubscriptionPlanKind, IDerivedSubscriptionPlan } from "../utils/subscriptionPlan";
import { DateUtils_format } from "../utils/date";
import { StoreRuntime_isIos } from "../utils/storeRuntime";

declare let __HOST__: string;

interface IProps {
  email?: string;
  userId?: string;
  nosync?: boolean;
  storage: IPartialStorage;
  subscriptionStatus?: IIapActiveSubscription[];
  subscriptionStatusLoading?: boolean;
  ownedLifetime?: boolean;
  navCommon: INavCommon;
  dispatch: IDispatch;
}

export function ScreenAccount(props: IProps): JSX.Element {
  const [otherAccounts, setOtherAccounts] = useState<IAccount[]>([]);
  const [isOtherAccountsEditMode, setIsOtherAccountsEditMode] = useState<boolean>(false);

  const localOnly = Distribution_isLocalOnly();
  const currentAccountId = props.userId || props.storage.tempUserId;
  const currentAccount: IAccount = {
    id: currentAccountId,
    email: props.email,
    name: props.storage.settings.nickname,
    numberOfPrograms: props.storage.programs?.length ?? 0,
    numberOfWorkouts: props.storage.history?.length ?? 0,
    affiliateEnabled: props.storage.settings.affiliateEnabled,
    isCurrent: true,
  };

  function refetchAccounts(): void {
    props.dispatch(
      Thunk_fetchAccounts((accounts) => {
        setOtherAccounts(accounts.filter((a) => a.id !== currentAccountId));
      })
    );
  }

  useEffect(() => {
    refetchAccounts();
  }, [currentAccountId]);

  useEffect(() => {
    if (localOnly) return;
    props.dispatch(Thunk_iapRefreshActiveSubscriptions());
    // Re-check on foreground so a cancel/change made in the system subscription manager (App Store /
    // Google Play) — e.g. after tapping "Cancel subscription" here — is reflected when the user returns.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        props.dispatch(Thunk_iapRefreshActiveSubscriptions());
      }
    });
    return () => sub.remove();
  }, []);

  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  const plan = SubscriptionPlan_derive({
    subscription: props.storage.subscription,
    status: props.subscriptionStatus,
    ownedLifetime: props.ownedLifetime,
    isNative,
    isIos: Platform.OS === "ios",
  });
  // "loading" = native subscriber whose store status hasn't arrived yet (status undefined). Spinning here
  // (rather than flashing "Free plan") covers the first render and a failed getActiveSubscriptions(); once a
  // known status arrives a re-check keeps showing it instead of flipping back to a spinner.
  const isLoadingSubscription = plan.state === "loading";

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.AppleID?.auth) {
      window.AppleID.auth.init({
        clientId: "com.liftosaur.www.signinapple",
        scope: "email",
        redirectURI: `${__HOST__}/appleauthcallback.html`,
        usePopup: true,
      });
    }
  }, []);

  useNavOptions({ navTitle: "계정", navHelpKey: "account" });

  const premiumCard = buildPremiumCard(plan);

  const semantic = Tailwind_semantic();
  const colors = Tailwind_colors();
  const googleShadow = Platform.select({
    ios: {
      shadowColor: semantic.background.default === colors.black ? colors.white : colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: { boxShadow: "0 1px 4px 0 rgba(0,0,0,0.1)" },
  });

  return (
    <View className="px-gutter">
      <GroupHeader name="현재 계정" />
      {localOnly && <Text className="py-3 text-sm text-text-secondary">{Distribution_localOnlyMessage}</Text>}
      <MenuItem
        isBorderless={true}
        expandName={true}
        name={currentAccount.name ? currentAccount.name : `id: ${currentAccount.id}`}
        value={
          <View className="flex-row items-center">
            <Text className="pr-2 text-text-primary">{currentAccount.numberOfPrograms}</Text>
            <View className="pr-4">
              <IconDoc width={12} height={16} />
            </View>
            <Text className="pr-2 text-text-primary">{currentAccount.numberOfWorkouts}</Text>
            <View>
              <IconDumbbell width={28} height={19} />
            </View>
          </View>
        }
        addons={
          <View>
            {AdminDebug_isDebugAccountId(currentAccount.id) ? (
              <Text className="-mt-1 text-xs font-bold text-text-error">
                {props.nosync ? "디버그 · 동기화 꺼짐" : "디버그 · 서버 동기화 켜짐"}
              </Text>
            ) : null}
            {currentAccount.name ? (
              <Text className="-mt-1 text-xs text-text-secondary">{`id: ${currentAccount.id}`}</Text>
            ) : null}
            {localOnly ? (
              <Text className="text-xs text-text-secondary">이 기기에 저장된 계정 · 클라우드 연결 꺼짐</Text>
            ) : props.email ? (
              props.email === "noemail@example.com" ? null : (
                <Text className="text-xs text-text-secondary">
                  로그인 계정: <Text className="text-sm font-bold text-text-secondary">{props.email}</Text>
                </Text>
              )
            ) : (
              <Text className="text-xs text-text-error">클라우드 계정에 로그인하지 않았습니다</Text>
            )}
          </View>
        }
      />
      {!localOnly && (props.email ? (
        <View className="items-center">
          <Button
            name="account-sign-out"
            kind="purple"
            data-testid="menu-item-logout"
            className="ls-logout"
            onClick={() => props.dispatch(Thunk_logOut())}
          >
            로그아웃
          </Button>
          <View className="mt-3">
            <LinkButton
              name="account-change-password"
              className="text-sm"
              onPress={() => navigateToModal("changePasswordModal")}
            >
              비밀번호 변경
            </LinkButton>
          </View>
        </View>
      ) : (
        <View>
          <Pressable
            className="flex-row items-center w-full px-4 py-2 mt-2 rounded-lg nm-sign-in-with-google bg-background-default"
            style={googleShadow}
            data-testid="menu-item-login"
            testID="menu-item-login"
            onPress={() => props.dispatch(Thunk_googleSignIn())}
          >
            <View>
              <IconGoogle />
            </View>
            <Text className="flex-1 ml-2 text-base text-center">Google로 로그인</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center w-full px-4 py-3 mt-2 bg-black rounded-lg nm-sign-in-with-apple"
            onPress={() => props.dispatch(Thunk_appleSignIn())}
          >
            <View style={{ marginTop: -3 }}>
              <IconApple />
            </View>
            <Text className="flex-1 ml-2 text-base text-center text-text-alwayswhite">Apple로 로그인</Text>
          </Pressable>
          <EmailAuthButton onPress={() => navigateToModal("emailAuthModal")} />
        </View>
      ))}
      {!localOnly && <>
      <GroupHeader name="🌟 TigerFit 프리미엄" topPadding={true} />
      {isLoadingSubscription ? (
        <MenuItem name="구독 정보를 확인하고 있습니다…" expandName={true} value={<IconSpinner width={18} height={18} />} />
      ) : (
        <>
          <MenuItem
            name={premiumCard.title}
            value={premiumCard.actionLabel}
            shouldShowRightArrow={!!premiumCard.actionLabel}
            expandName={true}
            onClick={premiumCard.actionLabel ? () => props.dispatch(Thunk_pushScreen("subscription")) : undefined}
            addons={
              premiumCard.subtitle ? (
                <Text className="-mt-1 text-xs text-text-secondary">{premiumCard.subtitle}</Text>
              ) : undefined
            }
          />
          {premiumCard.showCancel && (
            <View className="pt-1">
              <LinkButton
                name="account-cancel-subscription"
                className="text-sm text-text-error"
                onClick={() => props.dispatch(Thunk_openManageSubscriptions())}
              >
                구독 취소
              </LinkButton>
            </View>
          )}
        </>
      )}
      </>}
      <GroupHeader
        name="다른 로컬 계정"
        topPadding={true}
        rightAddOn={
          otherAccounts.length > 0 ? (
            <LinkButton
              name="account-edit"
              onClick={() => {
                setIsOtherAccountsEditMode(!isOtherAccountsEditMode);
              }}
            >
              {isOtherAccountsEditMode ? "편집 완료" : "편집"}
            </LinkButton>
          ) : undefined
        }
      />
      {otherAccounts.map((account) => (
        <MenuItem
          key={account.id}
          shouldShowRightArrow={!isOtherAccountsEditMode}
          name={account.name ? account.name : `id: ${account.id}`}
          onClick={async () => {
            if (
              !isOtherAccountsEditMode &&
              (await Dialog_confirm(
                "이 계정으로 전환할까요? 현재 계정은 삭제되지 않으며, 나중에 다시 전환할 수 있습니다."
              ))
            ) {
              props.dispatch(Thunk_switchAccount(account.id));
            }
          }}
          value={
            isOtherAccountsEditMode ? (
              <Pressable
                className="p-2 nm-account-delete-account"
                onPress={async () => {
                  const answer = await Dialog_prompt(
                    "정말 삭제할까요? 이 계정의 모든 로컬 데이터가 삭제되며 클라우드 계정이 없으면 복구할 수 없습니다. 확인하려면 '삭제'를 입력하세요."
                  );
                  if (answer?.toLocaleLowerCase() === "delete" || answer === "삭제") {
                    props.dispatch(Thunk_deleteAccount(account.id, () => refetchAccounts()));
                  }
                }}
              >
                <IconTrash />
              </Pressable>
            ) : (
              <View className="flex-row items-center">
                <Text className="pr-2 text-text-primary">{account.numberOfPrograms}</Text>
                <View className="pr-4">
                  <IconDoc width={12} height={16} />
                </View>
                <Text className="pr-2 text-text-primary">{account.numberOfWorkouts}</Text>
                <View>
                  <IconDumbbell width={28} height={19} />
                </View>
              </View>
            )
          }
          expandName={true}
          addons={
            <View>
              {AdminDebug_isDebugAccountId(account.id) ? (
                <Text className="-mt-1 text-xs font-bold text-text-error">디버그 · 동기화 꺼짐</Text>
              ) : null}
              {account.name ? <Text className="-mt-1 text-xs text-text-secondary">{`id: ${account.id}`}</Text> : null}
              {account.email && account.email !== "noemail@example.com" && (
                <Text className="text-xs text-text-secondary">
                  이전 로그인 계정: <Text className="text-sm font-bold text-text-secondary">{account.email}</Text>
                </Text>
              )}
            </View>
          }
        />
      ))}
      <LinkButton
        name="local-account-create"
        onClick={async () => {
          if (
            await Dialog_confirm(
              "새 로컬 계정을 만들까요? 현재 계정은 삭제되지 않으며, 나중에 다시 전환할 수 있습니다."
            )
          ) {
            props.dispatch(Thunk_createAccount());
          }
        }}
      >
        새 로컬 계정 만들기
      </LinkButton>
      <GroupHeader name="현재 계정 삭제" topPadding={true} />
      <View>
        <Button
          name="account-delete"
          kind="red"
          className="mt-4 ls-delete-account"
          onClick={async () => {
            const answer = await Dialog_prompt(
              "정말 삭제할까요? 이 계정의 모든 로컬 데이터가 삭제되며 클라우드 계정이 없으면 복구할 수 없습니다. 확인하려면 '삭제'를 입력하세요."
            );
            if (answer?.toLocaleLowerCase() === "delete" || answer === "삭제") {
              props.dispatch(
                Thunk_logOut(() => {
                  props.dispatch(Thunk_deleteAccount(currentAccount.id));
                  props.dispatch(Thunk_createAccount());
                })
              );
            }
          }}
        >
          현재 로컬 계정 삭제
        </Button>
      </View>
      {!localOnly && props.email && (
        <View>
          <Button
            name="account-delete-remote"
            kind="red"
            className="mt-4 ls-delete-account-remote"
            onClick={async () => {
              const answer = await Dialog_prompt(
                "정말 삭제할까요? 이 계정의 클라우드 데이터가 모두 삭제되며 복구할 수 없습니다. 다시 가입하고 데이터를 동기화해야 합니다. 확인하려면 '삭제'를 입력하세요."
              );
              if (answer?.toLocaleLowerCase() === "delete" || answer === "삭제") {
                props.dispatch(
                  Thunk_deleteAccountRemote((result) => {
                    if (result) {
                      Dialog_alert("클라우드 계정을 삭제했습니다.");
                    } else {
                      Dialog_alert(
                        "오류가 발생해 클라우드 계정을 삭제하지 못했습니다. 삭제를 요청하려면 info@liftosaur.com으로 이메일을 보내세요."
                      );
                    }
                  })
                );
              }
            }}
          >
            현재 클라우드 계정 삭제
          </Button>
        </View>
      )}
    </View>
  );
}

interface IPremiumCard {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  showCancel: boolean;
}

function buildPremiumCard(plan: IDerivedSubscriptionPlan): IPremiumCard {
  const planKindLabel = (k?: ISubscriptionPlanKind): string =>
    k === "yearly" ? "연간 구독" : k === "monthly" ? "월간 구독" : "프리미엄";
  const dateStr = plan.expirationDate ? DateUtils_format(plan.expirationDate, true) : undefined;
  switch (plan.state) {
    case "subscriber":
      return {
        title: `프리미엄 · ${planKindLabel(plan.plan)}`,
        subtitle: dateStr ? `${dateStr}에 갱신됩니다` : "구독 중",
        actionLabel: "관리",
        showCancel: true,
      };
    case "cancelled":
      return {
        title: `프리미엄 · ${planKindLabel(plan.plan)}`,
        subtitle: dateStr ? `${dateStr}에 종료되며 갱신되지 않습니다` : "갱신되지 않습니다",
        actionLabel: "관리",
        showCancel: false,
      };
    case "lifetime":
      return {
        title: "평생 프리미엄",
        subtitle: "모든 기능을 계속 이용할 수 있습니다",
        actionLabel: "보기",
        showCancel: false,
      };
    case "freeaccess":
      return {
        title: "무료 이용",
        subtitle: "모든 기능을 이용할 수 있습니다",
        actionLabel: "보기",
        showCancel: false,
      };
    case "premium":
      return { title: "프리미엄", subtitle: "모바일 앱에서 관리할 수 있습니다", actionLabel: "관리", showCancel: false };
    case "otherstore":
      return {
        title: "프리미엄",
        subtitle:
          plan.managedOn === "apple"
            ? "App Store에서 구매했습니다. Apple 기기에서 관리하세요"
            : StoreRuntime_isIos()
              ? "다른 기기에서 구매했습니다. 구매한 기기에서 관리하세요"
              : "Google Play에서 구매했습니다. Android 기기에서 관리하세요",
        actionLabel: "보기",
        showCancel: false,
      };
    default:
      return { title: "무료 요금제", actionLabel: "프리미엄 이용하기", showCancel: false };
  }
}
