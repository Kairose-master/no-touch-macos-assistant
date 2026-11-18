import { mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
if (process.platform !== 'darwin') throw new Error('Native worker requires macOS.');
const app = resolve('.native-build/NoTouch Local Worker.app');
await mkdir(`${app}/Contents/MacOS`, { recursive: true });
await copyFile('native/Info.plist', `${app}/Contents/Info.plist`);
for (const [command, args] of [
  ['/usr/bin/swiftc', ['-swift-version', '5', '-parse-as-library', '-module-cache-path', '/tmp/no-touch-swift-cache', 'native/Worker.swift', '-o', `${app}/Contents/MacOS/NoTouchWorker`, '-framework', 'AppKit', '-framework', 'EventKit']],
  ['/usr/bin/codesign', ['--force', '--sign', '-', app]],
  ['/usr/bin/swiftc', ['-swift-version', '5', '-module-cache-path', '/tmp/no-touch-swift-cache', 'native/Observer.swift', '-o', resolve('.native-build/NoTouchObserver'), '-framework', 'AppKit']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Built local worker. No permission request or app data operation was performed.');
