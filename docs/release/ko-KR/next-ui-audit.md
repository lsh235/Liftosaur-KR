# 다음 UI 개선을 위한 한국어 동선 감사

작성일: 2026-10-24 (Asia/Seoul)
범위: v159 후보 소스의 일정, 운동 실행, 기록 가져오기·내보내기, 프로그램 편집, 오류 안내. 이 문서는 다음 개선 범위를 정하기 위한 읽기 전용 감사이며 v159 출시 완료 판정이나 후보 검증 증거가 아니다.

## 방법과 한계

codebase-memory Verify 도구를 사용할 수 없어 지정 화면의 소스와 사용자 메시지 경로를 직접 검색·열람했다. 저장소 전체의 모든 화면 문자열을 완전 검사했다고 주장하지 않는다. 아래 항목은 사용자에게 실제 표시되는 문구 또는 코드에서 확인한 입력 구조를 기준으로 선별했다. 큰 글자 잘림, 스크린 리더 발화, 키보드 가림은 Android 실행 결과가 없으므로 결함으로 단정하지 않고 재현 검사 항목으로 적었다.

아래 8건은 번역 개선 작업의 우선순위를 매겼다. 이 문서의 P1은 주요 동선의 상시 노출/실패 안내를 먼저 번역한다는 뜻이며, 데이터 손실이나 실행 장애의 심각도 P1을 뜻하지 않는다. P2는 보조·조건부 화면 또는 기기에서 재현 확인이 필요한 번역 항목이다.

## 선별 이슈

