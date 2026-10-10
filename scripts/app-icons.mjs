import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

// Preserve the supplied logo paths. Only the module palette and badge vary.
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'resources/app-icons');
const background='#FFFDF8';
const definitions=[
 {app:'pos',name:'POS',color:'#F57921'},
 {app:'admin',name:'Admin',color:'#282A2E',badge:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/>'},
 {app:'inventory',name:'Inventory',color:'#3F6B52',badge:'<path d="m12 3 9 5v10l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v10M7.5 5.5l9 5"/>'},
 {app:'attendance',name:'Attendance',color:'#456B8B',badge:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'},
];
const source=await readFile(resolve(root,'resources/brand/one-bite-icon-orange.svg'),'utf8');
const artwork=source.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title[^>]*>.*?<\/title>/gs,'');
await mkdir(output,{recursive:true});
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 for(const {app,name,color,badge} of definitions){
  // All colored artwork fits the central 80% safe circle for launcher masks.
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="title"><title id="title">OneBite ${name}</title><rect width="512" height="512" fill="${background}"/><g transform="translate(91 100) scale(2.1710526316)">${artwork.replaceAll('#F57921',color)}</g>${badge?`<circle cx="360" cy="360" r="52" fill="${color}" stroke="${background}" stroke-width="8"/><g transform="translate(330 330) scale(2.5)" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${badge}</g>`:''}</svg>\n`;
  await writeFile(resolve(output,`${app}.svg`),svg);
  for(const size of [180,192,512]){
   await page.setViewportSize({width:size,height:size});
   await page.setContent(`<body style="margin:0"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);
   await page.locator('img').evaluate(image=>image.decode());
   await page.screenshot({path:resolve(output,`${app}-${size}.png`)});
  }
  if(app!=='attendance'){
   const publicDir=resolve(root,`apps/${app}/public`);
   for(const [from,to] of [[`${app}.svg`,'icon.svg'],[`${app}-180.png`,'apple-touch-icon.png'],[`${app}-192.png`,'icon-192.png'],[`${app}-512.png`,'icon-512.png']])await copyFile(resolve(output,from),resolve(publicDir,to));
  }
 }
 await writeFile(resolve(output,'palette.json'),JSON.stringify({background,apps:definitions.map(({app,color})=>({app,color}))},null,2)+'\n');
}finally{await browser.close();}
