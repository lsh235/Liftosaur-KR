import { JSX, useEffect } from "react";
import { View, Pressable, Platform, Image, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./primitives/text";
import { Tailwind_semantic } from "../utils/tailwindConfig";
import { IDispatch } from "../ducks/types";
import { Dialog_alert } from "../utils/dialog";
import { NavScreenContent } from "../navigation/NavScreenContent";
import { useNavOptions } from "../navigation/useNavOptions";
import { IAppleOffer, IGoogleOffer, INavCommon, IOfferData, ISubscriptionLoading } from "../models/state";
import { IconBarbell } from "./icons/iconBarbell";
import { IconGraphs } from "./icons/iconGraphs";
import { Button } from "./button";
import { LinkButton } from "./linkButton";
import { IconBell } from "./icons/iconBell";
import { IconSpinner } from "./icons/iconSpinner";
import { IHistoryRecord, ISubscription } from "../types";
import {
  Thunk_claimkey,
  Thunk_subscribeMonthly,
  Thunk_subscribeYearly,
  Thunk_buyLifetime,
  Thunk_restorePurchases,
  Thunk_redeemCouponIOS,
  Thunk_switchSubscription,
  Thunk_openManageSubscriptions,
  Thunk_iapRefreshActiveSubscriptions,
  Thunk_iapClearStuckLoadingOnForeground,
} from "../ducks/thunks";
import { IconClose } from "./icons/iconClose";
import { navigateToModal, goBack } from "../navigation/navigationService";
import { ObjectUtils_entries, ObjectUtils_keys } from "../utils/object";
import { lg } from "../utils/posthog";
import { IconWatch } from "./icons/iconWatch";
import { IconLink } from "./icons/iconLink";
import { IconDinoSunglasses } from "./icons/iconDinoSunglasses";
import { ImagePreloader_uri, ImagePreloader_preload } from "../utils/imagePreloader";
import { ISubscriptionInfoType, SubscriptionInfoImages_allPaths } from "./subscriptionInfoImages";
import { InternalLink } from "../internalLink";
import { IIapActiveSubscription } from "../utils/iapAdapter";
import { SubscriptionPlan_derive, ISubscriptionPlanKind, IDerivedSubscriptionPlan } from "../utils/subscriptionPlan";
import { DateUtils_format } from "../utils/date";
import { IconFire } from "./icons/iconFire";
import { StoreRuntime_isIos, StoreRuntime_isNative, StoreRuntime_storeName } from "../utils/storeRuntime";

interface IProps {
  prices?: Partial<Record<string, string>>;
  offers?: Partial<Record<string, IOfferData[]>>;
  subscription: ISubscription;
  appleOffer?: IAppleOffer;
  googleOffer?: IGoogleOffer;
  subscriptionLoading?: ISubscriptionLoading;
  subscriptionStatus?: IIapActiveSubscription[];
  ownedLifetime?: boolean;
  history: IHistoryRecord[];
  dispatch: IDispatch;
  navCommon: INavCommon;
}

interface IFeatureDef {
  key: string;
  icon: JSX.Element;
  title: string;
  description: string;
  infoType?: ISubscriptionInfoType;
  iosOnly?: boolean;
}

function getFeatures(): IFeatureDef[] {
  return [
    {
      key: "plates",
      icon: <IconBarbell />,
      title: "원판 계산기",
      description: "바벨에 끼울 원판의 종류와 개수를 계산합니다.",
      infoType: "platesCalculator",
    },
    {
      key: "graphs",
      icon: <IconGraphs />,
      title: "운동 그래프",
      description: "시간에 따른 운동 변화를 확인합니다.",
      infoType: "graphs",
    },
    {
      key: "notifications",
      icon: <IconBell />,
      title: "휴식 타이머 알림",
      description: "다음 세트를 시작할 시간이 되면 알림을 받습니다.",
      infoType: "notifications",
    },
    {
      key: "weekinsights",
      icon: <IconFire />,
      title: "주간 운동 분석",
      description: "개인 운동 수행 정보를 확인합니다.",
      infoType: "weekInsights",
    },
    {
      key: "watch",
      icon: <IconWatch />,
      title: "Apple Watch 앱",
      description: "손목에서 바로 운동을 기록합니다.",
      infoType: "watch",
      iosOnly: true,
    },
    {
      key: "api",
      icon: <IconLink />,
      title: "API 및 MCP",
      description:
        "Claude, ChatGPT, Gemini에서 운동 기록과 프로그램을 활용하거나 직접 연동 도구를 만들 수 있습니다.",
      infoType: "mcp",
    },
  ];
}

function planLabel(plan?: ISubscriptionPlanKind): string {
  return plan === "yearly" ? "연간" : plan === "monthly" ? "월간" : "프리미엄";
}

export function ScreenSubscription(props: IProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const isIos = StoreRuntime_isIos();
  const isNative = StoreRuntime_isNative();

  useEffect(() => {
    for (const path of SubscriptionInfoImages_allPaths()) {
      ImagePreloader_preload(path);
    }
  }, []);

  useEffect(() => {
    props.dispatch(Thunk_iapRefreshActiveSubscriptions());
    // Re-check on foreground so a cancel/change made in the system subscription manager
    // (App Store / Google Play) is reflected when the user comes back to the app.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        props.dispatch(Thunk_iapRefreshActiveSubscriptions());
        // Give a genuine purchase event a moment to arrive and clear its own spinner first; if the
        // spinner is still up after that, the Android billing sheet was dismissed without buying.
        setTimeout(() => props.dispatch(Thunk_iapClearStuckLoadingOnForeground()), 1000);
      }
    });
    return () => sub.remove();
  }, []);

  const plan = SubscriptionPlan_derive({
    subscription: props.subscription,
    status: props.subscriptionStatus,
    ownedLifetime: props.ownedLifetime,
    isNative,
    isIos,
  });

  const monthlyPrice =
    ObjectUtils_entries(props.prices || {}).filter(([k]) => k.indexOf("mont") !== -1)?.[0]?.[1] ?? "$4.99";
  const yearlyPrice =
    ObjectUtils_entries(props.prices || {}).filter(([k]) => k.indexOf("year") !== -1)?.[0]?.[1] ?? "$39.99";
  const lifetimePrice =
    ObjectUtils_entries(props.prices || {}).filter(([k]) => k.indexOf("lifetime") !== -1)?.[0]?.[1] ?? "$99.99";
  let monthlyOffer: IOfferData | undefined = undefined;
  let yearlyOffer: IOfferData | undefined = undefined;
  for (const productId of ObjectUtils_keys(props.offers || {})) {
    monthlyOffer =
      monthlyOffer ||
      props.offers?.[productId]?.find((o) => {
        return o.offerId === props.appleOffer?.monthly?.offerId || o.offerId === props.googleOffer?.monthly?.offerId;
      });
    yearlyOffer =
      yearlyOffer ||
      props.offers?.[productId]?.find((o) => {
        return o.offerId === props.appleOffer?.yearly?.offerId || o.offerId === props.googleOffer?.yearly?.offerId;
      });
  }
  const hasOffer = !!(monthlyOffer || yearlyOffer);
  const supportsLifetime = Platform.OS === "ios" || Platform.OS === "android";

  useNavOptions({ navHidden: true });

  const isUnclaimed = props.subscription.key === "unclaimed";

  if (plan.state === "loading" && !isUnclaimed) {
    return (
      <NavScreenContent>
        <SubscriptionHero />
        <View className="flex-1 items-center justify-center px-gutter" style={{ paddingBottom: insets.bottom + 16 }}>
          <IconSpinner width={24} height={24} />
          <Text className="mt-3 text-sm text-text-secondary">구독 정보를 확인하고 있습니다…</Text>
        </View>
      </NavScreenContent>
    );
  }

  const isPitch = (plan.state === "none" || plan.state === "premium") && !isUnclaimed;
  const showManagement = plan.state === "subscriber" || plan.state === "cancelled" || plan.state === "premium";
  // Lifetime/free-access users already own everything, so a coupon would be a no-op for them.
  const hasFullAccess = plan.state === "lifetime" || plan.state === "freeaccess" || plan.state === "otherstore";

  return (
    <NavScreenContent>
      <SubscriptionHero />
      <View className="flex-1 px-gutter" style={{ paddingBottom: insets.bottom + 16 }}>
        {isPitch || isUnclaimed ? <PitchHeader /> : <StatusHeader plan={plan} />}
        <FeatureList isIos={isIos} />
        <View>
          {isUnclaimed ? (
            <ClaimFreeAccess dispatch={props.dispatch} />
          ) : plan.state === "none" ? (
            <PurchaseCards
              dispatch={props.dispatch}
              appleOffer={props.appleOffer}
              googleOffer={props.googleOffer}
              subscriptionLoading={props.subscriptionLoading}
              monthlyPrice={monthlyPrice}
              yearlyPrice={yearlyPrice}
              lifetimePrice={lifetimePrice}
              monthlyOffer={monthlyOffer}
              yearlyOffer={yearlyOffer}
              hasOffer={hasOffer}
              supportsLifetime={supportsLifetime}
            />
          ) : showManagement ? (
            <ManagementActions
              dispatch={props.dispatch}
              plan={plan}
              subscriptionLoading={props.subscriptionLoading}
              lifetimePrice={lifetimePrice}
              supportsLifetime={supportsLifetime}
              isNative={isNative}
            />
          ) : null}
        </View>
        <View className="flex-row py-2 items-center justify-between gap-4">
          {isNative && !hasFullAccess ? (
            <View className="flex-row items-center justify-center">
              <LinkButton
                name="redeem-coupon"
                onPress={() => {
                  if (Platform.OS === "ios") {
                    props.dispatch(Thunk_redeemCouponIOS());
                  } else {
                    navigateToModal("couponModal");
                  }
                }}
                className="text-sm font-bold"
              >
                쿠폰 등록
              </LinkButton>
            </View>
          ) : (
            <View />
          )}
          <View className="flex-row items-center justify-between">
            {plan.state === "none" && isNative ? (
              <LinkButton
                name="restore-subscriptions"
                className="text-sm font-bold"
                onPress={() => {
                  props.dispatch(Thunk_restorePurchases({ interactive: true }));
                }}
              >
                구매 복원
              </LinkButton>
            ) : (
              <InternalLink
                name="terms-of-use"
                href="/terms.html"
                className="text-sm font-bold underline text-text-link"
              >
                이용약관
              </InternalLink>
            )}
          </View>
        </View>
        {isPitch && (
          <>
            <Text className="mt-2 mb-4 text-xs text-text-secondary">
              월간 또는 연간 구독을 이용할 수 있습니다. 구독료는 매월 또는 매년 청구됩니다
              {!hasOffer ? " (최초 14일 무료 체험 후)" : ""}. 평생 이용권은 한 번 결제하면 이후 추가 결제 없이 해당 기능을 계속 사용할 수 있습니다.
            </Text>
            <Text className="mb-4 text-xs text-text-secondary">
              구독은 언제든지 {StoreRuntime_storeName()}의 구독 관리에서 취소할 수 있습니다.
            </Text>
          </>
        )}
        {plan.state === "none" && isNative && (
          <View className="flex-row">
            <View className="items-center justify-center flex-1">
              <InternalLink
                name="terms-of-use"
                href="/terms.html"
                className="text-sm font-bold text-center underline text-text-link"
              >
                이용약관
              </InternalLink>
            </View>
          </View>
        )}
      </View>
    </NavScreenContent>
  );
}

