# 한국 출시 준비 점검

기준일 **2026-10-24 (Asia/Seoul)**. 소스 `bb90ce4696f5e80324d479fa89e9708f43bbca3a` / `v158.0`의 감사다. 이후 후보 결과는 [검증 기록](verification.md)에 추가한다.

**한국 Google Play 일반 공개: NO-GO.** 기존 서명 APK가 있지만 패키지 정체성·외부 데이터 흐름·실제 운영자 정책·자산 권리·기록 보존·기기 사용성 검증이 남아 있다. 이는 운영자/스토어 승인이나 법률 적합성 확정이 아닌 출시 관리 판정이다.

## 조사 범위

`codebase-memory` Verify를 적용했으나 이 세션에는 그래프/범위 확인 도구가 없어 직접 소스 읽기·검색을 사용했다. 전체 그래프나 저장소 전체 보안 감사 완료를 주장하지 않는다. Android Gradle/Manifest, CI, 네이티브 timer/updater/push, `App.native.tsx`, `api/service.ts`, analytics/eventManager/rollbar/ota/hostConfig/imageCache/iap/signIn/posthog, 계정/설정/구독 UI, 영문 정책 3개, LICENSE, 이미지 추출기와 관련 테스트를 조사했다. 실제 Play Console·운영 계정·휴대전화는 미조사다.

## Gate 판정

| Gate | 결과 | 근거 / 조치 |
| --- | --- | --- |
| G01 기준 APK | PASS | v158.0 공개 릴리스와 작업39905823165 성공 확인. 새 후보에는 새 근거 필요 |
| G02 대상 API | PASS (정적) | min26, compile/target36. 후보 병합 매니페스트·스토어 사전보고서는 별도 |
| G03 앱 정체성 | FAIL | 원본 app ID `com.liftosaur.www.twa` 및 공식 도메인/OAuth 유지. 독립 Play 패키지 미확정 |
| G04 기본 전송 | FAIL | 원본 API, AppsFlyer, 네이티브 Rollbar, 이벤트 큐 전송 경로 활성. 기본 KR 후보에서 차단 필요 |
| G05 OTA | PASS (v158 CI 한정) | `DISABLE_OTA=true`로 배포. 코드 기본값은 별도 보강 필요 |
| G06 계정/결제 | FAIL | 원본 OAuth·상품·구매 검증 경로. 독립 운영 서비스 없는 후보에서 사용 중지 |
| G07 한국 운영 정책 | FAIL | 원본 사이트·영문 미국 서비스·info@liftosaur.com 기준. 포크 운영 사실과 일치하지 않음 |
| G08 건강정보/권한 | NOT RUN | 체중/체지방/수면/영양/운동 권한 선언. 기능별 동의·취소·보호·삭제·Play 선언 검증 필요 |
| G09 업데이트/복원 | NOT RUN | v158 실제 기록을 채운 뒤 후보 업데이트·백업 복원 비교 미수행 |
| G10 알림 전달 | NOT RUN | 예약·재부팅·시간대 복원 코드/단위 테스트 존재. 기기 권한·절전·전달은 별도 |
| G11 한글 사용성 | NOT RUN | v158 수정 존재. 작은 화면·큰 글자·키보드·읽기 지원의 기기/사람 평가 필요 |
| G12 AI 파일 왕복 | NOT RUN (후보) | 관련 모델·렌더 검사 존재. 30세션·실패 원자성·재시작·출력 재검증 필요 |
| G13 소스 라이선스 | PARTIAL | 앱 AGPL 코드 라이선스와 제삼자 패키지 고지를 설정에서 별도 링크. 링크는 인터넷 필요하며, 패키지 inventory가 캐시된 목록이므로 최종 native bundle 기준 완전성 검증은 NOT RUN |
| G14 미디어 권리 | NOT RUN | GymVisual 추출기·원격 이미지 사용. 파일별 재배포 허가 증거 미확인 |
| G15 Play 요건/승인 | NOT RUN | 신원/콘텐츠/비공개 테스트/스토어 심사 실제 결과 없음 |

## 우선 수정 경로

