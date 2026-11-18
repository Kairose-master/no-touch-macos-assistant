import { defineTool } from 'eve/tools';
import { noteInput } from '../lib/contracts.ts';
export default defineTool({
  description: 'Create one new note in the isolated NoTouch Demo. Never edit or delete existing notes. Opt-in native mode uses only the configured NoTouch folder.',
  inputSchema: noteInput,
  async execute(input, ctx) { const { writeNote } = await import('../lib/office.ts'); return writeNote(ctx.session.id, input); },
});
