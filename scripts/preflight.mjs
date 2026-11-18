import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const bin = resolve('node_modules/.bin/agent-desktop');
let ready = true;
for (const command of ['version', 'status', 'permissions']) {
  const result = spawnSync(bin, [command], { encoding: 'utf8', timeout: 10000 });
  if (result.error) { console.error('CLI unavailable:', result.error.message); process.exit(1); }
  const envelope = JSON.parse(result.stdout); console.log(JSON.stringify(envelope));
  if (!envelope.ok) ready = false;
  if (command === 'permissions' && envelope.data?.accessibility?.state !== 'granted') ready = false;
}
console.log(ready ? 'Accessibility prerequisite present. Native app recipes still need authorized isolated rehearsal.' : 'Accessibility prerequisite missing. No settings, permission prompts, screenshots or app actions were invoked.');
process.exitCode = ready ? 0 : 2;
