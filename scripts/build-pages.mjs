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
await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="km"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f57921"><title>OneBite</title><style>body{margin:0;background:#faf9f6;color:#1a1a1a;font:17px system-ui,sans-serif}main{max-width:540px;margin:10vh auto;padding:28px}h1{font-size:42px;color:#a94800}p{line-height:1.8;color:#666}a{display:block;padding:22px;margin:16px 0;border:1px solid #e7ddd4;background:white;border-radius:18px;color:#a94800;text-decoration:none;font-weight:650}small{display:block;margin-top:10px;color:#666;font-weight:400}</style><main><h1>OneBite</h1><p>កម្មវិធី OneBite · Business apps</p><a href="pos/">OneBite POS<small>ការបញ្ជាទិញ និងវេន · Orders and shifts</small></a><a href="admin/">OneBite Admin<small>អ្នកប្រើ តួនាទី និងសិទ្ធិ · Users, roles and permissions</small></a><a href="inventory/">OneBite Inventory<small>សម្ភារៈ និងមុខទំនិញ · Materials and sellable items</small></a><p>Supabase · ទិន្នន័យអាជីវកម្ម · Business data</p></main></html>`);
console.log(`GitHub Pages output: dist/pages; app base: ${base}`);
