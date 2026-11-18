import { callNativeWorker } from '../agent/lib/native-worker.ts';
// Operator-only, explicit invocation. Never exposed as a model capability or called by live.
console.log('Requesting macOS full Reminders access for NoTouch Local Worker. This OS permission covers all lists; runtime code is restricted to the configured NoTouch list.');
const result = await callNativeWorker({ operation: 'request-reminders' });
if (!result.granted) throw new Error('REMINDERS_ACCESS_DENIED');
console.log('Reminders permission granted.');
