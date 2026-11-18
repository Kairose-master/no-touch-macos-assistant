"use client";
import { useEveAgent } from 'eve/react';
import { activeTurn, openInteractions } from 'eve/events';
import { useState } from 'react';
import { WorkEvidence } from './work-evidence';

const example = '샘플 회의 메모를 작성하고, 2026년 11월 19일 오후 3시(서울)에 준비 알림을 추가해 줘. 최신 파일을 카드로 보여 주고 가장 최근 파일을 Archive로 이동해 줘.';
export function AgentChat({ sessionId, live = false, model = 'rehearsal' }: { readonly sessionId?: string; readonly sessionless?: boolean; readonly live?: boolean; readonly model?: string }) {
  const demoExample = model === 'rehearsal' ? live ? example.replace('2026년', '2030년') : example : '회의 메모 만들고, 내일 오후 3시(서울)에 알림 추가하고, 최근 파일 보여줘. 메모 내용은 다음 회의 데모를 준비한다야.';
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
    <header className="nt-header"><a href="/">N<span>oTouch</span></a><div><span className="nt-dot"/> {live ? 'LOCAL NATIVE' : 'LOCAL REHEARSAL'}</div></header>
    <section className="nt-intro"><p className="nt-eyebrow">YOUR HANDS STAY ON THE STORY</p><h1>말하면 정리하고,<br/><em>변경 전에는 묻습니다.</em></h1><p>Notes · Reminders · Finder를 위한 멀티앱 비서</p>
      <aside>{live ? '실제 Mac · 전용 NoTouch 메모 폴더·알림 목록·샘플 파일만 사용합니다. 외부 공유는 지원하지 않습니다.' : '샘플 리허설입니다. 실제 macOS 앱 제어와 외부 공유는 비활성화되어 있습니다.'} {model === 'rehearsal' ? '오프라인 모델은 고정된 예제만 실행합니다.' : `${model === 'chatgpt' ? 'ChatGPT 구독' : '실제 AI'} 모델이 요청을 계획합니다. 실행 전 계획과 앱·권한을 확인하세요.`}</aside>
      {model !== 'rehearsal' && <div className="nt-work-actions"><button onClick={() => setText('매일 회의 준비라는 업무 레시피를 제안하고 테스트한 다음 저장 승인을 받아 줘. 신규 회의 메모를 만들고 내일 오후 3시 서울 알림을 추가하고 최근 파일을 보여 주는 순서야. 화면은 cards로 해 줘.')}>업무 레시피 만들기</button><button onClick={() => void send('저장된 업무 레시피를 work_history로 보여줘.')}>저장한 레시피</button><button onClick={() => void send('작업 기록을 work_history로 보여줘.')}>작업 기록</button></div>}
      <details className="nt-eve-guide"><summary>eve로 확인하는 승인·중단·재개</summary><p>계획과 파일 변경은 승인 대기로 멈추고, 같은 세션 URL에서 이어집니다. 서버를 재시작해도 보존된 저장소의 승인 요청을 복구합니다.</p><p>완료 단계는 저장된 검증 결과를 사용합니다. 시작했지만 결과가 불명확한 쓰기는 자동 반복하지 않습니다. 승인·세션 재개는 eve, 부작용 중복 방지는 이 앱의 실행 기록이 함께 담당합니다.</p><p>아래 작업 카드에서 승인 기록, 작업 ID, 완료 단계 수를 확인하세요. 준비 실패와 승인 실패는 구분됩니다.</p></details>
    </section>
    <section className="nt-thread" aria-label="대화" aria-live="polite">
      {agent.messages.length === 0 && <button className="nt-example" onClick={() => setText(demoExample)}>↗ 2분 데모 예제 불러오기<span>{demoExample}</span></button>}
      {agent.messages.map(message => <article className={`nt-message ${message.role}`} key={message.id}><small>{message.role === 'user' ? 'YOU' : 'NOTOUCH'}</small>
        {message.parts.map((part, i) => {
          if (part.type === 'text') return <p key={i}>{part.text}</p>;
          if (part.type === 'tool') return <div className="nt-tool" key={part.callId}><div><strong>{({ write_note: '메모 작성', add_reminder: '알림 추가', latest_files: '최신 파일', change_file: '파일 변경', office_work: '업무 계획과 실행', work_history: '저장된 업무' } as Record<string, string>)[part.name] ?? part.name}</strong><span>{toolStateLabel(part.name,part.state,part.output)}</span></div>{part.error && <p role="alert">{part.error.message}</p>}<Output value={part.output} onRequest={value => void send(value)}/></div>;
          return null;
        })}
      </article>)}
      {openInteractions(agent.view).map(item => <section className="nt-approval" key={item.interactionId} aria-label="명시적 승인 요청">
        <small>{item.request.kind === 'approval' ? 'YOUR APPROVAL REQUIRED' : 'YOUR INPUT REQUIRED'}</small><h2>{item.request.prompt}</h2>
        {(item.request.options ?? []).map(option => <button key={option.id} disabled={resuming || pending[item.interactionId]} onClick={() => void respond(item.interactionId, option.id)}>{option.id === 'approve' && item.request.kind === 'approval' ? '이 변경 승인' : option.id === 'deny' ? '거절' : option.label}</button>)}
        {(item.request.allowFreeform || !(item.request.options?.length)) && <form onSubmit={e => { e.preventDefault(); void respond(item.interactionId); }}><input aria-label="추가 정보" value={answers[item.interactionId] ?? ''} onChange={e => setAnswers(a => ({ ...a, [item.interactionId]: e.target.value }))}/><button disabled={resuming || pending[item.interactionId]}>답변</button></form>}
        <p>새로고침해도 같은 세션에서 이어집니다. 승인을 제출한 뒤 서버 확인을 기다립니다.</p>
      </section>)}
    </section>
    {(error || agent.error) && <p role="alert" className="nt-error">{error || agent.error?.message}</p>}
    <form className="nt-composer" onSubmit={e => { e.preventDefault(); void send(text); }}><label className="sr-only" htmlFor="request">복합 요청</label><textarea id="request" placeholder="무엇을 정리해 드릴까요?" value={text} onChange={e => setText(e.target.value)} disabled={resuming}/><button disabled={resuming || !text.trim()}>요청 보내기 ↗</button></form>
    <footer><span>{resuming ? '세션 복구 중' : agent.status === 'busy' ? '처리 중' : '준비됨'} · {agent.session?.sessionId ? '세션 저장됨' : '새 세션'}</span>{activeTurn(agent.view) && <button onClick={() => void agent.cancel().catch(e => setError(String(e)))}>작업 중지</button>}<a href="/">새 대화</a></footer>
  </main>;
}
function Output({ value, onRequest }: { value: unknown; onRequest?: (message: string) => void }) {
  if (!value || typeof value !== 'object') return null;
  const output = value as Record<string, unknown>;
  if ((output.kind === 'jobs' || output.kind === 'recipes') && Array.isArray(output.items)) return <div>{output.items.map((item: Record<string, unknown>) => <Output key={String(item.id)} value={{kind: output.kind === 'jobs' ? 'work' : 'recipe', ...item}} onRequest={onRequest}/>)}</div>;
  if (output.kind === 'recipe') {
    if (!output.plan || typeof output.plan !== 'object') return <p>레시피 저장이 거절되었습니다.</p>;
    const plan = output.plan as Record<string, unknown>;
    return <article className="nt-recipe"><h3>{String(plan.name)}</h3><p>검증된 단계와 {String(plan.layout)} 화면 · 저장됨</p><pre>{JSON.stringify(plan.steps, null, 2)}</pre><button onClick={() => onRequest?.(`저장된 레시피 ${String(output.id)}를 실행해 줘. 계획을 다시 확인하고 승인받아 줘.`)}>이 레시피 실행</button></article>;
  }
  if (output.kind === 'work' && Array.isArray(output.steps)) return <article className={`nt-job ${output.layout === 'compact' ? 'compact' : ''}`}><h3>{String(output.name)} · {String(output.status)}</h3><WorkEvidence value={output}/><small>작업 ID {String(output.id)}</small>{output.steps.map((step: Record<string, unknown>, index: number) => <section key={index}><p>{index+1}. {String(step.kind)} · {String(step.status)}</p>{step.output ? <Output value={step.output} onRequest={onRequest}/> : null}{step.error ? <p role="alert">{String(step.error)}</p> : null}</section>)}{output.status !== 'completed' && output.status !== 'cancelled' && <><button onClick={() => onRequest?.(`작업 ${String(output.id)}를 work_history cancel로 취소해 줘. 완료된 항목은 유지해.`)}>남은 단계 취소</button>{output.status !== "uncertain" && <button onClick={() => onRequest?.(`작업 ${String(output.id)}를 원래 입력 그대로 재개해 줘. 결과 불명이면 쓰기를 반복하지 마.`)}>같은 작업 재개</button>}</>}</article>;
  if (output.kind === 'files' && Array.isArray(output.cards)) return <div className="nt-files">{output.cards.map((item: Record<string, unknown>) => <article key={String(item.fingerprint)}><span>▤</span><strong>{String(item.name)}</strong><p>{String(item.size)} bytes · {new Date(String(item.modifiedAt)).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p><small>SHA-256 {String(item.fingerprint).slice(0, 14)}…</small></article>)}</div>;
  if (output.kind === 'reminder') return <p>✓ {String(output.title)}<br/>{new Date(String(output.dueAt)).toLocaleString('ko-KR', { timeZone: String(output.timeZone) })} ({String(output.timeZone)}) · {output.mode === 'live' ? '실제 Mac · 일정 재조회 확인' : '샘플'}</p>;
  if (output.kind === 'note') return <p>✓ {String(output.title)} · {output.mode === 'live' ? '실제 Mac · 메모 내용 재조회 확인' : '샘플 메모 저장 확인'}</p>;
  if (output.kind === 'file-change') return <p>✓ {String(output.name)} → {String(output.destination)} · 샘플{output.action === 'share' ? ' (외부 전송 없음)' : ''}</p>;
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function toolStateLabel(name:string,state:string,value:unknown){if(name!=="office_work")return state;const saved=value&&typeof value==="object"?(value as Record<string,unknown>).status:undefined;if(saved==="blocked")return "준비 필요";const status=String(saved??state);return ({blocked:"승인 대기",uncertain:"결과 확인 필요",completed:"완료",running:"실행 중",failed:"실패"} as Record<string,string>)[status]??status;}
