import { View } from "react-native";
import { TextRaw as Text } from "../primitives/text";
import { ITourConfig } from "./tourTypes";
import {
  Program_isEmpty,
  Program_uses1RM,
  Program_usesRPE,
  Program_runExerciseFinishDayScript,
  Program_getProgramExerciseForKeyAndDay,
  Program_getDiffState,
  Program_getDiffVars,
  Program_getEvaluatedProgramFromState,
} from "../../models/program";
import { Progress_getCurrentProgress } from "../../models/progress";
import { getCurrentScreenData } from "../../navigation/navigationService";
import { Weight_eqNull } from "../../models/weight";
import { IconCog2 } from "../icons/iconCog2";
import { Reps_isFinished } from "../../models/set";
import { PlannerProgramExercise_getState } from "../../pages/planner/models/plannerProgramExercise";
import { ObjectUtils_isNotEmpty } from "../../utils/object";

const paraCn = "text-sm leading-relaxed text-text-secondary";

export const workoutTourConfig: ITourConfig = {
  id: "workout",
  shouldStart: (state) => {
    const screen = getCurrentScreenData()?.name;
    if (screen !== "progress") {
      return false;
    }
    if (state.storage.history.length >= 4) {
      return false;
    }
    const progress = Progress_getCurrentProgress(state);
    if (!progress || progress.entries.length === 0) {
      return false;
    }
    const evaluatedProgram = Program_getEvaluatedProgramFromState(state);
    return evaluatedProgram != null && !Program_isEmpty(evaluatedProgram);
  },
  steps: [
    {
      id: "howItWorks",
      title: "Liftosaur 사용법",
      dino: "dinocoach.svg",
      content: () => (
        <>
          <Text className={`mb-2 ${paraCn}`}>
            <Text className="font-bold">프로그램</Text>이 운동 계획입니다. 종목, 세트, 횟수, 중량을 프로그램에서
            정합니다.
          </Text>
          <Text className={`mb-2 ${paraCn}`}>
            각 <Text className="font-bold">운동 기록</Text>은 프로그램을 바탕으로 만들어집니다. 운동을{" "}
            <Text className="font-bold">마치면</Text> 프로그램 규칙에 따라 다음 운동 계획을 갱신합니다. 목표 횟수를 모두
            채우면 중량이 올라갈 수 있습니다.
          </Text>
          <Text className={paraCn}>
            운동 중 중량이나 횟수를 바꿔도 오늘 기록에만 적용되며 프로그램 계획은 바뀌지 않습니다.
          </Text>
        </>
      ),
    },
    {
      id: "completingSets",
      title: "세트 기록하기",
      dino: "firstworkouttoursets.png",
      content: () => (
        <>
          <Text className={`mb-2 ${paraCn}`}>
            각 세트에는 프로그램이 정한 <Text className="font-bold">목표</Text> 횟수와 중량, 실제
            <Text className="font-bold">수행</Text> 기록이 있습니다. 실제 횟수와 중량을 입력하세요. 미리 입력된 값대로
            수행했다면 체크 버튼만 누르면 됩니다.
          </Text>
          <Text className={`mb-2 ${paraCn}`}>
            <Text className="font-bold text-text-success">초록색</Text>은 목표를 달성했다는 뜻입니다. 다음 계획이
            진행되는지는 프로그램 규칙에 따라 달라집니다.
          </Text>
          <Text className={paraCn}>
            프로그램은 목표와 실제 수행 기록을 비교해 중량이나 횟수를 바꾸거나 현재 계획을 유지합니다.
          </Text>
        </>
      ),
    },
    {
      id: "swipeSets",
      title: "세트 수정하기",
      dino: "firstworkouttourswipe.png",
      condition: (state) => state.storage.history.length >= 1,
      content: () => (
        <>
          <Text className={`mb-2 ${paraCn}`}>
            <Text className="font-bold">세트를 눌러</Text> 상세 정보를 펼친 뒤 <Text className="font-bold">연필</Text>을
            눌러 목표 횟수와 중량을 바꾸거나 세트를 삭제할 수 있습니다.
          </Text>
          <Text className={paraCn}>
            여기서 바꾼 내용은 <Text className="font-bold">오늘 운동</Text>에만 적용됩니다. 프로그램 계획을 수정하려면
            종목 메뉴에서 <Text className="font-bold">프로그램 운동 수정</Text>을 선택하세요.
          </Text>
        </>
      ),
    },
    {
      id: "whatIs1RM",
      title: "1RM이란?",
      dino: "firstworkouttour1rm.png",
      condition: (state) => {
        const evaluatedProgram = Program_getEvaluatedProgramFromState(state);
        return evaluatedProgram != null && Program_uses1RM(evaluatedProgram);
      },
      content: () => (
        <>
          <Text className={`mb-2 ${paraCn}`}>
            이 프로그램은 <Text className="font-bold">백분율 중량</Text>을 사용합니다. 중량은 한 번 들 수 있는 가장
            무거운 무게인 <Text className="font-bold">1RM</Text>을 기준으로 계산됩니다.
          </Text>
          <Text className={paraCn}>
            종목 이름 아래의 <Text className="font-bold">1RM</Text>을 눌러 값을 입력할 수 있습니다.
          </Text>
        </>
      ),
    },
    {
      id: "whatIsRPE",
      title: "RPE란?",
      dino: "firstworkouttourrpe.png",
      condition: (state) => {
        const evaluatedProgram = Program_getEvaluatedProgramFromState(state);
        return evaluatedProgram != null && Program_usesRPE(evaluatedProgram);
      },
      content: () => (
        <>
          <Text className={`mb-2 ${paraCn}`}>
            이 프로그램은 세트가 얼마나 힘들었는지 1~10으로 기록하는 <Text className="font-bold">RPE(운동 자각도)</Text>
            를 사용합니다.
          </Text>
          <Text className={paraCn}>
            RPE 10은 더 할 수 없는 최대 노력, RPE 8은 두 번 정도 더 할 수 있는 강도입니다. 프로그램에 따라 실제 수행
            RPE를 입력하고 그 차이를 다음 계획에 반영할 수 있습니다.
          </Text>
        </>
      ),
    },
    {
      id: "equipment",
      title: "기구와 중량 반올림",
      dino: "firstworkouttourequipment.png",
      condition: (state) => {
        const progress = Progress_getCurrentProgress(state);
        const currentEntry = progress?.entries[progress.currentEntryIndex ?? 0];
        return currentEntry?.sets.some((w) => !Weight_eqNull(w.originalWeight, w.weight)) || false;
      },
      content: () => (
        <Text className={paraCn}>
          목표 중량에 <Text className="line-through">취소선</Text>이 있으면 <Text className="font-bold">반올림</Text>된
          값입니다. 앱은 사용하는 기구에 맞게 프로그램 중량을 조정합니다. <Text className="font-bold">기구</Text>{" "}
          설정에서 원판과 중량 단위를 조정할 수 있습니다.
        </Text>
      ),
    },
    {
      id: "editingProgram",
      title: "프로그램 종목 수정",
      dino: "firstworkouttouredit.png",
      content: () => (
        <View className="flex-row flex-wrap items-center">
          <View>
            <Text className={paraCn}>프로그램의 종목을 바꾸려면 </Text>
          </View>
          <View className="inline-block mx-1">
            <IconCog2 size={18} />
          </View>
          <Text className={`${paraCn} font-bold`}>메뉴</Text>
          <Text className={paraCn}>를 누르고 </Text>
          <Text className={`${paraCn} font-bold`}>"프로그램 운동 수정"</Text>
          <Text className={paraCn}>을 선택해 세트, 횟수, 중량, 진행 규칙을 바꾸세요.</Text>
        </View>
      ),
    },
    {
      id: "progressionPreview",
      title: "진행 미리 보기",
      dino: "firstworkouttourprogress.png",
      condition: (state) => {
        const progress = Progress_getCurrentProgress(state);
        if (!progress || progress.entries.length === 0) {
          return false;
        }
        const program = Program_getEvaluatedProgramFromState(state);
        if (!program) {
          return false;
        }
        const entry = progress.entries[progress.currentEntryIndex ?? 0];
        const isFinished = Reps_isFinished(entry.sets);
        if (!isFinished) {
          return false;
        }
        const programExercise = entry.programExerciseId
          ? Program_getProgramExerciseForKeyAndDay(program, progress.day, entry.programExerciseId)
          : undefined;
        if (!programExercise) {
          return false;
        }
        const dayData = programExercise.dayData;
        const settings = state.storage.settings;
        const stateVars = PlannerProgramExercise_getState(programExercise);
        const { units } = settings;
        const userPromptedStateVars = progress.userPromptedStateVars?.[programExercise.key];
        const result = Program_runExerciseFinishDayScript(
          entry,
          dayData,
          settings,
          stateVars,
          program.states,
          programExercise,
          state.storage.stats,
          userPromptedStateVars
        );
        if (result.success) {
          const { state: newState, updates, bindings } = result.data;
          const diffState = Program_getDiffState(stateVars, newState, units);
          const diffVars = Program_getDiffVars(entry, updates, bindings, settings);
          const prints = result.data.prints;

          if (ObjectUtils_isNotEmpty(diffState) || ObjectUtils_isNotEmpty(diffVars) || prints.length > 0) {
            return true;
          }
        }
        return false;
      },
      content: () => (
        <Text className={paraCn}>
          모든 세트를 마치면 프로그램에 진행 규칙이 있는 종목 아래에 <Text className="font-bold">진행 미리 보기</Text>가
          표시됩니다. 운동을 종료할 때 해당 종목의 계획이 어떻게 바뀌는지 보여줍니다.
        </Text>
      ),
    },
  ],
};
