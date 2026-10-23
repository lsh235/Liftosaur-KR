# 한국 출시 준비: 오프라인 운동 코어 점검

점검일: 2026-10-24 (Asia/Seoul). 기준: `bb90ce4696f5e80324d479fa89e9708f43bbca3a` / `v158.0` 이후 작업 트리.

이 문서는 운동 데이터, 가져오기, 일정 및 AI 피드백 내보내기의 검증 범위를 기록합니다. 실제 기기 검증과 한국 스토어 출시 최종 판정은 통합 보고서에서 별도로 판단합니다.

## 판정과 확인 범위

| 항목 | 판정 | 확인 근거 및 한계 |
| --- | --- | --- |
| 사용자 원안 6주 × 5일 / 총 30세션 | PASS | 29종목 배치(요일별 6/5/6/6/6), 174종목 세션, 618개 본 세트를 실제 프로그램 엔진에서 생성하고 원안 기준표와 비교 |
| 주차별 목표 보존 | PASS | 모든 세트의 `originalWeight`, 반복, 세트 태그, 휴식 시간을 대조. 원안의 4주차를 임의 회복 주간으로 바꾸지 않음 |
| 맨몸 종목 0kg / 딥스 +4kg | PASS (모델) | 맨몸 0kg은 추가 중량 없음, 입력 요청 없음. +4kg 원안 보존. 실제 기구 설정에 따라 작업 중량은 +5kg 등으로 조정될 수 있음 |
| JSON/CSV 유효성 및 예산 | PASS | 필수 열/주차 누락, 중복, 잘못된 따옴표, UTF-8 10MB 초과, 종목당 주간 100세트, 전체 50,000세트 상한 테스트 |
| 기존 Liftosaur JSON 호환 | PASS | 기존 가져오기 경로 유지 및 테스트. AI 기능 자체에 원격 LLM 호출 없음 |
| Skip & Shift / 주말 휴식 | PASS (모델) | 미완료 세션만 다음 지정 요일로 이동. 완료일 고정, 저장 후 복원, 이후 미루기, 일정 변경 및 반복 시작 테스트 |
| 지역 날짜 및 알림 요청 | PASS (모델) | 서울의 UTC 날짜 경계, DST 전환, 과거/완료/휴식일 제외, 동적 운동 제목 및 시간 요청 테스트 |
| 오프라인 저장 후 재열기 | PASS (직렬화) | 실제 가져오기→운동 종료→sharded Persistence 저장→새 Persistence 인스턴스 복원→알림 요청→Markdown 생성, 네트워크 client 호출 0회. 저장 매체는 메모리 테스트 대역 |
| AI Markdown 수치 및 문맥 | PASS | 목표/기구 조정/실제 분리, 소수 중량 보존, Epley e1RM, 워밍업 제외, 덤벨·단측 볼륨, 누락 중량, 메모와 Markdown escaping 테스트 |
| 운동 그림 자동 연결 | PARTIAL | 첫 주 29종목 배치 중 small 이미지 registry에 27개가 존재. `케이블 암 풀다운`과 `Hack Squat, Leverage Machine`은 해당 동작/기구 그림 부재. 다른 동작 그림으로 임의 대체하지 않음 |
| 앱 강제 종료/재설치 뒤 실제 Android 데이터 보존 | NOT RUN | 메모리 저장 대역 결과로 Android 저장장치 내구성이나 운영체제 강제종료 경계를 증명할 수 없음 |
| 실제 휴대폰 알림 도착·진동·방해 금지·배터리 제한 | NOT RUN | 알림 요청 모델/직렬화까지만 이 점검 범위. 실제 전달 검증 필요 |
| 신규 소스 Android 번들/APK 및 실제 UI 전체 흐름 | NOT RUN (본 담당) | 통합 검증 담당에게 위임. 이전 v158 APK 성공을 이번 수정의 빌드 성공으로 간주하지 않음 |

## 수정한 결함

