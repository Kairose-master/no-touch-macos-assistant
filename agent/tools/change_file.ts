import { defineTool } from 'eve/tools';
import { always } from 'eve/tools/approval';
import { changeInput } from '../lib/contracts.ts';
export default defineTool({
  description: 'Move a sample file to Archive or reversible demo Trash, or write a LOCAL share preview (never send externally). Requires a fresh fingerprint and explicit per-call human approval. Opt-in native mode uses a scoped filesystem API with Finder observation, not Finder UI mutations.',
  inputSchema: changeInput,
  approval: { request: always(), prompt: ({ input }) => `샘플 파일 ${input.name} → ${input.destination} (${input.action}) · fingerprint ${input.fingerprint}. ${input.action === 'share' ? '로컬 공유 미리보기만 생성하며 외부 전송은 없습니다.' : '이 정확한 변경을 승인하시겠습니까?'}` },
  async execute(input, ctx) { const { changeFile } = await import('../lib/office.ts'); return changeFile(ctx.session.id, input); },
});
