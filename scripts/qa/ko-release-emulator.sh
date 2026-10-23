#!/usr/bin/env bash
set -euo pipefail

PACKAGE="com.liftosaur.www.twa"
ACTIVITY="$PACKAGE/.MainActivity"
BASELINE_APK="${BASELINE_APK:-qa-artifacts/Liftosaur-KR-158.0.apk}"
CANDIDATE_APK="${CANDIDATE_APK:-Liftosaur-KR-159.0.apk}"
OUT="${QA_ARTIFACTS_DIR:-qa-artifacts/native-upgrade}"
FIXTURES="${FIXTURE_DIR:-qa-artifacts/legacy-fixtures}"
ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
mkdir -p "$OUT"
restore_emulator_settings() {
  adb shell wm size reset >/dev/null 2>&1 || true
  adb shell settings put system font_scale 1.0 >/dev/null 2>&1 || true
  adb shell settings put global airplane_mode_on 0 >/dev/null 2>&1 || true
  adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false >/dev/null 2>&1 || true
}
on_exit() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    adb logcat -d > "$OUT/logcat-failure.txt" 2>/dev/null || true
    adb shell uiautomator dump /sdcard/ko-release-failure.xml >/dev/null 2>&1 || true
    adb shell cat /sdcard/ko-release-failure.xml > "$OUT/failure-ui.xml" 2>/dev/null || true
    adb shell screencap -p /sdcard/ko-release-failure.png >/dev/null 2>&1 || true
    adb pull /sdcard/ko-release-failure.png "$OUT/failure-screen.png" >/dev/null 2>&1 || true
  fi
  restore_emulator_settings
  exit "$status"
}
trap on_exit EXIT

test -s "$BASELINE_APK"
test -s "$CANDIDATE_APK"
test -s "$FIXTURES/current_account.json"
test -s "$FIXTURES/liftosaur_qa-primary.json"
test -s "$FIXTURES/liftosaur_qa-secondary.json"
cp "$FIXTURES/fixture-manifest.json" "$OUT/fixture-manifest.json"
adb wait-for-device
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard || true
adb logcat -c

wait_for_app() {
  local attempt pid_before pid_after foreground
  for attempt in $(seq 1 30); do
    pid_before="$(adb shell pidof -s "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
    if [ -n "$pid_before" ]; then
      sleep 5
      pid_after="$(adb shell pidof -s "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
      foreground="$(adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' || true)"
      printf '%s\n' "$foreground" | grep -F "$PACKAGE/" >/dev/null || break
      [ -n "$pid_after" ] && [ "$pid_after" = "$pid_before" ] && return 0
      break
    fi
    sleep 1
  done
  adb logcat -d > "$OUT/logcat-failure.txt"
  return 1
}

capture_start() {
  local label="$1"
  adb shell am force-stop "$PACKAGE"
  adb shell am start -W -n "$ACTIVITY" > "$OUT/${label}-start.txt"
  wait_for_app
  adb shell screencap -p "/sdcard/${label}.png"
  adb pull "/sdcard/${label}.png" "$OUT/${label}.png" >/dev/null
  adb shell uiautomator dump "/sdcard/${label}.xml" >/dev/null
  adb pull "/sdcard/${label}.xml" "$OUT/${label}.xml" >/dev/null
}

capture_current() {
  local label="$1"
  adb shell screencap -p "/sdcard/${label}.png"
  adb pull "/sdcard/${label}.png" "$OUT/${label}.png" >/dev/null
  adb shell uiautomator dump "/sdcard/${label}.xml" >/dev/null
  adb pull "/sdcard/${label}.xml" "$OUT/${label}.xml" >/dev/null
}

if [ -z "$ANDROID_HOME" ]; then
  echo "ANDROID_HOME/ANDROID_SDK_ROOT is required for apksigner evidence" >&2
  exit 1
