import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Store,
  Users,
  UtensilsCrossed,
  Gift,
  Settings2,
  Plus,
  ChevronRight,
  TrendingUp,
  Banknote,
  ArrowUpRight,
  Search,
  MoreHorizontal,
  Check,
  ShieldCheck,
  MapPin,
  Pencil,
  Smartphone,
  CalendarDays,
  Package,
} from "lucide-react";
import {
  type Config,
  type Product,
  type Sauce,
  type Group,
  money,
  seedConfig,
  siteNames,
  sauceNames,
  id,
  cambodiaDay,
} from "@onebite/core";
import {
  Header,
  DemoBanner,
  useLanguage,
  useLocalState,
  FoodArt,
  Modal,
  Field,
  Toggle,
  Stat,
  Status,
  Empty,
} from "@onebite/ui";
type Person = {
  id: string;
  name: string;
  username: string;
  role: "Cashier" | "Supervisor" | "Owner";
  sites: number[];
  active: boolean;
};
type Site = { name: string; description: string; active: boolean };
type AdminState = {
  config: Config;
  prices: number[][];
  people: Person[];
  sites: Site[];
};
const seedPeople: Person[] = [
  {
    id: "owner",
    name: "Dara",
    username: "dara",
    role: "Owner",
    sites: [0, 1, 2],
    active: true,
  },
  {
    id: "supervisor",
    name: "Vannak",
    username: "vannak",
    role: "Supervisor",
    sites: [0, 1, 2],
    active: true,
  },
  {
    id: "sokha",
    name: "Sokha",
    username: "sokha",
    role: "Cashier",
    sites: [0],
    active: true,
  },
  {
    id: "srey",
    name: "Sreypov",
    username: "sreypov",
    role: "Cashier",
    sites: [0, 1],
    active: true,
  },
  {
    id: "chan",
    name: "Chantha",
    username: "chantha",
    role: "Cashier",
    sites: [1, 2],
    active: true,
  },
  {
    id: "pisey",
    name: "Pisey",
    username: "pisey",
    role: "Cashier",
    sites: [2, 0],
    active: true,
  },
];
const initial = (): AdminState => ({
  config: structuredClone(seedConfig),
  prices: siteNames.map(() =>
    seedConfig.products.map((product) => product.price),
  ),
  people: seedPeople,
  sites: siteNames.map((name, index) => ({
    name,
    description: ["Along the river", "Neighborhood cart", "Street-side cart"][
      index
    ],
    active: true,
  })),
});
type Tab = "overview" | "sites" | "team" | "menu" | "rules" | "settings";
const number = (value: string) => Math.max(0, Math.floor(Number(value) || 0));

