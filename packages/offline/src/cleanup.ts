const oldKeys=['onebite-admin-access-preview-v1','onebite-admin-preview-v1','onebite-pos-preview-v1'];
export function cleanSampleData(){for(const key of oldKeys){try{localStorage.removeItem(key);}catch{}}try{sessionStorage.removeItem('onebite-pos-demo');}catch{}}
