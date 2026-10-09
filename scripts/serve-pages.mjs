import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve(import.meta.dirname,'../dist/pages');
const repo=(process.env.GITHUB_REPOSITORY||'vanthadeth/onebitesuper').split('/').at(-1);
const base=repo.endsWith('.github.io')?'/':`/${repo}/`;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith(base)){res.writeHead(404);res.end();return;}
  let file=resolve(root,decodeURIComponent(url.pathname.slice(base.length))||'.');
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  if((await stat(file)).isDirectory()){
   if(!url.pathname.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'});res.end();return;}
   file=resolve(file,'index.html');
  }
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
}).listen(5185,'127.0.0.1',()=>console.log(`Pages preview: http://127.0.0.1:5185${base}`));
