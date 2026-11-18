import { defineTool } from 'eve/tools';
import { z } from 'zod';
export default defineTool({
  description: 'Read up to five most recently modified isolated demo files and return cards with fingerprints. Never inspect the user home or Downloads.',
  inputSchema: z.object({}).strict(),
  async execute() { const { latestFiles } = await import('../lib/office.ts'); return latestFiles(); },
});
