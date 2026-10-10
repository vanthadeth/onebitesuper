import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bvcp_[A-Za-z0-9]{30,}/,/\bsb_secret_[A-Za-z0-9_-]{20,}/,/\bgh[pousr]_[A-Za-z0-9]{30,}/,/\bgithub_pat_[A-Za-z0-9_]{40,}/];
function suspect(text){if(patterns.some(p=>p.test(text)))return true;for(const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(match[1],'base64url').toString()).role==='service_role')return true;}catch{}}return false;}
const hits=new Set();const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const path of paths){try{const data=readFileSync(path);if(!data.includes(0)&&suspect(data.toString()))hits.add(path);}catch{}}
if(process.argv.includes('--history')){
 const objects=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8',maxBuffer:64*1024*1024}).trim().split('\n').filter(Boolean);
 for(const entry of objects){const [id,...path]=entry.split(' ');const type=execFileSync('git',['cat-file','-t',id],{encoding:'utf8'}).trim();if(type!=='blob')continue;const size=Number(execFileSync('git',['cat-file','-s',id],{encoding:'utf8'}));if(size>5*1024*1024)continue;const data=execFileSync('git',['cat-file','blob',id],{maxBuffer:6*1024*1024});if(!data.includes(0)&&suspect(data.toString()))hits.add(`history:${path.join(' ')||id}`);}
}
if(hits.size){console.error('Potential secrets found (values withheld):\n'+[...hits].join('\n'));process.exit(1);}
console.log('Secret-pattern scan passed'+(process.argv.includes('--history')?' including git history.':'.'));
