import { EmptyState } from "./empty-state";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  X,
  Minus,
  Plus,
  ShoppingBag,
  LayoutDashboard,
  Globe2,
  ChevronDown,
  Check,
  Store,
} from "lucide-react";
import type { Language, Food } from "@onebite/core";
const Locale = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
}>({ lang: "km", setLang: () => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() =>
    localStorage.getItem("onebite-language") === "en" ? "en" : "km",
  );
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("onebite-language", lang);
  }, [lang]);
  return (
    <Locale.Provider value={{ lang, setLang }}>{children}</Locale.Provider>
  );
}
export function useLanguage() {
  const context = useContext(Locale);
  return {
    ...context,
    t: (km: string, en: string) => (context.lang === "km" ? km : en),
  };
}
export function haptic() {
  navigator.vibrate?.(12);
}
export function useLocalState<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initial();
    } catch {
      return initial();
    }
  });
  const current = useRef(value);
  const [storageError, setStorageError] = useState(false);
  function save(next: T | ((old: T) => T)) {
    const result =
      typeof next === "function"
        ? (next as (old: T) => T)(current.current)
        : next;
    try {
      localStorage.setItem(key, JSON.stringify(result));
      setStorageError(false);
    } catch {
      setStorageError(true);
      return false;
    }
    current.current = result;
    setValue(result);
    return true;
  }
  return [value, save, storageError] as const;
}
export { AppDialog as Modal } from "./controls";
export function Quantity({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="quantity">
      <button
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => {
          haptic();
          onChange(value - 1);
        }}
      >
        <Minus size={15} />
      </button>
      <strong>{value}</strong>
      <button
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => {
          haptic();
          onChange(value + 1);
        }}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="toggle-row"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className={`toggle ${checked ? "on" : ""}`}>
        <i />
      </span>
    </button>
  );
}
export function Empty(props: Parameters<typeof EmptyState>[0]) {
  return <EmptyState {...props} className={`empty ${props.className ?? ""}`} />;
}
export function Header({
  app,
  site,
  onSite,
  sites,
}: {
  app: "POS" | "Admin";
  site?: number;
  onSite?: (value: number) => void;
  sites?: string[];
}) {
  const { lang, setLang, t } = useLanguage();
  return (
    <header className="app-header">
      <a className="wordmark" href={import.meta.env.BASE_URL} aria-label={`OneBite ${app}`}>
        <span className="brand-icon">
          <ShoppingBag size={21} />
          <i />
        </span>
        <span>
          onebite<span className="brand-dot">.</span>
        </span>
        <span className="app-tag">{app}</span>
      </a>
      <div className="header-actions">
        {sites && onSite && (
          <label className="site-picker">
            <Store size={16} />
            <select
              aria-label={t("ទីតាំង", "Site")}
              value={site}
              onChange={(event) => onSite(Number(event.target.value))}
            >
              {sites.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        )}
        <button
          className="language-button"
          onClick={() => setLang(lang === "km" ? "en" : "km")}
          aria-label={t("ប្ដូរទៅភាសាអង់គ្លេស", "Switch to Khmer")}
        >
          <Globe2 size={17} />
          <span>{lang === "km" ? "EN" : "ខ្មែរ"}</span>
        </button>
        <div
          className="avatar"
          title={app === "POS" ? "Sokha · Cashier" : "Dara · Owner"}
        >
          {app === "POS" ? "S" : "D"}
        </div>
      </div>
    </header>
  );
}
export function DemoBanner() {
  const { t } = useLanguage();
  return (
    <div className="demo-banner">
      <span className="demo-dot" />
      {t("សាកល្បងជាមួយទិន្នន័យគំរូ", "Preview with sample data")}
      <span className="demo-description">
        {t("ការទូទាត់មិនមែនជាប្រតិបត្តិការពិតទេ", "Payments are simulated")}
      </span>
    </div>
  );
}
export function FoodArt({
  food,
  large = false,
}: {
  food: Food;
  large?: boolean;
}) {
  return (
    <div className={`food-art ${food} ${large ? "large" : ""}`}>
      <svg viewBox="0 0 220 142" aria-hidden="true">
        <ellipse cx="110" cy="117" rx="70" ry="10" fill="#513b2514" />
        {food === "tea" ? (
          <>
            <path d="M76 32h68l-8 84H84Z" fill="#de9b32" />
            <path d="M79 45h62l-6 67H85Z" fill="#eeb451" />
            <ellipse cx="110" cy="34" rx="37" ry="8" fill="#fbefdc" />
            <path d="m128 14-13 75" stroke="#738264" strokeWidth="7" />
            <path d="M76 32h68" stroke="#e6d6bd" strokeWidth="4" />
            <circle cx="95" cy="71" r="16" fill="#f8d65a" />
            <circle cx="95" cy="71" r="12" fill="#ffeb97" />
            <path
              d="m95 59 0 24m-12-12h24m-20-8 17 17m0-17-17 17"
              stroke="#f8d65a"
              strokeWidth="1.5"
            />
            <rect
              x="120"
              y="56"
              width="12"
              height="14"
              rx="3"
              fill="#fff8"
              transform="rotate(15 126 63)"
            />
          </>
        ) : food === "frozen" ? (
          <>
            <path d="M66 25h90l5 92H61Z" fill="#cdded4" />
            <path d="M68 31h86" stroke="#6d927b" strokeWidth="5" />
            <rect x="75" y="49" width="71" height="50" rx="5" fill="#fffaf0" />
            <text
              x="110"
              y="64"
              textAnchor="middle"
              fontSize="8"
              fontWeight="800"
              fill="#486251"
            >
              ONEBITE
            </text>
            <path d="M91 86q19-32 39 0q-19 11-39 0" fill="#e9bb76" />
            <path
              d="m96 84 5-11m5 9 4-12m5 12 1-10m5 11-3-10"
              stroke="#d4944c"
              strokeWidth="2"
            />
            <path d="M66 106h91" stroke="#8db6a0" strokeWidth="3" />
          </>
        ) : (
          <>
            <path d="m42 70 23-34h93l23 34-14 44H57Z" fill="#e7cda8" />
            <path d="M42 70h139l-14 44H57Z" fill="#f1d9b7" />
            <path d="m42 70 23-34 8 34m108 0-23-34-8 34" fill="#f8e7cd" />
            {food === "dumplings"
              ? [
                  [78, 67, -14],
                  [112, 62, 6],
                  [145, 68, 12],
                  [92, 86, -7],
                  [129, 86, 10],
                ].map(([x, y, r], i) => (
                  <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
                    <path
                      d="M-22 6Q0-30 22 6Q0 22-22 6"
                      fill="#dea659"
                      stroke="#c98b41"
                      strokeWidth="1.5"
                    />
                    <path
                      d="m-16 5 6-13m0 12 7-16m-1 15 4-16m3 16 0-13m6 16-4-13"
                      stroke="#f2c983"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </g>
                ))
              : [
                  [76, 64],
                  [103, 59],
                  [132, 62],
                  [153, 74],
                  [89, 83],
                  [119, 84],
                  [145, 92],
                ].map(([x, y], i) => (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r="13"
                      fill="#b97945"
                      stroke="#9e623a"
                      strokeWidth="1.5"
                    />
                    <ellipse
                      cx={x - 3}
                      cy={y - 4}
                      rx="5"
                      ry="3"
                      fill="#d99c61"
                    />
                  </g>
                ))}
            <path
              d="m70 101 10-3m47 3 9-3m-30-23 7-3"
              stroke="#78935c"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}
export function Status({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "orange" | "gray";
}) {
  return (
    <span className={`status ${tone}`}>
      <span />
      {children}
    </span>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="success-message">
      <Check size={18} />
      {children}
    </div>
  );
}
export { LayoutDashboard };
