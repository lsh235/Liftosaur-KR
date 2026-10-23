import { JSX } from "react";
import { View } from "react-native";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { useNavOptions } from "../navigation/useNavOptions";
import { Thunk_undoImport } from "../ducks/thunks";
import { IImportSession } from "../types";
import { DateUtils_format } from "../utils/date";
import { LinkButton } from "./linkButton";

interface IProps {
  dispatch: IDispatch;
  importSessions?: IImportSession[];
}

export function ScreenRecentImports(props: IProps): JSX.Element {
  useNavOptions({ navTitle: "최근 가져오기" });
  const importSessions = [...(props.importSessions ?? [])].reverse();

  return (
    <View className="px-gutter">
      {importSessions.length === 0 ? (
        <Text className="py-8 text-center text-text-secondary">최근 가져온 기록이 없습니다</Text>
      ) : (
        importSessions.map((session) => (
          <View key={session.id} className="flex-row items-center py-3 border-b border-border-neutral">
            <View className="flex-1">
              <Text className="text-base text-text-primary">
                {session.source === "hevy" ? "Hevy" : "CSV"} · {DateUtils_format(session.timestamp)}
              </Text>
              <Text className="text-sm text-text-secondary">
                운동 {session.workoutCount}회
                {session.customExerciseIds.length > 0
                  ? ` · 새 운동 ${session.customExerciseIds.length}개`
                  : ""}
              </Text>
            </View>
            <LinkButton name={`undo-import-${session.id}`} onClick={() => props.dispatch(Thunk_undoImport(session.id))}>
              되돌리기
            </LinkButton>
          </View>
        ))
      )}
    </View>
  );
}
