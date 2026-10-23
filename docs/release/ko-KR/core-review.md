# 한국 출시 코어 변경 독립 검토

검토일: 2026-10-24 (Asia/Seoul). 검토 대상 기준점은 `bb90ce4696f5e80324d479fa89e9708f43bbca3a` / `v158.0`이며, 현재 작업 트리의 한국 출시 코어 변경이다.

## 검토 판정

| 항목 | 판정 | 근거 및 경계 |
| --- | --- | --- |
| 사용자 원안과 6주 전체 수치의 독립 재대조 | PASS | ROOT가 제공한 원안 전사와 구현 테스트에서 분리해 작성한 `compare-phat-reference.py`를 실행하여 날짜/순서, canonicalized 종목명, 6주, 휴식, 세트 수/순번/유형, 중량, 반복을 비교했다. 174 운동-주차 행 및 618세트가 모두 일치했다. |
| Week 4 Day 1 랫풀다운 교차 확인 | PASS | 원안 전사는 63kg × 7이며, 독립 비교에서 W4의 3개 STRAIGHT 세트 모두 해당 목표와 일치했다. W5는 별도로 63kg × 8이다. |
| 기존 exercise/parser 식별자 보존 | PASS | 내장 종목 표시는 `Exercise_nameForDisplay`에서만 변환한다. `Exercise_fullName`, canonical ID 및 저장된 운동명은 영어 원본을 유지한다. 사용자 정의 운동명도 덮어쓰지 않는다. |
| 한국어 운동 검색 | PASS | 조합형 한글 및 자모 문자를 토큰화하고 내장 영어명과 한국어 표시 별칭, 기구명을 함께 검색한다. 한국어 커스텀 종목 이름도 필터링한다. 선택 객체는 원래 exercise 레코드로 유지한다. 모델 테스트 4개 PASS. |
| 운동 선택기 표시 및 이미지 라이브러리 계약 | PASS (render contract) | picker의 행 텍스트/접근성 이름 및 이미지 라이브러리 계약 테스트 8개 PASS. 기기에서의 글꼴, 잘림, 터치 동작은 별도 검증 필요. |
| 실제 오프라인 저장/Android 기기 상태 | NOT RUN | 렌더·모델 테스트는 실제 기기 저장장치, 강제 종료/재실행, 알림 전달이나 네이티브 파일 선택을 검증하지 않는다. |

## 세부 확인

- 한국어 별칭은 exercise의 `id`와 현재 이름이 내장 canonical 레코드와 일치할 때만 표시한다. 같은 ID를 사용자 이름으로 바꾼 레코드는 그 이름을 유지한다.
- 검색 결과는 표시 alias를 검색해도 canonical 레코드와 equipment를 반환하므로 parser/import 명칭 및 저장 키와 표시 언어를 분리한다.
- `completedSessionDates`와 실제 일정 동작은 `docs/release/ko-KR/core-audit.md`의 모델 검증 기록을 확인했다. 해당 테스트 결과는 기존 구현 담당자의 실행 기록이며, 이 독립 UI 검토에서 재실행하거나 전체 schedule 변경을 재감사하지 않았다.
- 이름 연결: 원안 `Rear Delt Reverse Fly`는 `Reverse Fly, Leverage Machine`로 비교했고, 내장 ID가 없는 `Straight Arm Pulldown`은 `케이블 암 풀다운, Cable`로 비교했다. 비교기는 날짜/순서와 이름 매핑을 명시적으로 적용해 운동이 서로 자리를 바꾸는 오류를 탐지한다.

## 실행한 검증

- `npx mocha -r ts-node/register --timeout 0 test/koReleaseUiDisplay.test.ts` — 4 passing. 최초 실행에서 alias 객체의 TypeScript 타입 오류를 발견했고, canonical 레코드 존재 여부를 확인하는 구성으로 수정한 뒤 통과했다.
- `npm run test:render -- --runInBand test-render/contract/exercisePickerLocalization.test.tsx test-render/contract/koReleaseUiImageLibrary.test.tsx` — 2 suites / 8 tests passing.
- `python3 docs/release/ko-KR/compare-phat-reference.py` — PASS, 독립 전사 기준 174 행/618세트.
- 이 범위는 UI 모델과 Jest render 계약이다. 네이티브 앱 빌드, 실제 Android/iOS 실행, 시각적 기기 QA 결과로 해석하면 안 된다.

## 종합

검색/표시 변경은 위 모델 및 렌더 게이트에서 PASS며, 사용자 제공 원안 전사와 6주 전체 수치 비교도 PASS다. 이 검토는 전사 데이터를 기준으로 삼았으며 원본 첨부의 독립 전사 정확성 자체를 검증했다는 주장은 아니다. 모델/렌더 검증은 실제 기기 출시 준비 PASS를 뜻하지 않는다.
