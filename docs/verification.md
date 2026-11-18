# 검증 결과

현재 수정본은 새 전용 샘플의 실제 모델·웹·Mac 3단계 완료와 완료 결과 재사용, 격리된 fixture의 승인·재시작·응답 중복 방지를 확인했습니다. 최신 창 없는 Notes의 기동 오류 수정까지 포함해 안전성 테스트는 50개 통과했습니다. **위 3단계 성공 실행의 연속 커서 불변과 native 전체 메모 수 불변은 확인하지 않았습니다.** 자세한 결과는 아래 [창 복구 후속 검증](#창-복구와-승인-단계-구분-후속-검증)과 [창 없는 Notes 기동 수정](#창-없는-notes로-인한-live-기동-오류-수정)에 있으며, 그 앞의 native 결과는 이전 준비 환경에서 수행한 기록입니다.

## 이전 실제 모델·웹·세 앱 검증 기록

사용자가 선택한 ChatGPT 구독 로그인 후 실제 모델의 도구 없는 응답과 웹 채팅 E2E를 확인했습니다. 모델이 복합 요청을 note → reminder → files 단계로 구성하고, 계획 승인 후 실제 Mac에서 결과를 재조회해 보고했습니다. 서울 달력 기준 내일 15시를 서버가 확정했습니다. 고정 시나리오 모델이 이 결과를 대신하지 않았습니다.

- [실제 모델 결과](evidence/real-model-result.json), [웹 결과](evidence/real-model-web-completed.png): 신규 메모 1개·일정/시간대/알람·파일 카드 검증. 조작 없는 구간의 활성화 이벤트 0회, 25ms 커서 관찰의 위치 변화 0회.
- [네이티브 workflow·레시피 결과](evidence/native-workflow-result.json): 실제 메모/알림 완료 후 서버 재시작 → 같은 파일 승인 복구 → 메모 개수/알림 ID 유지 → 승인 후 실제 샘플 이동과 Finder 재조회 통과.
- [레시피 저장 검토](evidence/recipe-review.png), [레시피 실제 실행](evidence/recipe-native-completed.png): 실제 모델 제안, 독립 fixture 테스트 3단계, 저장 승인, 저장만으로 앱 미실행, 재사용 실행, compact 레이아웃 확인. 이 전체 구간도 앱 활성화 0회·커서 변화 0회.
- 단위/안전성 테스트 14개: 계획 승인 경계, 취소 후 남은 단계 차단, 같은 turn의 계획 교체 차단, 파일별 승인 해시, 변경 fingerprint 실패, 완료 메모 재실행 방지, 불명 작업의 새 계획 차단과 실제 recipe fixture 테스트를 포함합니다.

커서·포커스는 전후 비교뿐 아니라 AppKit 활성화 이벤트와 25ms 위치 샘플을 관찰했습니다. 사용자의 동시 앱 전환/커서 이동이 있었던 관찰은 성공 증거로 사용하지 않았습니다. 고정 Finder 창이 없어졌을 때도 다른 창을 대신 쓰지 않고 실패했고, 준비 절차로 전용 창을 다시 고정했습니다. 측정 구간에서의 통과이며 모든 macOS·언어·동시 사용자 조작에 대한 무조건 보장은 아닙니다. 자세한 절차와 취소/복구 한계는 [workflows.md](workflows.md)에 있습니다.


## 이전 실제 Mac 검증 기록 — 권한 차단 해소

사용자가 Accessibility 허용, Apple 공식 API 보완, NoTouch Local Worker의 Reminders 전체 접근을 명시적으로 허용했습니다. 권한을 확인하고 실제 앱에 전용 샘플만 생성했습니다. 앞선 denied·차단 기록은 현재 상태가 아닙니다.

| 경계 | 결과 | 근거 |
|---|---|---|
| Notes | 통과 | 기존 기본 창의 전용 폴더에서 headless ref click/set-value 후 본문 재조회; 신규 메모 개수 +1 보호 별도 검증 |
| Reminders | 통과 | EventKit commit 후 별도 프로세스에서 2030-11-19 15:00 Asia/Seoul·알람 재조회 |
| Finder | 통과 | NSWorkspace activates=false로 전용 폴더 연결, 실제 AX snapshot과 샘플 fingerprint 카드 |
| 웹 → eve → Mac → 웹 | 통과 | 별도 headless Chromium에서 실제 Mac 결과 카드 확인 |
| 승인 | 통과 | 대기 전 파일 미변경, 새로고침 복구, 거절 시 유지, 다른 세션의 명시적 승인 후 Archive 이동 |
| 이동 결과 | 통과 | scoped filesystem rename 후 원본 부재·목적지 존재와 Finder 이름 부재 확인 |
| NoTouch | 통과 | Notes가 배경인 실행에서 전후 전면 앱 및 커서 X/Y 동일; 물리 키·headed 미사용 |
| 안전 경계 | 8개 통과 | native 인자·snapshot scope 검증 추가; 기존 재시도·불명 결과·ledger 검사 유지 |

[정형 결과](evidence/native-result.json), [실제 실행 승인 UI](evidence/native-web-approval.png), [완료 UI](evidence/native-web-completed.png). 화면은 실제 앱 캡처가 아니라 실제 Mac 도구 결과를 표시한 웹 UI입니다. 화면의 한글·카드·승인 버튼을 직접 검토했습니다. Raw OS snapshot, 프로필, 세션, 사용자 디렉터리·개인 목록 이름은 공개하지 않습니다.

순수 CLI만으로 Reminders 날짜 popover를 완료하지 못했고 Finder GoToFolder도 물리 입력 없이 확정되지 않았습니다. 사용자가 허용한 EventKit/NSWorkspace로 대체했습니다. 초기 부동 Notes 창은 전면 앱을 바꿔 발표 경로에서 제외했습니다. 커서·포커스 불변은 이 Mac의 준비된 창에서 실제 측정한 결과입니다. 다른 OS·언어, 사람과의 동시 UI 조작, 앱 종료 후 Notes 지속성/iCloud 동기화는 추가 검증이 필요합니다.

이 하이브리드 고정 시나리오 검증 당시에는 실제 모델을 호출하지 않았습니다. 위 이전 실제 모델 섹션에서 실제 ChatGPT 모델 E2E를 후속 검증했습니다. 다양한 자연어 입력에 대한 품질 평가는 별도입니다. 외부 공유·외부 배포·다중 사용자 인증도 미구현입니다. 삭제 검증은 fixture의 가역적 샘플 Trash만 수행했고 실제 개인 항목 삭제는 수행하지 않았습니다. 테스트 샘플과 OS 권한은 자동 삭제·원복하지 않았습니다. 현재 실행 방법과 한계는 [native.md](native.md)에 정리했습니다.


## 초기 fixture 검증 기록


2026-11-18, macOS ARM64 / Node 24.18.0에서 수행했습니다. 초기 표의 E2E는 **fixture 웹·API·데이터 경로**입니다. 이후 승인받은 실제 Mac 검증 결과를 아래에 별도로 기록합니다.

| 경계 | 결과 | 근거 |
|---|---|---|
| 타입 | 통과 | backend/scripts/tests 및 Next.js TypeScript 검사 |
| 안전성·샘플 상태 | 7개 통과 | `npm test` |
| headless 명령 경계 | 통과 | press/focus/launch/좌표·headed·bare ref·허용하지 않은 앱 거부 |
| ref 복구 | 통과 | STALE_REF·AMBIGUOUS_TARGET은 safe/not_delivered일 때 새 ref로 한 번만 재시도 |
| 결과 불명 | 통과 | 재관찰 후 미확인 효과를 반복하지 않음, ledger가 중복 생성 차단 |
| API → 데이터 | 통과 | 실제 eve 서버의 메모·알림·카드와 승인 대기 |
| 서버 재시작 | 통과 | 같은 session/interaction 복구, 승인 전 파일 유지, 메모·알림 중복 없음 |
| 승인·거절 | 통과 | 승인 후 Archive/Trash, 거절 시 파일 미변경, 같은 HTTP idempotencyKey의 동일 delivery ID |
| 공유 | 통과 | 로컬 preview JSON만 생성, externalDelivery:false |
| 브라우저 → API → 데이터 → 화면 | 통과 | 별도 headless Chromium, 새로고침 복구, 카드 표시, 승인/거절 결과, pageerror 0 |
| 외부 origin | 통과 | Next proxy에서 403 |
| OTel | 확인 | 실제 invoke_agent/agent.step/chat/execute_tool/agent.approval trace, 본문 캡처 false |
| 빌드 | 통과 | eve sample build 및 Next.js production build 생성 |
| 의존성 | npm audit 0개 | Next.js 16.4.6 및 guarded-fetch의 undici 7.30.1 패치, 불필요한 의존성 제거 |

정형 결과: [integration-result.json](evidence/integration-result.json), [browser-result.json](evidence/browser-result.json), [otel-summary.json](evidence/otel-summary.json), [checks.json](evidence/checks.json).

샘플 화면: [승인 대기](evidence/web-approval.png), [승인 완료](evidence/web-completed.png). 실제 앱 캡처가 아닙니다. 화면을 직접 확인하여 한글·파일 카드·승인 버튼의 표시도 검토했습니다.

## 초기 검증 당시 블로커 (후속 검증 전 기록)

- Accessibility가 denied였습니다. 권한을 요청하거나 설정을 변경하지 않았습니다.
- 실제 앱 snapshot/action, 네이티브 Notes 저장, Reminders 날짜 필드/저장, Finder 이동/삭제/공유와 발표자 커서·포커스 불변은 미검증입니다. live recipe는 코드에서 차단합니다.
- 실제 Gateway 모델을 호출하지 않아 자유로운 자연어 계획 품질·비용·지연은 검증하지 않았습니다. 오프라인 모델은 스크립트입니다.
- 외부 공유, 다중 사용자 인증, 인터넷 노출, Vercel 배포, VM 설치, 전원 장애·저장소 손실 복구는 수행하지 않았습니다.
- 적대적 로컬 프로세스의 파일 경합, 디스크 장애에 대한 정확히 한 번 보장은 없습니다.
- 승인 상태 복구는 같은 로컬 프로젝트·Workflow 데이터가 유지되는 정상 프로세스 재시작을 검증한 것입니다.

웹 테스트에서 Next dev의 localhost URL 정규화 때문에 동일 출처 요청을 잘못 차단하는 문제를 발견했습니다. 원래 Host와 제한된 루프백 origin을 비교하도록 수정한 뒤 해당 경로를 다시 검증했습니다.


## 새 공개 복제본 재검증과 수정 (네이티브 권한 부여 전 기록)

공개 커밋 edf18c3를 기존 작업공간·node_modules·Workflow 상태가 없는 새 디렉터리에 복제하여 npm ci부터 실행했습니다. 새 설치에서 타입 검사, 안전성 테스트 7개, eve 빌드, Next.js 빌드, 실제 eve 승인·재시작 복구, headless 브라우저 흐름을 확인했습니다. npm audit 결과는 0개입니다.

실제 사용 순서에서 다음 문제가 재현되어 수정했습니다.

1. 통합 테스트가 기본 .demo 안에 폴더를 만들어, 이후 첫 데모 초기화를 막았습니다. 통합 테스트는 이제 별도의 .demo-integration-*를 사용합니다. 수정 후 통합 테스트 → 기본 데모 시작 순서가 통과했습니다.
2. 사용자 지정 데이터 폴더로 실행해도 로그와 브라우저 테스트는 기본 .demo를 참조했습니다. 둘 다 NO_TOUCH_DATA_DIR를 따르도록 수정하고 README에 두 터미널의 동일한 경로 설정을 명시했습니다. 사용자 지정 폴더에서 승인·거절 E2E가 통과했고, 기본 샘플 파일은 바뀌지 않았습니다.

세션·앱 상태·생성물은 공개하지 않았으며, 실제 앱 액션이나 설정 변경도 하지 않았습니다. Accessibility는 재확인 시에도 denied였고 native recipe는 여전히 차단되어 있습니다. 정형 결과는 [reverification-result.json](evidence/reverification-result.json)에 있습니다.


최종 fixture 회귀 검사에서 기존 실제 모델 세션의 Workflow world를 다른 샘플 디렉터리로 재사용해, 예상보다 많은 샘플 알림이 생성되는 문제를 발견했습니다. 통합 테스트는 이제 별도 코드 작업공간과 `.eve`를 사용합니다. 실행기도 모드·데이터 디렉터리 marker 불일치를 시작 전에 차단합니다. 모드를 바꾸려고 세션을 자동 삭제하지 않습니다.


## 창 복구와 승인 단계 구분 후속 검증

사용자 웹에서 WINDOW_NOT_FOUND를 직접 확인했습니다. 기존 pin이 없어지거나 Notes가 숨겨져 있었고, 다른 폴더의 큰 메모 목록 때문에 전체 AX 읽기가 불완전한 경우도 관찰했습니다. 기본 headless background launch, 완전한 sidebar scope에서 유일한 전용 폴더 확인·선택, Finder의 전용 scope directory 확인으로 준비 경로를 보완했습니다. 쓰기 후 창이 사라지는 경우 새 메모를 다시 만들지 않습니다.

새 샘플은 같은 작업 ID로 준비 실패 상태에서 재개해 Notes·알림·파일 카드 3/3을 완료했습니다. 완료 결과를 다시 불러오는 웹 경로도 확인했고 오래된 오류 문구는 정리됐습니다. 원래 사용자 실패 작업은 결과 불명 상태를 유지하며 재실행하지 않았습니다. [정형 결과](evidence/window-recovery-result.json), [직접 확인한 웹 화면](evidence/window-recovery-replayed.jpg).

동시에 별도 작업이 같은 전용 폴더에서 완료돼 전체 메모 수가 증가했고, 이후 Notes 창이 닫혔으므로 이번 native 재사용의 전체 메모 수 불변을 주장하지 않습니다. 중복 방지의 정확한 개수·같은 승인 복구·HTTP 응답 dedup은 현재 코드의 분리된 fixture 통합 테스트에서 재검증했습니다. background launch 관찰에서 앱 활성화는 0회였지만 사용자 마우스 입력이 있었고 최종 성공 구간은 연속 측정하지 않았으므로 이번 수정만으로 새 연속 커서 불변 검증을 주장하지 않습니다.

화면에 누적 승인 기록과 이번 호출의 승인 여부를 따로 표시하고, blocked 준비 실패·uncertain 결과 불명·완료 결과 재사용을 구분했습니다. 실행 가이드는 [eve-demo.md](eve-demo.md)에 있습니다.

## 창 없는 Notes로 인한 live 기동 오류 수정

사용자 Terminal에서 `NOTES_SAMPLE_WINDOW_REQUIRED: verified=0, visible=0`으로 `npm run live`가 종료되는 오류가 추가로 발생했습니다. 같은 Mac에서도 Accessibility는 granted였지만 Notes 창 목록은 비어 있었습니다. 기본 CLI launch의 성공은 프로세스 실행만 의미하므로, 창 준비를 서버 기동의 조건으로 사용한 것이 잘못이었습니다.

`live`는 이제 기존 프로필·Reminders 권한을 읽어 검증한 뒤 Notes 창과 무관하게 서버를 시작합니다. 실제 수정 명령 `NO_TOUCH_MODEL=chatgpt npm run live`로 eve health `ready`, 웹 HTTP 200과 `LOCAL NATIVE` 배너를 확인했습니다. 앱 준비는 사용자가 계획을 승인한 뒤 수행합니다. 이때 창이 없으면 고정된 macOS `open -g -b com.apple.Notes`를 한 번만 사용하고 보이는 창을 기다립니다. 그 뒤 전용 폴더와 완전한 AX 읽기를 다시 검증합니다.

실기기에서 창 0개 상태의 비활성 재열기 후 기본 창이 다시 나타났고, 수정 코드의 전용 Notes 준비 검사도 통과했습니다. 재열기 명령 관찰 구간과 후속 준비 검사 구간에서는 각각 앱 활성화 0회·25ms 커서 위치 변화 없음이 관찰됐습니다. 재열기 후 창이 보이기까지의 모든 시간을 하나의 연속 구간으로 측정한 결과나 새 메모 쓰기·3앱 전체 재검증은 아닙니다. 이번 수정에서 기존 항목·원래 불명 작업·프로필·권한은 변경하지 않았습니다. [정형 결과](evidence/notes-windowless-startup-result.json).
