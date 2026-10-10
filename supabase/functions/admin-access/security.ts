import jpeg from 'jpeg-js';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function encodeBase32(bytes:Uint8Array):string {
 let bits=0,value=0,result='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)result+=alphabet[(value<<(5-bits))&31];return result;
}
export async function totp(secret:string,counter:number):Promise<string>{
 if(!/^[A-Z2-7]+$/.test(secret)||!Number.isSafeInteger(counter)||counter<0)throw new Error('Invalid TOTP input');
 let bits=0,value=0;const decoded:number[]=[];for(const character of secret){value=(value<<5)|alphabet.indexOf(character);bits+=5;if(bits>=8){decoded.push((value>>>(bits-8))&255);bits-=8;}}
 const data=new Uint8Array(8);new DataView(data.buffer).setBigUint64(0,BigInt(counter));
 const key=await crypto.subtle.importKey('raw',new Uint8Array(decoded),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,data));const offset=digest.at(-1)!&15;
 const binary=((digest[offset]&127)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3];
 return String(binary%1_000_000).padStart(6,'0');
}
export async function verifyTotp(secret:string,code:string,time=Date.now()):Promise<number|null>{
 if(!/^\d{6}$/.test(code))return null;const current=Math.floor(time/30000);
 for(const counter of [current,current-1,current+1])if(counter>=0&&await totp(secret,counter)===code)return counter;
 return null;
}
export async function boundedBody(request:Request,maxBytes=1_000_000):Promise<string>{
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new Error('payload_too_large');
 if(!request.body)return '';const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('payload_too_large');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function sanitizeJpeg(bytes:Uint8Array):Uint8Array{
 if(bytes.length>750000)throw new Error('invalid_photo');
 const image=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxResolutionInMP:2,maxMemoryUsageInMB:32,tolerantDecoding:false});
 if(!image.width||!image.height||image.width>1280||image.height>1280||image.width*image.height>1_638_400)throw new Error('invalid_photo');
 const cleaned=jpeg.encode({data:image.data,width:image.width,height:image.height},80).data;
 if(cleaned.length>750000)throw new Error('invalid_photo');return new Uint8Array(cleaned);
}
