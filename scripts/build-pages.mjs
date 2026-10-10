import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const repository = (process.env.GITHUB_REPOSITORY || 'vanthadeth/onebitesuper').split('/').at(-1);
if (!/^[a-zA-Z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository name');
const base = repository.endsWith('.github.io') ? '/' : `/${repository}/`;
const output = resolve(root, 'dist/pages');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const app of ['pos', 'admin', 'inventory']) {
  const result = spawnSync('npm', ['run', 'build', '--workspace', `@onebite/${app}`], {
    cwd: root, stdio: 'inherit', env: { ...process.env, ONEBITE_BASE_PATH: `${base}${app}/` },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  await cp(resolve(root, `apps/${app}/dist`), resolve(output, app), { recursive: true });
}
await writeFile(resolve(output, '.nojekyll'), '');
await cp(resolve(root, 'landing'), output, { recursive: true });
await mkdir(resolve(output, 'assets'), { recursive: true });
for (const app of ['pos', 'admin', 'inventory', 'attendance']) {
  await cp(resolve(root, `resources/app-icons/${app}.svg`), resolve(output, `assets/${app}.svg`));
}
await cp(resolve(root, 'resources/brand/one-bite-wordmark-black.svg'), resolve(output, 'assets/wordmark.svg'));
await cp(resolve(root, 'resources/fonts/google-sans/GoogleSans-KhmerLatin.ttf'), resolve(output, 'assets/google-sans.ttf'));
console.log(`GitHub Pages output: dist/pages; app base: ${base}`);
