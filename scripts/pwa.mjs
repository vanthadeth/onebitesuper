import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const app = process.argv[2];
if (!["pos", "admin"].includes(app)) throw new Error("Expected pos or admin");
const dir = resolve(import.meta.dirname, `../apps/${app}/dist`);
async function files(path, prefix = "") {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === "sw.js") continue;
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      result.push(...(await files(`${path}/${entry.name}`, `${name}/`)));
    else result.push(name);
  }
  return result;
}
const paths = await files(dir);
const hash = createHash("sha256");
for (const path of paths.sort()) hash.update(await readFile(`${dir}/${path}`));
const cache = `onebite-${app}-${hash.digest("hex").slice(0, 12)}`;
await writeFile(
  `${dir}/sw.js`,
  `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(paths.map((path) => `/${path}`))};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('onebite-${app}-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreVary:true}))||(event.request.mode==='navigate'?cache.match('/index.html',{ignoreVary:true}):Response.error()))));});
`,
);
