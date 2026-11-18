# 실제 Mac 실행

2026-11-18 macOS 26 ARM64, 한국어 UI에서 실제 웹 → eve → Mac → 결과 카드 흐름을 검증했습니다. [정형 결과](evidence/native-result.json)와 [승인 화면](evidence/native-web-approval.png), [완료 화면](evidence/native-web-completed.png)을 확인하세요. 공개 화면에는 전용 샘플만 포함됩니다.

## 실제 사용하는 경로

| 작업 | 실행과 검증 |
|---|---|
| Notes | `com.apple.Notes`의 미리 준비한 기본 창·선택된 `NoTouch Demo API` 폴더만 사용. `snapshot -i` → 고유 toolbar 버튼의 완전한 scoped snapshot → ref click → 새 snapshot에서 메모 개수 +1·빈 신규 본문 확인 → ref set-value → 내용 재조회 |
| Reminders | Swift EventKit worker가 저장한 전용 NoTouch 목록 ID로만 신규 항목 생성. ISO offset·IANA 시간대·절대 알람을 commit한 뒤 별도 worker 프로세스로 재조회 |
| Finder | `com.apple.finder`를 `NSWorkspace`의 `activates=false`로 샘플 폴더에 연결하고 고정 창을 `snapshot -i`로 읽음. 파일 metadata·fingerprint는 marker가 있는 샘플 폴더에서만 읽음 |
| 파일 변경 | eve의 매번 명시적 승인 이후 제한된 filesystem rename. 원본 부재·목적지 파일 존재·Finder에서 원본 이름 사라짐까지 확인. Trash는 샘플 하위 폴더, 공유는 로컬 preview뿐 |

범용 click/shell/AppleScript는 모델 도구가 아닙니다. CLI는 기본 headless만 사용하며 `press`, 좌표, `focus`, `focus-window`, `--headed`, `--activate`를 차단합니다. CLI launch는 고정 번들 ID의 비활성 실행만 허용하는 내부 경계에 있고 실제 데모 런타임은 준비된 창을 요구합니다.

## 새 Mac 준비

Node 24+, npm, Xcode Command Line Tools의 Swift가 필요합니다. 기본 `npm run demo`는 여전히 가짜 앱을 사용하는 안전한 리허설입니다. 아래는 실제 샘플 항목을 만드는 별도 opt-in 절차입니다.

1. `npm ci`와 `npm run build:native`를 실행합니다. Swift worker는 로컬 ad-hoc 서명 `.app`으로 빌드되고 배포 바이너리는 Git에 넣지 않습니다.
2. 실제 실행 호스트에 Accessibility를 허용한 뒤 `npm run preflight`로 읽기 확인합니다. AX 경로에는 Screen Recording이 필요하지 않습니다. 실행 스크립트는 보안 설정을 자동 변경하지 않습니다.
3. NoTouch Local Worker의 Reminders 전체 읽기·쓰기는 별도의 명시적 운영 결정 후 `npm run permission:native`로 OS 대화상자를 요청합니다. macOS 권한 자체는 모든 목록에 적용됩니다. 앱 코드는 저장된 NoTouch 목록만 조회·추가하며 기존 알림 수정·삭제 기능이 없습니다. 권한 거절 시 실행을 중단합니다.
4. Notes에서 **직접** `NoTouch Demo API` 전용 일반 폴더를 새로 만들고 기본 Notes 창에서 선택합니다. 부동 메모 창을 쓰지 않습니다. 발표 전 준비 단계의 창 선택은 포커스를 바꿀 수 있으므로 발표 중 실행과 구분합니다. 이 이름을 기존 개인 폴더에 붙이지 마세요.
5. `npm run setup:native`를 실행합니다. marker가 있는 새 샘플 파일 폴더와 전용 Reminders 목록을 준비하고 유일한 Notes/Finder 창 ID를 고정합니다. 기존 샘플을 초기화하거나 지우지 않습니다. 같은 제목의 창이 여러 개면 중단합니다.
6. `npm run live`로 루프백 서버를 시작하고 http://127.0.0.1:3000 을 직접 엽니다. `LOCAL NATIVE` 배너를 확인합니다. 권한 요청·Notes 창 생성·브라우저 활성화는 런타임이 하지 않습니다. `Ctrl+C`로 두 서버를 종료합니다.

