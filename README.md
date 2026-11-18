# NoTouch — macOS 멀티앱 비서

**실제 ChatGPT 모델·웹 채팅으로 Mac의 메모 작성·일정 저장·파일 조회를 끝까지 검증했습니다.** 기본 모드는 앱을 건드리지 않는 샘플 리허설이며, `npm run live`는 별도로 준비한 NoTouch 전용 샘플만 제어합니다. 실제 경로는 headless CLI와 사용자가 허용한 Apple 공식 API를 함께 사용합니다.

- 공식 **eve 1.0.2**, `eve add channel/web`로 생성한 Next.js 웹 채널 기반
- 공식 **agent-desktop 1.3.1** / JSON envelope **2.6**를 확인한 headless CLI 어댑터
- Notes는 실제 `snapshot -i → 전체 ref click/set-value → 새 snapshot 내용 확인`; Reminders는 EventKit commit·별도 프로세스 재조회
- 최신 샘플 파일 카드, 파일별 명시적 승인, 승인 대기 중 서버 재시작·페이지 새로고침 후 재개
- 기본 도구와 개발 확장 비활성화, 고수준 capability 4개와 계획·레시피 workflow만 허용, OTel 본문 캡처 비활성화

## 실행

Node.js 24+와 npm이 필요합니다. 확인한 실행 환경은 Node 24.18.0입니다. 전역 CLI 설치·권한 변경·자동 브라우저 실행은 없습니다.

```sh
npm ci
npm run demo
```

준비되면 직접 **http://127.0.0.1:3000** 에 접속합니다. “2분 데모 예제 불러오기” → “요청 보내기”를 누르면 샘플 메모·알림·파일 카드가 나타나고 파일 변경 전에 승인 대기합니다. `Ctrl+C`로 두 서버를 종료합니다.

오프라인 리허설 모델은 **고정 예제 시나리오**입니다. 이 fixture 실행으로 자유로운 자연어 이해나 실제 Mac 작업 성공을 입증했다고 설명하면 안 됩니다. 예제 알림 날짜도 `2026-11-19 15:00 Asia/Seoul`로 고정되어 있습니다.

새 리허설이 필요하면 별도 checkout에서 새 빈 디렉터리를 지정하세요. 같은 Workflow 저장소의 실행 모드·데이터 경로를 바꾸지 않습니다. 기존 데이터는 자동 초기화하지 않습니다.

```sh
NO_TOUCH_DATA_DIR="$PWD/.demo-rehearsal-2" npm run demo
```

## 실제 Mac 모드

fixture와 별도의 checkout에서 [네이티브 준비·권한·실행 절차](docs/native.md)를 따르세요. 이 Mac에서는 실제 Notes 저장, EventKit 일정·시간대·알람 재조회, Finder 카드, 승인/거절·새로고침 복구와 승인 후 샘플 이동이 통과했습니다. 실행 전후 커서와 전면 앱도 같았습니다. [정형 검증 결과](docs/evidence/native-result.json).

Reminders 전체 접근 권한은 OS 범위이며 코드 실행은 전용 목록으로 제한합니다. 창과 폴더가 다르거나 권한이 없으면 중단합니다. 외부 공유는 미구현입니다.

## 실제 모델로 자연어 계획하기

오프라인 예제 모델을 사용하지 않고 실제 Gateway 모델이 요청을 계획하게 할 수 있습니다. 백엔드는 계속 샘플입니다. 아래는 Gateway의 fixture 실행 예시이며, 실제 검증은 사용자가 선택해 로그인한 ChatGPT 구독 모델로 수행했습니다.

```sh
npm run demo:seed
# AI_GATEWAY_API_KEY 등 공식 eve 인증은 본인 환경에서 별도로 구성합니다.
NO_TOUCH_MODE=fixture npm run dev
# 다른 터미널
npm run dev:web
```

`NO_TOUCH_MODEL=rehearsal`을 지정하지 않으면 초기화 시 선택된 `openai/gpt-6-luna-fast`를 사용합니다. 자격 증명은 환경 변수로만 전달하고 저장소에 넣지 마세요. ChatGPT 구독 경로는 실제 웹·3앱 E2E를 검증했습니다. Gateway/직접 API 경로와 다양한 자연어 입력 품질은 별도 평가가 필요합니다.

## 실제 모델·업무 레시피

ChatGPT 구독 로그인 후 `NO_TOUCH_MODEL=chatgpt npm run live`를 실행합니다. “회의 메모 만들고, 내일 오후 3시 서울 알림 추가하고, 최근 파일 보여줘”를 모델이 계획하며, 전체 계획 확인 후 실행합니다. 새 업무는 격리 fixture 테스트 → 앱·권한·화면 미리보기 → 저장 승인 → 재사용 순서입니다. `cards`/`compact` 화면을 데이터로 바꾸며 앱 코드를 무제한 수정하지 않습니다. [업무 레시피와 복구 방법](docs/workflows.md).

