/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import "mocha";
import { D1DynamoUtil } from "../cloudflare/tigerfit";
import { CoachSessionDao, ICoachSession } from "../lambda/dao/coachSessionDao";
import { IDI } from "../lambda/utils/di";
import { postCoachSessionHandler, postCoachSessionCommitHandler, postCoachSessionAckHandler } from "../lambda/api/coachSession";
import { McpToolExecutor_execute } from "../lambda/mcp/executor";
import { UserDao, userTableNames } from "../lambda/dao/userDao";
import { UserRow_pack } from "../lambda/utils/userRow";
import { Storage_getDefault } from "../src/models/storage";
import { IHistoryRecord } from "../src/types";
import { Weight_build } from "../src/models/weight";
import { AiWorkoutCoachAdjustment_apply } from "../src/utils/aiWorkoutCoachAdjustment";
import { WorkoutCoach_version } from "../lambda/utils/workoutCoach";
import JWT from "jsonwebtoken";

type ISqliteStatement = {
  all(...values: unknown[]): Record<string, unknown>[];
  get(...values: unknown[]): Record<string, unknown> | undefined;
  run(...values: unknown[]): { changes: number | bigint };
};

class SqliteD1Statement {
  private values: unknown[] = [];
  private readonly db: any;
  private readonly sql: string;
  constructor(db: any, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }
  async all<T = Record<string, unknown>>(): Promise<{ success: boolean; results: T[] }> {
    return { success: true, results: (this.db.prepare(this.sql) as ISqliteStatement).all(...this.values) as T[] };
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return ((this.db.prepare(this.sql) as ISqliteStatement).get(...this.values) as T | undefined) ?? null;
  }
  async run(): Promise<{ meta: { changes: number } }> {
    const result = (this.db.prepare(this.sql) as ISqliteStatement).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

function createD1Harness(): { db: any; di: IDI } {
  const DatabaseSync = (require("node:sqlite") as { DatabaseSync: new (path: string) => any }).DatabaseSync;
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE app_items (table_name TEXT NOT NULL, key_json TEXT NOT NULL, item_json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (table_name, key_json))"
  );
  const database = {
    prepare: (sql: string) => new SqliteD1Statement(db, sql),
    batch: async (statements: SqliteD1Statement[]) => Promise.all(statements.map((statement) => statement.run())),
  };
  return {
    db,
    di: { dynamo: new D1DynamoUtil(database as any) } as unknown as IDI,
  };
}

function session(sessionId: string, expiresAt: number): ICoachSession {
  return {
    sessionId,
    userId: "owner-1",
    createdAt: Date.now(),
    expiresAt,
    ttl: Math.floor(expiresAt / 1000),
    status: "active",
  };
}

describe("CoachSessionDao with the Cloudflare D1 adapter", () => {
  before(() => {
    (global as any).__ENV__ = "prod";
  });

  it("atomically grants a proposal commit to one device and allows only that device to acknowledge it", async () => {
    const { db, di } = createD1Harness();
    const dao = new CoachSessionDao(di);
    const sessionId = "d1-session-commit-test";
    const expiresAt = Date.now() + 60_000;
    await dao.create(session(sessionId, expiresAt));
    const proposal = {
      requestId: "req-1",
      expectedVersion: "a".repeat(64),
      changes: [{ setId: "future-set", reps: 6 }],
      createdAt: Date.now(),
      expiresAt,
    };
    await dao.queue(sessionId, proposal, Date.now());

    const firstDevice = "device_one";
    const secondDevice = "device_two";
    const firstClaim = `${sessionId}:${proposal.requestId}:${firstDevice}`;
    const secondClaim = `${sessionId}:${proposal.requestId}:${secondDevice}`;
    const attempts = await Promise.allSettled([
      dao.commit(sessionId, proposal.requestId, proposal.expectedVersion, Date.now(), firstClaim, firstDevice),
      dao.commit(sessionId, proposal.requestId, proposal.expectedVersion, Date.now(), secondClaim, secondDevice),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).to.have.length(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).to.have.length(1);

    const committed = await dao.get(sessionId);
    const claimId = committed!.pending!.committedBy!;
    const deviceId = committed!.pending!.committedDeviceId!;
    expect([firstClaim, secondClaim]).to.include(claimId);
    expect([firstDevice, secondDevice]).to.include(deviceId);

    const wrongDeviceAck = await dao.ack(sessionId, proposal.requestId, "applied", Date.now(), secondClaim, secondDevice);
    expect(wrongDeviceAck).to.equal(undefined);
    const applied = await dao.ack(sessionId, proposal.requestId, "applied", Date.now(), claimId, deviceId);
    expect(applied?.lastAck).to.include({ requestId: proposal.requestId, decision: "applied", claimId, deviceId });
    expect(applied?.pending).to.equal(undefined);
    expect(await dao.get(sessionId)).to.eql(applied);
    db.close();
  });

  it("rejects queue and commit writes after expiry in the production D1 conditional update", async () => {
    const { db, di } = createD1Harness();
    const dao = new CoachSessionDao(di);
    const sessionId = "d1-session-expiry-test";
    const expiredAt = Date.now() - 1000;
    await dao.create(session(sessionId, expiredAt));
    const proposal = {
      requestId: "req-expired",
      expectedVersion: "b".repeat(64),
      changes: [{ setId: "future-set", reps: 6 }],
      createdAt: Date.now(),
      expiresAt: expiredAt,
    };
    let queueRejected = false;
    try {
      await dao.queue(sessionId, proposal, Date.now());
    } catch {
      queueRejected = true;
    }
    expect(queueRejected).to.equal(true);
    let commitRejected = false;
    try {
      await dao.commit(
        sessionId,
        proposal.requestId,
        proposal.expectedVersion,
        Date.now(),
        `${sessionId}:req-expired:device_one`,
        "device_one"
      );
    } catch {
      commitRejected = true;
    }
    expect(commitRejected).to.equal(true);
    expect((await dao.get(sessionId))?.pending).to.equal(undefined);
    db.close();
  });

  it("requires a commit before applied acknowledgement, but records an explicit rejection", async () => {
    const { db, di } = createD1Harness();
    const dao = new CoachSessionDao(di);
    const sessionId = "d1-session-ack-test";
    const expiresAt = Date.now() + 60_000;
    await dao.create(session(sessionId, expiresAt));
    const proposal = {
      requestId: "req-ack",
      expectedVersion: "c".repeat(64),
      changes: [{ setId: "future-set", reps: 6 }],
      createdAt: Date.now(),
      expiresAt,
    };
    await dao.queue(sessionId, proposal, Date.now());
    const deviceId = "device_one";
    const claimId = `${sessionId}:${proposal.requestId}:${deviceId}`;

    const falseApplied = await dao.ack(sessionId, proposal.requestId, "applied", Date.now(), claimId, deviceId);
    expect(falseApplied).to.equal(undefined);
    const rejected = await dao.ack(sessionId, proposal.requestId, "rejected", Date.now(), claimId, deviceId);
    expect(rejected?.lastAck).to.include({ requestId: proposal.requestId, decision: "rejected", claimId, deviceId });
    expect(rejected?.pending).to.equal(undefined);
    expect(await dao.ack(sessionId, proposal.requestId, "rejected", Date.now(), claimId, deviceId)).to.eql(rejected);
    db.close();
  });

  it("accepts successive proposal acknowledgements and permits a new proposal after rejected or stale decisions", async () => {
    const { db, di } = createD1Harness();
    const dao = new CoachSessionDao(di);
    const sessionId = "d1-session-multiple-acks";
    const expiresAt = Date.now() + 60_000;
    await dao.create(session(sessionId, expiresAt));
    const deviceId = "device_one";
    let now = Date.now();

    for (const [index, decision] of [[1, "applied"], [2, "applied"]] as const) {
      const requestId = `req-multi-${index}`;
      const expectedVersion = String(index).repeat(64);
      const proposal = {
        requestId,
        expectedVersion,
        changes: [{ setId: "future-set", reps: 5 + index }],
        createdAt: now,
        expiresAt,
      };
      try {
        await dao.queue(sessionId, proposal, now++);
      } catch (error) {
        throw new Error(`queue failed for ${requestId}: ${String(error)}`);
      }
      const claimId = `${sessionId}:${requestId}:${deviceId}`;
      let committed;
      try {
        committed = await dao.commit(sessionId, requestId, expectedVersion, now++, claimId, deviceId);
      } catch (error) {
        throw new Error(`commit failed for ${requestId}: ${String(error)}`);
      }
      expect(committed, `commit failed for ${requestId}`).to.not.equal(undefined);
      let ack;
      try {
        ack = await dao.ack(sessionId, requestId, decision, now++, claimId, deviceId);
      } catch (error) {
        throw new Error(`ack failed for ${requestId}: ${String(error)}`);
      }
      expect(ack?.lastAck).to.include({ requestId, decision, claimId, deviceId });
      expect(ack?.pending).to.equal(undefined);
      try {
        expect(await dao.ack(sessionId, requestId, decision, now++, claimId, deviceId)).to.eql(ack);
      } catch (error) {
        throw new Error(`duplicate ack failed for ${requestId}: ${String(error)}`);
      }
    }
    expect((await dao.get(sessionId))?.lastAck?.requestId).to.equal("req-multi-2");

    const rejectedProposal = {
      requestId: "req-rejected",
      expectedVersion: "a".repeat(64),
      changes: [{ setId: "future-set", reps: 4 }],
      createdAt: now,
      expiresAt,
    };
    expect(await dao.queue(sessionId, rejectedProposal, now++)).to.not.equal(undefined);
    const rejectedClaim = `${sessionId}:req-rejected:${deviceId}`;
    const rejectedAck = await dao.ack(sessionId, "req-rejected", "rejected", now++, rejectedClaim, deviceId);
    expect(rejectedAck?.lastAck).to.include({ requestId: "req-rejected", decision: "rejected", claimId: rejectedClaim, deviceId });
    expect(rejectedAck?.pending).to.equal(undefined);

    const staleProposal = {
      requestId: "req-stale",
      expectedVersion: "b".repeat(64),
      changes: [{ setId: "future-set", reps: 5 }],
      createdAt: now,
      expiresAt,
    };
    expect(await dao.queue(sessionId, staleProposal, now++)).to.not.equal(undefined);
    const staleClaim = `${sessionId}:req-stale:${deviceId}`;
    const staleAck = await dao.ack(sessionId, "req-stale", "stale", now++, staleClaim, deviceId);
    expect(staleAck?.lastAck).to.include({ requestId: "req-stale", decision: "stale", claimId: staleClaim, deviceId });
    expect(staleAck?.pending).to.equal(undefined);

    const next = {
      requestId: "req-after-stale",
      expectedVersion: "c".repeat(64),
      changes: [{ setId: "future-set", reps: 7 }],
      createdAt: now,
      expiresAt,
    };
    expect(await dao.queue(sessionId, next, now++)).to.not.equal(undefined);
    db.close();
  });

  it("runs session creation, MCP proposal, app approval, local application, and acknowledgement through D1", async () => {
    const { db, di } = createD1Harness();
    (di as any).secrets = { getCookieSecret: async () => "workout-coach-test-cookie-secret" };
    const ownerId = "coach-e2e-owner";
    const cookieSecret = "workout-coach-test-cookie-secret";
    const user = {
      id: ownerId,
      email: "coach@example.test",
      createdAt: Date.now(),
      storage: Storage_getDefault(),
    } as any;
    const workout: IHistoryRecord = {
      vtype: "progress",
      id: Date.now(),
      date: "2026-11-03",
      startTime: Date.now(),
      programId: "program-1",
      programName: "Test program",
      day: 1,
      dayName: "Push",
      currentEntryIndex: 0,
      entries: [
        {
          vtype: "history_entry",
          id: "benchPress_barbell",
          index: 0,
          exercise: { id: "benchPress", equipment: "barbell" },
          sets: [
            { vtype: "set", id: "done", index: 0, reps: 8, weight: Weight_build(40, "kg"), isCompleted: true },
            { vtype: "set", id: "current", index: 1, reps: 8, weight: Weight_build(40, "kg"), isCompleted: false },
            { vtype: "set", id: "future", index: 2, reps: 8, weight: Weight_build(40, "kg"), isCompleted: false },
          ],
        },
      ],
    } as any;
    user.storage.progress = [workout];
    await di.dynamo.put({ tableName: userTableNames.prod.users, item: UserRow_pack(user) as any });

    const token = JWT.sign({ userId: ownerId }, cookieSecret);
    const makeEvent = (body: object) => ({
      body: JSON.stringify(body),
      headers: { cookie: `session=${token}` },
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/api/v1/coach/session",
      pathParameters: {},
      queryStringParameters: {},
      multiValueHeaders: {},
      multiValueQueryStringParameters: {},
      stageVariables: {},
      requestContext: {} as any,
      resource: "",
    });
    const sessionCreateStartedAt = Date.now();
    const post = await (postCoachSessionHandler as any)({ payload: { event: makeEvent({ ttlSeconds: 300 }), di } });
    expect(post.statusCode).to.equal(201);
    const createdSession = JSON.parse(post.body);
    const sessionId = createdSession.sessionId;
    expect(sessionId).to.be.a("string");
    expect(createdSession.expiresAt).to.be.at.least(sessionCreateStartedAt + 299_000);
    expect(createdSession.expiresAt).to.be.at.most(sessionCreateStartedAt + 301_000);
    expect(createdSession.pollIntervalMs).to.equal(2000);

    const persistedUser = (await new UserDao(di).getLimitedById(ownerId))!;
    const version = WorkoutCoach_version(workout);
    const wrongAccount = (await McpToolExecutor_execute(
      "propose_active_workout_adjustment",
      { sessionId, requestId: "request-wrong-owner", expectedVersion: version, changes: [{ setId: "future", reps: 6 }] },
      "different-account",
      persistedUser,
      "mcp_device",
      di
    )) as any;
    expect(wrongAccount.success).to.equal(false);
    expect(wrongAccount.error.code).to.equal("session_not_found");
    const proposalResult = (await McpToolExecutor_execute(
      "propose_active_workout_adjustment",
      { sessionId, requestId: "request-e2e-1", expectedVersion: version, changes: [{ setId: "future", reps: 6, weight: "35kg" }] },
      ownerId,
      persistedUser,
      "mcp_device",
      di
    )) as any;
    expect(proposalResult.success).to.equal(true);

    const deviceId = "app_device_1";
    const claimId = `${sessionId}:request-e2e-1:${deviceId}`;
    const commit = await (postCoachSessionCommitHandler as any)({
      payload: { event: makeEvent({ requestId: "request-e2e-1", expectedVersion: version, deviceId, claimId }), di },
      match: { params: { id: sessionId } },
    });
    expect(commit.statusCode).to.equal(200);
    const committed = JSON.parse(commit.body);
    expect(committed.committed).to.equal(true);

    const applied = AiWorkoutCoachAdjustment_apply(workout, committed.changes);
    expect("error" in applied).to.equal(false);
    if ("error" in applied) return;
    expect(applied.progress.entries[0].sets[0].isCompleted).to.equal(true);
    expect(applied.progress.entries[0].sets[2]).to.include({ reps: 6 });
    expect(applied.progress.entries[0].sets[2].weight).to.eql(Weight_build(35, "kg"));

    const ack = await (postCoachSessionAckHandler as any)({
      payload: { event: makeEvent({ requestId: "request-e2e-1", decision: "applied", deviceId, claimId }), di },
      match: { params: { id: sessionId } },
    });
    expect(ack.statusCode).to.equal(200);
    const storedSession = await new CoachSessionDao(di).get(sessionId);
    expect(storedSession?.lastAck).to.include({ requestId: "request-e2e-1", decision: "applied", claimId, deviceId });
    expect(storedSession?.pending).to.equal(undefined);
    db.close();
  });
});
