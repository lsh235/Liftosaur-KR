import { expect } from "chai";
import { Distribution_createPolicy, DistributionLocalOnlyError } from "../src/utils/distributionPolicy";
import * as web from "../src/utils/distribution";
import * as native from "../src/utils/distribution.native";

// Test both product contracts without spoofing Platform.OS or changing the runtime profile.
describe("KR distribution boundaries", () => {
  it("keeps the web contract and allows native local-first builds to use account sync", () => {
    expect(web.Distribution_isLocalOnly()).to.equal(false);
    expect(native.Distribution_isLocalOnly()).to.equal(true);
    expect(native.Distribution_supportsCloudSync()).to.equal(true);
  });

  it("allows only account and sync requests in a local-only cloud-enabled build", async () => {
    let called = 0;
    const client = native.Distribution_guardClient((async () => {
      called += 1;
      return { ok: true } as Response;
    }) as Window["fetch"]);

    await client("https://tigerfit.aixtech.uk/api/signin/email", { method: "POST", body: "credentials" });
    await client("https://tigerfit.aixtech.uk/api/sync2", { method: "POST", body: "workout" });
    await client("https://tigerfit.aixtech.uk/api/history?limit=100");
    expect(called).to.equal(3);

    let caught: unknown;
    try {
      await client("https://tigerfit.aixtech.uk/api/v1/programs", { method: "GET" });
    } catch (error) { caught = error; }
    expect(caught).to.be.instanceOf(DistributionLocalOnlyError);
    expect((caught as DistributionLocalOnlyError).code).to.equal("local_only_distribution");
    expect(called).to.equal(3);
  });

  it("keeps cloud sync disabled when the native policy has not opted in", async () => {
    const policy = Distribution_createPolicy(true);
    expect(policy.Distribution_supportsCloudSync()).to.equal(false);
    let called = 0;
    const client = policy.Distribution_guardClient((async () => {
      called += 1;
      return { ok: true } as Response;
    }) as Window["fetch"]);
    let caught: unknown;
    try {
      await client("https://tigerfit.aixtech.uk/api/sync2", { method: "POST", body: "workout" });
    } catch (error) { caught = error; }
    expect(caught).to.be.instanceOf(DistributionLocalOnlyError);
    expect(called).to.equal(0);
  });

  it("forwards the original web request, response, and failure contract", async () => {
    const sent: unknown[][] = [];
    const response = { ok: true, status: 200 } as Response;
    const client = web.Distribution_guardClient((async (...args: unknown[]) => {
      sent.push(args);
      return response;
    }) as Window["fetch"]);
    const options = { method: "POST", body: "record" };
    expect(await client("/api/storage", options)).to.equal(response);
    expect(sent).to.eql([["/api/storage", options]]);
    const original = new Error("offline");
    const failing = Distribution_createPolicy(false).Distribution_guardClient(async () => { throw original; });
    let caught: unknown;
    try { await failing("/api/storage"); } catch (error) { caught = error; }
    expect(caught).to.equal(original);
  });
});
