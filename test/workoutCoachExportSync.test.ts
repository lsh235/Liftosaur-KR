import { expect } from "chai";
import sinon from "sinon";
import * as dialog from "../src/utils/dialog";
import * as exporter from "../src/utils/exporter";
import * as coachSession from "../src/utils/aiWorkoutCoachSession";
import { SyncTestUtils_initTheApp } from "./utils/syncTestUtils";
import { Thunk_exportAiFeedbackMarkdown } from "../src/ducks/thunks";
import { IState } from "../src/models/state";
import { IAction } from "../src/ducks/reducer";
import { IEnv } from "../src/models/state";

describe("workout coach export sync gate", () => {
  beforeEach(() => {
    // @ts-ignore
    global.__API_HOST__ = "https://www.liftosaur.com";
    // @ts-ignore
    global.__HOST__ = "https://www.liftosaur.com";
    // @ts-ignore
    global.__ENV__ = "prod";
    // @ts-ignore
    global.__FULL_COMMIT_HASH__ = "abc123";
    // @ts-ignore
    global.__COMMIT_HASH__ = "abc123";
  });
  afterEach(() => sinon.restore());

  it("does not create the coach session before the forced sync completes", async () => {
    const { mockReducer, env } = await SyncTestUtils_initTheApp("coach_export_sync_wait");
    expect(mockReducer.state.user?.id).to.be.a("string");
    sinon.stub(coachSession, "AiWorkoutCoachSession_get").resolves(undefined);
    sinon.stub(coachSession, "AiWorkoutCoachSession_set").resolves();
    sinon.stub(coachSession, "AiWorkoutCoachSession_clear").resolves();
    sinon.stub(exporter, "Exporter_toFileAsync").resolves(true);

    let resolveSync!: () => void;
    let observedQueue!: () => void;
    const queueObserved = new Promise<void>((resolve) => (observedQueue = resolve));
    const syncGate = new Promise<void>((resolve) => (resolveSync = resolve));
    const originalEnqueue = env.queue.enqueue.bind(env.queue);
    sinon.stub(env.queue, "enqueue").callsFake(async (operation: any, deps: any, options: any) => {
      observedQueue();
      await syncGate;
      return originalEnqueue(operation, deps, options);
    });

    let createSessionCalls = 0;
    (env.service as any).createWorkoutCoachSession = async () => {
      createSessionCalls += 1;
      return { sessionId: "coach-session", expiresAt: Date.now() + 300_000, pollIntervalMs: 2000 };
    };

    const getState = (): IState => mockReducer.state;
    const dispatch = (_action: IAction | ((...args: any[]) => any)): void => undefined;
    const exportPromise = Thunk_exportAiFeedbackMarkdown("Workout feedback", "", undefined, 300)(
      dispatch as any,
      getState,
      env as IEnv
    );

    await queueObserved;
    expect(createSessionCalls).to.equal(0);
    resolveSync();
    await exportPromise;
    expect(createSessionCalls).to.equal(1);
  });

  it("skips coach session creation when forced sync fails and file-only export is declined", async () => {
    const { mockReducer, env } = await SyncTestUtils_initTheApp("coach_export_sync_failure");
    sinon.stub(coachSession, "AiWorkoutCoachSession_get").resolves(undefined);
    sinon.stub(coachSession, "AiWorkoutCoachSession_set").resolves();
    sinon.stub(exporter, "Exporter_toFileAsync").resolves(true);
    const confirm = sinon.stub(dialog, "Dialog_confirm").resolves(false);
    sinon.stub(env.queue, "enqueue").rejects(new Error("sync rejected"));
    let createSessionCalls = 0;
    (env.service as any).createWorkoutCoachSession = async () => {
      createSessionCalls += 1;
      return { sessionId: "must-not-exist", expiresAt: Date.now() + 300_000, pollIntervalMs: 2000 };
    };

    const getState = (): IState => mockReducer.state;
    const dispatch = (_action: IAction | ((...args: any[]) => any)): void => undefined;
    await Thunk_exportAiFeedbackMarkdown("Workout feedback", "", undefined, 300)(
      dispatch as any,
      getState,
      env as IEnv
    );

    expect(confirm.calledOnce).to.equal(true);
    expect(createSessionCalls).to.equal(0);
  });

  it("closes the server session and clears local metadata when the user cancels file sharing", async () => {
    const { mockReducer, env } = await SyncTestUtils_initTheApp("coach_export_share_cancel");
    sinon.stub(coachSession, "AiWorkoutCoachSession_get").resolves(undefined);
    const clearSession = sinon.stub(coachSession, "AiWorkoutCoachSession_clear").resolves();
    sinon.stub(coachSession, "AiWorkoutCoachSession_set").resolves();
    sinon.stub(exporter, "Exporter_toFileAsync").resolves(false);
    let closeCalls = 0;
    (env.service as any).createWorkoutCoachSession = async () => ({
      sessionId: "cancelled-share-session",
      expiresAt: Date.now() + 300_000,
      pollIntervalMs: 2000,
    });
    (env.service as any).closeWorkoutCoachSession = async (sessionId: string) => {
      expect(sessionId).to.equal("cancelled-share-session");
      closeCalls += 1;
    };

    const getState = (): IState => mockReducer.state;
    const dispatch = (_action: IAction | ((...args: any[]) => any)): void => undefined;
    await Thunk_exportAiFeedbackMarkdown("Workout feedback", "", undefined, 300)(
      dispatch as any,
      getState,
      env as IEnv
    );

    expect(closeCalls).to.equal(1);
    expect(clearSession.calledOnce).to.equal(true);
  });

  it("aborts connection creation when the external sync reaches its timeout", async () => {
    const { mockReducer, env } = await SyncTestUtils_initTheApp("coach_export_sync_timeout");
    const clock = sinon.useFakeTimers();
    sinon.stub(dialog, "Dialog_confirm").resolves(false);
    sinon.stub(env.queue, "enqueue").returns(new Promise<void>(() => undefined));
    let createSessionCalls = 0;
    (env.service as any).createWorkoutCoachSession = async () => {
      createSessionCalls += 1;
      return { sessionId: "must-not-exist", expiresAt: Date.now() + 300_000, pollIntervalMs: 2000 };
    };

    const getState = (): IState => mockReducer.state;
    const dispatch = (_action: IAction | ((...args: any[]) => any)): void => undefined;
    const exportPromise = Thunk_exportAiFeedbackMarkdown("Workout feedback", "", undefined, 300)(
      dispatch as any,
      getState,
      env as IEnv
    );
    await Promise.resolve();
    await clock.tickAsync(45_000);
    await exportPromise;

    expect(createSessionCalls).to.equal(0);
    clock.restore();
  });
});
