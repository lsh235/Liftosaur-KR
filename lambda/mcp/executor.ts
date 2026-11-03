import { ILimitedUserDao } from "../dao/userDao";
import { IDI } from "../utils/di";
import { CoachSessionDao } from "../dao/coachSessionDao";
import { CoachSession_getActive } from "../api/coachSession";
import { ApiV1_getCurrentWorkout } from "../utils/apiv1Workout";
import { WorkoutCoach_validateChanges } from "../utils/workoutCoach";
import { ICoachAdjustment } from "../dao/coachSessionDao";
import {
  ApiV1_getHistory,
  ApiV1_createHistory,
  ApiV1_updateHistory,
  ApiV1_deleteHistory,
  ApiV1_listPrograms,
  ApiV1_getProgram,
  ApiV1_createProgram,
  ApiV1_updateProgram,
  ApiV1_deleteProgram,
  ApiV1_playground,
  ApiV1_programStats,
  ApiV1_listCustomExercises,
  ApiV1_getCustomExercise,
  ApiV1_createCustomExercise,
  ApiV1_updateCustomExercise,
  ApiV1_deleteCustomExercise,
  IApiError,
} from "../utils/apiv1";
import {
  ApiV1_listGyms,
  ApiV1_createGym,
  ApiV1_updateGym,
  ApiV1_deleteGym,
  ApiV1_listEquipment,
  ApiV1_getEquipment,
  ApiV1_updateEquipment,
  ApiV1_createCustomEquipment,
  IWritableEquipmentField,
} from "../utils/apiv1Equipment";
import {
  ApiV1_listExerciseData,
  ApiV1_getExerciseData,
  ApiV1_setExerciseData,
  ApiV1_deleteExerciseData,
  IWritableExerciseDataField,
} from "../utils/apiv1ExerciseData";
import {
  ApiV1_listMeasurements,
  ApiV1_getMeasurement,
  ApiV1_addMeasurement,
  ApiV1_updateMeasurement,
  ApiV1_deleteMeasurement,
} from "../utils/apiv1Measurements";
import { IEither } from "../../src/utils/types";
import { IMuscle, IExerciseKind } from "../../src/types";
import * as v from "valibot";

type IToolResult = IEither<unknown, IApiError>;

function err(status: number, code: string, message: string): IToolResult {
  return { success: false, error: { status, code, message } };
}

// Models reuse run_playground's `programText` name in create_program and update_program, so accept both.
function programTextArg(args: Record<string, unknown>): string | undefined {
  const text = args.text ?? args.programText;
  return typeof text === "string" ? text : undefined;
}

function missingProgramText(): IToolResult {
  return err(400, "invalid_input", "Missing required parameter 'text' (the Liftoscript program source)");
}

// Tool args come from LLM clients that routinely deviate from the schema (plain strings instead of
// JSON arrays, objects instead of arrays), so both the JSON parse AND the shape are validated here —
// the error restates the expected format so the calling model can self-correct on the next attempt.
function parseStringArrayArg(raw: unknown, message: string): IEither<string[] | undefined, IApiError> {
  if (raw == null || raw === "") {
    return { success: true, data: undefined };
  }
  let value: unknown;
  try {
    value = asJson(raw);
  } catch (e) {
    return { success: false, error: { status: 400, code: "invalid_input", message } };
  }
  const parsed = v.safeParse(v.array(v.string()), value);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: "invalid_input", message } };
  }
  return { success: true, data: parsed.output };
}

// These coercers accept both native JSON values (from MCP clients that honor the structured schema) and
// the stringified forms (clients that pass escaped JSON / "true" / "2"). Anything that isn't a recognized
// form is passed through UNCHANGED so the downstream valibot schema rejects it with a 400 — never silently
// coerced into a wrong value (e.g. "yes" must not become false, "abc" must not become NaN).
const asBool = (raw: unknown): unknown => {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return raw;
};
const asJson = (raw: unknown): unknown => (typeof raw === "string" ? JSON.parse(raw) : raw);
const asNumber = (raw: unknown): unknown => {
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string" && raw.trim() !== "" && isFinite(Number(raw))) {
    return Number(raw);
  }
  return raw;
};

