import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Endpoint, RouteHandler } from "yatro";
import * as Cookie from "cookie";
import * as v from "valibot";
import { IDI } from "../utils/di";
import { UserDao, ILimitedUserDao } from "../dao/userDao";
import { CoachSessionDao, ICoachSession } from "../dao/coachSessionDao";
import { UidFactory_generateSecureToken } from "../utils/generator";
import { apiError, ResponseUtils_apiJson } from "../utils/apiKeyAuth";
import { WorkoutCoach_version } from "../utils/workoutCoach";

interface IPayload { event: APIGatewayProxyEvent; di: IDI }

function bodyJson(event: APIGatewayProxyEvent): Record<string, unknown> {
  try {
    const body = event.body || "{}";
    return JSON.parse(event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body) as Record<string, unknown>;
  } catch { return {}; }
}

function errorResponse(status: number, code: string, message: string): APIGatewayProxyResult {
  return apiError(status, code, message);
}

async function withOwner(
  event: APIGatewayProxyEvent,
  di: IDI,
  handler: (userId: string, user: ILimitedUserDao) => Promise<APIGatewayProxyResult>
): Promise<APIGatewayProxyResult> {
  const cookieHeader = event.headers?.Cookie ?? event.headers?.cookie ?? "";
  const cookies = Cookie.parse(cookieHeader);
  const userDao = new UserDao(di);
  const userId = await userDao.getCurrentUserIdFromCookie(cookies);
  if (!userId) return errorResponse(401, "unauthorized", "Sign in to your TigerFit account to manage this session.");
  const user = await userDao.getLimitedById(userId);
  if (!user) return errorResponse(401, "unauthorized", "TigerFit account was not found.");
  return handler(userId, user);
}

export function CoachSession_checkAccess(session: ICoachSession | undefined, userId: string, now: number):
  | { ok: true; session: ICoachSession }
  | { ok: false; response: APIGatewayProxyResult } {
  if (!session || session.userId !== userId) {
    return { ok: false, response: errorResponse(404, "session_not_found", "Workout connection session was not found.") };
  }
  if (session.status !== "active") {
    return { ok: false, response: errorResponse(410, "session_closed", "Workout connection session is closed.") };
  }
  if (session.expiresAt <= now) {
    return { ok: false, response: errorResponse(410, "session_expired", "Workout connection session has expired.") };
  }
  return { ok: true, session };
}

function publicProposal(proposal: NonNullable<ICoachSession["pending"]>, stale = false): Record<string, unknown> {
  const { committedBy: _committedBy, ...visible } = proposal;
  return { ...visible, ...(stale ? { stale: true } : {}) };
}

export const postCoachSessionEndpoint = Endpoint.build("/api/v1/coach/session");
export const postCoachSessionHandler: RouteHandler<IPayload, APIGatewayProxyResult, typeof postCoachSessionEndpoint> = async ({ payload }) => {
  const { event, di } = payload;
  return withOwner(event, di, async (userId) => {
    const body = bodyJson(event);
    const parsed = v.safeParse(v.object({ ttlSeconds: v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(900)), exportId: v.optional(v.pipe(v.string(), v.maxLength(128))) }), body);
    if (!parsed.success) return errorResponse(400, "invalid_input", "Set a connection time between 1 and 15 minutes.");
    const now = Date.now();
    const expiresAt = now + parsed.output.ttlSeconds * 1000;
    const dao = new CoachSessionDao(di);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sessionId = UidFactory_generateSecureToken(24);
      const created = await dao.create({ sessionId, userId, createdAt: now, expiresAt, ttl: Math.floor(expiresAt / 1000), status: "active", ...(parsed.output.exportId ? { exportId: parsed.output.exportId } : {}) });
      if (created) return ResponseUtils_apiJson(201, { sessionId, expiresAt, pollIntervalMs: 2000 });
    }
    return errorResponse(503, "session_create_failed", "Could not create a workout connection session.");
  });
};

