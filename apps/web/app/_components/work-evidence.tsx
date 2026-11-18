const verificationGuide = 'https://github.com/Kairose-master/no-touch-macos-assistant/blob/main/docs/eve-demo.md';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function WorkEvidence({ value }: { value: Record<string, unknown> }) {
  const steps = Array.isArray(value.steps) ? value.steps : null;
  const verified = steps?.filter(step => isRecord(step) && step.status === 'verified').length ?? 0;
  const jobId = typeof value.id === 'string' && value.id ? value.id : '저장된 작업 ID 없음';
  const status = typeof value.status === 'string' ? value.status : '';
  const cancelled = status === 'cancelled' || value.cancelRequested === true;
  const approvalThisCall = value.approvalThisCall === true
    ? '이번 실행 요청에서 승인 응답 확인'
    : value.approvalThisCall === false
      ? '새 승인 응답 없음 · 저장된 작업 상태 반환'
      : '이전 기록 · 이번 요청의 승인 응답 정보 없음';
  const recordedCalls = value.planApprovalCallIds;
  const approvalCount = Array.isArray(recordedCalls) && recordedCalls.every(id => typeof id === 'string' && id.length > 0)
    ? new Set(recordedCalls).size : null;
  const approvedDate = typeof value.lastPlanApprovedAt === 'string' ? new Date(value.lastPlanApprovedAt) : null;
  const approvedTime = approvedDate && Number.isFinite(approvedDate.getTime())
    ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium' }).format(approvedDate)
    : null;
  const approval = value.planApproved === true
    ? '승인됨 · 계획 승인 기록이 저장됨'
    : value.planApproved === false
      ? cancelled ? '승인되지 않음 · 취소됨' : '계획 승인 대기'
      : '이전 기록 · 승인 여부 정보 없음';
  const state = ({
    'awaiting-approval': '계획 승인 대기',
    running: '실행 중',
    completed: '작업 완료',
    cancelled: '취소됨',
    blocked: '준비 필요',
    uncertain: '결과 확인 필요',
  } as Record<string, string>)[status] ?? '저장된 상태 확인';

  return <aside aria-label="승인과 재개 실행 근거" className="my-3 rounded-lg border border-[#cedbd4] bg-[#f7f8f3] p-3 text-xs leading-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong>eve 실행 기록과 중복 방지</strong>
      <span>{state}</span>
    </div>
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <dt className="text-[#5c7b6c]">작업 ID</dt>
        <dd><code className="break-all">{jobId}</code></dd>
      </div>
      <div>
        <dt className="text-[#5c7b6c]">계획 승인</dt>
        <dd>{approval}</dd>
      </div>
      <div>
        <dt className="text-[#5c7b6c]">결과 검증이 끝난 단계</dt>
        <dd>{steps ? `${verified} / ${steps.length}단계` : '이전 기록에 단계 정보 없음'}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-[#5c7b6c]">이번 실행 요청의 승인</dt>
        <dd>{approvalThisCall}</dd>
      </div>
      <div>
        <dt className="text-[#5c7b6c]">기록된 계획 승인 횟수</dt>
        <dd>{approvalCount === null ? '이전 기록 · 승인 횟수 정보 없음' : `${approvalCount}회 · 같은 실행 호출의 재처리는 중복 집계하지 않음`}</dd>
      </div>
      <div>
        <dt className="text-[#5c7b6c]">최근 계획 승인 시각 (서울)</dt>
        <dd>{approvedTime ? <time dateTime={String(value.lastPlanApprovedAt)}>{approvedTime}</time> : '이전 기록 · 승인 시각 정보 없음'}</dd>
      </div>
    </dl>
    {status === 'blocked' && <p className="mt-2 text-[#785c25]">
      현재 단계의 앱 데이터 변경을 시작하기 전에 준비 검사에서 멈췄습니다. 실행 호스트의 권한과 전용 창을 확인하세요. 앞서 완료한 단계는 유지됩니다.
    </p>}
    {status === 'uncertain' && <p className="mt-2 text-[#9e3926]">
      현재 단계의 결과를 확인하지 못했습니다. 앱 상태와 작업 기록을 대조하기 전에는 같은 쓰기를 자동 반복하지 않습니다.
    </p>}
    <p className="mt-2">
      같은 작업을 재개하면 {verified > 0 ? `검증을 마친 ${verified}개 단계의 저장 결과를 재사용합니다.` : '완료된 단계의 저장 결과를 재사용합니다.'} 시작만 기록되고 결과가 불명확한 쓰기는 멈춥니다.
    </p>
    <p className="mt-2 text-[#5c7b6c]">
      eve는 승인 대기와 저장된 세션·작업 재개를 맡습니다. 이 앱의 실행 기록(ledger)이 같은 쓰기의 중복을 막습니다. 복구에는 기존 저장소와 실제 결과 확인이 필요합니다.
    </p>
    <p className="mt-2">
      기존 검증 기록·재현 절차:{' '}
      <a href={verificationGuide} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        재시작·중복 방지 검증 방법<span className="sr-only"> (GitHub, 새 탭)</span>
      </a>
    </p>
  </aside>;
}
