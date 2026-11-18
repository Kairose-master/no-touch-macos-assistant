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
