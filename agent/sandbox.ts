import { defineSandbox } from 'eve/sandbox';
import { JustBashSandbox } from 'eve/sandbox/just-bash';
// Framework workspace only. No shell/file capability is exposed to the model.
// This is not the native desktop or a macOS VM.
export const environment = JustBashSandbox.environment({ autoInstall: false });
export default defineSandbox(() => environment.open());
