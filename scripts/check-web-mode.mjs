import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
// Run against one production build to catch prerendering a misleading fixture badge for live mode.
for (const mode of ['live', 'fixture']) {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', 'apps/web', '--hostname', '127.0.0.1', '--port', '3010'], {
    env: { ...process.env, NO_TOUCH_MODE: mode, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let errors = ''; child.stderr.on('data', data => { errors += data.toString(); });
  try {
    const deadline = Date.now() + 15000;
    while (true) {
      if (child.exitCode !== null) throw new Error(errors);
      try {
        const response = await fetch('http://127.0.0.1:3010');
        if (response.ok) { const html = await response.text(); assert.ok(html.includes(mode === 'live' ? 'LOCAL NATIVE' : 'LOCAL REHEARSAL')); break; }
      } catch (error) { if (error instanceof assert.AssertionError) throw error; }
      if (Date.now() > deadline) throw new Error('Production web mode check timed out.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally { if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; } }
}
console.log('Production mode badges: live and fixture verified using the same build. No Mac app action or model call.');