function SubscriptionHero(): JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-background-cardpurple w-full" style={{ paddingTop: insets.top, height: 280 }}>
      <Pressable
        className="absolute z-10 p-2"
        style={{ top: insets.top + 4, right: 8 }}
        data-testid="subscription-close"
        testID="subscription-close"
        onPress={() => goBack()}
      >
        <IconClose size={20} color={Tailwind_semantic().icon.neutral} />
      </Pressable>
      <Image
        className="absolute bottom-4 left-4"
        source={{ uri: ImagePreloader_uri("/images/subscriptionhero.png") }}
        style={{ width: "80%", aspectRatio: 879 / 516 }}
        resizeMode="contain"
        accessibilityLabel="Liftosaur 프리미엄 기능"
      />
      <View className="absolute right-4 bottom-0">
        <IconDinoSunglasses width={102} height={136} />
      </View>
    </View>
  );
}

function PitchHeader(): JSX.Element {
  return (
    <View className="py-4">
      <Text className="text-lg font-semibold">Liftosaur 프리미엄으로 운동 루틴을 더 체계적으로 관리하세요.</Text>
    </View>
  );
}

function StatusHeader(props: { plan: IDerivedSubscriptionPlan }): JSX.Element {
  const { plan } = props;
  const dateStr = plan.expirationDate ? DateUtils_format(plan.expirationDate, true) : undefined;

  let title: string;
  let subtitle: string | undefined;
  if (plan.state === "lifetime") {
    title = "🎉 평생 프리미엄";
    subtitle = "모든 프리미엄 기능을 계속 이용할 수 있습니다.";
  } else if (plan.state === "freeaccess") {
    title = "무료 이용";
    subtitle = "모든 프리미엄 기능을 이용할 수 있습니다.";
  } else if (plan.state === "cancelled") {
    title = `${planLabel(plan.plan)} 구독 · 갱신 안 함`;
    subtitle = dateStr ? `${dateStr}에 이용이 종료됩니다.` : "현재 결제 기간이 끝나면 이용이 종료됩니다.";
  } else if (plan.state === "subscriber") {
    title = `✓ 프리미엄 · ${planLabel(plan.plan)} 구독`;
    subtitle = dateStr ? `${dateStr}에 갱신됩니다.` : undefined;
  } else if (plan.state === "otherstore") {
    title = "✓ 프리미엄";
    subtitle =
      plan.managedOn === "apple"
        ? "App Store에서 구매한 구독입니다. Apple 기기에서 관리하거나 취소하세요."
        : StoreRuntime_isIos()
          ? "다른 기기에서 구매한 구독입니다. 구매한 기기에서 관리하거나 취소하세요."
          : "Google Play에서 구매한 구독입니다. Android 기기에서 관리하거나 취소하세요.";
  } else {
    title = "✓ 프리미엄";
    subtitle = "모바일 앱에서 구독을 관리할 수 있습니다.";
  }

  return (
    <View className="pt-2 pb-4">
      <Text className="text-2xl font-bold" data-testid="subscription-status-title">
        {title}
      </Text>
      {subtitle && <Text className="mt-1 text-sm text-text-secondary">{subtitle}</Text>}
    </View>
  );
}

