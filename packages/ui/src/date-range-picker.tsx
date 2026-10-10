import { useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react';
import { DateLib, DayPicker, type DateRange } from 'react-day-picker';
import { enGB, km } from 'react-day-picker/locale';
import { AppDialog, SelectField } from './controls';
import { useLanguage } from './shared';
import 'react-day-picker/style.css';
import './date-range-picker.css';

export type DateRangeValue = { start: string; end: string };
const calendarComponents = { MonthCaption: () => <></> };
function dateFromKey(key: string) { const [year, month, day] = key.split('-').map(Number); return new Date(year, month - 1, day, 12); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function cambodiaToday() { return dateFromKey(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())); }
function shiftDay(date: Date, days: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12); }

export function DateRangePicker({ value, onChange }: { value: DateRangeValue; onChange: (range: DateRangeValue) => void }) {
 const { t, lang } = useLanguage();
 const [open, setOpen] = useState(false);
 const [draft, setDraft] = useState<DateRange>();
 const [month, setMonth] = useState(cambodiaToday);
 const today = cambodiaToday();
 const dateLib = new DateLib({ locale: lang === 'km' ? km : enGB });
 const format = (key: string) => dateLib.format(dateFromKey(key), 'd MMM yyyy');
 const summary = value.start ? value.start === value.end ? format(value.start) : `${format(value.start)} – ${format(value.end || value.start)}` : t('គ្រប់កាលបរិច្ឆេទ', 'All dates');
 const show = () => { setDraft(value.start ? { from: dateFromKey(value.start), to: dateFromKey(value.end || value.start) } : undefined); setMonth(value.start ? dateFromKey(value.start) : today); setOpen(true); };
 const apply = () => { onChange(draft?.from ? { start: dateKey(draft.from), end: dateKey(draft.to || draft.from) } : { start: '', end: '' }); setOpen(false); };
 const presets = [
  { label: t('ថ្ងៃនេះ', 'Today'), days: 1 },
  { label: t('ម្សិលមិញ', 'Yesterday'), days: 0 },
  { label: t('៧ ថ្ងៃចុងក្រោយ', 'Last 7 days'), days: 7 },
  { label: t('៣០ ថ្ងៃចុងក្រោយ', 'Last 30 days'), days: 30 },
 ];
 const preset = (days: number) => { const end = days === 0 ? shiftDay(today, -1) : today; const from = days > 1 ? shiftDay(today, 1 - days) : end; setDraft({ from, to: end }); setMonth(from); };
 const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1, 12);
 const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12);
 return <>
  <div className="ob-date-filter">
   <button type="button" className="ob-date-trigger" onClick={show} aria-haspopup="dialog" aria-expanded={open} aria-label={`${t('រយៈពេលកាលបរិច្ឆេទ', 'Date range')}: ${summary}`}>
    <span className="ob-date-symbol"><CalendarDays size={21}/></span><span className="ob-date-trigger-copy"><small>{t('រយៈពេលកាលបរិច្ឆេទ', 'Date range')}</small><strong>{summary}</strong></span><ChevronRight size={18}/>
   </button>
   {value.start && <button type="button" className="ob-date-clear" aria-label={t('កំណត់កាលបរិច្ឆេទឡើងវិញ', 'Clear dates')} onClick={() => onChange({ start: '', end: '' })}><X size={18}/></button>}
  </div>
  {open && <AppDialog title={t('ជ្រើសរើសរយៈពេល', 'Choose date range')} onClose={() => setOpen(false)} footer={<><button type="button" className="access-btn secondary d-btn" onClick={() => setOpen(false)}>{t('បោះបង់', 'Cancel')}</button><button type="button" className="access-btn d-btn d-btn-primary" onClick={apply}><Check size={18}/>{t('បង្ហាញប្រវត្តិ', 'Show logs')}</button></>}>
   <div className="ob-date-picker">
    <div className="ob-date-presets">{presets.map(({ label, days }) => <button type="button" key={days} onClick={() => preset(days)}>{label}</button>)}<button type="button" onClick={() => setDraft(undefined)} aria-pressed={!draft?.from}>{t('គ្រប់កាលបរិច្ឆេទ', 'All dates')}</button></div>
    <div className="ob-date-selection" aria-live="polite"><div><small>{t('ពីថ្ងៃ', 'From date')}</small><strong>{draft?.from ? format(dateKey(draft.from)) : '—'}</strong></div><span aria-hidden="true">→</span><div><small>{t('ដល់ថ្ងៃ', 'To date')}</small><strong>{draft?.to ? format(dateKey(draft.to)) : draft?.from ? format(dateKey(draft.from)) : '—'}</strong></div></div>
    <div className="ob-date-calendar-nav">
     <button type="button" className="ob-date-month-arrow" disabled={previousMonth.getFullYear() < 2000} aria-label={t('ខែមុន', 'Previous month')} onClick={() => setMonth(previousMonth)}><ChevronLeft size={18}/></button>
     <SelectField value={month.getMonth()} aria-label={t('ខែ', 'Month')} onChange={e => setMonth(new Date(month.getFullYear(), Number(e.target.value), 1, 12))}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index} disabled={month.getFullYear() === today.getFullYear() && index > today.getMonth()}>{dateLib.format(new Date(2026, index, 1), 'LLLL')}</option>)}</SelectField>
     <SelectField value={month.getFullYear()} aria-label={t('ឆ្នាំ', 'Year')} onChange={e => setMonth(new Date(Number(e.target.value), Number(e.target.value) === today.getFullYear() ? Math.min(month.getMonth(), today.getMonth()) : month.getMonth(), 1, 12))}>{Array.from({ length: today.getFullYear() - 1999 }, (_, index) => today.getFullYear() - index).map(year => <option key={year} value={year}>{year}</option>)}</SelectField>
     <button type="button" className="ob-date-month-arrow" disabled={dateKey(nextMonth) > dateKey(today)} aria-label={t('ខែក្រោយ', 'Next month')} onClick={() => setMonth(nextMonth)}><ChevronRight size={18}/></button>
    </div>
    <DayPicker className="ob-range-calendar" mode="range" selected={draft} onSelect={setDraft} month={month} onMonthChange={setMonth} locale={lang === 'km' ? km : enGB} weekStartsOn={1} hideNavigation components={calendarComponents} disabled={{ after: today }} startMonth={new Date(2000, 0, 1)} endMonth={today} showOutsideDays fixedWeeks />
    <p className="ob-date-hint"><Clock3 size={15}/>{t('កាលបរិច្ឆេទតាមម៉ោងកម្ពុជា។', 'Dates use Cambodia time.')}</p>
   </div>
  </AppDialog>}
 </>;
}
