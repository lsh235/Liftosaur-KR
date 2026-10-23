# Liftosaur-KR

Liftosaur-KR은 [Liftosaur](https://github.com/astashov/liftosaur)를 바탕으로 만든 한국어 운동 기록 앱입니다. **한국어로 운동을 기록하고, 외부 AI가 만든 루틴을 파일로 가져온 뒤 실제 수행 기록을 Markdown으로 돌려주는 오프라인 우선 운동 데이터 도구**를 목표로 합니다. 앱 내부에서 외부 AI API를 직접 호출하지 않습니다.

현재 기술 스택은 Flutter가 아닌 **React Native + TypeScript** Android/iOS 앱과 Preact 웹 앱입니다. 기존 Liftoscript 엔진과 로컬 저장 구조를 사용합니다. 원본과 별도로 관리하는 포크이며, 원본 서비스 운영권이나 개별 이미지·상표의 사용 권리가 확보되었다는 뜻은 아닙니다.

## 배포 상태와 설치

[APK 릴리스](https://github.com/lsh235/Liftosaur-KR/releases) · [문제 제보](https://github.com/lsh235/Liftosaur-KR/issues)

`v158.0`은 한글 글꼴·번역 개선 APK입니다. 한국 Google Play 정식 출시는 준비 중입니다. 서명 APK 빌드와 스토어 출시 적합성은 별도입니다. [출시 점검](docs/release/ko-KR/release-readiness.md), [진행 계획](docs/release/ko-KR/release-plan.md), [검증 기록](docs/release/ko-KR/verification.md)을 확인하세요.

1. 릴리스의 `.apk`와 `.sha256` 파일을 내려받습니다. SHA-256으로 게시 파일과 다운로드 파일이 같은지 확인할 수 있습니다.
2. Android에서 APK를 열어 설치합니다. 필요하면 사용 중인 브라우저·파일 앱의 ‘알 수 없는 앱 설치’를 허용합니다.
3. 기존 **Liftosaur-KR**은 같은 서명의 더 높은 버전으로 업데이트합니다. 중요 기록은 먼저 설정의 전체 데이터 내보내기로 백업하세요.

현재 앱 ID는 원본과 같은 `com.liftosaur.www.twa`입니다. 공식 앱과 서명이 다르면 공존·업데이트가 불가능합니다. **설치 실패를 해결하려고 기존 앱부터 삭제하지 마세요.** 삭제 전 전체 데이터 백업과 복원을 확인해야 합니다. 별도 Play 패키지를 도입하면 파일을 통한 데이터 이전이 필요합니다.

## AI 파일 흐름과 운동 일정

설정의 **가져오기 / 내보내기 → AI에게 새 루틴 요청하는 프롬프트 복사**로 규격을 복사합니다. ChatGPT, Claude 등에서 만든 JSON/CSV를 앱에서 가져옵니다. **AI 피드백용 Markdown 내보내기**에는 수행 총평·통증 메모·다음 루틴 요청을 넣을 수 있습니다. 계획/실제 수행·날짜·볼륨·e1RM을 파일로 저장하거나 복사합니다.

JSON의 필수 최상위 키는 `program_name`, `duration_weeks`, `days_per_week`, `workouts`입니다. 각 운동의 `weekly_progression`에 전체 주차를 포함하고 세트 유형은 `WARMUP`, `TOP`, `BACKOFF`, `STRAIGHT`, `DROP`을 사용합니다. `target_weight: 0`은 운동 중 개인 목표 중량을 입력하는 용도로 사용할 수 있습니다. CSV는 한 줄에 한 세트를 기록합니다.

```csv
program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps
```

기본 PHAT 프리셋은 **6주 × 주 5일, 30세션·29개 운동 슬롯**의 상·하체 파워와 당기기·밀기·하체 근비대 루틴입니다. 주차별 예시 중량과 횟수는 본인 능력에 맞춰 조정합니다. 개인 처방 중량은 아닙니다. 시작일·운동 요일을 정하면 휴식일을 건너뛰고, 일정 미루기는 현재와 이후 미완료 세션을 다음 운동 가능일로 옮깁니다.

운동 알림은 네이티브 앱의 알림 권한·정확한 알람·절전 설정에 영향을 받습니다. 예약 상한은 60개입니다. 최초부터 모든 이미지가 오프라인 제공된다는 뜻은 아니며 원격 이미지·캐시는 별도 검증합니다.

## 개발과 검증

Node.js 22와 npm을 사용합니다.

```sh
npm ci
npm run ensure:localdomain
npm run check
```

웹은 `npm start`로 실행합니다. `localdomain.js`와 `webpack.config.js`의 HTTPS 개발 도메인·인증서가 필요합니다. 기본 주소는 `local.liftosaur.com:8080`입니다. 개발 화면 실행과 백엔드 운영은 별도입니다.

Android는 Java 17, SDK/Build Tools 36, NDK 27.1.12297006, CMake 3.22.1을 사용합니다. 개발 실행은 `npm run android`, 서명 배포는 GitHub Actions `Android APK Release`를 사용합니다. 키·비밀번호를 커밋하지 마세요. 로컬 Gradle의 debug 서명 대체 결과를 배포본으로 사용하지 마세요.

```sh
npm run check
npm run onetest -- test/aiWorkoutProgram.test.ts test/aiFeedbackExport.test.ts test/programSchedule.test.ts test/workoutReminderScheduler.test.ts
npm run test:render -- --runInBand
```

전체 단위 검사는 `npm test`, 웹 흐름 검사는 `npm run playwright`입니다. Playwright에는 설정된 HTTPS 서버와 브라우저가 필요합니다. `npm run build`는 원본 진단 서비스에 소스맵을 업로드하는 단계가 있으므로 업로드 의도 없이 실행하지 마세요. 로컬 웹 생성은 `npm run build:prepare`를 사용하고 생성물 변경을 별도 검토합니다.

## 다음 개발자·AI 에이전트에게

목적과 [출시 계획](docs/release/ko-KR/release-plan.md)을 먼저 확인하세요. 사용자 기록 보존, 한국어 가독성, AI 파일 왕복이 우선입니다. 원본 계정·서버·결제·진단은 독립 한국 운영 권한의 근거가 아니며, 로컬 전용 후보에서 연결을 차단하는 작업을 진행합니다. 건강정보 연동과 원격 미디어는 개별 데이터 흐름으로 검증합니다.

구조 탐색은 저장소 지침의 `codebase-memory` 스킬을 적용합니다. 그래프 도구가 없으면 관련 소스 읽기·검색으로 확인하고 전체 범위를 조사했다고 주장하지 마세요. 병렬 작업은 파일 소유권을 정하고 타인의 변경·사용자 파일을 보존합니다.

변경 결과에는 파일, 작업트리/SHA, 실행 범위·결과, 남은 문제를 남깁니다. 로컬 검사·모의 화면·Android 빌드/설치·사람의 화면 평가·스토어 승인을 `PASS/FAIL/NOT RUN`으로 구분합니다. Gate 실패는 원인 수정 후 최대 두 번 재검증하고 미해결이면 증거와 함께 보류합니다. 빌드 성공만으로 출시 완료를 선언하지 마세요.

검토된 파일 목록만 커밋하고 버전·태그·APK·소스를 맞춥니다. 통과 태그를 이동하지 않습니다. `v*` 태그 푸시는 APK 공개를 실행하므로 통합 판정 전에 생성하지 마세요. 스토어 공개와 운영자 명의 정책·결제 개시는 실제 운영자 판단이 필요합니다.

## 원본과 라이선스

원본 저작자·기여자의 고지를 유지합니다. 코드 라이선스는 [GNU AGPL v3](LICENSE)이며 배포 파일에 대응하는 소스·변경 이력·빌드 방법을 함께 관리합니다. [원본 소스](https://github.com/astashov/liftosaur), [Liftoscript 문서](https://www.liftosaur.com/doc)를 참고하세요.

코드 라이선스는 개별 운동 이미지·영상·상표의 권리 증명을 대신하지 않습니다. 외부 이미지 자동 수집·재배포·APK 내장은 파일별 출처·허가 확인 후 결정합니다. 제삼자 패키지 고지는 라이선스 생성 절차와 앱 라이선스 화면에서 관리합니다.
