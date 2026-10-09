export type AppSettings = {
 geofenceRadiusM:number; gpsAccuracyM:number;
 defaultLanguage:'km'|'en'; defaultTheme:'light'|'dark';
 defaultCurrency:'KHR'|'USD'; defaultPaymentMethod:'cash'|'qr'; exchangeRate:number;
};
export const defaultAppSettings:AppSettings={geofenceRadiusM:100,gpsAccuracyM:50,defaultLanguage:'km',defaultTheme:'light',defaultCurrency:'KHR',defaultPaymentMethod:'cash',exchangeRate:4000};
export function validAppSettings(value:unknown):value is AppSettings {
 if(!value||typeof value!=='object')return false;const s=value as AppSettings;
 return Object.keys(s).length===7&&Number.isInteger(s.geofenceRadiusM)&&s.geofenceRadiusM>=1&&s.geofenceRadiusM<=10000&&Number.isInteger(s.gpsAccuracyM)&&s.gpsAccuracyM>=1&&s.gpsAccuracyM<=10000&&['km','en'].includes(s.defaultLanguage)&&['light','dark'].includes(s.defaultTheme)&&['KHR','USD'].includes(s.defaultCurrency)&&['cash','qr'].includes(s.defaultPaymentMethod)&&Number.isInteger(s.exchangeRate)&&s.exchangeRate>=1&&s.exchangeRate<=1000000;
}
export function appSettingsOrDefault(value:unknown):AppSettings {return {...(validAppSettings(value)?value:defaultAppSettings)};}