function FeatureList(props: { isIos: boolean }): JSX.Element {
  const features = getFeatures().filter((f) => !f.iosOnly || props.isIos);
  return (
    <View className="mb-4">
      {features.map((f) => {
        const infoType = f.infoType;
        return (
          <Feature
            key={f.key}
            icon={f.icon}
            title={f.title}
            description={f.description}
            onPress={infoType ? () => navigateToModal("subscriptionInfoModal", { type: infoType }) : undefined}
          />
        );
      })}
    </View>
  );
}

function ClaimFreeAccess(props: { dispatch: IDispatch }): JSX.Element {
  return (
    <View className="flex-row items-center px-2">
      <View className="flex-1">
        <Text className="text-xs text-text-secondary">
          Liftosaur <Text className="font-bold">무료 이용 권한</Text>을 받았습니다!
        </Text>
      </View>
      <View>
        <Button
          name="subscription-free"
          onPress={() => props.dispatch(Thunk_claimkey())}
          kind="purple"
          testID="button-subscription-free"
          buttonSize="lg"
        >
          받기
        </Button>
      </View>
    </View>
  );
}

interface IPurchaseCardsProps {
  dispatch: IDispatch;
  appleOffer?: IAppleOffer;
  googleOffer?: IGoogleOffer;
  subscriptionLoading?: ISubscriptionLoading;
  monthlyPrice: string;
  yearlyPrice: string;
  lifetimePrice: string;
  monthlyOffer?: IOfferData;
  yearlyOffer?: IOfferData;
  hasOffer: boolean;
  supportsLifetime: boolean;
}

