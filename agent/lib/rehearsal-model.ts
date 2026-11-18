import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider';
// Offline scripted model for a clearly labelled rehearsal; NOT a language model.
function next(options: LanguageModelV4CallOptions) {
  const results = options.prompt.flatMap(message => message.role === 'tool' ? message.content : []).filter(part => part.type === 'tool-result');
  const has = (name: string) => results.some(result => result.toolName === name);
  const userText = options.prompt.filter(message => message.role === 'user').map(message => JSON.stringify(message.content)).join(' ');
  const action = /공유|share/i.test(userText) ? 'share' : /삭제|trash|delete/i.test(userText) ? 'trash' : 'move';
  if (!has('write_note')) return { name: 'write_note', input: { title: 'NoTouch Demo 회의', body: '샘플 회의 메모: 다음 데모를 준비한다.' } };
  if (!has('add_reminder')) return { name: 'add_reminder', input: { title: 'NoTouch Demo 준비', dueAt: '2026-11-19T15:00:00+09:00', timeZone: 'Asia/Seoul' } };
  if (!has('latest_files')) return { name: 'latest_files', input: {} };
  if (!has('change_file')) {
    const output = results.find(result => result.toolName === 'latest_files')?.output;
    const value = output?.type === 'json' ? output.value as { cards?: { name: string; fingerprint: string }[] } : undefined;
    const card = value?.cards?.[0];
    if (card) return { name: 'change_file', input: { action, name: card.name, fingerprint: card.fingerprint, destination: { move: 'Archive', trash: 'Trash', share: 'Local share preview' }[action] } };
  }
  return undefined;
}
const usage = { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } };
export const rehearsalModel: LanguageModelV4 = {
  specificationVersion: 'v4', provider: 'no-touch-rehearsal', modelId: 'scripted-fixture', supportedUrls: {},
  async doGenerate(options) {
    const step = next(options);
    return { content: step ? [{ type: 'tool-call', toolCallId: crypto.randomUUID(), toolName: step.name, input: JSON.stringify(step.input) }] : [{ type: 'text', text: '샘플 리허설을 마쳤습니다. 각 카드의 완료·거절 결과를 확인하세요. 실제 macOS 앱과 외부 공유는 실행하지 않았습니다.' }], finishReason: { unified: step ? 'tool-calls' : 'stop', raw: undefined }, usage, warnings: [] };
  },
  async doStream(options) {
    const result = await this.doGenerate(options);
    const chunks: LanguageModelV4StreamPart[] = [{ type: 'stream-start', warnings: [] }];
    for (const part of result.content) {
      if (part.type === 'tool-call') chunks.push(part);
      else if (part.type === 'text') chunks.push({ type: 'text-start', id: 'summary' }, { type: 'text-delta', id: 'summary', delta: part.text }, { type: 'text-end', id: 'summary' });
    }
    chunks.push({ type: 'finish', finishReason: result.finishReason, usage });
    return { stream: new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close(); } }) };
  },
};
