import { JSX, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { LegendList } from "@legendapp/list";
import { Text } from "./primitives/text";
import { IDispatch } from "../ducks/types";
import { useNavOptions } from "../navigation/useNavOptions";
import { Thunk_applyImport, Thunk_pushScreen } from "../ducks/thunks";
import { Dialog_alert } from "../utils/dialog";
import { IHistoryRecord, ISettings } from "../types";
import { IImportPreview, IState, updateState } from "../models/state";
import { lb } from "lens-shmens";
import { IImportRowError, ImportUtils_customExercisesForRecords, ImportUtils_summarize } from "../utils/importTypes";
import { HistoryRecordView } from "./historyRecord";
import { LinkButton } from "./linkButton";
import { DateUtils_format } from "../utils/date";
import { CollectionUtils_sortBy } from "../utils/collection";
import { Button } from "./button";

interface IProps {
  dispatch: IDispatch;
  preview: IImportPreview;
  history: IHistoryRecord[];
  settings: ISettings;
}

function ExpandableSection(props: { title: string; items: string[] }): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <View className="pt-1">
      <Text className="text-sm text-text-secondary">
        ⚠ {props.title}{" "}
        <LinkButton className="text-sm" onPress={() => setIsExpanded(!isExpanded)} name="expand-section-import-preview">
          {isExpanded ? "숨기기" : "자세히"}
        </LinkButton>
      </Text>
      {isExpanded && (
        <View className="pl-4">
          {props.items.map((item, i) => (
            <Text key={i} className="text-xs text-text-secondary">
              {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function formatRowError(error: IImportRowError): string {
  return `${error.row}행: ${error.message}`;
}

export function ScreenImportPreview(props: IProps): JSX.Element {
  const { result, source } = props.preview;
  // Duplicate detection runs over ALL parsed records (against existing history).
  const summary = useMemo(() => ImportUtils_summarize(result, props.history), [result, props.history]);
  // The created custom exercises aren't in settings until the import is applied, so merge them in
  // for rendering - otherwise their cards fall back to a wrong builtin exercise. Existing exercises
  // win over imported ones (matching apply behavior: a locally-renamed exercise keeps its name).
  const previewSettings = useMemo(
    () => ({ ...props.settings, exercises: { ...result.customExercises, ...props.settings.exercises } }),
    [props.settings, result.customExercises]
  );
  const [shouldSkipDuplicates, setShouldSkipDuplicates] = useState(true);
  const sortedRecords = useMemo(
    () => CollectionUtils_sortBy(result.historyRecords, "startTime", true),
    [result.historyRecords]
  );
  const recordsToImport = useMemo(
    () =>
      shouldSkipDuplicates && summary.duplicateIds.size > 0
        ? result.historyRecords.filter((r) => !summary.duplicateIds.has(r.id))
        : result.historyRecords,
    [shouldSkipDuplicates, summary.duplicateIds, result.historyRecords]
  );
  // Counts/date-range/custom-exercise list reflect what will ACTUALLY be imported (duplicates are
  // skipped by default), not every parsed record.
  const importSummary = useMemo(
    () =>
      ImportUtils_summarize(
        {
          ...result,
          historyRecords: recordsToImport,
          customExercises: ImportUtils_customExercisesForRecords(recordsToImport, result.customExercises),
        },
        props.history
      ),
    [result, recordsToImport, props.history]
  );

  const onImport = (): void => {
    const count = recordsToImport.length;
    const customExercises = ImportUtils_customExercisesForRecords(recordsToImport, result.customExercises);
    props.dispatch(Thunk_applyImport(recordsToImport, customExercises, source));
    updateState(props.dispatch, [lb<IState>().p("importPreview").record(undefined)], "Close import preview");
    props.dispatch(Thunk_pushScreen("main", undefined, { tab: "home" }));
    Dialog_alert(`운동 기록 ${count}개를 가져왔습니다.`);
  };

  useNavOptions({
    navTitle: "가져오기 미리보기",
    navRightButtons: [
      <Button
        kind="purple"
        buttonSize="md"
        key="import"
        name="import-preview-confirm"
        disabled={recordsToImport.length === 0}
        onClick={onImport}
      >
        가져오기
      </Button>,
    ],
  });

  return (
    <View className="flex-1">
      <LegendList
        data={sortedRecords}
        keyExtractor={(record) => `${record.id}`}
        estimatedItemSize={300}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View className="px-gutter mb-6" pointerEvents="none">
            <HistoryRecordView
              historyRecord={item}
              showTitle={true}
              isOngoing={false}
              settings={previewSettings}
              dispatch={props.dispatch}
            />
          </View>
        )}
        ListHeaderComponent={
          <View className="px-gutter pb-4">
            <Text className="text-base font-semibold">가져올 운동 기록 {importSummary.workoutCount}개</Text>
            {importSummary.minStartTime != null && importSummary.maxStartTime != null && (
              <Text className="text-sm text-text-secondary">
                {DateUtils_format(importSummary.minStartTime)} - {DateUtils_format(importSummary.maxStartTime)}
              </Text>
            )}
            {importSummary.customExerciseNames.length > 0 && (
              <ExpandableSection
                title={`사용자 지정 운동으로 추가할 종목 ${importSummary.customExerciseNames.length}개`}
                items={importSummary.customExerciseNames}
              />
            )}
            {result.errors.length > 0 && (
              <ExpandableSection
                title={`해석할 수 없어 건너뛴 행 ${result.errors.length}개`}
                items={result.errors.map(formatRowError)}
              />
            )}
            {result.warnings.length > 0 && (
              <ExpandableSection
                title={`확인이 필요한 값 ${result.warnings.length}개`}
                items={result.warnings.map(formatRowError)}
              />
            )}
            {summary.duplicateIds.size > 0 && (
              <View className="pt-1">
                <Pressable>
                  <Text className="text-sm text-text-secondary">
                    ⚠ 기존 운동 기록과 중복될 수 있는 기록 {summary.duplicateIds.size}개{" "}
                    <LinkButton
                      name="toggle-duplicate-import-preview"
                      className="text-sm"
                      onPress={() => setShouldSkipDuplicates(!shouldSkipDuplicates)}
                    >
                      {shouldSkipDuplicates ? "건너뜀 · 포함하기" : "포함됨 · 건너뛰기"}
                    </LinkButton>
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}
