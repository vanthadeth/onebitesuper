import { spawnSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const app = process.env.ONEBITE_APP;
if (!['pos', 'admin'].includes(app)) {
  throw new Error('Set ONEBITE_APP to pos or admin in this Vercel project.');
}
const root = resolve(import.meta.dirname, '..');
const result = spawnSync('npm', ['run', 'build', '--workspace', `@onebite/${app}`], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const output = resolve(root, 'dist');
await rm(output, { recursive: true, force: true });
await cp(resolve(root, 'apps', app, 'dist'), output, { recursive: true });
console.log(`OneBite ${app} deployment output: dist/`);
