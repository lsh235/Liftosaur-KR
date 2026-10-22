import "mocha";
import { expect } from "chai";
import { WorkoutMenuActions_list, WorkoutMenu_deleteConfirmationMessage } from "../src/utils/workoutMenuActions";

describe("WorkoutMenuActions", () => {
  it("uses clear Korean text for deleting current and previous workout records", () => {
    expect(WorkoutMenu_deleteConfirmationMessage(true)).to.equal("진행 중인 운동 기록을 삭제할까요?");
    expect(WorkoutMenu_deleteConfirmationMessage(false)).to.equal("이 운동 기록을 삭제할까요?");
  });

  it("lists edit day, muscles, tour and delete for an ongoing program workout", () => {
    const actions = WorkoutMenuActions_list({
      isCurrent: true,
      hasNonEmptyProgram: true,
      hasNonEmptyCurrentProgram: true,
      isInAnyProgram: true,
    });
    expect(actions).to.eql(["editDay", "muscles", "notes", "tour", "delete"]);
  });

  it("adds share for a past workout and create program day when no program owns it", () => {
    const actions = WorkoutMenuActions_list({
      isCurrent: false,
      hasNonEmptyProgram: false,
      hasNonEmptyCurrentProgram: false,
      isInAnyProgram: false,
    });
    expect(actions).to.eql(["notes", "share", "createProgramDay", "tour", "delete"]);
  });

  it("drops edit day when the program is no longer among the user's programs", () => {
    const actions = WorkoutMenuActions_list({
      isCurrent: true,
      hasNonEmptyProgram: true,
      hasNonEmptyCurrentProgram: false,
      isInAnyProgram: true,
    });
    expect(actions).to.eql(["muscles", "notes", "tour", "delete"]);
  });
});
