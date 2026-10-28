import { gunzipSync, gzip } from "fflate";
import { UrlUtils_build } from "../../src/utils/url";

export async function NodeEncoder_encodeIntoUrl(str: string, base: string): Promise<URL> {
  const base64data = await NodeEncoder_encode(str.replace("liftosaur://", "https://"));
  const url = UrlUtils_build(base);
  const urlParams = new URLSearchParams(url.search);
  urlParams.set("data", base64data);
  url.search = urlParams.toString();
  return url;
}

export function NodeEncoder_encode(str: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const textEncoder = new TextEncoder();
    gzip(textEncoder.encode(str), (err, result) => {
      if (!err) {
        resolve(
          Buffer.from(`data:application/octet-stream;base64,${Buffer.from(result).toString("base64")}`).toString(
            "base64"
          )
        );
      } else {
        reject(err);
      }
    });
  });
}

export function NodeEncoder_decode(data: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const buffer = Buffer.from(data, "base64");
      const dataUrl = buffer.toString("utf-8");
      const base64 = dataUrl.split(",")[1];
      if (base64) {
        const buffer2 = Buffer.from(base64, "base64");
        const result = gunzipSync(buffer2);
        resolve(Buffer.from(result).toString("utf-8"));
      } else {
        reject(new Error("Malformed base64 data"));
      }
    } catch (e) {
      reject(e);
    }
  });
}
