import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {appSettingsOrDefault,validAppSettings,type AppSettings} from '@onebite/core/app-settings';
import {money as khrMoney} from '@onebite/core';
import config from '../../../config/supabase.public.json';
const key='onebite-app-settings-v1';
function cached(){try{return appSettingsOrDefault(JSON.parse(localStorage.getItem(key)||'null'));}catch{return appSettingsOrDefault(null);}}
const Context=createContext<{settings:AppSettings;applySettings:(settings:AppSettings)=>void}>({settings:appSettingsOrDefault(null),applySettings:()=>{}});
export function AppSettingsProvider({children}:{children:ReactNode}){
 const [settings,setSettings]=useState(cached);
 useEffect(()=>{const choice=localStorage.getItem("onebite-theme");document.documentElement.dataset.theme=choice==='light'||choice==='dark'?choice:settings.defaultTheme;},[settings]);
 function applySettings(value:AppSettings){if(!validAppSettings(value))return;setSettings({...value});try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
 useEffect(()=>{let active=true;let controller:AbortController|undefined;
  async function refresh(){if(!navigator.onLine)return;controller?.abort();controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),10000);try{const url=(import.meta.env.VITE_SUPABASE_URL as string|undefined)||config.url,publishableKey=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined)||config.publishableKey;const response=await fetch(`${url}/functions/v1/admin-access`,{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap.status',payload:{}}),signal:controller.signal,cache:'no-store'});if(response.ok){const data=await response.json();if(active&&validAppSettings(data.appSettings))applySettings(data.appSettings);}}catch{}finally{clearTimeout(timer);}}
  void refresh();window.addEventListener('online',refresh);window.addEventListener('focus',refresh);return()=>{active=false;controller?.abort();window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);};
 },[]);
 return <Context.Provider value={{settings,applySettings}}>{children}</Context.Provider>;
}
export function useAppSettings(){return useContext(Context);}
export function usePrice(){const {settings}=useAppSettings();return (value:number)=>settings.defaultCurrency==='USD'?`$${(value/settings.exchangeRate).toFixed(2)}`:khrMoney(value);}
