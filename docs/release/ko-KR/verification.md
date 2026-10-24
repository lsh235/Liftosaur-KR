# 검증 기록

2026-10-24 (Asia/Seoul). 결과는 실행 시점의 SHA/작업트리에 한정된다. PASS는 해당 범위 확인, FAIL은 관찰된 불일치, NOT RUN은 실행 근거 부재다.

## 기준 확인

| 항목 | 결과 | 근거 / 범위 |
| --- | --- | --- |
| 소스 | PASS | master bb90ce4696f5e80324d479fa89e9708f43bbca3a. 감사 시작 시 추적 파일 깨끗함, 사용자 .playwright-cli/ 보존 |
| APK 릴리스 | PASS | [v158.0](https://github.com/lsh235/Liftosaur-KR/releases/tag/v158.0), 공개시각2026-10-23T06:00:39Z 확인 |
| 기존 Android CI | PASS (기존 원격) | [39905823165](https://github.com/lsh235/Liftosaur-KR/actions/runs/39905823165), 위 SHA completed/success. 후보 재검사 아님 |
| 빌드 절차 | PASS (정적) | Java17/Node22/SDK36/서명, Android 단위+assembleRelease, 서명/버전 검사, API36 설치/시작/PID |
| 로컬 네이티브 | NOT RUN | adb·emulator 명령 없음, 기본 Java11. 실기기/로컬 Android 빌드 미수행 |
| 공식 자료 | PASS (자료만) | 2026-10-24 Google Play·개인정보위 문서 확인. 실제 적합성 승인 아님 |
| 전체 보안/권리 | NOT RUN | 제한된 소스 감사. 패킷·파일별 자산 허가·운영 계정 미검증 |

## 실행 가능한 검사

`npm run check`는 타입 검사다. `npm run onetest -- <관련 test>`와 `npm test`는 모델 단위다. `npm run test:render -- --runInBand`는 React Native 모의 화면 계약이며 실제 폰의 글꼴/키보드/픽셀 증거가 아니다. `npm run playwright`는 HTTPS 개발 서버의 웹 흐름으로 네이티브 권한·Health Connect·알림 전달 증거가 아니다.

Android 단위 검사에는 NotificationPermissionTest·TimerAlarmReschedulerTest·WorkoutReminderTimeTest가 있다. CI는 실제 Android 빌드/서명/설치/시작을 확인하나 지금 v* 태그가 공개 릴리스를 실행하므로 검사 목적으로 태그를 만들지 않는다.

## 후보 기록 규칙

담당자는 변경 파일·작업트리/SHA·검사 범위·결과/증거·남은 문제를 반환한다. 상위 에이전트는 실제 파일과 실행 기록을 대조해 Gate와 전체 GO/NO-GO를 판단한다. 실행 안 된 항목을 이전 성공·코드 존재·모의 결과로 대신하지 않는다. v159 결과는 아래 추가하며 운영/권리/스토어 미확인은 NO-GO로 유지한다.

## v159 작업 트리 검사 (2026-10-24)

| 검사 | 결과 | 범위 / 제한 |
| --- | --- | --- |
| 타입 검사 | PASS | `npm run check`, 변경 후 재실행 성공 |
| 전체 모델/단위 | PASS | `npm test`: 2,842 passing, exit 0. 기존 `MODULE_TYPELESS_PACKAGE_JSON` 및 Buffer deprecation 경고와 예상된 실패 경로 로그 포함. 최종 UI 변경은 레이아웃 전용이며 전체 모델 검사는 그 변경 직전 실행 |
| 전체 렌더 계약 | PASS | `npm run test:render -- --runInBand`: 20 suites passed, 1 skipped; 94 passed, 16 skipped. Jest가 종료 뒤 열린 핸들 경고를 출력했으나 프로세스 종료 코드는 0 |
| 로컬 프로필 핵심 회귀 | PASS | 9 tests: 원격 클라이언트 차단, 손상 저장값 거부, 계정 유지/저장 실패, 진단 로그·성능 전송 미실행. 실제 복구 화면의 버튼·색상·내보내기 동작은 검증하지 않음 |
| 배포 전처리/웹 번들 | PASS | `npm run build:prepare`; webpack 성공. stale Browserslist 데이터, Eleventy `emitter-mixin` `main` 경고, webpack `Compilation.assets` 폐기 예정 경고 및 자산/entrypoint 크기 경고 2건. 일반 `npm run build`의 소스맵 업로드 단계는 실행하지 않음 |
| 생성된 웹 번들 실행 | PASS (정적 production dist) | 최초 smoke harness가 UTF-8 charset 없이 `text/javascript`를 제공해 Chromium이 `/app.js?version=bb90ce46` line 2, column 1,840,973에서 `SyntaxError: Invalid or unexpected token`을 냈음. HTML entry `/app/`와 JS 응답 모두 charset 미표시였고 HTML에도 charset meta가 없었음. 최초 JS 응답은 2,659,436 bytes/SHA-256 `2cbcb7e…a723bcf`. 같은 dist 바이트에 JS 응답만 `charset=utf-8`을 명시하고 HTML 응답은 계속 charset 없이 둔 비교에서 예외 없이 마운트돼, production bundle 결함이 아닌 최초 정적 harness의 인코딩 헤더 문제로 분류. 재현 helper는 dist를 변경하지 않고 모든 text response에 UTF-8 MIME을 제공하며 `/app/`, `vendors.js`, `app.js` 모두 200, `#app` child 1개/13,152 HTML bytes, CDP 예외 0건 확인. 외부 API·스크립트 요청은 차단하고 로그 endpoint만 204 mock했으므로 API/로그인 기능은 검증하지 않음. [실행 결과](evidence/production-web-runtime-smoke.json), [실패/원인 분리 근거](evidence/production-web-runtime-triage.json), helper: `scripts/qa/ko-release-web-runtime-smoke.mjs` |
| 패키지 고지 생성 | PARTIAL | RN 번들 지도 부재로 캐시된 네이티브 패키지 목록 재사용; 캐시에 있던 미설치 패키지 2개 제외 경고. 새 RN 번들 기준 고지 검증은 NOT RUN |
| Android APK/기기 흐름 | NOT RUN | 로컬 Java 11 및 Android SDK/adb 없음. 새 v159 서명 APK·실기기 흐름 증거 아님 |
| v158→v159 CI 흐름 | C1 FAIL (emulator boot; app UI NOT RUN) | [C1 run 40004012987](https://github.com/lsh235/Liftosaur-KR/actions/runs/40004012987)의 Android 단위 검사/APK build, metadata check, baseline download, fixture generation 단계는 성공했지만 emulator step이 실패했다. Job log의 KVM probe는 runner 권한 부족을 기록하고, emulator startup 중 반복된 `adb shell getprop sys.boot_completed`는 `device offline`을 반환한 뒤 `Timeout waiting for emulator to boot`로 끝났다. 따라서 `ko-release-emulator.sh`의 fixture migration, v158→v159 install/update, signer comparison 및 모든 앱 UI assertion은 실행되지 않았다. C2 workflow commit `1b6fb19c`와 현재 미커밋 QA 변경은 이 C1 run에 포함되지 않음; 사용자 생성 데이터의 완전한 의미 비교도 NOT RUN |
| 배포 라이선스 고지 | PARTIAL | 설정에 앱 AGPL 코드 라이선스와 제삼자 패키지 고지를 별도 원격 링크로 노출. 링크는 인터넷 필요. 생성기 입력은 현재 캐시된 네이티브 패키지 목록이므로 최종 번들 기반 inventory 완전성 검증은 NOT RUN; 스토어 Gate에서 재생성·검토 필요 |
| 브라우저 시각 QA | PASS (제한 범위) | Chromium에서 합성 프로그램 화면 320/360/430px 및 320px·글자 1.3 배율 캡처·검토. 해당 프로그램 미리보기 레이아웃의 가독성만 확인; 일반 앱 마운트 smoke 실패와 Android 네이티브·Play 적합성은 별도 NOT RUN |

전체 `npm run check`와 렌더 계약 검사는 최종 UI 레이아웃 변경 뒤 재실행했다. 전체 모델 검사는 그 표현 전용 변경 직전에 통과했으며 변경 후 UI focused 5건도 통과했다. 이 결과는 커밋 전 공유 작업 트리에 한정된다. APK 서명·패키지/버전 및 실제 저장 기록 보존은 CI/기기 실행 뒤 별도 판정한다. 최초 웹 smoke 실패는 제품 bundle 결함이 아니라 UTF-8 charset을 표시하지 않은 정적 테스트 harness에서 발생했다. UTF-8을 명시한 harness로 동일 `dist`의 실행·마운트를 확인했으며 앱 API 동작이나 외부 서비스 연결의 증거는 아니다.

## 후속 UI 문구 후보 작업 트리 검사 (2026-10-24)

이 검사는 `HEAD c1f49f63984346805678bd2fb8c3691e8aa5a379` 위의 dirty worktree에서 후속 한국어 표시/accessibility 문구 수정까지 포함해 수행했다. 앱 데이터 모델·운동 값·버전은 변경하지 않았다. 이전 v159 표는 후속 UI 변경 전 시점이다.

| 검사 | 결과 | 범위 / 제한 |
| --- | --- | --- |
| 타입 검사 | PASS | 후속 Compact/Expanded 단측 라벨 테스트 타입 수정 뒤 `npm run check` 성공 |
| 후속 focused 검사 | PASS | Mocha 30 tests: ImportFromLink/Liftosaur/Hevy 사용자 오류 문구; render 12 tests: 세트 배지·한국어 프로그램 도움말; render 2 tests: Compact/Expanded 단측 표시 및 접근성 이름. 전체 테스트 집합에서도 포함 상태로 실행 |
| 전체 모델/단위 | PASS | `npm test`: 2,848 passing (1m), exit 0. `MODULE_TYPELESS_PACKAGE_JSON`, Buffer deprecation 경고 및 의도된 오류 경로 로그가 출력됨 |
| 전체 렌더 계약 | PASS | `npm run test:render -- --runInBand`: 21 suites passed, 1 skipped; 96 passed, 16 skipped. 열린 핸들 경고 뒤 exit 0 |
| safe production build | PASS | `npm run build:prepare`: webpack compile 성공, 자산 및 entrypoint 크기 경고 2건. stale Browserslist data, Eleventy invalid `main`, webpack Compilation.assets deprecation 경고. 일반 `npm run build`의 업로드 단계는 실행하지 않음 |
| 후속 production dist runtime | PASS (제한 범위) | 동일 후속 `dist`의 `/app/`, vendors, app 응답 200, UTF-8 MIME, `#app` child 1개/13,152 HTML bytes, CDP 예외 0. 해시와 blocked external host는 [별도 실행 결과](evidence/next-ui-production-web-runtime-smoke.json)에 보관. 이 결과는 정적 번들 mount 및 shell 초기화만 보이며 API/로그인 기능은 검증하지 않음 |
| PHAT 예시 JSON 가져오기 검사 | PASS (모델 변환) | `examples/phat-6week-kr.json`을 `AiWorkoutProgram_tryImport`로 검사: 성공, 6주 × 주 5일 = 30 session slots. native file picker/실기기 가져오기 흐름은 NOT RUN |
| Android native CI / APK 흐름 | C1 FAIL before app UI; C2/현재 QA NOT RUN | C1 `c1f49f6` run `40004012987`의 emulator step은 KVM 권한 경고, 반복된 ADB `device offline`, 최종 boot timeout으로 종료되어 앱 UI 스크립트를 시작하지 못했다 ([run logs](https://github.com/lsh235/Liftosaur-KR/actions/runs/40004012987)). C2 commit `1b6fb19c`와 현재 미커밋 QA 변경은 이 run에 포함되지 않으며 C1 결과를 승계하지 않음 |
| Android unit 결과 업로드 workflow | 변경됨 / NOT RUN | C2 commit `1b6fb19c`에서 `always()` JUnit XML/HTML report artifact 단계를 추가. 이 workflow 수정 자체는 아직 Actions 실행으로 검증하지 않음; C1 실행에 이 artifact가 없으면 실행 개수는 CI 자료에서 독립 확인 불가 |
| 실제 좁은 화면·큰 글자·네이티브 UI | NOT RUN | 후속 Compact/Expanded 변경 후 320dp/system large-text/실기기 시각 proof 없음. `ko-release-emulator.sh`는 설정 변경 뒤 workout 전용 `day-name` test ID와 fixture marker를 검사하고 필요 시 운동 탭으로 재진입한 뒤 1.3/2.0 및 320dp·1.0/2.0 조합을 캡처하도록 확장했지만 아직 실행되지 않았다. 캡처는 진단용이며 가독성·조작성 PASS가 아님. focused render는 모의 화면 계약에 한정 |
| 라이선스 package inventory | PARTIAL | 이번 `build:prepare`도 캐시된 native package list를 재사용했고 두 미설치 패키지를 제외함. 최종 Android shipped bundle 기준 완전성은 NOT RUN |

이번 build가 새로 변경한 추적 생성 파일 `scripts/licenses/shipped-packages.json`, `src/licenses.html`, `src/sitemap.xml`은 build 전 상태와 비교해 복원했다. 이 후속 검사 결과는 C1 native workflow evidence와 구분하며, 공개/스토어 준비 승인으로 해석하지 않는다.

## AI 가져오기 반복 경계 수정 후보 (HEAD 129f09db + 미커밋 importer 수정, 2026-10-24)

| 검사 | 결과 | 범위 / 제한 |
| --- | --- | --- |
| focused importer | PASS | `npm run onetest -- test/aiWorkoutProgram.test.ts`: 27 passing. 기존 PHAT·유효 JSON/CSV·0kg/0초 경로 포함. 큰 수 입력 회귀는 별도 child process에서 실행하며 제한시간은 10초. |
| 타입 검사 | PASS | `npm run check`, exit 0. |
| 전체 모델/단위 | PASS | `npm test`: 2,851 passing, exit 0. 기존 Node module-type/Buffer 경고 및 의도된 실패 경로 로그. |
| 전체 렌더 계약 | PASS | `npm run test:render -- --runInBand`: 22 suites passed; 98 passed, 16 skipped. 완료 후 Jest open-handle 경고, exit 0. |
| 재현 corpus | PASS (bounded sample) | 이전 임시 payload 파일이 없어 결정적 200건 corpus를 재구성해 12초 child timeout으로 검사: 1,399ms, 12 accepted/188 rejected, missing outcomes 0. PHAT seed·minimal JSON·CSV 정상 입력은 accepted. 이 corpus는 기존 200건 파일과 동일하다고 주장하지 않으며 fuzz나 native picker 검증이 아니다. 입력/결과/요약은 `/tmp/ko-ai-import-bounded-retest/{payloads.json,results.json,assessment.json}`. |
| safe production build | PASS | `npm run build:prepare`: webpack production compile 성공. stale Browserslist, Eleventy invalid `main`, webpack `Compilation.assets` deprecation 및 asset/entrypoint 크기 경고. 일반 업로드 포함 `npm run build`는 실행하지 않음. 라이선스 생성은 RN bundle map 부재로 cached package list 사용, 미설치 2개 제외 경고. |
| production dist runtime smoke | PASS (정적 마운트만) | `node scripts/qa/ko-release-web-runtime-smoke.mjs`: `/app/`, app/vendors/consent JS HTTP 200, UTF-8, `#app` child 1개/13,152 HTML bytes, CDP exceptions 0. 외부 요청 5건 차단; API/로그인/실기기 동작 검증 아님. |
| Android C4 APK/UI 흐름 | FAIL (partial) | [C4 run 40046971887](https://github.com/lsh235/Liftosaur-KR/actions/runs/40046971887)은 emulator boot 및 v158 baseline APK install/launch, initial fixture marker, 일부 screenshot/XML 수집까지 확인했으나 첫 `assert-measurement`에서 survey overlay가 Settings navigation을 가로막아 실패했다. Candidate v159 APK는 build/signature-check/upload됐지만 실패 전에 설치하지 않았으며 `adb install -r` candidate upgrade는 발생하지 않았다. 필수 증거와 native upgrade 검증은 미완료. 이는 QA fixture/helper 설정 문제이며 앱 데이터 손실 회귀의 증거가 아니다. C3 APK/UI는 Android build 중 취소되어 미완료였고 C1 emulator 실패는 새 후보 PASS로 승계하지 않는다. |
| generated tracked files | 복원 | 이번 build로 바뀐 `scripts/licenses/shipped-packages.json`, `src/licenses.html`, `src/sitemap.xml`은 build 전 clean 상태와 비교한 뒤 복원했다. `.playwright-cli/`는 그대로 보존했다. |
| Git/CI/public release | NOT RUN | 커밋/푸시, CI dispatch, 서명물, release tag 또는 public release 작업 없음. 다음 후보 커밋/dispatch는 coordinator 승인 대기. |

이 후보는 source-level invalid-number propagation 수정에 한정된다. 정해진 validation loops의 지연 문제를 처리했으며 parser 전체 fuzz, 네이티브 file picker, Android APK 및 실제 기기 흐름의 증거를 뜻하지 않는다.

## 환경 수정 및 백업 검사 후보 (HEAD 1b6fb19c + 미커밋 QA, 2026-10-24)

이 시점의 제품 코드는 C2 commit `1b6fb19c`와 동일하다. 이후 변경은 QA helper, workflow, focused test와 검증 문서에 한정되며 제품 구현은 바뀌지 않았다. 아래 결과는 이 공유 작업 트리 시점의 검사로, 이전 C1/C2 표의 수치와 번들 근거를 대체하지 않는다.

| 검사 | 결과 | 범위 / 제한 |
| --- | --- | --- |
| 백업 JSON serializer/import round trip | PASS (focused contract) | `koBackupRoundTrip.test.tsx`: 2 tests. 실제 `ImportExporter_exportStorage` 직렬화와 `Thunk_importStorage`/production reducer 복원 경로로 합성 PHAT 계정의 프로그램 전체 동등성 및 원본 소수 목표, 완료·진행 중 기록의 소수 중량/반복/메모, schedule `completedSessionDates`와 `shiftCount`를 확인. 손상 JSON, null/배열/문자열/숫자/불충분 object, 완료 반복수가 잘못된 전체 storage payload는 기존 storage 객체를 유지하고 Korean 실패 alert 경로를 탔다. 파일 저장/공유, file picker, 사용자 UI 및 실제 Android 복원은 mock/미검증 경계. parseable invalid 입력에서 `Storage_get`이 출력하는 migration 진단은 test에서 억제한다. |
| 전체 render suite | PASS | `npm run test:render -- --runInBand`: 22 suites passed, 1 skipped; 98 passed, 16 skipped; exit 0. Jest가 완료 후 열린 핸들 경고를 출력했다. |
| 최신 타입 검사 | PASS | 백업 회귀 보강 뒤 `npm run check` exit 0. |
| Android emulator / app UI 재실행 | NOT RUN | C1 run 40004012987은 emulator boot/KVM 단계에서 실패했고 app UI는 시작되지 않았다. 이번 QA/workflow 후보에 대한 재실행은 하지 않았다. C1 결과를 새 후보 PASS로 승계하지 않는다. |
| diff 검사 | PASS | 변경 시점의 `git diff --check` 통과. Git commit/push 및 CI 실행은 하지 않았다. |

## Android QA fixture onboarding/assertion follow-up (2026-10-24)

| 검사 | 결과 | 범위 / 제한 |
| --- | --- | --- |
| 합성 v158 fixture 생성 | PASS | `create-legacy-storage-fixtures.ts` 실행 결과 두 계정 모두 `hearAboutUs.done=true`, 완료 tour-help flag 15개(운동 8/프로그램 7), `completedSessionDates` 제거를 확인. 각 fixture는 생성기 안의 `Storage_get` 검증도 통과. output: `/tmp/ko-release-fixture.dBsrPt`. |
| Settings visibility gate | PASS (synthetic XML) | Python AST/compile 검사 및 합성 hierarchy 검사: `신체 정보`+`체중`이 있는 Settings 화면은 통과하고 hear-about-us hierarchy는 거부. 모달이 남아 있는 경우 visible-text 진단과 onboarding/modal 가능성을 포함한 오류를 내며, 예상 측정값 조회가 Settings 확인 뒤에만 실행됨을 mock 순서로 확인. |
| Android C4 fixture/UI rerun | FAIL (partial; before local helper fix) | C4 run 40046971887은 v158 baseline APK만 install/launch했고 initial fixture marker와 screenshot/XML은 수집했지만 survey overlay가 Settings 진입을 막아 첫 측정값 assertion에서 실패했다. Candidate v159는 build/signature-check/upload됐으나 install 전 실패하여 `adb install -r` upgrade는 발생하지 않았다. 이후 fixture generator와 Settings visibility gate는 로컬 생성/XML 검사만 통과했으며 Android에서 재실행하지 않았다. 다음 separately scoped fresh-source run은 C5이며, required native upgrade evidence remains NOT RUN. |
