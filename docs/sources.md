# 공식 인터페이스 확인 기록

확인일: 2026-11-18. 설치된 패키지 동봉 문서를 구현 기준으로 사용했습니다. 웹 최신 문서와 설치 버전이 다를 수 있어 API 이름을 추측하지 않았습니다.

| 근거 | 확인 항목 |
|---|---|
| [eve npm](https://www.npmjs.com/package/eve) / 설치된 `node_modules/eve/docs/README.md` | 공식 패키지·CLI `eve`, 설치 버전 1.0.2 |
| [eve Next.js](https://eve.dev/docs/guides/frontend/nextjs) | `eve add channel/web`, 별도 agent 서비스와 웹 클라이언트 |
| [eve HITL](https://eve.dev/docs/human-in-the-loop) / 동봉 `docs/tools/human-in-the-loop.md` | `defineTool`, `always()`, `approval.request/prompt`, 승인 전 execute 미실행 |
| [eve durability](https://eve.dev/docs/concepts/execution-model-and-durability) | Workflow 기반 세션, 로컬 world, 재개와 부작용 중복의 구분 |
| [eve OTel](https://eve.dev/docs/observability/otel) / 동봉 `docs/guides/instrumentation/otel.mdx` | `otel()`, metadata-only capture, local traces |
| [eve 기본 도구](https://eve.dev/docs/concepts/built-in-tools) | `defaultTools:false`, 기본 도구를 정책으로 제한 |
| 설치된 `node_modules/eve/docs/guides/frontend/use-eve-agent/index.mdx` | `useEveAgent`, `initialSession`, `resume`, `respond`, `openInteractions` |
| 설치된 `node_modules/eve/docs/channels/eve.mdx` | POST session, follow-up answers, HTTP idempotencyKey |
| [agent-desktop 공식 저장소](https://github.com/vercel-labs/agent-desktop) | headless 기본, 전체 snapshot ref, 재검증 |
| [agent-desktop macOS](https://agent-browser.dev/desktop/platforms/macos) | bundle ID 우선, Accessibility, press의 물리 키 경로 |
| [agent-desktop 오류 복구](https://agent-browser.dev/desktop/errors-and-recovery) | safe delivery/retry와 관찰 원칙; 구현 시 CLI 동봉 스킬로 재확인 |
| `agent-desktop skills get desktop`, `skills get platform` | 설치 버전과 일치하는 실제 스킬 JSON을 로컬 evidence에 저장 (공개 Git에서는 제외) |
| `snapshot/type/set-value --help` | 정확한 CLI 플래그와 `--stdin` 지원을 실제 실행해 확인 |
| Next.js 동봉 `dist/docs/.../proxy.md`, `rewrites.md` | Next proxy와 루프백 rewrite 구성 |

`agent-desktop version`은 패키지 1.3.1과 envelope 2.6을 반환했습니다. 두 숫자는 서로 다른 버전이며 혼용하지 않습니다. `permissions`는 권한을 요청하지 않는 읽기 명령으로만 사용했습니다. `status` 증거의 로컬 사용자 디렉터리는 공개 전에 가렸습니다.

주의: eve 1.0.2의 HTTP 문서는 `idempotencyKey`를 지원하지만 해당 TypeScript `RespondTurnOptions`에는 필드가 없습니다. 통합 테스트는 이 부분만 공식 `Client.fetch`로 wire 형식을 사용합니다. 반환 HTTP 202 Accepted와 중복 요청의 동일 delivery ID를 실제 확인했습니다.

추가 구현 근거: 설치된 `node_modules/eve/docs/sandbox/just-bash.mdx`의 `JustBashSandbox.environment({autoInstall:false})`와 `defineSandbox`를 사용합니다. 로컬 production build가 DefaultSandbox의 Docker 자동 선택에 의존하지 않도록 명시했습니다.


네이티브 보완 API는 다음 Apple 공식 문서와 설치된 Swift SDK로 확인하고 실제 Mac에서 검증했습니다.

- [EventKit event store](https://developer.apple.com/documentation/EventKit/EKEventStore): `requestFullAccessToReminders`, calendar-scoped fetch, `save(_:commit:)`.
- [EventKit 접근](https://developer.apple.com/documentation/eventkit/accessing-the-event-store): macOS 권한과 usage description.
- [Events and reminders 생성](https://developer.apple.com/documentation/eventkit/creating-events-and-reminders): due date components·알람 저장.
- [NSWorkspace.OpenConfiguration.activates](https://developer.apple.com/documentation/appkit/nsworkspace/openconfiguration/activates): Finder 열 때 활성화 요청하지 않음.
- [NSWorkspace open](https://developer.apple.com/documentation/appkit/nsworkspace/open(_:withapplicationat:configuration:completionhandler:)): Finder 번들 URL과 open configuration.

사용자 승인 후에만 OS Reminders 권한 요청을 실행했습니다. `preflight`와 `live`는 보안 설정을 변경하거나 권한을 자동 요청하지 않습니다.


- [eve 모델 설정](https://eve.dev/docs/agent-config): 공식 `chatgpt()`·`openai()` helper와 로컬 구독 모델.
- [eve TUI 로그인](https://eve.dev/docs/guides/dev-tui): `/login chatgpt`, OS secret store와 로컬 개발 전용 자격 증명.
- [eve workflow tools](https://eve.dev/docs/tools/workflows): `defineWorkflowTool`, `use workflow`, `use step`, `ctx.ask`, 재개와 FatalError.
- [NSWorkspace 앱 활성화 알림](https://developer.apple.com/documentation/appkit/nsworkspace/didactivateapplicationnotification): 실행 중 전면 앱 전환 이벤트 관찰.
- [NSEvent.mouseLocation](https://developer.apple.com/documentation/appkit/nsevent/mouselocation): 25ms 간격의 커서 위치 관찰.
