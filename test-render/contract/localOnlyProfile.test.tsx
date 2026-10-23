import { render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { Account } from "../../src/components/account";
import { ScreenAccount } from "../../src/components/screenAccount";
import { Service } from "../../src/api/service";
import { getInitialState } from "../../src/ducks/reducer";
import { Thunk_logOut, Thunk_fetchInitial, Thunk_sync2, Thunk_verifySubscriptionKey } from "../../src/ducks/thunks";
import { Distribution_isLocalOnly, DistributionLocalOnlyError, LocalStorageRecoveryError } from "../../src/utils/distribution";
import { Persistence, IPersistenceStore } from "../../src/utils/persistence";
import { IEnv, ILocalStorage } from "../../src/models/state";
import { IDispatch } from "../../src/ducks/types";
import { Fixture_build } from "../harness/fixture";
import { LogUtils_log } from "../../src/utils/log";
import { PerfTracker_flush, PerfTracker_recordEvent } from "../../src/utils/perfTracker.native";

jest.unmock("../../src/utils/distribution");
jest.mock("../../src/navigation/useNavOptions", () => ({ useNavOptions: () => undefined }));

class MemoryStore implements IPersistenceStore {
  public readonly data = new Map<string, string>();
  public async get(key: string): Promise<unknown> { return this.data.get(key); }
  public async getAllKeys(): Promise<string[]> { return [...this.data.keys()]; }
  public async setMany(pairs: Array<[string, string | undefined]>): Promise<void> {
    for (const [key, value] of pairs) {
      if (value == null) this.data.delete(key); else this.data.set(key, value);
    }
  }
}

const dispatch = jest.fn() as IDispatch;

it("resolves the real native KR profile and rejects backend calls without sending", async () => {
  expect(Distribution_isLocalOnly()).toBe(true);
  const client = jest.fn();
  const service = new Service(client);
  await expect(service.client("https://api3.liftosaur.com/api/sync2", { method: "POST" })).rejects.toBeInstanceOf(DistributionLocalOnlyError);
  expect(client).not.toHaveBeenCalled();
});

it("drops legacy log and performance telemetry without making network requests", async () => {
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response);
  try {
    LogUtils_log("local-user", "startup", {}, []);
    PerfTracker_recordEvent({ type: "test", ts: Date.now() } as never);
    await PerfTracker_flush();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
});

it("shows local-only account guidance without OAuth or password controls", async () => {
  await render(<Account client={jest.fn()} />);
  expect(screen.getByTestId("local-only-account")).toBeTruthy();
  expect(screen.queryByText("Google로 로그인")).toBeNull();
  expect(screen.queryByText("Apple로 로그인")).toBeNull();
});

it("keeps local account creation available while hiding cloud login and billing", async () => {
  const state = Fixture_build();
  await render(<ScreenAccount storage={state.storage} email="existing@example.com" userId={state.storage.tempUserId} navCommon={{} as never} dispatch={dispatch} />);
  expect(screen.getByText("새 로컬 계정 만들기")).toBeTruthy();
  expect(screen.getByText("현재 로컬 계정 삭제")).toBeTruthy();
  expect(screen.queryByText("Google로 로그인")).toBeNull();
  expect(screen.queryByText("비밀번호 변경")).toBeNull();
  expect(screen.queryByText("현재 클라우드 계정 삭제")).toBeNull();
  expect(screen.queryByText("🌟 Liftosaur 프리미엄")).toBeNull();
});

it("stops startup for invalid existing legacy data", async () => {
  for (const rawStorage of ["{broken", "{}", "[]", '{"storage":null}']) {
    const client = jest.fn();
    await expect(getInitialState(client, { rawStorage, deviceId: "test", url: new URL("https://example.com/app") })).rejects.toBeInstanceOf(LocalStorageRecoveryError);
    expect(client).not.toHaveBeenCalled();
  }
});

it("preserves a valid stored training snapshot without calling a remote recovery service", async () => {
  const fixture = Fixture_build();
  const localStorage: ILocalStorage = { storage: fixture.storage };
  const client = jest.fn();
  const loaded = await getInitialState(client, { localStorage, deviceId: "test", url: new URL("https://example.com/app") });
  expect(loaded.storage.tempUserId).toBe(fixture.storage.tempUserId);
  expect(loaded.storage.progress).toEqual(fixture.storage.progress);
  expect(loaded.storage.history).toEqual(fixture.storage.history);
  expect(client).not.toHaveBeenCalled();
});

it("does not verify or clean up existing subscription records during local startup or sync", async () => {
  const state = Fixture_build();
  state.storage.subscription.apple.push({ id: "receipt", value: "old-receipt", createdAt: 1, vtype: "subscription_receipt" });
  state.storage.subscription.key = "old-key";
  const before = JSON.stringify(state.storage);
  const client = jest.fn();
  const env = { service: new Service(client) } as IEnv;
  for (const thunk of [Thunk_fetchInitial(), Thunk_verifySubscriptionKey(), Thunk_sync2({ force: true })]) {
    await thunk(dispatch, () => state, env);
  }
  expect(JSON.stringify(state.storage)).toBe(before);
  expect(client).not.toHaveBeenCalled();
});

it("drains pending writes and saves the current account before a local switch callback", async () => {
  const state = Fixture_build();
  state.user = { id: state.storage.tempUserId, email: "previous@example.com" };
  const original = JSON.stringify(state.storage);
  const store = new MemoryStore();
  const persistence = new Persistence(store, "sharded", 1000);
  persistence.scheduleSave(state.storage.tempUserId, { storage: state.storage });
  const callback = jest.fn(async () => {
    const saved = await persistence.load(`liftosaur_${state.storage.tempUserId}`);
    expect(saved?.storage?.progress).toEqual(state.storage.progress);
    expect(saved?.storage?.history).toEqual(state.storage.history);
  });
  const service = { signout: jest.fn() };
  const keychain = { clearAuthToken: jest.fn() };
  await Thunk_logOut(callback)(dispatch, () => state, { persistence, service, keychain } as unknown as IEnv);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(service.signout).not.toHaveBeenCalled();
  expect(keychain.clearAuthToken).not.toHaveBeenCalled();
  expect(JSON.stringify(state.storage)).toBe(original);
  persistence.cancelSave();
});

it("does not switch away when saving the current account fails", async () => {
  const state = Fixture_build();
  const callback = jest.fn();
  const persistence = { flushSave: jest.fn().mockResolvedValue(undefined), saveFull: jest.fn().mockRejectedValue(new Error("disk full")) };
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  try {
    await expect(Thunk_logOut(callback)(dispatch, () => state, { persistence } as unknown as IEnv)).resolves.toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    expect(alert.mock.calls[0]?.[1]).toContain("현재 계정과 운동 기록은 그대로 유지됩니다");
  } finally {
    alert.mockRestore();
  }
});