function PurchaseCards(props: IPurchaseCardsProps): JSX.Element {
  const trialNote = !props.hasOffer ? "14일 무료 체험" : undefined;
  return (
    <View>
      <PlanCard
        testID="button-subscription-yearly"
        highlighted={true}
        title="연간 구독 시작"
        subtitle={trialNote}
        price={props.yearlyOffer ? props.yearlyOffer.formattedPrice : props.yearlyPrice}
        oldPrice={props.yearlyOffer ? props.yearlyPrice : undefined}
        period="/년"
        badge="33% 할인"
        loading={!!props.subscriptionLoading?.yearly}
        onPress={() => {
          if (StoreRuntime_isNative()) {
            lg("start-subscription-yearly");
            props.dispatch(
              Thunk_subscribeYearly({ applePromo: props.appleOffer?.yearly, googlePromo: props.googleOffer?.yearly })
            );
          } else {
            webAlert();
          }
        }}
      />
      <PlanCard
        testID="button-subscription-monthly"
        title="월간 구독 시작"
        subtitle={trialNote}
        price={props.monthlyOffer ? props.monthlyOffer.formattedPrice : props.monthlyPrice}
        oldPrice={props.monthlyOffer ? props.monthlyPrice : undefined}
        period="/월"
        loading={!!props.subscriptionLoading?.monthly}
        onPress={() => {
          if (StoreRuntime_isNative()) {
            lg("start-subscription-monthly");
            props.dispatch(
              Thunk_subscribeMonthly({ applePromo: props.appleOffer?.monthly, googlePromo: props.googleOffer?.monthly })
            );
          } else {
            webAlert();
          }
        }}
      />
      {props.supportsLifetime && (
        <PlanCard
          testID="button-subscription-lifetime"
          title="평생 이용권"
          subtitle="1회 결제"
          price={props.lifetimePrice}
          loading={!!props.subscriptionLoading?.lifetime}
          onPress={() => {
            if (StoreRuntime_isNative()) {
              lg("start-subscription-lifetime");
              props.dispatch(Thunk_buyLifetime());
            } else {
              webAlert();
            }
          }}
        />
      )}
      {props.hasOffer && (
        <Text className="pt-1 text-xs text-center text-text-secondary">할인은 첫해에 적용됩니다</Text>
      )}
    </View>
  );
}

