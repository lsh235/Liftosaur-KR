import { JSX, useEffect, useMemo, useState, useCallback } from "react";
import { View, Image } from "react-native";
import { TextInput } from "../primitives/textInput";
import { LegendList } from "@legendapp/list";
import { Text } from "../primitives/text";
import { ISettings } from "../../types";
import {
  IExercise,
  Exercise_allExpanded,
  Exercise_find,
  Exercise_fullName,
  Exercise_nameWithEquipment,
  Exercise_toKey,
} from "../../models/exercise";
import { MenuItemWrapper } from "../menuItem";
import { ExerciseImage } from "../exerciseImage";
import { Tailwind_colors, Tailwind_semantic } from "../../utils/tailwindConfig";
import { IconMagnifyingGlass } from "../icons/iconMagnifyingGlass";
import { StringUtils_fuzzySearch } from "../../utils/string";
import { Service } from "../../api/service";
import { GroupHeader } from "../groupHeader";
import { IconSpinner } from "../icons/iconSpinner";
import { LinkButton } from "../linkButton";
import { UidFactory_generateUid } from "../../utils/generator";
import { ExerciseImageUtils_url } from "../../models/exerciseImage";
import { BottomSheetOrModal } from "../bottomSheetOrModal";
import { SheetDragHandle } from "../../navigation/TransparentModal";

interface IProps {
  isHidden: boolean;
  settings: ISettings;
  isLoggedIn: boolean;
  service: Service;
  onClose: () => void;
  onSelect: (smallImageUrl?: string, largeImageUrl?: string) => void;
}

export type IExerciseImageLibraryContentProps = Omit<IProps, "isHidden"> & { bare?: boolean };

function getExerciseIdFromImageUrl(url: string): string | undefined {
  return url.split("/").pop()?.split("-").slice(1).join("-").split(".")[0];
}

