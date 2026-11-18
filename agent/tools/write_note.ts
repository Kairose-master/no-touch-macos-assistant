import { defineTool } from 'eve/tools';
import { noteInput } from '../lib/contracts.ts';
export default defineTool({
  description: 'Create one new note in the isolated NoTouch Demo. Never edit or delete existing notes. Fixture only until native rehearsal is authorized.',
  inputSchema: noteInput,
  async execute(input, ctx) { const { writeNote } = await import('../lib/office.ts'); return writeNote(ctx.session.id, input); },
});
