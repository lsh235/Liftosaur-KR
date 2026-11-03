import { Utils_getEnv } from "../utils";
import { IDI } from "../utils/di";

export type ICoachAdjustment = {
  setId: string;
  reps?: number;
  weight?: string;
  remove?: boolean;
};

export interface ICoachProposal {
  requestId: string;
  expectedVersion: string;
  changes: ICoachAdjustment[];
  reason?: string;
  createdAt: number;
  expiresAt: number;
  committedAt?: number;
  committedBy?: string;
  committedDeviceId?: string;
  outcome?: "applied" | "rejected" | "stale";
}

export interface ICoachSession {
  sessionId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  ttl: number;
  status: "active" | "closed";
  exportId?: string;
  pending?: ICoachProposal;
  lastAck?: { requestId: string; decision: "applied" | "rejected" | "stale"; at: number; claimId: string; deviceId: string };
}

export const coachSessionTableNames = {
  dev: "lftCoachSessionsDev",
  prod: "lftCoachSessions",
} as const;

export class CoachSessionDao {
  constructor(private readonly di: IDI) {}

  async create(session: ICoachSession): Promise<boolean> {
    return this.di.dynamo.putIfNotExists({
      tableName: coachSessionTableNames[Utils_getEnv()],
      item: session,
      partitionKey: "sessionId",
    });
  }

  async get(sessionId: string): Promise<ICoachSession | undefined> {
    return this.di.dynamo.get<ICoachSession>({
      tableName: coachSessionTableNames[Utils_getEnv()],
      key: { sessionId },
    });
  }

  async queue(sessionId: string, proposal: ICoachProposal, now: number): Promise<ICoachSession | undefined> {
    return (await this.di.dynamo.update({
      tableName: coachSessionTableNames[Utils_getEnv()],
      key: { sessionId },
      expression: "SET #pending = :proposal",
      attrs: { "#pending": "pending" },
      values: { ":proposal": proposal },
      condition: {
        expression: "#status = :active AND #expiresAt > :now AND attribute_not_exists(#pending)",
        attrs: { "#status": "status", "#expiresAt": "expiresAt", "#pending": "pending" },
        values: { ":active": "active", ":now": now },
      },
      returnValues: "ALL_NEW",
    })) as unknown as ICoachSession | undefined;
  }

  async commit(sessionId: string, requestId: string, expectedVersion: string, committedAt: number, claimId: string, deviceId: string): Promise<ICoachSession | undefined> {
    return (await this.di.dynamo.update({
      tableName: coachSessionTableNames[Utils_getEnv()],
      key: { sessionId },
      expression: "SET #pending.#committedAt = :committedAt, #pending.#committedBy = :claimId, #pending.#committedDeviceId = :deviceId",
      attrs: { "#pending": "pending", "#committedAt": "committedAt", "#committedBy": "committedBy", "#committedDeviceId": "committedDeviceId" },
      values: { ":committedAt": committedAt, ":claimId": claimId, ":deviceId": deviceId },
      condition: {
        expression: "#status = :active AND #expiresAt > :now AND #pending.#requestId = :requestId AND #pending.#expectedVersion = :expectedVersion AND attribute_not_exists(#pending.#committedBy)",
        attrs: { "#status": "status", "#expiresAt": "expiresAt", "#pending": "pending", "#requestId": "requestId", "#expectedVersion": "expectedVersion", "#committedBy": "committedBy" },
        values: { ":active": "active", ":now": committedAt, ":requestId": requestId, ":expectedVersion": expectedVersion },
      },
      returnValues: "ALL_NEW",
    })) as unknown as ICoachSession | undefined;
  }

