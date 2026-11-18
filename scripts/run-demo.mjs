import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { resolve } from 'node:path';
const children = []; let stopping = false;
function stop() { if (stopping) return; stopping = true; children.forEach(child => child.kill('SIGTERM')); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
// Never use real desktop or network model credentials in the default scripted rehearsal.
const env = { ...process.env, NO_TOUCH_MODE: 'fixture', NO_TOUCH_MODEL: 'rehearsal', EVE_TELEMETRY_DISABLED: '1', NEXT_TELEMETRY_DISABLED: '1' };
const seed = spawn(process.execPath, ['--experimental-strip-types', 'scripts/seed.ts'], { env, stdio: 'inherit' });
if (await new Promise(resolve => seed.on('exit', resolve)) !== 0) process.exit(1);
await mkdir('.demo/logs', { recursive: true });
for (const [name, command, args] of [
  ['agent', resolve('node_modules/.bin/eve'), ['dev', '--no-ui', '--resume', '--no-default-extensions', '--host', '127.0.0.1', '--port', '2000']],
  ['web', process.execPath, ['node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', '3000']],
]) {
  const log = await open(`.demo/logs/${name}.log`, 'a', 0o600);
  const child = spawn(command, args, { env, stdio: ['ignore', log.fd, log.fd] }); children.push(child);
  child.on('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
  child.on('exit', code => { if (!stopping) { console.error(`${name} exited (${code}); see .demo/logs/${name}.log`); process.exitCode = code || 1; stop(); } void log.close(); });
}
console.log('NoTouch scripted fixture rehearsal: http://127.0.0.1:3000\nNo browser was opened. No native apps will be controlled. Ctrl+C stops both servers.');
