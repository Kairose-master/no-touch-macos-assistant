import { mkdir, readFile, readdir, writeFile, utimes } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataRoot } from '../agent/lib/storage.ts';
export async function seed(root = dataRoot()) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const marker = join(root, '.no-touch-fixture');
  try { if (await readFile(marker, 'utf8') === 'no-touch-fixture-v1') return; throw new Error('Invalid fixture marker'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if ((await readdir(root)).length) throw new Error('Seed refuses a nonempty directory without its fixture marker.');
  await mkdir(join(root, 'files'), { mode: 0o700 });
  const samples = [['meeting-summary.txt', 'Sample meeting summary only.'], ['demo-brief.md', '# Sample\nNo private user content.'], ['budget-sample.csv', 'item,amount\ndemo,100\n']];
  for (const [index, [name, content]] of samples.entries()) {
    const path = join(root, 'files', name!);
    await writeFile(path, content!, { flag: 'wx', mode: 0o600 });
    const date = new Date(Date.UTC(2026, 10, 18, 0, index)); await utimes(path, date, date);
  }
  await writeFile(marker, 'no-touch-fixture-v1', { flag: 'wx', mode: 0o600 });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { await seed(); console.log('Isolated fixture prepared. Existing fixture content was not reset.'); }
