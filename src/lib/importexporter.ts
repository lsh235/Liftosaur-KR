import { ISettings, IStorage } from "../types";
import { Dialog_alert } from "../utils/dialog";
import { DateUtils_formatYYYYMMDD } from "../utils/date";
import { Exporter_toFile } from "../utils/exporter";
import { IExportedProgram } from "../models/program";
import { Storage_getDefault, Storage_get, Storage_setAffiliate } from "../models/storage";
import { IEither } from "../utils/types";
import { getLatestMigrationVersion } from "../migrations/migrations";
import { IDispatch } from "../ducks/types";
import { Thunk_importProgram } from "../ducks/thunks";
import { ObjectUtils_clone, ObjectUtils_pick } from "../utils/object";
import { ImportFromLink_importFromLink } from "../utils/importFromLink";
import { UrlUtils_build } from "../utils/url";
import { IExportedPlannerProgram } from "../pages/planner/models/types";
import { PlannerProgram_convertExportedPlannerToProgram } from "../pages/planner/models/plannerProgram";
import { Settings_build } from "../models/settings";
import { AiWorkoutProgram_tryImport } from "../utils/aiWorkoutProgram";
import {
  FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES,
  FileImportLimits_isContentTooLarge,
  FileImportLimits_sizeError,
} from "../utils/fileImportLimits";

export function ImportExporter_exportStorage(storage: IStorage): void {
  Exporter_toFile(`liftosaur-${DateUtils_formatYYYYMMDD(Date.now())}.json`, JSON.stringify(storage, null, 2));
}

function isPlanProgram(program: IExportedProgram | IExportedPlannerProgram): program is IExportedPlannerProgram {
  return "type" in program && program.type === "v2";
}

export async function ImportExporter_getExportedProgram(
  client: Window["fetch"],
  maybeProgram: string,
  settings?: ISettings
): Promise<IEither<IExportedProgram, string[]>> {
  if (FileImportLimits_isContentTooLarge(maybeProgram, FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES)) {
    return { success: false, error: [FileImportLimits_sizeError(FILE_IMPORT_PROGRAM_MAX_SIZE_BYTES)] };
  }
  const aiProgram = AiWorkoutProgram_tryImport(maybeProgram, settings);
  if (aiProgram?.success === false) {
    return aiProgram;
  }
  let parsedMaybeProgram: IExportedProgram | IExportedPlannerProgram;
  if (aiProgram?.success === true) {
    parsedMaybeProgram = aiProgram.data;
  } else {
    try {
      parsedMaybeProgram = JSON.parse(maybeProgram);
    } catch (e) {
      return {
        success: false,
        error: ["파일을 읽을 수 없습니다. 유효한 Liftosaur JSON 또는 AI 운동 루틴 JSON/CSV인지 확인하세요."],
      };
    }
  }
  let exportedProgram: IExportedProgram;
  if (isPlanProgram(parsedMaybeProgram)) {
    exportedProgram = PlannerProgram_convertExportedPlannerToProgram(parsedMaybeProgram, settings || Settings_build());
  } else {
    exportedProgram = parsedMaybeProgram;
  }
  const payload = Storage_getDefault();
  payload.settings = ObjectUtils_clone(settings || payload.settings);
  payload.settings.timers.workout = exportedProgram.settings?.timers?.workout || payload.settings.timers.workout;
  payload.settings.units = exportedProgram.settings?.units || payload.settings.units;
  payload.settings.exercises = exportedProgram.customExercises;
  payload.programs.push(exportedProgram.program);
  payload.version = exportedProgram.version;
  const result = Storage_get(payload, false);
  if (result.success) {
    const storage = result.data;
    const customExercises = storage.settings.exercises;
    const program = storage.programs.filter((p) => p.id === exportedProgram.program.id)[0];
    return {
      success: true,
      data: {
        customExercises,
        program,
        version: getLatestMigrationVersion(),
        settings: ObjectUtils_pick(payload.settings, ["timers", "units"]),
      },
    };
  } else {
    return result;
  }
}

export async function ImportExporter_handleUniversalLink(
  dispatch: IDispatch,
  link: string,
  client: Window["fetch"]
): Promise<void> {
  const url = UrlUtils_build(link);
  if ((url.pathname === "/program" && url.searchParams.has("data")) || url.pathname.startsWith("/p/")) {
    const data = await ImportFromLink_importFromLink(link, client);
    if (data.success) {
      const source = data.data.source;
      if (source) {
        Storage_setAffiliate(dispatch, source, "program");
      }
      dispatch(Thunk_importProgram(data.data));
    } else {
      Dialog_alert(data.error.join("\n"));
    }
  }
}
