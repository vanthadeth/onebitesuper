import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const app = process.argv[2];
if (!["pos", "admin", "inventory"].includes(app)) throw new Error("Expected pos or admin");
const base = process.env.ONEBITE_BASE_PATH || "/";
if (!/^\/(?:[a-zA-Z0-9_.-]+\/)*$/.test(base)) throw new Error("Invalid app base path");
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
const manifestPath = resolve(dir, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.id = `${base}onebite-${app}`;
manifest.start_url = base;
manifest.scope = base;
manifest.icons = manifest.icons.map(icon => ({ ...icon, src: `${base}${icon.src.split("/").at(-1)}` }));
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
const paths = await files(dir);
const hash = createHash("sha256");
for (const path of paths.sort()) hash.update(await readFile(`${dir}/${path}`));
const prefix = `onebite-${app}-${createHash("sha256").update(base).digest("hex").slice(0,8)}-`;
const cache = `${prefix}${hash.digest("hex").slice(0, 12)}`;
await writeFile(
  `${dir}/sw.js`,
  `const CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(paths.map((path) => `${base}${path}`))};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(${JSON.stringify(prefix)})&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||!new URL(event.request.url).pathname.startsWith(${JSON.stringify(base)}))return;event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(async cache=>(await cache.match(event.request,{ignoreVary:true}))||(event.request.mode==='navigate'?cache.match(${JSON.stringify(`${base}index.html`)},{ignoreVary:true}):Response.error()))));});
`,
);
