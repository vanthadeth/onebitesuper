import config from '../../../config/supabase.public.json';
import { accessApi, ApiError } from './access-api';

export function sitePhotoUrl(path?:string|null):string|undefined {
 if(!path)return undefined;
 if(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(path)&&path.length<=1_000_000)return path;
 if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(path))return undefined;
 const url=(import.meta.env.VITE_SUPABASE_URL as string|undefined)||config.url;
 return `${url}/storage/v1/object/public/site-photos/${path}`;
}
export async function prepareSitePhoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw new ApiError('invalid_photo',400);
 let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new ApiError('invalid_photo',400);}
 try{
  const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new ApiError('invalid_photo',400);
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let data=canvas.toDataURL('image/jpeg',.85);if(data.length>950_000)data=canvas.toDataURL('image/jpeg',.6);
  if(data.length>950_000)throw new ApiError('invalid_photo',400);
  return data;
 }finally{bitmap.close();}
}
export async function uploadSitePhoto(file:File,session:string):Promise<string>{
 const photo=await prepareSitePhoto(file);
 const reply=await accessApi('site.photo.upload',{image:photo.split(',')[1]},session);
 if(!reply.photoPath)throw new ApiError('photo_upload_failed',502);
 return reply.photoPath;
}
