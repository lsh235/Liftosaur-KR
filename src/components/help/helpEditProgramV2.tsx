import type { JSX } from "react";
import { View } from "react-native";
import { Text } from "../primitives/text";
import { PlannerCodeBlock } from "../../pages/planner/components/plannerCodeBlock";
import { IconGraphsE } from "../icons/iconGraphsE";
import { IconMusclesD } from "../icons/iconMusclesD";
import { IconMusclesW } from "../icons/iconMusclesW";
import { Link } from "../link";
import { IconDoc } from "../icons/iconDoc";

export function HelpEditProgramV2(): JSX.Element {
  const script = "Squat / 3x3-5\nRomanian Deadlift / 3x8";
  const script2 = "Squat / 3x3-5 65%\nRomanian Deadlift / 3x8 150lb";

  return (
    <View>
      <Text className="pb-2 text-xl font-semibold">프로그램 편집</Text>
      <Text className="mb-2 text-sm">
        운동을 시작하려면 운동 프로그램이 필요합니다. 여기에서 프로그램을 만들고 근육별{" "}
        <Text className="text-sm font-bold">주간 운동량</Text>을 확인해 체육관에서 보내는{" "}
        <Text className="text-sm font-bold">운동 시간</Text>과 균형을 맞출 수 있습니다. 여러 주차로 구성된 프로그램,
        메조사이클, 디로드 주간, 1RM 측정 주간을 계획하고 그래프에서 종목별 주간 운동량과 강도의 변화를 확인할 수
        있습니다.
      </Text>
      <View className="flex-row flex-wrap items-center mb-2">
        <Text className="text-sm">
          프로그램의 기준 데이터는 프로그램 텍스트입니다. 텍스트는 종이에 운동 계획을 적는 방식과 비슷한{" "}
          <Text className="text-sm font-bold">Liftoscript</Text> 문법을 사용합니다. 화면의 편집 도구도 내부적으로는 이
          텍스트를 수정합니다. 점진적 과부하 규칙이나 설명 등 모든 기능을 편집하려면 일반 텍스트 모드로 전환하세요.{" "}
        </Text>
        <IconDoc width={14} height={14} />
        <Text className="text-sm">아이콘을 누르세요.</Text>
      </View>
      <View className="flex-row flex-wrap items-center mb-2">
        <Text className="text-sm">
          프로그램 이름을 정하고 주차와 운동일을 추가하세요. 화면에서 종목을 만들거나 일반 텍스트 모드로 전환해{" "}
        </Text>
        <IconDoc width={14} height={14} />
        <Text className="text-sm">
          아이콘을 누른 뒤 운동일마다 종목을 입력할 수 있습니다. 각 종목은 한 줄에 적고, 슬래시 (
          <Text className="text-sm" style={{ fontFamily: "Courier" }}>
            /
          </Text>
          ) 뒤에 세트와 반복 횟수를 적습니다. 예:
        </Text>
      </View>
      <View className="px-4 py-2 my-1 mb-2 bg-background-default border rounded-md border-border-neutral">
        <PlannerCodeBlock script={script} />
      </View>
      <Text className="mb-2 text-sm">
        중량은 <Text className="text-sm font-bold">kg</Text> 또는 <Text className="text-sm font-bold">lb</Text> 단위의
        실제 값이나 1회 최대 중량(1RM)에 대한 백분율로 지정할 수 있습니다.
      </Text>
      <View className="px-4 py-2 my-1 mb-2 bg-background-default border rounded-md border-border-neutral">
        <PlannerCodeBlock script={script2} />
      </View>
      <Text className="mb-2 text-sm">
        종목 이름은 자동 완성으로 찾을 수 있습니다. 목록에 없는 종목은 사용자 지정 종목으로 추가할 수 있습니다.
      </Text>
      <View className="flex-row flex-wrap items-center mb-2">
        <IconMusclesW size={14} />
        <Text className="text-sm">
          {" "}
          아이콘을 누르면 <Text className="text-sm font-bold">주간 통계</Text>에서 근육별 주간 세트 수와 권장 범위,
          근력·근비대 비중을 확인할 수 있습니다. 숫자를 누르면 어떤 종목이 운동량에 얼마나 기여하는지도 볼 수 있습니다.
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center mb-2">
        <Text className="text-sm">운동일별 통계도 확인할 수 있습니다. </Text>
        <IconMusclesD size={14} />
        <Text className="text-sm"> 아이콘을 누르세요. 종목 상세 정보와 운동량 변화 그래프는 </Text>
        <IconGraphsE width={14} height={14} />
        <Text className="text-sm"> 아이콘에서 확인할 수 있습니다.</Text>
      </View>
      <Text className="mb-2 text-sm">
        종목 문법은 RPE(운동 자각도), 휴식 타이머, 여러 방식의 점진적 과부하 등을 지원합니다. 자세한 기능은{" "}
        <Link className="text-sm" href="https://www.liftosaur.com/doc">
          공식 문서
        </Link>
        에서 확인하세요.
      </Text>
    </View>
  );
}
