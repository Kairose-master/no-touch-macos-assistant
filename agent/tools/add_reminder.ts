import { defineTool } from 'eve/tools';
import { reminderInput } from '../lib/contracts.ts';
export default defineTool({
  description: 'Add a new isolated demo reminder with explicit ISO offset and IANA time zone. Ask if the time is ambiguous. Never edit or delete reminders.',
  inputSchema: reminderInput,
  async execute(input, ctx) { const { addReminder } = await import('../lib/office.ts'); return addReminder(ctx.session.id, input); },
});