export function ExerciseImageLibraryContent(props: IExerciseImageLibraryContentProps): JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(props.isLoggedIn);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [search, setSearch] = useState<string>("");
  const [hasUploadError, setHasUploadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setUploadedImages([]);
    setHasUploadError(false);
    setIsLoading(props.isLoggedIn);
    if (props.isLoggedIn) {
      props.service
        .getUploadedImages()
        .then((imgs) => {
          if (active) {
            setUploadedImages(imgs);
          }
        })
        .catch(() => {
          if (active) {
            setHasUploadError(true);
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [props.isLoggedIn, props.service, retryCount]);

  const trimmedSearch = search.trim().toLowerCase();
  const exercises = useMemo(
    () =>
      !trimmedSearch
        ? Exercise_allExpanded({})
        : Exercise_allExpanded({}).filter((e) => {
            return StringUtils_fuzzySearch(
              trimmedSearch,
              `${Exercise_nameWithEquipment(e, props.settings)} ${Exercise_fullName(e, props.settings)}`.toLowerCase()
            );
          }),
    [trimmedSearch, props.settings]
  );

  const filteredUploadedImages = !trimmedSearch
    ? uploadedImages
    : uploadedImages.filter((img) => {
        const exerciseId = getExerciseIdFromImageUrl(img);
        const customExercise = exerciseId ? Exercise_find({ id: exerciseId }, props.settings.exercises) : undefined;
        if (customExercise) {
          return StringUtils_fuzzySearch(trimmedSearch, customExercise.name.toLowerCase());
        } else {
          return false;
        }
      });

  const keyExtractor = useCallback((exercise: IExercise) => Exercise_toKey(exercise), []);
  const renderBuiltinItem = useCallback(
    ({ item: exercise }: { item: IExercise }) => (
      <MenuItemWrapper
        name={exercise.name}
        onClick={() => {
          const smallImageUrl = ExerciseImageUtils_url(exercise, "small");
          const largeImageUrl = ExerciseImageUtils_url(exercise, "large");
          props.onSelect(smallImageUrl, largeImageUrl);
        }}
      >
        <View className="flex-row items-center min-h-scaled-16 py-2 gap-4">
          <View className="w-scaled-10">
            <ExerciseImage settings={props.settings} exerciseType={exercise} size="small" className="w-full" />
          </View>
          <Text className="flex-1 min-w-0">{Exercise_nameWithEquipment(exercise, props.settings)}</Text>
        </View>
      </MenuItemWrapper>
    ),
    [props.onSelect, props.settings]
  );

  const ListHeader = (
    <>
      {hasUploadError && (
        <View className="py-3 gap-2" testID="uploaded-images-error">
          <Text className="text-sm text-text-secondary">
            업로드한 이미지를 불러오지 못했습니다. 기본 운동 이미지를 선택하거나 다시 시도하세요.
          </Text>
          <LinkButton name="retry-uploaded-images" onClick={() => setRetryCount((count) => count + 1)}>
            다시 시도
          </LinkButton>
        </View>
      )}
      {(isLoading || filteredUploadedImages.length > 0) && (
        <>
          <GroupHeader name="업로드한 이미지" />
          {isLoading ? (
            <View className="items-center py-4">
              <IconSpinner width={18} height={18} />
            </View>
          ) : (
            filteredUploadedImages.map((img) => {
              const exerciseId = getExerciseIdFromImageUrl(img) ?? UidFactory_generateUid(8);
              const customExercise = exerciseId
                ? Exercise_find({ id: exerciseId }, props.settings.exercises)
                : undefined;
              return (
                <MenuItemWrapper
                  key={exerciseId}
                  name={customExercise?.name ?? exerciseId}
                  onClick={() => {
                    props.onSelect(img);
                  }}
                >
                  <View className="flex-row items-center min-h-scaled-16 py-2 gap-4">
                    <View className="w-scaled-10">
                      <Image source={{ uri: img }} className="w-scaled-10 h-scaled-10" resizeMode="contain" />
                    </View>
                    {customExercise && (
                      <Text className="flex-1 min-w-0">
                        {Exercise_nameWithEquipment(customExercise, props.settings)}
                      </Text>
                    )}
                  </View>
                </MenuItemWrapper>
              );
            })
          )}
        </>
      )}
      <GroupHeader name="기본 운동 이미지" topPadding={true} />
    </>
  );

  const header = (
    <SheetDragHandle>
      <View collapsable={false} className="px-gutter pb-2">
        <Text className="pt-1 pb-3 text-base font-semibold text-center">운동 이미지 선택</Text>
        <View className="flex-row items-center gap-2 p-2 rounded-lg bg-background-neutral">
          <IconMagnifyingGlass size={18} color={Tailwind_colors().lightgray[600]} />
          <TextInput
            placeholder="운동 이름으로 검색"
            placeholderTextColor={Tailwind_semantic().text.secondarysubtle}
            className="flex-1 text-sm text-text-secondary"
            style={{ paddingVertical: 0, includeFontPadding: false }}
            data-testid="exercise-filter-by-name"
            testID="exercise-filter-by-name"
            defaultValue={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
        </View>
      </View>
    </SheetDragHandle>
  );
  const list = (
    <LegendList
      data={exercises}
      keyExtractor={keyExtractor}
      renderItem={renderBuiltinItem}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <Text className="py-4 text-sm text-center text-text-secondary">검색한 운동 이미지가 없습니다</Text>
      }
      contentContainerStyle={{ paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
    />
  );
  if (props.bare) {
    return (
      <>
        {header}
        {list}
      </>
    );
  }
  return (
    <View className="flex-1">
      {header}
      {list}
    </View>
  );
}

export function BottomSheetExerciseImageLibrary(props: IProps): JSX.Element {
  return (
    <BottomSheetOrModal isHidden={props.isHidden} onClose={props.onClose} shouldShowClose={true}>
      <ExerciseImageLibraryContent
        settings={props.settings}
        isLoggedIn={props.isLoggedIn}
        service={props.service}
        onClose={props.onClose}
        onSelect={props.onSelect}
      />
    </BottomSheetOrModal>
  );
}