interface IManagementActionsProps {
  dispatch: IDispatch;
  plan: IDerivedSubscriptionPlan;
  subscriptionLoading?: ISubscriptionLoading;
  lifetimePrice: string;
  supportsLifetime: boolean;
  isNative: boolean;
}

function ManagementActions(props: IManagementActionsProps): JSX.Element {
  const { plan } = props;
  const isAndroid = StoreRuntime_isNative() && !StoreRuntime_isIos();

  if (plan.state === "premium") {
    return (
      <View>
        <Text className="text-xs text-center text-text-secondary">
          Liftosaur 모바일 앱 또는 {StoreRuntime_storeName()} 계정에서 구독을 관리할 수 있습니다.
        </Text>
      </View>
    );
  }

  const currentPlan = plan.plan;
  const targetPlan: ISubscriptionPlanKind | undefined =
    plan.plan === "yearly" ? "monthly" : plan.plan === "monthly" ? "yearly" : undefined;
  const switchLoading =
    targetPlan === "yearly" ? props.subscriptionLoading?.yearly : props.subscriptionLoading?.monthly;
  const keepLoading = currentPlan ? props.subscriptionLoading?.[currentPlan] : undefined;
  const switchSubtext =
    targetPlan === "yearly"
      ? "다음 갱신일부터 적용됩니다."
      : "연간 구독의 남은 기간은 금액으로 반영됩니다.";

  const lifetimeDisabledReason =
    plan.state === "subscriber"
      ? "먼저 현재 구독을 취소하세요"
      : plan.expirationDate
        ? `${DateUtils_format(plan.expirationDate, true)}부터 이용할 수 있습니다`
        : "현재 구독이 만료된 뒤 이용할 수 있습니다";

  return (
    <View>
      {plan.state === "subscriber" && plan.pendingPlan ? (
        <View
          className="justify-center px-4 py-2 mb-2 border min-h-scaled-16 rounded-xl bg-background-cardpurple border-border-cardpurple"
          style={{ borderRadius: 16 }}
          data-testid="subscription-pending-switch"
        >
          <Text className="text-base font-bold text-text-primary">{planLabel(plan.pendingPlan)} 요금제로 변경 예약됨</Text>
          <Text className="text-xs text-text-secondary">
            {plan.expirationDate
              ? `${DateUtils_format(plan.expirationDate, true)}부터 적용됩니다.`
              : "다음 갱신일부터 적용됩니다."}
          </Text>
          {isAndroid && (
            // Google Play has no API to cancel a queued deferred plan change, and re-purchasing the
            // current product is rejected as a no-op replacement. The only way to revert is from the
            // Play subscription manager.
            <Text className="text-xs text-text-secondary">변경 예약을 취소하려면 Google Play에서 구독을 관리하세요.</Text>
          )}
          {currentPlan && (
            <View className="pt-2">
              {keepLoading && !isAndroid ? (
                <IconSpinner width={16} height={16} />
              ) : (
                <LinkButton
                  name="keep-current-plan"
                  testID="button-keep-current-plan"
                  className="text-sm font-bold"
                  onPress={() => {
                    lg(`keep-subscription-${currentPlan}`);
                    if (isAndroid) {
                      props.dispatch(Thunk_openManageSubscriptions());
                    } else {
                      props.dispatch(Thunk_switchSubscription(currentPlan));
                    }
                  }}
                >
                  {isAndroid ? "Google Play에서 관리" : `${planLabel(currentPlan)} 구독 유지`}
                </LinkButton>
              )}
            </View>
          )}
        </View>
      ) : plan.state === "subscriber" && targetPlan ? (
        <PlanCard
          testID={`button-switch-${targetPlan}`}
          highlighted={true}
          title={`${planLabel(targetPlan)} 구독으로 변경`}
          subtitle={switchSubtext}
          loading={!!switchLoading}
          onPress={() => {
            lg(`switch-subscription-${targetPlan}`);
            props.dispatch(Thunk_switchSubscription(targetPlan));
          }}
        />
      ) : null}
      {props.supportsLifetime && (
        <PlanCard
          testID="button-subscription-lifetime"
          title="평생 이용권"
          subtitle={lifetimeDisabledReason}
          price={props.lifetimePrice}
          disabled={true}
          onPress={() => {}}
        />
      )}
      {plan.state === "cancelled" && (
        <View className="pt-2">
          <Button
            name="subscription-resubscribe"
            kind="purple"
            className="w-full"
            testID="button-subscription-resubscribe"
            onPress={() => props.dispatch(Thunk_openManageSubscriptions())}
          >
            다시 구독
          </Button>
        </View>
      )}
      {plan.state === "subscriber" && (
        <View className="pt-2">
          <LinkButton
            name="cancel-subscription"
            className="text-sm text-center text-text-error"
            testID="button-cancel-subscription"
            onPress={() => props.dispatch(Thunk_openManageSubscriptions())}
          >
            구독 취소
          </LinkButton>
        </View>
      )}
    </View>
  );
}

