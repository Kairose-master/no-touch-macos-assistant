import { defineAgent } from "eve";
import { toolPolicy } from './lib/contracts.ts';
import { rehearsalModel } from './lib/rehearsal-model.ts';
import { chatgpt, openai } from 'eve/models/openai';

export default defineAgent({
  model: process.env.NO_TOUCH_MODEL === 'rehearsal' ? rehearsalModel : process.env.NO_TOUCH_MODEL === 'chatgpt' ? chatgpt() : process.env.NO_TOUCH_MODEL === 'openai' ? openai() : "openai/gpt-6-luna-fast",
  reasoning: "high",
  modelContextWindowTokens: process.env.NO_TOUCH_MODEL === 'rehearsal' ? 32000 : undefined,
  defaultTools: false,
  tool: false,
  approval: ({ toolName }) => toolPolicy(toolName),
  experimental: { workflow: { retention: 'default', modelCallsPerStep: 1 } },
  limits: { sessionUsage: ({ window }) => window.inputTokens - window.cacheReadTokens > 100000 || window.outputTokens > 20000 || (window.costUsd ?? 0) > 1 },
});