fi
APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
"$APKSIGNER" verify --print-certs "$BASELINE_APK" > "$OUT/v158-signature.txt"
"$APKSIGNER" verify --print-certs "$CANDIDATE_APK" > "$OUT/candidate-signature.txt"
baseline_cert="$(sed -nE 's/.*certificate SHA-256 digest: ([[:xdigit:]]+).*/\1/p' "$OUT/v158-signature.txt" | head -n 1)"
candidate_cert="$(sed -nE 's/.*certificate SHA-256 digest: ([[:xdigit:]]+).*/\1/p' "$OUT/candidate-signature.txt" | head -n 1)"
test -n "$baseline_cert" && test "$baseline_cert" = "$candidate_cert"
printf 'v158 SHA-256: %s\ncandidate SHA-256: %s\n' "$baseline_cert" "$candidate_cert" > "$OUT/signature-comparison.txt"

# Seed the documented synthetic legacy-file migration path before the v158 first
# launch. Never substitute an empty profile: missing root access or fixture files
# fails this workflow run.
adb root > "$OUT/adb-root.txt"
adb wait-for-device
adb install "$BASELINE_APK"
adb shell am force-stop "$PACKAGE"
adb shell mkdir -p "/data/user/0/$PACKAGE/files/LiftosaurStorage"
adb shell rm -f "/data/user/0/$PACKAGE/files/LiftosaurStorage/current_account.json" "/data/user/0/$PACKAGE/files/LiftosaurStorage/liftosaur_qa-primary.json" "/data/user/0/$PACKAGE/files/LiftosaurStorage/liftosaur_qa-secondary.json"
adb push "$FIXTURES/current_account.json" "/data/user/0/$PACKAGE/files/LiftosaurStorage/current_account.json" >/dev/null
adb push "$FIXTURES/liftosaur_qa-primary.json" "/data/user/0/$PACKAGE/files/LiftosaurStorage/liftosaur_qa-primary.json" >/dev/null
adb push "$FIXTURES/liftosaur_qa-secondary.json" "/data/user/0/$PACKAGE/files/LiftosaurStorage/liftosaur_qa-secondary.json" >/dev/null
app_owner="$(adb shell stat -c '%u:%g' "/data/user/0/$PACKAGE" | tr -d '\r')"
test -n "$app_owner"
adb shell chown -R "$app_owner" "/data/user/0/$PACKAGE/files/LiftosaurStorage"
adb shell settings put global airplane_mode_on 1
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true >/dev/null
adb shell settings get global airplane_mode_on | grep -Fx 1 > "$OUT/airplane-mode.txt"
adb shell svc wifi disable
adb shell svc data disable
adb shell settings get global wifi_on > "$OUT/wifi-setting.txt"
adb shell settings get global mobile_data > "$OUT/mobile-data-setting.txt"
adb shell dumpsys wifi > "$OUT/wifi-state.txt"
adb shell dumpsys connectivity > "$OUT/connectivity-state.txt"
adb shell dumpsys telephony.registry > "$OUT/telephony-state.txt"
capture_start "v158-before-upgrade"
adb shell dumpsys package "$PACKAGE" | grep -E 'userId=|codePath=|dataDir=|versionCode=|versionName=' > "$OUT/v158-package.txt"
adb shell ls -l "/data/user/0/$PACKAGE/files/mmkv" > "$OUT/v158-mmkv-list.txt"
adb shell test -s "/data/user/0/$PACKAGE/files/LiftosaurStorage/current_account.json"
adb shell test -s "/data/user/0/$PACKAGE/files/LiftosaurStorage/liftosaur_qa-primary.json"
adb shell test -s "/data/user/0/$PACKAGE/files/LiftosaurStorage/liftosaur_qa-secondary.json"
python3 scripts/qa/ko-release-ui.py assert-text '한국어 기록 보존 검증 주계정'
python3 scripts/qa/ko-release-ui.py assert-measurement 68.4kg v158-primary
python3 scripts/qa/ko-release-ui.py assert-completed-history v158-primary
python3 scripts/qa/ko-release-ui.py switch-account qa-secondary '한국어 기록 보존 검증 보조계정'
python3 scripts/qa/ko-release-ui.py assert-measurement 74.2kg v158-secondary
python3 scripts/qa/ko-release-ui.py assert-completed-history v158-secondary
python3 scripts/qa/ko-release-ui.py switch-account qa-primary '한국어 기록 보존 검증 주계정'
python3 scripts/qa/ko-release-ui.py open-fixture-workout
adb shell cat "/data/user/0/$PACKAGE/files/mmkv/mmkv.default" > "$OUT/v158-mmkv-default.bin"
sha256sum "$OUT/v158-mmkv-default.bin" > "$OUT/v158-mmkv-sha256.txt"