// One entry per writable equipment field — keyed by IWritableEquipmentField so a new writable field
// added to IEquipmentData/the API schema is a compile error here until MCP arg-parsing is added for it.
const EQUIPMENT_ARG_PARSERS: Record<IWritableEquipmentField, (raw: unknown) => unknown> = {
  bar: asJson,
  plates: asJson,
  fixed: asJson,
  multiplier: asNumber,
  isFixed: asBool,
  unit: (raw) => raw,
  name: (raw) => raw,
  notes: (raw) => raw,
  similarTo: (raw) => raw,
  useBodyweightForBar: asBool,
  isAssisting: asBool,
  isDeleted: asBool,
  setup: asJson,
};

function parseEquipmentArgs(args: Record<string, unknown>): { input: Record<string, unknown>; error?: IToolResult } {
  const input: Record<string, unknown> = {};
  try {
    for (const field of Object.keys(EQUIPMENT_ARG_PARSERS) as IWritableEquipmentField[]) {
      if (args[field] != null) {
        input[field] = EQUIPMENT_ARG_PARSERS[field](args[field]);
      }
    }
  } catch (e) {
    return { input, error: err(400, "invalid_input", "setup, bar, plates, and fixed must be valid JSON") };
  }
  return { input };
}

// One entry per writable exercise-data field — keyed by IWritableExerciseDataField so a new writable field
// is a compile error here until MCP arg-parsing is added for it. Unlike equipment, `null` is meaningful
// (clears a field), so it's passed through to the API rather than skipped.
const EXERCISE_DATA_ARG_PARSERS: Record<IWritableExerciseDataField, (raw: unknown) => unknown> = {
  rm1: (raw) => raw,
  rounding: asNumber,
  equipment: asJson,
  notes: (raw) => raw,
  muscleMultipliers: asJson,
  isUnilateral: asBool,
  volumeMultiplier: asNumber,
};

function parseExerciseDataArgs(args: Record<string, unknown>): {
  input: Record<string, unknown>;
  error?: IToolResult;
} {
  const input: Record<string, unknown> = {};
  try {
    for (const field of Object.keys(EXERCISE_DATA_ARG_PARSERS) as IWritableExerciseDataField[]) {
      if (field in args && args[field] !== undefined) {
        input[field] = EXERCISE_DATA_ARG_PARSERS[field](args[field]);
      }
    }
  } catch (e) {
    return { input, error: err(400, "invalid_input", "equipment and muscleMultipliers must be valid JSON") };
  }
  return { input };
}

