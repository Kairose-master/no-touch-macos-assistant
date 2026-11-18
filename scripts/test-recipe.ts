import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workPlan, resolveWhen } from '../agent/lib/work-contracts.ts';
import { seed } from './seed.ts';
import { writeNote,addReminder,latestFiles,changeFile } from '../agent/lib/office.ts';
let text='';for await(const chunk of process.stdin)text+=chunk.toString();
const plan=workPlan.parse(JSON.parse(text));
process.env.NO_TOUCH_MODE='fixture';process.env.NO_TOUCH_DATA_DIR=await realpath(await mkdtemp(join(tmpdir(),'no-touch-recipe-test-')));
await seed();
for(const [index,step] of plan.steps.entries()) {
 const scope=`recipe-test:${index}`;
 if(step.kind==='note')await writeNote(scope,{title:step.title,body:step.body});
 else if(step.kind==='reminder')await addReminder(scope,{title:step.title,...resolveWhen(step.when,new Date())});
 else if(step.kind==='files')await latestFiles();
 else {const cards=(await latestFiles()).cards;const card=step.target==='latest'?cards[0]:cards.find(card=>card.name===step.target);if(!card)throw new Error('RECIPE_SAMPLE_TARGET_NOT_FOUND');await changeFile(scope,{action:step.action,name:card.name,fingerprint:card.fingerprint,destination:step.destination});}
}
console.log(JSON.stringify({passed:true,stepCount:plan.steps.length,environment:'isolated fixture (not a new native capability validation)'}));