고정 시나리오 모델을 명시적으로 선택하면 자유로운 자연어 모델이 아니라 스크립트입니다. 이 시나리오의 live 기본 일정은 가까운 시각의 알림을 피하기 위한 **2030-11-19 15:00 Asia/Seoul**입니다. `NO_TOUCH_DEMO_DUE_AT`으로 명시적으로 바꿀 수 있습니다. 실제 모델을 평가하려면 별도로 Gateway 인증을 구성하고 `NO_TOUCH_MODEL=gateway npm run live`를 사용합니다. 후속으로 사용자가 선택한 ChatGPT 구독 모델을 실제 웹·세 앱과 연결해 검증했습니다. `NO_TOUCH_MODEL=chatgpt npm run live` 및 [workflows.md](workflows.md)를 참조하세요. Gateway 품질·요금은 이 검증 범위가 아닙니다.

`.demo-native/profile.json`에는 로컬 절대 경로·전용 목록 ID·창 ID가 있습니다. 권한/worker/창/선택 폴더가 없거나 다르면 fail closed합니다. Notes/Finder 창을 닫았거나 재실행했다면 사전 준비 후 setup을 다시 실행해야 합니다. 원래 자료를 찾거나 다른 창을 임의 선택하지 않습니다.

## 재현과 한계

준비된, 아직 `budget-sample.csv`가 이동하지 않은 샘플 상태와 실행 중인 live 서버에서만 다음 검증을 수행합니다. 테스트는 실제 신규 샘플 메모·미리 알림을 두 번 생성하며, 두 번째 세션에서 샘플 파일 하나를 승인해 이동합니다. 샘플을 자동 되돌리지 않으므로 그대로 재실행하면 선행조건 검사에서 멈춥니다.

```sh
NO_TOUCH_LIVE=I_AUTHORIZE_ISOLATED_APP_CONTROL \
PLAYWRIGHT_BROWSERS_PATH=/tmp/no-touch-browsers npm run test:native
```

격리 headless Chromium에서 승인 대기 → 새로고침 복구 → 거절 시 미변경 → 새 세션 승인 후 이동을 검사했습니다. 실행 전후 전면 앱과 커서 X/Y가 같았고 Notes가 배경인 상태에서 작성됐습니다. 이것은 해당 Mac·언어·준비된 창의 관찰 결과이며 모든 버전의 앱이 절대 활성화되지 않는다는 보장은 아닙니다. 실행 도중 사람이 앱을 조작하는 경합이나 AX UI 전체가 노출하는 개인 sidebar metadata를 차단하는 보안 sandbox도 아닙니다. raw snapshot·세션·프로필·OS 권한 정보는 로컬에만 남고 모델에는 필요한 고수준 결과만 반환합니다.

초기 조사에서 Notes의 File → 새 메모는 부동 창을 만들며 전면 앱을 바꿨습니다. 이를 발표 경로에서 제거하고 준비된 기본 창 toolbar를 사용했습니다. Reminders 날짜 popover는 headless CLI가 offscreen으로 판정했고 Finder GoToFolder도 물리 키 없이 확인되지 않았습니다. 이를 우회하기 위한 headed·물리 키 입력 대신, 사용자가 승인한 EventKit·NSWorkspace API로 보완했습니다. CLI 전체 UI 경로가 통과했다고 주장하지 않습니다.

초기 검증용 `NoTouch Demo 20261118` 목록의 스크래치 항목과 부동 테스트 메모도 남아 있습니다. 해당 스크래치 날짜 입력은 저장 검증에 실패했으므로 성공 근거로 사용하지 않았습니다. 결과 근거는 EventKit 전용 목록과 후속 웹 E2E뿐입니다. 권한과 샘플 항목은 자동 삭제·원복하지 않습니다. 삭제 기능은 별도 승인 대상입니다.


샘플/실제 모드와 데이터 디렉터리별로 별도 checkout을 사용하세요. 실행기는 `.eve/no-touch-scope.json`에 범위를 고정하며, 다른 모드나 경로로 같은 retained 상태를 재개하면 중단합니다. 저장소·세션을 자동 초기화하지 않습니다. `npm run live`의 기본 모델은 로그인한 ChatGPT 구독 모델이고, 고정 시나리오는 `NO_TOUCH_MODEL=rehearsal`을 명시할 때만 사용합니다.
