import { defineAgent } from "eve";
import { toolPolicy } from './lib/contracts.ts';
import { rehearsalModel } from './lib/rehearsal-model.ts';

export default defineAgent({
  model: process.env.NO_TOUCH_MODEL === 'rehearsal' ? rehearsalModel : "openai/gpt-6-luna-fast",
  reasoning: "high",
  modelContextWindowTokens: process.env.NO_TOUCH_MODEL === 'rehearsal' ? 32000 : undefined,
  defaultTools: false,
  tool: false,
  approval: ({ toolName }) => toolPolicy(toolName),
  experimental: { workflow: { retention: 'default', modelCallsPerStep: 1 } },
});
