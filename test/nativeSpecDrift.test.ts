import "mocha";
import { expect } from "chai";
import fs from "fs";
import path from "path";

const REPO_ROOT = process.cwd();
const SPEC = path.join(REPO_ROOT, "src", "specs", "NativeLiftosaurLiveActivity.ts");
const BRIDGE = path.join(REPO_ROOT, "ios", "Liftosaur", "RCTLiftosaurLiveActivity.mm");
const ANDROID_MANIFEST = path.join(REPO_ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
const IOS_TIMER = path.join(REPO_ROOT, "ios", "Liftosaur", "LiftosaurTimerImpl.swift");

const ANDROID_ONLY: Record<string, string> = {
  isSetTimer: "LiveUpdateManager.kt",
};

function propertiesOf(spec: string, typeName: string): string[] {
  const match = spec.match(new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\};`));
  if (match == null) {
    throw new Error(`${typeName} is not in ${path.basename(SPEC)} — rename the test or the type`);
  }
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"))
    .map((line) => line.split(/[?:]/)[0].trim())
    .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
}

describe("Live Activity spec drift", () => {
  const spec = fs.readFileSync(SPEC, "utf8");
  const bridge = fs.readFileSync(BRIDGE, "utf8");

  for (const typeName of ["LiveActivitySetTimer", "LiveActivityGetReady", "LiveActivityEntry", "LiveActivityRest"]) {
    it(`copies every ${typeName} field in DictFromState`, () => {
      const properties = propertiesOf(spec, typeName);
      expect(properties.length).to.be.greaterThan(0);
      const missing = properties.filter((name) => ANDROID_ONLY[name] == null && !bridge.includes(`@"${name}"`));
      expect(missing, `${typeName} fields missing from DictFromState`).to.eql([]);
    });
  }

  it("reads a spec that still declares the types it checks", () => {
    expect(propertiesOf(spec, "LiveActivitySetTimer")).to.include.members(["phaseId", "side", "recordedThisSide"]);
    expect(propertiesOf(spec, "LiveActivityGetReady")).to.include.members(["phaseId", "side"]);
  });
});

describe("Android workout reminder restore manifest", () => {
  it("declares every event handled by TimerAlarmRescheduler", () => {
    const manifest = fs.readFileSync(ANDROID_MANIFEST, "utf8");
    const receiver = manifest.match(
      /<receiver\b(?=[^>]*android:name="\.timer\.TimerAlarmRescheduler")[\s\S]*?<\/receiver>/
    );
    expect(receiver, "TimerAlarmRescheduler must be registered in AndroidManifest.xml").not.to.equal(null);
    const receiverXml = receiver![0];
    const actions = [
      "android.intent.action.BOOT_COMPLETED",
      "android.intent.action.MY_PACKAGE_REPLACED",
      "android.intent.action.TIME_SET",
      "android.intent.action.TIMEZONE_CHANGED",
      "android.intent.action.TIMEZONE_OFFSET_CHANGED",
      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
    ];
    for (const action of actions) {
      expect(receiverXml, `TimerAlarmRescheduler is missing ${action}`).to.include(
        `<action android:name="${action}" />`
      );
    }
    expect(manifest).to.include('<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />');
  });
});

describe("iOS workout reminder calendar", () => {
  it("uses Gregorian dates and follows the current local time zone", () => {
    const source = fs.readFileSync(IOS_TIMER, "utf8");
    const start = source.indexOf("private func workoutReminderDateComponents");
    const end = source.indexOf("private func scheduleWorkoutRemindersInternal", start);
    expect(start, "workout reminder date-component helper must exist").to.be.greaterThan(-1);
    expect(end, "workout reminder scheduling method must follow the helper").to.be.greaterThan(start);
    const helper = source.slice(start, end);

    expect(helper).to.include("Calendar(identifier: .gregorian)");
    expect(helper).to.include("calendar.timeZone = TimeZone.autoupdatingCurrent");
    expect(helper).to.include("components.timeZone = TimeZone.autoupdatingCurrent");
  });
});
