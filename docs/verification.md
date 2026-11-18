# 검증 결과

2026-11-18, macOS ARM64 / Node 24.18.0에서 수행했습니다. 아래의 E2E는 **샘플 웹·API·데이터 경로**입니다. 실제 macOS Notes·Reminders·Finder E2E가 아닙니다.

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

## 남은 블로커와 검증하지 않은 항목

- Accessibility가 denied였습니다. 권한을 요청하거나 설정을 변경하지 않았습니다.
- 실제 앱 snapshot/action, 네이티브 Notes 저장, Reminders 날짜 필드/저장, Finder 이동/삭제/공유와 발표자 커서·포커스 불변은 미검증입니다. live recipe는 코드에서 차단합니다.
- 실제 Gateway 모델을 호출하지 않아 자유로운 자연어 계획 품질·비용·지연은 검증하지 않았습니다. 오프라인 모델은 스크립트입니다.
- 외부 공유, 다중 사용자 인증, 인터넷 노출, Vercel 배포, VM 설치, 전원 장애·저장소 손실 복구는 수행하지 않았습니다.
- 적대적 로컬 프로세스의 파일 경합, 디스크 장애에 대한 정확히 한 번 보장은 없습니다.
- 승인 상태 복구는 같은 로컬 프로젝트·Workflow 데이터가 유지되는 정상 프로세스 재시작을 검증한 것입니다.

웹 테스트에서 Next dev의 localhost URL 정규화 때문에 동일 출처 요청을 잘못 차단하는 문제를 발견했습니다. 원래 Host와 제한된 루프백 origin을 비교하도록 수정한 뒤 해당 경로를 다시 검증했습니다.
