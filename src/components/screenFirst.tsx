import { JSX, ReactNode, useEffect, useRef } from "react";
import { View, Image, Platform, Animated, Easing } from "react-native";
import { Text } from "./primitives/text";
import { Thunk_pushScreen } from "../ducks/thunks";
import { IDispatch } from "../ducks/types";
import { useNavOptions } from "../navigation/useNavOptions";
import { Button } from "./button";
import { IconArrowRight } from "./icons/iconArrowRight";
import StorySlider from "./storySlider";
import { IconKettlebell } from "./icons/iconKettlebell";
import { Svg, Defs, LinearGradient, Stop, Rect } from "./primitives/svg";
import { Tailwind_colors } from "../utils/tailwindConfig";
import { IconWorkoutProgress } from "./icons/iconWorkoutProgress";
import { IconEditor } from "./icons/iconEditor";
import { IconTracker } from "./icons/iconTracker";
import { navigateToModal } from "../navigation/navigationService";
import { BundledImages_resolve } from "../utils/bundledImages";

interface IProps {
  dispatch: IDispatch;
}

export function ScreenFirst(props: IProps): JSX.Element {
  useNavOptions({ navHidden: true });

  return (
    <View className="flex flex-col flex-1 h-screen bg-background-default">
      <View className="flex-1 px-gutter pt-16 pb-4">
        <StorySlider
          slides={[
            <FirstSlide />,
            <RestSlide
              bgColorHexFrom={Tailwind_colors().purple[200]}
              bgColor="bg-purple-100"
              borderColor="border-purple-200"
              header={
                <View className="flex-row items-center justify-center">
                  <IconKettlebell color={Tailwind_colors().purple[600]} />
                  <Text className="ml-1 font-semibold text-text-purple">운동 프로그램</Text>
                </View>
              }
              bodyText="준비된 프로그램으로 시작하거나 나만의 루틴을 만들어 보세요."
              image="slide-2-image"
            />,
            <RestSlide
              bgColorHexFrom={Tailwind_colors().yellow[200]}
              bgColor="bg-yellow-100"
              borderColor="border-border-cardyellow"
              header={
                <View className="flex-row items-center justify-center">
                  <IconWorkoutProgress color={Tailwind_colors().yellow[600]} />
                  <Text className="ml-1 font-semibold text-icon-yellow">운동 기록</Text>
                </View>
              }
              bodyText="한 번 눌러 세트를 기록하고, 프로그램 규칙에 따라 반복 횟수와 중량을 조정하세요."
              image="slide-3-image"
            />,
            <RestSlide
              bgColorHexFrom={Tailwind_colors().purple[200]}
              bgColor="bg-purple-100"
              borderColor="border-purple-200"
              header={
                <View className="flex-row items-center justify-center">
                  <IconEditor color={Tailwind_colors().purple[600]} />
                  <Text className="ml-1 font-semibold text-text-purple">프로그램 편집기</Text>
                </View>
              }
              bodyText="목표에 맞게 언제든 운동 루틴을 수정하거나 바꿀 수 있습니다."
              image="slide-4-image"
            />,
            <RestSlide
              bgColorHexFrom={Tailwind_colors().red[200]}
              bgColor="bg-red-100"
              borderColor="border-red-200"
              header={
                <View className="flex-row items-center justify-center">
                  <IconTracker color={Tailwind_colors().red[600]} />
                  <Text className="ml-1 font-semibold text-text-error">운동 기록과 통계</Text>
                </View>
              }
              bodyText="주간 통계를 확인하며 목표에 맞게 꾸준히 운동하세요."
              image="slide-5-image"
            />,
          ]}
          duration={5000}
        />
      </View>
      <View className="pb-6 mx-4">
        <Button
          className="w-full ls-onboarding-start"
          name="see-how-it-works"
          kind="purple"
          onClick={() => props.dispatch(Thunk_pushScreen("units"))}
        >
          <View className="flex-row items-center justify-center">
            <Text className="text-xs font-semibold text-text-alwayswhite">시작하기</Text>
            <AnimatedArrow />
          </View>
        </Button>
        <View className="pb-4 mt-2">
          <Button
            className="w-full ls-onboarding-have-account"
            name="see-how-it-works"
            kind="transparent-purple"
            onClick={() => navigateToModal("accountModal")}
          >
            이미 계정이 있어요
          </Button>
        </View>
      </View>
    </View>
  );
}

function AnimatedArrow(): JSX.Element {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 4,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [translateX]);

  return (
    <Animated.View style={{ marginLeft: 8, transform: [{ translateX }] }}>
      <IconArrowRight color="white" />
    </Animated.View>
  );
}

function FirstSlide(): JSX.Element {
  return (
    <View className="relative flex flex-col w-full h-full overflow-hidden bg-white rounded-2xl">
      <Image
        source={BundledImages_resolve("/images/slide-1-bg.jpg")}
        className="absolute top-0 bottom-0 left-0 right-0 w-full h-full"
        resizeMode="cover"
      />
      <Text className="px-8 pt-24 text-3xl font-bold leading-scaled-9 text-text-alwayswhite">
        나만의 웨이트 트레이닝 프로그램을{" "}
        <Text className="text-3xl" style={{ color: Tailwind_colors().purple[400] }}>
          계획하고
        </Text>{" "}
        <Text className="text-3xl" style={{ color: Tailwind_colors().red[400] }}>
          기록하는
        </Text>{" "}
        앱
      </Text>
      <Text className="px-8 py-6 text-base text-text-alwayswhite">
        원하는 운동 프로그램을 만들고 운동 진행 상황을 기록하세요.
      </Text>
      <View className="flex-1 w-full overflow-hidden">
        <Image
          source={BundledImages_resolve("/images/tigerfit-logo.png")}
          className="w-full h-full"
          resizeMode="contain"
          style={{ alignSelf: "flex-end" }}
        />
      </View>
    </View>
  );
}

interface IRestSlideProps {
  bgColorHexFrom: string;
  bgColor: string;
  borderColor: string;
  header: ReactNode;
  bodyText: string;
  image: string;
}

function RestSlide(props: IRestSlideProps): JSX.Element {
  const gradientId = `slide-gradient-${props.image}`;
  return (
    <View
      className={`relative flex flex-col w-full h-full overflow-hidden border ${props.borderColor} rounded-2xl ${props.bgColor}`}
    >
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80 }}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor={props.bgColorHexFrom} stopOpacity={0.8} />
              <Stop offset="100%" stopColor={props.bgColorHexFrom} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
      <View className="h-12 px-8" />
      <View className="px-8">{props.header}</View>
      <Text className="px-8 py-6 text-xl font-semibold text-center text-black">{props.bodyText}</Text>
      <View className="items-center justify-center flex-1 w-full">
        <Image
          source={BundledImages_resolve(`/images/${props.image}.png`)}
          className="w-full h-full"
          resizeMode="contain"
        />
      </View>
    </View>
  );
}
