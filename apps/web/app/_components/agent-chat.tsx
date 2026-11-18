"use client";
import { useEveAgent } from 'eve/react';
import { activeTurn, openInteractions } from 'eve/events';
import { useState } from 'react';

const example = '샘플 회의 메모를 작성하고, 2026년 11월 19일 오후 3시(서울)에 준비 알림을 추가해 줘. 최신 파일을 카드로 보여 주고 가장 최근 파일을 Archive로 이동해 줘.';
export function AgentChat({ sessionId }: { readonly sessionId?: string; readonly sessionless?: boolean }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const agent = useEveAgent({
    initialSession: sessionId ? { sessionId, streamIndex: 0 } : undefined,
    resume: !!sessionId,
    onSessionChange(session) { if (!sessionId && session) window.history.replaceState(null, '', `/s/${encodeURIComponent(session.sessionId)}`); },
  });
  const resuming = agent.status === 'resuming';
  async function send(value: string) {
    if (!value.trim() || resuming) return;
    setError(''); setText('');
    try { await agent.send(value.trim()); } catch (e) { setError(e instanceof Error ? e.message : '전송 실패'); }
  }
  async function respond(id: string, optionId?: string) {
    setPending(p => ({ ...p, [id]: true })); setError('');
    try { await agent.respond([{ interactionId: id, ...(optionId ? { optionId } : { text: answers[id] ?? '' }) }]); }
    catch (e) { setError(e instanceof Error ? e.message : '응답 실패'); setPending(p => ({ ...p, [id]: false })); }
  }
  return <main className="nt-shell">
    <header className="nt-header"><a href="/">N<span>oTouch</span></a><div><span className="nt-dot"/> LOCAL REHEARSAL</div></header>
    <section className="nt-intro"><p className="nt-eyebrow">YOUR HANDS STAY ON THE STORY</p><h1>말하면 정리하고,<br/><em>변경 전에는 묻습니다.</em></h1><p>Notes · Reminders · Finder를 위한 멀티앱 비서</p>
      <aside>샘플 리허설입니다. 실제 macOS 앱 제어와 외부 공유는 비활성화되어 있습니다. 오프라인 모델은 고정된 예제만 실행합니다.</aside>
    </section>
    <section className="nt-thread" aria-label="대화" aria-live="polite">
      {agent.messages.length === 0 && <button className="nt-example" onClick={() => setText(example)}>↗ 2분 데모 예제 불러오기<span>{example}</span></button>}
      {agent.messages.map(message => <article className={`nt-message ${message.role}`} key={message.id}><small>{message.role === 'user' ? 'YOU' : 'NOTOUCH'}</small>
        {message.parts.map((part, i) => {
          if (part.type === 'text') return <p key={i}>{part.text}</p>;
          if (part.type === 'tool') return <div className="nt-tool" key={part.callId}><div><strong>{({ write_note: '메모 작성', add_reminder: '알림 추가', latest_files: '최신 파일', change_file: '파일 변경' } as Record<string, string>)[part.name] ?? part.name}</strong><span>{part.state}</span></div>{part.error && <p role="alert">{part.error.message}</p>}<Output value={part.output}/></div>;
          return null;
        })}
      </article>)}
      {openInteractions(agent.view).map(item => <section className="nt-approval" key={item.interactionId} aria-label="명시적 승인 요청">
        <small>{item.request.kind === 'approval' ? 'YOUR APPROVAL REQUIRED' : 'YOUR INPUT REQUIRED'}</small><h2>{item.request.prompt}</h2>
        {(item.request.options ?? []).map(option => <button key={option.id} disabled={resuming || pending[item.interactionId]} onClick={() => void respond(item.interactionId, option.id)}>{option.id === 'approve' ? '이 변경 승인' : option.id === 'deny' ? '거절' : option.label}</button>)}
        {(item.request.allowFreeform || !(item.request.options?.length)) && <form onSubmit={e => { e.preventDefault(); void respond(item.interactionId); }}><input aria-label="추가 정보" value={answers[item.interactionId] ?? ''} onChange={e => setAnswers(a => ({ ...a, [item.interactionId]: e.target.value }))}/><button disabled={resuming || pending[item.interactionId]}>답변</button></form>}
        <p>새로고침해도 같은 세션에서 이어집니다. 승인을 제출한 뒤 서버 확인을 기다립니다.</p>
      </section>)}
    </section>
    {(error || agent.error) && <p role="alert" className="nt-error">{error || agent.error?.message}</p>}
    <form className="nt-composer" onSubmit={e => { e.preventDefault(); void send(text); }}><label className="sr-only" htmlFor="request">복합 요청</label><textarea id="request" placeholder="무엇을 정리해 드릴까요?" value={text} onChange={e => setText(e.target.value)} disabled={resuming}/><button disabled={resuming || !text.trim()}>요청 보내기 ↗</button></form>
    <footer><span>{resuming ? '세션 복구 중' : agent.status === 'busy' ? '처리 중' : '준비됨'} · {agent.session?.sessionId ? '세션 저장됨' : '새 세션'}</span>{activeTurn(agent.view) && <button onClick={() => void agent.cancel().catch(e => setError(String(e)))}>작업 중지</button>}<a href="/">새 대화</a></footer>
  </main>;
}
function Output({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return null;
  const output = value as Record<string, unknown>;
  if (output.kind === 'files' && Array.isArray(output.cards)) return <div className="nt-files">{output.cards.map((item: Record<string, unknown>) => <article key={String(item.fingerprint)}><span>▤</span><strong>{String(item.name)}</strong><p>{String(item.size)} bytes · {new Date(String(item.modifiedAt)).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p><small>SHA-256 {String(item.fingerprint).slice(0, 14)}…</small></article>)}</div>;
  if (output.kind === 'reminder') return <p>✓ {String(output.title)}<br/>{new Date(String(output.dueAt)).toLocaleString('ko-KR', { timeZone: String(output.timeZone) })} ({String(output.timeZone)}) · 샘플</p>;
  if (output.kind === 'note') return <p>✓ {String(output.title)} · 샘플 메모 저장 확인</p>;
  if (output.kind === 'file-change') return <p>✓ {String(output.name)} → {String(output.destination)} · 샘플{output.action === 'share' ? ' (외부 전송 없음)' : ''}</p>;
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}
