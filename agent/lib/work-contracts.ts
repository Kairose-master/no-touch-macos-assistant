import { z } from 'zod';
import { noteInput, changeInput } from './contracts.ts';
export const whenInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exact'), dueAt: z.iso.datetime({ offset: true }), timeZone: z.string().min(1).max(80) }).strict(),
  z.object({ kind: z.literal('tomorrow'), hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), timeZone: z.literal('Asia/Seoul') }).strict(),
]);
export const stepInput = z.discriminatedUnion('kind', [
  noteInput.extend({ kind: z.literal('note') }),
  z.object({ kind: z.literal('reminder'), title: z.string().min(1).max(120), when: whenInput }).strict(),
  z.object({ kind: z.literal('files') }).strict(),
  z.object({ kind: z.literal('file_change'), action: z.enum(['move','trash','share']), target: z.string().min(1).max(200), destination: z.enum(['Archive','Trash','Local share preview']) }).strict(),
]);
export const workPlan = z.object({ name: z.string().min(1).max(80), layout: z.enum(['cards','compact']), steps: z.array(stepInput).min(1).max(8) }).strict().superRefine((plan, ctx) => {
  for (const step of plan.steps) if (step.kind === 'file_change') {
    const result = changeInput.safeParse({action:step.action,name:step.target==='latest'?'sample.txt':step.target,destination:step.destination,fingerprint:'0'.repeat(64)});
    if (!result.success) ctx.addIssue({code:'custom',message:'Unsupported file target or destination.'});
  }
});
export type WorkPlan = z.infer<typeof workPlan>;
export const workRequest = z.object({ operation: z.enum(['run','save_recipe']), plan: workPlan.optional(), recipeId: z.string().regex(/^[a-f0-9]{64}$/).optional(), resumeJobId: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict().superRefine((request, ctx) => {
  if ([request.plan,request.recipeId,request.resumeJobId].filter(Boolean).length !== 1 || (request.operation==='save_recipe' && !request.plan)) ctx.addIssue({code:'custom',message:'Provide exactly one plan, recipeId, or resumeJobId. Saving requires a plan.'});
});
export type WorkRequest = z.infer<typeof workRequest>;
export function resolveWhen(when: z.infer<typeof whenInput>, now: Date) {
  if (when.kind === 'exact') { new Intl.DateTimeFormat('en',{timeZone:when.timeZone}).format(); return {dueAt:when.dueAt,timeZone:when.timeZone}; }
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=(key:string)=>Number(parts.find(p=>p.type===key)!.value);
  const next = new Date(Date.UTC(get('year'),get('month')-1,get('day')+1));
  return {dueAt:`${next.toISOString().slice(0,10)}T${String(when.hour).padStart(2,'0')}:${String(when.minute).padStart(2,'0')}:00+09:00`,timeZone:'Asia/Seoul'};
}
