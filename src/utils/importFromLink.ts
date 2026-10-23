import { IEither } from "./types";
import { Encoder_decode } from "./encoder";
import { Service } from "../api/service";
import { UrlUtils_build } from "./url";

export interface IImportLinkData {
  decoded: string;
  source?: string;
  userid?: string;
}

export async function ImportFromLink_importFromLink(
  link: string,
  client: Window["fetch"]
): Promise<IEither<{ decoded: string; source?: string; userid?: string }, string[]>> {
  let url: URL;
  try {
    url = UrlUtils_build(link);
  } catch (e) {
    return { success: false, error: ["올바르지 않은 링크입니다. 링크를 확인해 주세요."] };
  }
  let base64 = url.searchParams.get("data") || undefined;
  let source = url.searchParams.get("s") || undefined;
  let userid = url.searchParams.get("u") || undefined;
  let decoded;
  if (base64) {
    decoded = await getDecodedData(base64);
  } else {
    const [type, id] = url.pathname.split("/").filter((p) => p);
    if ((type === "p" || type === "n") && id) {
      const service = new Service(client);
      const result = await service.getDataFromShortUrl(type, id);
      base64 = result.data;
      source = source || result.s;
      userid = userid || result.u;
      if (base64) {
        decoded = await getDecodedData(base64);
      }
    }
  }
  if (decoded) {
    if (decoded.success) {
      return { success: true, data: { decoded: decoded.data, source, userid } };
    } else {
      return decoded;
    }
  } else {
    return { success: false, error: ["링크에서 가져올 데이터를 찾지 못했습니다. 링크를 확인해 주세요."] };
  }
}

async function getDecodedData(base64: string): Promise<IEither<string, string[]>> {
  try {
    const decoded = await Encoder_decode(base64);
    return { success: true, data: decoded };
  } catch (e) {
    return { success: false, error: ["링크 데이터를 읽을 수 없습니다. 링크가 손상되지 않았는지 확인해 주세요."] };
  }
}