  async ack(sessionId: string, requestId: string, decision: "applied" | "rejected" | "stale", now: number, claimId: string, deviceId: string): Promise<ICoachSession | undefined> {
    const current = await this.get(sessionId);
    if (!current) return undefined;
    if (current.lastAck?.requestId === requestId) {
      return current.lastAck.decision === decision && current.lastAck.claimId === claimId && current.lastAck.deviceId === deviceId ? current : undefined;
    }
    if (!current?.pending || current.pending.requestId !== requestId) return undefined;
    const committed = current.pending.committedAt != null;
    if (committed && (current.pending.committedBy !== claimId || current.pending.committedDeviceId !== deviceId)) return undefined;
    if (!committed && decision === "applied") return undefined;
    try {
      // lastAck stores the most recent result. Compare the exact previous value instead of
      // requiring it to be absent, so later proposals can be acknowledged in the same session.
      // This remains a CAS guard: concurrent acknowledgements cannot overwrite each other.
      const priorAckCondition = current.lastAck
        ? "#lastAck.#requestId = :priorAckRequestId AND #lastAck.#decision = :priorAckDecision AND #lastAck.#at = :priorAckAt AND #lastAck.#claimId = :priorAckClaimId AND #lastAck.#deviceId = :priorAckDeviceId"
        : "attribute_not_exists(#lastAck)";
      const ackConditionValues = current.lastAck
        ? {
            ":priorAckRequestId": current.lastAck.requestId,
            ":priorAckDecision": current.lastAck.decision,
            ":priorAckAt": current.lastAck.at,
            ":priorAckClaimId": current.lastAck.claimId,
            ":priorAckDeviceId": current.lastAck.deviceId,
          }
        : {};
      return (await this.di.dynamo.update({
        tableName: coachSessionTableNames[Utils_getEnv()],
        key: { sessionId },
        expression: "SET #lastAck = :lastAck REMOVE #pending",
        attrs: { "#lastAck": "lastAck", "#pending": "pending" },
        values: { ":lastAck": { requestId, decision, at: now, claimId, deviceId } },
        condition: {
          expression: committed
            ? `#pending.#requestId = :requestId AND #pending.#committedAt = :committedAt AND #pending.#committedBy = :claimId AND #pending.#committedDeviceId = :deviceId AND ${priorAckCondition}`
            : `#pending.#requestId = :requestId AND attribute_not_exists(#pending.#committedAt) AND ${priorAckCondition}`,
          attrs: { "#pending": "pending", "#requestId": "requestId", "#committedAt": "committedAt", "#committedBy": "committedBy", "#committedDeviceId": "committedDeviceId", "#lastAck": "lastAck", "#decision": "decision", "#at": "at", "#claimId": "claimId", "#deviceId": "deviceId" },
          values: committed
            ? { ":requestId": requestId, ":committedAt": current.pending.committedAt as number, ":claimId": claimId, ":deviceId": deviceId, ...ackConditionValues }
            : { ":requestId": requestId, ...ackConditionValues },
        },
        returnValues: "ALL_NEW",
      })) as unknown as ICoachSession | undefined;
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
      const latest = await this.get(sessionId);
      if (latest?.lastAck?.requestId === requestId && latest.lastAck.decision === decision && latest.lastAck.claimId === claimId && latest.lastAck.deviceId === deviceId) return latest;
      if (latest?.pending?.requestId === requestId && latest.pending.committedAt != null && latest.pending.committedBy === claimId && latest.pending.committedDeviceId === deviceId) {
        return this.ack(sessionId, requestId, decision, now, claimId, deviceId);
      }
      return undefined;
    }
  }

  async close(sessionId: string, now: number): Promise<ICoachSession | undefined> {
    return (await this.di.dynamo.update({
      tableName: coachSessionTableNames[Utils_getEnv()],
      key: { sessionId },
      expression: "SET #status = :closed, #closedAt = :now REMOVE #pending",
      attrs: { "#status": "status", "#closedAt": "closedAt", "#pending": "pending" },
      values: { ":closed": "closed", ":now": now },
      condition: {
        expression: "#status = :active AND attribute_not_exists(#pending.#committedAt)",
        attrs: { "#status": "status", "#pending": "pending", "#committedAt": "committedAt" },
        values: { ":active": "active" },
      },
      returnValues: "ALL_NEW",
    })) as unknown as ICoachSession | undefined;
  }
}