## 구현·검증 범위

| 항목 | 상태 |
|---|---|
| eve 세션·실시간 웹 채팅·명시적 승인 | fixture 및 실제 Mac E2E 검증 |
| 서버 재시작 후 같은 승인 복구·응답 중복 방지 | 실제 eve API로 검증 |
| 페이지 새로고침 후 승인 복구 | 격리 headless Chromium으로 검증 |
| 샘플 메모 생성·시간대가 있는 알림 추가 | 파일로 저장되는 가짜 AX 앱에서 검증 |
| 최신 파일 카드·승인된 이동·가역적인 Trash | 격리 샘플 디렉터리에서 검증 |
| 공유 | **로컬 미리보기 JSON만 생성**; 외부 전송 미구현 |
| 네이티브 CLI 어댑터 | 한국어 Notes·Finder의 실제 headless snapshot/ref 동작 검증 |
| 실제 macOS Notes·Reminders·Finder E2E | **전용 샘플로 검증**; CLI + EventKit/NSWorkspace + 제한된 파일 API |
| 외부 배포·다중 사용자 인증 | 미구현; 루프백 로컬 데모 전용 |

처음에는 접근성 권한이 없어 차단됐으나 사용자 허용 후 `granted`를 확인했습니다. `npm run preflight`는 버전·상태·권한만 읽으며 권한이 없으면 exit 2입니다. Screen Recording은 AX 경로에 필요하지 않습니다. 설정 화면, `permissions --guide/--request`, 앱 실행·포커스·스크린샷을 자동으로 수행하지 않습니다.

## 검증 명령

```sh
npm test
npm run typecheck
npm run typecheck:web
npm run test:integration
NO_TOUCH_MODEL=rehearsal npm run build
npm run build:web
npm run test:web-mode
npm audit
```

`test:integration`은 포트 2100에 샘플 서버를 띄워 재시작·승인·거절을 검사하고 종료합니다. 데이터는 별도의 `.demo-integration-*`에 기록하므로 기본 `.demo`를 초기화하기 전에도 실행할 수 있습니다. 실제 앱이나 외부 모델은 사용하지 않습니다. 포트가 비어 있어야 합니다.

브라우저 검증은 **새 빈 샘플 디렉터리**로 실행한 `npm run demo`가 준비된 상태에서 별도 터미널로 수행합니다. 이미 이동한 파일이 있는 디렉터리로 반복 실행하면 예제 전제조건이 달라집니다.

```sh
# 서버 터미널: 매번 새 빈 경로를 사용합니다.
NO_TOUCH_DATA_DIR="$PWD/.demo-browser-1" npm run demo
# 테스트 터미널: 서버와 동일한 경로를 지정합니다.
PLAYWRIGHT_BROWSERS_PATH=/tmp/no-touch-browsers npx playwright install chromium
NO_TOUCH_DATA_DIR="$PWD/.demo-browser-1" PLAYWRIGHT_BROWSERS_PATH=/tmp/no-touch-browsers npm run test:browser
```

브라우저 테스트는 사용자 브라우저와 분리된 headless Chromium을 사용합니다. 결과와 화면은 [docs/evidence](docs/evidence)에 있습니다. `web-*.png`는 fixture, `native-web-*.png`는 실제 Mac 작업 결과를 표시한 웹 UI입니다.

## 문서

- [구조·승인·복구·관측성](docs/architecture.md)
- [2분 발표와 운영 절차](docs/demo.md)
- [네이티브 준비·실행·검증](docs/native.md)
- [실제 모델·업무 레시피·작업 기록·복구](docs/workflows.md)
- [종합 사무 비서 확장 로드맵](docs/roadmap.md)
- [검증 결과와 한계](docs/verification.md)
- [공식 API 확인 근거](docs/sources.md)

`.demo*/`, `.eve/`, 자격 증명과 로컬 로그는 Git에서 제외됩니다. GitHub 공개 저장소는 소스 공개 목적이며, 웹앱의 외부 게시와는 별개입니다.


샘플/실제 모드와 데이터 디렉터리별로 별도 checkout을 사용하세요. 실행기는 `.eve/no-touch-scope.json`에 범위를 고정하며, 다른 모드나 경로로 같은 retained 상태를 재개하면 중단합니다. 저장소·세션을 자동 초기화하지 않습니다. `npm run live`의 기본 모델은 로그인한 ChatGPT 구독 모델이고, 고정 시나리오는 `NO_TOUCH_MODEL=rehearsal`을 명시할 때만 사용합니다.