interface IPlanCardProps {
  testID: string;
  title: string;
  subtitle?: string;
  price?: string;
  oldPrice?: string;
  period?: string;
  badge?: string;
  highlighted?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}

function PlanCard(props: IPlanCardProps): JSX.Element {
  const bg = props.highlighted ? "bg-icon-purple" : "bg-background-cardpurple";
  const borderColor = props.highlighted ? "" : "border border-border-cardpurple";
  const titleColor = props.highlighted ? "text-text-alwayswhite" : "text-text-primary";
  const subColor = props.highlighted ? "text-text-alwayswhite" : "text-text-secondary";
  return (
    <Pressable
      className={`flex-row items-center min-h-scaled-16 px-4 py-2 mb-2 rounded-xl ${bg} ${borderColor} ${props.disabled ? "opacity-50" : ""}`}
      style={{ borderRadius: 16 }}
      data-testid={props.testID}
      testID={props.testID}
      disabled={props.disabled || props.loading}
      onPress={props.onPress}
    >
      {props.loading ? (
        <View className="items-center flex-1">
          <IconSpinner color={props.highlighted ? "white" : undefined} width={20} height={20} />
        </View>
      ) : (
        <>
          <View className="flex-1">
            <Text className={`text-base font-bold ${titleColor}`}>{props.title}</Text>
            {props.subtitle && <Text className={`text-xs ${subColor}`}>{props.subtitle}</Text>}
          </View>
          <View className="items-end">
            <View className="flex-row items-baseline">
              {props.oldPrice && <Text className={`mr-1 text-xs line-through ${subColor}`}>{props.oldPrice}</Text>}
              {props.price && (
                <Text className={`text-base font-bold ${titleColor}`}>
                  {props.price}
                  {props.period ? <Text className={`text-xs font-normal ${titleColor}`}>{props.period}</Text> : null}
                </Text>
              )}
            </View>
            {props.badge && <Text className={`text-xs ${subColor}`}>{props.badge}</Text>}
          </View>
        </>
      )}
    </Pressable>
  );
}

function webAlert(): void {
  Dialog_alert(
    "구독은 iOS 또는 Android Liftosaur 앱에서만 할 수 있습니다. Google Play 또는 App Store에서 앱을 설치하고 구독한 다음, 웹에서도 같은 로그인 방식으로 로그인하면 프리미엄 기능을 이용할 수 있습니다."
  );
}

interface IFeatureProps {
  icon: JSX.Element;
  title: string;
  description: string;
  onPress?: () => void;
}

function Feature(props: IFeatureProps): JSX.Element {
  return (
    <Pressable className="flex-row mb-6" onPress={props.onPress}>
      <View className="items-center w-scaled-6 pt-1 mr-3">{props.icon}</View>
      <View className="flex-1">
        <Text className="text-base">
          <Text className={props.onPress ? "font-bold underline text-text-link" : "font-bold"}>{props.title}</Text>
          <Text className="text-sm text-text-primary"> - {props.description}</Text>
        </Text>
      </View>
    </Pressable>
  );
}