1. **기본 PHAT 루틴이 사용자 원안과 다름.** 이전 기본값은 25종목, 중량 0, 원안에 없는 운동과 임의 4주차 회복 계획을 사용했습니다. 사용자가 제공한 Week 1~6 Liftoscript에 맞춰 29종목 배치와 중량·반복·세트·휴식을 복원했습니다. 예시 중량임을 설명하고 기존 사용자의 저장 프로그램은 자동 덮어쓰지 않습니다.
2. **밀린 세션을 완료하면 완료일이 과거로 되돌아감.** 기존 `shiftCount`는 미완료 인덱스에만 적용되어 완료 직후 날짜가 원래 슬롯으로 돌아갔습니다. 새 `completedSessionDates`는 완료 인덱스→그때의 예정 날짜를 저장하여 이후 미루기와 설정 변경에서도 유지합니다.
3. **복원된 큰 미루기 수치가 날짜 루프를 오래 실행할 수 있음.** 슬롯마다 일자를 순회하던 계산을 전체 주 점프+최대 7일 탐색으로 바꾸고 안전 정수 및 날짜 표현 범위를 검사합니다.
4. **Markdown이 원래 목표와 소수 중량을 변형함.** `21.25kg`를 `21.3kg`로 줄이고 기구 조정치를 원안 목표처럼 표시하던 문제를 수정했습니다. 원안 `originalWeight`와 `기구 조정` 값을 함께 표시하고 실제/목표 중량을 소수 3자리까지 보존합니다(e1RM/변화율은 읽기 쉬운 소수 1자리).
5. **맨몸 0kg이 매번 중량 입력 요청으로 바뀜.** 명시적인 Bodyweight 종목은 0kg을 실제 추가 중량 0으로 가져옵니다. 기존 일반 운동 0kg의 수동 입력 관례 및 워밍업 자동 중량 관례는 유지합니다.
6. **`rest_seconds: 0`이 기본 휴식으로 돌아감.** 0초를 생략하지 않고 `0s`로 명시하여 의도적인 휴식 타이머 비활성화를 엔진까지 보존합니다.

## 원안 대조 근거와 단일 데이터 원본

기준은 이 작업에 사용자가 제공한 전체 Week 1~6 Liftoscript입니다. 함께 붙인 두 번째 JSON은 Week 1만 포함하므로 6주 데이터의 기준으로 사용하지 않았습니다.

- 요일 구성: 월 상체 파워 6종목/23세트, 화 하체 파워 5종목/19세트, 수 당기기 근비대 6종목/20세트, 목 밀기 근비대 6종목/21세트, 금 하체 근비대 6종목/20세트. 매주 103세트 × 6주 = **618세트**.
- `test/aiWorkoutProgram.test.ts`는 요일·운동 순서별 174개 첫 세트 중량/반복 기준표 및 파워 종목 백오프 표를 별도로 명시합니다. 이 표와 엔진이 생성하는 모든 세트를 대조하여 중량·반복·휴식·태그·개수를 검사합니다.
- 독립 담당자의 원문 대조에서 Week 4/Day 1 랫풀다운 오기(63kg × 8, 원문은 **63kg × 7**)를 발견했습니다. 구현과 테스트 기준표를 모두 7로 고치고 다운로드 JSON을 다시 생성했습니다. 같은 작성자가 만든 기준표만으로 오기를 발견할 수 없다는 한계를 교차 검토로 보완했습니다.
- 원안의 `Rear Delt Reverse Fly`는 같은 동작의 내장 canonical `Reverse Fly, Leverage Machine`로 연결합니다. `Straight Arm Pulldown`은 내장 ID가 없으므로 사용자 운동 `케이블 암 풀다운, Cable`로 가져와 한국어 이름과 원안의 목표를 보존합니다.
- 앱의 단일 원본은 `src/utils/aiWorkoutProgram.ts`의 `AiWorkoutProgram_buildPhatSeedJson()`입니다. 다운로드 파일 `examples/phat-6week-kr.json`은 이 함수의 출력과 일치하는지 테스트합니다.

재생성 명령(저장소 루트):

```sh
TS_NODE_TRANSPILE_ONLY=1 npx ts-node -e 'import {writeFileSync} from "fs";import {AiWorkoutProgram_buildPhatSeedJson} from "./src/utils/aiWorkoutProgram";writeFileSync("examples/phat-6week-kr.json", AiWorkoutProgram_buildPhatSeedJson()+"\n");'
```