export const getCoachSessionPendingEndpoint = Endpoint.build("/api/v1/coach/session/:id/pending");
export const getCoachSessionPendingHandler: RouteHandler<IPayload, APIGatewayProxyResult, typeof getCoachSessionPendingEndpoint> = async ({ payload, match: { params } }) => {
  const { event, di } = payload;
  return withOwner(event, di, async (userId, user) => {
    const checked = CoachSession_checkAccess(await new CoachSessionDao(di).get(params.id), userId, Date.now());
    if (!checked.ok) return checked.response;
    const proposal = checked.session.pending;
    if (!proposal) return ResponseUtils_apiJson(200, { request: null });
    if (checked.session.lastAck?.requestId === proposal.requestId) return ResponseUtils_apiJson(200, { request: null });
    const current = user.storage.progress?.[0];
    if (proposal.committedAt == null && (!current || WorkoutCoach_version(current) !== proposal.expectedVersion)) {
      return ResponseUtils_apiJson(200, { request: publicProposal(proposal, true) });
    }
    return ResponseUtils_apiJson(200, { request: publicProposal(proposal) });
  });
};

export const postCoachSessionCommitEndpoint = Endpoint.build("/api/v1/coach/session/:id/commit");
export const postCoachSessionCommitHandler: RouteHandler<IPayload, APIGatewayProxyResult, typeof postCoachSessionCommitEndpoint> = async ({ payload, match: { params } }) => {
  const { event, di } = payload;
  return withOwner(event, di, async (userId, user) => {
    const body = bodyJson(event);
    const parsed = v.safeParse(v.object({ requestId: v.pipe(v.string(), v.minLength(1), v.maxLength(100)), expectedVersion: v.pipe(v.string(), v.minLength(1), v.maxLength(50000)), deviceId: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{1,128}$/)), claimId: v.pipe(v.string(), v.minLength(1), v.maxLength(300)) }), body);
    if (!parsed.success) return errorResponse(400, "invalid_input", "Request id, workout version, deviceId and claimId are required.");
    const expectedClaimId = `${params.id}:${parsed.output.requestId}:${parsed.output.deviceId}`;
    if (parsed.output.claimId !== expectedClaimId) return errorResponse(400, "invalid_claim", "The commit claim does not match this device and request.");
    const now = Date.now();
    const checked = CoachSession_checkAccess(await new CoachSessionDao(di).get(params.id), userId, now);
    if (!checked.ok) return checked.response;
    const proposal = checked.session.pending;
    if (!proposal || proposal.requestId !== parsed.output.requestId) return errorResponse(404, "proposal_not_found", "This adjustment request is no longer pending.");
    if (proposal.expectedVersion !== parsed.output.expectedVersion) return errorResponse(409, "workout_conflict", "The active workout changed. Ask Codex for a new adjustment.");
    if (proposal.committedAt != null) {
      if (proposal.committedBy !== parsed.output.claimId) return errorResponse(409, "already_claimed", "This adjustment was claimed by another device.");
      return ResponseUtils_apiJson(200, { committed: true, requestId: proposal.requestId, committedAt: proposal.committedAt, committedDeviceId: proposal.committedDeviceId, expiresAt: checked.session.expiresAt, expectedVersion: proposal.expectedVersion, changes: proposal.changes });
    }
    const current = user.storage.progress?.[0];
    if (!current || WorkoutCoach_version(current) !== proposal.expectedVersion) return errorResponse(409, "workout_conflict", "The active workout changed. Ask Codex for a new adjustment.");
    try {
      const committed = await new CoachSessionDao(di).commit(params.id, proposal.requestId, proposal.expectedVersion, now, parsed.output.claimId, parsed.output.deviceId);
      if (committed?.pending?.committedAt != null) {
        const saved = committed.pending;
        if (saved.committedBy !== parsed.output.claimId) return errorResponse(409, "already_claimed", "This adjustment was claimed by another device.");
        return ResponseUtils_apiJson(200, { committed: true, requestId: saved.requestId, committedAt: saved.committedAt, committedDeviceId: saved.committedDeviceId, expiresAt: committed.expiresAt, expectedVersion: saved.expectedVersion, changes: saved.changes });
      }
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
      const latest = await new CoachSessionDao(di).get(params.id);
      if (latest?.userId === userId && latest.expiresAt > Date.now() && latest.pending?.requestId === proposal.requestId && latest.pending.committedAt != null) {
        if (latest.pending.committedBy !== parsed.output.claimId) return errorResponse(409, "already_claimed", "This adjustment was claimed by another device.");
        const saved = latest.pending;
        return ResponseUtils_apiJson(200, { committed: true, requestId: saved.requestId, committedAt: saved.committedAt, committedDeviceId: saved.committedDeviceId, expiresAt: latest.expiresAt, expectedVersion: saved.expectedVersion, changes: saved.changes });
      }
    }
    return errorResponse(409, "workout_conflict", "Could not commit this adjustment. Refresh the workout and try again.");
  });
};