# This is an in-place package update. Never uninstall the existing KR app to
# make a signature mismatch appear to pass; adb install -r must succeed.
adb install -r "$CANDIDATE_APK"
adb shell dumpsys package "$PACKAGE" | grep -E 'userId=|codePath=|dataDir=|versionCode=|versionName=' > "$OUT/v159-package.txt"
capture_start "v159-default"
python3 scripts/qa/ko-release-ui.py assert-text '한국어 기록 보존 검증 주계정'
python3 scripts/qa/ko-release-ui.py assert-measurement 68.4kg v159-primary
python3 scripts/qa/ko-release-ui.py assert-completed-history v159-primary
python3 scripts/qa/ko-release-ui.py switch-account qa-secondary '한국어 기록 보존 검증 보조계정'
python3 scripts/qa/ko-release-ui.py assert-measurement 74.2kg v159-secondary
python3 scripts/qa/ko-release-ui.py assert-completed-history v159-secondary
python3 scripts/qa/ko-release-ui.py switch-account qa-primary '한국어 기록 보존 검증 주계정'
python3 scripts/qa/ko-release-ui.py open-fixture-workout
adb shell cat "/data/user/0/$PACKAGE/files/mmkv/mmkv.default" > "$OUT/v159-mmkv-default.bin"
sha256sum "$OUT/v159-mmkv-default.bin" > "$OUT/v159-mmkv-sha256.txt"

adb shell settings put system font_scale 1.3
python3 scripts/qa/ko-release-ui.py assert-text '한국어 기록 보존 검증'
capture_current "v159-workout-font-scale-1_3"
adb shell settings put system font_scale 1.0

size_line="$(adb shell wm size | tr -d '\r' | grep -m 1 'Physical size:')"
density_line="$(adb shell wm density | tr -d '\r' | grep -m 1 'Physical density:')"
original_size="${size_line##*: }"
original_width="${original_size%x*}"
original_height="${original_size#*x}"
density="${density_line##*: }"
target_width="$(python3 -c 'import sys; print(round(320 * int(sys.argv[1]) / 160))' "$density")"
target_height="$(python3 -c 'import sys; print(round(int(sys.argv[1]) * int(sys.argv[2]) / int(sys.argv[3])))' "$original_height" "$target_width" "$original_width")"
adb shell wm size "${target_width}x${target_height}"
python3 scripts/qa/ko-release-ui.py assert-text '한국어 기록 보존 검증'
capture_current "v159-workout-width-320dp"
adb shell wm size reset
adb shell settings put system font_scale 1.0
adb shell am force-stop "$PACKAGE"

adb logcat -d > "$OUT/logcat.txt"
cat > "$OUT/RESULTS.txt" <<'EOF'
PASS: generated synthetic two-account legacy fixture was injected before the v158 first launch; its manifest is included with this artifact. This is fixture injection, not UI-created user data.
PASS: v158.0 process stability, primary/secondary fixture program, measurement, completed set history (2 × 8 × 20 kg), account switching, and opening the seeded in-progress workout were asserted through UI hierarchy.
PASS: v159.0 installed with adb install -r under the same package; signer SHA-256 matched v158.0; process stability, both account program/measurement markers and completed set history (2 × 8 × 20 kg), account switching, and seeded workout screen were asserted.
CAPTURED: screenshots and UI hierarchy dumps for v158 baseline, v159 default, and the open workout screen at font scale 1.3 and 320dp width. Captures are diagnostic evidence, not a human usability PASS.
CAPTURED: v158/v159 MMKV default-file snapshots and hashes. Hashes establish artifact identity only; this script does not claim full semantic equality of all records. Primary/secondary weight values are separately asserted through the settings UI.
PASS: airplane mode was enabled, Wi-Fi and mobile data were explicitly disabled, and settings/state dumps were captured for fixture migration and post-upgrade UI checks.
NOT RUN: real user data comparison, export/import restoration, human usability/accessibility review, and physical-device behavior.
EOF