| 우선순위 | 동선 및 재현 경로 | 소스 근거와 관찰 | 최소 변경 방향 | 다음 검증 |
| --- | --- | --- | --- | --- |
| P1 | **운동 중 세트 입력**: 운동 시작 → 확장 세트 행; 한쪽씩 입력하는 운동은 좌우 반복 입력 표시 | `workoutExerciseSetExpanded.tsx:129-157`에서 입력 모서리 라벨을 `reps`로 전달하고 좌우를 `L`/`R`로 표시한다. `inputNumber2.native.tsx:615-618`은 그 라벨을 입력칸에 그대로 그린다. 축약 행에도 `workoutExerciseSetCompact.tsx:71-101`의 `L:`/`R:`가 있다. | `reps`는 화면 및 접근성 이름에서 ‘반복’으로 바꾸고 좌우 구분은 ‘왼쪽’/‘오른쪽’으로 명시한다. 내부 필드 키와 테스트 ID는 유지한다. | Android TalkBack으로 단측 운동의 좌·우 반복 입력을 차례로 탐색하고, 320dp 및 글자 크기 최대에서 라벨과 숫자 입력이 겹치지 않는지 확인한다. 확장/축약 행 회귀 렌더 검사도 추가한다. |
| P1 | **프로그램 편집/검사**: 프로그램 → 편집 → UI 격자 또는 전체 텍스트 모드 | 공용 편집 툴바 버튼이 `editProgram.tsx:311-339`에서 `Save`로 표시된다. 웹 격자 조정은 `editProgramGrid/gridPinch.tsx:39-45`에서 `Fit`, `Week width` 및 동일한 영문 접근성 라벨을 쓴다. 그리드 셀 편집 모달도 `useAppGridHost.ts:18-21`에서 `Name`/`Save`를 전달한다. | 사용자 문구와 접근성 이름을 ‘저장’, ‘맞춤’, ‘주 너비’, ‘이름’으로 번역한다. 이식성상 관리가 필요한 분석 설명은 내부 문자열로 남겨도 되지만 앱 화면·접근성 이름은 분리한다. | Android 전체 텍스트/그리드, 웹 격자에서 모든 컨트롤의 표시·TalkBack/키보드 이름을 확인한다. 긴 프로그램명 및 시스템 글자 크기 최대에서 툴바가 가로로 잘리지 않는지 확인한다. |
| P1 | **잘못된 프로그램 링크 가져오기**: 프로그램 가져오기 링크에 임의 문자열, 데이터 없는 링크, 디코딩 불가 데이터 입력 | `importFromLink.ts:16-20,41-58`가 실패 원인으로 `Invalid link`, `No data found`, `Error decoding the link`를 만든다. `thunks.ts:2027-2038`은 이 문자열을 번역 없이 경고창에 표시한다. | 실패 종류를 사용자 행동과 함께 한국어로 매핑한다(링크 형식, 포함 데이터, 손상/지원 여부). 저수준 예외는 사용자 문구와 분리한다. | 각 실패 fixture에서 한국어 메시지와 링크 재입력/파일 가져오기 같은 다음 행동을 확인한다. 성공 경로와 기존 공유 링크 호환 테스트는 유지한다. |
| P1 | **CSV 운동 기록 가져오기 미리보기**: 잘못된 날짜·값 또는 구조는 맞지만 레코드 검증에 실패하는 Liftosaur/Hevy CSV 가져오기 | 미리보기는 `screenImportPreview.tsx:49-50,148-152`에서 행 메시지를 그대로 노출한다. 통상 필드 검사는 한국어지만, 최종 스키마 검증은 `importFromLiftosaur.ts:326-332` 및 `importFromHevy.ts:588-594`에서 `Workout "…" failed validation`을 기록한다. | 행/파일 형식과 필드 오류를 한국어 문구로 표시하고, 외부 CSV에서 온 필드명·값은 인용 정보로 보존한다. raw validator 문장을 그대로 사용자에게 붙이지 않는다. | 잘못된 값과 스키마 불일치 CSV 각각으로 한글 행 오류를 검증하고, 행 번호/오류 원인/건너뛰기 동작 및 정상 CSV 가져오기를 회귀 검사한다. |
| P1 | **AI 루틴 파일 가져오기 오류**: JSON/CSV 파일이 구문상 맞지만 프로그램 평가에서 운동이 빠지거나 형식이 잘못된 경우 | `aiWorkoutProgram.ts:541-555`는 한국어 요약 뒤에 planner 평가의 원문 오류를 추가하고, 예외 원문을 `루틴 문법을 확인할 수 없습니다:` 뒤에 붙인다. 최종 실패는 `thunks.ts:2136-2137`에서 경고창으로 표시된다. 앞부분에 한국어 복구 안내가 이미 있고, 뒤의 원문은 진단 정보다. | 이번 변경에서는 원문 evaluator 오류 구조와 알고리즘을 건드리지 않는다. 진단 원문은 보존하고 기존 한국어 복구 안내를 유지한다. | 이 작업에서 AI 가져오기 분기는 재검사하지 않음(NOT RUN). 후속 개선에서 한국어 안내와 진단 원문의 구분/접힘 여부를 별도 평가한다. |
| P2 | **프로그램 연습 탭**: 프로그램 → 연습 | `screenProgram.tsx:357-364`에서 ‘Playground’ 용도 설명 전체가 영어다. 사용자는 프로그램을 임시 실행하는 모드라는 설명과 변경 내용이 저장되지 않는다는 주의사항을 영어로 읽어야 한다. | 설명을 한국어로 번역하고 ‘실제 기록/프로그램에 반영되지 않는 연습’이라는 핵심을 첫 문장에 둔다. | Android와 웹에서 설명 전문이 보이고, 앱 글자 크기 최대에서 줄바꿈/스크롤이 되는지 확인한다. |
| P2 | **프로그램 전환/보조 편집 화면**: 다음 운동일 변경에서 프로그램 여러 개 보유; 기존 day-list 편집 경로 진입 | 선택 항목은 `nextDayPicker.tsx:182-188`에서 `Program`이다. 별도 보조 화면 `editProgramDaysList.tsx:19-38`은 제목/그룹/선택 행에 `Edit Program`, `Current Program`, `Program`을 쓴다. | 각 화면 이름을 같은 용어 체계로 번역한다(예: ‘프로그램’, ‘현재 프로그램’, ‘프로그램 편집’). 해당 화면이 계속 노출되는 탐색 경로인지 제품 담당이 결정하고, 폐기 예정이면 다음 cycle에서 정리한다. | 프로그램 2개 이상 상태에서 선택 모달 및 day-list 진입을 탐색하고, 제목과 선택 필드의 접근성 이름이 한국어인지 확인한다. |
| P2 | **Native 프로그램 텍스트 편집 중 오류 복구**: 운동 텍스트에서 전체 프로그램 편집 작업 선택 후 현재 planner에서 운동 식별 실패 | `editProgramV2TextExercises.native.tsx:77-90`의 네이티브 전용 오류 경고가 `Couldn't tell which exercise this is. Fix any errors on this line and try again.`이다. 웹 동작과 다른 구현 파일이라 웹 확인만으로 발견되지 않을 수 있다. | 경고를 한국어로 바꾸고 어느 줄의 오류를 고치면 되는지 안내한다. 프로그램 수정·취소 동작은 변경하지 않는다. | Android에서 운동 행 삭제/이름 변경 직후 편집 작업을 실행해 이 분기를 확인하고, 한국어 안내·취소 후 입력 상태 보존을 검사한다. |

## 공식 지침과 연결

