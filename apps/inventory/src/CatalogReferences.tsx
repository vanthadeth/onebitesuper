import {useState} from 'react';
import {Check,Plus,Pencil,Tags,Ruler} from 'lucide-react';
import {AppDialog,SelectField,SwitchField,InlineError,ActiveStatusBadge,EmptyState,DirectoryTools,DirectorySearch,DirectoryStatusFilter,type DirectoryStatus,useLanguage} from '@onebite/ui';
import {newCatalogReference,validateCatalogReference,type CatalogReference,type ReferenceKind,type ReferenceOperation} from '@onebite/core/inventory';
export function referenceLabel(reference:CatalogReference,t:(km:string,en:string)=>string){
 const defaults:Record<string,[string,string]>={ingredient:['គ្រឿងផ្សំ','Ingredient'],packaging:['សម្ភារៈវេចខ្ចប់','Packaging'],pcs:['ចំនួន','Pieces'],g:['ក្រាម','Grams'],ml:['មីលីលីត្រ','Millilitres'],box:['ប្រអប់','Box'],main:['មុខម្ហូបចម្បង','Main'],side:['មុខម្ហូបបន្ថែម','Side'],ready_to_cook:['រួចរាល់សម្រាប់ចម្អិន','Ready to cook'],drinks:['ភេសជ្ជៈ','Drinks']};
 const label=defaults[reference.value];return label&&reference.name===label[1]?t(...label):reference.name;
}
export function ActiveConfirmation({active,onConfirm,onClose}:{active:boolean;onConfirm:()=>void;onClose:()=>void}){
 const {t}=useLanguage();
 return <AppDialog title={active?t('បើកដំណើរការ?','Activate this record?'):t('បិទដំណើរការ?','Deactivate this record?')} onClose={onClose} footer={<><button type="button" className="d-btn d-btn-ghost" onClick={onClose}>{t('បោះបង់','Cancel')}</button><button type="button" className={`d-btn ${active?'d-btn-primary':'d-btn-error'}`} onClick={onConfirm}>{t('បញ្ជាក់','Confirm')}</button></>}><p>{t('ស្ថានភាពថ្មីនឹងត្រូវបានអនុវត្តពេលរក្សាទុក។','The new status will take effect when you save.')}</p></AppDialog>;
}
export function ReferenceEditor({reference,references,onClose,onSave}:{reference:CatalogReference;references:CatalogReference[];onClose:()=>void;onSave:(reference:CatalogReference,confirmed:boolean)=>Promise<void>}){
 const {t}=useLanguage(),[draft,setDraft]=useState(reference),[confirm,setConfirm]=useState<boolean|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const creating=reference.revision===0,unit=reference.kind==='unit';
 return <><AppDialog title={creating?unit?t('ឯកតាថ្មី','New base UOM'):t('ប្រភេទថ្មី','New category'):unit?t('កែប្រែឯកតា','Edit base UOM'):t('កែប្រែប្រភេទ','Edit category')} onClose={()=>{if(!busy)onClose();}} footer={<button type="submit" form="reference-editor" className="d-btn d-btn-primary" disabled={busy}>{creating?<Plus size={18}/>:<Check size={18}/>} {creating?t('បង្កើត','Create'):t('រក្សាទុក','Save changes')}</button>}>
 <form id="reference-editor" className="access-form" onSubmit={async event=>{event.preventDefault();setError('');setBusy(true);try{
  const normalized=validateCatalogReference({...draft,value:creating&&!unit?draft.name:draft.value});
  if(references.some(other=>other.id!==draft.id&&other.kind===draft.kind&&(other.name.trim().toLocaleLowerCase()===normalized.name.toLocaleLowerCase()||other.value.toLocaleLowerCase()===normalized.value.toLocaleLowerCase())))throw new Error('duplicate_reference');
  await onSave(normalized,draft.active!==reference.active);
 }catch(e){setError(e instanceof Error&&e.message==='duplicate_reference'?t('ឈ្មោះ ឬឯកតានេះមានរួចហើយ។','This name or symbol already exists.'):t('មិនអាចរក្សាទុក។ ពិនិត្យព័ត៌មាន ហើយព្យាយាមម្ដងទៀត។','Could not save. Check the fields and retry.'));}finally{setBusy(false);}}}>
 <label>{t('ឈ្មោះ','Name')}<input className="d-input" required maxLength={60} disabled={busy} value={draft.name} onChange={event=>setDraft(old=>({...old,name:event.target.value}))}/></label>
 {unit&&<label>{t('និមិត្តសញ្ញាឯកតា','Unit symbol')}<input aria-label={t("និមិត្តសញ្ញាឯកតា","Unit symbol")} className="d-input" required maxLength={30} value={draft.value} disabled={!creating||busy} onChange={event=>setDraft(old=>({...old,value:event.target.value}))}/><small>{t('និមិត្តសញ្ញាត្រូវបានចាក់សោបន្ទាប់ពីបង្កើត។','The symbol is locked after creation. Custom units allow up to three decimal places.')}</small></label>}
 {!creating&&<label className="inventory-toggle"><span>{t('ដំណើរការ','Active')}</span><SwitchField aria-label={t('ដំណើរការ','Active')} checked={draft.active} disabled={busy} onChange={event=>setConfirm(event.target.checked)}/></label>}
 <InlineError message={error}/></form></AppDialog>
 {confirm!==null&&<ActiveConfirmation active={confirm} onClose={()=>setConfirm(null)} onConfirm={()=>{setDraft(old=>({...old,active:confirm}));setConfirm(null);}}/>}</>;
}
export function ReferenceSelect({kind,value,references,disabled,onChange,onCreate,onManage}:{kind:ReferenceKind;value:string;references:CatalogReference[];disabled?:boolean;onChange:(value:string)=>void;onCreate:(kind:ReferenceKind)=>void;onManage:(kind:ReferenceKind)=>void}){
 const {t}=useLanguage(),unit=kind==='unit',options=references.filter(reference=>reference.kind===kind&&(reference.active||reference.value===value)).sort((a,b)=>a.name.localeCompare(b.name));
 return <SelectField aria-label={unit?t('ឯកតាមូលដ្ឋាន','Base unit'):t('ប្រភេទ','Category')} placeholder={t('ជ្រើសរើស','Select')} value={value} disabled={disabled} onChange={event=>{const selected=event.target.value;if(selected==='__create__')onCreate(kind);else if(selected==='__manage__')onManage(kind);else onChange(selected);}}>
 {!unit&&<option value="">{t('មិនមានប្រភេទ','No category')}</option>}
 {value&&!options.some(option=>option.value===value)&&<option value={value}>{value}</option>}
 {options.map(option=><option key={option.id} value={option.value} disabled={!option.active&&option.value!==value}>{unit?`${referenceLabel(option,t)} (${option.value})`:referenceLabel(option,t)}</option>)}
 <option value="__create__">{unit?t('+ ឯកតាថ្មី','+ Add new base UOM'):t('+ ប្រភេទថ្មី','+ Add new category')}</option>
 <option value="__manage__">{unit?t('គ្រប់គ្រងឯកតា','Manage base UOMs'):t('គ្រប់គ្រងប្រភេទ','Manage categories')}</option>
 </SelectField>;
}
export function ReferenceManager({kind,references,pending,onClose,onEdit}:{kind:ReferenceKind;references:CatalogReference[];pending:ReferenceOperation[];onClose:()=>void;onEdit:(reference:CatalogReference)=>void}){
 const {t}=useLanguage(),unit=kind==='unit',[search,setSearch]=useState(''),[status,setStatus]=useState<DirectoryStatus>('active');
 const all=references.filter(reference=>reference.kind===kind),query=search.normalize('NFKC').trim().toLocaleLowerCase();
 const rows=all.filter(reference=>(status==='all'||reference.active===(status==='active'))&&`${referenceLabel(reference,t)} ${reference.name} ${reference.value}`.normalize('NFKC').toLocaleLowerCase().includes(query)).sort((a,b)=>a.name.localeCompare(b.name));
 return <AppDialog title={unit?t('ឯកតាមូលដ្ឋាន','Base UOMs'):kind==='material_category'?t('ប្រភេទសម្ភារៈ','Material categories'):t('ប្រភេទមុខទំនិញ','Item categories')} onClose={onClose} footer={<button className="d-btn d-btn-primary" onClick={()=>onEdit(newCatalogReference(kind))}><Plus size={18}/>{unit?t('ឯកតាថ្មី','New base UOM'):t('ប្រភេទថ្មី','New category')}</button>}>
 <DirectoryTools><DirectorySearch label={unit?t('ស្វែងរកឯកតា','Search base UOMs'):t('ស្វែងរកប្រភេទ','Search categories')} placeholder={t('ស្វែងរកឈ្មោះ…','Search name…')} value={search} onChange={setSearch}/><DirectoryStatusFilter label={t('ស្ថានភាព','Status')} value={status} onChange={setStatus}/></DirectoryTools>
 {rows.length?<div className="inventory-reference-list">{rows.map(reference=><button key={reference.id} className="inventory-reference-row" onClick={()=>onEdit(reference)} disabled={pending.some(operation=>operation.reference.id===reference.id)}>{unit?<Ruler size={22}/>:<Tags size={22}/>}<span><strong>{referenceLabel(reference,t)}</strong>{unit&&<small>{reference.value}</small>}{pending.some(operation=>operation.reference.id===reference.id)&&<small>{t('រង់ចាំសមកាលកម្ម','Pending sync')}</small>}</span><ActiveStatusBadge active={reference.active}/><Pencil size={16}/></button>)}</div>:all.length?<EmptyState icon={<Tags size={28}/>} title={t('មិនមានលទ្ធផល','No matching records')} body={t('សាកល្បងស្វែងរក ឬជ្រើសតម្រងផ្សេង។','Try another search or filter.')} action={{label:t('សម្អាតតម្រង','Clear filters'),onClick:()=>{setSearch('');setStatus('all');}}}/>:<EmptyState icon={<Tags size={28}/>} title={t('មិនទាន់មានប្រភេទ','No categories yet')} body={t('បន្ថែមប្រភេទដំបូងរបស់អ្នក។','Add your first category.')}/>}
 </AppDialog>;
}
