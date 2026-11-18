import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, lstat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson } from '../agent/lib/storage.ts';
import { callNativeWorker, nativeProfile, type NativeProfile } from '../agent/lib/native-worker.ts';
const profile = await readJson<NativeProfile | null>('.demo-native/profile.json', null);
if (!profile || process.env.NO_TOUCH_LIVE !== 'I_AUTHORIZE_ISOLATED_APP_CONTROL') throw new Error('Explicit isolated native test opt-in required. See docs/native.md.');
process.env.NO_TOUCH_MODE = 'live'; process.env.NO_TOUCH_DATA_DIR = profile.dataDirectory;
await nativeProfile();
const root = profile.dataDirectory;
// Refuse to repeat after the approved move has already happened. Never reset samples automatically.
await lstat(join(root, 'files', 'budget-sample.csv'));
const before = await callNativeWorker({ operation: 'desktop-state' });
assert.notEqual(before.frontmostBundleId, 'com.apple.Notes', 'Use another presentation app as foreground during background validation.');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
try {
  async function request() {
    await page.goto('http://127.0.0.1:3000');
    await page.getByText('LOCAL NATIVE', { exact: true }).waitFor();
    await page.getByRole('button', { name: /2분 데모 예제/ }).click();
    await page.getByRole('button', { name: '요청 보내기' }).click();
    await page.getByRole('button', { name: '이 변경 승인' }).waitFor({ timeout: 60000 });
    await page.getByText(/실제 Mac · 메모 내용 재조회 확인/).waitFor();
    await page.getByText(/실제 Mac · 일정 재조회 확인/).waitFor();
    await page.getByText('budget-sample.csv', { exact: true }).waitFor();
    await lstat(join(root, 'files', 'budget-sample.csv'));
    await assert.rejects(lstat(join(root, 'files', 'Archive', 'budget-sample.csv')), { code: 'ENOENT' });
  }
  await request();
  await page.reload();
  await page.getByRole('button', { name: '이 변경 승인' }).waitFor({ timeout: 20000 });
  await mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/native-web-approval.png', fullPage: true });
  await page.getByRole('button', { name: '거절', exact: true }).click();
  await page.getByText('rejected', { exact: true }).waitFor({ timeout: 20000 });
  await lstat(join(root, 'files', 'budget-sample.csv'));
  await request();
  await page.getByRole('button', { name: '이 변경 승인' }).click();
  await page.getByText(/budget-sample.csv → Archive · 샘플/).waitFor({ timeout: 20000 });
  await lstat(join(root, 'files', 'Archive', 'budget-sample.csv'));
  await assert.rejects(lstat(join(root, 'files', 'budget-sample.csv')), { code: 'ENOENT' });
  await page.screenshot({ path: 'docs/evidence/native-web-completed.png', fullPage: true });
  const after = await callNativeWorker({ operation: 'desktop-state' });
  const focusUnchanged = before.frontmostBundleId === after.frontmostBundleId;
  const cursorUnchanged = before.cursorX === after.cursorX && before.cursorY === after.cursorY;
  assert.ok(focusUnchanged); assert.ok(cursorUnchanged); assert.deepEqual(errors, []);
  const report = { passed: true, date: '2026-11-18', platform: 'macOS 26 ARM64 / Korean UI', mode: 'live', model: 'offline fixed scenario (not NLP)',
    nativeMacOSE2E: true, notes: { transport: 'agent-desktop 1.3.1 / default headless', verification: 'UI content readback', dedicatedFolder: true, backgroundOperation: true },
    reminders: { transport: 'Apple EventKit', verification: 'separate-process committed due date, time zone and alarm readback', dedicatedList: true, dueAt: '2030-11-19T15:00:00+09:00' },
    finder: { observation: 'agent-desktop snapshot -i', open: 'NSWorkspace activates=false', mutation: 'scoped filesystem rename, source/destination plus Finder readback', isolatedSamplesOnly: true },
    approvalBeforeEffect: true, denialHasNoEffect: true, approvalSurvivesReload: true, explicitApprovalExecutes: true,
    focusUnchanged, cursorUnchanged, physicalInputUsed: false, userBrowserTouched: false, externalSharing: false, pageErrors: errors };
  await writeFile('docs/evidence/native-result.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: join(root, 'native-browser-failure.png'), fullPage: true });
  console.error((await page.locator('body').innerText()).slice(-10000)); throw error;
} finally { await browser.close(); }
