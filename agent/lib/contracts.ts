import { z } from 'zod';

export const bundles = { notes: 'com.apple.Notes', reminders: 'com.apple.reminders', finder: 'com.apple.finder' } as const;
export type App = keyof typeof bundles;
export const noteInput = z.object({ title: z.string().min(1).max(120), body: z.string().min(1).max(4000) }).strict();
export const reminderInput = z.object({ title: z.string().min(1).max(120), dueAt: z.iso.datetime({ offset: true }), timeZone: z.string().min(1).max(80) }).strict();
export const changeInput = z.object({
  action: z.enum(['move', 'trash', 'share']),
  name: z.string().regex(/^[^/\\\0]+$/).max(200),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  destination: z.enum(['Archive', 'Trash', 'Local share preview']),
}).strict().superRefine((input, ctx) => {
  if (input.destination !== ({ move: 'Archive', trash: 'Trash', share: 'Local share preview' } as const)[input.action])
    ctx.addIssue({ code: 'custom', message: 'Action and exact destination must match.' });
});
export type NoteInput = z.infer<typeof noteInput>;
export type ReminderInput = z.infer<typeof reminderInput>;
export type ChangeInput = z.infer<typeof changeInput>;
export const allowedTools = ['write_note', 'add_reminder', 'latest_files', 'change_file', 'office_work', 'work_history'] as const;
export function toolPolicy(name: string) {
  if (process.env.NO_TOUCH_MODEL !== 'rehearsal' && ['write_note','add_reminder','latest_files','change_file'].includes(name)) return {type:'denied' as const,reason:'Use office_work: real model requests require a reviewed plan and exact file approvals.'};
  return (allowedTools as readonly string[]).includes(name) ? undefined : { type: 'denied' as const, reason: 'Only reviewed office workflows and scoped capabilities are authorized.' };
}