export function App() {
  const { t, lang } = useLanguage();
  const [state, setState, storageError] = useLocalState<AdminState>(
    "onebite-admin-preview-v1",
    initial,
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [editSite, setEditSite] = useState<number | null>(null);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  function saved() {
    setToast(t("បានរក្សាទុកទិន្នន័យសាកល្បង", "Sample configuration saved"));
  }
  const navigation = [
    {
      id: "overview",
      label: t("ទិដ្ឋភាពទូទៅ", "Overview"),
      icon: LayoutDashboard,
    },
    { id: "sites", label: t("ទីតាំង", "Sites"), icon: Store },
    { id: "team", label: t("ក្រុមការងារ", "Team"), icon: Users },
    {
      id: "menu",
      label: t("មុខទំនិញ", "Menu & prices"),
      icon: UtensilsCrossed,
    },
    {
      id: "rules",
      label: t("ការបញ្ចុះតម្លៃ", "Discounts & free items"),
      icon: Gift,
    },
    { id: "settings", label: t("ការកំណត់", "Settings"), icon: Settings2 },
  ] as const;
  const headings: Record<Tab, [string, string, string, string]> = {
    overview: [
      "អាជីវកម្មរបស់អ្នក",
      "YOUR BUSINESS",
      "គ្រប់ទីតាំង ក្នុងកន្លែងតែមួយ",
      "Every site. One clear view.",
    ],
    sites: [
      "ទីតាំង ONEBITE",
      "ONEBITE LOCATIONS",
      "ទីតាំងរបស់អ្នក",
      "Your neighborhood carts.",
    ],
    team: [
      "មនុស្សនៅពីក្រោយ ONEBITE",
      "THE PEOPLE BEHIND ONEBITE",
      "ក្រុមការងាររបស់អ្នក",
      "Good people. Great bites.",
    ],
    menu: [
      "បញ្ជីមុខទំនិញ",
      "YOUR CATALOG",
      "មុខទំនិញ និងតម្លៃ",
      "The menu, your way.",
    ],
    rules: [
      "ច្បាប់អាជីវកម្ម",
      "BUSINESS RULES",
      "បញ្ចុះតម្លៃ និងឥតគិតថ្លៃ",
      "A little generosity, with clear limits.",
    ],
    settings: [
      "ONEBITE ADMIN",
      "ONEBITE ADMIN",
      "ការកំណត់អាជីវកម្ម",
      "Make it work for OneBite.",
    ],
  };
  const current = headings[tab];
  return (
    <div className="app admin-app">
      <Header app="Admin" />
      <DemoBanner />
      {storageError && (
        <div className="notice danger" role="alert">
          {t(
            "មិនអាចរក្សាទុកបាន",
            "Changes could not be saved. Storage is full.",
          )}
        </div>
      )}
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <div className="sidebar-label">{t("គ្រប់គ្រង", "WORKSPACE")}</div>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => {
                setTab(item.id);
                setSearch("");
              }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {tab === item.id && <span className="nav-dot" />}
            </button>
          ))}
          <div className="sidebar-footer">
            <div className="sidebar-label">
              {t("នាពេលខាងមុខ", "COMING LATER")}
            </div>
            <span>
              <CalendarDays size={17} />
              {t("វត្តមាន", "Attendance")}
            </span>
            <span>
              <Package size={17} />
              {t("ស្តុក", "Inventory")}
            </span>
            <div className="owner-card">
              <ShieldCheck size={21} />
              <div>
                <strong>Dara</strong>
                <small>{t("ម្ចាស់អាជីវកម្ម", "Business owner")}</small>
              </div>
            </div>
          </div>
        </aside>
        <main className="admin-main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{t(current[0], current[1])}</span>
              <h1>{t(current[2], current[3])}</h1>
              <p>
                {tab === "overview"
                  ? t(
                      "រូបភាពគំរូនៃប្រតិបត្តិការនៅទីតាំងទាំងបី",
                      "A sample view of operations across all three sites.",
                    )
                  : t(
                      "កែសម្រួលការកំណត់សាកល្បងសម្រាប់ OneBite",
                      "Manage your sample OneBite configuration.",
                    )}
              </p>
            </div>
            {tab === "overview" && (
              <span className="date-pill">
                <CalendarDays size={15} />
                {new Intl.DateTimeFormat(lang === "km" ? "km-KH" : "en-US", {
                  timeZone: "Asia/Phnom_Penh",
                  month: "short",
                  day: "numeric",
                }).format(new Date())}
              </span>
            )}
            {tab === "team" && (
              <button
                className="button primary"
                onClick={() =>
                  setEditPerson({
                    id: id(),
                    name: "",
                    username: "",
                    role: "Cashier",
                    sites: [],
                    active: true,
                  })
                }
              >
                <Plus size={17} />
                {t("បន្ថែមបុគ្គលិក", "Add staff")}
              </button>
            )}
          </div>
          {tab === "overview" ? (
            <>
              <div className="stats-grid admin-stats">
                <Stat
                  label={t("ការលក់ថ្ងៃនេះ", "Today’s sales")}
                  value={money(1265000)}
                  detail={t(
                    "ទិន្នន័យគំរូ · ទីតាំងទាំងបី",
                    "Sample data · across 3 sites",
                  )}
                  icon={<TrendingUp size={19} />}
                />
                <Stat
                  label={t("ការកុម្ម៉ង់", "Orders served")}
                  value="142"
                  detail={t("សាច់ប្រាក់ និង QR", "Cash and QR combined")}
                  icon={<UtensilsCrossed size={19} />}
                />
                <Stat
                  label={t("សាច់ប្រាក់កំពុងកាន់", "Cash in custody")}
                  value={money(435000)}
                  detail={t("កំពុងកាន់ដោយបុគ្គលិក", "Held by site staff")}
                  icon={<Banknote size={19} />}
                />
                <Stat
                  label={t("ទីតាំងដំណើរការ", "Active sites")}
                  value={`${state.sites.filter((site) => site.active).length} / ${state.sites.length}`}
                  detail={t(
                    "តាមស្ថានភាពការកំណត់",
                    "Based on site configuration",
                  )}
                  icon={<Store size={19} />}
                />
              </div>
              <div className="dashboard-grid">
                <div className="panel">
                  <div className="section-title">
                    <h2>{t("ទីតាំងថ្ងៃនេះ", "Your sites today")}</h2>
                    <button
                      className="text-button"
                      onClick={() => setTab("sites")}
                    >
                      {t("មើលទាំងអស់", "View all")}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {state.sites.map((site, index) => (
                    <button
                      className="site-summary"
                      key={index}
                      onClick={() => {
                        setTab("sites");
                        setEditSite(index);
                      }}
                    >
                      <div className={`site-icon site-${index}`}>
                        <Store size={22} />
                      </div>
                      <div className="grow">
                        <strong>{site.name}</strong>
                        <small>
                          {
                            [
                              "Sokha & Sreypov",
                              "Chantha & Sreypov",
                              "Pisey & Chantha",
                            ][index]
                          }
                        </small>
                      </div>
                      <div className="align-right">
                        <strong>
                          {money([485000, 420000, 360000][index])}
                        </strong>
                        <Status tone={site.active ? "green" : "gray"}>
                          {site.active
                            ? t("បើក", "Open")
                            : t("ផ្អាក", "Inactive")}
                        </Status>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                <div className="panel">
                  <div className="section-title">
                    <h2>{t("ការលក់តាមទីតាំង", "Sales by site")}</h2>
                    <span>{t("គំរូ", "Sample")}</span>
                  </div>
                  <div className="sales-chart">
                    {state.sites.map((site, index) => (
                      <div key={index}>
                        <div>
                          <span>{site.name}</span>
                          <strong>
                            {money([485000, 420000, 360000][index])}
                          </strong>
                        </div>
                        <span className="bar-track">
                          <i style={{ width: `${[92, 80, 69][index]}%` }} />
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="chart-footer">
                    <span>{t("សរុប", "Total sales")}</span>
                    <strong>{money(1265000)}</strong>
                  </div>
                </div>
              </div>
              <div className="panel next-actions">
                <div className="section-title">
                  <h2>{t("ចាប់ផ្ដើមគ្រប់គ្រង", "Make it yours")}</h2>
                </div>
                <div className="quick-actions">
                  {[
                    {
                      tab: "menu",
                      icon: UtensilsCrossed,
                      title: t("កែតម្លៃមុខទំនិញ", "Set your menu prices"),
                      text: t(
                        "កំណត់តម្លៃផ្សេងគ្នាតាមទីតាំង",
                        "Different prices for different sites.",
                      ),
                    },
                    {
                      tab: "team",
                      icon: Users,
                      title: t("ចាត់បុគ្គលិកតាមទីតាំង", "Assign your team"),
                      text: t(
                        "បុគ្គលិកអាចមានទីតាំងច្រើន",
                        "Staff can work across multiple sites.",
                      ),
                    },
                    {
                      tab: "rules",
                      icon: Gift,
                      title: t(
                        "កំណត់ចំនួនឥតគិតថ្លៃ",
                        "Set complimentary allowances",
                      ),
                      text: t(
                        "ចែករំលែកចំនួនតាមក្រុមមុខទំនិញ",
                        "Share base-unit allowances across items.",
                      ),
                    },
                  ].map((action) => (
                    <button
                      key={action.tab}
                      onClick={() => setTab(action.tab as Tab)}
                    >
                      <span className="list-icon">
                        <action.icon size={22} />
                      </span>
                      <strong>{action.title}</strong>
                      <small>{action.text}</small>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : tab === "sites" ? (
            <div className="site-grid">
              {state.sites.map((site, index) => (
                <div className="panel site-card" key={index}>
                  <div className="site-card-top">
                    <div className={`site-icon site-${index}`}>
                      <Store size={28} />
                    </div>
                    <Status tone={site.active ? "green" : "gray"}>
                      {site.active
                        ? t("ដំណើរការ", "Active")
                        : t("ផ្អាក", "Inactive")}
                    </Status>
                  </div>
                  <h2>{site.name}</h2>
                  <p>
                    <MapPin size={14} />
                    {site.description}
                  </p>
                  <div className="site-team">
                    <Users size={17} />
                    {
                      state.people.filter(
                        (person) =>
                          person.active && person.sites.includes(index),
                      ).length
                    }{" "}
                    {t("បុគ្គលិកដែលបានចាត់តាំង", "assigned people")}
                  </div>
                  <div className="site-device">
                    <Smartphone size={17} />
                    {t(
                      "ឧបករណ៍ POS មួយក្នុងទីតាំង",
                      "One ordering POS per site",
                    )}
                  </div>
                  <button
                    className="button secondary full"
                    onClick={() => setEditSite(index)}
                  >
                    <Pencil size={16} />
                    {t("កែទីតាំង", "Edit site")}
                  </button>
                </div>
              ))}
            </div>
          ) : tab === "team" ? (
            <>
              <div className="catalog-tools">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    placeholder={t(
                      "ស្វែងរកឈ្មោះ ឬឈ្មោះអ្នកប្រើ",
                      "Search name or username…",
                    )}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <span className="muted">
                  {state.people.length} {t("គណនីគំរូ", "sample accounts")}
                </span>
              </div>
              <div className="panel table-panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("បុគ្គលិក", "Person")}</th>
                        <th>{t("តួនាទី", "Role")}</th>
                        <th>{t("ទីតាំង", "Site access")}</th>
                        <th>{t("ស្ថានភាព", "Status")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {state.people
                        .filter((person) =>
                          `${person.name} ${person.username}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((person) => (
                          <tr key={person.id}>
                            <td>
                              <div className="person-cell">
                                <div className="avatar">{person.name[0]}</div>
                                <div>
                                  <strong>{person.name}</strong>
                                  <small>@{person.username}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`role-tag ${person.role.toLowerCase()}`}
                              >
                                {person.role === "Owner"
                                  ? t("ម្ចាស់", "Owner")
                                  : person.role === "Supervisor"
                                    ? t("អ្នកគ្រប់គ្រង", "Supervisor")
                                    : t("អ្នកគិតលុយ", "Cashier")}
                              </span>
                            </td>
                            <td>
                              <div className="site-tags">
                                {person.sites.map((index) => (
                                  <span key={index}>
                                    {state.sites[index]?.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <Status tone={person.active ? "green" : "gray"}>
                                {person.active
                                  ? t("ដំណើរការ", "Active")
                                  : t("ផ្អាក", "Inactive")}
                              </Status>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Edit ${person.name}`}
                                onClick={() => setEditPerson(person)}
                              >
                                <Pencil size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="helper-box">
                <ShieldCheck size={19} />
                <span>
                  {t(
                    "អ្នកគ្រប់គ្រងអាចចាត់បុគ្គលិកទៅទីតាំង។ មានតែម្ចាស់ប៉ុណ្ណោះដែលកែតួនាទី និងការកំណត់ផ្សេងៗ។",
                    "Supervisors assign staff to managed sites. Only Owners manage roles and business configuration.",
                  )}
                </span>
              </div>
            </>
          ) : tab === "menu" ? (
            <>
              <div className="catalog-tools">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    placeholder={t("ស្វែងរកមុខទំនិញ…", "Search your catalog…")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <span className="muted">
                  {state.config.products.length}{" "}
                  {t("មុខទំនិញ", "sellable variants")}
                </span>
              </div>
              <div className="admin-product-grid">
                {state.config.products
                  .filter((product) =>
                    `${product.name} ${product.km} ${product.variant}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((product) => (
                    <div className="admin-product" key={product.id}>
                      <div className="admin-product-art">
                        <FoodArt food={product.food} />
                      </div>
                      <div className="admin-product-info">
                        <h3>{t(product.km, product.name)}</h3>
                        <p>{t(product.variantKm, product.variant)}</p>
                        <div>
                          <strong>
                            {money(
                              state.prices[0][
                                state.config.products.findIndex(
                                  (item) => item.id === product.id,
                                )
                              ],
                            )}
                          </strong>
                          <Status tone={product.sellable ? "green" : "gray"}>
                            {product.sellable
                              ? t("លក់បាន", "Sellable")
                              : t("ផ្អាក", "Hidden")}
                          </Status>
                        </div>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${product.name} ${product.variant}`}
                        onClick={() => setEditProduct(product)}
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                  ))}
              </div>
              <div className="panel">
                <h2>{t("តម្លៃទឹកជ្រលក់បន្ថែម", "Extra-sauce prices")}</h2>
                <p className="muted">
                  {t(
                    "តម្លៃគំរូ។ អាចកែតម្លៃសម្រាប់ទឹកជ្រលក់នីមួយៗ។",
                    "Sample values. Configure each extra sauce separately.",
                  )}
                </p>
                <div className="form-grid three">
                  {(["original", "chilly", "sichuan"] as Sauce[]).map(
                    (sauce) => (
                      <Field key={sauce} label={t(...sauceNames[sauce])}>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={state.config.extraPrices[sauce]}
                          onChange={(event) =>
                            setState((old) => ({
                              ...old,
                              config: {
                                ...old.config,
                                extraPrices: {
                                  ...old.config.extraPrices,
                                  [sauce]: number(event.target.value),
                                },
                              },
                            }))
                          }
                        />
                      </Field>
                    ),
                  )}
                </div>
              </div>
            </>
          ) : tab === "rules" ? (
            <>
              <div className="panel">
                <div className="section-title">
                  <h2>{t("បញ្ចុះតម្លៃវិក្កយបត្រ", "Receipt discount")}</h2>
                  <Gift size={19} />
                </div>
                <div className="form-grid">
                  <Field
                    label={t(
                      "ភាគរយអតិបរមា (%)",
                      "Maximum receipt discount (%)",
                    )}
                  >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={state.config.receiptMax}
                      onChange={(event) =>
                        setState((old) => ({
                          ...old,
                          config: {
                            ...old.config,
                            receiptMax: Math.min(
                              100,
                              number(event.target.value),
                            ),
                          },
                        }))
                      }
                    />
                  </Field>
                  <div className="rule-explanation">
                    {t(
                      "ប្រើការបញ្ចុះតម្លៃដែលខ្ពស់ជាង។ មិនបូកបញ្ចូលគ្នា ហើយមិនអាចលើសកម្រិតមុខទំនិញ។",
                      "Use the higher item or receipt discount. Never stack them or exceed the item’s hard limits.",
                    )}
                  </div>
                </div>
              </div>
              <div className="section-title">
                <div>
                  <h2>
                    {t("ក្រុមចំនួនឥតគិតថ្លៃ", "Complimentary allowance pools")}
                  </h2>
                  <p className="muted">
                    {t(
                      "កំណត់ចំនួនតាមឯកតាមូលដ្ឋាន និងមុខទំនិញដែលចែករំលែក",
                      "Set base-unit budgets and choose which items share them.",
                    )}
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    setEditGroup({
                      id: id(),
                      name: "",
                      km: "",
                      unit: "units",
                      daily: 0,
                      start: cambodiaDay(),
                      end: "",
                    })
                  }
                >
                  <Plus size={16} />
                  {t("បន្ថែមក្រុម", "Add pool")}
                </button>
              </div>
              <div className="pool-grid">
                {state.config.groups.map((group) => (
                  <div className="panel pool-card" key={group.id}>
                    <div className="section-title">
                      <div className="list-icon">
                        <Gift size={20} />
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${group.name} allowance`}
                        onClick={() => setEditGroup(group)}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                    <h3>
                      {lang === "km" ? group.km || group.name : group.name}
                    </h3>
                    <div className="pool-budget">
                      <strong>{group.daily}</strong>
                      <span>
                        {group.unit} / {t("ថ្ងៃ / ទីតាំង", "day / site")}
                      </span>
                    </div>
                    <div className="pool-members">
                      {state.config.products
                        .filter((product) => product.group === group.id)
                        .map((product) => (
                          <span key={product.id}>
                            {t(product.km, product.name)} · {product.units}{" "}
                            {group.unit}
                          </span>
                        ))}
                    </div>
                    {group.start && (
                      <small>
                        {group.start} →{" "}
                        {group.end || t("គ្មានថ្ងៃបញ្ចប់", "No end date")}
                      </small>
                    )}
                  </div>
                ))}
              </div>
              <div className="helper-box">
                <ShieldCheck size={18} />
                <span>
                  {t(
                    "មិនអាចផ្តល់ឥតគិតថ្លៃបើចំនួននៅសល់មិនគ្រប់គ្រាន់។ មុខទំនិញឥតគិតថ្លៃរួមបញ្ចូលការបន្ថែមទាំងអស់។",
                    "Block complimentary items when the full base-unit quantity is unavailable. All extras are free with the item.",
                  )}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="panel">
                <h2>{t("រូបិយប័ណ្ណ និងការទូទាត់", "Currency & payments")}</h2>
                <Field
                  label={t("រៀលក្នុងមួយដុល្លារ", "KHR per USD")}
                  hint={t(
                    "តម្លៃមុខទំនិញត្រូវបានកំណត់ជារៀល",
                    "All menu prices are entered in KHR.",
                  )}
                >
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={state.config.rate}
                    onChange={(event) =>
                      setState((old) => ({
                        ...old,
                        config: {
                          ...old.config,
                          rate: Math.max(1, number(event.target.value)),
                        },
                      }))
                    }
                  />
                </Field>
                <Toggle
                  label={t(
                    "អនុញ្ញាតបំបែកការទូទាត់សាច់ប្រាក់ និង QR",
                    "Allow an invoice to split Cash and QR payments",
                  )}
                  checked={state.config.split}
                  onChange={(split) =>
                    setState((old) => ({
                      ...old,
                      config: { ...old.config, split },
                    }))
                  }
                />
                <div className="detail-row">
                  <span>{t("បង្គត់វិក្កយបត្រ", "Invoice rounding")}</span>
                  <strong>{t("ជិតបំផុត 100៛", "Nearest 100 KHR")}</strong>
                </div>
                <div className="detail-row">
                  <span>{t("ប្រព័ន្ធ QR", "QR channels")}</span>
                  <strong>ABA · Bakong KHQR</strong>
                </div>
              </div>
              <div className="panel">
                <h2>{t("គណនី និងសិទ្ធិ", "Accounts & permissions")}</h2>
                <div className="detail-row">
                  <span>{t("ការចូលប្រើ", "Sign-in")}</span>
                  <strong>
                    {t("ឈ្មោះអ្នកប្រើ + PIN ៦ ខ្ទង់", "Username + 6-digit PIN")}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>{t("បង្កើតគណនី", "Account creation")}</span>
                  <strong>{t("ម្ចាស់ប៉ុណ្ណោះ", "Owner only")}</strong>
                </div>
                <div className="detail-row">
                  <span>
                    {t("បញ្ជាក់ការដកប្រាក់", "Withdrawal confirmation")}
                  </span>
                  <strong>
                    {t("អ្នកដក + អ្នកកាន់ប្រាក់", "Withdrawer + cash holder")}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>{t("ការសងប្រាក់", "Refunds")}</span>
                  <strong>{t("មិនអនុញ្ញាត", "Not allowed")}</strong>
                </div>
              </div>
              <div className="panel">
                <h2>{t("កម្មវិធី OneBite", "The OneBite apps")}</h2>
                <div className="app-grid">
                  {[
                    ["POS", "ការលក់", "Sales", "ready"],
                    ["Admin", "ការគ្រប់គ្រង", "Management", "ready"],
                    ["Attendance", "វត្តមាន", "Attendance", "later"],
                    ["Inventory", "ស្តុក", "Stock", "later"],
                  ].map(([name, km, en, status]) => (
                    <div key={name}>
                      <span className="app-icon">
                        <ShoppingIcon name={name} />
                      </span>
                      <strong>OneBite {name}</strong>
                      <small>{t(km, en)}</small>
                      <Status tone={status === "ready" ? "green" : "gray"}>
                        {status === "ready"
                          ? t("សាកល្បង", "Preview")
                          : t("នាពេលក្រោយ", "Planned")}
                      </Status>
                    </div>
                  ))}
                </div>
              </div>
              <p className="muted">
                {t(
                  "ការកំណត់នៅទីនេះជាទិន្នន័យសាកល្បងលើឧបករណ៍នេះ។ ការចែករំលែកជាមួយ POS នឹងភ្ជាប់ជាមួយមូលដ្ឋានទិន្នន័យ។",
                  "These are local sample settings. Shared POS configuration will be connected through the database.",
                )}
              </p>
            </>
          )}
        </main>
      </div>
      <nav
        className="bottom-nav admin-bottom-nav"
        aria-label="Admin navigation"
      >
        {navigation
          .filter((item) => ["overview", "menu", "team"].includes(item.id))
          .map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
            </button>
          ))}
        <button
          className={
            ["sites", "rules", "settings"].includes(tab) ? "active" : ""
          }
          onClick={() => setMore(true)}
        >
          <MoreHorizontal size={22} />
          <span>{t("ផ្សេងទៀត", "More")}</span>
        </button>
      </nav>
      {more && (
        <Modal
          title={t("គ្រប់គ្រង OneBite", "Manage OneBite")}
          onClose={() => setMore(false)}
        >
          {navigation
            .filter((item) => ["sites", "rules", "settings"].includes(item.id))
            .map((item) => (
              <button
                key={item.id}
                className="list-card full"
                onClick={() => {
                  setTab(item.id);
                  setMore(false);
                }}
              >
                <item.icon size={20} />
                <strong className="grow">{item.label}</strong>
                <ChevronRight size={17} />
              </button>
            ))}
        </Modal>
      )}
      {editProduct && (
        <ProductEditor
          product={editProduct}
          config={state.config}
          prices={state.prices.map(
            (prices) =>
              prices[
                state.config.products.findIndex(
                  (product) => product.id === editProduct.id,
                )
              ],
          )}
          sites={state.sites}
          onClose={() => setEditProduct(null)}
          onSave={(product, prices) => {
            const index = state.config.products.findIndex(
              (item) => item.id === product.id,
            );
            setState((old) => ({
              ...old,
              config: {
                ...old.config,
                products: old.config.products.map((item) =>
                  item.id === product.id ? product : item,
                ),
              },
              prices: old.prices.map((items, site) =>
                items.map((price, item) =>
                  item === index ? prices[site] : price,
                ),
              ),
            }));
            setEditProduct(null);
            saved();
          }}
        />
      )}
      {editPerson && (
        <PersonEditor
          person={editPerson}
          people={state.people}
          sites={state.sites}
          onClose={() => setEditPerson(null)}
          onSave={(person) => {
            setState((old) => ({
              ...old,
              people: old.people.some((item) => item.id === person.id)
                ? old.people.map((item) =>
                    item.id === person.id ? person : item,
                  )
                : [...old.people, person],
            }));
            setEditPerson(null);
            saved();
          }}
        />
      )}
      {editSite !== null && (
        <SiteEditor
          site={state.sites[editSite]}
          onClose={() => setEditSite(null)}
          onSave={(site) => {
            setState((old) => ({
              ...old,
              sites: old.sites.map((item, index) =>
                index === editSite ? site : item,
              ),
            }));
            setEditSite(null);
            saved();
          }}
        />
      )}
      {editGroup && (
        <GroupEditor
          group={editGroup}
          products={state.config.products}
          onClose={() => setEditGroup(null)}
          onSave={(group, members, factors) => {
            setState((old) => ({
              ...old,
              config: {
                ...old.config,
                groups: old.config.groups.some((item) => item.id === group.id)
                  ? old.config.groups.map((item) =>
                      item.id === group.id ? group : item,
                    )
                  : [...old.config.groups, group],
                products: old.config.products.map((product) =>
                  members.includes(product.id)
                    ? {
                        ...product,
                        group: group.id,
                        units: factors[product.id],
                      }
                    : product.group === group.id
                      ? { ...product, group: "" }
                      : product,
                ),
              },
            }));
            setEditGroup(null);
            saved();
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function ShoppingIcon({ name }: { name: string }) {
  return name === "POS" ? (
    <UtensilsCrossed size={22} />
  ) : name === "Admin" ? (
    <LayoutDashboard size={22} />
  ) : name === "Attendance" ? (
    <CalendarDays size={22} />
  ) : (
    <Package size={22} />
  );
}
function ProductEditor({
  product,
  config,
  prices,
  sites,
  onClose,
  onSave,
}: {
  product: Product;
  config: Config;
  prices: number[];
  sites: Site[];
  onClose: () => void;
  onSave: (product: Product, prices: number[]) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ ...product });
  const [sitePrices, setSitePrices] = useState(prices);
  const update = (changes: Partial<Product>) =>
    setDraft((old) => ({ ...old, ...changes }));
  return (
    <Modal title={t("កែប្រែមុខទំនិញ", "Edit menu item")} onClose={onClose} wide>
      <div className="editor-product">
        <FoodArt food={draft.food} />
        <div>
          <h3>{t(draft.km, draft.name)}</h3>
          <p>{t(draft.variantKm, draft.variant)}</p>
        </div>
      </div>
      <div className="form-grid">
        <Field label={t("ឈ្មោះជាខ្មែរ", "Khmer name")}>
          <input
            value={draft.km}
            onChange={(event) => update({ km: event.target.value })}
          />
        </Field>
        <Field label="English name">
          <input
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
          />
        </Field>
      </div>
      <Toggle
        label={t("អាចលក់នៅ POS", "Sellable in POS")}
        checked={draft.sellable}
        onChange={(sellable) => update({ sellable })}
      />
      <div className="section-title">
        <h3>{t("តម្លៃតាមទីតាំង (៛)", "Site prices (KHR)")}</h3>
      </div>
      <div className="form-grid three">
        {sites.map((site, index) => (
          <Field key={index} label={site.name}>
            <input
              type="number"
              min="0"
              step="100"
              value={sitePrices[index]}
              onChange={(event) =>
                setSitePrices((old) =>
                  old.map((price, i) =>
                    i === index ? number(event.target.value) : price,
                  ),
                )
              }
            />
          </Field>
        ))}
      </div>
      <div className="section-title">
        <h3>{t("ទឹកជ្រលក់ដែលអនុញ្ញាត", "Eligible sauces")}</h3>
      </div>
      <div className="option-grid">
        {(["original", "chilly", "sichuan"] as Sauce[]).map((sauce) => (
          <button
            key={sauce}
            className={`option ${draft.sauces.includes(sauce) ? "selected" : ""}`}
            onClick={() => {
              const sauces = draft.sauces.includes(sauce)
                ? draft.sauces.filter((item) => item !== sauce)
                : [...draft.sauces, sauce];
              update({
                sauces,
                defaultSauce: sauces.includes(draft.defaultSauce)
                  ? draft.defaultSauce
                  : (sauces[0] ?? "original"),
              });
            }}
          >
            {t(...sauceNames[sauce])}
            {draft.sauces.includes(sauce) && <Check size={15} />}
          </button>
        ))}
      </div>
      {draft.sauces.length > 0 && (
        <Field label={t("ទឹកជ្រលក់លំនាំដើម", "Default sauce")}>
          <select
            value={draft.defaultSauce}
            onChange={(event) =>
              update({ defaultSauce: event.target.value as Sauce })
            }
          >
            {draft.sauces.map((sauce) => (
              <option key={sauce} value={sauce}>
                {t(...sauceNames[sauce])}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="section-title">
        <h3>{t("កម្រិតបញ្ចុះតម្លៃ", "Hard discount limits")}</h3>
      </div>
      <div className="form-grid">
        <Field label={t("ភាគរយអតិបរមា (%)", "Maximum percentage (%)")}>
          <input
            type="number"
            min="0"
            max="100"
            value={draft.maxPercent}
            onChange={(event) =>
              update({ maxPercent: Math.min(100, number(event.target.value)) })
            }
          />
        </Field>
        <Field
          label={t(
            "ចំនួនអតិបរមាក្នុងមួយឯកតា (៛)",
            "Maximum amount per unit (KHR)",
          )}
        >
          <input
            type="number"
            min="0"
            step="100"
            value={draft.maxFixed}
            onChange={(event) =>
              update({ maxFixed: number(event.target.value) })
            }
          />
        </Field>
      </div>
      <button
        className="button primary full"
        disabled={!draft.name.trim() || !draft.km.trim()}
        onClick={() => onSave({ ...draft, price: sitePrices[0] }, sitePrices)}
      >
        <Check size={17} />
        {t("រក្សាទុកមុខទំនិញ", "Save sample item")}
      </button>
    </Modal>
  );
}
function PersonEditor({
  person,
  people,
  sites,
  onClose,
  onSave,
}: {
  person: Person;
  people: Person[];
  sites: Site[];
  onClose: () => void;
  onSave: (person: Person) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ ...person });
  const update = (changes: Partial<Person>) =>
    setDraft((old) => ({ ...old, ...changes }));
  const duplicate = people.some(
    (item) =>
      item.id !== draft.id &&
      item.username.toLowerCase() === draft.username.toLowerCase(),
  );
  return (
    <Modal title={t("គណនីបុគ្គលិក", "Staff account")} onClose={onClose}>
      <Field label={t("ឈ្មោះ", "Full name")}>
        <input
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
        />
      </Field>
      <Field label={t("ឈ្មោះអ្នកប្រើ", "Username")}>
        <input
          value={draft.username}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) =>
            update({
              username: event.target.value
                .toLowerCase()
                .replace(/[^a-z0-9_.-]/g, ""),
            })
          }
        />
      </Field>
      {duplicate && (
        <p className="error">
          {t("ឈ្មោះអ្នកប្រើនេះមានរួចហើយ", "This username is already used.")}
        </p>
      )}
      <Field label={t("តួនាទី", "Role")}>
        <select
          value={draft.role}
          onChange={(event) =>
            update({ role: event.target.value as Person["role"] })
          }
        >
          <option value="Cashier">{t("អ្នកគិតលុយ", "Cashier")}</option>
          <option value="Supervisor">{t("អ្នកគ្រប់គ្រង", "Supervisor")}</option>
          <option value="Owner">{t("ម្ចាស់", "Owner")}</option>
        </select>
      </Field>
      <div className="section-title">
        <h3>{t("សិទ្ធិតាមទីតាំង", "Site access")}</h3>
      </div>
      {sites.map((site, index) => (
        <Toggle
          key={index}
          label={site.name}
          checked={draft.sites.includes(index)}
          onChange={(checked) =>
            update({
              sites: checked
                ? [...draft.sites, index]
                : draft.sites.filter((item) => item !== index),
            })
          }
        />
      ))}
      <Toggle
        label={t("គណនីដំណើរការ", "Account active")}
        checked={draft.active}
        onChange={(active) => update({ active })}
      />
      <p className="helper">
        {t(
          "ការបង្កើត PIN និងការចូលប្រើពិត នឹងភ្ជាប់នៅដំណាក់កាលគណនី។",
          "PIN setup and real sign-in will be connected in the accounts milestone.",
        )}
      </p>
      <button
        className="button primary full"
        disabled={!draft.name.trim() || !draft.username || duplicate}
        onClick={() => onSave(draft)}
      >
        {t("រក្សាទុកគណនីគំរូ", "Save sample account")}
      </button>
    </Modal>
  );
}
function SiteEditor({
  site,
  onClose,
  onSave,
}: {
  site: Site;
  onClose: () => void;
  onSave: (site: Site) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ ...site });
  return (
    <Modal title={t("កែទីតាំង", "Edit site")} onClose={onClose}>
      <Field label={t("ឈ្មោះទីតាំង", "Site name")}>
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </Field>
      <Field label={t("ទីតាំង / កំណត់សម្គាល់", "Location / description")}>
        <input
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
        />
      </Field>
      <Toggle
        label={t("ទីតាំងដំណើរការ", "Site active")}
        checked={draft.active}
        onChange={(active) => setDraft({ ...draft, active })}
      />
      <button
        className="button primary full"
        disabled={!draft.name.trim()}
        onClick={() => onSave(draft)}
      >
        {t("រក្សាទុកទីតាំង", "Save sample site")}
      </button>
    </Modal>
  );
}
function GroupEditor({
  group,
  products,
  onClose,
  onSave,
}: {
  group: Group;
  products: Product[];
  onClose: () => void;
  onSave: (
    group: Group,
    members: string[],
    factors: Record<string, number>,
  ) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ ...group });
  const [members, setMembers] = useState(
    products
      .filter((product) => product.group === group.id)
      .map((product) => product.id),
  );
  const [factors, setFactors] = useState<Record<string, number>>(
    Object.fromEntries(products.map((product) => [product.id, product.units])),
  );
  return (
    <Modal
      title={t("ក្រុមចំនួនឥតគិតថ្លៃ", "Complimentary pool")}
      onClose={onClose}
      wide
    >
      <div className="form-grid">
        <Field label={t("ឈ្មោះជាខ្មែរ", "Khmer name")}>
          <input
            value={draft.km}
            onChange={(event) => setDraft({ ...draft, km: event.target.value })}
          />
        </Field>
        <Field label="English name">
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </Field>
        <Field
          label={t(
            "ចំនួនក្នុងមួយថ្ងៃ ក្នុងមួយទីតាំង",
            "Daily allowance per site",
          )}
        >
          <input
            type="number"
            min="0"
            value={draft.daily}
            onChange={(event) =>
              setDraft({ ...draft, daily: number(event.target.value) })
            }
          />
        </Field>
        <Field label={t("ឈ្មោះឯកតាមូលដ្ឋាន", "Base-unit label")}>
          <input
            value={draft.unit}
            onChange={(event) =>
              setDraft({ ...draft, unit: event.target.value })
            }
          />
        </Field>
        <Field label={t("ថ្ងៃចាប់ផ្ដើម", "Start date")}>
          <input
            type="date"
            value={draft.start ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, start: event.target.value })
            }
          />
        </Field>
        <Field label={t("ថ្ងៃបញ្ចប់", "End date")}>
          <input
            type="date"
            value={draft.end ?? ""}
            min={draft.start}
            onChange={(event) =>
              setDraft({ ...draft, end: event.target.value })
            }
          />
        </Field>
      </div>
      <div className="section-title">
        <h3>{t("មុខទំនិញដែលចែករំលែកចំនួន", "Items sharing this allowance")}</h3>
      </div>
      {products.map((product) => (
        <div className="pool-select-row" key={product.id}>
          <Toggle
            label={`${t(product.km, product.name)} · ${t(product.variantKm, product.variant)}`}
            checked={members.includes(product.id)}
            onChange={(checked) =>
              setMembers((old) =>
                checked
                  ? [...old, product.id]
                  : old.filter((item) => item !== product.id),
              )
            }
          />
          {members.includes(product.id) && (
            <Field label={t("ឯកតាដែលប្រើ", "Base units used")}>
              <input
                type="number"
                min="1"
                value={factors[product.id]}
                onChange={(event) =>
                  setFactors({
                    ...factors,
                    [product.id]: Math.max(1, number(event.target.value)),
                  })
                }
              />
            </Field>
          )}
        </div>
      ))}
      <button
        className="button primary full"
        disabled={
          !draft.name.trim() ||
          !draft.unit.trim() ||
          !members.length ||
          Boolean(draft.start && draft.end && draft.end < draft.start)
        }
        onClick={() => onSave(draft, members, factors)}
      >
        {t("រក្សាទុកក្រុម", "Save sample pool")}
      </button>
    </Modal>
  );
}
