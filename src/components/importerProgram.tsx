import { JSX, useCallback } from "react";
import { View } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { MenuItemWrapper } from "./menuItem";
import { Thunk_importProgram } from "../ducks/thunks";
import { FileImport_pickFile, FileImport_confirm } from "../utils/fileImport";
import { AiWorkoutProgram_buildPhatSeedJson, AiWorkoutProgram_buildPromptTemplate } from "../utils/aiWorkoutProgram";
import { ClipboardUtils_copy } from "../utils/clipboard";
import { Dialog_alert } from "../utils/dialog";
import { FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES } from "../utils/fileImportLimits";

interface IImporterProgramProps {
  dispatch: IDispatch;
}

export function ImporterProgram(props: IImporterProgramProps): JSX.Element {
  const onPress = useCallback(async () => {
    const contents = await FileImport_pickFile("any", { maxSizeBytes: FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES });
    if (contents == null) {
      return;
    }
    props.dispatch(Thunk_importProgram({ decoded: contents }));
  }, [props.dispatch]);

  const onCopyPrompt = useCallback(async () => {
    await ClipboardUtils_copy(AiWorkoutProgram_buildPromptTemplate());
    Dialog_alert("AI 루틴 생성 프롬프트를 클립보드에 복사했습니다.");
  }, []);

  const onImportPhatSample = useCallback(async () => {
    const ok = await FileImport_confirm(
      "요청한 6주 PHAT 평일 5일 샘플을 추가합니다. 주차별 예시 목표 중량이 포함되어 있으니 운동을 시작하기 전에 본인 기록과 사용 기구에 맞게 조정하세요."
    );
    if (ok) {
      props.dispatch(Thunk_importProgram({ decoded: AiWorkoutProgram_buildPhatSeedJson() }));
    }
  }, [props.dispatch]);

  return (
    <>
      <MenuItemWrapper name="AI 운동 루틴 JSON 또는 CSV 가져오기" onClick={onPress}>
        <View className="py-3">
          <Text className="text-base text-text-primary">AI 운동 루틴 JSON/CSV 가져오기</Text>
          <Text className="pt-1 text-sm text-text-secondary">외부 AI가 만든 주차별 운동 계획을 불러옵니다.</Text>
        </View>
      </MenuItemWrapper>
      <MenuItemWrapper name="6주 PHAT 샘플 루틴 추가" onClick={onImportPhatSample}>
        <View className="py-3">
          <Text className="text-base text-text-primary">6주 PHAT 평일 5일 샘플 루틴 추가</Text>
          <Text className="pt-1 text-sm text-text-secondary">
            6주 30세션의 예시 목표 중량·세트·반복·휴식을 포함합니다.
          </Text>
        </View>
      </MenuItemWrapper>
      <MenuItemWrapper name="AI 새 루틴 프롬프트 복사" onClick={onCopyPrompt}>
        <View className="py-3">
          <Text className="text-base text-text-primary">AI에게 새 루틴 요청하는 프롬프트 복사</Text>
          <Text className="pt-1 text-sm text-text-secondary">JSON 규격과 CSV 헤더가 포함된 한국어 요청문</Text>
        </View>
      </MenuItemWrapper>
    </>
  );
}