- Android는 Android 14부터 글자 크기를 최대 200%까지 지원하고 비선형 확대를 적용한다. 최대 글자 크기로 앱을 직접 검사하라고 안내한다. 따라서 표의 입력 라벨, 프로그램 툴바, 일정 입력/저장 영역은 웹의 1.3배 DOM 시뮬레이션만으로 완료 처리하면 안 된다. [Android 글자 크기 접근성 안내](https://developer.android.com/about/versions/14/features?hl=en#accessibility)
- Material 3은 UI 크기별 타이포그래피 역할을 분리하고, 긴 본문은 body 역할로 읽기 좋게 설정하며, 줄 높이를 글자 크기에 맞출 것을 권한다. 이 원칙은 영어 원문 도움말과 validation error를 짧은 제목 스타일에 우겨 넣지 말고, 사용자가 복구할 수 있는 여러 줄 본문으로 표시하는 데 연결된다. [Material 3 typography](https://m3.material.io/styles/typography/applying-type)
- WCAG 2.2의 Reflow는 세로 스크롤 화면이 320 CSS px 너비에서도 정보/기능 손실이나 2축 스크롤 없이 읽히도록 하고, Resize Text는 최대 200% 확대 시 콘텐츠/기능이 손실되지 않도록 한다. 최소 타깃 크기는 24×24 CSS px 또는 적절한 간격을 요구한다. 여기서는 이를 출시 적합 판정으로 사용하지 않으며, Android 네이티브 화면의 320dp·글자 크기 최대·키보드 열림 검사를 설계하는 기준으로만 사용한다. [W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)

## 검증 경계 및 다음 증거

## 후속 구현 및 검증 기록

승인된 화면 표시 문구만 한국어로 바꿨다: 운동 세트의 반복/좌우 라벨, 프로그램 편집 저장/그리드 조정/모달 필드, 링크 가져오기 실패 안내, Liftosaur·Hevy CSV의 최종 검증 안내, 연습 모드 설명, 프로그램 선택/목록 라벨, 네이티브 텍스트 편집 오류 안내. planner 알고리즘, evaluator 원문 오류/진단 정보, parser, CSV 변환 구조, 식별자, testID, 사용자 동작은 변경하지 않았다. AI 가져오기 분기는 이번 구현 대상에 포함하지 않았다.

| 확인 | 결과 | 경계 |
| --- | --- | --- |
| 링크 가져오기 오류 안내와 정상 인라인 링크 | PASS | `npm run onetest -- test/importFromLink.test.ts test/importFromLiftosaur.test.ts test/importFromHevy.test.ts`: 30 passed. 링크 오류 3종과 정상 인라인 디코딩을 검사했고 네트워크 호출은 테스트에서 차단했다. |
| Liftosaur/Hevy 정상 CSV 가져오기 | PASS | 같은 focused run에서 정상 CSV fixture 경로 통과. 최종 Storage validator 실패 분기는 합성 fixture를 만들지 못해 별도 강제 재현하지 않았다. |
| 기존 운동 세트/프로그램 도움말 렌더 계약 | PASS | `npm run test:render -- --runInBand test-render/contract/workoutSetTypeBadges.test.tsx test-render/contract/programHelpKorean.test.tsx`: 2 suites, 12 tests passed. 새 좌우 입력 행 전체를 네이티브로 렌더한 결과는 아님. |
| 단측 반복 입력 Compact/Expanded 렌더 계약 | PASS | `npm run test:render -- --runInBand test-render/contract/workoutUnilateralRepsLocalization.test.tsx`: 2 tests passed. 짧은 ‘좌:’/‘우:’ 표시, ‘왼쪽 반복’/‘오른쪽 반복’ 접근성 이름, 기존 field testID 및 왼쪽/오른쪽/무게 값을 확인했다. |
| Android 시각/접근성 검증 | NOT RUN | 새 CI 후보 캡처/TalkBack/200% 시스템 글꼴/IME 화면은 확인하지 않았다. |
| 320px·큰 글자 Compact/Expanded 실기기 배치 | NOT RUN | 렌더 계약은 UI 트리의 문구/접근성 이름/필드 값을 확인하며 실제 픽셀 배치, native 화면, Android 글꼴 확대를 증명하지 않는다. |
| 통합 `npm run check` | PASS | 마지막 freeze 이후 release owner 실행 완료. |
| 전체 `npm test` | PASS | 2,848 passed. |
| 전체 render suite | PASS | 21 suites passed, 1 skipped; 96 passed, 16 skipped; exit 0 (usual open-handle warning). |
| `npm run build:prepare` safe build | PASS | webpack compiled; asset/entrypoint size, stale Browserslist data, Eleventy invalid-main, and webpack deprecation warnings were reported. |

이 후속 구현은 CI 기준 후보 `c1f49f6`에 포함되지 않았으며 새 후보를 검사해야 한다. 마지막 freeze 뒤 통합 check, 전체 unit/render 검사, safe build는 통과했으나 이 문서는 v159 출시 완료 증거가 아니다.

이번 결과는 소스·테스트에 있는 문자열 및 호출 경로를 확인한 범위에 한정한다. WCAG 적합성 판정, 스크린 리더 발화 확인, 시스템 글꼴 200% 캡처, IME가 뜬 상태의 레이아웃 판정은 포함하지 않는다.

Android 후보 CI 캡처가 전달되면 위 항목 중 격자 저장/가져오기 오류/세트 입력/운동 일정 흐름을 별도 시각 검토하고 캡처 경로와 관찰 내용만 추가한다. 그 검토 결과도 v159 완료 근거와 합치지 않는다.
