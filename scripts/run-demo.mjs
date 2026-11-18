import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const children = []; let stopping = false;
const logDirectory = resolve(process.env.NO_TOUCH_DATA_DIR ?? '.demo', 'logs');
function stop() { if (stopping) return; stopping = true; children.forEach(child => child.kill('SIGTERM')); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
// Never use real desktop or network model credentials in the default scripted rehearsal.
const live = process.argv.includes('--live');
if (live && process.env.NO_TOUCH_LIVE !== 'I_AUTHORIZE_ISOLATED_APP_CONTROL') throw new Error('Use npm run live after explicit native setup.');
const env = { ...process.env, NO_TOUCH_MODE: live ? 'live' : 'fixture', NO_TOUCH_MODEL: process.env.NO_TOUCH_MODEL ?? 'rehearsal', EVE_TELEMETRY_DISABLED: '1', NEXT_TELEMETRY_DISABLED: '1' };
// A retained approval must never acquire another mode or filesystem scope on resume.
await mkdir('.eve', { recursive: true });
const scopePath = '.eve/no-touch-scope.json';
const scope = { mode: env.NO_TOUCH_MODE, dataDirectory: resolve(env.NO_TOUCH_DATA_DIR ?? '.demo') };
let previous;
try { previous = JSON.parse(await readFile(scopePath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (previous && (previous.mode !== scope.mode || previous.dataDirectory !== scope.dataDirectory)) throw new Error('WORKFLOW_SCOPE_MISMATCH: keep this retained workspace unchanged. Use a separate checkout for another mode or data directory; no state was reset.');
if (!previous) await writeFile(scopePath, JSON.stringify(scope), { flag: 'wx', mode: 0o600 });
if (!live) {
  env.NO_TOUCH_MODEL = 'rehearsal';
  const seed = spawn(process.execPath, ['--experimental-strip-types', 'scripts/seed.ts'], { env, stdio: 'inherit' });
  if (await new Promise(resolve => seed.on('exit', resolve)) !== 0) process.exit(1);
}
await mkdir(logDirectory, { recursive: true });
for (const [name, command, args] of [
  ['agent', resolve('node_modules/.bin/eve'), ['dev', '--no-ui', '--resume', '--no-default-extensions', '--host', '127.0.0.1', '--port', '2000']],
  ['web', process.execPath, ['node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', '3000']],
]) {
  const log = await open(`${logDirectory}/${name}.log`, 'a', 0o600);
  const child = spawn(command, args, { env, stdio: ['ignore', log.fd, log.fd] }); children.push(child);
  child.on('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
  child.on('exit', code => { if (!stopping) { console.error(`${name} exited (${code}); see ${logDirectory}/${name}.log`); process.exitCode = code || 1; stop(); } void log.close(); });
}
console.log(`NoTouch ${live ? 'native isolated Mac demo' : 'scripted fixture rehearsal'}: http://127.0.0.1:3000\nNo browser was opened. ${live ? 'Only configured NoTouch sample scopes are enabled.' : 'No native apps will be controlled.'} Ctrl+C stops both servers.`);