export async function McpToolExecutor_execute(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  user: ILimitedUserDao,
  deviceId: string,
  di: IDI
): Promise<IToolResult> {
  if (toolName === "get_active_workout_session") {
    const sessionId = args.sessionId;
    if (typeof sessionId !== "string" || sessionId.length < 16 || sessionId.length > 128) {
      return err(400, "invalid_input", "A valid sessionId from the app export is required.");
    }
    const active = await CoachSession_getActive(sessionId, userId, di);
    if (!active.success) return err(active.status, active.code, active.message);
    const current = await ApiV1_getCurrentWorkout(userId, active.user, di);
    if (!current.success) return { success: false, error: current.error };
    const pending = active.session.pending;
    const publicPending = pending ? Object.fromEntries(Object.entries(pending).filter(([key]) => key !== "committedBy")) : undefined;
    const proposalStatus = pending
      ? (pending.committedAt == null ? "queued" : "claimed")
      : active.session.lastAck?.decision ?? "none";
    return {
      success: true,
      data: {
        sessionId,
        expiresAt: active.session.expiresAt,
        expectedVersion: active.version,
        workout: current.data.workout,
        adjustmentStatus: {
          status: proposalStatus,
          ...(pending ? {
            requestId: pending.requestId,
            proposal: publicPending,
            ...(pending.committedAt == null ? {} : { committedAt: pending.committedAt, committedDeviceId: pending.committedDeviceId }),
          } : active.session.lastAck ? {
            requestId: active.session.lastAck.requestId,
            appDecisionAt: active.session.lastAck.at,
            appDecision: active.session.lastAck.decision,
            confirmation: active.session.lastAck.decision === "applied" ? "app_ack_only_server_does_not_verify_device_sync" : "app_ack",
          } : {}),
        },
      },
    };
  }

  if (toolName === "propose_active_workout_adjustment") {
    const sessionId = args.sessionId;
    const requestId = args.requestId;
    const expectedVersion = args.expectedVersion;
    if (typeof sessionId !== "string" || typeof requestId !== "string" || requestId.length < 1 || requestId.length > 100 || typeof expectedVersion !== "string") {
      return err(400, "invalid_input", "sessionId, requestId and expectedVersion are required.");
    }
    const active = await CoachSession_getActive(sessionId, userId, di);
    if (!active.success) return err(active.status, active.code, active.message);
    if (active.version !== expectedVersion) return err(409, "workout_conflict", "The active workout changed. Read it again before proposing an adjustment.");
    const changeSchema = v.object({
      setId: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
      reps: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500))),
      weight: v.optional(v.string()),
      remove: v.optional(v.boolean()),
    });
    const parsedChanges = v.safeParse(v.pipe(v.array(changeSchema), v.minLength(1), v.maxLength(80)), args.changes);
    if (!parsedChanges.success) return err(400, "invalid_input", "Provide 1 to 80 valid set changes.");
    const validated = WorkoutCoach_validateChanges(active.progress, parsedChanges.output as ICoachAdjustment[]);
    if (!validated.success) return err(400, "invalid_adjustment", validated.message);
    const existing = active.session.pending;
    if (active.session.lastAck?.requestId === requestId) {
      return err(409, "request_already_acknowledged", `This request was already ${active.session.lastAck.decision}. Create a new requestId for another adjustment.`);
    }
    if (existing) {
      if (existing.requestId === requestId && existing.expectedVersion === expectedVersion && JSON.stringify(existing.changes) === JSON.stringify(validated.changes) && existing.reason === args.reason) {
        return { success: true, data: { queued: true, proposal: existing, expiresAt: active.session.expiresAt } };
      }
      return err(409, "proposal_pending", "There is already an adjustment awaiting the app. Wait for it to be reviewed first.");
    }
    const now = Date.now();
    const proposal = {
      requestId,
      expectedVersion,
      changes: validated.changes,
      ...(typeof args.reason === "string" && args.reason.length > 0 ? { reason: args.reason.slice(0, 500) } : {}),
      createdAt: now,
      expiresAt: active.session.expiresAt,
    };
    let queued;
    try {
      queued = await new CoachSessionDao(di).queue(sessionId, proposal, now);
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
    }
    if (!queued) {
      const latest = await new CoachSessionDao(di).get(sessionId);
      if (latest?.userId === userId && latest.status === "active" && latest.expiresAt > Date.now() && latest.pending?.requestId === requestId && latest.pending.expectedVersion === expectedVersion && JSON.stringify(latest.pending.changes) === JSON.stringify(validated.changes)) {
        return { success: true, data: { queued: true, proposal: latest.pending, expiresAt: latest.expiresAt } };
      }
      return err(409, "proposal_conflict", "The request could not be queued because the session expired or another adjustment was submitted.");
    }
    return { success: true, data: { queued: true, proposal: queued.pending, expiresAt: queued.expiresAt } };
  }

  switch (toolName) {
    case "get_history":
      return ApiV1_getHistory(
        userId,
        user,
        {
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          limit: args.limit as string | undefined,
          cursor: args.cursor as string | undefined,
        },
        di
      );

    case "get_history_record": {
      const id = parseInt(args.id as string, 10);
      const result = await ApiV1_getHistory(userId, user, { limit: "200" }, di);
      if (!result.success) {
        return result;
      }
      const record = result.data.records.find((r) => r.id === id);
      if (!record) {
        return err(404, "not_found", "History record not found");
      }
      return { success: true, data: record };
    }

    case "create_history_record":
      return ApiV1_createHistory(userId, user, args.text as string, deviceId, di);

    case "update_history_record":
      return ApiV1_updateHistory(userId, user, parseInt(args.id as string, 10), args.text as string, deviceId, di);

    case "delete_history_record":
      return ApiV1_deleteHistory(userId, user, parseInt(args.id as string, 10), deviceId, di);

    case "list_programs":
      return ApiV1_listPrograms(userId, user, di);

    case "get_program":
      return ApiV1_getProgram(userId, user, args.id as string, di);

    case "create_program": {
      const createText = programTextArg(args);
      if (createText == null) {
        return missingProgramText();
      }
      const createResult = await ApiV1_createProgram(userId, user, args.name as string, createText, deviceId, di);
      if (!createResult.success) {
        return createResult;
      }
      const createStats = ApiV1_programStats(user, createText);
      return {
        success: true,
        data: { ...createResult.data, stats: createStats.success ? createStats.data : undefined },
      };
    }

    case "update_program": {
      const updateText = programTextArg(args);
      if (updateText == null) {
        return missingProgramText();
      }
      const updateResult = await ApiV1_updateProgram(
        userId,
        user,
        args.id as string,
        updateText,
        args.name as string | undefined,
        deviceId,
        di
      );
      if (!updateResult.success) {
        return updateResult;
      }
      const updateStats = ApiV1_programStats(user, updateText);
      return {
        success: true,
        data: { ...updateResult.data, stats: updateStats.success ? updateStats.data : undefined },
      };
    }

    case "delete_program":
      return ApiV1_deleteProgram(userId, user, args.id as string, deviceId, di);

    case "run_playground": {
      const programText = args.programText as string | undefined;
      if (programText == null) {
        return err(400, "invalid_input", "Missing required parameter 'programText' (the Liftoscript program source)");
      }
      const parsedCommands = parseStringArrayArg(
        args.commands,
        'commands must be a JSON array of command strings, e.g. ["complete_set(1, 1)", "finish_workout()"]'
      );
      if (!parsedCommands.success) {
        return parsedCommands;
      }
      const commands = parsedCommands.data;
      const playgroundResult = ApiV1_playground(user, {
        programText,
        day: args.day ? parseInt(args.day as string, 10) : undefined,
        week: args.week ? parseInt(args.week as string, 10) : undefined,
        commands,
      });
      if (!playgroundResult.success) {
        return playgroundResult;
      }
      const playgroundStats = ApiV1_programStats(user, programText);
      return {
        success: true,
        data: { ...playgroundResult.data, stats: playgroundStats.success ? playgroundStats.data : undefined },
      };
    }

    case "list_custom_exercises":
      return ApiV1_listCustomExercises(user, {
        limit: args.limit as string | undefined,
        cursor: args.cursor as string | undefined,
      });

    case "get_custom_exercise":
      return ApiV1_getCustomExercise(user, args.id as string);

    case "create_custom_exercise": {
      const createTargetMuscles = parseStringArrayArg(
        args.targetMuscles,
        'targetMuscles must be a JSON array of muscle names, e.g. ["Quadriceps", "Gluteus Maximus"]'
      );
      if (!createTargetMuscles.success) {
        return createTargetMuscles;
      }
      const createSynergistMuscles = parseStringArrayArg(
        args.synergistMuscles,
        'synergistMuscles must be a JSON array of muscle names, e.g. ["Hamstrings"]'
      );
      if (!createSynergistMuscles.success) {
        return createSynergistMuscles;
      }
      const createTypes = parseStringArrayArg(
        args.types,
        'types must be a JSON array of exercise kinds, e.g. ["legs", "squat"]'
      );
      if (!createTypes.success) {
        return createTypes;
      }
      return ApiV1_createCustomExercise(
        userId,
        user,
        args.name as string,
        (createTargetMuscles.data ?? []) as IMuscle[],
        (createSynergistMuscles.data ?? []) as IMuscle[],
        (createTypes.data ?? []) as IExerciseKind[],
        deviceId,
        di
      );
    }

    case "update_custom_exercise": {
      const updateFields: {
        name?: string;
        targetMuscles?: IMuscle[];
        synergistMuscles?: IMuscle[];
        types?: IExerciseKind[];
      } = {};
      if (args.name != null) {
        updateFields.name = args.name as string;
      }
      const updateTargetMuscles = parseStringArrayArg(
        args.targetMuscles,
        'targetMuscles must be a JSON array of muscle names, e.g. ["Quadriceps", "Gluteus Maximus"]'
      );
      if (!updateTargetMuscles.success) {
        return updateTargetMuscles;
      }
      if (updateTargetMuscles.data != null) {
        updateFields.targetMuscles = updateTargetMuscles.data as IMuscle[];
      }
      const updateSynergistMuscles = parseStringArrayArg(
        args.synergistMuscles,
        'synergistMuscles must be a JSON array of muscle names, e.g. ["Hamstrings"]'
      );
      if (!updateSynergistMuscles.success) {
        return updateSynergistMuscles;
      }
      if (updateSynergistMuscles.data != null) {
        updateFields.synergistMuscles = updateSynergistMuscles.data as IMuscle[];
      }
      const updateTypes = parseStringArrayArg(
        args.types,
        'types must be a JSON array of exercise kinds, e.g. ["legs", "squat"]'
      );
      if (!updateTypes.success) {
        return updateTypes;
      }
      if (updateTypes.data != null) {
        updateFields.types = updateTypes.data as IExerciseKind[];
      }
      return ApiV1_updateCustomExercise(userId, user, args.id as string, updateFields, deviceId, di);
    }

    case "delete_custom_exercise":
      return ApiV1_deleteCustomExercise(userId, user, args.id as string, deviceId, di);

    case "list_gyms":
      return ApiV1_listGyms(user);

    case "create_gym":
      return ApiV1_createGym(userId, user, args.name as string, deviceId, di);

    case "update_gym":
      return ApiV1_updateGym(
        userId,
        user,
        args.gymId as string,
        {
          name: args.name,
          setCurrent: args.setCurrent != null ? asBool(args.setCurrent) : undefined,
        },
        deviceId,
        di
      );

    case "delete_gym":
      return ApiV1_deleteGym(userId, user, args.gymId as string, deviceId, di);

    case "list_equipment":
      return ApiV1_listEquipment(user, args.gymId as string);

    case "get_equipment":
      return ApiV1_getEquipment(user, args.gymId as string, args.id as string);

    case "update_equipment": {
      const parsed = parseEquipmentArgs(args);
      if (parsed.error) {
        return parsed.error;
      }
      return ApiV1_updateEquipment(userId, user, args.gymId as string, args.id as string, parsed.input, deviceId, di);
    }

    case "create_custom_equipment": {
      const parsed = parseEquipmentArgs(args);
      if (parsed.error) {
        return parsed.error;
      }
      return ApiV1_createCustomEquipment(
        userId,
        user,
        args.gymId as string,
        args.name as string,
        parsed.input,
        deviceId,
        di
      );
    }

    case "list_exercise_data":
      return ApiV1_listExerciseData(user);

    case "get_exercise_data":
      return ApiV1_getExerciseData(user, args.key as string);

    case "set_exercise_data": {
      const parsed = parseExerciseDataArgs(args);
      if (parsed.error) {
        return parsed.error;
      }
      return ApiV1_setExerciseData(userId, user, args.key as string, parsed.input, deviceId, di);
    }

    case "delete_exercise_data":
      return ApiV1_deleteExerciseData(userId, user, args.key as string, deviceId, di);

    case "list_measurements":
      return ApiV1_listMeasurements(userId, user, di);

    case "get_measurement":
      return ApiV1_getMeasurement(
        userId,
        user,
        args.key as string,
        {
          limit: args.limit != null ? String(args.limit) : undefined,
          cursor: args.cursor != null ? String(args.cursor) : undefined,
        },
        deviceId,
        di
      );

    case "add_measurement":
      return ApiV1_addMeasurement(
        userId,
        user,
        args.key as string,
        { value: args.value != null ? String(args.value) : undefined, timestamp: args.timestamp },
        deviceId,
        di
      );

    case "update_measurement":
      return ApiV1_updateMeasurement(
        userId,
        user,
        args.key as string,
        args.timestamp as string | number,
        { value: args.value != null ? String(args.value) : undefined },
        deviceId,
        di
      );

    case "delete_measurement":
      return ApiV1_deleteMeasurement(userId, user, args.key as string, args.timestamp as string | number, deviceId, di);

    case "get_program_stats":
      return ApiV1_programStats(user, args.programText as string);

    default:
      return err(400, "unknown_tool", `Unknown tool: ${toolName}`);
  }
}