파일은 AI 표준 JSON 규격입니다. 앱의 JSON/CSV 가져오기로 읽을 수 있습니다.

## 중량 조정과 데이터 호환 경계

- 원안은 설정과 무관하게 `originalWeight`에 보존됩니다. `set.weight`는 이용 가능한 기구에 맞춘 작업 중량입니다. 기본 kg 기구에서 관측한 예: 케이블 48.9→45kg, 21.25→20kg, 딥스 추가4→5kg. lb 기구를 보유한 기존 저장 설정에서는 다른 조정값이 가능합니다. 앱의 장비 설정을 몰래 변경하지 않습니다.
- 새 `completedSessionDates`는 선택 필드이며 키는 canonical 0-based 안전 정수 문자열, 값은 유효한 `YYYY-MM-DD`, 키는 `completedSessions`보다 작아야 합니다. 기존 백업에 필드가 없어도 읽을 수 있습니다.
- **과거 버전이 이미 잃어버린 완료 예정일은 복구할 증거가 없습니다.** 구버전 완료 인덱스는 기존 슬롯 표시를 유지하고 신규 완료 인덱스부터 저장합니다. 알 수 없는 과거 날짜를 추정하여 새 이력으로 채우지 않습니다.
- `schedule` 자체가 프로그램의 controlled version field(`src/types.ts`의 `CONTROLLED_FIELDS.program`)이므로 count/map은 한 일정 객체로 버전이 결정됩니다. 새 하위 map을 별도 저장·별도 병합하도록 만들지 않았습니다. 실제 다중 기기 원격 충돌은 본 점검에서 재현하지 않았습니다.
- 새 반복 일정을 시작하면 완료 수/미루기 수와 새 날짜 map을 함께 초기화합니다. 완료 기록 삭제는 기존 `History_deleteRecords`와 같이 기록 삭제 기능이며 일정 완료 취소로 재정의하지 않았습니다. 별도 일정 완료 취소 UX는 현재 검증 범위 밖입니다.

## 실행한 검증

최종 코어/연관 테스트 명령:

```sh
npm run onetest -- test/aiWorkoutProgram.test.ts test/aiFeedbackExport.test.ts test/programSchedule.test.ts test/koCoreOfflineFlow.test.ts test/persistence.test.ts test/storageValidation.test.ts test/storageCorruption.test.ts test/workoutReminderScheduler.test.ts test/fileImportLimits.test.ts test/fileImport.test.ts test/exerciseImage.test.ts
```

결과: **107 passing**, 종료 코드 0. Node의 기존 MODULE_TYPELESS_PACKAGE_JSON 경고는 있으나 실패 없음.

- 관련 테스트는 JSON/CSV, malformed 입력, 예산, 레거시 JSON, locale 비의존 파싱, 전체 618세트 엔진 비교, 소수 목표/실제/e1RM/볼륨, 메모 escaping, 완료일 고정/설정 변경/repeat, 서울/DST, persistence 장애/복원, 알림 큐, 파일 읽기 실패를 포함합니다.
- source grep로 범위를 찾은 후 직접 소스를 읽었습니다. `codebase-memory` skill Tier Verify에 따라 접근했으나 그래프 도구가 설치되어 있지 않아 generation/coverage는 **unknown**이며 그래프 완전성 주장 없음.
- 빌드 필요성: **필요**. 타입·파서·일정·UI 문구를 변경했으므로 통합 담당자의 TypeScript/네이티브 번들/APK 검증이 필요합니다. 본 담당은 병렬 빌드 충돌을 피하고 해당 검증을 통합 담당자에게 인계했습니다.
- 실행성 체크: 위 실제 데이터 모델 흐름 테스트는 PASS. 실제 Android 파일 선택→운동→강제종료/재열기→공유, 실제 알림 도착 확인은 NOT RUN입니다.
- 완성 판정: 코어 수정 및 위 모델/직렬화 게이트는 PASS. 한국 앱 출시 전체 GO 판정에는 통합 빌드와 실제 기기/스토어 운영 검증이 남아 있습니다.
