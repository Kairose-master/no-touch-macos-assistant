import {defineTool} from 'eve/tools';
import {z} from 'zod';
export default defineTool({
 description:'Read persisted work records or saved recipes, or request cancellation of one work ID. Cancellation prevents remaining steps and never deletes/undoes completed app items. Does not grant permission to resume or execute writes; use office_work for reviewed execution.',
 inputSchema:z.object({operation:z.enum(['jobs','recipes','status','cancel']),jobId:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict(),
 async execute(input){const w=await import('../lib/work.ts');if(input.operation==='jobs'||input.operation==='recipes')return w.history(input.operation);if(!input.jobId)throw new Error('JOB_ID_REQUIRED');return input.operation==='cancel'?w.cancelJob(input.jobId):{kind:'work',...await w.readJob(input.jobId)};},
});