export const postCoachSessionAckEndpoint = Endpoint.build("/api/v1/coach/session/:id/ack");
export const postCoachSessionAckHandler: RouteHandler<IPayload, APIGatewayProxyResult, typeof postCoachSessionAckEndpoint> = async ({ payload, match: { params } }) => {
  const { event, di } = payload;
  return withOwner(event, di, async (userId) => {
    const parsed = v.safeParse(v.object({ requestId: v.pipe(v.string(), v.minLength(1), v.maxLength(100)), decision: v.picklist(["applied", "rejected", "stale"]), deviceId: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{1,128}$/)), claimId: v.pipe(v.string(), v.minLength(1), v.maxLength(300)) }), bodyJson(event));
    if (!parsed.success) return errorResponse(400, "invalid_input", "Request id, decision, deviceId and claimId are required.");
    if (parsed.output.claimId !== `${params.id}:${parsed.output.requestId}:${parsed.output.deviceId}`) return errorResponse(400, "invalid_claim", "The acknowledgement claim does not match this device and request.");
    const session = await new CoachSessionDao(di).get(params.id);
    if (!session || session.userId !== userId) return errorResponse(404, "session_not_found", "Workout connection session was not found.");
    const result = await new CoachSessionDao(di).ack(params.id, parsed.output.requestId, parsed.output.decision, Date.now(), parsed.output.claimId, parsed.output.deviceId);
    if (!result) return errorResponse(409, "proposal_not_committed_or_claimed", "Commit this adjustment from the claiming device before acknowledging it.");
    if (result.lastAck?.requestId === parsed.output.requestId && result.lastAck.decision !== parsed.output.decision) return errorResponse(409, "ack_conflict", "This adjustment already has a different result.");
    return ResponseUtils_apiJson(200, { acknowledged: true, requestId: parsed.output.requestId, decision: result.lastAck?.decision });
  });
};

export const postCoachSessionCloseEndpoint = Endpoint.build("/api/v1/coach/session/:id/close");
export const postCoachSessionCloseHandler: RouteHandler<IPayload, APIGatewayProxyResult, typeof postCoachSessionCloseEndpoint> = async ({ payload, match: { params } }) => {
  const { event, di } = payload;
  return withOwner(event, di, async (userId) => {
    const session = await new CoachSessionDao(di).get(params.id);
    if (!session || session.userId !== userId) return errorResponse(404, "session_not_found", "Workout connection session was not found.");
    if (session.pending?.committedAt != null) return errorResponse(409, "proposal_committed", "Finish applying the committed adjustment before closing the session.");
    try {
      await new CoachSessionDao(di).close(params.id, Date.now());
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
      const latest = await new CoachSessionDao(di).get(params.id);
      if (latest?.userId !== userId || latest.status !== "closed") return errorResponse(409, "proposal_committed", "The session changed before it could close.");
    }
    return ResponseUtils_apiJson(200, { closed: true });
  });
};

export async function CoachSession_getActive(sessionId: string, userId: string, di: IDI): Promise<
  { success: true; session: ICoachSession; user: ILimitedUserDao; version: string; progress: NonNullable<ILimitedUserDao["storage"]["progress"]>[number] }
  | { success: false; status: number; code: string; message: string }
> {
  const session = await new CoachSessionDao(di).get(sessionId);
  if (!session || session.userId !== userId) return { success: false, status: 404, code: "session_not_found", message: "Workout connection session was not found for this account." };
  if (session.status !== "active" || session.expiresAt <= Date.now()) return { success: false, status: 410, code: "session_expired", message: "Workout connection session is closed or expired." };
  const user = await new UserDao(di).getLimitedById(userId);
  const progress = user?.storage.progress?.[0];
  if (!user || !progress) return { success: false, status: 409, code: "no_active_workout", message: "There is no active workout to adjust." };
  return { success: true, session, user, version: WorkoutCoach_version(progress), progress };
}
