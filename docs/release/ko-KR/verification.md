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
| v158→v159 CI 흐름 | 구현됨 / NOT RUN | 후보 workflow는 합성 2계정 legacy JSON을 첫 설치 v158에 주입하고 비행기 모드/Wi-Fi·데이터 off 상태에서 legacy→MMKV 읽기/계정 전환/진행 중 운동 화면을 확인한 뒤 signer SHA-256을 비교하고 v159를 `adb install -r`로 갱신하도록 변경. 각 계정의 체중과 완료 세트(2 × 8 × 20 kg)를 두 앱 버전 UI에서 확인하고, MMKV raw 스냅샷과 운동 화면 기본/글자 1.3/320dp 캡처를 아티팩트에 보관하도록 구성. 현재 CI 실행 전이며 사용자 생성 데이터의 완전한 의미 비교는 NOT RUN |
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
| Android native CI / APK 흐름 | NOT RUN (후속 worktree) | 현재 관찰 중인 CI run은 C1 `c1f49f6` 소스에 대한 것이며 후속 dirty UI/workflow 변경을 포함하지 않는다. C1 결과를 후속 후보에 승계하지 않음 |
| Android unit 결과 업로드 workflow | 변경됨 / NOT RUN | 후속 C2에서 `always()` JUnit XML/HTML report artifact 단계를 추가. 이 workflow 수정 자체는 아직 Actions 실행으로 검증하지 않음; C1 실행에 이 artifact가 없으면 실행 개수는 CI 자료에서 독립 확인 불가 |
| 실제 좁은 화면·큰 글자·네이티브 UI | NOT RUN | 후속 Compact/Expanded 변경 후 320px/system large-text/실기기 시각 proof 없음. focused render는 모의 화면 계약에 한정 |
| 라이선스 package inventory | PARTIAL | 이번 `build:prepare`도 캐시된 native package list를 재사용했고 두 미설치 패키지를 제외함. 최종 Android shipped bundle 기준 완전성은 NOT RUN |

이번 build가 새로 변경한 추적 생성 파일 `scripts/licenses/shipped-packages.json`, `src/licenses.html`, `src/sitemap.xml`은 build 전 상태와 비교해 복원했다. 이 후속 검사 결과는 C1 native workflow evidence와 구분하며, 공개/스토어 준비 승인으로 해석하지 않는다.