기준 `App.native.tsx`는 배포 시 원본 사이트/API를 설정하고 Rollbar 클라이언트를 모듈 초기화 중 생성한다. AppsFlyer에는 임시/로그인 사용자 ID를 전달한다. `eventManager.native.ts`는 `/api/batchevents`로 큐를 보낸다. 정적 실행 경로 확인이며 패킷 수집 결과는 아니다.

공용 `RollbarUtils_config`에는 마지막 상태·행동·검증 오류를 압축해 `/api/exception`으로 보내는 변환 함수가 있다. 네이티브 shim은 configure에서 person만 반영하므로 모든 네이티브 오류가 이 공용 변환을 실행한다고 단정하지 않는다. 네이티브 Rollbar 초기화와 공용 진단 업로드를 각각 차단해야 한다.

서비스 경계에서 인증·동기화·구매 검증·원격 업로드를 차단하고 OAuth/IAP/AppsFlyer/FCM/OTA는 SDK 시작도 별도 차단한다. 화면 숨기기만으로 완료하지 않는다. 기존 로그인·구매 상태·로컬 기록은 자동 삭제/로그아웃하지 않는다.

운동 이미지는 원본 사이트 URL과 네이티브 캐시를 쓴다. 캐시는 최초 오프라인 제공과 다르다. 자동 수집·재배포 권리는 소스 AGPL만으로 확인되지 않는다. 원격 이미지 허용 시 ‘모든 네트워크 차단’이나 ‘수집 없음’이라고 단정하지 않는다.

## 정체성·데이터 보존·롤백

v159 후보는 기존 KR 사용자의 같은 서명 업데이트와 기록 보존을 위해 현재 app ID를 유지한다. 공식 앱과 서명이 다르므로 공식 앱 덮어쓰기·무손실 이전을 보장하지 않는다. 삭제보다 전체 백업을 우선한다.

Play 패키지는 고유하고 영구적이다. [공식 앱 생성 안내](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en). 원본 패키지를 새 포크 앱에 등록 가능하다고 가정하지 않는다. 별도 Play 패키지 확정 후 구 앱 전체 내보내기 → 새 앱 가져오기 → 프로그램/기록/측정/설정 비교를 검증하고 구 앱은 유지한 채 확인한다.

구 APK 재설치는 버전코드/역호환 문제로 실패할 수 있다. 롤백은 태그 이동 대신 기존 데이터를 읽는 높은 버전 수정 배포 또는 검증된 전체 백업 복원으로 준비한다. 검증 없이 ‘안전한 롤백’을 선언하지 않는다.

## 공식 자료 확인 (2026-10-24)

| 자료 | 준비 항목 |
| --- | --- |
| [대상 API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) | 2026-08-31부터 일반 Android 신규/업데이트 대상 API36. 현재 구성36 |
| [사용자 데이터](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) | SDK 포함 실제 수집/이용/공유·민감정보·공개 정책·Data safety 일치 |
| [건강정보 권한](https://support.google.com/googleplay/android-developer/answer/12991134?hl=en) | 필요한 범위만 요청, 명확한 동의, 저장/공유/보존/삭제·보호조치 |
| [건강 앱 선언](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en) | 실제 기능에 맞는 콘솔 선언. 빌드로 신고가 완료되지 않음 |
| [계정 삭제](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) | 계정 생성 제공 시 앱 및 웹 삭제 요청 경로. 로컬 후보 신규 계정 차단 검증 |
| [한국 개발자 정보](https://support.google.com/googleplay/android-developer/answer/6223646?hl=ko) | 실제 계정별 검증 연락처, 유료/IAP 시 사업자·전자상거래 정보 확인 |
| [신규 개인 계정 테스트](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) | 해당 계정이면 12명 14일 연속 참여 후 공개 접근 신청. 자동 테스트로 대체 불가 |
| [개인정보위 작성지침2026.4](https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010000000&nttId=12018) | 실제 한국 운영자의 항목/목적/보유/제공·위탁·국외이전/권리/책임자 사실을 작성·검토 |

운영자 실명/법인·문의 수단·개인정보 담당자·수익화·대상 연령·실제 서버/SDK/보존정책·자산 허가·패키지 소유권은 미확인이다. 임의 값을 정식 정책이나 스토어 정보에 넣지 않는다. 필요한 정보 없이 가능한 로컬 기능·품질 개선은 계속한다.
