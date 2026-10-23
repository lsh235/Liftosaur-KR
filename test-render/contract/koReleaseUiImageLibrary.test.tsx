import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ExerciseImageLibraryContent } from "../../src/components/exercisePicker/bottomSheetExerciseImageLibrary";
import { Service } from "../../src/api/service";
import { Exercise_createCustomExercise } from "../../src/models/exercise";
import { Settings_build } from "../../src/models/settings";

// Virtualized layout is outside this contract. Keep the header and a small window of rows visible.
jest.mock("@legendapp/list", () => {
  const { View } = require("react-native");
  return {
    LegendList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent }: any) => (
      <View>
        {ListHeaderComponent}
        {data.length === 0
          ? ListEmptyComponent
          : data.slice(0, 5).map((item: any, index: number) => <View key={index}>{renderItem({ item })}</View>)}
      </View>
    ),
  };
});

function buildProps(getUploadedImages: jest.Mock, isLoggedIn = true) {
  return {
    isLoggedIn,
    service: { getUploadedImages } as unknown as Service,
    settings: Settings_build("kg"),
    onClose: jest.fn(),
    onSelect: jest.fn(),
  };
}

describe("Korean exercise image library recovery", () => {
  it("keeps built-in images usable after a failed upload request, then recovers on retry", async () => {
    const getUploadedImages = jest.fn().mockRejectedValueOnce(new Error("offline"));
    const props = buildProps(getUploadedImages);
    const customExercise = Exercise_createCustomExercise("나의 케이블 운동", [], [], []);
    props.settings.exercises[customExercise.id] = customExercise;
    const uploadedUrl = `https://example.test/user-${customExercise.id}.png`;
    getUploadedImages.mockResolvedValueOnce([uploadedUrl]);

    await render(<ExerciseImageLibraryContent {...props} />);
    await waitFor(() => expect(screen.getByTestId("uploaded-images-error")).toBeTruthy());
    expect(screen.getByText("기본 운동 이미지")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("retry-uploaded-images"));
    await waitFor(() => expect(screen.getByText("나의 케이블 운동")).toBeTruthy());
    expect(screen.queryByTestId("uploaded-images-error")).toBeNull();
    await fireEvent.press(screen.getByText("나의 케이블 운동"));
    expect(props.onSelect).toHaveBeenCalledWith(uploadedUrl);
    expect(getUploadedImages).toHaveBeenCalledTimes(2);
  });

  it("discards an old upload response after logout", async () => {
    let resolveUpload!: (images: string[]) => void;
    const getUploadedImages = jest.fn().mockImplementation(
      () =>
        new Promise<string[]>((resolve) => {
          resolveUpload = resolve;
        })
    );
    const props = buildProps(getUploadedImages);
    const app = await render(<ExerciseImageLibraryContent {...props} />);
    await app.rerender(<ExerciseImageLibraryContent {...props} isLoggedIn={false} />);
    const privateImage = "https://example.test/user-private.png";

    await act(async () => resolveUpload([privateImage]));

    expect(screen.queryByText("업로드한 이미지")).toBeNull();
    expect(getUploadedImages).toHaveBeenCalledTimes(1);
  });

  it("searches built-in images using Korean display names without requiring login", async () => {
    const getUploadedImages = jest.fn();
    const props = buildProps(getUploadedImages, false);
    await render(<ExerciseImageLibraryContent {...props} />);

    await fireEvent.changeText(screen.getByTestId("exercise-filter-by-name"), "벤치프레스");

    expect(screen.getByPlaceholderText("운동 이름으로 검색")).toBeTruthy();
    expect(screen.getAllByText(/벤치프레스/).length).toBeGreaterThan(0);
    expect(getUploadedImages).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId("exercise-filter-by-name"), "존재하지않는운동이미지");
    expect(screen.getByText("검색한 운동 이미지가 없습니다")).toBeTruthy();
  });
});
